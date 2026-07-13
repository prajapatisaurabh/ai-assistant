import React, {useEffect} from 'react';
import {StatusBar, View} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {ThemeProvider, useTheme} from '@/theme/ThemeProvider';
import {RootNavigator} from '@/navigation/RootNavigator';
import {useOverlayEvents} from '@/hooks/useOverlayEvents';
import {useApiKeyStore, getApiKey} from '@/store/apiKeyStore';
import {getProvider} from '@/store/settingsStore';
import {registerProviderContext} from '@/services/api';
import {applyGlobalFont} from '@/theme/typography';

// Let the LLM client read the active provider and its key from the stores.
registerProviderContext(() => ({provider: getProvider(), key: getApiKey()}));

// Apply the JetBrains Mono coding font across the whole app (once).
applyGlobalFont();

const Inner: React.FC = () => {
  const t = useTheme();
  const loadKey = useApiKeyStore(s => s.load);

  // Read the encrypted on-device key on launch (gates the app).
  useEffect(() => {
    loadKey();
  }, [loadKey]);

  // Listen for native overlay events (bubble taps, quick actions, clipboard).
  useOverlayEvents();

  return (
    <>
      <StatusBar
        barStyle={t.dark ? 'light-content' : 'dark-content'}
        backgroundColor={t.colors.background}
      />
      <RootNavigator />
    </>
  );
};

const App: React.FC = () => (
  <View style={{flex: 1}}>
    <SafeAreaProvider>
      <ThemeProvider>
        <Inner />
      </ThemeProvider>
    </SafeAreaProvider>
  </View>
);

export default App;
