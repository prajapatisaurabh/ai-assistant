import React, {useState} from 'react';
import {ScrollView, StyleSheet, Switch, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useTheme} from '@/theme/ThemeProvider';
import {Card} from '@/components/Card';
import {Chip} from '@/components/Chip';
import {Button} from '@/components/Button';
import {fonts} from '@/theme/typography';
import {OPENAI_MODEL} from '@/config';
import {api} from '@/services/api';
import {useSettingsStore} from '@/store/settingsStore';
import {useApiKeyStore, maskKey} from '@/store/apiKeyStore';
import {useBubble} from '@/hooks/useBubble';
import {Overlay} from '@/native/OverlayModule';

const Row: React.FC<{children: React.ReactNode}> = ({children}) => (
  <View style={styles.row}>{children}</View>
);

export const SettingsScreen: React.FC = () => {
  const t = useTheme();
  const c = t.colors;
  const {
    themeMode,
    setThemeMode,
    clipboardDetectionEnabled,
    setClipboardDetection,
  } = useSettingsStore();
  const {running, toggle} = useBubble();

  const apiKey = useApiKeyStore(s => s.key);
  const clearKey = useApiKeyStore(s => s.clear);
  const [recheck, setRecheck] = useState<string | null>(null);
  const [rechecking, setRechecking] = useState(false);

  const revalidate = async () => {
    if (!apiKey) {
      return;
    }
    setRechecking(true);
    setRecheck(null);
    const {valid, error} = await api.validateKey(apiKey);
    setRecheck(valid ? 'Key is valid ✓' : error ?? 'Invalid key');
    setRechecking(false);
  };

  return (
    <SafeAreaView style={[styles.flex, {backgroundColor: c.background}]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.h1, {color: c.onBackground}]}>Settings</Text>

        <Card style={{marginBottom: 12}}>
          <Text style={[styles.section, {color: c.onSurface}]}>OpenAI API key</Text>
          <Row>
            <Text style={{color: c.onSurfaceVariant}}>Key</Text>
            <Text style={{color: c.onSurface, fontWeight: '600'}}>
              {maskKey(apiKey)}
            </Text>
          </Row>
          <Row>
            <Text style={{color: c.onSurfaceVariant}}>Model</Text>
            <Text style={{color: c.onSurface, fontWeight: '600'}}>
              {OPENAI_MODEL}
            </Text>
          </Row>
          {recheck && (
            <Text
              style={{
                color: recheck.includes('✓') ? c.success : c.error,
                marginTop: 8,
                fontWeight: '600',
              }}>
              {recheck}
            </Text>
          )}
          <View style={styles.keyBtns}>
            <Button
              label={rechecking ? 'Checking…' : 'Re-validate'}
              variant="tonal"
              loading={rechecking}
              onPress={revalidate}
              style={{flex: 1}}
            />
            <Button
              label="Replace key"
              variant="outlined"
              onPress={clearKey}
              style={{flex: 1}}
            />
          </View>
        </Card>

        <Card>
          <Text style={[styles.section, {color: c.onSurface}]}>Floating bubble</Text>
          <Row>
            <Text style={{color: c.onSurface}}>Show floating assistant</Text>
            <Switch value={running} onValueChange={toggle} />
          </Row>
          <Text style={[styles.hint, {color: c.onSurfaceVariant}]}>
            Runs a battery-efficient foreground service so the bubble stays
            available over other apps.
          </Text>
        </Card>

        <Card style={{marginTop: 12}}>
          <Text style={[styles.section, {color: c.onSurface}]}>Clipboard</Text>
          <Row>
            <Text style={{color: c.onSurface}}>Detect copied text</Text>
            <Switch
              value={clipboardDetectionEnabled}
              onValueChange={v => {
                setClipboardDetection(v);
                Overlay.setClipboardWatch(v).catch(() => {});
              }}
            />
          </Row>
          <Text style={[styles.hint, {color: c.onSurfaceVariant}]}>
            Shows quick actions when you copy text. Clipboard content is never
            stored — it is used only for the action you choose.
          </Text>
        </Card>

        <Card style={{marginTop: 12}}>
          <Text style={[styles.section, {color: c.onSurface}]}>Appearance</Text>
          <View style={styles.wrap}>
            {(['system', 'light', 'dark'] as const).map(m => (
              <Chip
                key={m}
                label={m[0].toUpperCase() + m.slice(1)}
                selected={themeMode === m}
                onPress={() => setThemeMode(m)}
              />
            ))}
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  flex: {flex: 1},
  content: {padding: 16, paddingBottom: 48},
  h1: {fontSize: 26, fontFamily: fonts.bold, marginBottom: 16},
  section: {fontSize: 16, fontFamily: fonts.bold, marginBottom: 8},
  row: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6},
  hint: {fontSize: 12, marginTop: 6, lineHeight: 17},
  wrap: {flexDirection: 'row', flexWrap: 'wrap'},
  keyBtns: {flexDirection: 'row', gap: 10, marginTop: 12},
});
