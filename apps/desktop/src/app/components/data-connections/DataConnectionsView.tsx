import { useMemo, useState, type ReactNode } from 'react';
import {
  Activity,
  ArrowRight,
  BarChart3,
  Check,
  ChevronRight,
  Clock3,
  Coins,
  FileText,
  Globe2,
  Landmark,
  LineChart,
  Newspaper,
  Search,
} from 'lucide-react';
import { cn } from '@/app/lib/cn';
import { APPLE_FLAT_SURFACE, INTERACTIVE_FOCUS_RING, SPRING_PRESSABLE } from '@/app/lib/ui-interactions';
import { Button } from '@/app/components/ui/Button';
import { FilterPill } from '@/app/components/ui/FilterPill';
import { PressableCard } from '@/app/components/ui/PressableCard';
import {
  DATA_CONNECTION_CAPABILITIES,
  DATA_CONNECTION_GROUPS,
  DATA_CONNECTION_MARKETS,
  DATA_CONNECTION_SCENARIOS,
  DATA_CONNECTION_STATUS,
  type DataConnectionCapability,
  type DataConnectionCapabilityGroup,
  type DataConnectionScenario,
} from './data-connections-data';

const MARKET_TAG_TONES: Record<string, string> = {
  A股: 'border-[rgba(170,74,74,0.18)] bg-[rgba(170,74,74,0.08)] text-[#8f4040] dark:border-[rgba(216,144,144,0.24)] dark:bg-[rgba(216,144,144,0.14)] dark:text-[#e2aaaa]',
  美股: 'border-[rgba(74,111,165,0.18)] bg-[rgba(74,111,165,0.08)] text-[#426693] dark:border-[rgba(143,168,208,0.24)] dark:bg-[rgba(143,168,208,0.14)] dark:text-[#a9bfe4]',
  港股: 'border-[rgba(74,138,127,0.18)] bg-[rgba(74,138,127,0.08)] text-[#3f786f] dark:border-[rgba(124,181,171,0.24)] dark:bg-[rgba(124,181,171,0.14)] dark:text-[#9bcac1]',
  期货: 'border-[rgba(168,111,62,0.18)] bg-[rgba(168,111,62,0.08)] text-[#946139] dark:border-[rgba(211,153,102,0.24)] dark:bg-[rgba(211,153,102,0.14)] dark:text-[#deb286]',
  黄金: 'border-[rgba(168,140,93,0.20)] bg-[rgba(168,140,93,0.08)] text-[#8f7751] dark:border-[rgba(194,170,130,0.26)] dark:bg-[rgba(194,170,130,0.14)] dark:text-[#d7c09a]',
  贵金属:
    'border-[rgba(168,140,93,0.20)] bg-[rgba(168,140,93,0.08)] text-[#8f7751] dark:border-[rgba(194,170,130,0.26)] dark:bg-[rgba(194,170,130,0.14)] dark:text-[#d7c09a]',
  加密: 'border-[rgba(74,138,111,0.18)] bg-[rgba(74,138,111,0.08)] text-[#447b63] dark:border-[rgba(124,181,156,0.24)] dark:bg-[rgba(124,181,156,0.14)] dark:text-[#9ccbb4]',
  宏观: 'border-[rgba(107,101,93,0.18)] bg-[rgba(107,101,93,0.08)] text-[#6b655d] dark:border-[rgba(185,176,165,0.22)] dark:bg-[rgba(185,176,165,0.12)] dark:text-[#b9b0a5]',
  'ETF/基金':
    'border-[rgba(90,107,159,0.18)] bg-[rgba(90,107,159,0.08)] text-[#586993] dark:border-[rgba(139,154,201,0.24)] dark:bg-[rgba(139,154,201,0.14)] dark:text-[#afbbe0]',
  外汇: 'border-[rgba(74,122,159,0.18)] bg-[rgba(74,122,159,0.08)] text-[#486f8d] dark:border-[rgba(122,172,208,0.24)] dark:bg-[rgba(122,172,208,0.14)] dark:text-[#a3cae4]',
  中国: 'border-[rgba(170,74,74,0.18)] bg-[rgba(170,74,74,0.08)] text-[#8f4040] dark:border-[rgba(216,144,144,0.24)] dark:bg-[rgba(216,144,144,0.14)] dark:text-[#e2aaaa]',
  美国: 'border-[rgba(74,111,165,0.18)] bg-[rgba(74,111,165,0.08)] text-[#426693] dark:border-[rgba(143,168,208,0.24)] dark:bg-[rgba(143,168,208,0.14)] dark:text-[#a9bfe4]',
  全球: 'border-[rgba(105,90,146,0.18)] bg-[rgba(105,90,146,0.08)] text-[#6b5a93] dark:border-[rgba(155,138,201,0.24)] dark:bg-[rgba(155,138,201,0.14)] dark:text-[#c1b2e4]',
  量化: 'border-[rgba(105,90,146,0.18)] bg-[rgba(105,90,146,0.08)] text-[#6b5a93] dark:border-[rgba(155,138,201,0.24)] dark:bg-[rgba(155,138,201,0.14)] dark:text-[#c1b2e4]',
};

