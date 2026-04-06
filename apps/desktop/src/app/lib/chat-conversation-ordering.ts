export type ConversationOrderingRecord = {
  title: string | null;
  summary: string | null;
  activeSessionKey: string;
  sessionKeys: string[];
  updatedAt: string;
};

export function dedupeConversationSessionKeys(sessionKeys: string[], activeSessionKey: string): string[] {
  return Array.from(new Set([activeSessionKey, ...sessionKeys].filter(Boolean)));
}

export function areOrderedSessionKeysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function applyEnsureConversationUpdate<T extends ConversationOrderingRecord>(
  record: T,
  input: {
    sessionKey: string;
    title: string | null;
    summary: string | null;
    nowIso: string;
  },
): {
  changed: boolean;
  activityChanged: boolean;
  record: T;
} {
  const nextTitle = record.title || input.title;
  const nextSummary = input.summary || record.summary;
  const nextSessionKeys = dedupeConversationSessionKeys(record.sessionKeys, input.sessionKey);
  const activityChanged = nextTitle !== record.title || nextSummary !== record.summary;
  const structuralChanged =
    record.activeSessionKey !== input.sessionKey ||
    !areOrderedSessionKeysEqual(nextSessionKeys, record.sessionKeys);

  if (!activityChanged && !structuralChanged) {
    return {
      changed: false,
      activityChanged: false,
      record,
    };
  }

  return {
    changed: true,
    activityChanged,
    record: {
      ...record,
      title: nextTitle,
      summary: nextSummary,
      activeSessionKey: input.sessionKey,
      sessionKeys: nextSessionKeys,
      updatedAt: activityChanged ? input.nowIso : record.updatedAt,
    },
  };
}

export function applyConversationMetadataSyncUpdate<T extends ConversationOrderingRecord>(
  record: T,
  input: {
    sessionKey: string;
    title: string | null;
    summary: string | null;
    nowIso: string;
  },
): {
  changed: boolean;
  activityChanged: boolean;
  record: T;
} {
  const nextTitle = record.title || input.title;
  const nextSummary = input.summary || record.summary;
  const nextSessionKeys = dedupeConversationSessionKeys(record.sessionKeys, input.sessionKey);
  const activityChanged = nextTitle !== record.title || nextSummary !== record.summary;
  const structuralChanged =
    record.activeSessionKey !== input.sessionKey ||
    !areOrderedSessionKeysEqual(nextSessionKeys, record.sessionKeys);

  if (!activityChanged && !structuralChanged) {
    return {
      changed: false,
      activityChanged: false,
      record,
    };
  }

  return {
    changed: true,
    activityChanged,
    record: {
      ...record,
      title: nextTitle,
      summary: nextSummary,
      activeSessionKey: input.sessionKey,
      sessionKeys: nextSessionKeys,
      updatedAt: activityChanged ? input.nowIso : record.updatedAt,
    },
  };
}
