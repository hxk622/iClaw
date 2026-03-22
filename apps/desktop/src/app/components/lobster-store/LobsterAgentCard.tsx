import { CheckCircle2, Eye, MessageSquare, Plus, Sparkles } from 'lucide-react';

import type { LobsterAgent } from '@/app/lib/lobster-store';
import { cn } from '@/app/lib/cn';
import { AvatarSurface } from '@/app/components/ui/AvatarSurface';
import { Chip } from '@/app/components/ui/Chip';
import { PressableCard } from '@/app/components/ui/PressableCard';
import { LobsterActionButton } from './LobsterActionButton';

export function LobsterAgentCard({
  agent,
  onOpenDetail,
  onInstall,
  onStartConversation,
  installBusy = false,
}: {
  agent: LobsterAgent;
  onOpenDetail: (agent: LobsterAgent) => void;
  onInstall: (agent: LobsterAgent) => void;
  onStartConversation: (agent: LobsterAgent) => void;
  installBusy?: boolean;
}) {
  const showFeatured = agent.featured && !agent.installed;

  return (
    <PressableCard
      interactive
      onClick={() => onOpenDetail(agent)}
      className={cn(
        'group min-h-[248px] rounded-[24px] border-[var(--lobster-border)] bg-[var(--lobster-card-bg)] p-5',
        'hover:border-[var(--lobster-gold-border)] hover:bg-[var(--lobster-card-bg)] hover:shadow-[var(--lobster-shadow-card)]',
      )}
    >
      <div className="absolute inset-x-0 top-0 h-20 bg-[radial-gradient(circle_at_top,rgba(168,140,93,0.12),transparent_68%)] opacity-90 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="absolute inset-x-5 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(168,140,93,0.32),transparent)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between gap-3">
          <AvatarSurface
            src={agent.avatarSrc}
            alt={agent.name}
            sizeClassName="h-16 w-16"
            className="transition-transform duration-300 group-hover:scale-[1.03]"
          />
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Chip tone="outline" className="px-2.5 py-1 text-[11px]">
              {agent.categoryLabel}
            </Chip>
            {showFeatured ? (
              <Chip tone="accent" leadingIcon={<Sparkles className="h-3 w-3" />} className="px-2.5 py-1 text-[11px]">
                官方精选
              </Chip>
            ) : null}
            {agent.installed ? (
              <Chip
                tone="success"
                leadingIcon={<CheckCircle2 className="h-3 w-3" />}
                className="px-2.5 py-1 text-[11px]"
              >
                已添加
              </Chip>
            ) : null}
          </div>
        </div>

        <div className="mt-4">
          <h3 className="text-[18px] font-semibold tracking-[-0.04em] text-[var(--lobster-text-primary)] transition-colors duration-300 group-hover:text-[var(--lobster-gold-strong)]">
            {agent.name}
          </h3>
          <p className="mt-2 line-clamp-2 text-[13px] leading-6 text-[var(--lobster-text-secondary)]">{agent.description}</p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {agent.tags.slice(0, 3).map((tag) => (
            <Chip key={tag} tone="muted" className="px-2.5 py-1 text-[11px]">
              {tag}
            </Chip>
          ))}
        </div>

        <div className="mt-auto grid grid-cols-[108px_minmax(0,1fr)] gap-2 pt-5">
          <LobsterActionButton
            variant="secondary"
            leadingIcon={<Eye className="h-4 w-4" />}
            onClick={(event) => {
              event.stopPropagation();
              onOpenDetail(agent);
            }}
          >
            详情
          </LobsterActionButton>
          <LobsterActionButton
            variant={agent.installed ? 'accent' : 'primary'}
            className={cn(
              'w-full',
              !agent.installed && 'group-hover:border-[var(--lobster-gold-border)] group-hover:shadow-[0_16px_24px_rgba(168,140,93,0.12)]',
            )}
            leadingIcon={agent.installed ? <MessageSquare className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            disabled={installBusy}
            onClick={(event) => {
              event.stopPropagation();
              if (agent.installed) {
                onStartConversation(agent);
              } else {
                onInstall(agent);
              }
            }}
          >
            {agent.installed ? '对话' : installBusy ? '安装中...' : '安装'}
          </LobsterActionButton>
        </div>
      </div>
    </PressableCard>
  );
}
