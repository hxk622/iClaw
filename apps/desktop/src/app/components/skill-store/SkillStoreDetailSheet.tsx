import { AlertCircle, CalendarDays, CheckCircle2, Package, UserRound, X } from 'lucide-react';
import type { SkillStoreItem } from '@/app/lib/skill-store';
import { Button } from '@/app/components/ui/Button';
import { Chip } from '@/app/components/ui/Chip';
import { cn } from '@/app/lib/cn';
import { SkillGlyph, skillTagClassName } from './SkillStoreVisuals';

type StatusMeta = {
  label: string;
  tone: 'brand' | 'success' | 'danger' | 'outline';
  actionLabel: string;
  actionVariant: 'primary' | 'secondary' | 'success' | 'danger';
  disabled: boolean;
  note: string;
};

function resolveStatus(skill: SkillStoreItem, input: { actionLoading: boolean; installFailed: boolean }): StatusMeta {
  if (input.installFailed) {
    return {
      label: '安装失败',
      tone: 'danger',
      actionLabel: '重试安装',
      actionVariant: 'danger',
      disabled: false,
      note: '下载安装失败，请稍后重试。',
    };
  }

  if (input.actionLoading) {
    return {
      label: '安装中',
      tone: 'brand',
      actionLabel: '安装中…',
      actionVariant: 'primary',
      disabled: true,
      note: '正在将技能加入账号并同步到当前设备。',
    };
  }

  if (skill.source === 'bundled') {
    return {
      label: '默认已安装',
      tone: 'brand',
      actionLabel: '已内置',
      actionVariant: 'secondary',
      disabled: true,
      note: '这是系统预置技能，随应用一起提供。',
    };
  }

  if (skill.installed) {
    return {
      label: '已安装',
      tone: 'success',
      actionLabel: '已安装',
      actionVariant: 'success',
      disabled: true,
      note: skill.source === 'private' ? '这是你导入到账号的技能。' : '这个技能已经加入你的账号，可在当前设备使用。',
    };
  }

  return {
    label: '未安装',
    tone: 'outline',
    actionLabel: '安装技能',
    actionVariant: 'primary',
    disabled: skill.source !== 'cloud',
    note: skill.source === 'cloud' ? '安装后会加入“我的技能”，并由本地 runtime 接管恢复。' : '当前状态不可直接安装。',
  };
}

function metadataRows(skill: SkillStoreItem, publishedAtFormatter: (value?: string | null) => string) {
  return [
    {
      label: '最新版本',
      value: skill.latestRelease?.version || (skill.source === 'bundled' ? 'bundled' : '未发布'),
    },
    {
      label: '发布时间',
      value: publishedAtFormatter(skill.latestRelease?.published_at),
    },
    {
      label: '分类',
      value: skill.categoryLabel,
    },
    {
      label: '市场',
      value: skill.market,
    },
    {
      label: '发布者',
      value: skill.publisher,
    },
    {
      label: '来源',
      value: skill.sourceLabel,
    },
  ];
}

