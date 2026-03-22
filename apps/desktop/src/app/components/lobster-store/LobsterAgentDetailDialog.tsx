import { useEffect } from 'react';
import { MessageSquare, Plus, ShieldCheck, X } from 'lucide-react';

import type { LobsterAgent } from '@/app/lib/lobster-store';
import { AvatarSurface } from '@/app/components/ui/AvatarSurface';
import { Chip } from '@/app/components/ui/Chip';
import { LobsterActionButton } from './LobsterActionButton';

export function LobsterAgentDetailDialog({
  agent,
  open,
  installBusy = false,
  onOpenChange,
  onInstall,
  onStartConversation,
}: {
  agent: LobsterAgent | null;
  open: boolean;
  installBusy?: boolean;
  onOpenChange: (open: boolean) => void;
  onInstall: (agent: LobsterAgent) => void;
  onStartConversation: (agent: LobsterAgent) => void;
}) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onOpenChange(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpenChange, open]);

  if (!agent || !open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="关闭弹窗"
        className="absolute inset-0 h-full w-full cursor-default bg-[var(--lobster-overlay-bg)] backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div className="absolute left-1/2 top-1/2 z-10 w-[min(860px,calc(100vw-40px))] max-h-[88vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[26px] border border-[var(--lobster-border)] bg-[var(--lobster-card-elevated)] p-7 shadow-[var(--lobster-shadow-modal)]">
        <button
          type="button"
          aria-label="关闭"
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--lobster-text-muted)] transition hover:bg-[var(--lobster-muted-bg)] hover:text-[var(--lobster-text-primary)]"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mx-auto max-w-[720px]">
          <div className="flex justify-center">
            <AvatarSurface src={agent.avatarSrc} alt={agent.name} sizeClassName="h-24 w-24" halo />
          </div>

          <div className="mt-5 text-center">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Chip tone="outline" className="px-2.5 py-1 text-[11px]">
                {agent.categoryLabel}
              </Chip>
              {agent.featured ? (
                <Chip tone="accent" className="px-2.5 py-1 text-[11px]">
                  官方精选
                </Chip>
              ) : null}
              {agent.installed ? (
                <Chip tone="success" className="px-2.5 py-1 text-[11px]">
                  已添加
                </Chip>
              ) : null}
            </div>
            <div className="mt-4 text-[28px] font-semibold tracking-[-0.05em] text-[var(--lobster-text-primary)]">
              {agent.name}
            </div>
            <div className="mx-auto mt-3 max-w-[620px] text-[14px] leading-6 text-[var(--lobster-text-secondary)]">
              {agent.description}
            </div>
          </div>

          <section className="mt-8">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--lobster-gold-strong)]">核心功能</div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {agent.capabilities.map((capability) => (
                <div
                  key={capability}
                  className="rounded-[18px] border border-[var(--lobster-border)] bg-[var(--lobster-card-bg)] px-4 py-3 text-[13px] leading-6 text-[var(--lobster-text-secondary)]"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--lobster-gold)]" />
                    <span>{capability}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-8">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--lobster-gold-strong)]">适用场景</div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
                {agent.use_cases.map((item) => (
                  <div
                    key={item}
                    className="rounded-[18px] border border-[var(--lobster-border)] bg-[var(--lobster-muted-bg)] px-4 py-3 text-[13px] leading-6 text-[var(--lobster-text-secondary)]"
                  >
                    <span>{item}</span>
                  </div>
                ))}
            </div>
          </section>

          <div className="mt-7 flex items-start gap-3 rounded-[18px] border border-[var(--lobster-success-border)] bg-[var(--lobster-success-soft)] px-4 py-3 text-[13px] leading-6 text-[var(--lobster-success-text)]">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <span>已通过安全合规验证，无恶意代码或数据泄露风险。</span>
          </div>

          <div className="mt-7">
            <LobsterActionButton
              block
              variant={agent.installed ? 'accent' : 'primary'}
              leadingIcon={agent.installed ? <MessageSquare className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              disabled={installBusy}
              onClick={() => {
                if (agent.installed) {
                  onStartConversation(agent);
                } else {
                  onInstall(agent);
                }
              }}
            >
              {agent.installed ? '对话' : installBusy ? '添加中...' : '添加'}
            </LobsterActionButton>
          </div>
        </div>
      </div>
    </div>
  );
}
