import { useMemo, useState } from 'react';
import {
  Activity,
  Check,
  Clock3,
  Database,
  Globe2,
  Layers3,
  Search,
  Sparkles,
} from 'lucide-react';
import { Chip } from '@/app/components/ui/Chip';
import { CompactDisclosure } from '@/app/components/ui/CompactDisclosure';
import { EmptyStatePanel } from '@/app/components/ui/EmptyStatePanel';
import { FilterPill } from '@/app/components/ui/FilterPill';
import { PageContent, PageHeader, PageSurface } from '@/app/components/ui/PageLayout';
import { PressableCard } from '@/app/components/ui/PressableCard';
import { StatCard } from '@/app/components/ui/StatCard';
import { SurfacePanel } from '@/app/components/ui/SurfacePanel';
import { SummaryMetricItem } from '@/app/components/ui/SummaryMetricItem';
import { cn } from '@/app/lib/cn';
import { capabilityGroups, type Capability } from './data-connections-data';

const STATUS_FILTERS = ['全部', '已支持', '规划中'] as const;
const PREFERRED_MARKET_ORDER = [
  'A股',
  '美股',
  '港股',
  '期货',
  '黄金',
  '加密',
  '宏观',
  'ETF/基金',
  '外汇',
  '中国',
  '美国',
  '全球',
  '贵金属',
  '量化',
] as const;

const MARKET_TONE_CLASS: Record<string, string> = {
  A股: 'border-[rgba(184,79,79,0.18)] bg-[rgba(184,79,79,0.10)] text-[rgb(160,55,55)] dark:text-[#f3b0b0]',
  美股: 'border-[rgba(59,130,246,0.18)] bg-[rgba(59,130,246,0.10)] text-[rgb(37,99,235)] dark:text-[#bfd6ff]',
  港股: 'border-[rgba(20,184,166,0.18)] bg-[rgba(20,184,166,0.10)] text-[rgb(13,148,136)] dark:text-[#a7f3eb]',
  期货: 'border-[rgba(217,119,6,0.18)] bg-[rgba(217,119,6,0.10)] text-[rgb(180,83,9)] dark:text-[#f7d49e]',
  黄金: 'border-[rgba(168,140,93,0.22)] bg-[rgba(168,140,93,0.12)] text-[var(--brand-primary)]',
  加密: 'border-[rgba(34,197,94,0.18)] bg-[rgba(34,197,94,0.10)] text-[rgb(21,128,61)] dark:text-[#bff3cd]',
  宏观: 'border-[var(--border-default)] bg-[var(--bg-hover)] text-[var(--text-secondary)]',
  'ETF/基金': 'border-[rgba(99,102,241,0.18)] bg-[rgba(99,102,241,0.10)] text-[rgb(79,70,229)] dark:text-[#c7c9ff]',
  外汇: 'border-[rgba(14,165,233,0.18)] bg-[rgba(14,165,233,0.10)] text-[rgb(2,132,199)] dark:text-[#bae6fd]',
  中国: 'border-[rgba(184,79,79,0.18)] bg-[rgba(184,79,79,0.10)] text-[rgb(160,55,55)] dark:text-[#f3b0b0]',
  美国: 'border-[rgba(59,130,246,0.18)] bg-[rgba(59,130,246,0.10)] text-[rgb(37,99,235)] dark:text-[#bfd6ff]',
  全球: 'border-[rgba(107,101,93,0.18)] bg-[rgba(107,101,93,0.10)] text-[var(--text-secondary)]',
  贵金属: 'border-[rgba(168,140,93,0.22)] bg-[rgba(168,140,93,0.12)] text-[var(--brand-primary)]',
  量化: 'border-[rgba(124,58,237,0.18)] bg-[rgba(124,58,237,0.10)] text-[rgb(109,40,217)] dark:text-[#d8c2ff]',
};

type CapabilityEntry = Capability & {
  category: string;
  categoryDesc: string;
};

function buildMarketOptions(items: CapabilityEntry[]) {
  const unique = new Set<string>();
  items.forEach((item) => {
    item.markets.forEach((market) => unique.add(market));
  });

  const ordered = PREFERRED_MARKET_ORDER.filter((market) => unique.has(market));
  const remaining = Array.from(unique)
    .filter((market) => !ordered.includes(market as (typeof PREFERRED_MARKET_ORDER)[number]))
    .sort((left, right) => left.localeCompare(right, 'zh-CN'));

  return ['全部', ...ordered, ...remaining];
}

