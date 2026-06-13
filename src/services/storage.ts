import {MMKV} from 'react-native-mmkv';

/**
 * Fast, synchronous key-value storage for app state (settings, conversation
 * history). Encrypted at rest with an MMKV encryption key.
 *
 * For production, generate this key once per install and keep it in secure
 * device storage (Android Keystore), then pass it here — do not ship a
 * hard-coded key.
 */
export const storage = new MMKV({
  id: 'ai-assistant-store',
  encryptionKey: 'change-me-per-install',
});

/** Zustand persist-compatible adapter backed by MMKV. */
export const mmkvStorage = {
  getItem: (name: string) => {
    const value = storage.getString(name);
    return value ?? null;
  },
  setItem: (name: string, value: string) => {
    storage.set(name, value);
  },
  removeItem: (name: string) => {
    storage.delete(name);
  },
};
