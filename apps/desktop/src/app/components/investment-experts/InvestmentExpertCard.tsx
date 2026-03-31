import { Flame, Plus, Sparkles, Users } from 'lucide-react';

import { cn } from '@/app/lib/cn';
import { ConversationActionButton } from '@/app/components/ui/ConversationActionButton';
import type { InvestmentExpert } from '@/app/lib/investment-experts';
import { INTERACTIVE_FOCUS_RING, SPRING_PRESSABLE } from '@/app/lib/ui-interactions';

type InvestmentExpertCardMode = 'shop' | 'mine';

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

export function InvestmentExpertCard({
  expert,
  mode = 'shop',
  onOpenDetail,
  onInstall,
  onStartConversation,
  installBusy = false,
}: {
  expert: InvestmentExpert;
  mode?: InvestmentExpertCardMode;
  onOpenDetail: (expert: InvestmentExpert) => void;
  onInstall: (expert: InvestmentExpert) => void;
  onStartConversation: (expert: InvestmentExpert) => void;
  installBusy?: boolean;
}) {
  const inMineTab = mode === 'mine';
  const badge = expert.isRecommended
    ? {
        label: '推荐',
        className:
          'bg-[linear-gradient(90deg,#9d7d3a_0%,#c9a961_100%)] text-white shadow-[0_8px_18px_rgba(168,140,93,0.22)]',
        icon: <Sparkles className="h-3 w-3" />,
      }
    : expert.isHot
      ? {
          label: '热门',
          className:
            'bg-[linear-gradient(90deg,#f97316_0%,#ef4444_100%)] text-white shadow-[0_8px_18px_rgba(239,68,68,0.20)]',
          icon: <Flame className="h-3 w-3" />,
        }
      : null;

  return (
    <div
      onClick={() => onOpenDetail(expert)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpenDetail(expert);
        }
      }}
      role="button"
      tabIndex={0}
      className={cn(
        'group relative flex min-h-[316px] cursor-pointer flex-col rounded-[18px] border border-[var(--lobster-border)] bg-[var(--lobster-card-elevated)] p-5 transition-all duration-300',
        SPRING_PRESSABLE,
        INTERACTIVE_FOCUS_RING,
        'hover:border-[var(--lobster-gold-border-strong)] hover:shadow-[0_14px_30px_rgba(18,15,11,0.08)]',
      )}
    >
      {badge ? (
        <div
          className={cn(
            'absolute -right-2 -top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
            badge.className,
          )}
        >
          {badge.icon}
          {badge.label}
        </div>
      ) : null}

      <div className="relative mb-4">
        <img
          src={expert.avatar}
          alt={expert.name}
          className="h-16 w-16 rounded-full border-2 border-[var(--lobster-border)] object-cover"
        />
        <span
          className={cn(
            'absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-[var(--lobster-card-elevated)]',
            expert.isOnline ? 'bg-[#22c55e]' : 'bg-[#94a3b8]',
          )}
        />
      </div>

      <div className="mb-3">
        <h3 className="text-[16px] font-semibold leading-6 text-[var(--lobster-text-primary)]">
          {expert.name}
        </h3>
        <p className="mt-1 text-[13px] leading-6 text-[var(--lobster-text-secondary)]">
          {expert.subtitle}
        </p>
      </div>

      <p className="mb-4 line-clamp-2 text-[14px] leading-7 text-[var(--lobster-text-secondary)]">
        {expert.description}
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        <StatusPill installed={expert.installed} />
        {expert.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center rounded-[8px] bg-[var(--lobster-muted-bg)] px-2.5 py-1 text-[12px] text-[var(--lobster-text-secondary)]"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-auto">
        <div className="mb-4 flex items-center gap-1.5 text-[13px] text-[var(--lobster-text-secondary)]">
          <Users className="h-3.5 w-3.5" />
          <span>{expert.usageCount.toLocaleString('zh-CN')} 人使用</span>
        </div>

        {inMineTab ? (
          <ConversationActionButton
            type="button"
            variant="accent"
            size="sm"
            className="w-full"
            onClick={(event) => {
              event.stopPropagation();
              onStartConversation(expert);
            }}
          />
        ) : expert.installed ? (
          <ConversationActionButton
            type="button"
            variant="accent"
            size="sm"
            className="w-full"
            onClick={(event) => {
              event.stopPropagation();
              onStartConversation(expert);
            }}
          />
        ) : (
          <button
            type="button"
            disabled={installBusy}
            onClick={(event) => {
              event.stopPropagation();
              onInstall(expert);
            }}
            className={cn(
              'inline-flex h-10 w-full cursor-pointer items-center justify-center gap-1.5 rounded-[10px] px-3 text-[14px] font-semibold transition',
              SPRING_PRESSABLE,
              INTERACTIVE_FOCUS_RING,
              'border border-[rgba(168,140,93,0.42)] bg-[linear-gradient(180deg,#ccb27b_0%,#b49154_100%)] text-[#120e09] shadow-[0_10px_22px_rgba(168,140,93,0.20)] hover:border-[rgba(168,140,93,0.55)] hover:bg-[linear-gradient(180deg,#d1b884_0%,#bc9a5f_100%)] disabled:cursor-not-allowed disabled:opacity-70',
            )}
          >
            <Plus className="h-4 w-4" />
            {installBusy ? '安装中...' : '安装'}
          </button>
        )}
      </div>
    </div>
  );
}
