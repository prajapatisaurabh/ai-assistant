import {
  ApiErrorKind,
  ChatRequest,
  ImproveRequest,
  MessageRole,
  SocialRequest,
  SummarizeRequest,
} from '@/types';
import {
  DEFAULT_PROVIDER,
  PROVIDERS,
  ProviderConfig,
  ProviderId,
} from '@/config';
import {
  SYSTEM_PROMPT,
  buildCompactPrompt,
  buildImprovePrompt,
  buildSocialPrompt,
  buildSummarizePrompt,
} from '@/prompts/prompts';

/**
 * LLM client — BYOK, multi-provider.
 *
 * The app calls the active provider directly with the user's own key. Gemini is
 * reached through its OpenAI-compatible endpoint, so one client serves both: the
 * only things that vary are the base URL, the model, and the key.
 *
 * The provider + key are read from the stores via a registered getter (avoids a
 * circular import). All requests are HTTPS, so they work from a real device with
 * no backend.
 */

export interface ProviderContext {
  provider: ProviderId;
  key: string | null;
}

let contextGetter: () => ProviderContext = () => ({
  provider: DEFAULT_PROVIDER,
  key: null,
});

export const registerProviderContext = (fn: () => ProviderContext) => {
  contextGetter = fn;
};

/** Config for the provider the app is currently pointed at. */
const active = (): ProviderConfig => PROVIDERS[contextGetter().provider];

type Msg = {role: 'system' | 'user' | 'assistant'; content: string};

function authHeaders(): Record<string, string> {
  const {key} = contextGetter();
  return key ? {Authorization: `Bearer ${key}`} : {};
}

/**
 * Upstream hiccups, not our fault and not the user's: the model is momentarily
 * overloaded. Gemini's free tier returns 503 for this routinely, so we retry
 * rather than dumping a status code on the user.
 */
