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
import {fonts} from '@/theme/typography';
import {api} from '@/services/api';
import {useApiKeyStore} from '@/store/apiKeyStore';

type Check = 'idle' | 'checking' | 'valid' | 'invalid';

/**
 * First-launch gate: the user pastes their own OpenAI key. We validate it with
 * a token-free GET /models call before saving it encrypted on-device.
 */
export const ApiKeyScreen: React.FC = () => {
  const t = useTheme();
  const c = t.colors;
  const setKey = useApiKeyStore(s => s.setKey);

  const [value, setValue] = useState('');
  const [reveal, setReveal] = useState(false);
  const [check, setCheck] = useState<Check>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const onChange = (text: string) => {
    setValue(text);
    setCheck('idle');
    setMessage(null);
  };

  const validate = async () => {
    if (!value.trim()) {
      return;
    }
    setCheck('checking');
    setMessage(null);
    const {valid, error} = await api.validateKey(value);
    if (valid) {
      setCheck('valid');
      setMessage('Key is valid ✓');
    } else {
      setCheck('invalid');
      setMessage(error ?? 'Could not validate key.');
    }
  };

  const saveAndContinue = () => {
    // Only reachable once validated.
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
            Enter your own OpenAI API key to get started. It's stored encrypted
            on this device only and used to talk to OpenAI directly.
          </Text>

          <View
            style={[
              styles.inputRow,
              {backgroundColor: c.surfaceVariant, borderRadius: t.radius.md},
            ]}>
            <TextInput
              value={value}
              onChangeText={onChange}
              placeholder="sk-..."
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
            onPress={() =>
              Linking.openURL('https://platform.openai.com/api-keys')
            }
            style={{marginTop: 20}}>
            <Text style={{color: c.primary, textAlign: 'center'}}>
              Get an API key from platform.openai.com →
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
    marginBottom: 28,
    lineHeight: 20,
    fontFamily: fonts.regular,
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
