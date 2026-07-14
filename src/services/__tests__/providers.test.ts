import {PROVIDERS, PROVIDER_IDS, DEFAULT_PROVIDER} from '../../config';
import {api, registerProviderContext, validateKey} from '../api';

describe('provider registry', () => {
  it('gives every provider a usable config', () => {
    PROVIDER_IDS.forEach(id => {
      const p = PROVIDERS[id];
      expect(p.id).toBe(id);
      expect(p.baseUrl).toMatch(/^https:\/\//);
      expect(p.model.length).toBeGreaterThan(0);
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

describe('validateKey', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('never rejects a key on its format — only the provider decides', async () => {
    // Regression guard. An earlier build hardcoded a Gemini "AIza" prefix
    // check; Google then moved new keys to the "AQ." auth-key format, which
    // would have locked every new user out before a request was even sent.
    // A key of ANY shape must reach the network.
    const seen: string[] = [];
    global.fetch = jest.fn(async (url: string) => {
      seen.push(url);
      return {ok: true, status: 200} as Response;
    }) as unknown as typeof fetch;

    for (const key of ['AQ.Ab8_newformat', 'AIzaSyLegacy', 'sk-openai', 'x']) {
      await expect(validateKey(key, 'gemini')).resolves.toEqual({valid: true});
    }
    expect(seen).toHaveLength(4);
    expect(seen[0]).toBe(`${PROVIDERS.gemini.baseUrl}/models`);
  });

  it('reports an unauthorized key as invalid', async () => {
    global.fetch = jest.fn(async () => ({ok: false, status: 401} as Response)) as
      unknown as typeof fetch;
    const {valid, error} = await validateKey('AQ.Ab8_revoked', 'gemini');
    expect(valid).toBe(false);
    expect(error).toBe('Invalid API key.');
  });

  it('asks for a key rather than calling out with an empty one', async () => {
    global.fetch = jest.fn() as unknown as typeof fetch;
    const {valid} = await validateKey('   ', 'gemini');
    expect(valid).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('transient upstream failures', () => {
  const realFetch = global.fetch;
  beforeEach(() => registerProviderContext(() => ({provider: 'gemini', key: 'AQ.Ab8'})));
  afterEach(() => {
    global.fetch = realFetch;
  });

  const respond = (statuses: number[]) => {
    let i = 0;
    global.fetch = jest.fn(async () => {
      const status = statuses[i++];
      return status === 200
        ? ({
            ok: true,
            status,
            json: async () => ({choices: [{message: {content: 'hi'}}]}),
          } as unknown as Response)
        : ({ok: false, status, json: async () => ({})} as unknown as Response);
    }) as unknown as typeof fetch;
  };

  it('retries an overloaded provider and succeeds', async () => {
    // Gemini's free tier throws 503 routinely; the user should never see it.
    respond([503, 503, 200]);
    await expect(api.summarize({text: 'x', length: 'short'})).resolves.toEqual({
      result: 'hi',
    });
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('gives up after the attempt budget with a human message', async () => {
    respond([503, 503, 503]);
    await expect(api.summarize({text: 'x', length: 'short'})).rejects.toThrow(
      /Google Gemini is overloaded right now/,
    );
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('does not retry a bad key — retrying a 401 just wastes time', async () => {
    respond([401]);
    await expect(api.summarize({text: 'x', length: 'short'})).rejects.toThrow(
      /Invalid API key/,
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