const TRANSIENT_STATUS = new Set([500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;

/** Exponential backoff with jitter, so retries don't stampede in lockstep. */
const backoffMs = (attempt: number) => 600 * 2 ** attempt + Math.random() * 250;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** A provider failure with a user-facing message and an actionable kind. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly kind: ApiErrorKind,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** The parts of a provider error body we classify on. */
interface ErrorInfo {
  /** Gemini puts the HTTP status in error.code — useful for mid-stream errors. */
  httpCode?: number;
  message: string;
  code: string; // OpenAI: 'invalid_api_key', 'insufficient_quota', …
  status: string; // Gemini: 'INVALID_ARGUMENT', 'PERMISSION_DENIED', …
  reasons: string[]; // Gemini details[].reason, e.g. 'API_KEY_INVALID'
}

/**
 * Reads a provider error body. OpenAI sends `{error: {...}}`; Gemini's
 * OpenAI-compatible endpoint sometimes wraps that in an array
 * (`[{error: {...}}]`), which a plain `.error.message` lookup misses.
 */
function parseErrorBody(raw: string): ErrorInfo {
  let err: Record<string, unknown> = {};
  try {
    const json = JSON.parse(raw);
    const body = Array.isArray(json) ? json[0] : json;
    err = (body?.error ?? {}) as Record<string, unknown>;
  } catch {
    // not JSON — classify on the HTTP status alone
  }
  const details = Array.isArray(err.details) ? err.details : [];
  return {
    httpCode: typeof err.code === 'number' ? err.code : undefined,
    message: typeof err.message === 'string' ? err.message : '',
    code: typeof err.code === 'string' ? err.code : '',
    status: typeof err.status === 'string' ? err.status : '',
    reasons: details
      .map(d => (d as {reason?: unknown})?.reason)
      .filter((r): r is string => typeof r === 'string'),
  };
}

const KEY_PROBLEM = /api[ _-]?key/i;
const QUOTA_PROBLEM = /quota|billing|credit|insufficient/i;

/** Classifies a failed response into a kind the user can act on. */
export function classifyError(
  httpStatus: number,
  raw: string,
  p: ProviderConfig,
): ApiError {
  const info = parseErrorBody(raw);
  // An error frame inside a 200 stream carries its real status in the body.
  const status =
    httpStatus < 400 && info.httpCode ? info.httpCode : httpStatus;

  // A dead key is the one failure the user must fix themselves, so detect it
  // across providers: OpenAI says 401 'invalid_api_key'; Gemini reports an
  // expired/invalid key as 400 INVALID_ARGUMENT 'API_KEY_INVALID' and a
  // leaked/blocked one as 403 — neither of which is a 401.
  const isAuth =
    status === 401 ||
    info.code === 'invalid_api_key' ||
    info.reasons.some(r => r.startsWith('API_KEY_')) ||
    ((status === 400 || status === 403) && KEY_PROBLEM.test(info.message));
  if (isAuth) {
    return new ApiError(
      `Your ${p.label} API key is invalid, expired or revoked. Add a new key in Settings → AI provider.`,
      'auth',
      status,
    );
  }

  // OpenAI uses 429 for both "slow down" and "out of credits"; only the code
  // tells them apart, and they need very different advice.
  // Gemini's free tier uses the same "exceeded your current quota" text for
  // daily and per-minute limits, so the advice covers waiting too.
  if (
    info.code === 'insufficient_quota' ||
    (status === 429 &&
      info.code !== 'rate_limit_exceeded' &&
      QUOTA_PROBLEM.test(info.message))
  ) {
    return new ApiError(
      `You've hit your ${p.label} usage quota or run out of credits. Try again later, check billing on your ${p.label} account, or switch provider in Settings.`,
      'quota',
      status,
    );
  }

  if (status === 429) {
    return new ApiError(
      `Too many requests to ${p.label}. Wait a moment and try again.`,
      'rate_limit',
      status,
    );
  }
  if (TRANSIENT_STATUS.has(status)) {
    return new ApiError(
      `${p.label} is overloaded right now. Please try again in a moment.`,
      'overloaded',
      status,
    );
  }
  return new ApiError(
    info.message || `${p.label} request failed (${status})`,
    'other',
    status,
  );
}

const networkError = () =>
  new ApiError('Network error — check your connection.', 'network');

/** Body text of a response, or '' if it can't be read. */
async function bodyOf(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

/** Turns a provider error response into a user-friendly ApiError. */
async function toError(res: Response, p: ProviderConfig): Promise<ApiError> {
  return classifyError(res.status, await bodyOf(res), p);
}

/**
 * Validates a key WITHOUT spending tokens by hitting the lightweight
 * authenticated GET /models endpoint. 200 = valid, 401 = bad key.
 *
 * Takes the provider explicitly: during onboarding the user is validating a key
 * for the provider they just picked, which is not yet the active one.
 */
export async function validateKey(
  key: string,
  providerId?: ProviderId,
): Promise<{valid: boolean; error?: string}> {
  const p = providerId ? PROVIDERS[providerId] : active();
  const trimmed = key.trim();
  if (!trimmed) {
    return {valid: false, error: 'Enter a key.'};
  }
  // Deliberately NOT gated on p.keyPrefixes: providers change key formats
  // (Google's 'AIza' → 'AQ.' switch in 2026 would have locked every new user
  // out of a build that hardcoded the old prefix). The network call below is
  // the only authority on whether a key is good.
  try {
    const res = await fetch(`${p.baseUrl}/models`, {
      headers: {Authorization: `Bearer ${trimmed}`},
    });
    if (res.ok) {
      return {valid: true};
    }
    const err = classifyError(res.status, await bodyOf(res), p);
    // On the key form the user is already where the fix happens, so the auth
    // message drops the "go to Settings" pointer.
    return {
      valid: false,
      error: err.kind === 'auth' ? 'Invalid or expired API key.' : err.message,
    };
  } catch {
    return {valid: false, error: networkError().message};
  }
}

interface CompleteOpts {
  maxTokens?: number;
  temperature?: number;
}

/** Non-streaming chat completion. Returns the assistant text. */
async function complete(
  messages: Msg[],
  opts: CompleteOpts = {},
  attempt = 0,
): Promise<string> {
  const p = active();
  let res: Response;
  try {
    res = await fetch(`${p.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', ...authHeaders()},
      body: JSON.stringify({
        model: p.model,
        messages,
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.maxTokens ?? 800,
      }),
    });
  } catch {
    throw networkError();
  }
  if (!res.ok) {
    if (TRANSIENT_STATUS.has(res.status) && attempt + 1 < MAX_ATTEMPTS) {
      await sleep(backoffMs(attempt));
      return complete(messages, opts, attempt + 1);
    }
    throw await toError(res, p);
  }
  const json = await res.json();
  return json?.choices?.[0]?.message?.content?.trim() ?? '';
}

const withSystem = (prompt: string): Msg[] => [
  {role: 'system', content: SYSTEM_PROMPT},
  {role: 'user', content: prompt},
];

// ---------------------------------------------------------------------------
// Streaming (XHR + SSE). Both providers stream OpenAI-shaped frames:
// `data: {choices:[{delta:{content}}]}`. Gemini's compat layer does not always
// send the `[DONE]` sentinel, so onload also fires onDone if the stream just
// ends — see the `if (!done)` branch below.
// ---------------------------------------------------------------------------

export interface StreamHandlers {
  onChunk: (text: string) => void;
  onDone?: () => void;
  onError?: (err: Error) => void;
  signal?: AbortSignal;
}

function streamCompletion(messages: Msg[], handlers: StreamHandlers): void {
  const p = active();
  let cancelled = false;
  handlers.signal?.addEventListener('abort', () => {
    cancelled = true;
  });

  const attemptOnce = (attempt: number): void => {
    if (cancelled) {
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${p.baseUrl}/chat/completions`);
    xhr.setRequestHeader('Content-Type', 'application/json');
    const {key} = contextGetter();
    if (key) {
      xhr.setRequestHeader('Authorization', `Bearer ${key}`);
    }
    xhr.setRequestHeader('Accept', 'text/event-stream');

    let consumed = 0;
    let done = false;
    // Whether any token has reached the UI. Once it has, a retry would
    // duplicate the visible text, so we can only ever retry a stream that
    // failed before producing output — which is exactly the 503 case.
    let emitted = false;

    // Ends a 200 stream. One that produced no text at all is reported as an
    // error rather than left as a blank reply bubble.
    const finish = () => {
      done = true;
      if (emitted) {
        handlers.onDone?.();
      } else {
        handlers.onError?.(
          new ApiError(
            `${p.label} returned an empty response. Please try again.`,
            'other',
            xhr.status,
          ),
        );
      }
    };

    const flush = () => {
      if (done) {
        return;
      }
      const pending = xhr.responseText.slice(consumed);
      const lastBoundary = pending.lastIndexOf('\n\n');
      if (lastBoundary === -1) {
        return;
      }
      const ready = pending.slice(0, lastBoundary);
      consumed += lastBoundary + 2;

      for (const rawEvent of ready.split('\n\n')) {
        const line = rawEvent.trim();
        if (!line.startsWith('data:')) {
          continue;
        }
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') {
          finish();
          return;
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(payload);
        } catch {
          continue; // ignore keep-alive / partial lines
        }
        // A provider can fail mid-stream with a 200 status and an error frame;
        // skipping it would finish "successfully" with an empty reply.
        const frame = (Array.isArray(parsed) ? parsed[0] : parsed) as {
          error?: unknown;
          choices?: {delta?: {content?: string}}[];
        };
        if (frame?.error) {
          done = true;
          handlers.onError?.(classifyError(xhr.status, payload, p));
          return;
        }
        const delta = frame?.choices?.[0]?.delta?.content;
        if (delta) {
          emitted = true;
          handlers.onChunk(delta);
        }
      }
    };

    xhr.onprogress = flush;
    xhr.onload = () => {
      // An HTTP error body is JSON, not SSE — classify it instead of parsing
      // it as frames.
      if (xhr.status >= 400) {
        const retryable =
          TRANSIENT_STATUS.has(xhr.status) &&
          !emitted &&
          attempt + 1 < MAX_ATTEMPTS;
        if (retryable) {
          setTimeout(() => attemptOnce(attempt + 1), backoffMs(attempt));
          return;
        }
        handlers.onError?.(classifyError(xhr.status, xhr.responseText, p));
        return;
      }
      flush();
      if (!done) {
        finish();
      }
    };
    xhr.onerror = () => handlers.onError?.(networkError());
    handlers.signal?.addEventListener('abort', () => xhr.abort());

    xhr.send(
      JSON.stringify({
        model: p.model,
        messages,
        temperature: 0.7,
        max_tokens: 800,
        stream: true,
      }),
    );
  };

  attemptOnce(0);
}

// ---------------------------------------------------------------------------
// Article fetch for the social generator (URL → plain text).
// ---------------------------------------------------------------------------

async function fetchArticleText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {'User-Agent': 'AIAssistant/1.0'},
  });
  if (!res.ok) {
    throw new Error(`Couldn't fetch the article (${res.status}).`);
  }
  const html = await res.text();
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 8000);
}

