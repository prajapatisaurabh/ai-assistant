import {MMKV} from 'react-native-mmkv';

/**
 * Encrypted on-device storage for the user's OpenAI API key.
 *
 * Uses a dedicated, encrypted MMKV instance (separate from app settings/history)
 * so the secret isn't sitting in plaintext. On a production app you'd derive the
 * encryption key per-install and keep it in the Android Keystore; here we use a
 * fixed key for simplicity. The API key never leaves the device except as the
 * Bearer token to api.openai.com.
 */
const vault = new MMKV({
  id: 'openai-key-vault',
  encryptionKey: 'byok-vault-key-change-per-install',
});

const KEY = 'openai_api_key';

export const keyStorage = {
  get(): string | null {
    return vault.getString(KEY) ?? null;
  },
  set(value: string): void {
    vault.set(KEY, value.trim());
  },
  clear(): void {
    vault.delete(KEY);
  },
};