const MARKET_BUTTON_TONES: Record<string, string> = {
  A股: 'border-[rgba(170,74,74,0.22)] bg-[rgba(170,74,74,0.10)] text-[#8f4040] hover:border-[rgba(170,74,74,0.34)] dark:border-[rgba(216,144,144,0.22)] dark:bg-[rgba(216,144,144,0.12)] dark:text-[#e2aaaa] dark:hover:border-[rgba(216,144,144,0.34)]',
  美股: 'border-[rgba(74,111,165,0.22)] bg-[rgba(74,111,165,0.10)] text-[#426693] hover:border-[rgba(74,111,165,0.34)] dark:border-[rgba(143,168,208,0.22)] dark:bg-[rgba(143,168,208,0.12)] dark:text-[#a9bfe4] dark:hover:border-[rgba(143,168,208,0.34)]',
  港股: 'border-[rgba(74,138,127,0.22)] bg-[rgba(74,138,127,0.10)] text-[#3f786f] hover:border-[rgba(74,138,127,0.34)] dark:border-[rgba(124,181,171,0.22)] dark:bg-[rgba(124,181,171,0.12)] dark:text-[#9bcac1] dark:hover:border-[rgba(124,181,171,0.34)]',
  期货: 'border-[rgba(168,111,62,0.22)] bg-[rgba(168,111,62,0.10)] text-[#946139] hover:border-[rgba(168,111,62,0.34)] dark:border-[rgba(211,153,102,0.22)] dark:bg-[rgba(211,153,102,0.12)] dark:text-[#deb286] dark:hover:border-[rgba(211,153,102,0.34)]',
  黄金: 'border-[rgba(168,140,93,0.24)] bg-[rgba(168,140,93,0.10)] text-[#8f7751] hover:border-[rgba(168,140,93,0.36)] dark:border-[rgba(194,170,130,0.24)] dark:bg-[rgba(194,170,130,0.14)] dark:text-[#d7c09a] dark:hover:border-[rgba(194,170,130,0.36)]',
  加密: 'border-[rgba(74,138,111,0.22)] bg-[rgba(74,138,111,0.10)] text-[#447b63] hover:border-[rgba(74,138,111,0.34)] dark:border-[rgba(124,181,156,0.22)] dark:bg-[rgba(124,181,156,0.12)] dark:text-[#9ccbb4] dark:hover:border-[rgba(124,181,156,0.34)]',
  宏观: 'border-[rgba(107,101,93,0.22)] bg-[rgba(107,101,93,0.10)] text-[#6b655d] hover:border-[rgba(107,101,93,0.34)] dark:border-[rgba(185,176,165,0.22)] dark:bg-[rgba(185,176,165,0.12)] dark:text-[#c5bcaf] dark:hover:border-[rgba(185,176,165,0.34)]',
  'ETF/基金':
    'border-[rgba(90,107,159,0.22)] bg-[rgba(90,107,159,0.10)] text-[#586993] hover:border-[rgba(90,107,159,0.34)] dark:border-[rgba(139,154,201,0.22)] dark:bg-[rgba(139,154,201,0.12)] dark:text-[#afbbe0] dark:hover:border-[rgba(139,154,201,0.34)]',
  外汇: 'border-[rgba(74,122,159,0.22)] bg-[rgba(74,122,159,0.10)] text-[#486f8d] hover:border-[rgba(74,122,159,0.34)] dark:border-[rgba(122,172,208,0.22)] dark:bg-[rgba(122,172,208,0.12)] dark:text-[#a3cae4] dark:hover:border-[rgba(122,172,208,0.34)]',
};

