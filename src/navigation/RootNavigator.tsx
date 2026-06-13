import React from 'react';
import {View} from 'react-native';
import {NavigationContainer, DefaultTheme, DarkTheme} from '@react-navigation/native';
import {createBottomTabs} from './tabs';
import {ApiKeyScreen} from '@/screens/ApiKeyScreen';
import {useApiKeyStore} from '@/store/apiKeyStore';
import {useTheme} from '@/theme/ThemeProvider';

const Tabs = createBottomTabs();

export const RootNavigator: React.FC = () => {
  const t = useTheme();
  const status = useApiKeyStore(s => s.status);

  const navTheme = {
    ...(t.dark ? DarkTheme : DefaultTheme),
    colors: {
      ...(t.dark ? DarkTheme : DefaultTheme).colors,
      background: t.colors.background,
      card: t.colors.surface,
      text: t.colors.onSurface,
      primary: t.colors.primary,
      border: t.colors.outline,
    },
  };

  // While reading the stored key, render a blank background (brief).
  if (status === 'loading') {
    return <View style={{flex: 1, backgroundColor: t.colors.background}} />;
  }

  return (
    <NavigationContainer theme={navTheme}>
      {status === 'ready' ? <Tabs /> : <ApiKeyScreen />}
    </NavigationContainer>
  );
};
