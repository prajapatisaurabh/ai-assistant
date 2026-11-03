import React, {useState} from 'react';
import {KeyboardAvoidingView, Platform, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useTheme} from '@/theme/ThemeProvider';
import {Chip} from '@/components/Chip';
import {KeyForm} from '@/components/KeyForm';
import {fonts} from '@/theme/typography';
import {
  ONBOARDING_PROVIDER,
  PROVIDERS,
  PROVIDER_IDS,
  ProviderId,
} from '@/config';

/**
 * First-launch gate, shown only while NO provider has a key: the user picks a
 * provider and pastes their own key. We validate it with a token-free
 * GET /models call before saving it encrypted on-device. Gemini is preselected
 * because it has a free tier — a new user can get running without a funded
 * account. Later key changes happen in Settings, never back here.
 */
export const ApiKeyScreen: React.FC = () => {
  const t = useTheme();
  const c = t.colors;
  const [provider, setProvider] = useState<ProviderId>(ONBOARDING_PROVIDER);
  const p = PROVIDERS[provider];

  return (
    <SafeAreaView style={[styles.flex, {backgroundColor: c.background}]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.content}>
          <Text style={[styles.brand, {color: c.primary}]}>AI Assistant</Text>
          <Text style={[styles.subtitle, {color: c.onSurfaceVariant}]}>
            Choose a provider and enter your own API key. It's stored encrypted
            on this device only and used to talk to {p.label} directly.
          </Text>

          <View style={styles.providers}>
            {PROVIDER_IDS.map(id => (
              <Chip
                key={id}
                label={
                  PROVIDERS[id].isFree
                    ? `${PROVIDERS[id].label} · Free`
                    : PROVIDERS[id].label
                }
                selected={provider === id}
                onPress={() => setProvider(id)}
              />
            ))}
          </View>

          <KeyForm key={provider} provider={provider} saveLabel="Save & Continue" />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  flex: {flex: 1},
  content: {flex: 1, justifyContent: 'center', padding: 24},
  brand: {fontSize: 32, fontFamily: fonts.bold, textAlign: 'center'},
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
    lineHeight: 20,
    fontFamily: fonts.regular,
  },
  providers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
});
