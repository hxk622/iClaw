import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  Database,
  Filter,
  Globe2,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { getResolvedThemeFromDom, THEME_CHANGE_EVENT, type ResolvedTheme } from '@/app/lib/theme';
import {
  DATA_CONNECTION_CAPABILITIES,
  DATA_CONNECTION_MARKETS,
  DATA_CONNECTION_SCENARIOS,
  type DataConnectionCapability,
} from './data-connections-data';

const MARKET_TONES: Record<string, string> = {
  A股: 'bg-[rgba(220,38,38,0.12)] text-[rgb(185,28,28)] dark:bg-[rgba(248,113,113,0.14)] dark:text-[rgb(252,165,165)]',
  美股: 'bg-[rgba(37,99,235,0.12)] text-[rgb(29,78,216)] dark:bg-[rgba(96,165,250,0.14)] dark:text-[rgb(147,197,253)]',
  港股: 'bg-[rgba(13,148,136,0.12)] text-[rgb(15,118,110)] dark:bg-[rgba(45,212,191,0.14)] dark:text-[rgb(153,246,228)]',
  期货: 'bg-[rgba(234,88,12,0.12)] text-[rgb(194,65,12)] dark:bg-[rgba(251,146,60,0.14)] dark:text-[rgb(253,186,116)]',
  黄金: 'bg-[rgba(202,138,4,0.12)] text-[rgb(161,98,7)] dark:bg-[rgba(250,204,21,0.14)] dark:text-[rgb(253,224,71)]',
  加密: 'bg-[rgba(5,150,105,0.12)] text-[rgb(4,120,87)] dark:bg-[rgba(52,211,153,0.14)] dark:text-[rgb(110,231,183)]',
  宏观: 'bg-[rgba(71,85,105,0.12)] text-[rgb(51,65,85)] dark:bg-[rgba(148,163,184,0.12)] dark:text-[rgb(203,213,225)]',
  'ETF/基金':
    'bg-[rgba(79,70,229,0.12)] text-[rgb(67,56,202)] dark:bg-[rgba(129,140,248,0.14)] dark:text-[rgb(165,180,252)]',
  外汇: 'bg-[rgba(8,145,178,0.12)] text-[rgb(14,116,144)] dark:bg-[rgba(34,211,238,0.14)] dark:text-[rgb(103,232,249)]',
  贵金属:
    'bg-[rgba(161,98,7,0.12)] text-[rgb(146,64,14)] dark:bg-[rgba(251,191,36,0.14)] dark:text-[rgb(252,211,77)]',
  中国: 'bg-[rgba(220,38,38,0.12)] text-[rgb(185,28,28)] dark:bg-[rgba(248,113,113,0.14)] dark:text-[rgb(252,165,165)]',
  美国: 'bg-[rgba(37,99,235,0.12)] text-[rgb(29,78,216)] dark:bg-[rgba(96,165,250,0.14)] dark:text-[rgb(147,197,253)]',
  全球: 'bg-[rgba(147,51,234,0.12)] text-[rgb(126,34,206)] dark:bg-[rgba(192,132,252,0.14)] dark:text-[rgb(216,180,254)]',
  量化: 'bg-[rgba(124,58,237,0.12)] text-[rgb(109,40,217)] dark:bg-[rgba(167,139,250,0.14)] dark:text-[rgb(196,181,253)]',
};
const SPRING_STYLE = { transitionTimingFunction: 'var(--motion-spring)' } as const;

function filterByMarket(markets: string[], selectedMarkets: string[]) {
  if (selectedMarkets.includes('全部')) return true;
  return markets.some((market) => selectedMarkets.includes(market));
}

function matchesSearch(capability: DataConnectionCapability, searchQuery: string) {
  if (!searchQuery) return true;
  const normalized = searchQuery.trim().toLowerCase();
  return (
    capability.title.toLowerCase().includes(normalized) ||
    capability.subtitle.toLowerCase().includes(normalized) ||
    capability.markets.some((market) => market.toLowerCase().includes(normalized)) ||
    capability.capabilities.some((item) => item.toLowerCase().includes(normalized))
  );
}

function MetricCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="flex items-baseline gap-2 rounded-[14px] border border-[var(--border-default)] bg-[rgba(255,255,255,0.44)] px-3 py-2.5 dark:bg-[rgba(255,255,255,0.03)]">
      <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-muted)]">{label}</div>
      <div className="text-[20px] font-semibold tracking-[-0.05em] text-[var(--text-primary)]">{value}</div>
      <p className="text-[12px] leading-5 text-[var(--text-secondary)]">{note}</p>
    </div>
  );
}

function StatsRail({
  filteredCount,
  activeMarketCount,
}: {
  filteredCount: number;
  activeMarketCount: number;
}) {
  return (
    <div className="grid gap-2 lg:grid-cols-3">
      <MetricCard label="已覆盖" value={String(DATA_CONNECTION_CAPABILITIES.length)} note="已结构化" />
      <MetricCard label="当前筛选" value={String(filteredCount)} note={`${activeMarketCount} 个市场`} />
      <MetricCard label="场景" value={String(DATA_CONNECTION_SCENARIOS.length)} note="研究/跟踪/分析" />
    </div>
  );
}

function toggleMarketSelection(market: string, setSelectedMarkets: React.Dispatch<React.SetStateAction<string[]>>) {
  if (market === '全部') {
    setSelectedMarkets(['全部']);
    return;
  }

  setSelectedMarkets((current) => {
    const next = current.filter((item) => item !== '全部');
    if (next.includes(market)) {
      const reduced = next.filter((item) => item !== market);
      return reduced.length > 0 ? reduced : ['全部'];
    }
    return [...next, market];
  });
}

function SearchBar({
  searchQuery,
  setSearchQuery,
}: {
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
}) {
  return (
    <label className="flex items-center gap-3 rounded-[16px] border border-[var(--border-default)] bg-[rgba(255,255,255,0.58)] px-4 py-3 dark:bg-[rgba(255,255,255,0.03)]">
      <Search className="h-4.5 w-4.5 text-[var(--text-muted)]" />
      <input
        type="text"
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
        placeholder='搜索能力，例如“实时行情”或“财务报表”'
        className="w-full bg-transparent text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
      />
    </label>
  );
}

