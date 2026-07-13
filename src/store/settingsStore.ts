import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import {mmkvStorage} from '@/services/storage';
import {DEFAULT_PROVIDER, ProviderId} from '@/config';
import {Tone} from '@/types';

type ThemeMode = 'system' | 'light' | 'dark';

interface SettingsState {
  themeMode: ThemeMode;
  defaultTone: Tone;
  clipboardDetectionEnabled: boolean;
  bubbleEnabled: boolean;
  /** Which LLM provider the app talks to. Its key lives in the key vault. */
  provider: ProviderId;
  setThemeMode: (mode: ThemeMode) => void;
  setDefaultTone: (tone: Tone) => void;
  setClipboardDetection: (enabled: boolean) => void;
  setBubbleEnabled: (enabled: boolean) => void;
  setProvider: (provider: ProviderId) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    set => ({
      themeMode: 'system',
      defaultTone: 'professional',
      clipboardDetectionEnabled: true,
      bubbleEnabled: false,
      provider: DEFAULT_PROVIDER,
      setThemeMode: themeMode => set({themeMode}),
      setDefaultTone: defaultTone => set({defaultTone}),
      setClipboardDetection: clipboardDetectionEnabled =>
        set({clipboardDetectionEnabled}),
      setBubbleEnabled: bubbleEnabled => set({bubbleEnabled}),
      setProvider: provider => set({provider}),
    }),
    {
      name: 'settings',
      storage: createJSONStorage(() => mmkvStorage),
    },
  ),
);

/** Lets the non-React api layer read the active provider. */
export const getProvider = (): ProviderId =>
  useSettingsStore.getState().provider;
