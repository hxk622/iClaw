export type SearchableMemoryEntry = {
  id: string;
  title: string;
  summary: string;
  content: string;
  domain: string;
  type: string;
  importance: string;
  sourceLabel: string;
  tags: string[];
  updatedAt: string;
  recallCount: number;
  active?: boolean;
};

export type MemorySearchResult<T extends SearchableMemoryEntry = SearchableMemoryEntry> = {
  entry: T;
  score: number;
  reasons: string[];
  excerpt: string | null;
};

const SEARCH_REASON_LABELS = {
  title: '标题',
  tags: '标签',
  summary: '摘要',
  content: '内容',
  sourceLabel: '来源',
  category: '分类',
} as const;

function normalizeSearchText(value: string) {
  return value.toLocaleLowerCase('zh-CN').replace(/\s+/g, ' ').trim();
}

function compactSearchText(value: string) {
  return normalizeSearchText(value).replace(/[^\p{Letter}\p{Number}\p{Script=Han}]+/gu, '');
}

function tokenizeSearchQuery(query: string) {
  const normalized = normalizeSearchText(query);
  if (!normalized) return [];

  const terms = new Set<string>();
  const compact = compactSearchText(query);
  const words = normalized.split(/[\s/,_|.-]+/).filter(Boolean);
  const hanTerms = normalized.match(/[\p{Script=Han}]{2,}/gu) ?? [];

  if (compact.length >= 2) {
    terms.add(compact);
  }

  for (const word of words) {
    const compactWord = compactSearchText(word);
    if (compactWord.length >= 2) {
      terms.add(compactWord);
    }
  }

  for (const term of hanTerms) {
    const compactTerm = compactSearchText(term);
    if (compactTerm.length >= 2) {
      terms.add(compactTerm);
    }
  }

  return [...terms].sort((left, right) => right.length - left.length);
}

function parseTimestamp(value: string) {
  const direct = Date.parse(value.replace(/\//g, '-').replace(' ', 'T'));
  if (Number.isFinite(direct)) {
    return direct;
  }
  return 0;
}

function compareEntries(left: SearchableMemoryEntry, right: SearchableMemoryEntry) {
  const timeDelta = parseTimestamp(right.updatedAt) - parseTimestamp(left.updatedAt);
  if (timeDelta !== 0) {
    return timeDelta;
  }

  const recallDelta = (right.recallCount ?? 0) - (left.recallCount ?? 0);
  if (recallDelta !== 0) {
    return recallDelta;
  }

  return left.title.localeCompare(right.title, 'zh-CN');
}

function collectFieldScore(
  reasons: Set<string>,
  value: string,
  terms: string[],
  weight: number,
  reasonLabel: string,
  fullQueryCompact: string,
) {
  const compactValue = compactSearchText(value);
  if (!compactValue) {
    return 0;
  }

  let score = 0;
  if (fullQueryCompact && compactValue.includes(fullQueryCompact)) {
    score += weight * 4;
    reasons.add(reasonLabel);
  }

  for (const term of terms) {
    if (!term || !compactValue.includes(term)) {
      continue;
    }
    score += term === fullQueryCompact ? weight * 2 : weight;
    reasons.add(reasonLabel);
  }

  return score;
}

function findExcerpt(text: string, query: string, terms: string[]) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return null;
  }

  const lower = normalized.toLocaleLowerCase('zh-CN');
  const candidates = [query.trim(), ...terms].filter(Boolean);

  for (const candidate of candidates) {
    const needle = normalizeSearchText(candidate);
    if (!needle) {
      continue;
    }
    const index = lower.indexOf(needle);
    if (index < 0) {
      continue;
    }
    const start = Math.max(0, index - 26);
    const end = Math.min(normalized.length, index + needle.length + 54);
    const prefix = start > 0 ? '...' : '';
    const suffix = end < normalized.length ? '...' : '';
    return `${prefix}${normalized.slice(start, end)}${suffix}`;
  }

  return normalized.slice(0, 96);
}

export function sortMemoryEntriesForDisplay<T extends SearchableMemoryEntry>(entries: T[]) {
  return [...entries].sort(compareEntries);
}

export function searchMemoryEntries<T extends SearchableMemoryEntry>(entries: T[], query: string): MemorySearchResult<T>[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const fullQueryCompact = compactSearchText(trimmed);
  const terms = tokenizeSearchQuery(trimmed);
  if (!fullQueryCompact && terms.length === 0) {
    return [];
  }

  return entries
    .map((entry) => {
      const reasons = new Set<string>();
      const categoryValue = `${entry.domain} ${entry.type}`;
      let score = 0;

      score += collectFieldScore(
        reasons,
        entry.title,
        terms,
        12,
        SEARCH_REASON_LABELS.title,
        fullQueryCompact,
      );
      score += collectFieldScore(
        reasons,
        entry.tags.join(' '),
        terms,
        10,
        SEARCH_REASON_LABELS.tags,
        fullQueryCompact,
      );
      score += collectFieldScore(
        reasons,
        entry.summary,
        terms,
        7,
        SEARCH_REASON_LABELS.summary,
        fullQueryCompact,
      );
      score += collectFieldScore(
        reasons,
        entry.content,
        terms,
        5,
        SEARCH_REASON_LABELS.content,
        fullQueryCompact,
      );
      score += collectFieldScore(
        reasons,
        entry.sourceLabel,
        terms,
        4,
        SEARCH_REASON_LABELS.sourceLabel,
        fullQueryCompact,
      );
      score += collectFieldScore(
        reasons,
        categoryValue,
        terms,
        3,
        SEARCH_REASON_LABELS.category,
        fullQueryCompact,
      );

      if (score <= 0) {
        return null;
      }

      return {
        entry,
        score,
        reasons: [...reasons].slice(0, 3),
        excerpt: findExcerpt(entry.content || entry.summary || entry.title, trimmed, terms),
      } satisfies MemorySearchResult<T>;
    })
    .filter((item): item is MemorySearchResult<T> => item !== null)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return compareEntries(left.entry, right.entry);
    });
}

export function pickRelevantMemories<T extends SearchableMemoryEntry>(
  entries: T[],
  query: string,
  limit = 3,
) {
  return searchMemoryEntries(entries, query)
    .filter((item) => item.score >= 12)
    .slice(0, limit);
}

function trimPromptLine(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength)}...`;
}

export function buildMemoryContextPrompt<T extends SearchableMemoryEntry>(
  prompt: string,
  matches: Array<MemorySearchResult<T>>,
) {
  const trimmedPrompt = prompt.trim();
  if (!trimmedPrompt || matches.length === 0) {
    return trimmedPrompt;
  }

  const memoryBlock = matches
    .map(({ entry }, index) => {
      const lines = [
        `记忆 ${index + 1}：${trimPromptLine(entry.title, 36)}`,
        entry.tags.length > 0 ? `标签：${trimPromptLine(entry.tags.slice(0, 5).join('、'), 40)}` : null,
        `内容：${trimPromptLine(entry.content || entry.summary || entry.title, 180)}`,
      ].filter((line): line is string => Boolean(line));
      return lines.join('\n');
    })
    .join('\n\n');

  return [
    '下面这些历史信息可能和这次问题有关，只在确实有帮助时参考；如果不相关，请忽略。',
    memoryBlock,
    '请优先回答用户这一次的问题：',
    trimmedPrompt,
  ].join('\n\n');
}
