import { AlertCircle, Check, Package, X } from 'lucide-react';
import type { SkillStoreItem } from '@/app/lib/skill-store';
import { Button } from '@/app/components/ui/Button';
import { Chip } from '@/app/components/ui/Chip';
import { SkillGlyph, skillVisualLabel } from './SkillStoreVisuals';

function statusMeta(skill: SkillStoreItem, input: {actionLoading: boolean; installFailed: boolean}) {
  const isBundled = skill.source === 'bundled';
  if (input.installFailed) {
    return {
      label: '安装失败',
      tone: 'danger' as const,
      buttonLabel: '重试安装',
      buttonVariant: 'danger' as const,
      disabled: false,
      icon: <AlertCircle className="h-4 w-4" />,
      note: '上一次安装没有成功，你可以直接重试。',
    };
  }
  if (isBundled || skill.installed) {
    return {
      label: isBundled ? '默认已安装' : '已安装',
      tone: 'success' as const,
      buttonLabel: '已安装',
      buttonVariant: 'success' as const,
      disabled: true,
      icon: <Check className="h-4 w-4" />,
      note: isBundled ? '系统已内置，开箱可用。' : '已安装到账号，会同步到当前设备。',
    };
  }
  if (input.actionLoading) {
    return {
      label: '安装中',
      tone: 'brand' as const,
      buttonLabel: '安装中…',
      buttonVariant: 'primary' as const,
      disabled: true,
      icon: <Package className="h-4 w-4" />,
      note: '技能正在写入账号并同步到本机。',
    };
  }
  return {
    label: '未安装',
    tone: 'brand' as const,
    buttonLabel: '安装到我的技能',
    buttonVariant: 'primary' as const,
    disabled: false,
    icon: <Package className="h-4 w-4" />,
    note: '安装后会自动同步到当前设备，并在后续对话中可用。',
  };
}

