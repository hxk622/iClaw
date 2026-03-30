import { Coins, Crown, Globe2, Minus, Newspaper, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { SecurityStatusInline } from '@/app/components/ui/SecurityStatusInline';
import { cn } from '@/app/lib/cn';
import type { ResolvedHeaderConfig } from '@/app/lib/oem-runtime';

type IClawHeaderProps = {
  config?: ResolvedHeaderConfig | null;
  balance: number | null;
  loading?: boolean;
  authenticated: boolean;
  onCreditsClick: () => void;
  onRechargeClick: () => void;
};

type HeaderMarketQuote = {
  id: string;
  label: string;
  value: string;
  changePercent: string;
  change: number;
};

type HeaderHeadline = {
  id: string;
  title: string;
  source?: string | null;
  href?: string | null;
};

type HeaderFeedSnapshot = {
  quotes: HeaderMarketQuote[];
  headlines: HeaderHeadline[];
  live: boolean;
  updatedAt: number | null;
};

const HEADER_QUOTES_URL = ((import.meta.env.VITE_HEADER_MARKET_QUOTES_URL as string | undefined) || '').trim();
const HEADER_NEWS_URL = ((import.meta.env.VITE_HEADER_MARKET_NEWS_URL as string | undefined) || '').trim();
const HEADER_QUOTES_REFRESH_MS = 30_000;
const HEADER_NEWS_REFRESH_MS = 120_000;
const HEADLINE_ROTATE_MS = 8_000;

const FALLBACK_QUOTES: HeaderMarketQuote[] = [
  { id: 'csi300', label: '沪深300', value: '3942.18', change: 0.86, changePercent: '+0.86%' },
  { id: 'nasdaq100', label: '纳指100', value: '20214.46', change: 1.24, changePercent: '+1.24%' },
  { id: 'hstech', label: '恒生科技', value: '3487.27', change: -0.38, changePercent: '-0.38%' },
  { id: 'sp500', label: 'S&P500', value: '5847.63', change: 0.52, changePercent: '+0.52%' },
  { id: 'btc', label: 'BTC', value: '83,214', change: 2.18, changePercent: '+2.18%' },
];

const FALLBACK_HEADLINES: HeaderHeadline[] = [
  {
    id: 'fallback-1',
    title: '顶部市场区支持接入真实行情、快讯与指数数据，当前展示为默认占位信息。',
    source: '市场概览',
  },
  {
    id: 'fallback-2',
    title: '接入统一行情聚合层后，这里会自动切换为实时市场摘要。',
    source: '系统提示',
  },
];

function resolveFallbackQuotes(config?: ResolvedHeaderConfig | null): HeaderMarketQuote[] {
  return config?.fallbackQuotes?.length ? config.fallbackQuotes.map((item) => ({...item})) : FALLBACK_QUOTES;
}

function resolveFallbackHeadlines(config?: ResolvedHeaderConfig | null): HeaderHeadline[] {
  return config?.fallbackHeadlines?.length
    ? config.fallbackHeadlines.map((item) => ({...item}))
    : FALLBACK_HEADLINES;
}

function formatBalance(value: number | null, authenticated: boolean, loading: boolean): string {
  if (!authenticated || loading || value == null) {
    return '--';
  }
  return new Intl.NumberFormat('zh-CN').format(value);
}

function normalizeNumber(input: unknown): number {
  if (typeof input === 'number' && Number.isFinite(input)) {
    return input;
  }
  if (typeof input === 'string') {
    const parsed = Number(input.replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizeQuote(raw: unknown, index: number): HeaderMarketQuote | null {
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
        ? rawValue.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
        : '--';

  const change = normalizeNumber(rawChange);
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

function normalizeHeadline(raw: unknown, index: number): HeaderHeadline | null {
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

async function fetchHeaderCollection<T>(
  url: string,
  normalizer: (value: unknown, index: number) => T | null,
): Promise<T[]> {
  if (!url) {
    return [];
  }

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(`header feed http ${response.status}`);
  }

  const payload = (await response.json()) as
    | unknown[]
    | {
        data?: unknown[];
        items?: unknown[];
        quotes?: unknown[];
        headlines?: unknown[];
      };

  const items = Array.isArray(payload)
    ? payload
    : Array.isArray(payload.data)
      ? payload.data
      : Array.isArray(payload.items)
        ? payload.items
        : Array.isArray(payload.quotes)
          ? payload.quotes
          : Array.isArray(payload.headlines)
            ? payload.headlines
            : [];

  return items.map(normalizer).filter((item): item is T => item !== null);
}

function getTrendIcon(change: number) {
  if (change > 0) {
    return <TrendingUp className="h-3.5 w-3.5" />;
  }
  if (change < 0) {
    return <TrendingDown className="h-3.5 w-3.5" />;
  }
  return <Minus className="h-3.5 w-3.5" />;
}

function getChangeClassName(change: number): string {
  if (change > 0) {
    return 'text-[#15803d] dark:text-[#4ade80]';
  }
  if (change < 0) {
    return 'text-[#b91c1c] dark:text-[#f87171]';
  }
  return 'text-[var(--text-muted)]';
}

function useHeaderFeed(config?: ResolvedHeaderConfig | null): HeaderFeedSnapshot {
  const fallbackQuotes = useMemo(() => resolveFallbackQuotes(config), [config]);
  const fallbackHeadlines = useMemo(() => resolveFallbackHeadlines(config), [config]);
  const [quotes, setQuotes] = useState<HeaderMarketQuote[]>(fallbackQuotes);
  const [headlines, setHeadlines] = useState<HeaderHeadline[]>(fallbackHeadlines);
  const [quotesLive, setQuotesLive] = useState(false);
  const [newsLive, setNewsLive] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!quotesLive) {
      setQuotes(fallbackQuotes);
    }
  }, [fallbackQuotes, quotesLive]);

  useEffect(() => {
    if (!newsLive) {
      setHeadlines(fallbackHeadlines);
    }
  }, [fallbackHeadlines, newsLive]);

  useEffect(() => {
    let disposed = false;

    const loadQuotes = async () => {
      if (!HEADER_QUOTES_URL) {
        setQuotes(fallbackQuotes);
        setQuotesLive(false);
        return;
      }
      try {
        const nextQuotes = await fetchHeaderCollection(HEADER_QUOTES_URL, normalizeQuote);
        if (disposed || nextQuotes.length === 0) {
          return;
        }
        setQuotes(nextQuotes.slice(0, 6));
        setQuotesLive(true);
        setUpdatedAt(Date.now());
      } catch {
        if (!disposed) {
          setQuotes(fallbackQuotes);
          setQuotesLive(false);
        }
      }
    };

    void loadQuotes();
    const timer = window.setInterval(() => {
      void loadQuotes();
    }, HEADER_QUOTES_REFRESH_MS);

    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [fallbackQuotes]);

  useEffect(() => {
    let disposed = false;

    const loadNews = async () => {
      if (!HEADER_NEWS_URL) {
        setHeadlines(fallbackHeadlines);
        setNewsLive(false);
        return;
      }
      try {
        const nextHeadlines = await fetchHeaderCollection(HEADER_NEWS_URL, normalizeHeadline);
        if (disposed || nextHeadlines.length === 0) {
          return;
        }
        setHeadlines(nextHeadlines.slice(0, 8));
        setNewsLive(true);
        setUpdatedAt(Date.now());
      } catch {
        if (!disposed) {
          setHeadlines(fallbackHeadlines);
          setNewsLive(false);
        }
      }
    };

    void loadNews();
    const timer = window.setInterval(() => {
      void loadNews();
    }, HEADER_NEWS_REFRESH_MS);

    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [fallbackHeadlines]);

  return {
    quotes,
    headlines,
    live: quotesLive || newsLive,
    updatedAt,
  };
}

export function IClawHeader({
  config,
  balance,
  loading = false,
  authenticated,
  onCreditsClick,
  onRechargeClick,
}: IClawHeaderProps) {
  const balanceText = formatBalance(balance, authenticated, loading);
  const resolvedConfig = config || null;
  const feed = useHeaderFeed(resolvedConfig);
  const [headlineIndex, setHeadlineIndex] = useState(0);

  useEffect(() => {
    if (feed.headlines.length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      setHeadlineIndex((current) => (current + 1) % feed.headlines.length);
    }, HEADLINE_ROTATE_MS);

    return () => window.clearInterval(timer);
  }, [feed.headlines.length]);

  useEffect(() => {
    if (headlineIndex >= feed.headlines.length) {
      setHeadlineIndex(0);
    }
  }, [feed.headlines.length, headlineIndex]);

  const activeHeadline = feed.headlines[headlineIndex] ?? null;
  const updatedLabel = useMemo(() => {
    const idleLabel = resolvedConfig?.statusLabel || '市场概览';
    const liveLabel = resolvedConfig?.liveStatusLabel || '实时更新';
    if (!feed.updatedAt) {
      return feed.live ? liveLabel : idleLabel;
    }
    return `${feed.live ? liveLabel : idleLabel} · ${new Intl.DateTimeFormat('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(feed.updatedAt)}`;
  }, [feed.live, feed.updatedAt, resolvedConfig?.liveStatusLabel, resolvedConfig?.statusLabel]);

  return (
    <header className="border-b border-[var(--border-default)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--bg-card)_96%,white_4%),color-mix(in_srgb,var(--bg-page)_94%,white_6%))] backdrop-blur-sm">
      <div className="flex h-[50px] items-center justify-between gap-3.5 px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3.5">
          {resolvedConfig?.showLiveBadge !== false ? (
            <div className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--border-default)_76%,transparent)] bg-[color-mix(in_srgb,var(--bg-card)_84%,white_16%)] px-3 py-1 text-[11px] font-medium text-[var(--text-secondary)] shadow-[var(--shadow-sm)]">
              <Globe2 className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
              <span>{updatedLabel}</span>
            </div>
          ) : null}

          {resolvedConfig?.showQuotes !== false ? (
            <div className="flex min-w-0 flex-1 items-center overflow-hidden">
              <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto pr-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {feed.quotes.map((quote) => (
                  <div
                    key={quote.id}
                    className="group inline-flex shrink-0 items-center gap-2 rounded-full border border-transparent px-2.5 py-1 transition-colors duration-200 hover:border-[color-mix(in_srgb,var(--border-default)_88%,transparent)] hover:bg-[color-mix(in_srgb,var(--bg-card)_78%,white_22%)]"
                  >
                    <span className="text-[11px] font-medium text-[var(--text-muted)]">{quote.label}</span>
                    <span className="text-[13px] font-semibold tabular-nums text-[var(--text-primary)]">{quote.value}</span>
                    <span className={cn('inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums', getChangeClassName(quote.change))}>
                      {getTrendIcon(quote.change)}
                      {quote.changePercent}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {resolvedConfig?.showHeadlines !== false ? (
        <div className="hidden min-w-0 flex-[0_1_32rem] items-center justify-center lg:flex">
          <div className="flex min-w-0 items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--border-default)_78%,transparent)] bg-[color-mix(in_srgb,var(--bg-card)_86%,white_14%)] px-3 py-1 shadow-[var(--shadow-sm)]">
            <Newspaper className="h-3.5 w-3.5 shrink-0 text-[var(--brand-primary)]" />
            <div className="min-w-0 truncate text-[12px] text-[var(--text-secondary)]">
              {activeHeadline ? (
                activeHeadline.href ? (
                  <a
                    className="inline-flex min-w-0 items-center gap-0"
                    href={activeHeadline.href}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span className="truncate text-[var(--text-primary)]">{activeHeadline.title}</span>
                    {activeHeadline.source ? <span className="ml-2 text-[var(--text-muted)]">{activeHeadline.source}</span> : null}
                  </a>
                ) : (
                  <>
                    <span className="truncate text-[var(--text-primary)]">{activeHeadline.title}</span>
                    {activeHeadline.source ? <span className="ml-2 text-[var(--text-muted)]">{activeHeadline.source}</span> : null}
                  </>
                )
              ) : (
                '市场快讯入口已预留，接入统一 headlines feed 后可无缝切换为真实滚动资讯。'
              )}
            </div>
          </div>
        </div>
        ) : null}

        <div className="flex shrink-0 items-center gap-3">
          {resolvedConfig?.showSecurityBadge !== false ? (
            <SecurityStatusInline
              state="protecting"
              label={resolvedConfig?.securityLabel || '安全防护中'}
              className="hidden shrink-0 sm:inline-flex"
            />
          ) : null}

          {resolvedConfig?.showCredits !== false ? (
            <button
              type="button"
              className="group inline-flex h-8.5 cursor-pointer items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--border-default)_82%,transparent)] bg-[color-mix(in_srgb,var(--bg-card)_88%,white_12%)] px-3 shadow-[var(--shadow-sm)] transition-colors duration-200 hover:bg-[color-mix(in_srgb,var(--bg-hover)_94%,white_6%)]"
              onClick={onCreditsClick}
            >
              <span className="inline-flex h-5.5 w-5.5 items-center justify-center rounded-full bg-[rgba(245,158,11,0.14)] text-[#b45309]">
                <Coins className="h-3.5 w-3.5" />
              </span>
              <span className="text-[12px] font-semibold tabular-nums text-[var(--text-primary)]">{balanceText}</span>
            </button>
          ) : null}

          {resolvedConfig?.showRechargeButton !== false ? (
            <button
              type="button"
              className="group inline-flex h-8.5 cursor-pointer items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--border-default)_82%,transparent)] bg-[color-mix(in_srgb,var(--bg-card)_88%,white_12%)] px-3 shadow-[var(--shadow-sm)] transition-colors duration-200 hover:bg-[color-mix(in_srgb,var(--bg-hover)_94%,white_6%)]"
              onClick={onRechargeClick}
            >
              <span className="inline-flex h-5.5 w-5.5 items-center justify-center rounded-full bg-[rgba(168,140,93,0.14)] text-[var(--brand-primary)]">
                <Crown className="h-3.5 w-3.5" />
              </span>
              <span className="hidden text-[12px] font-semibold text-[var(--text-primary)] sm:inline">
                {resolvedConfig?.rechargeLabel || '充值中心'}
              </span>
            </button>
          ) : null}

          {resolvedConfig?.showModeBadge !== false ? (
            <div className="hidden items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--chip-brand-bg)_64%,var(--bg-card))] px-2.5 py-[3px] text-[11px] font-medium text-[var(--chip-brand-text)] xl:inline-flex">
              <Sparkles className="h-3.5 w-3.5" />
              {resolvedConfig?.modeBadgeLabel || '脉搏模式'}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
