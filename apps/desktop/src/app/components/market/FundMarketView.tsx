import {useDeferredValue, useEffect, useMemo, useState} from 'react';
import type {IClawClient, MarketFundData} from '@iclaw/sdk';
import {
  ArrowRight,
  BarChart3,
  BookmarkPlus,
  Filter,
  Globe2,
  MessageSquare,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  WalletCards,
  X,
} from 'lucide-react';

import {Button} from '@/app/components/ui/Button';
import {Chip} from '@/app/components/ui/Chip';
import {PageContent, PageHeader, PageSurface} from '@/app/components/ui/PageLayout';
import {cn} from '@/app/lib/cn';
import {INTERACTIVE_FOCUS_RING, SPRING_PRESSABLE} from '@/app/lib/ui-interactions';

type FundCategoryTab = 'all' | 'etf' | 'index' | 'dividend' | 'bond' | 'qdii' | 'active';
type FundRegion = 'A股' | '海外' | '全球';
type FundRisk = '低风险' | '中低风险' | '中风险' | '中高风险' | '高风险';

export type FundMarketResearchTarget = {
  id: string;
  symbol: string;
  companyName: string;
  exchange: 'sh' | 'sz' | 'otc';
  board: string | null;
  instrumentKind: 'fund' | 'etf' | 'qdii';
  instrumentLabel: string;
};

type FundItem = MarketFundData & {
  companyName: string;
  board: string | null;
  instrumentLabel: string;
  typeLabel: string;
  summary: string;
  aiFocus: string;
  watchlisted: boolean;
  themeKey: string | null;
};

type OverviewCard = {
  id: string;
  title: string;
  value: string;
  delta: string;
  positive: boolean;
  detail: string;
};

const CATEGORY_TABS: Array<{value: FundCategoryTab; label: string}> = [
  {value: 'all', label: '全部'},
  {value: 'etf', label: 'ETF'},
  {value: 'index', label: '指数基金'},
  {value: 'dividend', label: '红利策略'},
  {value: 'bond', label: '债券基金'},
  {value: 'qdii', label: 'QDII'},
  {value: 'active', label: '主动基金'},
];

const RISK_FILTERS: FundRisk[] = ['低风险', '中低风险', '中风险', '中高风险', '高风险'];
const REGION_FILTERS: FundRegion[] = ['A股', '海外', '全球'];

function normalizeFundMarketErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return '基金市场加载失败，请稍后重试。';
  }
  const message = error.message.trim();
  if (!message) {
    return '基金市场加载失败，请稍后重试。';
  }
  if (/route not found/i.test(message)) {
    return '基金市场接口尚未在当前 control-plane 进程生效，请刷新运行中的本地服务。';
  }
  if (/failed to fetch|networkerror|fetch failed/i.test(message)) {
    return '无法连接基金市场服务，请确认本地 control-plane 已启动。';
  }
  return message;
}

function formatSignedPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '--';
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}%`;
}

function formatFeeRate(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '--';
  return `${value.toFixed(2)}%`;
}

function formatScaleAmount(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) return '--';
  const yi = value / 100_000_000;
  if (yi >= 1000) return `${yi.toFixed(0)}亿`;
  if (yi >= 100) return `${yi.toFixed(1)}亿`;
  return `${yi.toFixed(2)}亿`;
}

function getMetadataString(fund: MarketFundData, key: string): string | null {
  const value = fund.metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getMetadataBoolean(fund: MarketFundData, key: string): boolean {
  return fund.metadata?.[key] === true;
}

function resolveInstrumentLabel(fund: MarketFundData): string {
  if (fund.instrument_kind === 'etf') return 'ETF';
  if (fund.instrument_kind === 'qdii') return 'QDII';
  return '基金';
}

function resolveBoard(fund: MarketFundData): string | null {
  if (fund.instrument_kind === 'qdii' && fund.exchange !== 'otc') return 'QDII ETF';
  if (fund.instrument_kind === 'etf') return '场内 ETF';
  if (fund.exchange === 'otc') return '场外公募';
  if (fund.exchange === 'sz') return '场内 LOF';
  return '基金';
}

function resolveTypeLabel(fund: MarketFundData): string {
  if (fund.instrument_kind === 'qdii') return '海外配置';
  if (fund.strategy_tags.includes('红利')) return '红利策略';
  if (fund.strategy_tags.includes('债券')) return '债券基金';
  if (fund.strategy_tags.includes('宽基核心')) return '宽基 ETF';
  if (fund.strategy_tags.includes('主动管理')) return '主动权益';
  return fund.fund_type || resolveInstrumentLabel(fund);
}

function resolveSummary(fund: MarketFundData): string {
  const explicit = getMetadataString(fund, 'summary');
  if (explicit) return explicit;
  const segments: string[] = [];
  if (fund.tracking_target) segments.push(`跟踪 / 风格围绕 ${fund.tracking_target}`);
  if (fund.strategy_tags.length > 0) segments.push(`命中 ${fund.strategy_tags.slice(0, 2).join(' / ')} 标签`);
  if (typeof fund.scale_amount === 'number' && fund.scale_amount > 0) segments.push(`最新规模 ${formatScaleAmount(fund.scale_amount)}`);
  return segments.join('，') || '适合作为基金研究入口，继续核验收益、回撤、费率与适用场景。';
}

function resolveAiFocus(fund: MarketFundData): string {
  return (
    getMetadataString(fund, 'ai_focus') ||
    (fund.tracking_target ? `${fund.tracking_target} 与回撤来源` : '收益来源、回撤质量与持仓风格')
  );
}

function toFundItem(fund: MarketFundData): FundItem {
  return {
    ...fund,
    companyName: fund.fund_name,
    board: resolveBoard(fund),
    instrumentLabel: resolveInstrumentLabel(fund),
    typeLabel: resolveTypeLabel(fund),
    summary: resolveSummary(fund),
    aiFocus: resolveAiFocus(fund),
    watchlisted: getMetadataBoolean(fund, 'watchlisted'),
    themeKey: getMetadataString(fund, 'theme_key'),
  };
}

function toResearchTarget(fund: FundItem): FundMarketResearchTarget {
  return {
    id: fund.id,
    symbol: fund.symbol,
    companyName: fund.companyName,
    exchange: fund.exchange,
    board: fund.board,
    instrumentKind: fund.instrument_kind,
    instrumentLabel: fund.instrumentLabel,
  };
}

function fundTagTone(tag: string): 'brand' | 'accent' | 'success' | 'warning' | 'danger' | 'outline' {
  if (/红利|低波|防御|低回撤|债券/.test(tag)) return 'success';
  if (/海外|全球|QDII/.test(tag)) return 'brand';
  if (/成长|高波动|医药|军工|新能源|消费/.test(tag)) return 'warning';
  if (/主动管理/.test(tag)) return 'accent';
  return 'outline';
}

function buildOverviewCards(allFunds: FundItem[]): OverviewCard[] {
  const etfCount = allFunds.filter((fund) => fund.instrument_kind === 'etf').length;
  const qdiiCount = allFunds.filter((fund) => fund.instrument_kind === 'qdii').length;
  const activeCount = allFunds.filter((fund) => fund.strategy_tags.includes('主动管理')).length;
  const dividendCount = allFunds.filter((fund) => fund.strategy_tags.includes('红利')).length;
  const avgReturn1y =
    allFunds.reduce((sum, fund) => sum + (typeof fund.return_1y === 'number' ? fund.return_1y : 0), 0) /
    Math.max(1, allFunds.filter((fund) => typeof fund.return_1y === 'number').length);

  return [
    {
      id: 'etf',
      title: '核心 ETF 池',
      value: `${etfCount} 只`,
      delta: formatSignedPercent(avgReturn1y, 1),
      positive: avgReturn1y >= 0,
      detail: '场内宽基、行业与红利 ETF 已接入真实行情和基金详情。',
    },
    {
      id: 'active',
      title: '主动公募池',
      value: `${activeCount} 只`,
      delta: '+研究中',
      positive: true,
      detail: '覆盖核心主动权益、均衡与债券基金，方便继续做经理风格研究。',
    },
    {
      id: 'dividend',
      title: '红利策略',
      value: `${dividendCount} 只`,
      delta: '偏稳健',
      positive: true,
      detail: '红利与低波策略已单独打标签，适合做防御和现金流视角筛选。',
    },
    {
      id: 'qdii',
      title: '海外配置',
      value: `${qdiiCount} 只`,
      delta: '已覆盖',
      positive: true,
      detail: 'QDII ETF 和海外主动基金已经纳入同一研究入口，可一起比较。',
    },
  ];
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

function FundOverviewCard({card}: {card: OverviewCard}) {
  return (
    <div className="rounded-[22px] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4 shadow-[0_16px_34px_rgba(18,24,36,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[12px] font-medium text-[var(--text-muted)]">{card.title}</div>
          <div className="mt-2 text-[22px] font-semibold tracking-[-0.05em] text-[var(--text-primary)]">{card.value}</div>
        </div>
        <div
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold',
            card.positive
              ? 'bg-[rgba(34,197,94,0.12)] text-[rgb(21,128,61)]'
              : 'bg-[rgba(239,68,68,0.12)] text-[rgb(185,28,28)]',
          )}
        >
          {card.positive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
          {card.delta}
        </div>
      </div>
      <p className="mt-3 text-[12px] leading-6 text-[var(--text-secondary)]">{card.detail}</p>
    </div>
  );
}

function FundCard({
  fund,
  active,
  onOpenDetail,
  onStartResearch,
}: {
  fund: FundItem;
  active: boolean;
  onOpenDetail: (fund: FundItem) => void;
  onStartResearch?: (fund: FundMarketResearchTarget) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpenDetail(fund)}
      className={cn(
        'w-full cursor-pointer rounded-[24px] border p-5 text-left transition-all',
        SPRING_PRESSABLE,
        INTERACTIVE_FOCUS_RING,
        active
          ? 'border-[rgba(42,74,111,0.28)] bg-[rgba(255,255,255,0.96)] shadow-[0_20px_46px_rgba(42,74,111,0.14)] dark:bg-[rgba(255,255,255,0.04)]'
          : 'border-[var(--border-default)] bg-[var(--bg-elevated)] hover:border-[rgba(42,74,111,0.18)] hover:shadow-[0_20px_40px_rgba(18,24,36,0.08)]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="outline">{fund.symbol}</Chip>
            <Chip tone="muted">{fund.typeLabel}</Chip>
            <Chip tone={fundTagTone(fund.strategy_tags[0] || '')}>{fund.strategy_tags[0] || fund.instrumentLabel}</Chip>
          </div>
          <h3 className="mt-3 text-[18px] font-semibold tracking-[-0.04em] text-[var(--text-primary)]">{fund.companyName}</h3>
          <p className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">{fund.summary}</p>
        </div>
        <div className="rounded-[18px] border border-[rgba(42,74,111,0.12)] bg-[rgba(42,74,111,0.06)] px-3 py-2 text-right">
          <div className="text-[11px] text-[var(--text-muted)]">近一年</div>
          <div className={cn('mt-1 text-[18px] font-semibold', (fund.return_1y ?? 0) >= 0 ? 'text-[rgb(21,128,61)]' : 'text-[rgb(185,28,28)]')}>
            {formatSignedPercent(fund.return_1y)}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {label: '近一月', value: formatSignedPercent(fund.return_1m)},
          {label: '最大回撤', value: formatSignedPercent(fund.max_drawdown)},
          {label: '申购费率', value: formatFeeRate(fund.fee_rate)},
          {label: '规模', value: formatScaleAmount(fund.scale_amount)},
        ].map((metric) => (
          <div key={metric.label} className="rounded-[18px] border border-[var(--border-default)] bg-[rgba(255,255,255,0.52)] px-3 py-3 dark:bg-[rgba(255,255,255,0.02)]">
            <div className="text-[11px] text-[var(--text-muted)]">{metric.label}</div>
            <div className="mt-1 text-[14px] font-semibold text-[var(--text-primary)]">{metric.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {fund.strategy_tags.slice(0, 3).map((tag) => (
          <Chip key={tag} tone={fundTagTone(tag)}>{tag}</Chip>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <div className="min-w-0 text-[12px] text-[var(--text-muted)]">跟踪 / 风格：{fund.tracking_target || fund.typeLabel}</div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<ArrowRight className="h-3.5 w-3.5" />}
            onClick={(event) => {
              event.stopPropagation();
              onOpenDetail(fund);
            }}
          >
            查看详情
          </Button>
          <Button
            variant="primary"
            size="sm"
            leadingIcon={<MessageSquare className="h-3.5 w-3.5" />}
            onClick={(event) => {
              event.stopPropagation();
              onStartResearch?.(toResearchTarget(fund));
            }}
          >
            AI 对话
          </Button>
        </div>
      </div>
    </button>
  );
}

function WatchlistPanel({
  funds,
  onStartResearch,
}: {
  funds: FundItem[];
  onStartResearch?: (fund: FundMarketResearchTarget) => void;
}) {
  return (
    <section className="rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[16px] font-semibold text-[var(--text-primary)]">我的自选基金</div>
          <div className="mt-1 text-[12px] text-[var(--text-secondary)]">这里展示导入池里标记为高频跟踪的核心基金，方便直接发起 AI 对话。</div>
        </div>
        <BookmarkPlus className="h-4.5 w-4.5 text-[var(--text-muted)]" />
      </div>
      <div className="mt-4 space-y-3">
        {funds.length > 0 ? (
          funds.map((fund) => (
            <div key={fund.id} className="rounded-[18px] border border-[var(--border-default)] bg-[rgba(255,255,255,0.52)] p-3 dark:bg-[rgba(255,255,255,0.02)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-semibold text-[var(--text-primary)]">{fund.companyName}</div>
                  <div className="mt-1 text-[12px] text-[var(--text-muted)]">{fund.symbol} · {fund.instrumentLabel}</div>
                </div>
                <div className={cn('text-[13px] font-semibold', (fund.return_1m ?? 0) >= 0 ? 'text-[rgb(21,128,61)]' : 'text-[rgb(185,28,28)]')}>
                  {formatSignedPercent(fund.return_1m)}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="text-[12px] text-[var(--text-secondary)]">{fund.aiFocus}</div>
                <Button
                  variant="secondary"
                  size="sm"
                  leadingIcon={<MessageSquare className="h-3.5 w-3.5" />}
                  onClick={() => onStartResearch?.(toResearchTarget(fund))}
                >
                  AI
                </Button>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-[18px] border border-[var(--border-default)] bg-[rgba(255,255,255,0.52)] px-4 py-4 text-[12px] leading-6 text-[var(--text-secondary)] dark:bg-[rgba(255,255,255,0.02)]">
            当前还没有命中自选标记的基金。
          </div>
        )}
      </div>
    </section>
  );
}

function FilterPanel({
  selectedRisk,
  selectedRegion,
  onSelectRisk,
  onSelectRegion,
  onClear,
}: {
  selectedRisk: FundRisk | null;
  selectedRegion: FundRegion | null;
  onSelectRisk: (risk: FundRisk | null) => void;
  onSelectRegion: (region: FundRegion | null) => void;
  onClear: () => void;
}) {
  return (
    <section className="rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[16px] font-semibold text-[var(--text-primary)]">智能筛选</div>
          <div className="mt-1 text-[12px] text-[var(--text-secondary)]">先用风险和区域缩小范围，再进入单只基金研究。</div>
        </div>
        <Filter className="h-4.5 w-4.5 text-[var(--text-muted)]" />
      </div>

      <div className="mt-4">
        <div className="text-[12px] font-medium text-[var(--text-muted)]">风险等级</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {RISK_FILTERS.map((risk) => (
            <Chip
              key={risk}
              clickable
              active={selectedRisk === risk}
              tone={selectedRisk === risk ? 'brand' : 'outline'}
              onClick={() => onSelectRisk(selectedRisk === risk ? null : risk)}
            >
              {risk}
            </Chip>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <div className="text-[12px] font-medium text-[var(--text-muted)]">投资区域</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {REGION_FILTERS.map((region) => (
            <Chip
              key={region}
              clickable
              active={selectedRegion === region}
              tone={selectedRegion === region ? 'brand' : 'outline'}
              onClick={() => onSelectRegion(selectedRegion === region ? null : region)}
            >
              {region}
            </Chip>
          ))}
        </div>
      </div>

      <div className="mt-5 rounded-[18px] border border-[var(--border-default)] bg-[rgba(255,255,255,0.52)] px-4 py-3 text-[12px] leading-6 text-[var(--text-secondary)] dark:bg-[rgba(255,255,255,0.02)]">
        当前已接入真实基金数据，支持按类型、风险、区域、标签和关键词一起缩小结果集。
      </div>

      <div className="mt-4 flex gap-2">
        <Button variant="primary" size="sm" block>筛选已生效</Button>
        <Button variant="ghost" size="sm" onClick={onClear}>重置</Button>
      </div>
    </section>
  );
}

function AIInsightsPanel() {
  return (
    <section className="rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4.5 w-4.5 text-[var(--brand-primary)]" />
        <div className="text-[16px] font-semibold text-[var(--text-primary)]">AI 洞察</div>
      </div>
      <div className="mt-4 space-y-3">
        {[
          {title: '先看核心 Beta', text: '如果要搭长期底仓，先从沪深300 / 中证500 / 上证50 这些核心 ETF 开始。'},
          {title: '红利适合防守', text: '红利策略更适合作为波动缓冲器，不能只看高股息率，还要看可持续性。'},
          {title: 'QDII 要看汇率', text: '海外基金除了行业景气，还要一起看美元、估值和申赎容量。'},
        ].map((item) => (
          <div key={item.title} className="rounded-[18px] border border-[var(--border-default)] bg-[rgba(255,255,255,0.52)] px-4 py-3 dark:bg-[rgba(255,255,255,0.02)]">
            <div className="text-[13px] font-semibold text-[var(--text-primary)]">{item.title}</div>
            <div className="mt-2 text-[12px] leading-6 text-[var(--text-secondary)]">{item.text}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-[16px] border border-[rgba(245,158,11,0.18)] bg-[rgba(245,158,11,0.10)] px-4 py-3 text-[11px] leading-6 text-[rgb(146,88,14)] dark:text-[#f4d18b]">
        以上内容只作为研究入口，不构成投资建议。请继续核验收益、回撤、费率、持仓与适用场景。
      </div>
    </section>
  );
}

function resolveThemeFunds(allFunds: FundItem[]): FundItem[] {
  const picks: Array<FundItem | null> = [
    allFunds.find((fund) => fund.themeKey === 'core-beta') || allFunds.find((fund) => fund.strategy_tags.includes('宽基核心')) || null,
    allFunds.find((fund) => fund.themeKey === 'dividend') || allFunds.find((fund) => fund.strategy_tags.includes('红利')) || null,
    allFunds.find((fund) => fund.themeKey === 'global-tech') || allFunds.find((fund) => fund.instrument_kind === 'qdii') || null,
  ];
  return picks.filter((fund): fund is FundItem => Boolean(fund));
}

function ThemeSpotlights({
  funds,
  onStartResearch,
}: {
  funds: FundItem[];
  onStartResearch?: (fund: FundMarketResearchTarget) => void;
}) {
  const definitions = [
    {id: 'core-beta', title: '宽基长期配置', summary: '优先构建核心 Beta 暴露，适合做长期底仓。'},
    {id: 'dividend', title: '红利现金流', summary: '高股息与防御属性兼具，适合震荡市稳健配置。'},
    {id: 'global-tech', title: '全球科技敞口', summary: '通过 QDII 获取海外成长暴露，但要一起看汇率与估值。'},
  ] as const;

  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <div className="text-[18px] font-semibold text-[var(--text-primary)]">策略主题</div>
          <div className="mt-1 text-[12px] text-[var(--text-secondary)]">把“先看什么”压缩成更容易落地的三个方向。</div>
        </div>
        <Chip tone="outline">研究起点</Chip>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        {definitions.map((theme, index) => {
          const fund = funds[index];
          if (!fund) return null;
          return (
            <div key={theme.id} className="rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-5 shadow-[0_16px_34px_rgba(18,24,36,0.04)]">
              <div className="flex items-start justify-between gap-3">
                <div className="rounded-[16px] border border-[rgba(42,74,111,0.12)] bg-[rgba(42,74,111,0.06)] p-3 text-[var(--brand-primary)]">
                  {theme.id === 'dividend' ? <WalletCards className="h-4.5 w-4.5" /> : theme.id === 'global-tech' ? <Globe2 className="h-4.5 w-4.5" /> : <BarChart3 className="h-4.5 w-4.5" />}
                </div>
                <Chip tone="outline">{fund.symbol}</Chip>
              </div>
              <div className="mt-4 text-[16px] font-semibold text-[var(--text-primary)]">{theme.title}</div>
              <div className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">{theme.summary}</div>
              <div className="mt-4 rounded-[18px] border border-[var(--border-default)] bg-[rgba(255,255,255,0.52)] px-4 py-3 text-[12px] leading-6 text-[var(--text-secondary)] dark:bg-[rgba(255,255,255,0.02)]">
                代表基金：<span className="font-semibold text-[var(--text-primary)]">{fund.companyName}</span>
              </div>
              <div className="mt-4">
                <Button
                  variant="secondary"
                  size="sm"
                  block
                  leadingIcon={<MessageSquare className="h-3.5 w-3.5" />}
                  onClick={() => onStartResearch?.(toResearchTarget(fund))}
                >
                  发起 AI 对话
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function FundDrawer({
  fund,
  detailLoading,
  onClose,
  onStartResearch,
}: {
  fund: FundItem | null;
  detailLoading: boolean;
  onClose: () => void;
  onStartResearch?: (fund: FundMarketResearchTarget) => void;
}) {
  if (!fund) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-40">
      <div className="pointer-events-auto absolute inset-0 bg-[rgba(15,23,42,0.18)] backdrop-blur-[2px]" onClick={onClose} />
      <aside className="pointer-events-auto absolute right-0 top-0 flex h-full w-[min(560px,calc(100vw-20px))] flex-col border-l border-[var(--border-default)] bg-[rgba(250,250,248,0.98)] shadow-[-24px_0_48px_rgba(15,23,42,0.12)] dark:bg-[rgba(18,18,18,0.98)]">
        <div className="flex items-start justify-between border-b border-[var(--border-default)] px-6 py-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[24px] font-semibold tracking-[-0.05em] text-[var(--text-primary)]">{fund.companyName}</h2>
              <Chip tone="outline">{fund.symbol}</Chip>
              <Chip tone="muted">{fund.instrumentLabel}</Chip>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {fund.strategy_tags.map((tag) => (
                <Chip key={tag} tone={fundTagTone(tag)}>{tag}</Chip>
              ))}
            </div>
            <div className="mt-4 flex items-end gap-3">
              <div className="text-[30px] font-semibold tracking-[-0.05em] text-[var(--text-primary)]">{formatSignedPercent(fund.return_1y)}</div>
              <div className="mb-1 inline-flex items-center gap-1 text-[14px] font-semibold text-[rgb(21,128,61)]">
                <TrendingUp className="h-4 w-4" />
                近一年收益
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={cn(
              'inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[var(--border-default)] text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]',
              SPRING_PRESSABLE,
              INTERACTIVE_FOCUS_RING,
            )}
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {detailLoading ? (
            <div className="rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-6 text-[13px] text-[var(--text-secondary)]">
              正在同步最新基金详情...
            </div>
          ) : null}

          <section className="grid grid-cols-2 gap-3">
            {[
              {label: '基金类型', value: fund.typeLabel},
              {label: '跟踪 / 风格', value: fund.tracking_target || fund.typeLabel},
              {label: '基金经理', value: fund.manager_name || '--'},
              {label: '管理规模', value: formatScaleAmount(fund.scale_amount)},
              {label: '申购费率', value: formatFeeRate(fund.fee_rate)},
              {label: '分红方式', value: fund.dividend_mode || '--'},
              {label: '近一月', value: formatSignedPercent(fund.return_1m)},
              {label: '最大回撤', value: formatSignedPercent(fund.max_drawdown)},
            ].map((item) => (
              <div key={item.label} className="rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-3">
                <div className="text-[11px] text-[var(--text-muted)]">{item.label}</div>
                <div className="mt-2 text-[15px] font-semibold text-[var(--text-primary)]">{item.value}</div>
              </div>
            ))}
          </section>

          <section className="rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-4">
            <div className="text-[14px] font-semibold text-[var(--text-primary)]">配置解读</div>
            <div className="mt-3 text-[13px] leading-6 text-[var(--text-secondary)]">{fund.summary}</div>
          </section>

          <section className="rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[var(--brand-primary)]" />
              <div className="text-[14px] font-semibold text-[var(--text-primary)]">AI 研究重点</div>
            </div>
            <div className="mt-3 text-[13px] leading-6 text-[var(--text-secondary)]">
              建议重点核验：{fund.aiFocus}、费率是否具备同类优势、近一年收益是否主要来自风格暴露还是管理能力，以及当前回撤是否仍在可接受范围。
            </div>
          </section>
        </div>

        <div className="border-t border-[var(--border-default)] px-6 py-4">
          <div className="flex gap-3">
            <Button
              variant="primary"
              size="sm"
              block
              leadingIcon={<MessageSquare className="h-3.5 w-3.5" />}
              onClick={() => onStartResearch?.(toResearchTarget(fund))}
            >
              发起 AI 对话
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>关闭</Button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function resolveTabFilters(activeTab: FundCategoryTab): {
  instrumentKind?: 'fund' | 'etf' | 'qdii';
  tag?: string;
} {
  switch (activeTab) {
    case 'etf':
      return {instrumentKind: 'etf'};
    case 'index':
      return {tag: '指数'};
    case 'dividend':
      return {tag: '红利'};
    case 'bond':
      return {tag: '债券'};
    case 'qdii':
      return {instrumentKind: 'qdii'};
    case 'active':
      return {tag: '主动管理'};
    default:
      return {};
  }
}

export function FundMarketView({
  title = '基金市场',
  client,
  onStartResearch,
}: {
  title?: string;
  client: IClawClient;
  onStartResearch?: (fund: FundMarketResearchTarget) => void;
}) {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<FundCategoryTab>('all');
  const [selectedRisk, setSelectedRisk] = useState<FundRisk | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<FundRegion | null>(null);
  const [allFunds, setAllFunds] = useState<FundItem[]>([]);
  const [visibleFunds, setVisibleFunds] = useState<FundItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFundId, setSelectedFundId] = useState<string | null>(null);
  const [selectedFund, setSelectedFund] = useState<FundItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const deferredQuery = useDeferredValue(query.trim());

  useEffect(() => {
    let cancelled = false;
    void client
      .listMarketFundsPage({
        market: 'cn_fund',
        limit: 200,
        offset: 0,
        sort: 'scale_desc',
      })
      .then((page) => {
        if (!cancelled) setAllFunds(page.items.map(toFundItem));
      })
      .catch(() => {
        if (!cancelled) setAllFunds([]);
      });
    return () => {
      cancelled = true;
    };
  }, [client]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const tabFilters = resolveTabFilters(activeTab);

    void client
      .listMarketFundsPage({
        market: 'cn_fund',
        instrumentKind: tabFilters.instrumentKind,
        tag: tabFilters.tag,
        region: selectedRegion || undefined,
        riskLevel: selectedRisk || undefined,
        search: deferredQuery || undefined,
        sort: activeTab === 'all' ? 'scale_desc' : 'return_1y_desc',
        limit: 120,
        offset: 0,
      })
      .then((page) => {
        if (cancelled) return;
        const nextFunds = page.items.map(toFundItem);
        setVisibleFunds(nextFunds);
        setTotal(page.total);
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(normalizeFundMarketErrorMessage(loadError));
        setVisibleFunds([]);
        setTotal(0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, client, deferredQuery, selectedRegion, selectedRisk]);

  useEffect(() => {
    if (!selectedFundId) return;
    let cancelled = false;
    setDetailLoading(true);
    void client
      .getMarketFund(selectedFundId)
      .then((fund) => {
        if (!cancelled) setSelectedFund(toFundItem(fund));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client, selectedFundId]);

  const overviewCards = useMemo(() => buildOverviewCards(allFunds), [allFunds]);
  const watchlistFunds = useMemo(() => allFunds.filter((fund) => fund.watchlisted).slice(0, 4), [allFunds]);
  const themeFunds = useMemo(() => resolveThemeFunds(allFunds), [allFunds]);
  const featuredFund = visibleFunds[0] ?? allFunds[0] ?? null;

  return (
    <PageSurface as="div" className="bg-[var(--lobster-page-bg)]">
      <PageContent className="max-w-none px-5 py-5 lg:px-6 xl:px-7">
        <PageHeader
          eyebrow="Fund Research Workspace"
          title={title}
          description="基金列表已经接入真实 control-plane 数据。支持检索、筛选、详情抽屉和 AI 研究接力。"
          actions={
            <label className="relative min-w-[280px] flex-1 xl:max-w-[360px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索基金名称 / 代码 / 经理 / 跟踪方向"
                className="h-12 w-full rounded-[16px] border border-[rgba(255,255,255,0.08)] bg-[rgba(24,22,20,0.96)] pl-10 pr-4 text-[13px] text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[rgba(210,176,106,0.42)] focus:ring-2 focus:ring-[rgba(210,176,106,0.12)]"
              />
            </label>
          }
        />

        {featuredFund ? (
          <section className="mt-5 overflow-hidden rounded-[28px] border border-[rgba(42,74,111,0.14)] bg-[radial-gradient(circle_at_top_left,rgba(244,214,160,0.18),transparent_34%),linear-gradient(135deg,rgba(19,31,48,0.96),rgba(33,52,72,0.94))] p-6 text-white shadow-[0_26px_64px_rgba(17,24,39,0.18)]">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-[760px]">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone="outline" className="border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.04)] text-white">{featuredFund.symbol}</Chip>
                  <Chip tone="outline" className="border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.04)] text-white">{featuredFund.instrumentLabel}</Chip>
                  <Chip tone="outline" className="border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.04)] text-white">{featuredFund.region}</Chip>
                </div>
                <h2 className="mt-4 text-[34px] font-semibold tracking-[-0.05em]">{featuredFund.companyName}</h2>
                <p className="mt-3 max-w-[700px] text-[14px] leading-7 text-[rgba(255,255,255,0.82)]">{featuredFund.summary}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {featuredFund.strategy_tags.slice(0, 4).map((tag) => (
                    <Chip key={tag} tone="outline" className="border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.04)] text-white">{tag}</Chip>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[360px]">
                {[
                  {label: '近一年', value: formatSignedPercent(featuredFund.return_1y)},
                  {label: '近一月', value: formatSignedPercent(featuredFund.return_1m)},
                  {label: '规模', value: formatScaleAmount(featuredFund.scale_amount)},
                  {label: '申购费率', value: formatFeeRate(featuredFund.fee_rate)},
                ].map((item) => (
                  <div key={item.label} className="rounded-[18px] border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.06)] px-4 py-4">
                    <div className="text-[11px] uppercase tracking-[0.12em] text-[rgba(255,255,255,0.56)]">{item.label}</div>
                    <div className="mt-2 text-[22px] font-semibold tracking-[-0.04em] text-white">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {overviewCards.map((card) => (
            <FundOverviewCard key={card.id} card={card} />
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {CATEGORY_TABS.map((tab) => (
            <Chip
              key={tab.value}
              clickable
              active={activeTab === tab.value}
              tone={activeTab === tab.value ? 'brand' : 'outline'}
              onClick={() => setActiveTab(tab.value)}
            >
              {tab.label}
            </Chip>
          ))}
        </div>

        <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1.8fr)_340px]">
          <div className="space-y-6">
            <section>
              <div className="mb-4 flex items-end justify-between gap-3">
                <div>
                  <div className="text-[18px] font-semibold text-[var(--text-primary)]">推荐基金</div>
                  <div className="mt-1 text-[12px] text-[var(--text-secondary)]">
                    当前命中 <span className="font-semibold text-[var(--text-primary)]">{total}</span> 只基金。每张卡都能直接进入 AI 对话，聊天页会自动带上该基金 / ETF 上下文。
                  </div>
                </div>
                <Chip tone="outline">{activeTab === 'all' ? '全市场' : CATEGORY_TABS.find((tab) => tab.value === activeTab)?.label}</Chip>
              </div>

              {loading ? (
                <StatusPanel title="基金市场加载中" description="正在从 control-plane 拉取真实基金数据..." />
              ) : error ? (
                <StatusPanel title="基金市场加载失败" description={error} tone="danger" />
              ) : visibleFunds.length > 0 ? (
                <div className="grid gap-4 xl:grid-cols-2">
                  {visibleFunds.map((fund) => (
                    <FundCard
                      key={fund.id}
                      fund={fund}
                      active={selectedFund?.id === fund.id}
                      onOpenDetail={(item) => {
                        setSelectedFundId(item.id);
                        setSelectedFund(item);
                      }}
                      onStartResearch={onStartResearch}
                    />
                  ))}
                </div>
              ) : (
                <EmptyPanel title="没有匹配到基金" description="可以尝试放宽分类、风险或区域筛选，或者换一个基金经理 / 代码关键词再搜一次。" />
              )}
            </section>

            <ThemeSpotlights funds={themeFunds} onStartResearch={onStartResearch} />
          </div>

          <div className="space-y-5">
            <WatchlistPanel funds={watchlistFunds} onStartResearch={onStartResearch} />
            <FilterPanel
              selectedRisk={selectedRisk}
              selectedRegion={selectedRegion}
              onSelectRisk={setSelectedRisk}
              onSelectRegion={setSelectedRegion}
              onClear={() => {
                setSelectedRisk(null);
                setSelectedRegion(null);
              }}
            />
            <AIInsightsPanel />
          </div>
        </div>
      </PageContent>

      <FundDrawer
        fund={selectedFund}
        detailLoading={detailLoading}
        onClose={() => {
          setSelectedFundId(null);
          setSelectedFund(null);
        }}
        onStartResearch={onStartResearch}
      />
    </PageSurface>
  );
}
