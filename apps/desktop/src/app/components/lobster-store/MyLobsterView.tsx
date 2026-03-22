import { CheckCircle2, Eye, MessageSquare, Trash2 } from 'lucide-react';

import type { LobsterAgent } from '@/app/lib/lobster-store';
import { AvatarSurface } from '@/app/components/ui/AvatarSurface';
import { Chip } from '@/app/components/ui/Chip';
import { PressableCard } from '@/app/components/ui/PressableCard';
import { LobsterActionButton } from './LobsterActionButton';

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
  onStartConversation,
  onRemove,
}: {
  agents: LobsterAgent[];
  removeBusySlug: string | null;
  onOpenDetail: (agent: LobsterAgent) => void;
  onStartConversation: (agent: LobsterAgent) => void;
  onRemove: (agent: LobsterAgent) => void;
}) {
  if (agents.length === 0) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center rounded-[28px] border border-dashed border-[var(--lobster-border)] bg-[var(--lobster-card-bg)] px-8 text-center">
        <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full border border-[var(--lobster-gold-border)] bg-[var(--lobster-gold-soft)] text-[var(--lobster-gold-strong)]">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <div className="mt-5 text-[22px] font-semibold tracking-[-0.04em] text-[var(--lobster-text-primary)]">还没有添加任何龙虾</div>
        <div className="mt-2 max-w-[420px] text-[14px] leading-6 text-[var(--lobster-text-secondary)]">
          前往龙虾商店挑选适合你的预设助手，安装后会自动出现在这里。
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
      {agents.map((agent) => (
        <PressableCard
          key={agent.slug}
          interactive
          onClick={() => onOpenDetail(agent)}
          className="rounded-[24px] border-[var(--lobster-border)] bg-[var(--lobster-card-bg)] p-5 hover:border-[var(--lobster-gold-border)] hover:shadow-[var(--lobster-shadow-card)]"
        >
          <div className="flex gap-4">
            <AvatarSurface src={agent.avatarSrc} alt={agent.name} sizeClassName="h-16 w-16" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-[18px] font-semibold tracking-[-0.04em] text-[var(--lobster-text-primary)]">{agent.name}</div>
                <Chip tone="success" className="px-2.5 py-1 text-[11px]">
                  已添加
                </Chip>
              </div>
              <div className="mt-1.5 text-[13px] leading-6 text-[var(--lobster-text-secondary)]">{agent.description}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {agent.tags.slice(0, 3).map((tag) => (
                  <Chip key={tag} tone="outline" className="px-2.5 py-1 text-[11px]">
                    {tag}
                  </Chip>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-4 border-t border-[var(--lobster-border)] pt-4">
            <div className="text-[12px] text-[var(--lobster-text-muted)]">
              添加时间：<span className="text-[var(--lobster-text-secondary)]">{formatInstalledAt(agent.installedAt)}</span>
            </div>
            <div className="flex items-center gap-2">
              <LobsterActionButton
                variant="accent"
                leadingIcon={<MessageSquare className="h-4 w-4" />}
                onClick={(event) => {
                  event.stopPropagation();
                  onStartConversation(agent);
                }}
              >
                对话
              </LobsterActionButton>
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
