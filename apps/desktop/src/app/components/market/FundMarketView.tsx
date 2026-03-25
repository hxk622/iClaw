import {useState} from 'react';
import {Search, TrendingDown, TrendingUp, X} from 'lucide-react';

import {PageContent, PageHeader, PageSurface} from '@/app/components/ui/PageLayout';
import {Button} from '@/app/components/ui/Button';
import {Chip} from '@/app/components/ui/Chip';
import {cn} from '@/app/lib/cn';

type FundItem = {
  id: string;
  name: string;
  code: string;
  type: 'ETF' | '主动权益' | '债券' | 'QDII';
  return1y: number;
  maxDrawdown: number;
  manager: string;
  scale: string;
  tags: string[];
  summary: string;
};

const FUND_GROUPS: Array<{title: string; description: string; items: FundItem[]}> = [
  {
    title: '宽基配置',
    description: '适合作为底仓和长期被动配置',
    items: [
      {
        id: 'fund-510300',
        name: '华泰柏瑞沪深300ETF',
        code: '510300',
        type: 'ETF',
        return1y: 11.84,
        maxDrawdown: -8.3,
        manager: '柳军',
        scale: '3,200亿',
        tags: ['宽基', '低费率'],
        summary: '流动性强，适合做A股核心 Beta 敞口。',
      },
      {
        id: 'fund-510050',
        name: '华夏上证50ETF',
        code: '510050',
        type: 'ETF',
        return1y: 10.82,
        maxDrawdown: -9.2,
        manager: '徐猛',
        scale: '526亿',
        tags: ['宽基', '价值'],
        summary: '偏向核心资产和大盘价值，适合补强低波底仓。',
      },
    ],
  },
  {
    title: '红利策略',
    description: '偏现金流和分红质量，适合稳健配置',
    items: [
      {
        id: 'fund-510880',
        name: '红利ETF',
        code: '510880',
        type: 'ETF',
        return1y: 18.56,
        maxDrawdown: -6.8,
        manager: '柳军',
        scale: '342亿',
        tags: ['红利', '低波'],
        summary: '高股息与防御属性兼具，适合中长期底仓。',
      },
    ],
  },
  {
    title: '海外暴露',
    description: '用于补充美元和全球科技风险资产敞口',
    items: [
      {
        id: 'fund-513100',
        name: '华夏纳斯达克100ETF',
        code: '513100',
        type: 'QDII',
        return1y: 32.68,
        maxDrawdown: -12.5,
        manager: '赵宗庭',
        scale: '125亿',
        tags: ['海外', '科技'],
        summary: '适合做海外科技配置，不直接依赖A股风格轮动。',
      },
    ],
  },
];

function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function FundDrawer({fund, onClose}: {fund: FundItem | null; onClose: () => void}) {
  if (!fund) return null;
  const positive = fund.return1y >= 0;
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div className="absolute inset-0 bg-[rgba(15,23,42,0.18)] backdrop-blur-[2px]" onClick={onClose} />
      <aside className="pointer-events-auto absolute right-0 top-0 flex h-full w-[min(520px,calc(100vw-180px))] flex-col border-l border-[var(--border-default)] bg-[rgba(250,250,248,0.98)] shadow-[-24px_0_48px_rgba(15,23,42,0.12)]">
        <div className="flex items-start justify-between border-b border-[var(--border-default)] px-6 py-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-[24px] font-semibold tracking-[-0.04em] text-[var(--text-primary)]">{fund.name}</h2>
              <Chip tone="outline">{fund.code}</Chip>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Chip tone="muted">{fund.type}</Chip>
              {fund.tags.map((tag) => <Chip key={tag} tone="accent">{tag}</Chip>)}
            </div>
            <div className="mt-4 flex items-end gap-3">
              <div className="text-[30px] font-semibold tracking-[-0.05em] text-[var(--text-primary)]">{formatPercent(fund.return1y)}</div>
              <div className={cn('mb-1 inline-flex items-center gap-1 text-[15px] font-semibold', positive ? 'text-[rgb(21,128,61)]' : 'text-[rgb(185,28,28)]')}>
                {positive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                近一年收益
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-default)] text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <section className="grid grid-cols-2 gap-3">
            {[
              {label: '最大回撤', value: formatPercent(fund.maxDrawdown)},
              {label: '基金经理', value: fund.manager},
              {label: '管理规模', value: fund.scale},
              {label: '基金类型', value: fund.type},
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
        </div>
        <div className="border-t border-[var(--border-default)] px-6 py-4">
          <div className="flex gap-3">
            <Button variant="primary" size="sm" className="flex-1">发起 AI 基金研究</Button>
            <Button variant="ghost" size="sm" onClick={onClose}>关闭</Button>
          </div>
        </div>
      </aside>
    </div>
  );
}

