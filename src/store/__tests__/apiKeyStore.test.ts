import {keyStorage} from '../../services/keyStorage';
import {useApiKeyStore} from '../apiKeyStore';
import {getProvider, useSettingsStore} from '../settingsStore';

const reset = () => {
  keyStorage.clearAll();
  useSettingsStore.getState().setProvider('openai');
  useApiKeyStore.setState({key: null, status: 'loading'});
};

describe('apiKeyStore', () => {
  beforeEach(reset);

  it('gates the app only when no provider has a key', () => {
    useApiKeyStore.getState().load();
    expect(useApiKeyStore.getState().status).toBe('no-key');
  });

  it('never locks the user out when switching to a provider with no key', () => {
    // Regression guard. Tapping an unconfigured provider in Settings used to
    // set status 'no-key', which swapped the whole app for the first-launch
    // key screen — with no way back short of pasting a new key.
    useApiKeyStore.getState().saveKey('gemini', 'AQ.gemini-key');

    expect(useApiKeyStore.getState().switchProvider('openai')).toBe(false);

    const s = useApiKeyStore.getState();
    expect(s.status).toBe('ready');
    expect(s.key).toBe('AQ.gemini-key');
    expect(getProvider()).toBe('gemini');
  });

  it('switches instantly between providers that both have keys', () => {
    useApiKeyStore.getState().saveKey('gemini', 'AQ.gemini-key');
    useApiKeyStore.getState().saveKey('openai', 'sk-openai-key');

    expect(useApiKeyStore.getState().switchProvider('gemini')).toBe(true);
    expect(useApiKeyStore.getState().key).toBe('AQ.gemini-key');
    expect(getProvider()).toBe('gemini');
  });

  it('saving a key makes that provider active and keeps the other key', () => {
    useApiKeyStore.getState().saveKey('gemini', '  AQ.gemini-key  ');
    useApiKeyStore.getState().saveKey('openai', 'sk-openai-key');

    expect(getProvider()).toBe('openai');
    expect(useApiKeyStore.getState().key).toBe('sk-openai-key');
    expect(keyStorage.get('gemini')).toBe('AQ.gemini-key'); // trimmed, kept
  });

  it('on launch, falls back to a provider that has a key', () => {
    // e.g. the persisted active provider has no key but another one does.
    keyStorage.set('gemini', 'AQ.gemini-key');
    useApiKeyStore.getState().load();

    const s = useApiKeyStore.getState();
    expect(s.status).toBe('ready');
    expect(s.key).toBe('AQ.gemini-key');
    expect(getProvider()).toBe('gemini');
  });
});