export function SkillStoreDetailSheet({
  skill,
  actionLoading,
  installFailed,
  onInstall,
  onClose,
}: {
  skill: SkillStoreItem | null;
  actionLoading: boolean;
  installFailed: boolean;
  onInstall: (skill: SkillStoreItem) => void;
  onClose: () => void;
}) {
  if (!skill) {
    return null;
  }

  const status = statusMeta(skill, {actionLoading, installFailed});
  const latestVersion = skill.latestRelease?.version || (skill.source === 'bundled' ? 'bundled' : '未发布');

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-[rgba(20,24,33,0.16)] backdrop-blur-[3px] dark:bg-[rgba(0,0,0,0.34)]" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-[560px] flex-col border-l border-[rgba(15,23,42,0.08)] bg-[linear-gradient(180deg,rgba(252,252,251,0.98),rgba(246,247,244,0.96))] shadow-[0_32px_90px_rgba(15,23,42,0.18)] dark:border-l-[rgba(255,255,255,0.08)] dark:bg-[linear-gradient(180deg,rgba(24,24,24,0.98),rgba(12,12,12,0.96))] dark:shadow-[0_30px_90px_rgba(0,0,0,0.44)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-[rgba(15,23,42,0.08)] px-6 py-5 dark:border-b-[rgba(255,255,255,0.08)]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(15,23,42,0.08)] bg-white/70 px-3 py-1 text-[12px] text-[var(--text-secondary)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(255,255,255,0.04)]">
                {status.icon}
                技能详情
              </div>
              <div className="mt-4 flex items-start gap-4">
                <SkillGlyph skill={skill} className="h-16 w-16 rounded-[24px]" iconClassName="h-7 w-7" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[24px] font-semibold tracking-[-0.03em] text-[var(--text-primary)]">{skill.name}</h2>
                    <Chip tone={status.tone} className="px-2.5 py-1 text-[11px] font-medium">
                      {status.label}
                    </Chip>
                  </div>
                  <p className="mt-2 text-[14px] leading-7 text-[var(--text-secondary)]">{skill.description}</p>
                </div>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="rounded-full" onClick={onClose} leadingIcon={<X className="h-4 w-4" />}>
              关闭
            </Button>
          </div>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          <section className="rounded-[28px] border border-[rgba(15,23,42,0.08)] bg-white/78 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)] backdrop-blur-[10px] dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(255,255,255,0.03)] dark:shadow-[0_20px_36px_rgba(0,0,0,0.26)]">
            <div className="flex flex-wrap items-center gap-2">
              <Chip>{skill.market}</Chip>
              <Chip tone="outline">{skill.skillType}</Chip>
              <Chip tone="outline">{skill.categoryLabel}</Chip>
              <Chip tone={skill.source === 'bundled' ? 'success' : 'brand'}>{skill.sourceLabel}</Chip>
            </div>
            <p className="mt-4 text-[13px] leading-6 text-[var(--text-secondary)]">{status.note}</p>
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[24px] border border-[rgba(15,23,42,0.08)] bg-white/76 p-4 shadow-[0_14px_30px_rgba(15,23,42,0.05)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(255,255,255,0.03)]">
              <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-secondary)]">视觉语义</div>
              <div className="mt-2 text-[15px] font-medium text-[var(--text-primary)]">{skillVisualLabel(skill)}</div>
              <p className="mt-1 text-[13px] leading-6 text-[var(--text-secondary)]">用于在技能库里快速识别这类能力的用途和方向。</p>
            </div>
            <div className="rounded-[24px] border border-[rgba(15,23,42,0.08)] bg-white/76 p-4 shadow-[0_14px_30px_rgba(15,23,42,0.05)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(255,255,255,0.03)]">
              <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-secondary)]">最新版本</div>
              <div className="mt-2 text-[15px] font-medium text-[var(--text-primary)]">{latestVersion}</div>
              <p className="mt-1 text-[13px] leading-6 text-[var(--text-secondary)]">
                {skill.latestRelease?.published_at
                  ? `已发布到 catalog，可用于当前设备恢复与安装。`
                  : '当前由系统预置或本地目录提供。'}
              </p>
            </div>
            <div className="rounded-[24px] border border-[rgba(15,23,42,0.08)] bg-white/76 p-4 shadow-[0_14px_30px_rgba(15,23,42,0.05)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(255,255,255,0.03)]">
              <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-secondary)]">发布者</div>
              <div className="mt-2 text-[15px] font-medium text-[var(--text-primary)]">{skill.publisher}</div>
              <p className="mt-1 text-[13px] leading-6 text-[var(--text-secondary)]">帮助用户识别来源与归属，减少安装时的不确定感。</p>
            </div>
            <div className="rounded-[24px] border border-[rgba(15,23,42,0.08)] bg-white/76 p-4 shadow-[0_14px_30px_rgba(15,23,42,0.05)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(255,255,255,0.03)]">
              <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-secondary)]">安装方式</div>
              <div className="mt-2 text-[15px] font-medium text-[var(--text-primary)]">
                {skill.source === 'bundled' ? '随应用内置' : '云端安装到账号'}
              </div>
              <p className="mt-1 text-[13px] leading-6 text-[var(--text-secondary)]">
                {skill.source === 'bundled' ? '无需操作，应用默认可见。' : '安装后会参与跨设备恢复。'}
              </p>
            </div>
          </section>

          {skill.tags.length > 0 ? (
            <section className="rounded-[28px] border border-[rgba(15,23,42,0.08)] bg-white/76 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(255,255,255,0.03)]">
              <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-secondary)]">标签</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {skill.tags.map((tag) => (
                  <Chip key={tag} tone="outline" className="px-3 py-1.5">
                    {tag}
                  </Chip>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <div className="border-t border-[rgba(15,23,42,0.08)] bg-white/82 px-6 py-5 backdrop-blur-[10px] dark:border-t-[rgba(255,255,255,0.08)] dark:bg-[rgba(12,12,12,0.86)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="text-[13px] text-[var(--text-secondary)]">
              {skill.source === 'bundled'
                ? '系统预置能力会随应用一起存在。'
                : '云端技能安装后，会由本地 runtime 接管下载与恢复。'}
            </div>
            <div className="flex items-center gap-3">
              <Button variant="secondary" size="md" onClick={onClose}>
                稍后再看
              </Button>
              <Button
                variant={status.buttonVariant}
                size="md"
                disabled={status.disabled}
                onClick={() => onInstall(skill)}
              >
                {status.buttonLabel}
              </Button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