const STATUS_TONES: Record<'已支持' | '规划中', string> = {
  已支持:
    'border-[rgba(46,107,87,0.18)] bg-[rgba(46,107,87,0.10)] text-[#2e6b57] dark:border-[rgba(127,192,169,0.24)] dark:bg-[rgba(127,192,169,0.14)] dark:text-[#9fd3bf]',
  规划中:
    'border-[rgba(154,106,34,0.18)] bg-[rgba(154,106,34,0.10)] text-[#9a6a22] dark:border-[rgba(209,174,116,0.24)] dark:bg-[rgba(209,174,116,0.14)] dark:text-[#ddc28f]',
};

function matchesSearch(capability: DataConnectionCapability, query: string) {
  if (!query.trim()) return true;
  const normalized = query.trim().toLowerCase();
  return (
    capability.title.toLowerCase().includes(normalized) ||
    capability.subtitle.toLowerCase().includes(normalized) ||
    capability.markets.some((market) => market.toLowerCase().includes(normalized)) ||
    capability.capabilities.some((item) => item.toLowerCase().includes(normalized))
  );
}

function matchesMarkets(capability: DataConnectionCapability, selectedMarkets: string[]) {
  if (selectedMarkets.includes('全部')) return true;
  return capability.markets.some((market) => selectedMarkets.includes(market));
}

function matchesStatus(capability: DataConnectionCapability, selectedStatus: string) {
  return selectedStatus === '全部' || capability.status === selectedStatus;
}

function matchesScenario(capability: DataConnectionCapability, selectedScenario: string | null) {
  return !selectedScenario || capability.scenarios.includes(selectedScenario as DataConnectionScenario['id']);
}

function groupIcon(title: string) {
  switch (title) {
    case '行情与价格':
      return LineChart;
    case '财务与估值':
      return FileText;
    case '新闻与披露':
      return Newspaper;
    case '宏观与利率':
      return Landmark;
    case '加密与另类资产':
      return Coins;
    case '量化与筛选':
      return BarChart3;
    default:
      return Globe2;
  }
}

function scenarioIcon(id: DataConnectionScenario['id']) {
  switch (id) {
    case 'fundamental':
      return FileText;
    case 'tracking':
      return Activity;
    case 'quant':
      return BarChart3;
    default:
      return Globe2;
  }
}

function capabilityIcon(capability: DataConnectionCapability) {
  if (capability.group === '行情与价格') return LineChart;
  if (capability.group === '新闻与披露') return Newspaper;
  if (capability.group === '宏观与利率') return Landmark;
  if (capability.group === '加密与另类资产') return Coins;
  if (capability.group === '量化与筛选') return BarChart3;
  return FileText;
}

function toggleMarketSelection(market: string, current: string[]) {
  if (market === '全部') return ['全部'];
  const next = current.filter((item) => item !== '全部');
  if (next.includes(market)) {
    const reduced = next.filter((item) => item !== market);
    return reduced.length > 0 ? reduced : ['全部'];
  }
  return [...next, market];
}

function HeaderMetric({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div
      className={cn(
        'flex min-w-[136px] items-center gap-3 rounded-[16px] border px-3.5 py-2.5 text-left',
        'border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]',
        APPLE_FLAT_SURFACE,
      )}
    >
      <div className="min-w-0">
        <div className="text-[11px] font-medium tracking-[0.08em] text-[var(--text-muted)]">{label}</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-[19px] font-semibold tracking-[-0.05em] text-[var(--text-primary)]">{value}</span>
          <span className="text-[11px] text-[var(--text-muted)]">{note}</span>
        </div>
      </div>
    </div>
  );
}