// ---------------------------------------------------------------------------
// Public API (same shape the screens already use).
// ---------------------------------------------------------------------------

export const api = {
  validateKey,

  improve: async (req: ImproveRequest) => ({
    result: await complete(withSystem(buildImprovePrompt(req))),
  }),

  summarize: async (req: SummarizeRequest) => ({
    result: await complete(withSystem(buildSummarizePrompt(req))),
  }),

  /** Condenses a chat transcript into a carry-over context summary. */
  compact: async (messages: {role: MessageRole; content: string}[]) => {
    const transcript = messages
      .filter(m => m.content.trim())
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n');
    return complete(withSystem(buildCompactPrompt(transcript)), {
      maxTokens: 400,
      temperature: 0.3,
    });
  },

  social: async (req: SocialRequest) => {
    const content =
      req.source.kind === 'url'
        ? await fetchArticleText(req.source.url)
        : req.source.text;

    const results = await Promise.all(
      req.platforms.map(async platform => {
        const raw = await complete(
          withSystem(
            buildSocialPrompt({
              content,
              platform,
              tone: req.tone,
              variations: req.variations,
              includeHashtags: req.includeHashtags,
            }),
          ),
          {maxTokens: 1000},
        );
        const variations = raw
          .split(/\n-{3,}\n/)
          .map(s => s.trim())
          .filter(Boolean);
        return {platform, variations};
      }),
    );
    return {results};
  },

  streamChat: (req: ChatRequest, handlers: StreamHandlers) => {
    const messages: Msg[] = [
      {role: 'system', content: SYSTEM_PROMPT},
      ...(req.context
        ? [
            {
              role: 'system' as const,
              content: `Context carried over from an earlier conversation:\n${req.context}`,
            },
          ]
        : []),
      ...req.messages.map(m => ({role: m.role, content: m.content})),
    ];
    streamCompletion(messages, handlers);
  },
};
