const BILLING_RUN_ID_KEY = '__iclawBillingRunId';

export type ChatResponsePhase = 'idle' | 'awaiting-visible-assistant' | 'streaming-visible-assistant';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function readBillingRunId(message: unknown): string | null {
  if (!isRecord(message)) {
    return null;
  }
  const runId = message[BILLING_RUN_ID_KEY];
  return typeof runId === 'string' && runId.trim() ? runId.trim() : null;
}

function normalizeRoleForGrouping(role: unknown): string {
  const normalized = typeof role === 'string' ? role.trim().toLowerCase() : '';
  if (!normalized) {
    return 'other';
  }
  if (normalized === 'assistant' || normalized === 'user' || normalized === 'tool') {
    return normalized;
  }
  return 'other';
}

function normalizeMessageEnvelope(message: unknown): {
  role: string;
  timestamp: number;
  content: Array<{ type: string; text?: string | null }>;
} {
  const record = isRecord(message) ? message : {};
  const timestampValue = record.timestamp;
  const timestamp =
    typeof timestampValue === 'number' && Number.isFinite(timestampValue) ? timestampValue : Date.now();
  const contentValue = Array.isArray(record.content) ? record.content : [];
  const content = contentValue.map((item) => {
    const contentRecord = isRecord(item) ? item : {};
    return {
      type: typeof contentRecord.type === 'string' ? contentRecord.type : 'text',
      text: typeof contentRecord.text === 'string' ? contentRecord.text : null,
    };
  });

  return {
    role: normalizeRoleForGrouping(record.role),
    timestamp,
    content,
  };
}

function messageHasVisibleAssistantContent(message: unknown): boolean {
  const normalized = normalizeMessageEnvelope(message);
  return normalized.content.some((item) => {
    if (typeof item.text === 'string' && item.text.replace(/\s+/g, ' ').trim()) {
      return true;
    }
    return item.type !== 'text';
  });
}

type AssistantGroup = {
  timestamp: number;
  runId: string | null;
  messages: unknown[];
};

function collectAssistantGroups(messages: unknown[]): AssistantGroup[] {
  if (!Array.isArray(messages) || messages.length === 0) {
    return [];
  }

  const groups: AssistantGroup[] = [];
  let currentRunId: string | null = null;
  let currentGroup: AssistantGroup | null = null;

  const finalizeCurrentGroup = () => {
    if (!currentGroup) {
      return;
    }
    groups.push({
      timestamp: currentGroup.timestamp,
      runId: currentGroup.runId,
      messages: [...currentGroup.messages],
    });
    currentGroup = null;
  };

  messages.forEach((message) => {
    const normalized = normalizeMessageEnvelope(message);
    const role = normalized.role;
    const runId = readBillingRunId(message);
    const timestamp = normalized.timestamp || Date.now();

    if (role === 'user') {
      finalizeCurrentGroup();
      currentRunId = runId;
      return;
    }

    if (role !== 'assistant') {
      finalizeCurrentGroup();
      return;
    }

    if (!currentGroup) {
      currentGroup = {
        timestamp,
        runId: runId || currentRunId,
        messages: [message],
      };
      return;
    }

    currentGroup.messages.push(message);
    if (!currentGroup.runId && (runId || currentRunId)) {
      currentGroup.runId = runId || currentRunId;
    }
  });

  finalizeCurrentGroup();
  return groups;
}

export function hasVisibleAssistantResponseForRun(
  messages: unknown[],
  runId: string | null,
  startedAt: number | null | undefined,
): boolean {
  const normalizedRunId = typeof runId === 'string' && runId.trim() ? runId.trim() : null;
  const startedAtMs = typeof startedAt === 'number' && Number.isFinite(startedAt) ? startedAt : 0;

  return collectAssistantGroups(messages).some((group) => {
    const matchesRun = normalizedRunId ? group.runId === normalizedRunId : group.timestamp >= startedAtMs;
    if (!matchesRun) {
      return false;
    }
    return group.messages.some(messageHasVisibleAssistantContent);
  });
}

export function deriveChatResponsePhase(input: {
  busy: boolean;
  lastError: string | null;
  messages: unknown[];
  runId: string | null;
  startedAt: number | null | undefined;
}): ChatResponsePhase {
  if (!input.busy) {
    return 'idle';
  }
  if (input.lastError) {
    return 'idle';
  }
  return hasVisibleAssistantResponseForRun(input.messages, input.runId, input.startedAt)
    ? 'streaming-visible-assistant'
    : 'awaiting-visible-assistant';
}