function SearchField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label
      className={cn(
        'flex min-w-[280px] flex-1 items-center gap-3 rounded-[16px] border px-4 py-3',
        'border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-primary)]',
        APPLE_FLAT_SURFACE,
        INTERACTIVE_FOCUS_RING,
      )}
    >
      <Search className="h-4.5 w-4.5 shrink-0 text-[var(--text-muted)]" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder='搜索能力，例如“实时行情”“财务报表”“宏观数据”'
        className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
      />
    </label>
  );
}

function FilterChip({
  label,
  active,
  onClick,
  toneClassName,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  toneClassName?: string;
}) {
  return (
    <FilterPill
      active={active}
      onClick={onClick}
      className={cn(
        'rounded-[13px] px-3 py-1.5 text-[12px] font-medium',
        active && toneClassName,
        active &&
          !toneClassName &&
          'border-[var(--lobster-gold-border)] bg-[var(--lobster-gold-soft)] text-[var(--lobster-gold-strong)] dark:border-[rgba(201,169,97,0.20)] dark:bg-[rgba(201,169,97,0.16)] dark:text-[#f1d59c]',
      )}
    >
      {label}
    </FilterPill>
  );
}

function MarketTag({ market }: { market: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none',
        MARKET_TAG_TONES[market] ||
          'border-[var(--border-default)] bg-[var(--bg-hover)] text-[var(--text-secondary)]',
      )}
    >
      {market}
    </span>
  );
}

function CapabilityBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[var(--border-default)] bg-[var(--bg-hover)] px-2.5 py-1 text-[11px] leading-none text-[var(--text-secondary)]">
      {label}
    </span>
  );
}

function StatusBadge({ status = '已支持' }: { status?: '已支持' | '规划中' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none',
        STATUS_TONES[status],
      )}
    >
      {status === '已支持' ? <Check className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}
      {status}
    </span>
  );
}

function ScenarioCard({
  scenario,
  selected,
  onClick,
}: {
  scenario: DataConnectionScenario;
  selected: boolean;
  onClick: () => void;
}) {
  const Icon = scenarioIcon(scenario.id);

  return (
    <PressableCard
      interactive
      onClick={onClick}
      className={cn(
        'rounded-[20px] border p-3.5 shadow-none',
        selected
          ? 'border-[var(--lobster-gold-border)] bg-[var(--lobster-gold-soft)] shadow-[0_14px_28px_rgba(168,140,93,0.12)] dark:shadow-[0_16px_30px_rgba(0,0,0,0.28)]'
          : 'bg-[var(--bg-card)]',
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border',
            selected
              ? 'border-[rgba(168,140,93,0.28)] bg-[rgba(168,140,93,0.18)] text-[var(--lobster-gold-strong)]'
              : 'border-[var(--border-default)] bg-[var(--bg-hover)] text-[var(--text-secondary)]',
          )}
        >
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0">
          <div className={cn('text-[13px] font-semibold', selected ? 'text-[var(--lobster-gold-strong)]' : 'text-[var(--text-primary)]')}>
            {scenario.label}
          </div>
          <div className="mt-0.5 text-[12px] text-[var(--text-secondary)]">{scenario.description}</div>
          <div className="mt-1.5 text-[11px] leading-5 text-[var(--text-muted)]">{scenario.summary}</div>
        </div>
      </div>
    </PressableCard>
  );
}