function CapabilityCard({ capability }: { capability: CapabilityEntry }) {
  return (
    <PressableCard className="rounded-[28px] border-[var(--border-default)] p-5">
      <div className="flex h-full flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Chip tone="brand" className="rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.1em]">
              {capability.category}
            </Chip>
            <h3 className="mt-3 text-[18px] font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
              {capability.title}
            </h3>
            <p className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">{capability.subtitle}</p>
          </div>
          {capability.status ? (
            <Chip
              tone={capability.status === '已支持' ? 'success' : 'warning'}
              leadingIcon={
                capability.status === '已支持' ? <Check className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />
              }
              className="rounded-full px-2.5 py-1 text-[11px]"
            >
              {capability.status}
            </Chip>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {capability.capabilities.map((item) => (
            <Chip key={item} tone="outline" className="rounded-full px-2.5 py-1 text-[11px]">
              {item}
            </Chip>
          ))}
        </div>

        <div className="mt-auto border-t border-[var(--border-default)] pt-4">
          <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-muted)]">覆盖市场</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {capability.markets.map((market) => (
              <span
                key={market}
                className={cn(
                  'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none',
                  MARKET_TONE_CLASS[market] ??
                    'border-[var(--border-default)] bg-[var(--bg-hover)] text-[var(--text-secondary)]',
                )}
              >
                {market}
              </span>
            ))}
          </div>
        </div>
      </div>
    </PressableCard>
  );
}

