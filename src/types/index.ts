/**
 * Shared domain types for the AI Assistant app.
 */

export type Tone =
  | 'professional'
  | 'casual'
  | 'friendly'
  | 'marketing'
  | 'technical';

export const TONES: Tone[] = [
  'professional',
  'casual',
  'friendly',
  'marketing',
  'technical',
];

/** Text-improvement operations the assistant can perform. */
export type ImproveAction =
  | 'fix' // grammar + spelling
  | 'clarity' // improve clarity
  | 'professional' // rewrite professionally
  | 'casual' // rewrite casually
  | 'concise' // make concise
  | 'expand'; // expand with more detail

export const IMPROVE_ACTIONS: {key: ImproveAction; label: string}[] = [
  {key: 'fix', label: 'Fix Grammar & Spelling'},
  {key: 'clarity', label: 'Improve Clarity'},
  {key: 'professional', label: 'Rewrite Professionally'},
  {key: 'casual', label: 'Rewrite Casually'},
  {key: 'concise', label: 'Make Concise'},
  {key: 'expand', label: 'Expand with Detail'},
];

/** The platform a piece of content belongs to / is destined for. */
export type Platform =
  | 'x'
  | 'linkedin'
  | 'facebook'
  | 'instagram'
  | 'whatsapp'
  | 'email'
  | 'generic';

export const SOCIAL_PLATFORMS: {key: Platform; label: string}[] = [
  {key: 'x', label: 'X (Twitter)'},
  {key: 'linkedin', label: 'LinkedIn'},
  {key: 'facebook', label: 'Facebook'},
  {key: 'instagram', label: 'Instagram'},
];

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: number;
  /** True while a response is still streaming in. */
  streaming?: boolean;
  /** Tone used to produce an assistant message (for regeneration). */
  tone?: Tone;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  /** Carried-over summary from a compacted previous chat, injected as context. */
  context?: string;
  /** Archived chats are retained but hidden from the active view. */
  archived?: boolean;
}

/** Quick action surfaced after a clipboard copy is detected. */
export type QuickAction = 'improve' | 'summarize' | 'social';

/** Request payloads consumed by the LLM client (services/api.ts). */
export interface ImproveRequest {
  text: string;
  action: ImproveAction;
  tone?: Tone;
  platform?: Platform;
}

export interface SocialRequest {
  source: {kind: 'url'; url: string} | {kind: 'text'; text: string};
  platforms: Platform[];
  tone: Tone;
  variations: number;
  includeHashtags: boolean;
}

export interface SummarizeRequest {
  text: string;
  length: 'short' | 'medium' | 'long';
}

export interface ChatRequest {
  conversationId: string;
  messages: {role: MessageRole; content: string}[];
  tone: Tone;
  /** Summary carried over from a compacted earlier conversation. */
  context?: string;
}