function SectionCard({
  group,
  children,
}: {
  group: DataConnectionCapabilityGroup;
  children: ReactNode;
}) {
  const Icon = groupIcon(group.title);

  return (
    <section className="rounded-[24px] border border-[var(--border-default)] bg-[rgba(255,255,255,0.76)] p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)] dark:bg-[rgba(25,23,21,0.88)] dark:shadow-[0_16px_30px_rgba(0,0,0,0.24)]">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-[rgba(168,140,93,0.18)] bg-[var(--lobster-gold-soft)] text-[var(--lobster-gold-strong)]">
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">{group.title}</h2>
          <p className="mt-1 text-[12px] leading-6 text-[var(--text-secondary)]">{group.description}</p>
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function CapabilityRow({ capability }: { capability: DataConnectionCapability }) {
  const Icon = capabilityIcon(capability);

  return (
    <PressableCard
      interactive
      className={cn(
        'rounded-[20px] border bg-[var(--bg-elevated)] shadow-none',
        'hover:bg-[var(--bg-elevated)]',
      )}
    >
      <div className="flex items-start gap-4 p-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-[rgba(168,140,93,0.18)] bg-[var(--lobster-gold-soft)] text-[var(--lobster-gold-strong)]">
          <Icon className="h-4.5 w-4.5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">{capability.title}</h3>
                <StatusBadge status={capability.status} />
              </div>
              <p className="mt-1 text-[12px] leading-6 text-[var(--text-secondary)]">{capability.subtitle}</p>
            </div>

            <div className="flex items-center gap-2 text-[var(--text-muted)]">
              <span className="hidden text-[11px] lg:inline">查看详情</span>
              <ChevronRight className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {capability.markets.map((market) => (
              <MarketTag key={market} market={market} />
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {capability.capabilities.map((item) => (
              <CapabilityBadge key={item} label={item} />
            ))}
          </div>
        </div>
      </div>
    </PressableCard>
  );
}

export function DataConnectionsView() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>(['全部']);
  const [selectedStatus, setSelectedStatus] = useState<string>('全部');
  const [selectedScenario, setSelectedScenario] = useState<DataConnectionScenario['id'] | null>(null);

  const filteredGroups = useMemo(
    () =>
      DATA_CONNECTION_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter(
          (capability) =>
            matchesSearch(capability, searchQuery) &&
            matchesMarkets(capability, selectedMarkets) &&
            matchesStatus(capability, selectedStatus) &&
            matchesScenario(capability, selectedScenario),
        ),
      })).filter((group) => group.items.length > 0),
    [searchQuery, selectedMarkets, selectedStatus, selectedScenario],
  );

  const filteredCount = useMemo(
    () => filteredGroups.reduce((total, group) => total + group.items.length, 0),
    [filteredGroups],
  );

  const activeMarketCount = selectedMarkets.includes('全部') ? DATA_CONNECTION_MARKETS.length - 1 : selectedMarkets.length;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(168,140,93,0.08),transparent_28%),linear-gradient(180deg,var(--bg-page)_0%,var(--bg-page)_100%)]">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-5 py-5 lg:px-8">
        <section className="rounded-[24px] border border-[var(--border-default)] bg-[rgba(255,255,255,0.78)] px-5 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)] dark:bg-[rgba(25,23,21,0.92)] dark:shadow-[0_18px_32px_rgba(0,0,0,0.24)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 max-w-[760px]">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-hover)] px-3 py-1 text-[11px] font-medium tracking-[0.08em] text-[var(--text-muted)]">
                <Globe2 className="h-3.5 w-3.5 text-[var(--lobster-gold-strong)]" />
                Data Connections
              </div>
              <h1 className="mt-3 text-[30px] font-semibold tracking-[-0.06em] text-[var(--text-primary)]">数据连接</h1>
              <p className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">
                封装层数据能力中心，覆盖多市场行情、财报、资讯、宏观、加密与量化数据集，帮助用户快速理解当前 wrapper
                侧可直接调用的研究能力。
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5 xl:justify-end">
              <HeaderMetric label="已覆盖能力" value={String(DATA_CONNECTION_CAPABILITIES.length)} note="结构化接入" />
              <HeaderMetric label="已接入市场" value={String(DATA_CONNECTION_MARKETS.length - 1)} note="跨市场覆盖" />
              <HeaderMetric label="研究场景" value={String(DATA_CONNECTION_SCENARIOS.length)} note="研究 / 跟踪 / 量化" />
            </div>
          </div>
        </section>

        <section className="rounded-[22px] border border-[var(--border-default)] bg-[rgba(255,255,255,0.72)] p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)] dark:bg-[rgba(25,23,21,0.9)] dark:shadow-[0_16px_28px_rgba(0,0,0,0.22)]">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <SearchField value={searchQuery} onChange={setSearchQuery} />

              <div className="flex flex-wrap gap-2">
                {DATA_CONNECTION_STATUS.map((status) => (
                  <FilterChip
                    key={status}
                    label={status}
                    active={selectedStatus === status}
                    onClick={() => setSelectedStatus(status)}
                  />
                ))}
              </div>

              <Button
                variant="secondary"
                size="sm"
                className="shrink-0"
                leadingIcon={<ArrowRight className="h-4 w-4" />}
              >
                查看接入规划
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {DATA_CONNECTION_MARKETS.map((market) => (
                <FilterChip
                  key={market}
                  label={market}
                  active={selectedMarkets.includes(market)}
                  onClick={() => setSelectedMarkets((current) => toggleMarketSelection(market, current))}
                  toneClassName={market === '全部' ? undefined : MARKET_BUTTON_TONES[market]}
                />
              ))}
            </div>
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="space-y-4 xl:sticky xl:top-0 xl:self-start">
            <section className="rounded-[22px] border border-[var(--border-default)] bg-[rgba(255,255,255,0.78)] p-4 shadow-[0_10px_22px_rgba(15,23,42,0.04)] dark:bg-[rgba(25,23,21,0.9)] dark:shadow-[0_16px_26px_rgba(0,0,0,0.22)]">
              <div className="text-[11px] font-medium tracking-[0.08em] text-[var(--text-muted)]">浏览方式</div>
              <div className="mt-3 space-y-2.5">
                {DATA_CONNECTION_SCENARIOS.map((scenario) => (
                  <ScenarioCard
                    key={scenario.id}
                    scenario={scenario}
                    selected={selectedScenario === scenario.id}
                    onClick={() =>
                      setSelectedScenario((current) => (current === scenario.id ? null : scenario.id))
                    }
                  />
                ))}
              </div>
            </section>

            <section className="rounded-[22px] border border-[var(--border-default)] bg-[rgba(255,255,255,0.78)] p-4 shadow-[0_10px_22px_rgba(15,23,42,0.04)] dark:bg-[rgba(25,23,21,0.9)] dark:shadow-[0_16px_26px_rgba(0,0,0,0.22)]">
              <div className="text-[11px] font-medium tracking-[0.08em] text-[var(--text-muted)]">覆盖范围</div>
              <div className="mt-3 grid gap-2">
                <div className="rounded-[16px] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2.5">
                  <div className="text-[11px] text-[var(--text-muted)]">当前结果</div>
                  <div className="mt-1 text-[20px] font-semibold tracking-[-0.05em] text-[var(--text-primary)]">{filteredCount}</div>
                </div>
                <div className="rounded-[16px] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2.5">
                  <div className="text-[11px] text-[var(--text-muted)]">市场筛选</div>
                  <div className="mt-1 text-[13px] font-medium text-[var(--text-primary)]">{activeMarketCount} 个市场</div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {DATA_CONNECTION_MARKETS.filter((market) => market !== '全部').map((market) => (
                  <MarketTag key={market} market={market} />
                ))}
              </div>
            </section>
          </aside>

          <main className="min-w-0 space-y-4">
            {filteredGroups.length === 0 ? (
              <section className="rounded-[24px] border border-dashed border-[var(--border-default)] bg-[var(--bg-card)] px-6 py-12 text-center">
                <div className="text-[18px] font-semibold text-[var(--text-primary)]">没有匹配的数据能力</div>
                <p className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">
                  可以尝试减少市场筛选、清空场景条件，或改用更宽泛的关键词。
                </p>
              </section>
            ) : (
              filteredGroups.map((group) => (
                <SectionCard key={group.title} group={group}>
                  {group.items.map((capability) => (
                    <CapabilityRow key={capability.title} capability={capability} />
                  ))}
                </SectionCard>
              ))
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
