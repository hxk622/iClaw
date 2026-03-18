import { Coins } from 'lucide-react';

interface CreditBalancePillProps {
  balance: number | null;
  loading?: boolean;
  onClick?: () => void;
}

function formatBalance(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value);
}

export function CreditBalancePill({ balance, loading = false, onClick }: CreditBalancePillProps) {
  const lowBalance = typeof balance === 'number' && balance < 500;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`pointer-events-auto inline-flex min-w-[148px] items-center justify-between gap-3 rounded-full border px-4 py-2.5 text-left shadow-[0_16px_36px_rgba(15,23,42,0.12)] backdrop-blur ${
        lowBalance
          ? 'border-[rgba(217,119,6,0.22)] bg-[rgba(255,247,237,0.94)]'
          : 'border-[rgba(15,23,42,0.08)] bg-[rgba(255,255,255,0.94)]'
      }`}
    >
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(251,191,36,0.18)] text-[#b45309]">
        <Coins className="h-4.5 w-4.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
          龙虾币
        </span>
        <span className="mt-0.5 block truncate text-[15px] font-semibold text-[var(--text-primary)]">
          {loading ? '加载中...' : formatBalance(balance ?? 0)}
        </span>
      </span>
    </button>
  );
}
