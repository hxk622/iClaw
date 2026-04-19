export type HeaderMarketQuote = {
  id: string;
  label: string;
  value: string;
  changePercent: string;
  change: number;
};

export type HeaderHeadline = {
  id: string;
  title: string;
  source?: string | null;
  href?: string | null;
};

export function normalizeHeaderNumber(input: unknown): number {
  if (typeof input === 'number' && Number.isFinite(input)) {
    return input;
  }
  if (typeof input === 'string') {
    const parsed = Number(input.replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function normalizeHeaderQuote(raw: unknown, index: number): HeaderMarketQuote | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const source = raw as Record<string, unknown>;
  const id = typeof source.id === 'string' && source.id.trim() ? source.id.trim() : `quote-${index}`;
  const label =
    typeof source.label === 'string' && source.label.trim()
      ? source.label.trim()
      : typeof source.name === 'string' && source.name.trim()
        ? source.name.trim()
        : null;
  if (!label) {
    return null;
  }

  const rawValue = source.value ?? source.price ?? source.last ?? source.latest;
  const rawChangePercent = source.changePercent ?? source.percent ?? source.change_rate ?? source.change_pct;
  const rawChange = source.change ?? source.delta ?? source.change_value ?? rawChangePercent;

  const value =
    typeof rawValue === 'string' && rawValue.trim()
      ? rawValue.trim()
      : typeof rawValue === 'number'
        ? rawValue.toLocaleString('zh-CN', {maximumFractionDigits: 2})
        : '--';

  const change = normalizeHeaderNumber(rawChange);
  let changePercent = '0.00%';
  if (typeof rawChangePercent === 'string' && rawChangePercent.trim()) {
    const trimmed = rawChangePercent.trim();
    changePercent = /%$/.test(trimmed) ? trimmed : `${trimmed}%`;
  } else if (typeof rawChangePercent === 'number' && Number.isFinite(rawChangePercent)) {
    const prefix = rawChangePercent > 0 ? '+' : '';
    changePercent = `${prefix}${rawChangePercent.toFixed(2)}%`;
  } else {
    const prefix = change > 0 ? '+' : '';
    changePercent = `${prefix}${change.toFixed(2)}%`;
  }

  return {
    id,
    label,
    value,
    change,
    changePercent,
  };
}

export function normalizeHeaderHeadline(raw: unknown, index: number): HeaderHeadline | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const source = raw as Record<string, unknown>;
  const title =
    typeof source.title === 'string' && source.title.trim()
      ? source.title.trim()
      : typeof source.text === 'string' && source.text.trim()
        ? source.text.trim()
        : typeof source.headline === 'string' && source.headline.trim()
          ? source.headline.trim()
          : null;

  if (!title) {
    return null;
  }

  const id = typeof source.id === 'string' && source.id.trim() ? source.id.trim() : `headline-${index}`;
  const newsSource =
    typeof source.source === 'string' && source.source.trim()
      ? source.source.trim()
      : typeof source.provider === 'string' && source.provider.trim()
        ? source.provider.trim()
        : null;
  const href = typeof source.href === 'string' && source.href.trim() ? source.href.trim() : null;

  return {
    id,
    title,
    source: newsSource,
    href,
  };
}

export function trimUrl(value: string | null | undefined): string {
  return (value || '').trim().replace(/\/+$/, '');
}

export function buildDefaultHeaderOverviewUrl(authBaseUrl: string | null | undefined): string {
  const normalizedBaseUrl = trimUrl(authBaseUrl);
  if (!normalizedBaseUrl) {
    return '';
  }
  return `${normalizedBaseUrl}/market/overview?market_scope=cn&index_limit=6&headline_limit=8`;
}

export function normalizeHeaderOverviewPayload(payload: unknown): {
  quotes: HeaderMarketQuote[];
  headlines: HeaderHeadline[];
  updatedAt: number | null;
} | null {
  const data =
    payload && typeof payload === 'object' && 'data' in (payload as Record<string, unknown>) && payload.data && typeof payload.data === 'object'
      ? (payload.data as Record<string, unknown>)
      : payload && typeof payload === 'object'
        ? (payload as Record<string, unknown>)
        : null;

  if (!data) {
    return null;
  }

  const rawQuotes = Array.isArray(data.indices) ? data.indices : [];
  const rawHeadlines = Array.isArray(data.headlines) ? data.headlines : [];
  const quotes = rawQuotes
    .map((raw, index) =>
      normalizeHeaderQuote(
        raw && typeof raw === 'object'
          ? {
              id: (raw as Record<string, unknown>).index_key,
              label: (raw as Record<string, unknown>).index_name,
              value: (raw as Record<string, unknown>).value,
              changePercent: (raw as Record<string, unknown>).change_percent,
              change: (raw as Record<string, unknown>).change_amount,
            }
          : raw,
        index,
      ),
    )
    .filter((item): item is HeaderMarketQuote => item !== null);
  const headlines = rawHeadlines.map(normalizeHeaderHeadline).filter((item): item is HeaderHeadline => item !== null);

  const snapshotAt =
    typeof data.snapshot_at === 'string' && data.snapshot_at.trim() ? Date.parse(data.snapshot_at) : Number.NaN;

  return {
    quotes,
    headlines,
    updatedAt: Number.isFinite(snapshotAt) ? snapshotAt : null,
  };
}
