import { useEffect, useMemo, useState } from 'react';
import type { IClawClient } from '@iclaw/sdk';
import {
  Activity,
  Blocks,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Database,
  FileCode2,
  FolderOpen,
  Globe2,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  Wrench,
  X,
} from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { Chip } from '@/app/components/ui/Chip';
import { EmptyStatePanel } from '@/app/components/ui/EmptyStatePanel';
import { FilterPill } from '@/app/components/ui/FilterPill';
import { InfoTile } from '@/app/components/ui/InfoTile';
import { MetricCard } from '@/app/components/ui/MetricCard';
import { PageContent, PageHeader, PageSurface } from '@/app/components/ui/PageLayout';
import { PressableCard } from '@/app/components/ui/PressableCard';
import { SideDetailSheet } from '@/app/components/ui/SideDetailSheet';
import { Switch } from '@/app/components/ui/Switch';
import { cn } from '@/app/lib/cn';
import {
  type McpStoreIconKey,
  type McpStoreItem,
  installMcpFromStore,
  loadMcpInstallConfig,
  loadMcpStoreCatalog,
  removeMcpFromLibrary,
  saveMcpInstallConfig,
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

function iconToneClass(tone: McpStoreItem['tone']): string {
  switch (tone) {
    case 'brand':
      return 'bg-[rgba(168,140,93,0.12)] text-[var(--brand-primary)]';
    case 'success':
      return 'bg-[rgba(74,107,90,0.12)] text-[var(--state-success)]';
    case 'info':
      return 'bg-[rgba(59,130,246,0.12)] text-[rgb(37,99,235)] dark:text-[#bfd6ff]';
    case 'warning':
      return 'bg-[rgba(196,152,80,0.12)] text-[var(--state-warn)]';
    default:
      return 'bg-[var(--bg-hover)] text-[var(--text-secondary)]';
  }
}

function resolveIcon(iconKey: McpStoreIconKey) {
  switch (iconKey) {
    case 'browser':
      return Globe2;
    case 'search':
      return Sparkles;
    case 'database':
      return Database;
    case 'file':
      return FolderOpen;
    case 'finance':
      return Activity;
    case 'dev':
      return FileCode2;
    default:
      return Wrench;
  }
}

function InstallBadge({ item }: {item: McpStoreItem}) {
  if (item.installState === 'bundled') {
    return (
      <span className="rounded-md border border-[rgba(34,197,94,0.18)] bg-[rgba(34,197,94,0.10)] px-2 py-0.5 text-[11px] text-[rgb(21,128,61)] dark:border-[rgba(111,221,149,0.20)] dark:bg-[rgba(34,197,94,0.18)] dark:text-[#c7f9d7]">
        默认已安装
      </span>
    );
  }
  if (item.installed) {
    return (
      <span className="rounded-md border border-[rgba(34,197,94,0.18)] bg-[rgba(34,197,94,0.10)] px-2 py-0.5 text-[11px] text-[rgb(21,128,61)] dark:border-[rgba(111,221,149,0.20)] dark:bg-[rgba(34,197,94,0.18)] dark:text-[#c7f9d7]">
        已安装
      </span>
    );
  }
  return (
    <span className="rounded-md border border-[var(--border-default)] bg-transparent px-2 py-0.5 text-[11px] text-[var(--text-muted)]">
      未安装
    </span>
  );
}

function ProtocolBadge({ protocol }: {protocol: McpStoreItem['protocol']}) {
  const className =
    protocol === 'HTTP'
      ? 'border-[rgba(168,140,93,0.22)] bg-[rgba(168,140,93,0.12)] text-[rgb(155,112,39)]'
      : protocol === 'SSE'
        ? 'border-[rgba(59,130,246,0.18)] bg-[rgba(59,130,246,0.10)] text-[rgb(37,99,235)] dark:text-[#bfd6ff]'
        : 'border-[var(--border-default)] bg-[var(--bg-hover)] text-[var(--text-secondary)]';
  return <span className={cn('rounded-md border px-2 py-0.5 text-[11px]', className)}>{protocol}</span>;
}

function SourceBadge({ label }: {label: string}) {
  const className =
    label === 'OEM预置'
      ? 'border-[rgba(201,169,97,0.22)] bg-[rgba(201,169,97,0.12)] text-[rgb(155,112,39)]'
      : label === '官方模板'
        ? 'border-[rgba(74,107,138,0.18)] bg-[rgba(74,107,138,0.10)] text-[#4A6B8A] dark:text-[#b7d0e5]'
        : label === '社区推荐'
          ? 'border-[rgba(90,117,102,0.18)] bg-[rgba(90,117,102,0.10)] text-[#5A7566] dark:text-[#c8ded0]'
          : 'border-[var(--border-default)] bg-[var(--bg-hover)] text-[var(--text-secondary)]';
  return <span className={cn('rounded-md border px-2 py-0.5 text-[11px]', className)}>{label}</span>;
}

function readMetadataString(item: McpStoreItem, key: string): string | null {
  const value = item.metadata[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function resolveTierLabel(item: McpStoreItem): string {
  const tier = (readMetadataString(item, 'tier') || '').toLowerCase();
  if (tier === 'p0') return 'P0 首发';
  if (tier === 'p1') return 'P1 扩展';
  if (tier === 'p2') return 'P2 储备';
  return '长尾目录';
}

function LibraryCard({
  item,
  busy,
  onDetail,
  onInstall,
}: {
  item: McpStoreItem;
  busy: boolean;
  onDetail: (item: McpStoreItem) => void;
  onInstall: (item: McpStoreItem) => void;
}) {
  const Icon = resolveIcon(item.iconKey);
  const installLabel =
    item.installState === 'bundled'
      ? '默认已安装'
      : item.installed
        ? item.setupSchema && item.setupStatus !== 'configured'
          ? '配置'
          : '已安装'
        : item.setupSchema
          ? '安装并配置'
          : '安装';

  return (
    <PressableCard as="article" interactive className="rounded-[22px] p-5" onClick={() => onDetail(item)}>
      <div className="flex h-full flex-col gap-4">
        <div className="flex items-start gap-4">
          <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]', iconToneClass(item.tone))}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[17px] font-semibold tracking-[-0.03em] text-[var(--text-primary)]">{item.name}</h3>
              <InstallBadge item={item} />
            </div>
            <p className="mt-1.5 line-clamp-2 text-[13px] leading-6 text-[var(--text-secondary)]">{item.description}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <SourceBadge label={item.sourceLabel} />
          <ProtocolBadge protocol={item.protocol} />
          {item.requiresApiKey ? <Chip tone="warning">需配置密钥</Chip> : <Chip tone="outline">免密钥</Chip>}
          {item.setupSchema && item.setupStatus !== 'configured' ? <Chip tone="warning">需配置</Chip> : null}
        </div>

        {item.categories.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {item.categories.slice(0, 4).map((category) => (
              <Chip key={category} tone="outline">
                {category}
              </Chip>
            ))}
          </div>
        ) : null}

        <div className="mt-auto flex items-center justify-between border-t border-[var(--border-default)] pt-3.5">
          <div className="text-[12px] text-[var(--text-secondary)]">最近更新：{item.lastUpdated}</div>
          <div className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
            <Button variant="ghost" size="sm" onClick={() => onDetail(item)}>
              详情
            </Button>
            <Button
              variant={item.installed ? 'success' : 'primary'}
              size="sm"
              disabled={busy || item.installState === 'bundled'}
              onClick={() => onInstall(item)}
            >
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : installLabel}
            </Button>
          </div>
        </div>
      </div>
    </PressableCard>
  );
}

