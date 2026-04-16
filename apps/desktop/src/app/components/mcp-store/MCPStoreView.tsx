import { useEffect, useMemo, useState } from 'react';
import type { IClawClient } from '@iclaw/sdk';
import {
  Activity,
  Blocks,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Database,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { CustomMcpModal, DEFAULT_CUSTOM_MCP_DRAFT } from '@/app/components/mcp-store/CustomMcpModal';
import { EmptyStatePanel } from '@/app/components/ui/EmptyStatePanel';
import { FilterPill } from '@/app/components/ui/FilterPill';
import { MetricCard } from '@/app/components/ui/MetricCard';
import { PageContent, PageHeader, PageSurface } from '@/app/components/ui/PageLayout';
import { SegmentedTabs } from '@/app/components/ui/SegmentedTabs';
import { cn } from '@/app/lib/cn';
import {
  LibraryCard,
  McpDetailSheet,
  McpLoadingGrid,
  MineCard,
  readMcpMetadataString,
} from '@/app/components/mcp-store/McpStoreShared';
import {
  type McpStoreItem,
  installMcpFromStore,
  loadMcpInstallConfig,
  loadMcpStoreCatalog,
  removeCustomMcp,
  removeMcpFromLibrary,
  saveMcpInstallConfig,
  saveCustomMcp,
  updateCustomMcpEnabledState,
  updateMcpEnabledState,
} from '@/app/lib/mcp-store';
import type { ExtensionInstallConfigSnapshot } from '@/app/lib/extension-setup';
import { ExtensionInstallConfigModal } from '@/app/components/extensions/ExtensionInstallConfigModal';

const STORE_TABS = [
  { id: 'library', label: 'MCP库' },
  { id: 'mine', label: '我的MCP' },
] as const;

const MINE_STATUS_FILTERS = ['全部', '已启用', '未启用'] as const;
const COLLAPSED_CATEGORY_FILTER_COUNT = 10;
const INPUT_CLASS =
  'w-full rounded-[15px] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-2.5 text-[14px] text-[var(--text-primary)] outline-none transition-all placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:ring-4 dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(255,255,255,0.03)]';

type StoreTab = (typeof STORE_TABS)[number]['id'];

export function MCPStoreView({
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
  const [activeTab, setActiveTab] = useState<StoreTab>('library');
  const [items, setItems] = useState<McpStoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('全部');
  const [protocolFilter, setProtocolFilter] = useState('全部协议');
  const [categoryFilter, setCategoryFilter] = useState('全部类目');
  const [categoryFiltersExpanded, setCategoryFiltersExpanded] = useState(false);
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

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const nextItems = await loadMcpStoreCatalog({ client, accessToken });
      setItems(nextItems);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'MCP 目录加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [accessToken, client]);

  const sourceFilters = useMemo(
    () => ['全部', ...Array.from(new Set(items.map((item) => item.sourceLabel)))],
    [items],
  );
  const protocolFilters = useMemo(
    () => ['全部协议', ...Array.from(new Set(items.map((item) => item.protocol)))],
    [items],
  );
  const categoryFilters = useMemo(
    () => ['全部类目', ...Array.from(new Set(items.flatMap((item) => item.categories)))],
    [items],
  );
  const visibleCategoryFilters = useMemo(() => {
    if (categoryFiltersExpanded || categoryFilters.length <= COLLAPSED_CATEGORY_FILTER_COUNT) {
      return categoryFilters;
    }
    const collapsed = categoryFilters.slice(0, COLLAPSED_CATEGORY_FILTER_COUNT);
    if (categoryFilter !== '全部类目' && !collapsed.includes(categoryFilter)) {
      return [...collapsed.slice(0, COLLAPSED_CATEGORY_FILTER_COUNT - 1), categoryFilter];
    }
    return collapsed;
  }, [categoryFilter, categoryFilters, categoryFiltersExpanded]);
  const mineSourceFilters = useMemo(
    () => ['全部来源', ...Array.from(new Set(items.filter((item) => item.installed).map((item) => item.sourceLabel)))],
    [items],
  );

  useEffect(() => {
    if (!sourceFilters.includes(sourceFilter)) {
      setSourceFilter('全部');
    }
  }, [sourceFilter, sourceFilters]);

  useEffect(() => {
    if (!protocolFilters.includes(protocolFilter)) {
      setProtocolFilter('全部协议');
    }
  }, [protocolFilter, protocolFilters]);

  useEffect(() => {
    if (!categoryFilters.includes(categoryFilter)) {
      setCategoryFilter('全部类目');
    }
  }, [categoryFilter, categoryFilters]);

  useEffect(() => {
    if (!mineSourceFilters.includes(mineSource)) {
      setMineSource('全部来源');
    }
  }, [mineSource, mineSourceFilters]);

  const filteredLibraryItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesQuery =
        !normalizedQuery ||
        item.name.toLowerCase().includes(normalizedQuery) ||
        item.description.toLowerCase().includes(normalizedQuery) ||
        item.mcpKey.toLowerCase().includes(normalizedQuery) ||
        (readMcpMetadataString(item, 'publisher') || '').toLowerCase().includes(normalizedQuery) ||
        item.categories.some((category) => category.toLowerCase().includes(normalizedQuery));
      const matchesSource = sourceFilter === '全部' || item.sourceLabel === sourceFilter;
      const matchesProtocol = protocolFilter === '全部协议' || item.protocol === protocolFilter;
      const matchesCategory = categoryFilter === '全部类目' || item.categories.includes(categoryFilter);
      return matchesQuery && matchesSource && matchesProtocol && matchesCategory;
    });
  }, [categoryFilter, items, protocolFilter, query, sourceFilter]);

  const mineItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items.filter((item) => {
      if (!item.installed) {
        return false;
      }
      const matchesQuery =
        !normalizedQuery ||
        item.name.toLowerCase().includes(normalizedQuery) ||
        item.description.toLowerCase().includes(normalizedQuery) ||
        (readMcpMetadataString(item, 'publisher') || '').toLowerCase().includes(normalizedQuery) ||
        item.categories.some((category) => category.toLowerCase().includes(normalizedQuery));
      const matchesStatus =
        mineStatus === '全部' ||
        (mineStatus === '已启用' && item.enabled) ||
        (mineStatus === '未启用' && !item.enabled);
      const matchesSource = mineSource === '全部来源' || item.sourceLabel === mineSource;
      return matchesQuery && matchesStatus && matchesSource;
    });
  }, [items, mineSource, mineStatus, query]);

  const metrics = useMemo(() => {
    const installed = items.filter((item) => item.installed);
    const bundled = items.filter((item) => item.installState === 'bundled');
    const cloud = items.filter((item) => item.source === 'cloud');
    return {
      total: items.length,
      bundled: bundled.length,
      cloud: cloud.length,
      installed: installed.length,
      enabled: installed.filter((item) => item.enabled).length,
      protocols: new Set(items.map((item) => item.protocol)).size,
    };
  }, [items]);

  const detailItem = useMemo(
    () => items.find((item) => item.mcpKey === detailKey) || null,
    [detailKey, items],
  );

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
        await updateCustomMcpEnabledState({ client, accessToken, item, enabled });
      } else {
        await updateMcpEnabledState({ client, accessToken, mcpKey: item.mcpKey, enabled });
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
        await removeCustomMcp({ client, accessToken, mcpKey: item.mcpKey });
      } else {
        await removeMcpFromLibrary({ client, accessToken, mcpKey: item.mcpKey });
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
      // The specific error is already surfaced in component state.
    } finally {
      setSetupLoading(false);
    }
  };

  return (
    <PageSurface as="div">
      <PageContent className="max-w-[1540px] px-8 py-8">
        <PageHeader
          title={title}
          description="统一展示 OEM 预置、云端目录和用户安装态。cloud MCP 目录由服务端管理，桌面端只消费目录与状态，不在本地代码里维护清单。"
          actions={
            <Button variant="primary" size="md" leadingIcon={<Plus className="h-4 w-4" />} onClick={() => setCustomModalOpen(true)}>
              添加MCP
            </Button>
          }
        />

        <div className="mt-5 grid grid-cols-3 gap-3 2xl:grid-cols-6">
          <MetricCard label="总目录" value={metrics.total} icon={<Blocks className="h-4 w-4" />} className="min-w-0 py-3" />
          <MetricCard label="系统预置" value={metrics.bundled} icon={<CheckCircle2 className="h-4 w-4" />} className="min-w-0 py-3" />
          <MetricCard label="云端目录" value={metrics.cloud} icon={<Sparkles className="h-4 w-4" />} className="min-w-0 py-3" />
          <MetricCard label="已安装" value={metrics.installed} icon={<Activity className="h-4 w-4" />} className="min-w-0 py-3" />
          <MetricCard label="已启用" value={metrics.enabled} icon={<ShieldCheck className="h-4 w-4" />} className="min-w-0 py-3" />
          <MetricCard label="协议数" value={metrics.protocols} icon={<Database className="h-4 w-4" />} className="min-w-0 py-3" />
        </div>

        <div className="mt-6">
          <SegmentedTabs
            items={STORE_TABS.map((tab) => ({
              id: tab.id,
              label: tab.label,
              badge: tab.id === 'library' ? metrics.total : metrics.installed,
            }))}
            activeId={activeTab}
            onChange={setActiveTab}
          />
        </div>

        <div className="space-y-5 pb-12 pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[280px] flex-1 xl:max-w-[420px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={activeTab === 'library' ? '搜索 MCP 名称、能力、来源' : '搜索我的 MCP'}
                className={cn(INPUT_CLASS, 'pl-10')}
                style={{ ['--tw-ring-color' as string]: 'rgba(201,169,97,0.14)' }}
              />
            </div>
            <Button variant="ghost" size="sm" onClick={() => void loadData()}>
              刷新
            </Button>
          </div>

          {activeTab === 'library' ? (
            <>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {sourceFilters.map((filter) => (
                    <FilterPill key={filter} active={sourceFilter === filter} onClick={() => setSourceFilter(filter)} className="rounded-full px-3 py-1.5 text-[14px]">
                      {filter}
                    </FilterPill>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {protocolFilters.map((filter) => (
                    <FilterPill key={filter} active={protocolFilter === filter} onClick={() => setProtocolFilter(filter)} className="rounded-full px-3 py-1.5 text-[14px]">
                      {filter}
                    </FilterPill>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {visibleCategoryFilters.map((filter) => (
                    <FilterPill key={filter} active={categoryFilter === filter} onClick={() => setCategoryFilter(filter)} className="rounded-full px-3 py-1.5 text-[14px]">
                      {filter}
                    </FilterPill>
                  ))}
                  {categoryFilters.length > COLLAPSED_CATEGORY_FILTER_COUNT ? (
                    <button
                      type="button"
                      onClick={() => setCategoryFiltersExpanded((current) => !current)}
                      className="inline-flex items-center gap-1 rounded-full border border-[var(--border-default)] px-3 py-1.5 text-[13px] text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
                    >
                      {categoryFiltersExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      {categoryFiltersExpanded ? '收起类目' : `展开类目 +${categoryFilters.length - visibleCategoryFilters.length}`}
                    </button>
                  ) : null}
                </div>
              </div>

              {error ? (
                <EmptyStatePanel
                  title="目录加载失败"
                  description={error}
                  action={
                    <Button variant="secondary" size="sm" leadingIcon={<RefreshCw className="h-4 w-4" />} onClick={() => void loadData()}>
                      重试加载
                    </Button>
                  }
                />
              ) : loading ? (
                <McpLoadingGrid />
              ) : filteredLibraryItems.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 2xl:grid-cols-3">
                  {filteredLibraryItems.map((item) => (
                    <LibraryCard key={item.mcpKey} item={item} busy={busyKey === item.mcpKey} onDetail={handleOpenDetail} onInstall={handleInstall} />
                  ))}
                </div>
              ) : (
                <EmptyStatePanel compact title="没有匹配的 MCP" description="当前筛选条件下没有结果，建议放宽来源、协议或能力标签。" />
              )}
            </>
          ) : (
            <>
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
                  title="我的MCP加载失败"
                  description={error}
                  action={
                    <Button variant="secondary" size="sm" leadingIcon={<RefreshCw className="h-4 w-4" />} onClick={() => void loadData()}>
                      重试加载
                    </Button>
                  }
                />
              ) : loading ? (
                <McpLoadingGrid />
              ) : mineItems.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 2xl:grid-cols-3">
                  {mineItems.map((item) => (
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
                <EmptyStatePanel compact title="还没有已安装的 MCP" description="可以先从 MCP 商店安装 cloud MCP，或者使用当前 OEM 预置连接。" />
              )}
            </>
          )}
        </div>
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
            return;
          }
          setCustomSaving(true);
          try {
            await saveCustomMcp({
              client,
              accessToken,
              mcpKey: payload.mcpKey,
              name: payload.name,
              description: payload.description,
              transport: payload.transport,
              config: payload.config,
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
