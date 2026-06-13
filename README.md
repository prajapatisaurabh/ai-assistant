# AI Assistant — Android Floating AI Bubble

A **React Native + native Android (Kotlin)** app that puts a draggable AI
assistant bubble over every app. It improves text, generates social posts, and
summarizes content.

It uses a **BYOK (Bring Your Own Key)** model: each user enters their own OpenAI
API key on first launch. The key is stored **encrypted on-device** and used to
call OpenAI **directly** — there is no backend server to run or deploy.

```
┌──────────────────────┐     ┌──────────────────────────────┐     ┌────────────┐
│  React Native App     │ ⇄  │  Native Android Overlay        │     │  OpenAI API │
│  (TypeScript, Zustand)│     │  (Kotlin: WindowManager FGS)   │     │            │
└──────────┬───────────┘     └──────────────────────────────┘     └─────▲──────┘
           │                                                              │
           └──────── HTTPS + Bearer <user's own key> (SSE streaming) ─────┘
```

## Repository layout

```
ai-assistant/
├── src/                       # React Native app (TypeScript)
│   ├── App.tsx                # Root: providers, key bootstrap, overlay events
│   ├── config.ts              # OpenAI base URL + model (NO secrets)
│   ├── navigation/            # Bottom tabs + API-key gate
│   ├── screens/               # ApiKey, Chat, Improve, Social, Settings
│   ├── components/            # Button, Chip, ToneSelector, MessageBubble, Card
│   ├── store/                 # Zustand: apiKey, settings, conversations
│   ├── services/              # api (OpenAI client), keyStorage, storage (MMKV)
│   ├── native/                # OverlayModule.ts — JS bridge to Kotlin
│   ├── hooks/                 # useAssistant, useBubble, useOverlayEvents
│   ├── theme/                 # Material 3 light/dark theme + provider
│   └── prompts/               # Prompt library (built on-device)
│
└── android/                   # Native Android layer (Kotlin)
    └── app/src/main/java/com/aiassistant/
        ├── MainApplication.kt / MainActivity.kt
        └── overlay/
            ├── OverlayModule.kt      # ReactMethods: permission, start/stop, events
            ├── OverlayPackage.kt     # Registers the module
            ├── OverlayService.kt     # Foreground service + WindowManager + clipboard
            └── FloatingBubbleView.kt # Draggable, collapsible bubble + quick actions
```

## Feature → code map

| Feature | Where |
| --- | --- |
| First-launch API-key gate + token-free validation | `screens/ApiKeyScreen.tsx`, `validateKey()` in `services/api.ts` |
| Encrypted on-device key storage | `services/keyStorage.ts` (encrypted MMKV), `store/apiKeyStore.ts` |
| Draggable floating bubble | `FloatingBubbleView.kt` (drag/tap detection, collapse/expand) |
| Overlay permission + foreground service | `OverlayModule.kt`, `OverlayService.kt`, `AndroidManifest.xml` |
| Text improvement (6 actions) | `screens/ImproveScreen.tsx`, `prompts/prompts.ts` |
| Social post generator (4 platforms, variations, hashtags) | `screens/SocialScreen.tsx` |
| Clipboard quick actions | `OverlayService.kt` clipboard listener → `useOverlayEvents.ts` |
| Chat panel (history, copy, regenerate, tone) | `screens/ChatScreen.tsx`, `hooks/useAssistant.ts` |
| Direct OpenAI calls + streaming | `services/api.ts` (fetch + XHR/SSE) |
| Dark mode + Material 3 | `theme/`, `ThemeProvider.tsx` |

## Security model

- **BYOK** — each user supplies their own OpenAI key, so there is no shared
  secret to steal from the app. The key is validated with a token-free
  `GET /v1/models` call before it is saved.
- **Encrypted key storage** — the key lives in a dedicated encrypted MMKV vault
  (`keyStorage.ts`), separate from settings/history, and never leaves the device
  except as the `Authorization: Bearer` header to `api.openai.com` over HTTPS.
- **On-device storage** — settings & chat history live in encrypted MMKV (`storage.ts`).
- **Clipboard privacy** — copied text is used transiently for the chosen action and
  **never persisted** by the native layer (`OverlayService.kt`).
- **Foreground service transparency** — a persistent low-priority notification per Android policy.

> Trade-off: BYOK is ideal for personal / open-source use and needs no servers.
> If you ship this to many non-technical users, you'd typically move the key to a
> backend you control (so users don't need their own) — the API client isolates
> all OpenAI calls in `services/api.ts`, making that swap straightforward.

## Getting started

```bash
# from the repo root
npm install
npm start            # Metro bundler (leave running)

# in another terminal, with an emulator running or a device plugged in:
npm run android      # builds the native Kotlin module + installs the app
```

On first launch the app shows the **API-key screen**: paste your OpenAI key
(`sk-...`), tap **Validate key**, then **Save & Continue**. Get a key at
<https://platform.openai.com/api-keys>. Change or re-validate it anytime under
**Settings → OpenAI API key**.

The model defaults to `gpt-4o-mini` (`src/config.ts`).

> The native overlay module requires a real build (`npm run android`), not just
> Metro. Enable the bubble under **Settings → Show floating assistant** and grant
> "Display over other apps" when prompted.

### Build notes

- This repo ships hand-authored Android config. If the Gradle wrapper jar is
  missing, copy it from `node_modules/@react-native/gradle-plugin/` (`gradlew` +
  `gradle/wrapper/gradle-wrapper.jar`) or run `gradle wrapper`.
- A debug `debug.keystore` is required at `android/app/`; generate one with
  `keytool` if absent.
- Debug builds load JS from Metro; for a standalone phone install, build a
  **release** APK: `cd android && ./gradlew assembleRelease`
  (output: `android/app/build/outputs/apk/release/app-release.apk`).

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — component diagram + sequence
  diagrams for streaming, clipboard quick-actions, and bubble lifecycle.
- [`docs/EXAMPLE_PROMPTS.md`](docs/EXAMPLE_PROMPTS.md) — ready-to-use text
  correction and social-generation prompt examples.
