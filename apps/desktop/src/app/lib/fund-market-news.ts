import type { MarketNewsItemData } from '@iclaw/sdk';

const GENERIC_TAGS = new Set(['ETF', 'QDII', '指数', '主动管理', '宽基核心']);

export function resolveFundNewsKeywords(input: {
  companyName: string;
  trackingTarget?: string | null;
  themeKey?: string | null;
  strategyTags?: string[];
}): string[] {
  const result = new Set<string>();
  const push = (value: string | null | undefined) => {
    const normalized = (value || '').trim();
    if (normalized.length >= 2) {
      result.add(normalized);
    }
  };

  push(input.companyName);
  push(input.trackingTarget);
  push(input.themeKey);
  for (const tag of input.strategyTags || []) {
    if (!GENERIC_TAGS.has(tag)) {
      push(tag);
    }
  }
  return Array.from(result);
}

export function filterRelevantFundNews(
  items: MarketNewsItemData[],
  keywords: string[],
  limit = 5,
): MarketNewsItemData[] {
  if (keywords.length === 0) {
    return items.slice(0, limit);
  }

  const scored = items
    .map((item) => {
      const haystack = `${item.title}\n${item.summary || ''}\n${item.related_tags.join(' ')}`.toLowerCase();
      let score = 0;
      for (const keyword of keywords) {
        if (haystack.includes(keyword.toLowerCase())) {
          score += keyword.length;
        }
      }
      return { item, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  if (scored.length > 0) {
    return scored.slice(0, limit).map((entry) => entry.item);
  }
  return items.slice(0, limit);
}