function HeaderPill({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'brand';
}) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] ${
        tone === 'brand'
          ? 'bg-[rgba(59,130,246,0.10)] text-[var(--brand-primary)]'
          : 'bg-[var(--bg-hover)] text-[var(--text-secondary)]'
      }`}
    >
      {children}
    </div>
  );
}

function HeaderSection({
  filteredCount,
  activeMarketCount,
  searchQuery,
  setSearchQuery,
}: {
  filteredCount: number;
  activeMarketCount: number;
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
}) {
  return (
    <section className="rounded-[20px] border border-[var(--border-default)] bg-[rgba(255,255,255,0.72)] p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)] dark:bg-[rgba(18,18,18,0.82)] dark:shadow-[0_14px_26px_rgba(0,0,0,0.20)]">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-hover)] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">
              <Sparkles className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
              Data Connection Matrix
            </div>
            <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-4">
              <h1 className="text-[30px] font-semibold tracking-[-0.06em] text-[var(--text-primary)]">数据连接</h1>
              <div className="flex flex-wrap gap-2">
                <HeaderPill tone="brand">
                  <Globe2 className="h-4 w-4" />
                  {DATA_CONNECTION_MARKETS.length - 1} 个市场维度
                </HeaderPill>
                <HeaderPill>
                  <ShieldCheck className="h-4 w-4 text-[var(--brand-primary)]" />
                  扁平卡片 + 弹簧反馈
                </HeaderPill>
              </div>
            </div>
          </div>
          <div className="w-full max-w-[720px] xl:flex-1">
            <StatsRail filteredCount={filteredCount} activeMarketCount={activeMarketCount} />
          </div>
        </div>
        <p className="text-[13px] leading-6 text-[var(--text-secondary)]">
          连接多市场金融数据能力，直接覆盖行情、财报、资讯、宏观与加密资产数据。页面保持 wrapper-only，不碰 OpenClaw 内部实现。
        </p>
        <SearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
      </div>
    </section>
  );
}

function FilterSection({
  theme,
  selectedMarkets,
  setSelectedMarkets,
}: {
  theme: ResolvedTheme;
  selectedMarkets: string[];
  setSelectedMarkets: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  return (
    <section className="rounded-[18px] border border-[var(--border-default)] bg-[rgba(255,255,255,0.68)] p-3 shadow-[0_8px_20px_rgba(15,23,42,0.04)] dark:bg-[rgba(18,18,18,0.76)] dark:shadow-[0_12px_24px_rgba(0,0,0,0.18)]">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-3 xl:max-w-[320px]">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[rgba(245,158,11,0.08)] text-[rgb(217,119,6)] dark:bg-[rgba(245,158,11,0.12)] dark:text-[rgb(252,211,77)]">
            <Filter className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[12px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">市场筛选</div>
            <p className="mt-0.5 text-[12px] leading-5 text-[var(--text-secondary)]">
              支持多选；选择“全部”时会清空其他筛选条件。
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {DATA_CONNECTION_MARKETS.map((market) => (
            <MarketButton
              key={market}
              label={market}
              selected={selectedMarkets.includes(market)}
              theme={theme}
              onClick={() => toggleMarketSelection(market, setSelectedMarkets)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function MarketButton({
  label,
  selected,
  theme,
  onClick,
}: {
  label: string;
  selected: boolean;
  theme: ResolvedTheme;
  onClick: () => void;
}) {
  const selectedClassName =
    theme === 'dark'
      ? 'border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.10)] text-white shadow-[0_10px_20px_rgba(0,0,0,0.20)]'
      : 'border-[rgba(15,23,42,0.08)] bg-[rgba(15,23,42,0.88)] text-white shadow-[0_10px_20px_rgba(15,23,42,0.14)]';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[12px] border px-3.5 py-2 text-[12px] font-medium transition-[transform,box-shadow,border-color,background-color,color] duration-[var(--motion-panel)] active:scale-[0.97] ${
        selected
          ? selectedClassName
          : 'border-[var(--border-default)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:-translate-y-[1px] hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
      }`}
      style={SPRING_STYLE}
    >
      {label}
    </button>
  );
}

