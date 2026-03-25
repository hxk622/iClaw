import type {ButtonHTMLAttributes, ReactNode} from 'react';
import {useDeferredValue, useEffect, useState} from 'react';
import type {IClawClient, MarketStockData} from '@iclaw/sdk';
import {BookmarkPlus, MessageSquare, Search, TrendingDown, TrendingUp, X} from 'lucide-react';

import {PageContent, PageHeader, PageSurface} from '@/app/components/ui/PageLayout';
import {Chip} from '@/app/components/ui/Chip';
import {cn} from '@/app/lib/cn';

const EXCHANGE_TABS = [
  {label: '全部A股', value: ''},
  {label: '沪市', value: 'sh'},
  {label: '深市', value: 'sz'},
  {label: '北交所', value: 'bj'},
] as const;

const FILTER_TAGS = ['低估值', '大盘核心', '高换手', '强势异动', '小盘成长', '高成交额'] as const;

const GROUP_DEFINITIONS = [
  {key: '低估值', description: '估值处于较低区间，优先看有安全边际的候选池', sort: 'pe_ttm_asc'},
  {key: '大盘核心', description: '市值体量大、成交深、适合作为核心观察池', sort: 'market_cap_desc'},
  {key: '高换手', description: '成交和换手都比较活跃，适合跟踪市场正在交易什么', sort: 'turnover_rate_desc'},
  {key: '强势异动', description: '短线涨幅较高，用来捕捉日内和近期异动', sort: 'change_percent_desc'},
] as const;

type StockGroupSection = {
  key: string;
  description: string;
  sort: string;
  items: MarketStockData[];
};

function normalizeStockMarketErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return '股票市场加载失败，请稍后重试。';
  }
  const message = error.message.trim();
  if (!message) {
    return '股票市场加载失败，请稍后重试。';
  }
  if (/route not found/i.test(message)) {
    return '股票市场接口尚未在当前 control-plane 进程生效，正在命中旧服务。请刷新运行中的本地服务。';
  }
  if (/failed to fetch|networkerror|fetch failed/i.test(message)) {
    return '无法连接股票市场服务，请确认本地 control-plane 已启动。';
  }
  return message;
}

function formatCompactNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '--';
  const abs = Math.abs(value);
  if (abs >= 1_0000_0000_0000) return `${(value / 1_0000_0000_0000).toFixed(2)}万亿`;
  if (abs >= 1_0000_0000) return `${(value / 1_0000_0000).toFixed(2)}亿`;
  if (abs >= 1_0000) return `${(value / 1_0000).toFixed(2)}万`;
  return value.toFixed(2);
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '--';
  return `${value.toFixed(2)}%`;
}

function formatSignedPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '--';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '--';
  return value.toFixed(2);
}

function formatDatetime(value: string | null | undefined): string {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString('zh-CN', {hour12: false});
}

function formatPe(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '--';
  return value.toFixed(2);
}

function exchangeLabel(exchange: MarketStockData['exchange']): string {
  if (exchange === 'sh') return '沪市';
  if (exchange === 'sz') return '深市';
  return '北交所';
}

function companyMonogram(name: string): string {
  const compact = name.replace(/\s+/g, '');
  return compact.slice(0, Math.min(2, compact.length)) || '--';
}

function buildCardSummary(stock: MarketStockData): string {
  const segments: string[] = [];
  if (stock.board) segments.push(`${stock.board}跟踪标的`);
  if (stock.strategy_tags.length > 0) segments.push(`命中 ${stock.strategy_tags.slice(0, 2).join(' / ')} 策略篮子`);
  if (typeof stock.total_market_cap === 'number' && Number.isFinite(stock.total_market_cap)) {
    segments.push(`总市值 ${formatCompactNumber(stock.total_market_cap)}`);
  }
  return segments.join('，') || 'A股全量快照标的';
}

