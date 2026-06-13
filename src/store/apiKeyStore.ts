import {create} from 'zustand';
import {keyStorage} from '@/services/keyStorage';

type Status = 'loading' | 'no-key' | 'ready';

interface ApiKeyState {
  key: string | null;
  status: Status;
  /** Read the persisted key on app launch. */
  load: () => void;
  /** Persist a (validated) key and unlock the app. */
  setKey: (key: string) => void;
  /** Remove the key — sends the user back to the key-entry screen. */
  clear: () => void;
}

export const useApiKeyStore = create<ApiKeyState>(set => ({
  key: null,
  status: 'loading',

  load: () => {
    const key = keyStorage.get();
    set({key, status: key ? 'ready' : 'no-key'});
  },

  setKey: key => {
    const trimmed = key.trim();
    keyStorage.set(trimmed);
    set({key: trimmed, status: 'ready'});
  },

  clear: () => {
    keyStorage.clear();
    set({key: null, status: 'no-key'});
  },
}));

/** Lets the non-React api layer read the current key. */
export const getApiKey = (): string | null => useApiKeyStore.getState().key;

/** Masked form for display, e.g. "sk-…a1b2". */
export const maskKey = (key: string | null): string => {
  if (!key) {
    return '—';
  }
  if (key.length <= 8) {
    return 'sk-…';
  }
  return `${key.slice(0, 5)}…${key.slice(-4)}`;
};
