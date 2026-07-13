/**
 * Prompt library.
 *
 * The app builds the final prompts on-device from the user's structured request
 * (action/tone/platform), then calls the active provider directly (BYOK). These
 * builders are provider-neutral and are consumed by services/api.ts.
 */

import {ImproveAction, Platform, Tone} from '@/types';

export const TONE_GUIDANCE: Record<Tone, string> = {
  professional:
    'Polished, businesslike, and credible. Avoid slang. Use complete sentences.',
  casual:
    'Relaxed and conversational, like talking to a friend. Contractions welcome.',
  friendly:
    'Warm, approachable, and positive. Encouraging without being pushy.',
  marketing:
    'Persuasive and energetic. Lead with a hook, emphasize benefits, include a clear call to action.',
  technical:
    'Precise and accurate. Use correct terminology. Prefer clarity over flourish.',
};

export const IMPROVE_INSTRUCTIONS: Record<ImproveAction, string> = {
  fix: 'Fix all grammar, spelling, and punctuation errors. Preserve the original meaning, voice, and length. Do not rephrase beyond what is needed to be correct.',
  clarity:
    'Rewrite the text to be clearer and easier to understand. Remove ambiguity and tighten awkward phrasing while preserving meaning.',
  professional:
    'Rewrite the text in a professional, polished tone suitable for a workplace or formal context.',
  casual:
    'Rewrite the text in a relaxed, casual, conversational tone while keeping the core message.',
  concise:
    'Make the text as concise as possible without losing essential meaning. Cut filler words and redundancy.',
  expand:
    'Expand the text with more relevant detail, context, and supporting points while keeping it coherent and on-topic.',
};

export const PLATFORM_GUIDANCE: Record<Platform, string> = {
  x: 'Optimize for X (Twitter): under 280 characters, punchy, scroll-stopping first line. 1-3 relevant hashtags max.',
  linkedin:
    'Optimize for LinkedIn: professional but human. Hook in the first line, short paragraphs, a takeaway, and a soft call to engagement. 3-5 hashtags.',
  facebook:
    'Optimize for Facebook: conversational and shareable. Encourage comments. Emojis are fine if they fit the tone.',
  instagram:
    'Optimize for Instagram caption: engaging hook, line breaks for readability, relevant emojis, and a block of 5-15 hashtags at the end.',
  whatsapp:
    'Optimize for a WhatsApp message: short, natural, and personal. No hashtags.',
  email:
    'Optimize for email: clear subject-worthy opening, well-structured body, polite sign-off. No hashtags.',
  generic: 'Write clean, well-structured prose appropriate for general use.',
};

/** System prompt used for all assistant interactions. */
export const SYSTEM_PROMPT = `You are an expert writing and social-media assistant embedded in a mobile app.
You help users fix, rewrite, summarize, and repurpose text.
Rules:
- Return ONLY the requested content. Do not add explanations, preambles, or quotes around the output unless the user asks.
- Preserve the user's intent and key facts. Never invent facts.
- Match the requested tone and platform constraints exactly.
- Keep formatting clean and ready to paste.`;

/** Builds the user-facing prompt for a text-improvement request. */
export function buildImprovePrompt(params: {
  text: string;
  action: ImproveAction;
  tone?: Tone;
  platform?: Platform;
}): string {
  const {text, action, tone, platform} = params;
  const parts = [IMPROVE_INSTRUCTIONS[action]];
  if (tone) {
    parts.push(`Tone: ${TONE_GUIDANCE[tone]}`);
  }
  if (platform && platform !== 'generic') {
    parts.push(PLATFORM_GUIDANCE[platform]);
  }
  parts.push('\nText:\n"""\n' + text + '\n"""');
  return parts.join('\n');
}

/** Builds the prompt for generating a social post for one platform. */
export function buildSocialPrompt(params: {
  content: string;
  platform: Platform;
  tone: Tone;
  variations: number;
  includeHashtags: boolean;
}): string {
  const {content, platform, tone, variations, includeHashtags} = params;
  return [
    `Generate ${variations} distinct ${platform.toUpperCase()} post variation(s) based on the source content below.`,
    PLATFORM_GUIDANCE[platform],
    `Tone: ${TONE_GUIDANCE[tone]}`,
    includeHashtags
      ? 'Include relevant hashtags where appropriate for the platform.'
      : 'Do not include hashtags.',
    `Separate each variation with a line containing only "---".`,
    '\nSource content:\n"""\n' + content + '\n"""',
  ].join('\n');
}

export function buildSummarizePrompt(params: {
  text: string;
  length: 'short' | 'medium' | 'long';
}): string {
  const lengthGuide = {
    short: 'in 1-2 sentences',
    medium: 'in a short paragraph',
    long: 'as 4-6 concise bullet points',
  }[params.length];
  return `Summarize the following content ${lengthGuide}. Capture the key points only.\n\n"""\n${params.text}\n"""`;
}

/**
 * Builds the prompt that compacts a chat transcript into a compact context
 * summary, so a new conversation can continue without the full history.
 */
export function buildCompactPrompt(transcript: string): string {
  return [
    'Summarize the following conversation into a compact briefing that lets',
    'the assistant continue the discussion in a new chat without losing',
    'important context. Capture: the main topic, key facts and decisions, any',
    'open questions, and the user’s goals or preferences. Use concise bullet',
    'points. Do not add a preamble.',
    '\nConversation:\n"""\n' + transcript + '\n"""',
  ].join('\n');
}

/** Example prompts shown in the UI / docs. */
export const EXAMPLE_PROMPTS = {
  textCorrection: [
    {
      label: 'Fix a quick message',
      input: 'hey i wnt to no if the meting is still on for tommorow at 3',
      action: 'fix' as ImproveAction,
    },
    {
      label: 'Professional rewrite',
      input: 'cant make it today, something came up, will catch up later',
      action: 'professional' as ImproveAction,
    },
  ],
  socialGeneration: [
    {
      label: 'X post from a blog',
      input:
        'We just shipped offline mode. Users can now draft posts without a connection and sync automatically when back online.',
      platform: 'x' as Platform,
    },
    {
      label: 'LinkedIn from an announcement',
      input:
        'Our team reduced API latency by 40% by moving to streaming responses and edge caching.',
      platform: 'linkedin' as Platform,
    },
  ],
};
