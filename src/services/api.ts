import {
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

/** The user-facing sentence for a failed request. */
function messageForStatus(
  status: number,
  p: ProviderConfig,
  detail?: string,
): string {
  if (status === 401) {
    return 'Invalid API key. Check it in Settings.';
  }
  if (status === 429) {
    return `Rate limit or quota exceeded on your ${p.label} account.`;
  }
  if (TRANSIENT_STATUS.has(status)) {
    return `${p.label} is overloaded right now. Please try again in a moment.`;
  }
  return detail || `${p.label} request failed (${status})`;
}

/** Digs the provider's own error text out of a JSON error body, if present. */
function detailFrom(raw: string): string {
  try {
    return JSON.parse(raw)?.error?.message ?? '';
  } catch {
    return '';
  }
}

/** Turns a provider error response into a user-friendly Error. */
async function toError(res: Response, p: ProviderConfig): Promise<Error> {
  let detail = '';
  try {
    detail = (await res.json())?.error?.message ?? '';
  } catch {
    // body wasn't JSON — fall back to the status-based message
  }
  return new Error(messageForStatus(res.status, p, detail));
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
    if (res.status === 401) {
      return {valid: false, error: 'Invalid API key.'};
    }
    return {valid: false, error: `${p.label} error (${res.status}).`};
  } catch {
    return {valid: false, error: 'Network error — check your connection.'};
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
  const res = await fetch(`${p.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', ...authHeaders()},
    body: JSON.stringify({
      model: p.model,
      messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 800,
    }),
  });
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
          done = true;
          handlers.onDone?.();
          return;
        }
        try {
          const parsed = JSON.parse(payload);
          const delta = parsed?.choices?.[0]?.delta?.content;
          if (delta) {
            emitted = true;
            handlers.onChunk(delta);
          }
        } catch {
          // ignore keep-alive / partial lines
        }
      }
    };

    xhr.onprogress = flush;
    xhr.onload = () => {
      flush();
      if (xhr.status >= 400) {
        const retryable =
          TRANSIENT_STATUS.has(xhr.status) &&
          !emitted &&
          attempt + 1 < MAX_ATTEMPTS;
        if (retryable) {
          setTimeout(() => attemptOnce(attempt + 1), backoffMs(attempt));
          return;
        }
        handlers.onError?.(
          new Error(
            messageForStatus(xhr.status, p, detailFrom(xhr.responseText)),
          ),
        );
        return;
      }
      if (!done) {
        handlers.onDone?.();
      }
    };
    xhr.onerror = () => handlers.onError?.(new Error('Network error'));
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
      {role: 'system', content: `Respond using a ${req.tone} tone.`},
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
