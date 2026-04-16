import {useEffect, useMemo, useState, type ReactNode} from 'react';
import type {IClawClient} from '@iclaw/sdk';
import {
  Activity,
  Blocks,
  ChevronDown,
  ChevronUp,
  Check,
  Clock3,
  Database,
  Layers3,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {CustomMcpModal, DEFAULT_CUSTOM_MCP_DRAFT} from '@/app/components/mcp-store/CustomMcpModal';
import {
  LibraryCard,
  McpDetailSheet,
  McpLoadingGrid,
  MineCard,
} from '@/app/components/mcp-store/McpStoreShared';
import {ExtensionInstallConfigModal} from '@/app/components/extensions/ExtensionInstallConfigModal';
import {Button} from '@/app/components/ui/Button';
import {Chip} from '@/app/components/ui/Chip';
import {EmptyStatePanel} from '@/app/components/ui/EmptyStatePanel';
import {FilterPill} from '@/app/components/ui/FilterPill';
import {PageContent, PageHeader, PageSurface} from '@/app/components/ui/PageLayout';
import {PressableCard} from '@/app/components/ui/PressableCard';
import {SegmentedTabs} from '@/app/components/ui/SegmentedTabs';
import {SurfacePanel} from '@/app/components/ui/SurfacePanel';
import {SummaryMetricItem} from '@/app/components/ui/SummaryMetricItem';
import {cn} from '@/app/lib/cn';
import type {ExtensionInstallConfigSnapshot} from '@/app/lib/extension-setup';
import {
  type McpStoreItem,
  installMcpFromStore,
  isFinanceMcpStoreItem,
  loadMcpInstallConfig,
  loadMcpStoreCatalog,
  removeCustomMcp,
  removeMcpFromLibrary,
  saveCustomMcp,
  saveMcpInstallConfig,
  updateCustomMcpEnabledState,
  updateMcpEnabledState,
} from '@/app/lib/mcp-store';
import {capabilityGroups, type Capability} from './data-connections-data';

const STATUS_FILTERS = ['全部', '已支持', '规划中'] as const;
const FINANCE_TABS = [
  {id: 'finance', label: '财经MCP'},
  {id: 'mine', label: '我的MCP'},
] as const;
const MINE_STATUS_FILTERS = ['全部', '已启用', '未启用'] as const;
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

type FinanceTab = (typeof FINANCE_TABS)[number]['id'];

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

function CapabilityCard({capability}: {capability: CapabilityEntry}) {
  return (
    <PressableCard className="rounded-[28px] border-[var(--border-default)] p-5">
      <div className="flex h-full flex-col gap-4">
        <div className="min-w-0">
          <Chip tone="brand" className="rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.1em]">
            {capability.category}
          </Chip>
          <h3 className="mt-3 text-[18px] font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
            {capability.title}
          </h3>
          <p className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">{capability.subtitle}</p>
          {capability.status ? (
            <Chip
              tone={capability.status === '已支持' ? 'success' : 'warning'}
              leadingIcon={
                capability.status === '已支持' ? <Check className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />
              }
              className="mt-3 inline-flex rounded-full px-2.5 py-1 text-[11px]"
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

function FinanceStoreSection({
  title,
  description,
  icon,
  items,
  loading,
  emptyTitle,
  emptyDescription,
  busyKey,
  onDetail,
  onInstall,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  items: McpStoreItem[];
  loading: boolean;
  emptyTitle: string;
  emptyDescription: string;
  busyKey: string | null;
  onDetail: (item: McpStoreItem) => void;
  onInstall: (item: McpStoreItem) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-[14px] bg-[rgba(201,169,97,0.12)] text-[var(--brand-primary)]">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-[16px] font-semibold tracking-[-0.03em] text-[var(--text-primary)]">{title}</div>
          <div className="mt-1 text-[13px] leading-6 text-[var(--text-secondary)]">{description}</div>
        </div>
      </div>

      {loading ? (
        <McpLoadingGrid />
      ) : items.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 2xl:grid-cols-3">
          {items.map((item) => (
            <LibraryCard
              key={item.mcpKey}
              item={item}
              busy={busyKey === item.mcpKey}
              onDetail={onDetail}
              onInstall={onInstall}
            />
          ))}
        </div>
      ) : (
        <EmptyStatePanel compact title={emptyTitle} description={emptyDescription} />
      )}
    </div>
  );
}

export function DataConnectionsView({
  title,
  client,
  accessToken,
  authenticated,
  onRequestAuth,
  revalidateBrandRuntimeConfig,
}: {
  title: string;
  client: IClawClient;
  accessToken: string | null;
  authenticated: boolean;
  onRequestAuth: (mode?: 'login' | 'register', nextView?: 'account' | null) => void;
  revalidateBrandRuntimeConfig: () => Promise<void>;
}) {
  const [activeTab, setActiveTab] = useState<FinanceTab>('finance');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>(['全部']);
  const [selectedStatus, setSelectedStatus] = useState<(typeof STATUS_FILTERS)[number]>('全部');
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [items, setItems] = useState<McpStoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [mineQuery, setMineQuery] = useState('');
  const [mineStatus, setMineStatus] = useState<(typeof MINE_STATUS_FILTERS)[number]>('全部');
  const [mineSource, setMineSource] = useState('全部来源');
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [customSaving, setCustomSaving] = useState(false);
  const [setupItem, setSetupItem] = useState<McpStoreItem | null>(null);
  const [setupMode, setSetupMode] = useState<'install' | 'configure'>('install');
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupInitialConfig, setSetupInitialConfig] = useState<ExtensionInstallConfigSnapshot | null>(null);

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

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const nextItems = await loadMcpStoreCatalog({client, accessToken});
      setItems(nextItems);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '财经 MCP 目录加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [accessToken, client]);

  const financeCatalogItems = useMemo(
    () => items.filter((item) => item.source !== 'custom' && isFinanceMcpStoreItem(item)),
    [items],
  );
  const systemPresetItems = useMemo(
    () => financeCatalogItems.filter((item) => item.defaultInstalled),
    [financeCatalogItems],
  );
  const availableFinanceItems = useMemo(
    () => financeCatalogItems.filter((item) => !item.installed),
    [financeCatalogItems],
  );
  const installedFinanceItems = useMemo(
    () => items.filter((item) => item.installed && isFinanceMcpStoreItem(item)),
    [items],
  );
  const financeMineItems = useMemo(() => {
    const normalizedQuery = mineQuery.trim().toLowerCase();
    return installedFinanceItems.filter((item) => {
      const matchesQuery =
        !normalizedQuery ||
        item.name.toLowerCase().includes(normalizedQuery) ||
        item.description.toLowerCase().includes(normalizedQuery) ||
        item.mcpKey.toLowerCase().includes(normalizedQuery) ||
        item.categories.some((category) => category.toLowerCase().includes(normalizedQuery));
      const matchesStatus =
        mineStatus === '全部' ||
        (mineStatus === '已启用' && item.enabled) ||
        (mineStatus === '未启用' && !item.enabled);
      const matchesSource = mineSource === '全部来源' || item.sourceLabel === mineSource;
      return matchesQuery && matchesStatus && matchesSource;
    });
  }, [installedFinanceItems, mineQuery, mineSource, mineStatus]);

  const platformPresetCount = useMemo(
    () => systemPresetItems.filter((item) => item.bundledBy === 'platform').length,
    [systemPresetItems],
  );
  const oemPresetCount = useMemo(
    () => systemPresetItems.filter((item) => item.bundledBy === 'oem').length,
    [systemPresetItems],
  );

  const mineSourceFilters = useMemo(
    () => ['全部来源', ...Array.from(new Set(installedFinanceItems.map((item) => item.sourceLabel)))],
    [installedFinanceItems],
  );

  useEffect(() => {
    if (!mineSourceFilters.includes(mineSource)) {
      setMineSource('全部来源');
    }
  }, [mineSource, mineSourceFilters]);

  const detailItem = useMemo(
    () => items.find((item) => item.mcpKey === detailKey) || null,
    [detailKey, items],
  );

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

  const handleOpenDetail = (item: McpStoreItem) => {
    setDetailKey(item.mcpKey);
    setDetailOpen(true);
  };

  const performInstall = async (
    item: McpStoreItem,
    options?: {setupValues?: Record<string, unknown>; secretValues?: Record<string, string>},
  ) => {
    setBusyKey(item.mcpKey);
    try {
      await installMcpFromStore({
        client,
        accessToken,
        mcpKey: item.mcpKey,
        setupValues: options?.setupValues,
        secretValues: options?.secretValues,
      });
      await loadData();
    } catch (installError) {
      setError(installError instanceof Error ? installError.message : '安装失败');
      throw installError;
    } finally {
      setBusyKey(null);
    }
  };

  const openSetupModal = async (item: McpStoreItem, mode: 'install' | 'configure') => {
    if (!authenticated || !accessToken) {
      onRequestAuth('login', 'account');
      return;
    }
    setSetupItem(item);
    setSetupMode(mode);
    setSetupInitialConfig(null);
    setSetupOpen(true);
    if (!item.userInstalled && mode === 'install') {
      return;
    }
    setSetupLoading(true);
    try {
      const config = await loadMcpInstallConfig({
        client,
        accessToken,
        mcpKey: item.mcpKey,
      });
      setSetupInitialConfig(config);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '读取配置失败');
    } finally {
      setSetupLoading(false);
    }
  };

  const handleInstall = async (item: McpStoreItem) => {
    if (item.installState === 'bundled') {
      return;
    }
    if (!authenticated || !accessToken) {
      onRequestAuth('login', 'account');
      return;
    }
    if (item.installed) {
      if (item.setupSchema) {
        await openSetupModal(item, 'configure');
      }
      return;
    }
    if (item.setupSchema) {
      await openSetupModal(item, 'install');
      return;
    }
    await performInstall(item);
  };

  const handleToggle = async (item: McpStoreItem, enabled: boolean) => {
    if (!item.canToggle) {
      return;
    }
    if (!authenticated || !accessToken) {
      onRequestAuth('login', 'account');
      return;
    }
    setBusyKey(item.mcpKey);
    try {
      if (item.source === 'custom') {
        await updateCustomMcpEnabledState({client, accessToken, item, enabled});
      } else {
        await updateMcpEnabledState({client, accessToken, mcpKey: item.mcpKey, enabled});
      }
      await loadData();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : '状态更新失败');
    } finally {
      setBusyKey(null);
    }
  };

  const handleRemove = async (item: McpStoreItem) => {
    if (!item.userInstalled) {
      return;
    }
    if (!authenticated || !accessToken) {
      onRequestAuth('login', 'account');
      return;
    }
    setBusyKey(item.mcpKey);
    try {
      if (item.source === 'custom') {
        await removeCustomMcp({client, accessToken, mcpKey: item.mcpKey});
      } else {
        await removeMcpFromLibrary({client, accessToken, mcpKey: item.mcpKey});
      }
      await loadData();
      setDetailOpen(false);
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : '移除失败');
    } finally {
      setBusyKey(null);
    }
  };

  const handleSetupSubmit = async (payload: {
    setupValues: Record<string, unknown>;
    secretValues: Record<string, string>;
  }) => {
    if (!setupItem || !accessToken) {
      return;
    }
    setSetupLoading(true);
    try {
      if (setupMode === 'install') {
        await performInstall(setupItem, payload);
      } else {
        await saveMcpInstallConfig({
          client,
          accessToken,
          mcpKey: setupItem.mcpKey,
          setupValues: payload.setupValues,
          secretValues: payload.secretValues,
        });
        await loadData();
      }
      setSetupOpen(false);
      setSetupItem(null);
      setSetupInitialConfig(null);
    } catch {
      // error already surfaced in component state
    } finally {
      setSetupLoading(false);
    }
  };

  return (
    <PageSurface as="div">
      <PageContent className="py-5">
        <PageHeader
          title={title}
          description="上半部分保留财经能力秀肌肉，下半部分收口成真实财经 MCP 专题商店；我的MCP直接复用商店里的安装、配置与启停能力。"
          className="gap-2.5"
          contentClassName="space-y-1"
          titleClassName="mt-0 text-[24px] font-semibold tracking-[-0.045em]"
          descriptionClassName="mt-0 text-[12px] leading-5"
          actions={
            <Button variant="primary" size="sm" leadingIcon={<Plus className="h-4 w-4" />} onClick={() => setCustomModalOpen(true)}>
              添加MCP
            </Button>
          }
        />

        <div className="mt-4">
          <SegmentedTabs
            items={FINANCE_TABS.map((tab) => ({
              id: tab.id,
              label: tab.label,
              badge: tab.id === 'finance' ? financeCatalogItems.length : financeMineItems.length,
            }))}
            activeId={activeTab}
            onChange={(next) => setActiveTab(next as FinanceTab)}
          />
        </div>

        {activeTab === 'finance' ? (
          <>
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
                  icon={Sparkles}
                  label="系统预置"
                  value={String(systemPresetItems.length)}
                  note={`平台 ${platformPresetCount} / OEM ${oemPresetCount}`}
                  className="px-2 py-1"
                />
                <SummaryMetricItem
                  tone="neutral"
                  icon={ShieldCheck}
                  label="我的MCP"
                  value={String(financeMineItems.length)}
                  note="已安装的财经类 MCP 会自动出现在我的MCP"
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

            <div className="mt-3">
              <SurfacePanel className="rounded-[20px] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                      秀肌肉筛选区
                    </div>
                    <div className="mt-1 text-[12px] text-[var(--text-secondary)]">
                      {activeFilterCount > 0 ? `当前已激活 ${activeFilterCount} 个过滤条件` : '默认收起，按需展开市场与状态筛选'}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    leadingIcon={filtersExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    onClick={() => setFiltersExpanded((current) => !current)}
                  >
                    {filtersExpanded ? '收起筛选' : '展开筛选'}
                  </Button>
                </div>

                {filtersExpanded ? (
                  <div className="mt-3 flex flex-col gap-3">
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
                  </div>
                ) : null}
              </SurfacePanel>
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
                  <CapabilityCard key={`${capability.category}-${capability.title}`} capability={capability} />
                ))}
              </div>
            )}

            <div className="mt-8 space-y-8 border-t border-[var(--border-default)] pt-8">
              <FinanceStoreSection
                title="系统预置"
                description="这里展示已经由平台级或 OEM 级预置接入的财经 MCP，卡片上会直接区分来源。"
                icon={<ShieldCheck className="h-5 w-5" />}
                items={systemPresetItems}
                loading={loading}
                emptyTitle="当前没有系统预置的财经 MCP"
                emptyDescription="如需展示，请在平台或 OEM 绑定层补充财经 MCP 预置。"
                busyKey={busyKey}
                onDetail={handleOpenDetail}
                onInstall={handleInstall}
              />

              <FinanceStoreSection
                title="未安装"
                description="这里展示云端财经 MCP 库里存在、但当前既没有被系统预置，也还没被你安装的部分。"
                icon={<Sparkles className="h-5 w-5" />}
                items={availableFinanceItems}
                loading={loading}
                emptyTitle="没有待安装的财经 MCP"
                emptyDescription="当前财经类云 MCP 要么已经被系统预置，要么已经进入你的我的MCP。"
                busyKey={busyKey}
                onDetail={handleOpenDetail}
                onInstall={handleInstall}
              />

              {error ? (
                <EmptyStatePanel
                  compact
                  title="财经 MCP 目录操作失败"
                  description={error}
                  action={
                    <Button variant="secondary" size="sm" leadingIcon={<RefreshCw className="h-4 w-4" />} onClick={() => void loadData()}>
                      重试加载
                    </Button>
                  }
                />
              ) : null}
            </div>
          </>
        ) : (
          <div className="space-y-5 pb-12 pt-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[280px] flex-1 xl:max-w-[420px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  value={mineQuery}
                  onChange={(event) => setMineQuery(event.target.value)}
                  placeholder="搜索我的财经MCP"
                  className="w-full rounded-[15px] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-2.5 pl-10 text-[14px] text-[var(--text-primary)] outline-none transition-all placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:ring-4 dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(255,255,255,0.03)]"
                  style={{['--tw-ring-color' as string]: 'rgba(201,169,97,0.14)'}}
                />
              </div>
              <Button variant="ghost" size="sm" onClick={() => void loadData()}>
                刷新
              </Button>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {MINE_STATUS_FILTERS.map((filter) => (
                  <FilterPill key={filter} active={mineStatus === filter} onClick={() => setMineStatus(filter)} className="rounded-full px-3 py-1.5 text-[14px]">
                    {filter}
                  </FilterPill>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {mineSourceFilters.map((filter) => (
                  <FilterPill key={filter} active={mineSource === filter} onClick={() => setMineSource(filter)} className="rounded-full px-3 py-1.5 text-[14px]">
                    {filter}
                  </FilterPill>
                ))}
              </div>
            </div>

            {error ? (
              <EmptyStatePanel
                title="我的财经MCP加载失败"
                description={error}
                action={
                  <Button variant="secondary" size="sm" leadingIcon={<RefreshCw className="h-4 w-4" />} onClick={() => void loadData()}>
                    重试加载
                  </Button>
                }
              />
            ) : loading ? (
              <McpLoadingGrid />
            ) : financeMineItems.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 2xl:grid-cols-3">
                {financeMineItems.map((item) => (
                  <MineCard
                    key={item.mcpKey}
                    item={item}
                    busy={busyKey === item.mcpKey}
                    onToggle={handleToggle}
                    onRemove={handleRemove}
                    onDetail={handleOpenDetail}
                    onInstall={handleInstall}
                  />
                ))}
              </div>
            ) : (
              <EmptyStatePanel
                compact
                title="还没有已安装的财经 MCP"
                description="系统预置和你自己安装的财经 MCP，都会出现在这里。"
              />
            )}
          </div>
        )}
      </PageContent>

      <McpDetailSheet
        item={detailItem}
        open={detailOpen}
        busy={busyKey === detailItem?.mcpKey}
        onClose={() => setDetailOpen(false)}
        onInstall={handleInstall}
        onRemove={handleRemove}
      />
      <CustomMcpModal
        open={customModalOpen}
        draft={DEFAULT_CUSTOM_MCP_DRAFT}
        saving={customSaving}
        onClose={() => {
          if (!customSaving) {
            setCustomModalOpen(false);
          }
        }}
        onSubmit={async (payload) => {
          if (!authenticated || !accessToken) {
            onRequestAuth('login', 'account');
            throw new Error('请先登录后再添加自定义 MCP');
          }
          setCustomSaving(true);
          setError(null);
          try {
            await saveCustomMcp({
              client,
              accessToken,
              mcpKey: payload.mcpKey,
              name: payload.name,
              description: payload.description,
              transport: payload.transport,
              config: payload.config,
              metadata: {
                category: 'finance',
                categories: ['财经', 'finance'],
                tags: ['财经', '金融', 'finance'],
                source_label: '自定义MCP',
                surface: 'finance-mcp',
              },
              secretValues: payload.secretValues,
            });
            await revalidateBrandRuntimeConfig().catch(() => undefined);
            setCustomModalOpen(false);
            await loadData();
          } catch (customError) {
            setError(customError instanceof Error ? customError.message : '保存自定义 MCP 失败');
            throw customError;
          } finally {
            setCustomSaving(false);
          }
        }}
      />
      <ExtensionInstallConfigModal
        open={setupOpen}
        title={setupItem ? `${setupMode === 'install' ? '安装' : '配置'} ${setupItem.name}` : '安装配置'}
        description={
          setupLoading
            ? '正在读取已保存配置…'
            : setupItem?.setupSchema
              ? '这个 MCP 依赖外部 API Key 或参数。补齐后再安装，后续重新配置不会影响安装记录。'
              : undefined
        }
        schema={setupItem?.setupSchema || null}
        initialConfig={setupInitialConfig}
        saving={setupLoading}
        submitLabel={setupMode === 'install' ? '保存并安装' : '保存配置'}
        onClose={() => {
          if (setupLoading) return;
          setSetupOpen(false);
          setSetupItem(null);
          setSetupInitialConfig(null);
        }}
        onSubmit={handleSetupSubmit}
      />
    </PageSurface>
  );
}
