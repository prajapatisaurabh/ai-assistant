# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An Android-only React Native 0.75 app (TypeScript) plus a hand-written Kotlin native layer that draws a floating AI bubble over other apps. It is **BYOK with no backend**: the app calls the user's chosen LLM provider (**OpenAI** or **Google Gemini**) directly with the user's own key, which is stored encrypted on the device. `docs/ARCHITECTURE.md` has sequence diagrams for the key gate, streaming, clipboard quick-actions and the bubble lifecycle.

## Commands

```bash
npm start                 # Metro bundler
npm run android           # build native Kotlin + install debug build (needs emulator/device)
npm run lint              # eslint (.ts/.tsx)
npm run typecheck         # tsc --noEmit (excludes __tests__)
npm test                  # jest
npx jest src/services/__tests__/providers.test.ts   # single test file
npx jest -t "validateKey"                           # tests matching a name

cd android && ./gradlew assembleRelease   # standalone release APK
cd android && ./gradlew bundleRelease     # Play Store AAB
```

- The lockfile is `yarn.lock`.
- Changes to the native overlay need a real native build (`npm run android`). Reloading Metro is not enough.
- Release signing reads `android/keystore.properties` (gitignored). Without it, release builds fall back to the debug keystore. For every Play Store upload, bump `versionCode`/`versionName` in `android/app/build.gradle` (see `docs/PLAY_STORE.md`).
- If the Gradle wrapper jar is missing, copy it from `node_modules/@react-native/gradle-plugin/`.

## Architecture

**Path alias:** `@/` → `src/`. It is configured in three places that must stay in sync: `tsconfig.json`, `babel.config.js` (module-resolver) and the jest `moduleNameMapper` in `package.json`.

**LLM client (`src/services/api.ts`)**
- A single OpenAI-wire-protocol client serves every provider. Gemini is reached through its OpenAI-compatible endpoint (`.../v1beta/openai`).
- Each provider differs only in its `baseUrl`, `model` and key, all defined in the `PROVIDERS` registry in `src/config.ts`. To add a provider, add an entry there and to the `ProviderId` type.
- `api.ts` does not import the stores, which avoids a circular import. Instead, `App.tsx` calls `registerProviderContext(() => ({provider, key}))` at module load, and `api.ts` reads the active provider and key through that getter.
- Non-streaming calls use `fetch` (`complete`). Chat streaming uses `XMLHttpRequest` + manual SSE parsing (`streamCompletion`), because RN `fetch` can't stream.
- Gemini doesn't always send `[DONE]`, so `onload` also fires `onDone`.
- 5xx responses are retried with backoff (up to 3 attempts). A stream is retried only if it failed **before** emitting any token; otherwise the retry would duplicate text already shown.
- `validateKey` checks a key by calling the free `GET /models` endpoint.

**Deliberate invariants (guarded by tests in `src/services/__tests__/providers.test.ts`)**
- No key-format/prefix validation anywhere. Google moved Gemini keys from `AIza` to `AQ.`, and a prefix check would lock users out. Only the provider's response decides whether a key is valid.
- `DEFAULT_PROVIDER` must stay `'openai'`. Existing installs have a persisted settings blob with no `provider` field and inherit this default. New users are steered to Gemini via `ONBOARDING_PROVIDER` on `ApiKeyScreen` instead.

**State and storage**
- Zustand stores live in `src/store/`. `settingsStore` and `conversationStore` persist through the MMKV adapter in `services/storage.ts`.
- API keys live in a **separate** encrypted MMKV vault (`services/keyStorage.ts`) with one entry per provider (`<provider>_api_key`).
- The vault id `openai-key-vault` and the `openai_api_key` entry name are kept for backward compatibility. Don't rename them.
- `apiKeyStore.status` (`loading | no-key | ready`) gates the whole UI in `navigation/RootNavigator.tsx`: when there is no key for the active provider, `ApiKeyScreen` is shown instead of the tabs. `switchProvider` re-derives this status from the vault.

**Native overlay bridge**
- `src/native/OverlayModule.ts` is the typed JS wrapper. It throws a linking error on non-Android platforms.
- Kotlin side (`android/app/src/main/java/com/aiassistant/overlay/`):
  - `OverlayModule` exposes the `@ReactMethod`s.
  - `OverlayService` is a foreground service that owns the `WindowManager` bubble (`FloatingBubbleView`) and the clipboard listener.
- Native → JS traffic goes through a single `"OverlayEvent"` emitter carrying a `type` discriminator (`bubbleTapped | quickAction | clipboardChanged | bubbleClosed`).
- `hooks/useOverlayEvents.ts` turns `quickAction` events into a new conversation seeded with the text.
- When you add a method or event, update both the Kotlin module and the `OverlayNativeModule` / `OverlayEvent` types.
- Clipboard text must never be persisted by the native layer.

**Prompts:** all prompt text is built on-device in `src/prompts/prompts.ts` (`SYSTEM_PROMPT`, `build*Prompt`). The social generator splits the model's output into variations on `---` lines, so prompt changes must keep that delimiter.

## Lint rules worth knowing

- `react/jsx-no-leaked-render` (ternary only). `{value && <JSX/>}` with `""`/`0` renders raw text outside `<Text>` and crashes on native, so use `cond ? <X/> : null`.
- Unused vars/args prefixed with `_` are allowed (supports the `const {[id]: _removed, ...rest} = obj` omit idiom).
