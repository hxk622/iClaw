import { useEffect } from 'react';
import { CheckCircle, Star, Trash2, UserPlus, Users, X } from 'lucide-react';

import { cn } from '@/app/lib/cn';
import { ConversationActionButton } from '@/app/components/ui/ConversationActionButton';
import { AvatarSurface } from '@/app/components/ui/AvatarSurface';
import type { InvestmentExpert } from '@/app/lib/investment-experts';
import { INTERACTIVE_FOCUS_RING, SPRING_PRESSABLE } from '@/app/lib/ui-interactions';

function EmptySectionState({ text }: {text: string}) {
  return (
    <div className="rounded-[12px] border border-dashed border-[var(--lobster-border)] bg-[var(--lobster-muted-bg)] px-4 py-3 text-[14px] leading-7 text-[var(--lobster-text-secondary)]">
      {text}
    </div>
  );
}

function StatusPill({
  installed,
}: {
  installed: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold',
        installed
          ? 'bg-[rgba(34,197,94,0.10)] text-[#166534] dark:bg-[rgba(34,197,94,0.18)] dark:text-[#c7f9d7]'
          : 'bg-[rgba(37,99,235,0.10)] text-[#2563eb] dark:bg-[rgba(59,130,246,0.18)] dark:text-[#bfdbfe]',
      )}
    >
      {installed ? '已添加' : '未添加'}
    </span>
  );
}

