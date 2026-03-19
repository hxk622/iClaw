import { Coins, Crown, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { SecurityStatusBadge } from '@/app/components/ui/SecurityStatusBadge';

type IClawHeaderProps = {
  balance: number | null;
  loading?: boolean;
  authenticated: boolean;
  onCreditsClick: () => void;
  onSubscriptionClick: () => void;
};

type MarketData = {
  name: string;
  value: string;
  change: number;
  changePercent: string;
};

const MARKET_DATA: MarketData[] = [
  { name: '沪深300', value: '3942.18', change: 0.86, changePercent: '+0.86%' },
  { name: '纳指100', value: '20214.46', change: 1.24, changePercent: '+1.24%' },
  { name: '恒生科技', value: '3487.27', change: -0.38, changePercent: '-0.38%' },
  { name: 'S&P500', value: '5847.63', change: 0.52, changePercent: '+0.52%' },
];

function formatBalance(value: number | null, authenticated: boolean, loading: boolean): string {
  if (!authenticated || loading || value == null) {
    return '--';
  }
  return new Intl.NumberFormat('zh-CN').format(value);
}

function getTrendIcon(change: number) {
  if (change > 0) {
    return <TrendingUp className="h-3 w-3" />;
  }
  if (change < 0) {
    return <TrendingDown className="h-3 w-3" />;
  }
  return <Minus className="h-3 w-3" />;
}

function getChangeClassName(change: number): string {
  if (change > 0) {
    return 'text-[#16a34a] dark:text-[#22c55e]';
  }
  if (change < 0) {
    return 'text-[#dc2626] dark:text-[#ef4444]';
  }
  return 'text-gray-500 dark:text-gray-400';
}

export function IClawHeader({
  balance,
  loading = false,
  authenticated,
  onCreditsClick,
  onSubscriptionClick,
}: IClawHeaderProps) {
  const balanceText = formatBalance(balance, authenticated, loading);

  return (
    <header className="border-b border-gray-200/60 bg-gradient-to-b from-white/95 to-gray-50/90 backdrop-blur-sm dark:border-gray-800/40 dark:from-gray-900/95 dark:to-gray-950/90">
      <div className="flex h-11 items-center justify-between gap-4 px-6">
        <div className="flex min-w-0 items-center gap-4">
          <SecurityStatusBadge state="protecting" size="md" label="安全防护中" className="shrink-0" />
          <div className="h-4 w-px shrink-0 bg-gray-200/50 dark:bg-gray-700/40" />
          <div className="flex min-w-0 items-center gap-5 overflow-hidden">
            {MARKET_DATA.map((market, index) => (
              <div key={market.name} className="flex shrink-0 items-center gap-2.5">
                <span className="text-[11px] font-medium tracking-tight text-gray-500 dark:text-gray-400">
                  {market.name}
                </span>
                <span className="text-[13px] font-medium tracking-tight tabular-nums text-gray-900 dark:text-gray-100">
                  {market.value}
                </span>
                <div className={`flex items-center gap-0.5 ${getChangeClassName(market.change)}`}>
                  <span className="scale-90">{getTrendIcon(market.change)}</span>
                  <span className="text-[11px] font-medium tracking-tight tabular-nums">
                    {market.changePercent}
                  </span>
                </div>
                {index < MARKET_DATA.length - 1 ? (
                  <div className="ml-2.5 h-3 w-px shrink-0 bg-gray-200/50 dark:bg-gray-700/40" />
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            className="group relative flex items-center gap-1.5 rounded px-2.5 py-1 transition-all duration-200 hover:bg-gray-100/50 dark:hover:bg-gray-800/30"
            onClick={onCreditsClick}
          >
            <Coins className="h-3.5 w-3.5 text-gray-500 transition-colors group-hover:text-gray-900 dark:text-gray-400 dark:group-hover:text-gray-100" />
            <span className="text-[12px] font-medium tracking-tight tabular-nums text-gray-900 dark:text-gray-100">
              {balanceText}
            </span>
            <div className="absolute -bottom-[11px] left-0 right-0 h-px bg-gray-400 opacity-0 transition-opacity duration-200 group-hover:opacity-100 dark:bg-gray-500" />
          </button>

          <div className="h-4 w-px bg-gray-200/50 dark:bg-gray-700/40" />

          <button
            type="button"
            className="group relative flex items-center gap-1.5 rounded px-2.5 py-1 transition-all duration-200 hover:bg-gray-100/50 dark:hover:bg-gray-800/30"
            onClick={onSubscriptionClick}
          >
            <Crown className="h-3.5 w-3.5 text-gray-500 transition-colors group-hover:text-gray-900 dark:text-gray-400 dark:group-hover:text-gray-100" />
            <span className="text-[12px] font-medium tracking-tight text-gray-900 dark:text-gray-100">
              订阅
            </span>
            <div className="absolute -bottom-[11px] left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-400 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100 dark:via-gray-500" />
          </button>
        </div>
      </div>
    </header>
  );
}
