import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import {mmkvStorage} from '@/services/storage';
import {Tone} from '@/types';

type ThemeMode = 'system' | 'light' | 'dark';

interface SettingsState {
  themeMode: ThemeMode;
  defaultTone: Tone;
  clipboardDetectionEnabled: boolean;
  bubbleEnabled: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  setDefaultTone: (tone: Tone) => void;
  setClipboardDetection: (enabled: boolean) => void;
  setBubbleEnabled: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    set => ({
      themeMode: 'system',
      defaultTone: 'professional',
      clipboardDetectionEnabled: true,
      bubbleEnabled: false,
      setThemeMode: themeMode => set({themeMode}),
      setDefaultTone: defaultTone => set({defaultTone}),
      setClipboardDetection: clipboardDetectionEnabled =>
        set({clipboardDetectionEnabled}),
      setBubbleEnabled: bubbleEnabled => set({bubbleEnabled}),
    }),
    {
      name: 'settings',
      storage: createJSONStorage(() => mmkvStorage),
    },
  ),
);
