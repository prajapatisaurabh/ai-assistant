import React, {createContext, useContext, useMemo} from 'react';
import {useColorScheme} from 'react-native';
import {darkTheme, lightTheme, Theme} from './theme';
import {useSettingsStore} from '@/store/settingsStore';

const ThemeContext = createContext<Theme>(lightTheme);

export const ThemeProvider: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  const system = useColorScheme();
  const mode = useSettingsStore(s => s.themeMode);

  const theme = useMemo<Theme>(() => {
    const isDark = mode === 'system' ? system === 'dark' : mode === 'dark';
    return isDark ? darkTheme : lightTheme;
  }, [mode, system]);

  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = (): Theme => useContext(ThemeContext);