export function InvestmentExpertDetailDialog({
  expert,
  open,
  installBusy = false,
  removeBusy = false,
  onOpenChange,
  onInstall,
  onRemove,
  onStartConversation,
}: {
  expert: InvestmentExpert | null;
  open: boolean;
  installBusy?: boolean;
  removeBusy?: boolean;
  onOpenChange: (open: boolean) => void;
  onInstall: (expert: InvestmentExpert) => void;
  onRemove: (expert: InvestmentExpert) => void;
  onStartConversation: (expert: InvestmentExpert) => void;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onOpenChange(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpenChange, open]);

  if (!expert || !open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="investment-expert-detail-title">
      <button
        type="button"
        aria-label="关闭弹窗"
        onClick={() => onOpenChange(false)}
        className="absolute inset-0 h-full w-full cursor-pointer bg-[rgba(15,11,7,0.58)] backdrop-blur-[3px]"
      />

      <div className="absolute left-1/2 top-1/2 z-10 max-h-[86vh] w-[min(920px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[20px] border border-[var(--lobster-border)] bg-[var(--lobster-card-elevated)] shadow-[var(--lobster-shadow-modal)]">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-6 border-b border-[var(--lobster-border)] bg-[var(--lobster-card-elevated)] px-7 py-6">
          <div className="flex min-w-0 items-start gap-5">
            <div className="relative shrink-0">
              <AvatarSurface src={expert.avatar} alt={expert.name} sizeClassName="h-24 w-24" halo />
              <span
                className={cn(
                  'absolute bottom-1 right-1 h-5 w-5 rounded-full border-2 border-[var(--lobster-card-elevated)]',
                  expert.isOnline ? 'bg-[#22c55e]' : 'bg-[#94a3b8]',
                )}
              />
            </div>

            <div className="min-w-0">
              <h2 id="investment-expert-detail-title" className="text-[28px] font-semibold tracking-[-0.04em] text-[var(--lobster-text-primary)]">
                {expert.name}
              </h2>
              <p className="mt-1 text-[15px] leading-7 text-[var(--lobster-text-secondary)]">
                {expert.subtitle}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StatusPill installed={expert.installed} />
                {expert.tags.slice(0, 4).map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-[8px] bg-[var(--lobster-muted-bg)] px-2.5 py-1 text-[12px] text-[var(--lobster-text-secondary)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-5 text-[14px] text-[var(--lobster-text-secondary)]">
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-[var(--lobster-text-muted)]" />
                  {expert.usageCount.toLocaleString('zh-CN')} 人使用
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4 text-[var(--lobster-text-muted)]" />
                  {expert.taskCount.toLocaleString('zh-CN')} 次任务
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Star className="h-4 w-4 text-[var(--lobster-gold-strong)]" fill="currentColor" />
                  {expert.rating.toFixed(1)} 评分
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            aria-label="关闭"
            onClick={() => onOpenChange(false)}
            className={cn(
              'inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[var(--lobster-border)] text-[var(--lobster-text-muted)] transition hover:bg-[var(--lobster-muted-bg)] hover:text-[var(--lobster-text-primary)]',
              SPRING_PRESSABLE,
              INTERACTIVE_FOCUS_RING,
            )}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-8 px-7 py-6">
          <section>
            <h3 className="mb-3 text-[16px] font-semibold text-[var(--lobster-text-primary)]">专家介绍</h3>
            <p className="text-[14px] leading-7 text-[var(--lobster-text-secondary)]">{expert.description}</p>
          </section>

          <section>
            <h3 className="mb-3 text-[16px] font-semibold text-[var(--lobster-text-primary)]">核心技能</h3>
            {expert.skills.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {expert.skills.map((skill) => (
                  <div
                    key={skill.title}
                    className="rounded-[14px] border border-[var(--lobster-border)] bg-[var(--lobster-muted-bg)] px-4 py-3"
                  >
                    <div className="text-[14px] font-semibold text-[var(--lobster-text-primary)]">
                      {skill.title}
                    </div>
                    <div className="mt-1 text-[13px] leading-6 text-[var(--lobster-text-secondary)]">
                      {skill.description}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptySectionState text="当前目录还没有补充核心技能卡片，建议直接发起一次任务试跑来验证效果。" />
            )}
          </section>

          <section>
            <h3 className="mb-3 text-[16px] font-semibold text-[var(--lobster-text-primary)]">可执行任务示例</h3>
            {expert.taskExamples.length > 0 ? (
              <div className="space-y-2">
                {expert.taskExamples.map((task) => (
                  <div
                    key={task}
                    className="flex items-start gap-2 rounded-[12px] bg-[var(--lobster-muted-bg)] px-4 py-3 text-[14px] leading-7 text-[var(--lobster-text-secondary)]"
                  >
                    <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--lobster-gold-strong)]" />
                    <span>{task}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptySectionState text="当前目录还没有提供任务示例，安装后可直接输入你的投资问题开始协作。" />
            )}
          </section>

          <section>
            <h3 className="mb-3 text-[16px] font-semibold text-[var(--lobster-text-primary)]">对话预览</h3>
            {expert.conversationPreview.length > 0 ? (
              <div className="rounded-[16px] border border-[var(--lobster-border)] bg-[var(--lobster-muted-bg)] p-4">
                <div className="space-y-3">
                  {expert.conversationPreview.map((message, index) => (
                    <div key={`${message.role}-${index}`} className={message.role === 'user' ? 'text-right' : 'text-left'}>
                      <div
                        className={cn(
                          'inline-block max-w-[85%] rounded-[14px] px-4 py-3 text-[14px] leading-7',
                          message.role === 'user'
                            ? 'border border-[rgba(168,140,93,0.36)] bg-[linear-gradient(180deg,#ccb27b_0%,#b49154_100%)] text-[#120e09]'
                            : 'border border-[var(--lobster-border)] bg-[var(--lobster-card-elevated)] text-[var(--lobster-text-primary)]',
                        )}
                      >
                        {message.content}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptySectionState text="当前目录还没有预置对话预览，添加后可直接在聊天中验证它的回复风格。" />
            )}
          </section>
        </div>

        <div className="sticky bottom-0 flex gap-3 border-t border-[var(--lobster-border)] bg-[var(--lobster-card-elevated)] px-7 py-5">
          {expert.installed ? (
            <>
              <ConversationActionButton
                type="button"
                variant="accent"
                size="md"
                onClick={() => onStartConversation(expert)}
                className="flex-1"
              />
              <button
                type="button"
                disabled={removeBusy}
                onClick={() => onRemove(expert)}
                className={cn(
                  'inline-flex min-w-[160px] cursor-pointer items-center justify-center gap-2 rounded-[12px] border px-5 py-3 text-[14px] font-semibold transition',
                  SPRING_PRESSABLE,
                  INTERACTIVE_FOCUS_RING,
                  'border-[rgba(239,68,68,0.18)] bg-[rgba(239,68,68,0.08)] text-[#b42318] hover:border-[rgba(239,68,68,0.28)] hover:bg-[rgba(239,68,68,0.12)] disabled:cursor-not-allowed disabled:opacity-70 dark:border-[rgba(248,113,113,0.2)] dark:bg-[rgba(248,113,113,0.12)] dark:text-[#fecaca]',
                )}
              >
                <Trash2 className="h-[18px] w-[18px]" />
                {removeBusy ? '移除中...' : '从我的专家移除'}
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={installBusy}
              onClick={() => onInstall(expert)}
              className={cn(
                'flex-1 cursor-pointer rounded-[12px] px-5 py-3 text-[14px] font-semibold transition',
                SPRING_PRESSABLE,
                INTERACTIVE_FOCUS_RING,
                'border border-[rgba(168,140,93,0.42)] bg-[linear-gradient(180deg,#ccb27b_0%,#b49154_100%)] text-[#120e09] shadow-[0_10px_22px_rgba(168,140,93,0.20)] hover:border-[rgba(168,140,93,0.55)] hover:bg-[linear-gradient(180deg,#d1b884_0%,#bc9a5f_100%)] disabled:cursor-not-allowed disabled:opacity-70',
              )}
            >
              <span className="inline-flex items-center gap-2">
                <UserPlus className="h-[18px] w-[18px]" />
                {installBusy ? '安装中...' : '添加到我的专家'}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className={cn(
              'min-w-[140px] cursor-pointer rounded-[12px] border border-[var(--lobster-border)] px-5 py-3 text-[14px] font-semibold text-[var(--lobster-text-primary)] transition hover:bg-[var(--lobster-muted-bg)]',
              SPRING_PRESSABLE,
              INTERACTIVE_FOCUS_RING,
            )}
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