export function SkillStoreDetailSheet({
  skill,
  actionLoading,
  installFailed,
  onInstall,
  onClose,
  publishedAtFormatter,
}: {
  skill: SkillStoreItem | null;
  actionLoading: boolean;
  installFailed: boolean;
  onInstall: (skill: SkillStoreItem) => void;
  onClose: () => void;
  publishedAtFormatter?: (value?: string | null) => string;
}) {
  if (!skill) {
    return null;
  }

  const formatPublishedAt =
    publishedAtFormatter ||
    ((value?: string | null) => {
      if (!value) return '未发布';
      try {
        return new Date(value).toLocaleDateString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        });
      } catch {
        return value;
      }
    });

  const status = resolveStatus(skill, { actionLoading, installFailed });
  const rows = metadataRows(skill, formatPublishedAt);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-[rgba(12,18,28,0.16)] backdrop-blur-[3px] dark:bg-[rgba(0,0,0,0.34)]" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-[480px] flex-col border-l border-[var(--border-default)] bg-[var(--bg-card)] shadow-[0_24px_64px_rgba(15,23,42,0.14)] dark:bg-[var(--bg-page)] dark:shadow-[0_24px_72px_rgba(0,0,0,0.34)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border-default)] px-6 py-5">
          <h2 className="text-[17px] font-medium text-[var(--text-primary)]">技能详情</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[var(--text-secondary)] transition-all hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="mb-6 flex items-start gap-4">
            <SkillGlyph skill={skill} className="h-16 w-16 rounded-[20px]" iconClassName="h-7 w-7" />
            <div className="min-w-0 flex-1">
              <h3 className="text-[21px] font-medium leading-tight tracking-[-0.02em] text-[var(--text-primary)]">{skill.name}</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                <Chip tone={status.tone}>{status.label}</Chip>
                <Chip tone={skill.source === 'bundled' ? 'brand' : skill.source === 'private' ? 'success' : 'outline'}>
                  {skill.sourceLabel}
                </Chip>
                <Chip tone="outline">{skill.categoryLabel}</Chip>
              </div>
            </div>
          </div>

          <section className="mb-6">
            <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)]">技能介绍</div>
            <p className="text-[14px] leading-7 text-[var(--text-secondary)]">{skill.description}</p>
          </section>

          <section className="mb-6 rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[rgba(201,169,97,0.18)] bg-[rgba(201,169,97,0.12)] text-[rgb(155,112,39)] dark:border-[rgba(201,169,97,0.22)] dark:bg-[rgba(201,169,97,0.16)] dark:text-[#f1d59c]">
                {status.label === '安装失败' ? (
                  <AlertCircle className="h-4 w-4" />
                ) : status.label === '已安装' ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Package className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-[var(--text-primary)]">当前状态</div>
                <div className="mt-1 text-[13px] leading-6 text-[var(--text-secondary)]">{status.note}</div>
              </div>
            </div>
          </section>

          <section className="mb-6">
            <div className="mb-3 text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)]">元信息</div>
            <div className="grid grid-cols-2 gap-3">
              {rows.map((row) => {
                const icon =
                  row.label === '发布时间' ? (
                    <CalendarDays className="h-3.5 w-3.5" />
                  ) : row.label === '发布者' ? (
                    <UserRound className="h-3.5 w-3.5" />
                  ) : (
                    <Package className="h-3.5 w-3.5" />
                  );

                return (
                  <div
                    key={row.label}
                    className="rounded-[16px] border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-3.5 dark:bg-[rgba(255,255,255,0.03)]"
                  >
                    <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                      <span className="text-[var(--text-secondary)]">{icon}</span>
                      {row.label}
                    </div>
                    <div className="text-[14px] font-medium text-[var(--text-primary)]">{row.value}</div>
                  </div>
                );
              })}
            </div>
          </section>

          {skill.tags.length > 0 ? (
            <section>
              <div className="mb-3 text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)]">标签</div>
              <div className="flex flex-wrap gap-2">
                {skill.tags.map((tag) => (
                  <span key={tag} className={cn('rounded-md border px-3 py-1.5 text-[12px] transition-colors', skillTagClassName(tag, { flat: true }))}>
                    {tag}
                  </span>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <div className="border-t border-[var(--border-default)] bg-[var(--bg-card)] px-6 py-5 dark:bg-[var(--bg-page)]">
          <div className="flex flex-col gap-3">
            <div className="text-[13px] leading-6 text-[var(--text-secondary)]">
              {skill.source === 'bundled'
                ? '系统预置技能默认随应用提供。'
                : skill.source === 'private'
                  ? '这是你导入到账号中的技能。'
                  : '云端技能安装后会加入“我的技能”。'}
            </div>
            <div className="flex items-center gap-3">
              <Button variant="secondary" size="md" className="flex-1" onClick={onClose}>
                关闭
              </Button>
              <Button
                variant={status.actionVariant}
                size="md"
                block
                className="flex-[1.2]"
                disabled={status.disabled}
                onClick={() => onInstall(skill)}
              >
                {status.actionLabel}
              </Button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
