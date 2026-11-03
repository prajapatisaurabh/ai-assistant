import {PROVIDERS} from '../../config';
import {
  ApiError,
  api,
  classifyError,
  registerProviderContext,
  validateKey,
} from '../api';

// Real-shaped error bodies from each provider.
const OPENAI_BAD_KEY = JSON.stringify({
  error: {
    message: 'Incorrect API key provided: sk-abc. You can find your API key at …',
    type: 'invalid_request_error',
    code: 'invalid_api_key',
  },
});
const OPENAI_NO_CREDITS = JSON.stringify({
  error: {
    message:
      'You exceeded your current quota, please check your plan and billing details.',
    type: 'insufficient_quota',
    code: 'insufficient_quota',
  },
});
const OPENAI_RATE_LIMIT = JSON.stringify({
  error: {
    message: 'Rate limit reached for gpt-4o-mini on requests per min (RPM): Limit 3.',
    type: 'requests',
    code: 'rate_limit_exceeded',
  },
});
// Gemini's OpenAI-compatible endpoint wraps the error object in an array and
// reports an expired key as 400, not 401.
const GEMINI_EXPIRED_KEY = JSON.stringify([
  {
    error: {
      code: 400,
      message: 'API key expired. Please renew the API key.',
      status: 'INVALID_ARGUMENT',
      details: [
        {
          '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
          reason: 'API_KEY_INVALID',
          domain: 'googleapis.com',
        },
      ],
    },
  },
]);
const GEMINI_LEAKED_KEY = JSON.stringify({
  error: {
    code: 403,
    message: 'Your API key was reported as leaked. Please use another API key.',
    status: 'PERMISSION_DENIED',
  },
});

describe('classifyError', () => {
  const openai = PROVIDERS.openai;
  const gemini = PROVIDERS.gemini;

  it('flags a bad or revoked OpenAI key as auth', () => {
    const e = classifyError(401, OPENAI_BAD_KEY, openai);
    expect(e.kind).toBe('auth');
    expect(e.message).toMatch(/OpenAI API key is invalid, expired or revoked/);
    expect(e.message).toMatch(/Settings/);
  });

  it('flags an expired Gemini key (400 + array body) as auth', () => {
    // Regression guard: this used to surface as "Google Gemini request
    // failed (400)" because the array body wasn't parsed.
    const e = classifyError(400, GEMINI_EXPIRED_KEY, gemini);
    expect(e.kind).toBe('auth');
    expect(e.message).toMatch(/Google Gemini API key is invalid, expired/);
  });

  it('flags a leaked/blocked Gemini key (403) as auth', () => {
    expect(classifyError(403, GEMINI_LEAKED_KEY, gemini).kind).toBe('auth');
  });

  it('tells "out of credits" apart from "slow down" on a 429', () => {
    expect(classifyError(429, OPENAI_NO_CREDITS, openai).kind).toBe('quota');
    expect(classifyError(429, OPENAI_RATE_LIMIT, openai).kind).toBe(
      'rate_limit',
    );
  });

  it('classifies 5xx as overloaded and falls back to the provider text', () => {
    expect(classifyError(503, '', gemini).kind).toBe('overloaded');
    const other = classifyError(
      400,
      JSON.stringify({error: {message: 'max_tokens is too large'}}),
      openai,
    );
    expect(other.kind).toBe('other');
    expect(other.message).toBe('max_tokens is too large');
  });

  it('reads the real status from an error frame inside a 200 stream', () => {
    const frame = JSON.stringify({
      error: {code: 400, message: 'API key expired. Please renew the API key.'},
    });
    expect(classifyError(200, frame, gemini).kind).toBe('auth');
  });
});

describe('error surfacing', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  const respondOnce = (status: number, body: string) => {
    global.fetch = jest.fn(async () => ({
      ok: status < 400,
      status,
      text: async () => body,
    })) as unknown as typeof fetch;
  };

  it('rejects with an ApiError the UI can act on', async () => {
    registerProviderContext(() => ({provider: 'gemini', key: 'AQ.expired'}));
    respondOnce(400, GEMINI_EXPIRED_KEY);
    const err = await api
      .summarize({text: 'x', length: 'short'})
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).kind).toBe('auth');
  });

  it('reports an expired key clearly on the key form', async () => {
    respondOnce(400, GEMINI_EXPIRED_KEY);
    await expect(validateKey('AQ.expired', 'gemini')).resolves.toEqual({
      valid: false,
      error: 'Invalid or expired API key.',
    });
  });

  it('turns a dropped connection into a network error', async () => {
    registerProviderContext(() => ({provider: 'openai', key: 'sk-x'}));
    global.fetch = jest.fn(async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;
    const err = await api
      .summarize({text: 'x', length: 'short'})
      .catch((e: unknown) => e);
    expect((err as ApiError).kind).toBe('network');
  });
});
