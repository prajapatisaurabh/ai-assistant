/**
 * App-level configuration.
 *
 * BYOK (Bring Your Own Key): the app calls OpenAI directly using the key the
 * user enters on first launch. The key is stored encrypted on-device only
 * (see services/keyStorage.ts) and never leaves the phone except in the
 * Authorization header of requests to api.openai.com over HTTPS.
 */
export const OPENAI_BASE_URL = 'https://api.openai.com/v1';

/** Default model. Fast + cheap; good for rewriting/summarizing/social posts. */
export const OPENAI_MODEL = 'gpt-4o-mini';
