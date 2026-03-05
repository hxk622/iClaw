import { extractText } from './message-extract';
import type { ChatContentItem, ChatEventPayload, ChatRuntimeState } from './types';

const SILENT_REPLY_PATTERN = /^\s*NO_REPLY\s*$/;

function isSilentReplyStream(text: string): boolean {
  return SILENT_REPLY_PATTERN.test(text);
}

function normalizeContent(message: unknown): ChatContentItem[] {
  if (!message || typeof message !== 'object') {
    return [];
  }
  const m = message as Record<string, unknown>;
  if (Array.isArray(m.content)) {
    return m.content
      .map((item) => {
        if (!item || typeof item !== 'object') {
          return null;
        }
        const part = item as Record<string, unknown>;
        return {
          type: typeof part.type === 'string' ? part.type : 'text',
          text: typeof part.text === 'string' ? part.text : undefined,
          name: typeof part.name === 'string' ? part.name : undefined,
          args: part.args ?? part.arguments,
          source: part.source,
        } as ChatContentItem;
      })
      .filter((value): value is ChatContentItem => value !== null);
  }
  const text = extractText(message);
  return text ? [{ type: 'text', text }] : [];
}

function normalizeAssistantMessage(message: unknown, now: number) {
  if (!message || typeof message !== 'object') {
    return null;
  }
  const m = message as Record<string, unknown>;
  const roleRaw = typeof m.role === 'string' ? m.role : 'assistant';
  if (roleRaw.toLowerCase() !== 'assistant') {
    return null;
  }
  const content = normalizeContent(message);
  const text = content
    .map((item) => item.text)
    .filter((value): value is string => typeof value === 'string')
    .join('\n')
    .trim();
  if (!text || isSilentReplyStream(text)) {
    return null;
  }
  return {
    role: 'assistant',
    content,
    timestamp: typeof m.timestamp === 'number' ? m.timestamp : now,
  };
}

export function createInitialChatState(sessionKey: string): ChatRuntimeState {
  return {
    sessionKey,
    runId: null,
    streamText: null,
    streamStartedAt: null,
    messages: [],
    lastError: null,
  };
}

export function appendUserMessage(state: ChatRuntimeState, text: string, now = Date.now()): ChatRuntimeState {
  return {
    ...state,
    messages: [
      ...state.messages,
      {
        role: 'user',
        content: [{ type: 'text', text }],
        timestamp: now,
      },
    ],
    lastError: null,
  };
}

export function beginChatRun(state: ChatRuntimeState, runId: string, now = Date.now()): ChatRuntimeState {
  return {
    ...state,
    runId,
    streamText: '',
    streamStartedAt: now,
    lastError: null,
  };
}

export function handleChatEvent(state: ChatRuntimeState, payload: ChatEventPayload): ChatRuntimeState {
  if (!payload || payload.sessionKey !== state.sessionKey) {
    return state;
  }

  if (state.runId && payload.runId && payload.runId !== state.runId) {
    if (payload.state === 'final') {
      const foreignFinal = normalizeAssistantMessage(payload.message, Date.now());
      if (!foreignFinal) {
        return state;
      }
      return {
        ...state,
        messages: [...state.messages, foreignFinal],
      };
    }
    return state;
  }

  if (payload.state === 'delta') {
    const next = extractText(payload.message);
    if (!next || isSilentReplyStream(next)) {
      return state;
    }
    const current = state.streamText ?? '';
    if (!current || next.length >= current.length) {
      return { ...state, streamText: next };
    }
    return state;
  }

  if (payload.state === 'final') {
    const finalMessage = normalizeAssistantMessage(payload.message, Date.now());
    if (finalMessage) {
      return {
        ...state,
        messages: [...state.messages, finalMessage],
        runId: null,
        streamText: null,
        streamStartedAt: null,
      };
    }
    const streamed = (state.streamText || '').trim();
    if (!streamed || isSilentReplyStream(streamed)) {
      return {
        ...state,
        runId: null,
        streamText: null,
        streamStartedAt: null,
      };
    }
    return {
      ...state,
      messages: [
        ...state.messages,
        {
          role: 'assistant',
          content: [{ type: 'text', text: streamed }],
          timestamp: Date.now(),
        },
      ],
      runId: null,
      streamText: null,
      streamStartedAt: null,
    };
  }

  if (payload.state === 'aborted' || payload.state === 'end') {
    const streamed = (state.streamText || '').trim();
    if (!streamed || isSilentReplyStream(streamed)) {
      return {
        ...state,
        runId: null,
        streamText: null,
        streamStartedAt: null,
      };
    }
    return {
      ...state,
      messages: [
        ...state.messages,
        {
          role: 'assistant',
          content: [{ type: 'text', text: streamed }],
          timestamp: Date.now(),
        },
      ],
      runId: null,
      streamText: null,
      streamStartedAt: null,
    };
  }

  if (payload.state === 'error') {
    return {
      ...state,
      runId: null,
      streamText: null,
      streamStartedAt: null,
      lastError: payload.errorMessage ?? 'chat error',
    };
  }

  return state;
}