function MineCard({
  item,
  busy,
  onToggle,
  onRemove,
  onDetail,
  onInstall,
}: {
  item: McpStoreItem;
  busy: boolean;
  onToggle: (item: McpStoreItem, enabled: boolean) => void;
  onRemove: (item: McpStoreItem) => void;
  onDetail: (item: McpStoreItem) => void;
  onInstall: (item: McpStoreItem) => void;
}) {
  const Icon = resolveIcon(item.iconKey);

  return (
    <PressableCard as="article" interactive className="rounded-[22px] p-5" onClick={() => onDetail(item)}>
      <div className="flex h-full flex-col gap-4">
        <div className="flex items-start gap-4">
          <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]', iconToneClass(item.tone))}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-[17px] font-semibold tracking-[-0.03em] text-[var(--text-primary)]">{item.name}</div>
              <SourceBadge label={item.sourceLabel} />
            </div>
            <p className="mt-1.5 line-clamp-3 text-[13px] leading-6 text-[var(--text-secondary)]">{item.description}</p>
          </div>
          <div className="shrink-0" onClick={(event) => event.stopPropagation()}>
            {item.canToggle ? (
              <div className="flex items-center gap-3">
                <div className="text-[12px] text-[var(--text-secondary)]">{item.enabled ? '已启用' : '已停用'}</div>
                <Switch checked={item.enabled} onChange={(checked) => onToggle(item, checked)} disabled={busy} />
              </div>
            ) : (
              <span className="rounded-md border border-[rgba(34,197,94,0.18)] bg-[rgba(34,197,94,0.10)] px-2 py-0.5 text-[11px] text-[rgb(21,128,61)] dark:border-[rgba(111,221,149,0.20)] dark:bg-[rgba(34,197,94,0.18)] dark:text-[#c7f9d7]">
                默认预置
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <ProtocolBadge protocol={item.protocol} />
          {item.requiresApiKey ? <Chip tone="warning">需配置密钥</Chip> : <Chip tone="outline">免密钥</Chip>}
          <InstallBadge item={item} />
          {item.setupSchema && item.setupStatus !== 'configured' ? <Chip tone="warning">需配置</Chip> : null}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <InfoTile label="接入来源" value={item.sourceLabel} />
          <InfoTile label="当前状态" value={item.enabled ? '启用中' : '已停用'} />
          <InfoTile label="配置状态" value={item.setupSchema ? (item.setupStatus === 'configured' ? '已配置' : '待配置') : '无需配置'} />
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-[var(--border-default)] pt-3.5" onClick={(event) => event.stopPropagation()}>
          <Button variant="ghost" size="sm" onClick={() => onDetail(item)}>
            详情
          </Button>
          {item.setupSchema ? (
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => onInstall(item)}>
              {item.setupStatus === 'configured' ? '重设配置' : '配置'}
            </Button>
          ) : null}
          {item.userInstalled ? (
            <Button variant="ghost" size="sm" disabled={busy} leadingIcon={busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} onClick={() => onRemove(item)}>
              移除
            </Button>
          ) : null}
        </div>
      </div>
    </PressableCard>
  );
}

