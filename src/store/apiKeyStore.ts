import {create} from 'zustand';
import {keyStorage} from '@/services/keyStorage';
import {ProviderId} from '@/config';
import {getProvider, useSettingsStore} from '@/store/settingsStore';

type Status = 'loading' | 'no-key' | 'ready';

interface ApiKeyState {
  /** The key for the ACTIVE provider, or null if that provider has none. */
  key: string | null;
  status: Status;
  /** Read the active provider's persisted key on app launch. */
  load: () => void;
  /** Persist a (validated) key for the active provider and unlock the app. */
  setKey: (key: string) => void;
  /** Remove the active provider's key — sends the user back to the key screen. */
  clear: () => void;
  /**
   * Switch providers. Re-derives the key and status from the vault, so moving
   * to a provider you have no key for drops you on the key screen, and moving
   * back to one you do have restores it without re-pasting.
   */
  switchProvider: (provider: ProviderId) => void;
}

export const useApiKeyStore = create<ApiKeyState>(set => ({
  key: null,
  status: 'loading',

  load: () => {
    const key = keyStorage.get(getProvider());
    set({key, status: key ? 'ready' : 'no-key'});
  },

  setKey: key => {
    const trimmed = key.trim();
    keyStorage.set(getProvider(), trimmed);
    set({key: trimmed, status: 'ready'});
  },

  clear: () => {
    keyStorage.clear(getProvider());
    set({key: null, status: 'no-key'});
  },

  switchProvider: provider => {
    useSettingsStore.getState().setProvider(provider);
    const key = keyStorage.get(provider);
    set({key, status: key ? 'ready' : 'no-key'});
  },
}));

/** Lets the non-React api layer read the current key. */
export const getApiKey = (): string | null => useApiKeyStore.getState().key;

/** Masked form for display, e.g. "AIzaSy…a1b2". Prefix-agnostic. */
export const maskKey = (key: string | null): string => {
  if (!key) {
    return '—';
  }
  if (key.length <= 8) {
    return '••••';
  }
  return `${key.slice(0, 6)}…${key.slice(-4)}`;
};
