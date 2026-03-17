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
    <div className="rounded-[24px] border border-[var(--border-default)] bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(247,247,244,0.88))] p-5 shadow-[0_18px_36px_rgba(15,23,42,0.06)] dark:bg-[linear-gradient(180deg,rgba(32,32,32,0.94),rgba(18,18,18,0.92))] dark:shadow-[0_20px_42px_rgba(0,0,0,0.28)]">
      <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)]">{label}</div>
      <div className="mt-3 text-[30px] font-semibold tracking-[-0.05em] text-[var(--text-primary)]">{value}</div>
      <p className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">{note}</p>
    </div>
  );
}

function MarketButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[14px] border px-4 py-2 text-[13px] font-medium transition ${
        selected
          ? 'border-transparent bg-[var(--text-primary)] text-[var(--bg-page)] shadow-[0_10px_20px_rgba(15,23,42,0.14)] dark:bg-white dark:text-[#101010]'
          : 'border-[var(--border-default)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
      }`}
    >
      {label}
    </button>
  );
}

function CapabilityCard({ capability }: { capability: DataConnectionCapability }) {
  return (
    <article className="group relative overflow-hidden rounded-[28px] border border-[var(--border-default)] bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(246,247,244,0.92))] p-6 shadow-[0_20px_42px_rgba(15,23,42,0.08)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_24px_50px_rgba(15,23,42,0.12)] dark:bg-[linear-gradient(180deg,rgba(30,30,30,0.96),rgba(17,17,17,0.94))] dark:shadow-[0_24px_50px_rgba(0,0,0,0.34)]">
      <div className="absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,rgba(255,255,255,0)_0%,rgba(201,169,97,0.55)_50%,rgba(255,255,255,0)_100%)]" />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full bg-[rgba(34,197,94,0.12)] px-3 py-1 text-[11px] font-medium text-[rgb(22,163,74)] dark:bg-[rgba(74,222,128,0.14)] dark:text-[rgb(134,239,172)]">
            <Check className="h-3.5 w-3.5" />
            {capability.status || '已支持'}
          </div>
          <h3 className="mt-4 text-[22px] font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
            {capability.title}
          </h3>
          <p className="mt-3 text-[14px] leading-7 text-[var(--text-secondary)]">{capability.subtitle}</p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-[rgba(59,130,246,0.10)] text-[var(--brand-primary)]">
          <Database className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {capability.markets.map((market) => (
          <span
            key={market}
            className={`rounded-full px-3 py-1 text-[11px] font-medium ${MARKET_TONES[market] || MARKET_TONES.宏观}`}
          >
            {market}
          </span>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        {capability.capabilities.map((item) => (
          <span
            key={item}
            className="rounded-[12px] border border-[var(--border-default)] bg-[var(--bg-hover)] px-3 py-2 text-[12px] font-medium text-[var(--text-secondary)] transition group-hover:text-[var(--text-primary)]"
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
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-8 px-8 py-8 lg:px-10">
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-[32px] border border-[var(--border-default)] bg-[linear-gradient(180deg,rgba(255,255,255,0.90),rgba(247,247,244,0.84))] p-7 shadow-[0_24px_60px_rgba(15,23,42,0.08)] dark:bg-[linear-gradient(180deg,rgba(29,29,29,0.94),rgba(16,16,16,0.92))] dark:shadow-[0_26px_62px_rgba(0,0,0,0.34)]">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-hover)] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">
              <Sparkles className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
              Data Connection Matrix
            </div>
            <h1 className="mt-5 text-[36px] font-semibold tracking-[-0.06em] text-[var(--text-primary)]">数据连接</h1>
            <p className="mt-4 max-w-[760px] text-[16px] leading-8 text-[var(--text-secondary)]">
              连接多市场金融数据能力，直接覆盖行情、财报、资讯、宏观与加密资产数据。这个页面承接左侧菜单入口，作为 wrapper
              层的数据能力总览。
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-[rgba(59,130,246,0.10)] px-4 py-2 text-[13px] text-[var(--brand-primary)]">
                <Globe2 className="h-4 w-4" />
                {DATA_CONNECTION_MARKETS.length - 1} 个市场维度
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[var(--bg-hover)] px-4 py-2 text-[13px] text-[var(--text-secondary)]">
                <ShieldCheck className="h-4 w-4 text-[var(--brand-primary)]" />
                Wrapper-only 集成
              </div>
            </div>
            <div className="mt-8 rounded-[24px] border border-[var(--border-default)] bg-[rgba(255,255,255,0.62)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] dark:bg-[rgba(255,255,255,0.03)]">
              <label className="flex items-center gap-3 rounded-[18px] px-3 py-2">
                <Search className="h-5 w-5 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder='搜索能力，例如“实时行情”或“财务报表”'
                  className="w-full bg-transparent text-[14px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
                />
              </label>
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-3 xl:grid-cols-1">
            <MetricCard
              label="已覆盖能力"
              value={String(DATA_CONNECTION_CAPABILITIES.length)}
              note="设计稿里的能力卡已全部转为桌面页可渲染的数据源。"
            />
            <MetricCard
              label="当前筛选"
              value={String(filteredCapabilities.length)}
              note={`正在展示 ${filteredCapabilities.length} 项能力，活跃市场筛选 ${activeMarketCount} 个。`}
            />
            <MetricCard
              label="投研场景"
              value={String(DATA_CONNECTION_SCENARIOS.length)}
              note="能力卡可直接服务研究、跟踪、分析、监控等投研工作流。"
            />
          </div>
        </section>

        <section className="rounded-[28px] border border-[var(--border-default)] bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(247,247,244,0.82))] p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)] dark:bg-[linear-gradient(180deg,rgba(27,27,27,0.92),rgba(15,15,15,0.90))] dark:shadow-[0_22px_44px_rgba(0,0,0,0.28)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">
                <Filter className="h-4 w-4 text-[var(--brand-primary)]" />
                市场筛选
              </div>
              <p className="mt-2 text-[14px] leading-7 text-[var(--text-secondary)]">
                支持多选；选择“全部”时会清空其他筛选条件。
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {DATA_CONNECTION_MARKETS.map((market) => (
                <MarketButton
                  key={market}
                  label={market}
                  selected={selectedMarkets.includes(market)}
                  onClick={() => {
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
                  }}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2 2xl:grid-cols-3">
          {filteredCapabilities.map((capability) => (
            <CapabilityCard key={capability.title} capability={capability} />
          ))}
        </section>

        {filteredCapabilities.length === 0 ? (
          <section className="rounded-[28px] border border-dashed border-[var(--border-default)] bg-[var(--bg-card)] px-6 py-12 text-center">
            <div className="text-[18px] font-medium text-[var(--text-primary)]">没有匹配的数据能力</div>
            <p className="mt-3 text-[14px] leading-7 text-[var(--text-secondary)]">
              可以尝试减少市场筛选，或者改用更宽泛的关键词。
            </p>
          </section>
        ) : null}

        <section className="rounded-[30px] border border-[var(--border-default)] bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(245,247,250,0.82))] p-6 shadow-[0_20px_40px_rgba(15,23,42,0.06)] dark:bg-[linear-gradient(180deg,rgba(26,26,26,0.92),rgba(15,15,15,0.90))] dark:shadow-[0_24px_48px_rgba(0,0,0,0.28)]">
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
              className="inline-flex items-center gap-2 self-start rounded-[16px] border border-[var(--border-default)] bg-[var(--bg-hover)] px-4 py-2 text-[13px] font-medium text-[var(--text-primary)] transition hover:border-[var(--border-strong)] hover:bg-[var(--bg-card)]"
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
