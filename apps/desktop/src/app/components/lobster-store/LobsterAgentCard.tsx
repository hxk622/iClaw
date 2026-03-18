import { CheckCircle2, Plus, Sparkles } from 'lucide-react';

import type { LobsterAgent } from '@/app/lib/lobster-store';
import { cn } from '@/app/lib/cn';
import { PressableCard } from '@/app/components/ui/PressableCard';
import { LobsterActionButton } from './LobsterActionButton';
import { LobsterBadge } from './LobsterBadge';

export function LobsterAgentCard({
  agent,
  onOpenDetail,
  onInstall,
  installBusy = false,
}: {
  agent: LobsterAgent;
  onOpenDetail: (agent: LobsterAgent) => void;
  onInstall: (agent: LobsterAgent) => void;
  installBusy?: boolean;
}) {
  const showFeatured = agent.featured && !agent.installed;

  return (
    <PressableCard
      interactive
      onClick={() => onOpenDetail(agent)}
      className={cn(
        'min-h-[340px] rounded-[32px] border-[var(--lobster-border)] bg-[var(--lobster-card-bg)] p-7',
        'hover:border-[var(--lobster-gold-border)] hover:bg-[var(--lobster-card-bg)] hover:shadow-[var(--lobster-shadow-card)]',
      )}
    >
      <div className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top,rgba(168,140,93,0.12),transparent_68%)] opacity-90" />
      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-full border border-[var(--lobster-gold-border)] bg-[var(--lobster-card-elevated)] shadow-[var(--lobster-shadow-avatar)]">
            <img src={agent.avatarSrc} alt={agent.name} className="h-full w-full object-cover" />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <LobsterBadge tone="category">{agent.categoryLabel}</LobsterBadge>
            {showFeatured ? (
              <LobsterBadge tone="featured">
                <Sparkles className="h-3 w-3" />
                官方精选
              </LobsterBadge>
            ) : null}
            {agent.installed ? (
              <LobsterBadge tone="installed">
                <CheckCircle2 className="h-3 w-3" />
                已添加
              </LobsterBadge>
            ) : null}
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-[22px] font-semibold tracking-[-0.04em] text-[var(--lobster-text-primary)]">{agent.name}</h3>
          <p className="mt-3 line-clamp-3 text-[14px] leading-7 text-[var(--lobster-text-secondary)]">{agent.description}</p>
        </div>

        <div className="mt-6 grid gap-2">
          {agent.capabilities.slice(0, 2).map((capability) => (
            <div key={capability} className="flex items-start gap-2 text-[13px] leading-6 text-[var(--lobster-text-secondary)]">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--lobster-gold)]" />
              <span>{capability}</span>
            </div>
          ))}
        </div>

        <div className="mt-auto pt-6">
          <LobsterActionButton
            block
            variant={agent.installed ? 'secondary' : 'primary'}
            leadingIcon={agent.installed ? <CheckCircle2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            disabled={agent.installed || installBusy}
            onClick={(event) => {
              event.stopPropagation();
              if (!agent.installed) {
                onInstall(agent);
              }
            }}
          >
            {agent.installed ? '已添加到我的龙虾' : installBusy ? '添加中...' : '添加'}
          </LobsterActionButton>
        </div>
      </div>
    </PressableCard>
  );
}
