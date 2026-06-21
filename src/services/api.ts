import {
  ChatRequest,
  ImproveRequest,
  MessageRole,
  SocialRequest,
  SummarizeRequest,
} from '@/types';
import {OPENAI_BASE_URL, OPENAI_MODEL} from '@/config';
import {
  SYSTEM_PROMPT,
  buildCompactPrompt,
  buildImprovePrompt,
  buildSocialPrompt,
  buildSummarizePrompt,
} from '@/prompts/prompts';

/**
 * OpenAI client — BYOK.
 *
 * The app calls api.openai.com directly with the user's own key. The key is
 * read from the apiKeyStore via a registered getter (avoids a circular import).
 * All requests are HTTPS, so they work from a real device with no backend.
 */

let keyGetter: () => string | null = () => null;
export const registerKeyGetter = (fn: () => string | null) => {
  keyGetter = fn;
};

type Msg = {role: 'system' | 'user' | 'assistant'; content: string};

function authHeaders(): Record<string, string> {
  const key = keyGetter();
  return key ? {Authorization: `Bearer ${key}`} : {};
}

/** Turns an OpenAI error response into a user-friendly Error. */
async function toError(res: Response): Promise<Error> {
  if (res.status === 401) {
    return new Error('Invalid API key. Check it in Settings.');
  }
  if (res.status === 429) {
    return new Error('Rate limit or quota exceeded on your OpenAI account.');
  }
  let detail = '';
  try {
    const body = await res.json();
    detail = body?.error?.message ?? '';
  } catch {
    // ignore
  }
  return new Error(detail || `OpenAI request failed (${res.status})`);
}

/**
 * Validates a key WITHOUT spending tokens by hitting the lightweight
 * authenticated GET /models endpoint. 200 = valid, 401 = bad key.
 */
export async function validateKey(
  key: string,
): Promise<{valid: boolean; error?: string}> {
  const trimmed = key.trim();
  if (!trimmed.startsWith('sk-')) {
    return {valid: false, error: 'Keys usually start with "sk-".'};
  }
  try {
    const res = await fetch(`${OPENAI_BASE_URL}/models`, {
      headers: {Authorization: `Bearer ${trimmed}`},
    });
    if (res.ok) {
      return {valid: true};
    }
    if (res.status === 401) {
      return {valid: false, error: 'Invalid API key.'};
    }
    return {valid: false, error: `OpenAI error (${res.status}).`};
  } catch {
    return {valid: false, error: 'Network error — check your connection.'};
  }
}

interface CompleteOpts {
  maxTokens?: number;
  temperature?: number;
}

/** Non-streaming chat completion. Returns the assistant text. */
async function complete(messages: Msg[], opts: CompleteOpts = {}): Promise<string> {
  const res = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', ...authHeaders()},
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 800,
    }),
  });
  if (!res.ok) {
    throw await toError(res);
  }
  const json = await res.json();
  return json?.choices?.[0]?.message?.content?.trim() ?? '';
}

const withSystem = (prompt: string): Msg[] => [
  {role: 'system', content: SYSTEM_PROMPT},
  {role: 'user', content: prompt},
];

// ---------------------------------------------------------------------------
// Streaming (XHR + SSE). OpenAI streams `data: {choices:[{delta:{content}}]}`.
// ---------------------------------------------------------------------------

export interface StreamHandlers {
  onChunk: (text: string) => void;
  onDone?: () => void;
  onError?: (err: Error) => void;
  signal?: AbortSignal;
}

function streamCompletion(messages: Msg[], handlers: StreamHandlers): void {
  const xhr = new XMLHttpRequest();
  xhr.open('POST', `${OPENAI_BASE_URL}/chat/completions`);
  xhr.setRequestHeader('Content-Type', 'application/json');
  const key = keyGetter();
  if (key) {
    xhr.setRequestHeader('Authorization', `Bearer ${key}`);
  }
  xhr.setRequestHeader('Accept', 'text/event-stream');

  let consumed = 0;
  let done = false;

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
      handlers.onError?.(
        new Error(
          xhr.status === 401
            ? 'Invalid API key. Check it in Settings.'
            : `Stream failed (${xhr.status}).`,
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
      model: OPENAI_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 800,
      stream: true,
    }),
  );
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
