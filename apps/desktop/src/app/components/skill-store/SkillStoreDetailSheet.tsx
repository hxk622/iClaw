import type { ReactNode } from 'react';
import { CalendarDays, MessageSquare, Package, Settings2, Sparkles, Tag, Trash2, UserRound } from 'lucide-react';
import type { SkillStoreItem } from '@/app/lib/skill-store';
import { Button } from '@/app/components/ui/Button';
import { Chip } from '@/app/components/ui/Chip';
import { DrawerSection } from '@/app/components/ui/DrawerSection';
import { InfoTile } from '@/app/components/ui/InfoTile';
import { SideDetailSheet } from '@/app/components/ui/SideDetailSheet';
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

function isSystemPreinstalledSkill(skill: SkillStoreItem): boolean {
  return (
    skill.metadata?.default_installed === true ||
    skill.sourceLabel === '系统预置' ||
    skill.sourceLabel === '平台预装' ||
    skill.sourceLabel === 'OEM预装'
  );
}

function needsSetup(skill: SkillStoreItem): boolean {
  return skill.setupSchema != null && skill.setupStatus !== 'configured';
}

function canStartConversation(skill: SkillStoreItem, input: { actionLoading: boolean; installFailed: boolean }): boolean {
  return (
    !input.actionLoading &&
    !input.installFailed &&
    !needsSetup(skill) &&
    (isSystemPreinstalledSkill(skill) || skill.installed)
  );
}

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

  if (isSystemPreinstalledSkill(skill)) {
    return {
      label: '默认已安装',
      tone: 'brand',
      actionLabel: '对话',
      actionVariant: 'secondary',
      disabled: false,
      note: '这是系统预置技能，随应用一起提供，可直接开始对话。',
    };
  }

  if (skill.installed) {
    return {
      label: '已安装',
      tone: 'success',
      actionLabel: needsSetup(skill) ? '补充配置' : '对话',
      actionVariant: needsSetup(skill) ? 'primary' : 'success',
      disabled: false,
      note:
        needsSetup(skill)
          ? '这个技能已安装，但还缺少运行所需配置。先补齐配置，再进入对话。'
          : skill.source === 'private'
            ? '这是你导入到账号的技能，可直接开始对话。'
            : '这个技能已经加入你的账号，可直接开始对话。',
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

function metadataRows(skill: SkillStoreItem) {
  return [
    {
      label: '最新版本',
      value: skill.version || (isSystemPreinstalledSkill(skill) ? '系统预装' : '未发布'),
      icon: <Package className="h-3.5 w-3.5" />,
    },
    {
      label: '配置状态',
      value: skill.setupSchema ? (needsSetup(skill) ? '待配置' : '已配置') : '无需配置',
      icon: <Settings2 className="h-3.5 w-3.5" />,
    },
    {
      label: '来源地址',
      value: skill.sourceUrl ? <span className="block break-words [overflow-wrap:anywhere]">{skill.sourceUrl}</span> : '未记录',
      icon: <CalendarDays className="h-3.5 w-3.5" />,
    },
    {
      label: '分类',
      value: skill.categoryLabel,
      icon: <Tag className="h-3.5 w-3.5" />,
    },
    {
      label: '市场',
      value: skill.market,
      icon: <Sparkles className="h-3.5 w-3.5" />,
    },
    {
      label: '发布者',
      value: skill.publisher,
      icon: <UserRound className="h-3.5 w-3.5" />,
    },
    {
      label: '来源',
      value: skill.sourceLabel,
      icon: <Package className="h-3.5 w-3.5" />,
    },
  ] as Array<{ label: string; value: ReactNode; icon: ReactNode }>;
}

export function SkillStoreDetailSheet({
  skill,
  actionLoading,
  removeLoading,
  installFailed,
  onInstall,
  onRemove,
  onStartConversation,
  onClose,
}: {
  skill: SkillStoreItem | null;
  actionLoading: boolean;
  removeLoading: boolean;
  installFailed: boolean;
  onInstall: (skill: SkillStoreItem) => void;
  onRemove: (skill: SkillStoreItem) => void;
  onStartConversation: (skill: SkillStoreItem) => void;
  onClose: () => void;
}) {
  if (!skill) {
    return null;
  }

  const status = resolveStatus(skill, { actionLoading, installFailed });
  const chatReady = canStartConversation(skill, { actionLoading, installFailed });
  const rows = metadataRows(skill);

  return (
    <SideDetailSheet
      open
      onClose={onClose}
      eyebrow="技能详情"
      title={skill.name}
      header={
          <div className="mb-6 flex items-start gap-4">
            <SkillGlyph skill={skill} className="h-16 w-16 rounded-xl" iconClassName="h-7 w-7" />
            <div className="min-w-0 flex-1">
              <div className="mt-2 flex flex-wrap gap-2">
                {skill.featured ? (
                  <Chip tone="accent">
                    <Sparkles className="h-3.5 w-3.5" />
                    官方精选
                  </Chip>
                ) : null}
                <Chip tone={status.tone}>{status.label}</Chip>
                <Chip tone={isSystemPreinstalledSkill(skill) ? 'brand' : skill.source === 'private' ? 'success' : 'outline'}>
                  {skill.sourceLabel}
                </Chip>
                <Chip tone="outline">{skill.categoryLabel}</Chip>
                {skill.setupSchema && skill.setupStatus !== 'configured' ? <Chip tone="warning">需配置</Chip> : null}
              </div>
              <p className="mt-3 text-[13px] leading-6 text-[var(--text-secondary)]">{status.note}</p>
            </div>
          </div>
      }
      footer={
        <div className="flex flex-col gap-3">
          <div className="text-[13px] leading-6 text-[var(--text-secondary)]">
            {isSystemPreinstalledSkill(skill)
              ? '系统预置技能默认随应用提供，可直接进入对话。'
              : skill.source === 'private'
                ? '这是你导入到账号中的技能，可直接进入对话。'
                : skill.installed
                  ? '这个云端技能已经加入“我的技能”，可直接进入对话。'
                  : '云端技能安装后会加入“我的技能”。'}
          </div>
          <Button
            variant={status.actionVariant}
            size="md"
            block
            disabled={status.disabled || removeLoading}
            leadingIcon={chatReady ? <MessageSquare className="h-4 w-4" /> : undefined}
            onClick={() => {
              if (chatReady) {
                onStartConversation(skill);
                return;
              }
              onInstall(skill);
            }}
          >
            {status.actionLabel}
          </Button>
          {skill.userInstalled && !isSystemPreinstalledSkill(skill) ? (
            <Button
              variant="danger"
              size="md"
              block
              disabled={actionLoading || removeLoading}
              leadingIcon={<Trash2 className="h-4 w-4" />}
              onClick={() => onRemove(skill)}
            >
              {removeLoading ? '卸载中…' : '卸载'}
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="space-y-5">
        <DrawerSection title="技能介绍" icon={<Package className="h-5 w-5" />}>
          <p className="break-words text-[14px] leading-7 text-[var(--text-secondary)] [overflow-wrap:anywhere]">{skill.description}</p>
        </DrawerSection>

        <DrawerSection title="元信息" icon={<CalendarDays className="h-5 w-5" />}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {rows.map((row) => {
                return (
                  <InfoTile
                    key={row.label}
                    label={
                      <span className="inline-flex items-center gap-2">
                        <span className="text-[var(--text-secondary)]">{row.icon}</span>
                        {row.label}
                      </span>
                    }
                    value={row.value}
                  />
                );
              })}
          </div>
        </DrawerSection>

        {skill.tags.length > 0 ? (
          <DrawerSection title="标签" icon={<UserRound className="h-5 w-5" />}>
            <div className="flex flex-wrap gap-2">
              {skill.tags.map((tag) => (
                <span key={tag} className={cn('rounded-md border px-3 py-1.5 text-[12px] transition-colors', skillTagClassName(tag, { flat: true }))}>
                  {tag}
                </span>
              ))}
            </div>
          </DrawerSection>
        ) : null}
      </div>
    </SideDetailSheet>
  );
}
