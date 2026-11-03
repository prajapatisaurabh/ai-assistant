import React, {useState} from 'react';
import {Linking, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import {useTheme} from '@/theme/ThemeProvider';
import {Button} from '@/components/Button';
import {fonts} from '@/theme/typography';
import {api} from '@/services/api';
import {PROVIDERS, ProviderId} from '@/config';
import {useApiKeyStore} from '@/store/apiKeyStore';

type Check = 'idle' | 'checking' | 'valid' | 'invalid';

interface Props {
  provider: ProviderId;
  /** Label for the save button, e.g. "Save & Continue". */
  saveLabel?: string;
  /** Called after the key is saved and the provider made active. */
  onSaved?: () => void;
  /** When given, a Cancel button is shown (used inside Settings). */
  onCancel?: () => void;
}

/**
 * Paste → validate → save flow for one provider's key. Used by the first-launch
 * ApiKeyScreen and inline in Settings. The key is validated with a token-free
 * GET /models call and only written to the vault on Save, so backing out never
 * touches an existing key.
 *
 * Remount it (via `key={provider}`) when the provider changes so the input and
 * validation state reset.
 */
export const KeyForm: React.FC<Props> = ({
  provider,
  saveLabel = 'Save',
  onSaved,
  onCancel,
}) => {
  const t = useTheme();
  const c = t.colors;
  const saveKey = useApiKeyStore(s => s.saveKey);

  const [value, setValue] = useState('');
  const [reveal, setReveal] = useState(false);
  const [check, setCheck] = useState<Check>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const p = PROVIDERS[provider];

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
    const {valid, error} = await api.validateKey(value, provider);
    if (valid) {
      setCheck('valid');
      setMessage('Key is valid ✓');
    } else {
      setCheck('invalid');
      setMessage(error ?? 'Could not validate key.');
    }
  };

  const save = () => {
    // Only reachable once validated.
    saveKey(provider, value);
    onSaved?.();
  };

  const statusColor =
    check === 'valid' ? c.success : check === 'invalid' ? c.error : c.onSurfaceVariant;

  return (
    <View>
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

      <View style={styles.actions}>
        {onCancel ? (
          <Button
            label="Cancel"
            variant="outlined"
            onPress={onCancel}
            style={{flex: 1}}
          />
        ) : null}
        <Button
          label={saveLabel}
          onPress={save}
          disabled={check !== 'valid'}
          style={{flex: 1}}
        />
      </View>

      <Pressable
        onPress={() => Linking.openURL(p.consoleUrl)}
        style={{marginTop: 16}}>
        <Text style={{color: c.primary, textAlign: 'center'}}>
          {p.isFree ? `Get a free ${p.label} key →` : `Get an ${p.label} key →`}
        </Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
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
  actions: {flexDirection: 'row', gap: 10, marginTop: 12},
});
