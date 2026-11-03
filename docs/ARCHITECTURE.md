# Architecture & Sequence Diagrams

Diagrams use [Mermaid](https://mermaid.js.org) and render on GitHub. They cover
the flows that cross the app ↔ native ↔ LLM-provider boundaries. The app uses
**BYOK**: it calls the user's chosen provider (**OpenAI** or **Google Gemini**)
directly with the user's own key — there is no backend.

Gemini is reached through its OpenAI-compatible endpoint
(`generativelanguage.googleapis.com/v1beta/openai`), so both providers use the
same `/models` and `/chat/completions` protocol and one client
(`services/api.ts`) serves both. The diagrams below label that endpoint
"Provider"; only the base URL, model, and key change between providers
(`PROVIDERS` in `src/config.ts`).

## Components

```mermaid
flowchart LR
  subgraph Device
    RN["React Native App<br/>(TS, Zustand)"]
    subgraph Native["Native Android (Kotlin)"]
      Mod["OverlayModule"]
      Svc["OverlayService<br/>(Foreground)"]
      Bubble["FloatingBubbleView<br/>(WindowManager)"]
      Clip["ClipboardManager<br/>listener"]
    end
    Vault["Encrypted MMKV vault<br/>(one key per provider)"]
    MMKV["MMKV<br/>(settings incl. active provider,<br/>history)"]
  end
  OAI["OpenAI API"]
  GEM["Gemini API<br/>(OpenAI-compatible)"]

  RN <-->|"NativeModule + events"| Mod
  Mod --> Svc --> Bubble
  Svc --- Clip
  RN --- Vault
  RN --- MMKV
  RN -->|"HTTPS + Bearer user key, SSE"| OAI
  RN -->|"HTTPS + Bearer user key, SSE"| GEM
```

Only the **active** provider is called. Its key is read from the encrypted
vault and attached as a Bearer token; a key never leaves the device except in
requests to the provider it belongs to.

`api.ts` doesn't import the stores (that would be a circular import). Instead,
`App.tsx` calls `registerProviderContext()` at startup, and the client reads
the active provider and key through that getter on every request.

---

## 0. First-launch key gate

```mermaid
sequenceDiagram
  autonumber
  participant U as User
  participant K as ApiKeyScreen
  participant API as services/api.ts
  participant OAI as Provider (OpenAI / Gemini)
  participant V as Encrypted vault

  Note over K: Gemini preselected (free tier)
  U->>K: Pick provider, paste key, tap "Validate key"
  K->>API: validateKey(key, provider)
  API->>OAI: GET {baseUrl}/models (Bearer key)
  alt 200 OK
    OAI-->>API: model list
    API-->>K: {valid:true}  (no tokens spent)
    U->>K: Save & Continue
    K->>V: keyStorage.set(provider, key)
    Note over K,U: App unlocks (tabs)
  else 401
    OAI-->>API: Unauthorized
    API-->>K: {valid:false, error}
  end
```

The key's format is never checked locally. Providers change key formats
(Gemini moved from `AIza…` to `AQ.…`), so only the `/models` response decides.

**Switching provider** (Settings → AI provider) calls
`apiKeyStore.switchProvider(id)`. It saves the new provider in settings and
loads that provider's key from the vault. If a key is stored, the app stays
unlocked. If not, `status` becomes `no-key` and `RootNavigator` shows
`ApiKeyScreen` again.

---

## 1. Streaming AI response (chat / improve)

Token-by-token streaming over Server-Sent Events, straight from the active
provider. Both providers send OpenAI-shaped frames.

```mermaid
sequenceDiagram
  autonumber
  participant U as User
  participant RN as React Native (useAssistant)
  participant API as services/api.ts (XHR)
  participant OAI as Provider /chat/completions

  U->>RN: Type message, tap send
  RN->>RN: addMessage(user) + empty assistant msg (streaming=true)
  RN->>API: streamChat({messages, tone})
  API->>OAI: POST stream:true, Bearer <user key>
  loop each token chunk
    OAI-->>API: data: {choices:[{delta:{content}}]}
    API->>RN: onChunk(delta)
    RN->>RN: appendToMessage(assistantId, delta)
  end
  OAI-->>API: data: [DONE] (or the stream just ends)
  API->>RN: onDone()
  RN->>RN: finalizeMessage(streaming=false)
  Note over RN,U: Copy / Regenerate now available
```

- **No `[DONE]` from Gemini:** Gemini's compat layer doesn't always send the
  `[DONE]` sentinel, so `xhr.onload` also calls `onDone` if the stream closes
  without one.
- **Retries:** a 500/502/503/504 response is retried up to 3 attempts with
  exponential backoff and jitter. The Gemini free tier returns 503 often. A
  stream is retried only if it failed **before** any token was shown;
  otherwise the retry would duplicate text. Non-streaming calls
  (`complete()`) use the same retry policy.

**Regenerate** clears the assistant message content and replays the same
history (`useAssistant.regenerate` → another `streamChat` call).

---

## 2. Clipboard quick-action

Event-driven (no polling). Copied text is used transiently and never persisted
by the native layer.

```mermaid
sequenceDiagram
  autonumber
  participant U as User (any app)
  participant OS as Android Clipboard
  participant Svc as OverlayService
  participant Bub as FloatingBubbleView
  participant Mod as OverlayModule
  participant RN as React Native

  U->>OS: Copy text
  OS-->>Svc: onPrimaryClipChanged()
  alt clipboard watch enabled
    Svc->>Svc: coerceToText() (held in memory only)
    Svc->>Bub: showQuickActions(text)
    Bub-->>U: Expand chips: Improve · Summarize · Social
    U->>Bub: Tap "Improve"
    Bub->>Svc: callback onQuickAction("improve", text)
    Svc->>Mod: emit OverlayEvent{quickAction, action, text}
    Svc->>RN: startActivity(MainActivity)
    Mod-->>RN: OverlayEvent (DeviceEventEmitter)
    RN->>RN: useOverlayEvents → newConversation + seed prompt
  else watch disabled
    Svc-->>Svc: ignore
  end
```

---

## 3. Floating bubble lifecycle & overlay permission

```mermaid
sequenceDiagram
  autonumber
  participant U as User
  participant RN as Settings (useBubble)
  participant Mod as OverlayModule
  participant OS as Android
  participant Svc as OverlayService

  U->>RN: Toggle "Show floating assistant" ON
  RN->>Mod: hasOverlayPermission()
  Mod-->>RN: false
  RN->>Mod: requestOverlayPermission()
  Mod->>OS: ACTION_MANAGE_OVERLAY_PERMISSION (Settings)
  U->>OS: Grant "Display over other apps"
  RN->>Mod: hasOverlayPermission() (re-check)
  Mod-->>RN: true
  RN->>Mod: startBubble()
  Mod->>Svc: startForegroundService(ACTION_START)
  Svc->>OS: startForeground(notification)
  Svc->>OS: WindowManager.addView(bubble, TYPE_APPLICATION_OVERLAY)
  Svc-->>U: Draggable bubble visible over all apps
  Note over RN,Svc: Toggle OFF → stopBubble() → stopService() → removeView()
```

---

## Data & secret boundaries

| Data | Where it lives | Notes |
| --- | --- | --- |
| OpenAI / Gemini API keys (user's own) | Encrypted MMKV vault on-device, one entry per provider (`<provider>_api_key`) | `keyStorage.ts`; each sent only to its own provider (`api.openai.com` / `generativelanguage.googleapis.com`) |
| Settings (incl. active provider) & chat history | Encrypted MMKV | `storage.ts` |
| Clipboard text | RAM only (native) | Never written to disk |
