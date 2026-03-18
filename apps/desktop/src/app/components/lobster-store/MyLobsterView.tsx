import { CheckCircle2, Eye, Trash2 } from 'lucide-react';

import type { LobsterAgent } from '@/app/lib/lobster-store';
import { PressableCard } from '@/app/components/ui/PressableCard';
import { LobsterActionButton } from './LobsterActionButton';
import { LobsterBadge } from './LobsterBadge';

function formatInstalledAt(value: string | null): string {
  if (!value) return '刚刚添加';
  try {
    return new Date(value).toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return value;
  }
}

export function MyLobsterView({
  agents,
  removeBusySlug,
  onOpenDetail,
  onRemove,
}: {
  agents: LobsterAgent[];
  removeBusySlug: string | null;
  onOpenDetail: (agent: LobsterAgent) => void;
  onRemove: (agent: LobsterAgent) => void;
}) {
  if (agents.length === 0) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center rounded-[36px] border border-dashed border-[var(--lobster-border)] bg-[var(--lobster-card-bg)] px-8 text-center">
        <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full border border-[var(--lobster-gold-border)] bg-[var(--lobster-gold-soft)] text-[var(--lobster-gold-strong)]">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <div className="mt-6 text-[24px] font-semibold tracking-[-0.04em] text-[var(--lobster-text-primary)]">还没有添加任何龙虾</div>
        <div className="mt-3 max-w-[420px] text-[14px] leading-7 text-[var(--lobster-text-secondary)]">
          前往龙虾商店挑选适合你的预设助手，安装后会自动出现在这里。
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {agents.map((agent) => (
        <PressableCard
          key={agent.slug}
          interactive
          onClick={() => onOpenDetail(agent)}
          className="rounded-[30px] border-[var(--lobster-border)] bg-[var(--lobster-card-bg)] p-6 hover:border-[var(--lobster-gold-border)] hover:shadow-[var(--lobster-shadow-card)]"
        >
          <div className="flex gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--lobster-gold-border)] bg-[var(--lobster-card-elevated)] shadow-[var(--lobster-shadow-avatar)]">
              <img src={agent.avatarSrc} alt={agent.name} className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-[20px] font-semibold tracking-[-0.04em] text-[var(--lobster-text-primary)]">{agent.name}</div>
                <LobsterBadge tone="installed">已添加</LobsterBadge>
              </div>
              <div className="mt-2 text-[14px] leading-7 text-[var(--lobster-text-secondary)]">{agent.description}</div>
              <div className="mt-4 flex flex-wrap gap-2">
                {agent.tags.slice(0, 3).map((tag) => (
                  <LobsterBadge key={tag} tone="category">
                    {tag}
                  </LobsterBadge>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between gap-4 border-t border-[var(--lobster-border)] pt-5">
            <div className="text-[13px] text-[var(--lobster-text-muted)]">
              添加时间：<span className="text-[var(--lobster-text-secondary)]">{formatInstalledAt(agent.installedAt)}</span>
            </div>
            <div className="flex items-center gap-2">
              <LobsterActionButton
                variant="secondary"
                leadingIcon={<Eye className="h-4 w-4" />}
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenDetail(agent);
                }}
              >
                查看详情
              </LobsterActionButton>
              <LobsterActionButton
                variant="danger"
                leadingIcon={<Trash2 className="h-4 w-4" />}
                disabled={removeBusySlug === agent.slug}
                onClick={(event) => {
                  event.stopPropagation();
                  onRemove(agent);
                }}
              >
                {removeBusySlug === agent.slug ? '移除中...' : '移除'}
              </LobsterActionButton>
            </div>
          </div>
        </PressableCard>
      ))}
    </div>
  );
}
