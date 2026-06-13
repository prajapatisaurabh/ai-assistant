import React, {useState} from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useTheme} from '@/theme/ThemeProvider';
import {Card} from '@/components/Card';
import {Chip} from '@/components/Chip';
import {Button} from '@/components/Button';
import {ToneSelector} from '@/components/ToneSelector';
import {fonts} from '@/theme/typography';
import {api} from '@/services/api';
import {
  IMPROVE_ACTIONS,
  ImproveAction,
  Platform as ContentPlatform,
  Tone,
} from '@/types';

const PLATFORMS: {key: ContentPlatform; label: string}[] = [
  {key: 'generic', label: 'Any'},
  {key: 'x', label: 'X'},
  {key: 'linkedin', label: 'LinkedIn'},
  {key: 'whatsapp', label: 'WhatsApp'},
  {key: 'facebook', label: 'Facebook'},
  {key: 'email', label: 'Email'},
];

export const ImproveScreen: React.FC = () => {
  const t = useTheme();
  const c = t.colors;
  const [text, setText] = useState('');
  const [action, setAction] = useState<ImproveAction>('fix');
  const [platform, setPlatform] = useState<ContentPlatform>('generic');
  const [tone, setTone] = useState<Tone>('professional');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!text.trim()) {
      return;
    }
    setLoading(true);
    setError(null);
    setResult('');
    try {
      const {result: out} = await api.improve({text, action, tone, platform});
      setResult(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.flex, {backgroundColor: c.background}]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.h1, {color: c.onBackground}]}>Improve Text</Text>

        <Card>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Paste text from X, LinkedIn, WhatsApp, email…"
            placeholderTextColor={c.onSurfaceVariant}
            multiline
            style={[styles.input, {color: c.onSurface, backgroundColor: c.surfaceVariant, borderRadius: t.radius.md}]}
          />
          <Button
            label="Paste from clipboard"
            variant="text"
            onPress={async () => setText(await Clipboard.getString())}
            style={{alignSelf: 'flex-start', paddingHorizontal: 0}}
          />
        </Card>

        <Text style={[styles.label, {color: c.onSurfaceVariant}]}>Action</Text>
        <View style={styles.wrap}>
          {IMPROVE_ACTIONS.map(a => (
            <Chip
              key={a.key}
              label={a.label}
              selected={action === a.key}
              onPress={() => setAction(a.key)}
            />
          ))}
        </View>

        <Text style={[styles.label, {color: c.onSurfaceVariant}]}>Target platform</Text>
        <View style={styles.wrap}>
          {PLATFORMS.map(p => (
            <Chip
              key={p.key}
              label={p.label}
              selected={platform === p.key}
              onPress={() => setPlatform(p.key)}
            />
          ))}
        </View>

        <View style={{marginVertical: 8}}>
          <ToneSelector value={tone} onChange={setTone} />
        </View>

        <Button label="Improve" onPress={run} loading={loading} />

        {error && (
          <Text style={{color: c.error, marginTop: 12}}>{error}</Text>
        )}

        {result !== '' && (
          <Card style={{marginTop: 16}}>
            <Text style={{color: c.onSurface, fontSize: 15, lineHeight: 22}}>
              {result}
            </Text>
            <Button
              label="Copy result"
              variant="tonal"
              onPress={() => Clipboard.setString(result)}
              style={{marginTop: 12}}
            />
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  flex: {flex: 1},
  content: {padding: 16, paddingBottom: 48, gap: 8},
  h1: {fontSize: 26, fontFamily: fonts.bold, marginBottom: 8},
  input: {minHeight: 120, padding: 12, fontSize: 15, textAlignVertical: 'top', fontFamily: fonts.regular},
  label: {fontSize: 13, fontFamily: fonts.bold, marginTop: 12, marginLeft: 4},
  wrap: {flexDirection: 'row', flexWrap: 'wrap'},
});
