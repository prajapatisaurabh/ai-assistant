import React, {useState} from 'react';
import {ScrollView, StyleSheet, Switch, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useTheme} from '@/theme/ThemeProvider';
import {Card} from '@/components/Card';
import {Chip} from '@/components/Chip';
import {Button} from '@/components/Button';
import {KeyForm} from '@/components/KeyForm';
import {fonts} from '@/theme/typography';
import {PROVIDERS, PROVIDER_IDS, ProviderId} from '@/config';
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
  const themeMode = useSettingsStore(s => s.themeMode);
  const setThemeMode = useSettingsStore(s => s.setThemeMode);
  const clipboardDetectionEnabled = useSettingsStore(
    s => s.clipboardDetectionEnabled,
  );
  const setClipboardDetection = useSettingsStore(s => s.setClipboardDetection);
  const {running, toggle} = useBubble();

  const provider = useSettingsStore(s => s.provider);
  const apiKey = useApiKeyStore(s => s.key);
  const switchProvider = useApiKeyStore(s => s.switchProvider);
  const [recheck, setRecheck] = useState<string | null>(null);
  const [rechecking, setRechecking] = useState(false);
  // Provider whose key is being entered inline (adding one, or replacing the
  // active one). The active provider and its key stay untouched until Save.
  const [editing, setEditing] = useState<ProviderId | null>(null);

  const pickProvider = (id: ProviderId) => {
    setRecheck(null); // stale result belongs to the old provider
    if (switchProvider(id)) {
      setEditing(null);
    } else {
      setEditing(id); // no key yet — collect one here instead of gating the app
    }
  };

  const revalidate = async () => {
    if (!apiKey) {
      return;
    }
    setRechecking(true);
    setRecheck(null);
    const {valid, error} = await api.validateKey(apiKey, provider);
    setRecheck(valid ? 'Key is valid ✓' : error ?? 'Invalid key');
    setRechecking(false);
  };

  return (
    <SafeAreaView style={[styles.flex, {backgroundColor: c.background}]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.h1, {color: c.onBackground}]}>Settings</Text>

        <Card style={{marginBottom: 12}}>
          <Text style={[styles.section, {color: c.onSurface}]}>AI provider</Text>
          <View style={styles.wrap}>
            {PROVIDER_IDS.map(id => (
              <Chip
                key={id}
                label={
                  PROVIDERS[id].isFree
                    ? `${PROVIDERS[id].label} · Free`
                    : PROVIDERS[id].label
                }
                selected={(editing ?? provider) === id}
                onPress={() => pickProvider(id)}
              />
            ))}
          </View>
          {editing ? (
            <>
              <Text style={[styles.hint, {color: c.onSurfaceVariant}]}>
                {editing === provider
                  ? `Enter a new ${PROVIDERS[editing].label} key. Your current key stays in use until you save.`
                  : `Add a ${PROVIDERS[editing].label} key to switch. You'll keep using ${PROVIDERS[provider].label} until you save.`}
              </Text>
              <View style={{marginTop: 12}}>
                <KeyForm
                  key={editing}
                  provider={editing}
                  onSaved={() => setEditing(null)}
                  onCancel={() => setEditing(null)}
                />
              </View>
            </>
          ) : (
            <>
          <Text style={[styles.hint, {color: c.onSurfaceVariant}]}>
            Each provider keeps its own key, so you can switch back and forth
            without pasting again.
          </Text>
          <Row>
            <Text style={{color: c.onSurfaceVariant}}>Key</Text>
            <Text style={{color: c.onSurface, fontWeight: '600'}}>
              {maskKey(apiKey)}
            </Text>
          </Row>
          <Row>
            <Text style={{color: c.onSurfaceVariant}}>Model</Text>
            <Text style={{color: c.onSurface, fontWeight: '600'}}>
              {PROVIDERS[provider].model}
            </Text>
          </Row>
          {recheck ? (
            <Text
              style={{
                color: recheck.includes('✓') ? c.success : c.error,
                marginTop: 8,
                fontWeight: '600',
              }}>
              {recheck}
            </Text>
          ) : null}
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
              onPress={() => {
                setRecheck(null);
                setEditing(provider);
              }}
              style={{flex: 1}}
            />
          </View>
            </>
          )}
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