function buildInvestmentLogic(stock: MarketStockData): string[] {
  const points: string[] = [];

  if (stock.strategy_tags.includes('低估值') || (typeof stock.pe_ttm === 'number' && stock.pe_ttm > 0 && stock.pe_ttm < 20)) {
    points.push('估值处于相对克制区间，可以继续核验盈利兑现能力和安全边际。');
  }
  if (stock.strategy_tags.includes('高换手') || (typeof stock.turnover_rate === 'number' && stock.turnover_rate >= 5)) {
    points.push('交易活跃度较高，资金关注度强，更适合放入事件和催化跟踪池。');
  }
  if (stock.strategy_tags.includes('强势异动') || (typeof stock.change_percent === 'number' && Math.abs(stock.change_percent) >= 7)) {
    points.push('短线波动已经放大，说明价格发现正在加速，需要结合消息面判断持续性。');
  }
  if (stock.board && /科创板|创业板/.test(stock.board)) {
    points.push(`${stock.board}属性明显，景气度、政策窗口和风险偏好会直接影响估值弹性。`);
  }
  if (points.length === 0) {
    points.push('当前更适合作为基础覆盖标的，先从行业位置、盈利质量和估值中枢建立跟踪框架。');
  }
  return points.slice(0, 3);
}

function buildRiskAlerts(stock: MarketStockData): string[] {
  const risks: string[] = [];

  if (stock.status === 'suspended') {
    risks.push('当前标的存在停牌或无实时报价情况，流动性与价格连续性需要单独核验。');
  }
  if (typeof stock.pe_ttm === 'number' && stock.pe_ttm <= 0) {
    risks.push('TTM 市盈率为负，说明利润端仍不稳定，不能只靠估值倍数下结论。');
  }
  if (typeof stock.turnover_rate === 'number' && stock.turnover_rate >= 10) {
    risks.push('换手率偏高，短线筹码博弈明显，价格波动可能大于基本面变化。');
  }
  if (typeof stock.total_market_cap === 'number' && stock.total_market_cap > 0 && stock.total_market_cap <= 50_0000_0000) {
    risks.push('市值体量偏中小盘，弹性更大，但流动性和回撤风险也会更集中。');
  }
  if (risks.length === 0) {
    risks.push('建议继续核验行业景气、财务质量和事件催化，避免单日行情驱动下的误判。');
  }
  return risks.slice(0, 3);
}

function stockTagClasses(tag: string): string {
  if (tag === '低估值') {
    return 'bg-[#5B4614] text-[#F8E7AF] ring-1 ring-inset ring-[#8F6A14] dark:bg-[#6E5414] dark:text-[#F8E1A0] dark:ring-[#B68A1B]';
  }
  if (tag === '大盘核心') {
    return 'bg-[#1E3652] text-[#D6E7FB] ring-1 ring-inset ring-[#35557A] dark:bg-[#27415F] dark:text-[#DDEBFA] dark:ring-[#476B96]';
  }
  if (tag === '高换手') {
    return 'bg-[#4A2E66] text-[#E8D8FF] ring-1 ring-inset ring-[#6A4691] dark:bg-[#5B387C] dark:text-[#EDDEFF] dark:ring-[#8458B0]';
  }
  if (tag === '强势异动') {
    return 'bg-[#612A2D] text-[#FFD8DC] ring-1 ring-inset ring-[#8A4046] dark:bg-[#723238] dark:text-[#FFE1E5] dark:ring-[#A8525A]';
  }
  if (tag === '小盘成长') {
    return 'bg-[#1C4A3C] text-[#CDEFE0] ring-1 ring-inset ring-[#2E6B57] dark:bg-[#205445] dark:text-[#D8F7E8] dark:ring-[#367762]';
  }
  if (tag === '高成交额') {
    return 'bg-[#144A58] text-[#D0F2F8] ring-1 ring-inset ring-[#2B6C7D] dark:bg-[#1A5666] dark:text-[#DCF7FB] dark:ring-[#397E91]';
  }
  if (tag === '科创板') {
    return 'bg-[#243A62] text-[#D8E4FF] ring-1 ring-inset ring-[#3C5C93] dark:bg-[#2B4775] dark:text-[#E0E9FF] dark:ring-[#5272AC]';
  }
  if (tag === '创业板') {
    return 'bg-[#624018] text-[#FFE4BE] ring-1 ring-inset ring-[#8F6127] dark:bg-[#764D1C] dark:text-[#FFE9C9] dark:ring-[#A87432]';
  }
  if (tag === '主板') {
    return 'bg-[#383838] text-[#E7E5E1] ring-1 ring-inset ring-[#575757] dark:bg-[#414141] dark:text-[#F1EEE9] dark:ring-[#676767]';
  }
  return 'bg-[#2A4A6F] text-white ring-1 ring-inset ring-[#456A96] dark:bg-[#304F71] dark:text-white dark:ring-[#4B739C]';
}