function DetailSheet({
  item,
  open,
  busy,
  onClose,
  onInstall,
  onRemove,
}: {
  item: McpStoreItem | null;
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onInstall: (item: McpStoreItem) => void;
  onRemove: (item: McpStoreItem) => void;
}) {
  if (!open || !item) {
    return null;
  }

  const Icon = resolveIcon(item.iconKey);

  return (
    <SideDetailSheet
      open={open}
      onClose={onClose}
      eyebrow="MCP详情"
      title={item.name}
      header={
        <div className="flex items-start gap-4">
          <div className={cn('flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px]', iconToneClass(item.tone))}>
            <Icon className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="mt-2 flex flex-wrap gap-2">
              <SourceBadge label={item.sourceLabel} />
              <ProtocolBadge protocol={item.protocol} />
              <InstallBadge item={item} />
              {item.setupSchema && item.setupStatus !== 'configured' ? <Chip tone="warning">需配置</Chip> : null}
            </div>
            <p className="mt-3 break-words text-[13px] leading-6 text-[var(--text-secondary)] [overflow-wrap:anywhere]">{item.description}</p>
          </div>
        </div>
      }
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" size="md" block onClick={onClose}>
            关闭
          </Button>
          {item.userInstalled ? (
            <>
              {item.setupSchema ? (
                <Button variant="primary" size="md" block disabled={busy} onClick={() => onInstall(item)}>
                  {busy ? '处理中…' : item.setupStatus === 'configured' ? '重设配置' : '补充配置'}
                </Button>
              ) : null}
              <Button variant="danger" size="md" block disabled={busy} onClick={() => onRemove(item)}>
                {busy ? '处理中…' : '移除'}
              </Button>
            </>
          ) : (
            <Button variant="primary" size="md" block disabled={busy || item.installState === 'bundled'} onClick={() => onInstall(item)}>
              {busy ? '处理中…' : item.installed ? '补充配置' : item.setupSchema ? '安装并配置' : '安装到我的MCP'}
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <InfoTile label="协议类型" value={item.protocol} />
          <InfoTile label="最近更新" value={item.lastUpdated} />
          <InfoTile label="发布方" value={readMetadataString(item, 'publisher') || '平台目录'} />
          <InfoTile label="平台分层" value={resolveTierLabel(item)} />
          <InfoTile label="配置入口" value={item.setupSchema ? (item.setupStatus === 'configured' ? '已配置' : '待配置') : item.configSummary || '待配置'} />
          <InfoTile label="密钥要求" value={item.requiresApiKey ? '需要配置' : '无需配置'} tone={item.requiresApiKey ? 'warning' : 'success'} />
        </div>

        {item.categories.length > 0 ? (
          <div className="rounded-[20px] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-5">
            <div className="mb-3 flex items-center gap-2 text-[14px] font-medium text-[var(--text-primary)]">
              <Blocks className="h-4 w-4" />
              能力标签
            </div>
            <div className="flex flex-wrap gap-2">
              {item.categories.map((category) => (
                <Chip key={category} tone="outline">
                  {category}
                </Chip>
              ))}
            </div>
          </div>
        ) : null}

        <div className="rounded-[20px] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-5">
          <div className="mb-3 flex items-center gap-2 text-[14px] font-medium text-[var(--text-primary)]">
            <ShieldCheck className="h-4 w-4" />
            安全提示
          </div>
          <div className="space-y-3">
            <InfoTile
              label="目录来源"
              value={item.defaultInstalled ? '当前 app 默认绑定，视为已安装' : '来自 control-plane 云端目录'}
              description="默认安装态由后端按 app 绑定中心化控制，前端只负责展示。"
            />
            <InfoTile
              label="后续出口"
              value="已预留构建/启动时同步到本地运行时的链路"
              description="当前这一版先打通目录、安装态和用户库，不在本地代码里维护 cloud catalog。"
            />
          </div>
        </div>
      </div>
    </SideDetailSheet>
  );
}

function AddMcpSheet({ open, onClose }: {open: boolean; onClose: () => void}) {
  if (!open) {
    return null;
  }

  const options = [
    {
      title: '从商店安装',
      description: '优先从服务端管理的 MCP 目录安装，避免把 cloud catalog 固化在本地代码里。',
      icon: Sparkles,
    },
    {
      title: '手动配置',
      description: '后续支持用户像添加技能一样，自定义接入私有 MCP 或企业内网 MCP。',
      icon: Wrench,
    },
    {
      title: '导入配置',
      description: '为已有 JSON 配置迁移预留入口，后续可与“我的MCP”联动。',
      icon: Upload,
    },
  ] as const;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-[rgba(26,22,18,0.18)] backdrop-blur-[3px] dark:bg-[rgba(0,0,0,0.34)]" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-[560px] flex-col border-l border-[var(--border-default)] bg-[linear-gradient(180deg,rgba(252,251,248,0.98),rgba(244,240,233,0.96))] shadow-[0_32px_90px_rgba(26,22,18,0.18)] dark:border-l-[rgba(255,255,255,0.08)] dark:bg-[linear-gradient(180deg,rgba(25,23,21,0.98),rgba(17,16,15,0.96))] dark:shadow-[0_30px_90px_rgba(0,0,0,0.44)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-[var(--border-default)] px-6 py-[18px] dark:border-b-[rgba(255,255,255,0.08)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-white/72 px-3 py-1 text-[11px] text-[var(--text-secondary)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(255,255,255,0.04)]">
                添加MCP
              </div>
              <h2 className="mt-3.5 text-[22px] font-semibold tracking-[-0.03em] text-[var(--text-primary)]">预留用户自定义 MCP 能力</h2>
              <p className="mt-1.5 text-[13px] leading-6 text-[var(--text-secondary)]">
                这一版先把商店目录、用户库和预置安装态做实，手动添加入口保留在这里继续扩展。
              </p>
            </div>
            <Button variant="ghost" size="sm" className="rounded-full" onClick={onClose} leadingIcon={<X className="h-4 w-4" />}>
              关闭
            </Button>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {options.map((option) => {
            const Icon = option.icon;
            return (
              <PressableCard key={option.title} interactive className="rounded-[20px] p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[rgba(168,140,93,0.12)] text-[var(--brand-primary)]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[16px] font-semibold text-[var(--text-primary)]">{option.title}</div>
                    <p className="mt-1.5 text-[13px] leading-6 text-[var(--text-secondary)]">{option.description}</p>
                  </div>
                </div>
              </PressableCard>
            );
          })}
        </div>
      </aside>
    </div>
  );
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 2xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="h-[220px] animate-pulse rounded-[22px] border border-[var(--border-default)] bg-[var(--bg-elevated)]" />
      ))}
    </div>
  );
}

