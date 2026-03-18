import { useEffect } from 'react';
import { CheckCircle2, Plus, ShieldCheck, X } from 'lucide-react';

import type { LobsterAgent } from '@/app/lib/lobster-store';
import { LobsterActionButton } from './LobsterActionButton';
import { LobsterBadge } from './LobsterBadge';

export function LobsterAgentDetailDialog({
  agent,
  open,
  installBusy = false,
  onOpenChange,
  onInstall,
}: {
  agent: LobsterAgent | null;
  open: boolean;
  installBusy?: boolean;
  onOpenChange: (open: boolean) => void;
  onInstall: (agent: LobsterAgent) => void;
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
      <div className="absolute left-1/2 top-1/2 z-10 w-[min(920px,calc(100vw-48px))] max-h-[90vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[32px] border border-[var(--lobster-border)] bg-[var(--lobster-card-elevated)] p-9 shadow-[var(--lobster-shadow-modal)]">
        <button
          type="button"
          aria-label="关闭"
          onClick={() => onOpenChange(false)}
          className="absolute right-5 top-5 inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--lobster-text-muted)] transition hover:bg-[var(--lobster-muted-bg)] hover:text-[var(--lobster-text-primary)]"
        >
            <X className="h-5 w-5" />
        </button>

        <div className="mx-auto max-w-[760px]">
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-[-18px] rounded-full bg-[radial-gradient(circle,rgba(168,140,93,0.24),transparent_65%)]" />
              <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-[var(--lobster-gold-border)] bg-[var(--lobster-card-bg)] shadow-[var(--lobster-shadow-avatar)]">
                <img src={agent.avatarSrc} alt={agent.name} className="h-full w-full object-cover" />
              </div>
            </div>
          </div>

          <div className="mt-6 text-center">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <LobsterBadge tone="category">{agent.categoryLabel}</LobsterBadge>
              {agent.featured ? <LobsterBadge tone="featured">官方精选</LobsterBadge> : null}
              {agent.installed ? <LobsterBadge tone="installed">已添加</LobsterBadge> : null}
            </div>
            <div className="mt-5 text-[32px] font-semibold tracking-[-0.05em] text-[var(--lobster-text-primary)]">
              {agent.name}
            </div>
            <div className="mx-auto mt-4 max-w-[680px] text-[15px] leading-8 text-[var(--lobster-text-secondary)]">
              {agent.description}
            </div>
          </div>

          <section className="mt-10">
            <div className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[var(--lobster-gold-strong)]">核心功能</div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {agent.capabilities.map((capability) => (
                <div
                  key={capability}
                  className="rounded-[22px] border border-[var(--lobster-border)] bg-[var(--lobster-card-bg)] px-5 py-4 text-[14px] leading-7 text-[var(--lobster-text-secondary)]"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--lobster-gold)]" />
                    <span>{capability}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-10">
            <div className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[var(--lobster-gold-strong)]">适用场景</div>
            <div className="mt-5 rounded-[26px] border border-[var(--lobster-border)] bg-[var(--lobster-muted-bg)] px-6 py-5">
              <ul className="space-y-3 text-[14px] leading-7 text-[var(--lobster-text-secondary)]">
                {agent.use_cases.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--lobster-gold)]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <div className="mt-8 flex items-start gap-3 rounded-[20px] border border-[var(--lobster-success-border)] bg-[var(--lobster-success-soft)] px-5 py-4 text-[13px] leading-6 text-[var(--lobster-success-text)]">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <span>已通过安全合规验证，无恶意代码或数据泄露风险。</span>
          </div>

          <div className="mt-8">
            <LobsterActionButton
              block
              variant={agent.installed ? 'secondary' : 'primary'}
              leadingIcon={agent.installed ? <CheckCircle2 className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
              disabled={agent.installed || installBusy}
              onClick={() => {
                if (!agent.installed) {
                  onInstall(agent);
                }
              }}
            >
              {agent.installed ? '已添加到我的龙虾' : installBusy ? '添加中...' : '添加'}
            </LobsterActionButton>
          </div>
        </div>
      </div>
    </div>
  );
}