export function DataConnectionsView({ title }: { title: string }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>(['全部']);
  const [selectedStatus, setSelectedStatus] = useState<(typeof STATUS_FILTERS)[number]>('全部');
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  const allCapabilities = useMemo<CapabilityEntry[]>(() => {
    const flattened: CapabilityEntry[] = [];
    capabilityGroups.forEach((group) => {
      group.items.forEach((item) => {
        flattened.push({
          ...item,
          category: group.title,
          categoryDesc: group.description,
        });
      });
    });
    return flattened;
  }, []);

  const marketOptions = useMemo(() => buildMarketOptions(allCapabilities), [allCapabilities]);

  const filteredCapabilities = useMemo(
    () =>
      allCapabilities.filter((capability) => {
        const normalizedQuery = searchQuery.trim().toLowerCase();
        const matchesSearch =
          normalizedQuery.length === 0 ||
          capability.title.toLowerCase().includes(normalizedQuery) ||
          capability.subtitle.toLowerCase().includes(normalizedQuery) ||
          capability.category.toLowerCase().includes(normalizedQuery) ||
          capability.capabilities.some((item) => item.toLowerCase().includes(normalizedQuery));

        const matchesMarket =
          selectedMarkets.includes('全部') ||
          capability.markets.some((market) => selectedMarkets.includes(market));

        const matchesStatus = selectedStatus === '全部' || capability.status === selectedStatus;

        return matchesSearch && matchesMarket && matchesStatus;
      }),
    [allCapabilities, searchQuery, selectedMarkets, selectedStatus],
  );

  const supportedCount = useMemo(
    () => allCapabilities.filter((capability) => capability.status === '已支持').length,
    [allCapabilities],
  );

  const plannedCount = useMemo(
    () => allCapabilities.filter((capability) => capability.status === '规划中').length,
    [allCapabilities],
  );

  const activeFilterCount = useMemo(() => {
    const marketCount = selectedMarkets.includes('全部') ? 0 : selectedMarkets.length;
    const statusCount = selectedStatus === '全部' ? 0 : 1;
    return marketCount + statusCount;
  }, [selectedMarkets, selectedStatus]);

  const handleMarketToggle = (market: string) => {
    if (market === '全部') {
      setSelectedMarkets(['全部']);
      return;
    }

    const current = selectedMarkets.filter((item) => item !== '全部');
    if (current.includes(market)) {
      const next = current.filter((item) => item !== market);
      setSelectedMarkets(next.length > 0 ? next : ['全部']);
      return;
    }

    setSelectedMarkets([...current, market]);
  };

  return (
    <PageSurface as="div">
      <PageContent className="py-5">
        <PageHeader
          title={title}
          description="统一管理 iClaw 的金融数据能力封装层，按市场、状态和能力类型快速筛选可用数据接口。"
          className="gap-2.5"
          contentClassName="space-y-1"
          titleClassName="mt-0 text-[24px] font-semibold tracking-[-0.045em]"
          descriptionClassName="mt-0 text-[12px] leading-5"
        />

        <SurfacePanel tone="subtle" className="mt-3 rounded-[20px] p-1.5">
          <div className="flex flex-wrap gap-y-2">
            <SummaryMetricItem
              first
              tone="brand"
              icon={Database}
              label="能力"
              value={String(allCapabilities.length)}
              note="统一收口到可复用的数据能力层"
              className="px-2 py-1"
            />
            <SummaryMetricItem
              tone="success"
              icon={Activity}
              label="已支持"
              value={String(supportedCount)}
              note="当前已经接通并可直接调用"
              className="px-2 py-1"
            />
            <SummaryMetricItem
              tone="neutral"
              icon={Globe2}
              label="市场"
              value={String(marketOptions.length - 1)}
              note="覆盖股票、宏观、ETF、加密等类型"
              className="px-2 py-1"
            />
            <SummaryMetricItem
              tone={plannedCount > 0 ? 'warning' : 'neutral'}
              icon={Layers3}
              label="类别"
              value={String(capabilityGroups.length)}
              note={plannedCount > 0 ? `另有 ${plannedCount} 项规划中能力` : '已按业务能力物理归类'}
              className="px-2 py-1"
            />
          </div>
        </SurfacePanel>

        <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
          <SurfacePanel className="rounded-[20px] p-4">
            <div className="flex flex-col gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder='搜索能力，例如“实时行情”、“财务报表”、“经济日历”'
                  className="h-10 w-full rounded-[14px] border border-[var(--border-default)] bg-[var(--bg-card)] pl-11 pr-4 text-[12px] text-[var(--text-primary)] outline-none transition focus:border-[var(--brand-primary)]"
                />
              </div>

              <CompactDisclosure
                title="高级筛选"
                summary={activeFilterCount > 0 ? `已启用 ${activeFilterCount} 项条件` : '按市场与接入状态缩小结果范围'}
                open={filtersExpanded}
                onToggle={() => setFiltersExpanded((current) => !current)}
              />

              {filtersExpanded ? (
                <>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                      市场过滤
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {marketOptions.map((market) => (
                        <FilterPill
                          key={market}
                          active={selectedMarkets.includes(market)}
                          onClick={() => handleMarketToggle(market)}
                          className="px-2.5 py-1 text-[11px]"
                        >
                          {market}
                        </FilterPill>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                      状态过滤
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {STATUS_FILTERS.map((status) => (
                        <FilterPill
                          key={status}
                          active={selectedStatus === status}
                          onClick={() => setSelectedStatus(status)}
                          className="px-2.5 py-1 text-[11px]"
                        >
                          {status}
                        </FilterPill>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </SurfacePanel>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <StatCard
              icon={<Sparkles className="h-5 w-5" />}
              label="筛选结果"
              value={filteredCapabilities.length}
              description={searchQuery.trim() ? `关键词：${searchQuery.trim()}` : '当前显示全部可见能力'}
              tone="brand"
            />
            <StatCard
              icon={<Globe2 className="h-5 w-5" />}
              label="激活市场"
              value={selectedMarkets.includes('全部') ? '全部' : `${selectedMarkets.length} 项`}
              description={
                selectedMarkets.includes('全部')
                  ? '未限制市场范围'
                  : `当前过滤：${selectedMarkets.join(' / ')}`
              }
              tone="default"
            />
          </div>
        </div>

        {filteredCapabilities.length === 0 ? (
          <div className="mt-5">
            <EmptyStatePanel
              icon={<Database className="h-6 w-6" />}
              title="未找到匹配的数据能力"
              description="当前筛选条件没有命中结果。可以先清空关键词，或者放宽市场与状态过滤。"
            />
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredCapabilities.map((capability) => (
              <CapabilityCard
                key={`${capability.category}-${capability.title}`}
                capability={capability}
              />
            ))}
          </div>
        )}
      </PageContent>
    </PageSurface>
  );
}