function CapabilityCard({
  capability,
  theme,
}: {
  capability: DataConnectionCapability;
  theme: ResolvedTheme;
}) {
  return (
    <article
      className="group relative overflow-hidden rounded-[22px] border border-[var(--border-default)] bg-[rgba(255,255,255,0.66)] p-5 shadow-[0_10px_24px_rgba(15,23,42,0.05)] transition-[transform,box-shadow,border-color,background-color] duration-[var(--motion-panel)] hover:-translate-y-[2px] hover:border-[var(--border-strong)] hover:shadow-[0_18px_32px_rgba(15,23,42,0.10)] active:scale-[0.992] dark:bg-[rgba(255,255,255,0.03)] dark:shadow-[0_14px_28px_rgba(0,0,0,0.22)]"
      style={SPRING_STYLE}
    >
      <div className="absolute inset-x-5 top-0 h-px bg-[linear-gradient(90deg,rgba(255,255,255,0)_0%,rgba(201,169,97,0.38)_50%,rgba(255,255,255,0)_100%)]" />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full bg-[rgba(34,197,94,0.12)] px-3 py-1 text-[11px] font-medium text-[rgb(22,163,74)] dark:bg-[rgba(74,222,128,0.14)] dark:text-[rgb(134,239,172)]">
            <Check className="h-3.5 w-3.5" />
            {capability.status || '已支持'}
          </div>
          <h3 className="mt-3 text-[20px] font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
            {capability.title}
          </h3>
          <p className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">{capability.subtitle}</p>
        </div>
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] ${
            theme === 'dark'
              ? 'bg-[rgba(59,130,246,0.16)] text-[rgb(147,197,253)]'
              : 'bg-[rgba(59,130,246,0.10)] text-[var(--brand-primary)]'
          }`}
        >
          <Database className="h-4.5 w-4.5" />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {capability.markets.map((market) => (
          <span
            key={market}
            className={`rounded-full px-3 py-1 text-[11px] font-medium ${MARKET_TONES[market] || MARKET_TONES.宏观}`}
          >
            {market}
          </span>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {capability.capabilities.map((item) => (
          <span
            key={item}
            className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-hover)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--text-secondary)] transition-colors duration-[var(--motion-panel)] group-hover:text-[var(--text-primary)]"
            style={SPRING_STYLE}
          >
            {item}
          </span>
        ))}
      </div>
    </article>
  );
}

export function DataConnectionsView() {
  const [theme, setTheme] = useState<ResolvedTheme>(() => getResolvedThemeFromDom());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>(['全部']);

  useEffect(() => {
    const handleThemeChange = () => setTheme(getResolvedThemeFromDom());
    window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
  }, []);

  const filteredCapabilities = useMemo(
    () =>
      DATA_CONNECTION_CAPABILITIES.filter(
        (capability) =>
          matchesSearch(capability, searchQuery) && filterByMarket(capability.markets, selectedMarkets),
      ),
    [searchQuery, selectedMarkets],
  );

  const activeMarketCount = selectedMarkets.includes('全部') ? DATA_CONNECTION_MARKETS.length - 1 : selectedMarkets.length;
  const surfaceClassName =
    theme === 'dark'
      ? 'bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.12),transparent_30%),linear-gradient(180deg,#0c0c0d_0%,#121212_40%,#101010_100%)]'
      : 'bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.12),transparent_28%),linear-gradient(180deg,#f4f6fb_0%,#f7f7f3_48%,#eef1f6_100%)]';

  return (
    <div className={`flex flex-1 overflow-y-auto ${surfaceClassName}`}>
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-4 px-6 py-5 lg:px-8">
        <HeaderSection
          filteredCount={filteredCapabilities.length}
          activeMarketCount={activeMarketCount}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />
        <FilterSection
          theme={theme}
          selectedMarkets={selectedMarkets}
          setSelectedMarkets={setSelectedMarkets}
        />

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {filteredCapabilities.map((capability) => (
            <CapabilityCard key={capability.title} capability={capability} theme={theme} />
          ))}
        </section>

        {filteredCapabilities.length === 0 ? (
          <section className="rounded-[22px] border border-dashed border-[var(--border-default)] bg-[var(--bg-card)] px-6 py-10 text-center">
            <div className="text-[18px] font-medium text-[var(--text-primary)]">没有匹配的数据能力</div>
            <p className="mt-3 text-[14px] leading-7 text-[var(--text-secondary)]">
              可以尝试减少市场筛选，或者改用更宽泛的关键词。
            </p>
          </section>
        ) : null}

        <section className="rounded-[22px] border border-[var(--border-default)] bg-[rgba(255,255,255,0.70)] p-5 shadow-[0_12px_28px_rgba(15,23,42,0.04)] dark:bg-[rgba(18,18,18,0.78)] dark:shadow-[0_16px_30px_rgba(0,0,0,0.22)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[12px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">
                Usage Notes
              </div>
              <p className="mt-3 max-w-[880px] text-[14px] leading-7 text-[var(--text-secondary)]">
                这里展示的是数据能力覆盖，而不是底层供应商。页面信息用于帮助用户理解当前 wrapper
                能直接调起哪些金融数据能力。
              </p>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-2 self-start rounded-[14px] border border-[var(--border-default)] bg-[var(--bg-hover)] px-4 py-2 text-[13px] font-medium text-[var(--text-primary)] transition-[transform,box-shadow,border-color,background-color] duration-[var(--motion-panel)] hover:-translate-y-[1px] hover:border-[var(--border-strong)] hover:bg-[var(--bg-card)] hover:shadow-[0_10px_20px_rgba(15,23,42,0.08)] active:scale-[0.98]"
              style={SPRING_STYLE}
            >
              查看接入规划
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            {DATA_CONNECTION_SCENARIOS.map((scenario) => (
              <span
                key={scenario}
                className="rounded-full border border-[rgba(59,130,246,0.12)] bg-[rgba(59,130,246,0.08)] px-4 py-2 text-[13px] font-medium text-[var(--brand-primary)]"
              >
                {scenario}
              </span>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
