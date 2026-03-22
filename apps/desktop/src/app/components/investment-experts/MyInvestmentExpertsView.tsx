import { CheckCircle2 } from 'lucide-react';

import { STORE_SHELF_GRID_CLASS } from '@/app/components/ui/store-shelf';
import { InvestmentExpertCard } from './InvestmentExpertCard';
import type { InvestmentExpert } from '@/app/lib/investment-experts';

export function MyInvestmentExpertsView({
  experts,
  onOpenDetail,
  onInstall,
  onStartConversation,
}: {
  experts: InvestmentExpert[];
  onOpenDetail: (expert: InvestmentExpert) => void;
  onInstall: (expert: InvestmentExpert) => void;
  onStartConversation: (expert: InvestmentExpert) => void;
}) {
  if (experts.length === 0) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[20px] border border-dashed border-[var(--lobster-border)] bg-[var(--lobster-card-elevated)] px-8 text-center">
        <div className="flex h-[68px] w-[68px] items-center justify-center rounded-full border border-[var(--lobster-gold-border)] bg-[var(--lobster-gold-soft)] text-[var(--lobster-gold-strong)]">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <div className="mt-5 text-[20px] font-semibold tracking-[-0.04em] text-[var(--lobster-text-primary)]">
          还没有加入任何专家
        </div>
        <div className="mt-2 max-w-[420px] text-[13px] leading-6 text-[var(--lobster-text-secondary)]">
          先去全部专家页挑选适合你的投资专家，加入后会自动出现在这里。
        </div>
      </div>
    );
  }

  return (
    <div className={STORE_SHELF_GRID_CLASS}>
      {experts.map((expert) => (
        <InvestmentExpertCard
          key={expert.slug}
          expert={expert}
          mode="mine"
          onOpenDetail={onOpenDetail}
          onInstall={onInstall}
          onStartConversation={onStartConversation}
        />
      ))}
    </div>
  );
}
