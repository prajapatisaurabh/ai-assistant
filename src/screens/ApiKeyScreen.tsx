import React, {useState} from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useTheme} from '@/theme/ThemeProvider';
import {Button} from '@/components/Button';
import {Chip} from '@/components/Chip';
import {fonts} from '@/theme/typography';
import {api} from '@/services/api';
import {
  ONBOARDING_PROVIDER,
  PROVIDERS,
  PROVIDER_IDS,
  ProviderId,
} from '@/config';
import {useApiKeyStore} from '@/store/apiKeyStore';

type Check = 'idle' | 'checking' | 'valid' | 'invalid';

/**
 * First-launch gate: the user picks a provider and pastes their own key. We
 * validate it with a token-free GET /models call before saving it encrypted
 * on-device. Gemini is preselected because it has a free tier — a new user can
 * get running without a funded account.
 */
export const ApiKeyScreen: React.FC = () => {
  const t = useTheme();
  const c = t.colors;
  const setKey = useApiKeyStore(s => s.setKey);
  const switchProvider = useApiKeyStore(s => s.switchProvider);

  const [provider, setProvider] = useState<ProviderId>(ONBOARDING_PROVIDER);
  const [value, setValue] = useState('');
  const [reveal, setReveal] = useState(false);
  const [check, setCheck] = useState<Check>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const p = PROVIDERS[provider];

  const reset = () => {
    setCheck('idle');
    setMessage(null);
  };

  const onChange = (text: string) => {
    setValue(text);
    reset();
  };

  const pickProvider = (id: ProviderId) => {
    setProvider(id);
    setValue('');
    reset();
  };

  const validate = async () => {
    if (!value.trim()) {
      return;
    }
    setCheck('checking');
    setMessage(null);
    const {valid, error} = await api.validateKey(value, provider);
    if (valid) {
      setCheck('valid');
      setMessage('Key is valid ✓');
    } else {
      setCheck('invalid');
      setMessage(error ?? 'Could not validate key.');
    }
  };

  const saveAndContinue = () => {
    // Only reachable once validated. Switch first so the key lands in the
    // vault entry for the provider the user actually picked.
    switchProvider(provider);
    setKey(value);
  };

  const statusColor =
    check === 'valid' ? c.success : check === 'invalid' ? c.error : c.onSurfaceVariant;

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
                onPress={() => pickProvider(id)}
              />
            ))}
          </View>

          {p.isFree ? (
            <Text style={[styles.freeNote, {color: c.success}]}>
              {p.label} has a free tier — no card required.
            </Text>
          ) : null}

          <View
            style={[
              styles.inputRow,
              {backgroundColor: c.surfaceVariant, borderRadius: t.radius.md},
            ]}>
            <TextInput
              value={value}
              onChangeText={onChange}
              placeholder={p.keyPlaceholder}
              placeholderTextColor={c.onSurfaceVariant}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={!reveal}
              style={[styles.input, {color: c.onSurface}]}
            />
            <Pressable onPress={() => setReveal(r => !r)} hitSlop={8}>
              <Text style={{color: c.primary, fontWeight: '600'}}>
                {reveal ? 'Hide' : 'Show'}
              </Text>
            </Pressable>
          </View>

          {message ? (
            <Text style={[styles.status, {color: statusColor}]}>{message}</Text>
          ) : null}

          <Button
            label={check === 'checking' ? 'Validating…' : 'Validate key'}
            variant="tonal"
            onPress={validate}
            loading={check === 'checking'}
            disabled={!value.trim()}
            style={{marginTop: 16}}
          />

          <Button
            label="Save & Continue"
            onPress={saveAndContinue}
            disabled={check !== 'valid'}
            style={{marginTop: 12}}
          />

          <Pressable
            onPress={() => Linking.openURL(p.consoleUrl)}
            style={{marginTop: 20}}>
            <Text style={{color: c.primary, textAlign: 'center'}}>
              {p.isFree ? `Get a free ${p.label} key →` : `Get an ${p.label} key →`}
            </Text>
          </Pressable>
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
  freeNote: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: fonts.medium,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    minHeight: 52,
  },
  input: {flex: 1, fontSize: 16, paddingVertical: 12, fontFamily: fonts.regular},
  status: {marginTop: 12, marginLeft: 4, fontSize: 13, fontFamily: fonts.medium},
});
