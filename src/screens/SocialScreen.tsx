import React, {useState} from 'react';
import {
  ScrollView,
  StyleSheet,
  Switch,
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
import {Platform as ContentPlatform, SOCIAL_PLATFORMS, Tone} from '@/types';

export const SocialScreen: React.FC = () => {
  const t = useTheme();
  const c = t.colors;
  const [mode, setMode] = useState<'url' | 'text'>('text');
  const [value, setValue] = useState('');
  const [platforms, setPlatforms] = useState<ContentPlatform[]>(['x', 'linkedin']);
  const [tone, setTone] = useState<Tone>('marketing');
  const [variations, setVariations] = useState(2);
  const [hashtags, setHashtags] = useState(true);
  const [results, setResults] = useState<{platform: string; variations: string[]}[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const togglePlatform = (p: ContentPlatform) =>
    setPlatforms(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p],
    );

  const run = async () => {
    if (!value.trim() || platforms.length === 0) {
      return;
    }
    setLoading(true);
    setError(null);
    setResults([]);
    try {
      const res = await api.social({
        source: mode === 'url' ? {kind: 'url', url: value} : {kind: 'text', text: value},
        platforms,
        tone,
        variations,
        includeHashtags: hashtags,
      });
      setResults(res.results);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.flex, {backgroundColor: c.background}]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.h1, {color: c.onBackground}]}>Social Post Generator</Text>

        <View style={styles.wrap}>
          <Chip label="Article text" selected={mode === 'text'} onPress={() => setMode('text')} />
          <Chip label="Article URL" selected={mode === 'url'} onPress={() => setMode('url')} />
        </View>

        <Card style={{marginTop: 8}}>
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder={
              mode === 'url'
                ? 'https://example.com/article'
                : 'Paste article, news, or blog content…'
            }
            placeholderTextColor={c.onSurfaceVariant}
            autoCapitalize={mode === 'url' ? 'none' : 'sentences'}
            keyboardType={mode === 'url' ? 'url' : 'default'}
            multiline={mode === 'text'}
            style={[
              styles.input,
              {
                color: c.onSurface,
                backgroundColor: c.surfaceVariant,
                borderRadius: t.radius.md,
                minHeight: mode === 'text' ? 120 : 48,
              },
            ]}
          />
        </Card>

        <Text style={[styles.label, {color: c.onSurfaceVariant}]}>Platforms</Text>
        <View style={styles.wrap}>
          {SOCIAL_PLATFORMS.map(p => (
            <Chip
              key={p.key}
              label={p.label}
              selected={platforms.includes(p.key)}
              onPress={() => togglePlatform(p.key)}
            />
          ))}
        </View>

        <View style={{marginVertical: 8}}>
          <ToneSelector value={tone} onChange={setTone} />
        </View>

        <Text style={[styles.label, {color: c.onSurfaceVariant}]}>Variations</Text>
        <View style={styles.wrap}>
          {[1, 2, 3].map(n => (
            <Chip key={n} label={`${n}`} selected={variations === n} onPress={() => setVariations(n)} />
          ))}
        </View>

        <View style={[styles.switchRow]}>
          <Text style={{color: c.onSurface, fontSize: 15}}>Include hashtags</Text>
          <Switch value={hashtags} onValueChange={setHashtags} />
        </View>

        <Button label="Generate posts" onPress={run} loading={loading} />

        {error ? (
          <Text style={{color: c.error, marginTop: 12}}>{error}</Text>
        ) : null}

        {results.map(r => (
          <View key={r.platform} style={{marginTop: 16}}>
            <Text style={[styles.platformHeader, {color: c.primary}]}>
              {r.platform.toUpperCase()}
            </Text>
            {r.variations.map((v, i) => (
              <Card key={i} style={{marginTop: 8}}>
                <Text style={{color: c.onSurface, fontSize: 15, lineHeight: 22}}>{v}</Text>
                <Button
                  label="Copy"
                  variant="tonal"
                  onPress={() => Clipboard.setString(v)}
                  style={{marginTop: 12, alignSelf: 'flex-start'}}
                />
              </Card>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  flex: {flex: 1},
  content: {padding: 16, paddingBottom: 48, gap: 8},
  h1: {fontSize: 26, fontFamily: fonts.bold, marginBottom: 8},
  input: {padding: 12, fontSize: 15, textAlignVertical: 'top', fontFamily: fonts.regular},
  label: {fontSize: 13, fontFamily: fonts.bold, marginTop: 12, marginLeft: 4},
  wrap: {flexDirection: 'row', flexWrap: 'wrap'},
  switchRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 12, paddingHorizontal: 4},
  platformHeader: {fontSize: 14, fontFamily: fonts.bold, letterSpacing: 1},
});
