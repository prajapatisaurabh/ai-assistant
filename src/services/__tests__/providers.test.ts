import {PROVIDERS, PROVIDER_IDS, DEFAULT_PROVIDER} from '../../config';
import {validateKey} from '../api';

describe('provider registry', () => {
  it('gives every provider a usable config', () => {
    PROVIDER_IDS.forEach(id => {
      const p = PROVIDERS[id];
      expect(p.id).toBe(id);
      expect(p.baseUrl).toMatch(/^https:\/\//);
      expect(p.model.length).toBeGreaterThan(0);
      expect(p.keyPrefix.length).toBeGreaterThan(0);
      expect(p.consoleUrl).toMatch(/^https:\/\//);
    });
  });

  it('reaches Gemini through the OpenAI-compatible endpoint', () => {
    // The whole design rests on this: one client, two providers.
    expect(PROVIDERS.gemini.baseUrl).toContain('/openai');
  });

  it('defaults to openai so existing installs keep their provider', () => {
    // Existing users have a persisted settings blob with no `provider` field
    // and inherit this default. Flipping it to 'gemini' would strand them on a
    // provider they have no key for.
    expect(DEFAULT_PROVIDER).toBe('openai');
  });
});

describe('validateKey prefix pre-check', () => {
  // Rejects locally, before spending a network round-trip.
  it('rejects an OpenAI key offered to Gemini', async () => {
    const {valid, error} = await validateKey('sk-abc123', 'gemini');
    expect(valid).toBe(false);
    expect(error).toContain('AIza');
  });

  it('rejects a Gemini key offered to OpenAI', async () => {
    const {valid, error} = await validateKey('AIzaSyAbc123', 'openai');
    expect(valid).toBe(false);
    expect(error).toContain('sk-');
  });
});
