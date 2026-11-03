import {create} from 'zustand';
import {keyStorage} from '@/services/keyStorage';
import {PROVIDER_IDS, ProviderId} from '@/config';
import {getProvider, useSettingsStore} from '@/store/settingsStore';

type Status = 'loading' | 'no-key' | 'ready';

interface ApiKeyState {
  /** The key for the ACTIVE provider, or null if that provider has none. */
  key: string | null;
  /**
   * 'no-key' means NO provider has a key — only then does RootNavigator show
   * the first-launch ApiKeyScreen. Once any key exists the app stays unlocked;
   * adding or replacing keys later happens inside Settings.
   */
  status: Status;
  /** Read the persisted key on app launch. */
  load: () => void;
  /**
   * Persist a (validated) key for `provider`, make it the active provider and
   * unlock the app. Overwrites any existing key for that provider.
   */
  saveKey: (provider: ProviderId, key: string) => void;
  /**
   * Switch to a provider that already has a key. Returns false and changes
   * nothing if it has none — the caller should collect a key with saveKey
   * instead, so the user is never locked out of the app mid-session.
   */
  switchProvider: (provider: ProviderId) => boolean;
}

export const useApiKeyStore = create<ApiKeyState>(set => ({
  key: null,
  status: 'loading',

  load: () => {
    // Prefer the active provider; fall back to any provider that has a key so
    // a user is never gated while a usable key sits in the vault.
    const provider = [getProvider(), ...PROVIDER_IDS].find(id =>
      keyStorage.get(id),
    );
    if (!provider) {
      set({key: null, status: 'no-key'});
      return;
    }
    useSettingsStore.getState().setProvider(provider);
    set({key: keyStorage.get(provider), status: 'ready'});
  },

  saveKey: (provider, key) => {
    const trimmed = key.trim();
    keyStorage.set(provider, trimmed);
    useSettingsStore.getState().setProvider(provider);
    set({key: trimmed, status: 'ready'});
  },

  switchProvider: provider => {
    const key = keyStorage.get(provider);
    if (!key) {
      return false;
    }
    useSettingsStore.getState().setProvider(provider);
    set({key, status: 'ready'});
    return true;
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
