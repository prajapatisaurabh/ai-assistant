# Architecture & Sequence Diagrams

Diagrams use [Mermaid](https://mermaid.js.org) and render on GitHub. They cover
the flows that cross the app ↔ native ↔ OpenAI boundaries. The app uses **BYOK**:
it calls OpenAI directly with the user's own key — there is no backend.

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
    Vault["Encrypted MMKV vault<br/>(OpenAI key)"]
    MMKV["MMKV<br/>(settings, history)"]
  end
  OAI["OpenAI API"]

  RN <-->|"NativeModule + events"| Mod
  Mod --> Svc --> Bubble
  Svc --- Clip
  RN --- Vault
  RN --- MMKV
  RN -->|"HTTPS + Bearer user key, SSE"| OAI
```

The key is read from the encrypted vault and attached as a Bearer token. It
never leaves the device except in the request to `api.openai.com`.

---

## 0. First-launch key gate

```mermaid
sequenceDiagram
  autonumber
  participant U as User
  participant K as ApiKeyScreen
  participant API as services/api.ts
  participant OAI as OpenAI
  participant V as Encrypted vault

  U->>K: Paste sk-... , tap "Validate key"
  K->>API: validateKey(key)
  API->>OAI: GET /v1/models (Bearer key)
  alt 200 OK
    OAI-->>API: model list
    API-->>K: {valid:true}  (no tokens spent)
    U->>K: Save & Continue
    K->>V: keyStorage.set(key)
    Note over K,U: App unlocks (tabs)
  else 401
    OAI-->>API: Unauthorized
    API-->>K: {valid:false, error}
  end
```

---

## 1. Streaming AI response (chat / improve)

Token-by-token streaming over Server-Sent Events, straight from OpenAI.

```mermaid
sequenceDiagram
  autonumber
  participant U as User
  participant RN as React Native (useAssistant)
  participant API as services/api.ts (XHR)
  participant OAI as OpenAI /chat/completions

  U->>RN: Type message, tap send
  RN->>RN: addMessage(user) + empty assistant msg (streaming=true)
  RN->>API: streamChat({messages, tone})
  API->>OAI: POST stream:true, Bearer <user key>
  loop each token chunk
    OAI-->>API: data: {choices:[{delta:{content}}]}
    API->>RN: onChunk(delta)
    RN->>RN: appendToMessage(assistantId, delta)
  end
  OAI-->>API: data: [DONE]
  API->>RN: onDone()
  RN->>RN: finalizeMessage(streaming=false)
  Note over RN,U: Copy / Regenerate now available
```

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
| OpenAI API key (user's own) | Encrypted MMKV vault on-device | `keyStorage.ts`; sent only to `api.openai.com` |
| Settings & chat history | Encrypted MMKV | `storage.ts` |
| Clipboard text | RAM only (native) | Never written to disk |