export function FundMarketView({title = '基金市场'}: {title?: string}) {
  const [query, setQuery] = useState('');
  const [selectedFund, setSelectedFund] = useState<FundItem | null>(null);
  const normalizedQuery = query.trim().toLowerCase();

  const filteredGroups = FUND_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (!normalizedQuery) return true;
      return [item.name, item.code, item.manager, item.type, item.summary, ...item.tags].join(' ').toLowerCase().includes(normalizedQuery);
    }),
  })).filter((group) => group.items.length > 0);

  return (
    <PageSurface as="div" className="relative bg-[var(--lobster-page-bg)]">
      <PageContent className="max-w-none px-5 py-5 lg:px-6 xl:px-7">
        <PageHeader
          title={title}
          description="基金页先按你设计稿的结构接入，方便和股票市场保持同一套研究终端语言。"
          actions={
            <label className="relative w-full min-w-[320px] xl:max-w-[420px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索基金名称 / 代码 / 基金经理"
                className="h-11 w-full rounded-[14px] border border-[var(--border-default)] bg-[var(--bg-elevated)] pl-10 pr-4 text-[13px] text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[rgba(42,74,111,0.42)] focus:ring-2 focus:ring-[rgba(42,74,111,0.12)]"
              />
            </label>
          }
        />

        <div className="mt-5 space-y-7">
          {filteredGroups.map((group) => (
            <section key={group.title}>
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <div className="text-[18px] font-semibold text-[var(--text-primary)]">{group.title}</div>
                  <div className="mt-1 text-[12px] text-[var(--text-secondary)]">{group.description}</div>
                </div>
                <div className="text-[12px] text-[var(--text-muted)]">{group.items.length} 只</div>
              </div>
              <div className="space-y-3">
                {group.items.map((fund) => {
                  const positive = fund.return1y >= 0;
                  return (
                    <button
                      key={fund.id}
                      type="button"
                      onClick={() => setSelectedFund(fund)}
                      className="grid w-full grid-cols-[minmax(0,1.6fr)_120px_120px_140px] items-center gap-4 rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-4 text-left transition hover:-translate-y-[1px] hover:border-[rgba(42,74,111,0.18)] hover:bg-[var(--bg-hover)]"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="truncate text-[15px] font-semibold text-[var(--text-primary)]">{fund.name}</div>
                          <Chip tone="outline" className="text-[10px]">{fund.code}</Chip>
                          <Chip tone="muted" className="text-[10px]">{fund.type}</Chip>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {fund.tags.map((tag) => <Chip key={tag} tone="outline" className="text-[10px]">{tag}</Chip>)}
                        </div>
                        <div className="mt-2 truncate text-[12px] text-[var(--text-secondary)]">{fund.summary}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-[var(--text-muted)]">近一年收益</div>
                        <div className={cn('mt-1 inline-flex items-center gap-1 text-[14px] font-semibold', positive ? 'text-[rgb(21,128,61)]' : 'text-[rgb(185,28,28)]')}>
                          {positive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                          {formatPercent(fund.return1y)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-[var(--text-muted)]">最大回撤</div>
                        <div className="mt-1 text-[14px] font-medium text-[var(--text-primary)]">{formatPercent(fund.maxDrawdown)}</div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[11px] text-[var(--text-muted)]">基金经理</div>
                          <div className="mt-1 text-[14px] font-medium text-[var(--text-primary)]">{fund.manager}</div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-[var(--text-muted)]" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
          {filteredGroups.length === 0 ? (
            <div className="rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-6 py-10 text-center">
              <div className="text-[18px] font-semibold text-[var(--text-primary)]">没有匹配到基金</div>
              <div className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">当前基金页先挂接设计稿结构，后续再接真实基金目录与业绩数据。</div>
            </div>
          ) : null}
        </div>
      </PageContent>

      <FundDrawer fund={selectedFund} onClose={() => setSelectedFund(null)} />
    </PageSurface>
  );
}