function MarketActionButton({
  children,
  className,
  leadingIcon,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  leadingIcon?: ReactNode;
}) {
  return (
    <button
      type={props.type || 'button'}
      className={cn(
        'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-[12px] border px-3 py-2 text-[12px] font-semibold tracking-[0.01em] transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-[#4E6E94]/30',
        'disabled:cursor-not-allowed disabled:opacity-45 disabled:saturate-75',
        className,
      )}
      {...props}
    >
      {leadingIcon ? <span className="shrink-0">{leadingIcon}</span> : null}
      <span>{children}</span>
    </button>
  );
}

function EmptyPanel({title, description}: {title: string; description: string}) {
  return (
    <div className="rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-6 py-10 text-center">
      <div className="text-[18px] font-semibold text-[var(--text-primary)]">{title}</div>
      <div className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">{description}</div>
    </div>
  );
}

function StatusPanel({
  title,
  description,
  tone = 'neutral',
}: {
  title: string;
  description: string;
  tone?: 'neutral' | 'danger';
}) {
  return (
    <div
      className={cn(
        'rounded-[24px] border px-6 py-10 text-center',
        tone === 'danger'
          ? 'border-[rgba(239,68,68,0.16)] bg-[rgba(62,20,20,0.42)]'
          : 'border border-[var(--border-default)] bg-[var(--bg-elevated)]',
      )}
    >
      <div className={cn('text-[18px] font-semibold', tone === 'danger' ? 'text-[rgb(248,113,113)]' : 'text-[var(--text-primary)]')}>{title}</div>
      <div className={cn('mt-2 text-[13px] leading-6', tone === 'danger' ? 'text-[rgba(254,226,226,0.82)]' : 'text-[var(--text-secondary)]')}>{description}</div>
    </div>
  );
}

