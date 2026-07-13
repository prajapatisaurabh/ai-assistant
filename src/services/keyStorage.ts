import {MMKV} from 'react-native-mmkv';
import {PROVIDER_IDS, ProviderId} from '@/config';

/**
 * Encrypted on-device storage for the user's provider API keys.
 *
 * Uses a dedicated, encrypted MMKV instance (separate from app settings/history)
 * so the secrets aren't sitting in plaintext. On a production app you'd derive the
 * encryption key per-install and keep it in the Android Keystore; here we use a
 * fixed key for simplicity. Keys never leave the device except as the Bearer
 * token to the provider they belong to.
 *
 * One entry per provider, so a user can hold an OpenAI key and a Gemini key at
 * once and switch between them without re-pasting. The 'openai' entry keeps the
 * name the single-provider build used, so existing installs keep their key.
 */
const vault = new MMKV({
  id: 'openai-key-vault',
  encryptionKey: 'byok-vault-key-change-per-install',
});

const entryFor = (provider: ProviderId) => `${provider}_api_key`;

export const keyStorage = {
  get(provider: ProviderId): string | null {
    return vault.getString(entryFor(provider)) ?? null;
  },
  set(provider: ProviderId, value: string): void {
    vault.set(entryFor(provider), value.trim());
  },
  clear(provider: ProviderId): void {
    vault.delete(entryFor(provider));
  },
  /** Wipes every provider's key. */
  clearAll(): void {
    PROVIDER_IDS.forEach(id => vault.delete(entryFor(id)));
  },
};
