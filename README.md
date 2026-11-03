# AI Assistant — Android Floating AI Bubble

A **React Native + native Android (Kotlin)** app that puts a draggable AI
assistant bubble over every app. It improves text, generates social posts, and
summarizes content.

It uses a **BYOK (Bring Your Own Key)** model with a choice of two providers:

| Provider | Default model | Key | Cost |
| --- | --- | --- | --- |
| **Google Gemini** | `gemini-3.5-flash` | <https://aistudio.google.com/apikey> | Free tier |
| **OpenAI** | `gpt-4o-mini` | <https://platform.openai.com/api-keys> | Paid |

Each user enters their own key for the provider they pick. Keys are stored
**encrypted on-device** and used to call that provider **directly** — there is
no backend server to run or deploy.

```
┌──────────────────────┐     ┌──────────────────────────────┐     ┌─────────────────┐
│  React Native App     │ ⇄  │  Native Android Overlay        │     │  OpenAI API      │
│  (TypeScript, Zustand)│     │  (Kotlin: WindowManager FGS)   │     │   — or —         │
└──────────┬───────────┘     └──────────────────────────────┘     │  Gemini API      │
           │                                                       │  (OpenAI-compat) │
           │                                                       └────────▲────────┘
           └──────── HTTPS + Bearer <user's own key> (SSE streaming) ───────┘
```

Gemini is called through its **OpenAI-compatible endpoint**, so both providers
speak the same wire protocol and share one client (`services/api.ts`). A
provider differs only in base URL, model, and key — see the `PROVIDERS`
registry in `src/config.ts`.

## Repository layout

```
ai-assistant/
├── src/                       # React Native app (TypeScript)
│   ├── App.tsx                # Root: providers, key bootstrap, overlay events
│   ├── config.ts              # Provider registry: base URLs + models (NO secrets)
│   ├── navigation/            # Bottom tabs + API-key gate
│   ├── screens/               # ApiKey, Chat, Improve, Social, Settings
│   ├── components/            # Button, Chip, ToneSelector, MessageBubble, Card
│   ├── store/                 # Zustand: apiKey, settings, conversations
│   ├── services/              # api (LLM client), keyStorage, storage (MMKV)
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
| First-launch provider pick + API-key gate + token-free validation | `screens/ApiKeyScreen.tsx`, `validateKey()` in `services/api.ts` |
| Provider registry (OpenAI, Gemini) | `config.ts` (`PROVIDERS`) |
| Switch provider in Settings | `screens/SettingsScreen.tsx`, `switchProvider` in `store/apiKeyStore.ts` |
| Encrypted on-device key storage (one key per provider) | `services/keyStorage.ts` (encrypted MMKV), `store/apiKeyStore.ts` |
| Draggable floating bubble | `FloatingBubbleView.kt` (drag/tap detection, collapse/expand) |
| Overlay permission + foreground service | `OverlayModule.kt`, `OverlayService.kt`, `AndroidManifest.xml` |
| Text improvement (6 actions) | `screens/ImproveScreen.tsx`, `prompts/prompts.ts` |
| Social post generator (4 platforms, variations, hashtags) | `screens/SocialScreen.tsx` |
| Clipboard quick actions | `OverlayService.kt` clipboard listener → `useOverlayEvents.ts` |
| Chat panel (history, copy, regenerate, tone) | `screens/ChatScreen.tsx`, `hooks/useAssistant.ts` |
| Direct provider calls + streaming + retry on 5xx | `services/api.ts` (fetch + XHR/SSE) |
| Dark mode + Material 3 | `theme/`, `ThemeProvider.tsx` |

## Security model

- **BYOK** — each user supplies their own OpenAI or Gemini key, so there is no
  shared secret to steal from the app. The key is validated with a token-free
  `GET /models` call before it is saved. There is deliberately **no key-format
  check**: providers change formats (Gemini moved from `AIza…` to `AQ.…`), so
  only the provider's response decides whether a key is valid.
- **Encrypted key storage** — keys live in a dedicated encrypted MMKV vault
  (`keyStorage.ts`), one entry per provider, separate from settings/history. A
  key never leaves the device except as the `Authorization: Bearer` header to
  the provider it belongs to (`api.openai.com` or
  `generativelanguage.googleapis.com`) over HTTPS.
- **On-device storage** — settings & chat history live in encrypted MMKV (`storage.ts`).
- **Clipboard privacy** — copied text is used transiently for the chosen action and
  **never persisted** by the native layer (`OverlayService.kt`).
- **Foreground service transparency** — a persistent low-priority notification per Android policy.

> Trade-off: BYOK is ideal for personal / open-source use and needs no servers.
> If you ship this to many non-technical users, you'd typically move the key to a
> backend you control (so users don't need their own) — the API client isolates
> all provider calls in `services/api.ts`, making that swap straightforward.

## Getting started

```bash
# from the repo root
npm install
npm start            # Metro bundler (leave running)

# in another terminal, with an emulator running or a device plugged in:
npm run android      # builds the native Kotlin module + installs the app
```

On first launch the app shows the **API-key screen**. Pick a provider (Gemini
is preselected because it has a free tier), paste your key, tap
**Validate key**, then **Save & Continue**.

Under **Settings → AI provider** you can switch providers, re-validate, or
replace the key. Each provider keeps its own key, so switching back and forth
doesn't require re-pasting; switching to a provider with no saved key returns
you to the key screen.

Models are set per provider in `src/config.ts`.

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
- Play Store bundle: `cd android && ./gradlew bundleRelease`. Release signing
  reads `android/keystore.properties` (gitignored); see
  [`docs/PLAY_STORE.md`](docs/PLAY_STORE.md).

## Checks

```bash
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm test             # Jest (prompt builders + provider/key validation)
```

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — component diagram + sequence
  diagrams for streaming, clipboard quick-actions, and bubble lifecycle.
- [`docs/EXAMPLE_PROMPTS.md`](docs/EXAMPLE_PROMPTS.md) — ready-to-use text
  correction and social-generation prompt examples.
- [`docs/PLAY_STORE.md`](docs/PLAY_STORE.md) — Play Store listing copy, privacy
  policy, data safety answers, and release steps.
- [`CLAUDE.md`](CLAUDE.md) — guidance for Claude Code when working in this repo.
