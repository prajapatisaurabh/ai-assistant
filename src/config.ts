/**
 * App-level configuration.
 *
 * BYOK (Bring Your Own Key): the app calls the chosen LLM provider directly
 * using the key the user enters. Keys are stored encrypted on-device only (see
 * services/keyStorage.ts) and never leave the phone except in the Authorization
 * header of HTTPS requests to that provider.
 *
 * Gemini is reached through its OpenAI-compatible endpoint, so both providers
 * speak the same wire protocol and share one client (services/api.ts).
 */

export type ProviderId = 'openai' | 'gemini';

export interface ProviderConfig {
  id: ProviderId;
  label: string;
  /** Base URL for an OpenAI-compatible /chat/completions + /models API. */
  baseUrl: string;
  model: string;
  /**
   * Placeholder shown in the key field — a hint only.
   *
   * Note there is deliberately no key-format *validation* anywhere in the app.
   * Providers rebrand key formats (Google moved from 'AIza' standard keys to
   * 'AQ.' auth keys in 2026, retiring the old ones), and a hardcoded prefix
   * check would have locked every new user out. The authoritative check is the
   * free GET /models call in validateKey.
   */
  keyPlaceholder: string;
  /** Where the user goes to get a key. */
  consoleUrl: string;
  /** True when the provider has a no-cost tier — surfaced in the UI. */
  isFree: boolean;
}

export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  gemini: {
    id: 'gemini',
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-3.5-flash',
    keyPlaceholder: 'AQ.Ab...',
    consoleUrl: 'https://aistudio.google.com/apikey',
    isFree: true,
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    keyPlaceholder: 'sk-...',
    consoleUrl: 'https://platform.openai.com/api-keys',
    isFree: false,
  },
};

export const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[];

/**
 * Default for installs that have never chosen a provider.
 *
 * Stays 'openai' on purpose: existing installs have a persisted settings blob
 * with no `provider` field and would inherit this default, so switching it to
 * 'gemini' would strand every current user on a provider they have no key for.
 * New users are steered to Gemini by ApiKeyScreen, which preselects it.
 */
export const DEFAULT_PROVIDER: ProviderId = 'openai';

/** The provider a first-time user lands on (free tier — no card required). */
export const ONBOARDING_PROVIDER: ProviderId = 'gemini';