function StockCard({
  stock,
  active,
  onClick,
  onStartResearch,
}: {
  stock: MarketStockData;
  active: boolean;
  onClick: () => void;
  onStartResearch?: (stock: MarketStockData) => void;
}) {
  const positive = (stock.change_percent ?? 0) >= 0;
  const bottomMetrics = [
    {label: 'PE', value: formatPe(stock.pe_ttm)},
    {label: '换手', value: formatPercent(stock.turnover_rate)},
    {label: '成交额', value: formatCompactNumber(stock.amount)},
  ].filter((item) => item.value !== '--');

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
      className={cn(
        'relative flex h-full cursor-pointer flex-col rounded-[18px] border p-4 text-left transition-all duration-200',
        'bg-white dark:bg-[#1A1A1A]',
        active
          ? 'border-[#2A4A6F] bg-[#EAF0F6] shadow-[0_12px_30px_rgba(42,74,111,0.14)] dark:bg-[#1E3A5F]/30 dark:border-[#3A5A8F]'
          : 'border-[#E5E5E4] hover:border-[#2A4A6F] hover:shadow-[0_12px_28px_rgba(17,24,39,0.08)] dark:border-[#3A3A3A] dark:hover:border-[#3A5A8F]',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-[#18324A] text-[15px] font-semibold tracking-[0.08em] text-white dark:bg-[#243A52]">
          {companyMonogram(stock.company_name)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-[16px] font-medium text-[#1A1A1A] dark:text-[#F7F7F5]">{stock.company_name}</span>
                <span className="shrink-0 text-[13px] text-[#6B6B6A] dark:text-[#9B9B9A]">{stock.symbol}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="rounded bg-[#F0F0EF] px-2 py-0.5 text-[11px] text-[#6B6B6A] dark:bg-[#2A2A2A] dark:text-[#9B9B9A]">
                  {exchangeLabel(stock.exchange)}
                </span>
                <span className="text-[12px] text-[#6B6B6A] dark:text-[#9B9B9A]">{stock.board || 'A股'}</span>
              </div>
            </div>

            <div className="shrink-0 text-right">
              <div className="text-[20px] font-semibold tracking-[-0.04em] text-[#1A1A1A] dark:text-[#F7F7F5]">
                ¥{formatPrice(stock.current_price)}
              </div>
              <div
                className={cn(
                  'mt-1 inline-flex items-center justify-end gap-1 text-[13px] font-medium',
                  positive ? 'text-[#059669] dark:text-[#10B981]' : 'text-[#DC2626] dark:text-[#EF4444]',
                )}
              >
                {positive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                <span>{formatSignedPercent(stock.change_percent)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {stock.strategy_tags.slice(0, 4).map((tag) => (
          <span key={tag} className={cn('rounded px-2 py-0.5 text-[11px]', stockTagClasses(tag))}>
            {tag}
          </span>
        ))}
      </div>

      <p className="mt-3 line-clamp-2 text-[13px] leading-6 text-[#4A4A49] dark:text-[#B0B0AF]">{buildCardSummary(stock)}</p>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
          {bottomMetrics.map((metric) => (
            <div key={metric.label} className="flex items-center gap-1">
              <span className="text-[11px] text-[#9B9B9A] dark:text-[#6B6B6A]">{metric.label}</span>
              <span className="text-[13px] text-[#2A2A2A] dark:text-[#E5E5E4]">{metric.value}</span>
            </div>
          ))}
        </div>

        <MarketActionButton
          className="h-8 border-[#38577C] bg-[#1E3A5F] text-white shadow-[0_8px_18px_rgba(18,35,56,0.26)] hover:bg-[#2A4A6F] dark:border-[#4A6D94] dark:bg-[#2A4A6F] dark:text-white dark:hover:bg-[#355883]"
          leadingIcon={<MessageSquare className="h-3.5 w-3.5" />}
          onClick={(event) => {
            event.stopPropagation();
            onStartResearch?.(stock);
          }}
        >
          AI 对话
        </MarketActionButton>
      </div>
    </div>
  );
}

function StockGrid({
  stocks,
  selectedStockId,
  onSelectStock,
  onStartResearch,
}: {
  stocks: MarketStockData[];
  selectedStockId: string | null;
  onSelectStock: (stockId: string) => void;
  onStartResearch?: (stock: MarketStockData) => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {stocks.map((stock) => (
        <StockCard
          key={stock.id}
          stock={stock}
          active={selectedStockId === stock.id}
          onClick={() => onSelectStock(stock.id)}
          onStartResearch={onStartResearch}
        />
      ))}
    </div>
  );
}

function StockDetailDrawer({
  stock,
  loading,
  onClose,
  onStartResearch,
}: {
  stock: MarketStockData | null;
  loading: boolean;
  onClose: () => void;
  onStartResearch?: (stock: MarketStockData) => void;
}) {
  if (!stock && !loading) return null;

  const positive = (stock?.change_percent ?? 0) >= 0;
  const investmentLogic = stock ? buildInvestmentLogic(stock) : [];
  const riskAlerts = stock ? buildRiskAlerts(stock) : [];

  return (
    <>
      <div
        className="fixed inset-0 z-40 cursor-pointer bg-black/20 backdrop-blur-[2px] dark:bg-black/40"
        onClick={onClose}
      />

      <aside className="fixed right-0 top-0 bottom-0 z-50 flex w-[560px] max-w-[calc(100vw-20px)] flex-col bg-white shadow-2xl dark:bg-[#252525]">
        <div className="border-b border-[#E5E5E4] px-6 py-5 dark:border-[#3A3A3A]">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-[22px] font-semibold tracking-[-0.04em] text-[#1A1A1A] dark:text-[#F7F7F5]">
                  {loading ? '加载中...' : stock?.company_name}
                </h2>
                {stock ? <span className="text-[15px] text-[#6B6B6A] dark:text-[#9B9B9A]">{stock.symbol}</span> : null}
                {stock ? (
                  <span className="rounded bg-[#F0F0EF] px-2 py-0.5 text-[11px] text-[#6B6B6A] dark:bg-[#2A2A2A] dark:text-[#9B9B9A]">
                    {exchangeLabel(stock.exchange)}
                  </span>
                ) : null}
              </div>

              {stock ? (
                <>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {stock.board ? (
                      <span className="rounded bg-[#F0F0EF] px-2 py-0.5 text-[11px] text-[#6B6B6A] dark:bg-[#2A2A2A] dark:text-[#9B9B9A]">
                        {stock.board}
                      </span>
                    ) : null}
                    {stock.status === 'suspended' ? (
                      <span className="rounded bg-[#FEF3F2] px-2 py-0.5 text-[11px] text-[#B91C1C] dark:bg-[#3A1A1A] dark:text-[#EF4444]">
                        停牌/无实时报价
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4 flex items-end gap-3">
                    <span className="text-[30px] font-semibold tracking-[-0.05em] text-[#1A1A1A] dark:text-[#F7F7F5]">
                      ¥{formatPrice(stock.current_price)}
                    </span>
                    <span
                      className={cn(
                        'mb-1 inline-flex items-center gap-1 text-[15px] font-semibold',
                        positive ? 'text-[#059669] dark:text-[#10B981]' : 'text-[#DC2626] dark:text-[#EF4444]',
                      )}
                    >
                      {positive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                      {formatSignedPercent(stock.change_percent)}
                    </span>
                  </div>
                </>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-[#5C564E] transition-colors hover:bg-[#F0F0EF] dark:text-[#9B9B9A] dark:hover:bg-[#2A2A2A]"
                aria-label="加入跟踪"
              >
                <BookmarkPlus className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-[#5C564E] transition-colors hover:bg-[#F0F0EF] dark:text-[#9B9B9A] dark:hover:bg-[#2A2A2A]"
                aria-label="关闭详情抽屉"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading || !stock ? (
            <div className="space-y-3">
              {Array.from({length: 5}).map((_, index) => (
                <div key={index} className="h-24 animate-pulse rounded-[18px] bg-[#F9F8F6] dark:bg-[#1A1A1A]" />
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              <section>
                <h3 className="mb-3 text-[13px] font-medium text-[#1A1A1A] dark:text-[#F7F7F5]">概览</h3>
                <div className="rounded-lg bg-[#F9F8F6] p-4 dark:bg-[#1A1A1A]">
                  <p className="text-[14px] leading-7 text-[#3F3A34] dark:text-[#C7C2BA]">{buildCardSummary(stock)}</p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[11px] text-[#8A847C] dark:text-[#807B75]">总市值</span>
                      <p className="mt-1 text-[14px] text-[#2A2A2A] dark:text-[#E5E5E4]">{formatCompactNumber(stock.total_market_cap)}</p>
                    </div>
                    <div>
                      <span className="text-[11px] text-[#8A847C] dark:text-[#807B75]">流通市值</span>
                      <p className="mt-1 text-[14px] text-[#2A2A2A] dark:text-[#E5E5E4]">{formatCompactNumber(stock.circulating_market_cap)}</p>
                    </div>
                    <div>
                      <span className="text-[11px] text-[#8A847C] dark:text-[#807B75]">市盈率 TTM</span>
                      <p className="mt-1 text-[14px] text-[#2A2A2A] dark:text-[#E5E5E4]">{formatPe(stock.pe_ttm)}</p>
                    </div>
                    <div>
                      <span className="text-[11px] text-[#8A847C] dark:text-[#807B75]">更新时间</span>
                      <p className="mt-1 text-[14px] text-[#2A2A2A] dark:text-[#E5E5E4]">{formatDatetime(stock.updated_at)}</p>
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-[13px] font-medium text-[#1A1A1A] dark:text-[#F7F7F5]">关键指标</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    {label: '涨跌幅', value: formatSignedPercent(stock.change_percent), accent: positive ? 'text-[#059669] dark:text-[#10B981]' : 'text-[#DC2626] dark:text-[#EF4444]'},
                    {label: '换手率', value: formatPercent(stock.turnover_rate), accent: 'text-[#2A2A2A] dark:text-[#E5E5E4]'},
                    {label: '开盘价', value: `¥${formatPrice(stock.open_price)}`, accent: 'text-[#2A2A2A] dark:text-[#E5E5E4]'},
                    {label: '昨收价', value: `¥${formatPrice(stock.prev_close)}`, accent: 'text-[#2A2A2A] dark:text-[#E5E5E4]'},
                    {label: '成交额', value: formatCompactNumber(stock.amount), accent: 'text-[#2A2A2A] dark:text-[#E5E5E4]'},
                    {label: '研究标签', value: `${stock.strategy_tags.length} 个`, accent: 'text-[#2A2A2A] dark:text-[#E5E5E4]'},
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg bg-[#F9F8F6] p-3 dark:bg-[#1A1A1A]">
                      <span className="text-[11px] text-[#8A847C] dark:text-[#807B75]">{item.label}</span>
                      <p className={cn('mt-1 text-[18px] font-medium', item.accent)}>{item.value}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-[13px] font-medium text-[#1A1A1A] dark:text-[#F7F7F5]">策略标签</h3>
                <div className="flex flex-wrap gap-2 rounded-lg bg-[#F9F8F6] p-4 dark:bg-[#1A1A1A]">
                  {stock.strategy_tags.length > 0 ? (
                    stock.strategy_tags.map((tag) => (
                      <span key={tag} className={cn('rounded px-2.5 py-1 text-[12px]', stockTagClasses(tag))}>
                        {tag}
                      </span>
                    ))
                  ) : (
                    <p className="text-[13px] text-[#6B6B6A] dark:text-[#9B9B9A]">当前快照还没有命中策略标签。</p>
                  )}
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-[13px] font-medium text-[#1A1A1A] dark:text-[#F7F7F5]">投资逻辑</h3>
                <div className="space-y-2">
                  {investmentLogic.map((item) => (
                    <div key={item} className="flex items-start gap-2">
                      <div className="mt-2 h-1.5 w-1.5 rounded-full bg-[#A67C00] dark:bg-[#D4A72C]" />
                      <p className="flex-1 text-[13px] leading-6 text-[#4A4A49] dark:text-[#B0B0AF]">{item}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-[13px] font-medium text-[#1A1A1A] dark:text-[#F7F7F5]">风险提示</h3>
                <div className="space-y-2">
                  {riskAlerts.map((item) => (
                    <div key={item} className="flex items-start gap-2 rounded-lg bg-[#FEF3F2] p-3 dark:bg-[#3A1A1A]">
                      <span className="mt-0.5 text-[12px] text-[#B91C1C] dark:text-[#EF4444]">•</span>
                      <p className="flex-1 text-[13px] leading-6 text-[#4A4A49] dark:text-[#B0B0AF]">{item}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>

        <div className="border-t border-[#E5E5E4] bg-[#F7F3EC] px-6 py-4 dark:border-[#3A3A3A] dark:bg-[#252525]">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7B7368] dark:text-[#8C867E]">AI 研究操作</div>
          <div className="space-y-2">
            <MarketActionButton
              className="flex h-11 w-full border-[#446A96] bg-[linear-gradient(180deg,#31557D_0%,#213C5C_100%)] text-white shadow-[0_12px_22px_rgba(8,16,28,0.32)] hover:border-[#5A81AF] hover:bg-[linear-gradient(180deg,#3B628C_0%,#274668_100%)] dark:border-[#4A719D] dark:bg-[linear-gradient(180deg,#355B85_0%,#234160_100%)] dark:text-white dark:hover:border-[#638AB7] dark:hover:bg-[linear-gradient(180deg,#406894_0%,#294A6D_100%)]"
              disabled={!stock}
              onClick={() => stock && onStartResearch?.(stock)}
            >
              查看深度分析
            </MarketActionButton>
            <MarketActionButton
              className="flex h-11 w-full border-[#D6CCBF] bg-white text-[#2F2A24] shadow-[0_8px_18px_rgba(36,30,20,0.06)] hover:border-[#C6B8A5] hover:bg-[#F5EFE6] dark:border-[#4A4640] dark:bg-[#1D1D1D] dark:text-[#F0ECE4] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] dark:hover:border-[#605B54] dark:hover:bg-[#242424]"
              disabled={!stock}
              onClick={() => stock && onStartResearch?.(stock)}
            >
              发起 AI 研究
            </MarketActionButton>
            <MarketActionButton
              className="flex h-11 w-full border-[#D9D0C4] bg-transparent text-[#655C50] hover:border-[#C7B9A8] hover:bg-[#EEE7DE] dark:border-[#373737] dark:bg-transparent dark:text-[#C8C2B8] dark:hover:border-[#4B4B4B] dark:hover:bg-[#262626]"
              onClick={onClose}
            >
              关闭抽屉
            </MarketActionButton>
          </div>
        </div>
      </aside>
    </>
  );
}

function SectionSkeleton() {
  return (
    <section className="overflow-hidden rounded-xl border border-[#E5E5E4] bg-white dark:border-[#3A3A3A] dark:bg-[#252525]">
      <div className="border-b border-[#E5E5E4] bg-[#FAFAF8] px-5 py-4 dark:border-[#3A3A3A] dark:bg-[#1A1A1A]">
        <div className="h-4 w-28 animate-pulse rounded bg-[#E5E5E4] dark:bg-[#2A2A2A]" />
        <div className="mt-2 h-3 w-40 animate-pulse rounded bg-[#ECECEC] dark:bg-[#232323]" />
      </div>
      <div className="grid gap-4 p-5 xl:grid-cols-2">
        {Array.from({length: 4}).map((_, index) => (
          <div key={index} className="h-[190px] animate-pulse rounded-[18px] bg-[#F5F4F2] dark:bg-[#1A1A1A]" />
        ))}
      </div>
    </section>
  );
}

export function StockMarketView({
  title = '股票市场',
  client,
  onStartResearch,
}: {
  title?: string;
  client: IClawClient;
  onStartResearch?: (stock: MarketStockData) => void;
}) {
  const [exchange, setExchange] = useState('');
  const [tag, setTag] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredQuery = useDeferredValue(searchQuery.trim());
  const [sortBy, setSortBy] = useState<'change_percent_desc' | 'market_cap_desc' | 'turnover_rate_desc' | 'pe_ttm_asc'>('change_percent_desc');
  const [sections, setSections] = useState<StockGroupSection[]>([]);
  const [listItems, setListItems] = useState<MarketStockData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStockId, setSelectedStockId] = useState<string | null>(null);
  const [selectedStock, setSelectedStock] = useState<MarketStockData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const showingSearchResults = Boolean(exchange || tag || deferredQuery);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    if (showingSearchResults) {
      void client
        .listMarketStocksPage({
          market: 'a_share',
          exchange: exchange || undefined,
          tag: tag || undefined,
          search: deferredQuery || undefined,
          sort: sortBy,
          limit: 120,
          offset: 0,
        })
        .then((page) => {
          if (cancelled) return;
          setListItems(page.items);
          setTotal(page.total);
          setSections([]);
        })
        .catch((loadError) => {
          if (cancelled) return;
          setError(normalizeStockMarketErrorMessage(loadError));
          setListItems([]);
          setSections([]);
          setTotal(0);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }

    void Promise.all(
      GROUP_DEFINITIONS.map(async (group) => {
        const page = await client.listMarketStocksPage({
          market: 'a_share',
          tag: group.key,
          sort: group.sort,
          limit: 8,
          offset: 0,
        });
        return {
          key: group.key,
          description: group.description,
          sort: group.sort,
          items: page.items,
        } satisfies StockGroupSection;
      }),
    )
      .then((nextSections) => {
        if (cancelled) return;
        setSections(nextSections.filter((section) => section.items.length > 0));
        setListItems([]);
        setTotal(nextSections.reduce((sum, section) => sum + section.items.length, 0));
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(normalizeStockMarketErrorMessage(loadError));
        setSections([]);
        setTotal(0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client, deferredQuery, exchange, showingSearchResults, sortBy, tag]);

  useEffect(() => {
    if (!selectedStockId) {
      setSelectedStock(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    void client
      .getMarketStock(selectedStockId)
      .then((detail) => {
        if (!cancelled) setSelectedStock(detail);
      })
      .catch(() => {
        if (!cancelled) setSelectedStock(null);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client, selectedStockId]);

  return (
    <PageSurface as="div" className="relative bg-[var(--lobster-page-bg)]">
      <PageContent className="max-w-none px-5 py-5 lg:px-6 xl:px-7">
        <PageHeader
          title={title}
          description="按策略篮子组织的 A 股研究工作台。支持筛选、检索、详情抽屉和 AI 研究接力。"
          actionsClassName="w-full xl:w-auto"
          actions={
            <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_176px] gap-3 xl:w-[560px] xl:max-w-[560px]">
              <label className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="搜索股票名称 / 代码"
                  className="h-12 w-full rounded-[16px] border border-[rgba(255,255,255,0.08)] bg-[rgba(24,22,20,0.96)] pl-10 pr-4 text-[13px] text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[rgba(210,176,106,0.42)] focus:ring-2 focus:ring-[rgba(210,176,106,0.12)]"
                />
              </label>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
                className="h-12 cursor-pointer rounded-[16px] border border-[rgba(255,255,255,0.08)] bg-[rgba(24,22,20,0.96)] px-4 text-[13px] text-[var(--text-primary)] outline-none"
              >
                <option value="change_percent_desc">排序: 涨跌幅</option>
                <option value="market_cap_desc">排序: 总市值</option>
                <option value="turnover_rate_desc">排序: 换手率</option>
                <option value="pe_ttm_asc">排序: 市盈率</option>
              </select>
            </div>
          }
        />

        <div className="mt-5 rounded-[24px] border border-[rgba(255,255,255,0.06)] bg-[rgba(24,22,20,0.94)] p-5 shadow-[0_18px_44px_rgba(0,0,0,0.18)]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">交易所</div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {EXCHANGE_TABS.map((item) => (
              <Chip
                key={item.label}
                clickable
                active={exchange === item.value}
                tone={exchange === item.value ? 'accent' : 'outline'}
                className={cn(
                  'px-3 py-2 text-[12px]',
                  exchange === item.value ? '' : 'border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] text-[var(--text-secondary)]',
                )}
                onClick={() => setExchange(item.value)}
              >
                {item.label}
              </Chip>
            ))}
          </div>
          <div className="mt-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">策略篮子</div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {FILTER_TAGS.map((item) => (
              <Chip
                key={item}
                clickable
                active={tag === item}
                tone={tag === item ? 'brand' : 'outline'}
                className={cn(
                  'px-3 py-2 text-[12px]',
                  tag === item ? '' : 'border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] text-[var(--text-secondary)]',
                )}
                onClick={() => setTag((current) => (current === item ? '' : item))}
              >
                {item}
              </Chip>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="mt-6 space-y-6">
            {Array.from({length: showingSearchResults ? 1 : 4}).map((_, index) => (
              <SectionSkeleton key={index} />
            ))}
          </div>
        ) : error ? (
          <div className="mt-6">
            <StatusPanel title="股票市场暂时不可用" description={error} tone="danger" />
          </div>
        ) : showingSearchResults ? (
          <div className="mt-6 space-y-4">
            <section className="overflow-hidden rounded-xl border border-[#E5E5E4] bg-white dark:border-[#3A3A3A] dark:bg-[#252525]">
              <div className="border-b border-[#E5E5E4] bg-[#FAFAF8] px-5 py-4 dark:border-[#3A3A3A] dark:bg-[#1A1A1A]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[16px] font-medium text-[#1A1A1A] dark:text-[#F7F7F5]">筛选结果</div>
                    <div className="mt-1 text-[12px] text-[#6B6B6A] dark:text-[#9B9B9A]">当前命中 {total} 只股票</div>
                  </div>
                </div>
              </div>
              <div className="p-5">
                {listItems.length === 0 ? (
                  <EmptyPanel title="没有匹配到股票" description="可以清空筛选条件，或者尝试股票代码、简称和更宽泛的关键词。" />
                ) : (
                  <StockGrid
                    stocks={listItems}
                    selectedStockId={selectedStockId}
                    onSelectStock={setSelectedStockId}
                    onStartResearch={onStartResearch}
                  />
                )}
              </div>
            </section>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {sections.map((section) => (
              <section
                key={section.key}
                className="overflow-hidden rounded-xl border border-[#E5E5E4] bg-white dark:border-[#3A3A3A] dark:bg-[#252525]"
              >
                <div className="border-b border-[#E5E5E4] bg-[#FAFAF8] px-5 py-4 dark:border-[#3A3A3A] dark:bg-[#1A1A1A]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[16px] font-medium text-[#1A1A1A] dark:text-[#F7F7F5]">{section.key}</div>
                      <div className="mt-1 text-[12px] text-[#6B6B6A] dark:text-[#9B9B9A]">{section.description}</div>
                    </div>
                    <div className="text-[12px] text-[#6B6B6A] dark:text-[#9B9B9A]">{section.items.length} 只</div>
                  </div>
                </div>
                <div className="p-5">
                  <StockGrid
                    stocks={section.items}
                    selectedStockId={selectedStockId}
                    onSelectStock={setSelectedStockId}
                    onStartResearch={onStartResearch}
                  />
                </div>
              </section>
            ))}
            {sections.length === 0 ? (
              <EmptyPanel title="A股目录还没有数据" description="先运行 A 股导入脚本，把全量股票快照写入 control-plane 数据库。" />
            ) : null}
          </div>
        )}
      </PageContent>

      <StockDetailDrawer
        stock={selectedStock}
        loading={detailLoading}
        onClose={() => setSelectedStockId(null)}
        onStartResearch={onStartResearch}
      />
    </PageSurface>
  );
}
