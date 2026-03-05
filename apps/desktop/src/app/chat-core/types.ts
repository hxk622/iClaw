export type ChatRole = 'user' | 'assistant' | 'system' | 'tool' | string;

export type ChatContentItem = {
  type: string;
  text?: string;
  name?: string;
  args?: unknown;
  source?: unknown;
};

export type ChatMessage = {
  id?: string;
  role: ChatRole;
  content: ChatContentItem[];
  timestamp: number;
};

export type ChatEventState = 'start' | 'delta' | 'final' | 'aborted' | 'end' | 'error';

export type ChatEventPayload = {
  runId: string;
  sessionKey: string;
  state: ChatEventState;
  message?: unknown;
  errorMessage?: string;
};

export type ChatRuntimeState = {
  sessionKey: string;
  runId: string | null;
  streamText: string | null;
  streamStartedAt: number | null;
  messages: ChatMessage[];
  lastError: string | null;
};
