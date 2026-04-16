import {
  Activity,
  Blocks,
  Database,
  FileCode2,
  FolderOpen,
  Globe2,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wrench,
} from 'lucide-react';
import {Button} from '@/app/components/ui/Button';
import {Chip} from '@/app/components/ui/Chip';
import {InfoTile} from '@/app/components/ui/InfoTile';
import {PressableCard} from '@/app/components/ui/PressableCard';
import {SideDetailSheet} from '@/app/components/ui/SideDetailSheet';
import {Switch} from '@/app/components/ui/Switch';
import {cn} from '@/app/lib/cn';
import type {McpStoreIconKey, McpStoreItem} from '@/app/lib/mcp-store';

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

export function resolveMcpStoreIcon(iconKey: McpStoreIconKey) {
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

export function readMcpMetadataString(item: McpStoreItem, key: string): string | null {
  const value = item.metadata[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function resolveMcpTierLabel(item: McpStoreItem): string {
  const tier = (readMcpMetadataString(item, 'tier') || '').toLowerCase();
  if (tier === 'p0') return 'P0 首发';
  if (tier === 'p1') return 'P1 扩展';
  if (tier === 'p2') return 'P2 储备';
  return '长尾目录';
}

export function InstallBadge({item}: {item: McpStoreItem}) {
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

export function ProtocolBadge({protocol}: {protocol: McpStoreItem['protocol']}) {
  const className =
    protocol === 'HTTP'
      ? 'border-[rgba(168,140,93,0.22)] bg-[rgba(168,140,93,0.12)] text-[rgb(155,112,39)]'
      : protocol === 'SSE'
        ? 'border-[rgba(59,130,246,0.18)] bg-[rgba(59,130,246,0.10)] text-[rgb(37,99,235)] dark:text-[#bfd6ff]'
        : 'border-[var(--border-default)] bg-[var(--bg-hover)] text-[var(--text-secondary)]';
  return <span className={cn('rounded-md border px-2 py-0.5 text-[11px]', className)}>{protocol}</span>;
}

export function SourceBadge({item}: {item: McpStoreItem}) {
  if (item.bundledBy === 'platform') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-[rgba(168,140,93,0.24)] bg-[rgba(168,140,93,0.12)] px-2 py-0.5 text-[11px] text-[rgb(155,112,39)]">
        <Sparkles className="h-3 w-3" />
        平台预置
      </span>
    );
  }
  if (item.bundledBy === 'oem') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-[rgba(74,107,138,0.20)] bg-[rgba(74,107,138,0.10)] px-2 py-0.5 text-[11px] text-[#4A6B8A] dark:text-[#b7d0e5]">
        <Blocks className="h-3 w-3" />
        OEM预置
      </span>
    );
  }

  const className =
    item.sourceLabel === '官方模板'
      ? 'border-[rgba(74,107,138,0.18)] bg-[rgba(74,107,138,0.10)] text-[#4A6B8A] dark:text-[#b7d0e5]'
      : item.sourceLabel === '社区推荐'
        ? 'border-[rgba(90,117,102,0.18)] bg-[rgba(90,117,102,0.10)] text-[#5A7566] dark:text-[#c8ded0]'
        : item.sourceLabel === '自定义MCP'
          ? 'border-[rgba(124,58,237,0.18)] bg-[rgba(124,58,237,0.10)] text-[rgb(109,40,217)] dark:text-[#d8c2ff]'
          : 'border-[var(--border-default)] bg-[var(--bg-hover)] text-[var(--text-secondary)]';
  return <span className={cn('rounded-md border px-2 py-0.5 text-[11px]', className)}>{item.sourceLabel}</span>;
}

export function LibraryCard({
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
  const Icon = resolveMcpStoreIcon(item.iconKey);
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
          <SourceBadge item={item} />
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

export function MineCard({
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
  const Icon = resolveMcpStoreIcon(item.iconKey);

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
              <SourceBadge item={item} />
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
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              leadingIcon={busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              onClick={() => onRemove(item)}
            >
              移除
            </Button>
          ) : null}
        </div>
      </div>
    </PressableCard>
  );
}

export function McpDetailSheet({
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

  const Icon = resolveMcpStoreIcon(item.iconKey);

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
              <SourceBadge item={item} />
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
          <InfoTile label="发布方" value={readMcpMetadataString(item, 'publisher') || '平台目录'} />
          <InfoTile label="平台分层" value={resolveMcpTierLabel(item)} />
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

export function McpLoadingGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 2xl:grid-cols-3">
      {Array.from({length: 6}).map((_, index) => (
        <div key={index} className="h-[220px] animate-pulse rounded-[22px] border border-[var(--border-default)] bg-[var(--bg-elevated)]" />
      ))}
    </div>
  );
}

export function MineEmptyCopy() {
  return '可以先从 MCP 商店安装 cloud MCP，或者使用当前 OEM 预置连接。';
}
