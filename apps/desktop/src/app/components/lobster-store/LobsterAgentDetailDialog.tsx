import { MessageSquare, Plus, ShieldCheck, Sparkles } from 'lucide-react';

import type { LobsterAgent } from '@/app/lib/lobster-store';
import { AvatarSurface } from '@/app/components/ui/AvatarSurface';
import { Chip } from '@/app/components/ui/Chip';
import { DrawerSection } from '@/app/components/ui/DrawerSection';
import { InfoTile } from '@/app/components/ui/InfoTile';
import { SideDetailSheet } from '@/app/components/ui/SideDetailSheet';
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
  if (!agent || !open) {
    return null;
  }

  return (
    <SideDetailSheet
      open={open}
      onClose={() => onOpenChange(false)}
      eyebrow="龙虾详情"
      title={agent.name}
      header={
        <div className="flex min-w-0 items-start gap-4">
          <AvatarSurface src={agent.avatarSrc} alt={agent.name} sizeClassName="h-16 w-16" halo />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap gap-2">
              <Chip tone="outline" className="px-2.5 py-1 text-[11px]">
                {agent.categoryLabel}
              </Chip>
              {agent.featured ? (
                <Chip tone="accent" className="px-2.5 py-1 text-[11px]">
                  <Sparkles className="h-3.5 w-3.5" />
                  官方精选
                </Chip>
              ) : null}
              {agent.installed ? (
                <Chip tone="success" className="px-2.5 py-1 text-[11px]">
                  已添加
                </Chip>
              ) : null}
            </div>
            <p className="mt-3 break-words text-[13px] leading-6 text-[var(--lobster-text-secondary)] [overflow-wrap:anywhere]">
              {agent.description}
            </p>
          </div>
        </div>
      }
      footer={
        <div className="space-y-3">
          <div className="text-[13px] leading-6 text-[var(--text-secondary)]">
            {agent.installed
              ? '这个龙虾已经加入你的工作台，可直接发起对话。'
              : '添加后会进入“我的龙虾”，后续可以直接从商店或对话里调用。'}
          </div>
          <LobsterActionButton
            block
            variant={agent.installed ? 'accent' : 'primary'}
            leadingIcon={agent.installed ? <MessageSquare className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            disabled={installBusy}
            onClick={() => {
              if (agent.installed) {
                onStartConversation(agent);
                return;
              }
              onInstall(agent);
            }}
          >
            {agent.installed ? '对话' : installBusy ? '添加中...' : '添加'}
          </LobsterActionButton>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <InfoTile label="分类" value={agent.categoryLabel} />
          <InfoTile label="安装状态" value={agent.installed ? '已添加' : '未添加'} tone={agent.installed ? 'success' : 'neutral'} />
        </div>

        <DrawerSection title="核心功能">
          <div className="grid gap-3">
            {agent.capabilities.map((capability) => (
              <div
                key={capability}
                className="rounded-[18px] border border-[var(--lobster-border)] bg-[var(--lobster-card-bg)] px-4 py-3 text-[13px] leading-6 text-[var(--lobster-text-secondary)]"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--lobster-gold)]" />
                  <span className="break-words [overflow-wrap:anywhere]">{capability}</span>
                </div>
              </div>
            ))}
          </div>
        </DrawerSection>

        <DrawerSection title="适用场景">
          <div className="grid gap-3">
            {agent.use_cases.map((item) => (
              <div
                key={item}
                className="rounded-[18px] border border-[var(--lobster-border)] bg-[var(--lobster-muted-bg)] px-4 py-3 text-[13px] leading-6 text-[var(--lobster-text-secondary)]"
              >
                <span className="break-words [overflow-wrap:anywhere]">{item}</span>
              </div>
            ))}
          </div>
        </DrawerSection>

        <DrawerSection title="安全说明" icon={<ShieldCheck className="h-5 w-5" />}>
          <div className="rounded-[18px] border border-[var(--lobster-success-border)] bg-[var(--lobster-success-soft)] px-4 py-3 text-[13px] leading-6 text-[var(--lobster-success-text)]">
            已通过安全合规验证，无恶意代码或数据泄露风险。
          </div>
        </DrawerSection>
      </div>
    </SideDetailSheet>
  );
}