export function MCPStoreView({
  title,
  client,
  accessToken,
  authenticated,
  onRequestAuth,
}: {
  title: string;
  client: IClawClient;
  accessToken: string | null;
  authenticated: boolean;
  onRequestAuth: (mode?: 'login' | 'register', nextView?: 'account' | null) => void;
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
  const [addSheetOpen, setAddSheetOpen] = useState(false);
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
        (readMetadataString(item, 'publisher') || '').toLowerCase().includes(normalizedQuery) ||
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
        (readMetadataString(item, 'publisher') || '').toLowerCase().includes(normalizedQuery) ||
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
      await updateMcpEnabledState({ client, accessToken, mcpKey: item.mcpKey, enabled });
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
      await removeMcpFromLibrary({ client, accessToken, mcpKey: item.mcpKey });
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
            <>
              <Button variant="secondary" size="md" leadingIcon={<Upload className="h-4 w-4" />} onClick={() => setAddSheetOpen(true)}>
                导入配置
              </Button>
              <Button variant="primary" size="md" leadingIcon={<Plus className="h-4 w-4" />} onClick={() => setAddSheetOpen(true)}>
                添加MCP
              </Button>
            </>
          }
        />

        <div className="mt-5 grid grid-cols-3 gap-3 2xl:grid-cols-6">
          <MetricCard label="总目录" value={metrics.total} icon={<Blocks className="h-4 w-4" />} className="min-w-0 py-3" />
          <MetricCard label="OEM预置" value={metrics.bundled} icon={<CheckCircle2 className="h-4 w-4" />} className="min-w-0 py-3" />
          <MetricCard label="云端目录" value={metrics.cloud} icon={<Sparkles className="h-4 w-4" />} className="min-w-0 py-3" />
          <MetricCard label="已安装" value={metrics.installed} icon={<Activity className="h-4 w-4" />} className="min-w-0 py-3" />
          <MetricCard label="已启用" value={metrics.enabled} icon={<ShieldCheck className="h-4 w-4" />} className="min-w-0 py-3" />
          <MetricCard label="协议数" value={metrics.protocols} icon={<Database className="h-4 w-4" />} className="min-w-0 py-3" />
        </div>

        <div className="mt-6 border-b border-[var(--border-default)]">
          <div className="flex gap-2">
            {STORE_TABS.map((tab) => {
              const active = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'cursor-pointer border-b-2 px-6 py-3 text-[14px] font-medium transition-all',
                    active
                      ? 'border-[var(--brand-primary)] text-[var(--text-primary)]'
                      : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
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
                <LoadingGrid />
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
                <LoadingGrid />
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

      <DetailSheet
        item={detailItem}
        open={detailOpen}
        busy={busyKey === detailItem?.mcpKey}
        onClose={() => setDetailOpen(false)}
        onInstall={handleInstall}
        onRemove={handleRemove}
      />
      <AddMcpSheet open={addSheetOpen} onClose={() => setAddSheetOpen(false)} />
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
