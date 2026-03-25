import {useDeferredValue, useEffect, useState} from 'react';
import type {IClawClient, MarketStockData} from '@iclaw/sdk';
import {Search, TrendingDown, TrendingUp, X} from 'lucide-react';

import {PageContent, PageHeader, PageSurface} from '@/app/components/ui/PageLayout';
import {Button} from '@/app/components/ui/Button';
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
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '--';
  return value.toFixed(2);
}

function exchangeLabel(exchange: MarketStockData['exchange']): string {
  if (exchange === 'sh') return '沪市';
  if (exchange === 'sz') return '深市';
  return '北交所';
}

function buildSummary(stock: MarketStockData): string {
  const parts: string[] = [];
  if (stock.board) parts.push(stock.board);
  if (typeof stock.pe_ttm === 'number' && Number.isFinite(stock.pe_ttm) && stock.pe_ttm > 0) {
    parts.push(`PE ${stock.pe_ttm.toFixed(1)}`);
  }
  if (typeof stock.turnover_rate === 'number' && Number.isFinite(stock.turnover_rate)) {
    parts.push(`换手 ${stock.turnover_rate.toFixed(2)}%`);
  }
  if (typeof stock.total_market_cap === 'number' && Number.isFinite(stock.total_market_cap)) {
    parts.push(`总市值 ${formatCompactNumber(stock.total_market_cap)}`);
  }
  return parts.join(' · ') || 'A股全量快照标的';
}

function EmptyPanel({title, description}: {title: string; description: string}) {
  return (
    <div className="rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-6 py-10 text-center">
      <div className="text-[18px] font-semibold text-[var(--text-primary)]">{title}</div>
      <div className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">{description}</div>
    </div>
  );
}

function StockRow({
  stock,
  active,
  onClick,
}: {
  stock: MarketStockData;
  active: boolean;
  onClick: () => void;
}) {
  const positive = (stock.change_percent || 0) >= 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'grid w-full grid-cols-[minmax(0,1.6fr)_120px_120px_140px_120px] items-center gap-4 rounded-[18px] border px-4 py-4 text-left transition',
        active
          ? 'border-[rgba(42,74,111,0.26)] bg-[rgba(42,74,111,0.08)] shadow-[0_16px_36px_rgba(17,24,39,0.07)]'
          : 'border-[var(--border-default)] bg-[var(--bg-elevated)] hover:-translate-y-[1px] hover:border-[rgba(42,74,111,0.18)] hover:bg-[var(--bg-hover)]',
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <div className="truncate text-[15px] font-semibold text-[var(--text-primary)]">{stock.company_name}</div>
          <Chip tone="outline" className="shrink-0 text-[10px]">{stock.symbol}</Chip>
          <Chip tone="muted" className="shrink-0 text-[10px]">{exchangeLabel(stock.exchange)}</Chip>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {stock.strategy_tags.slice(0, 3).map((tag) => (
            <Chip key={tag} tone="outline" className="text-[10px]">{tag}</Chip>
          ))}
        </div>
        <div className="mt-2 truncate text-[12px] text-[var(--text-secondary)]">{buildSummary(stock)}</div>
      </div>
      <div>
        <div className="text-[11px] text-[var(--text-muted)]">最新价</div>
        <div className="mt-1 text-[15px] font-semibold text-[var(--text-primary)]">{formatPrice(stock.current_price)}</div>
      </div>
      <div>
        <div className="text-[11px] text-[var(--text-muted)]">涨跌幅</div>
        <div className={cn('mt-1 inline-flex items-center gap-1 text-[14px] font-semibold', positive ? 'text-[rgb(21,128,61)]' : 'text-[rgb(185,28,28)]')}>
          {positive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
          {formatPercent(stock.change_percent)}
        </div>
      </div>
      <div>
        <div className="text-[11px] text-[var(--text-muted)]">总市值</div>
        <div className="mt-1 text-[14px] font-medium text-[var(--text-primary)]">{formatCompactNumber(stock.total_market_cap)}</div>
      </div>
      <div>
        <div className="text-[11px] text-[var(--text-muted)]">换手率</div>
        <div className="mt-1 text-[14px] font-medium text-[var(--text-primary)]">{formatPercent(stock.turnover_rate)}</div>
      </div>
    </button>
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
  const positive = ((stock?.change_percent || 0) >= 0);

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div className="absolute inset-0 bg-[rgba(15,23,42,0.18)] backdrop-blur-[2px]" onClick={onClose} />
      <aside className="pointer-events-auto absolute right-0 top-0 flex h-full w-[min(540px,calc(100vw-180px))] flex-col border-l border-[var(--border-default)] bg-[rgba(250,250,248,0.98)] shadow-[-24px_0_48px_rgba(15,23,42,0.12)]">
        <div className="flex items-start justify-between border-b border-[var(--border-default)] px-6 py-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-[24px] font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
                {loading ? '加载中...' : stock?.company_name}
              </h2>
              {stock ? <Chip tone="outline">{stock.symbol}</Chip> : null}
            </div>
            {stock ? (
              <>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Chip tone="muted">{exchangeLabel(stock.exchange)}</Chip>
                  {stock.board ? <Chip tone="muted">{stock.board}</Chip> : null}
                  {stock.status === 'suspended' ? <Chip tone="warning">停牌/无实时报价</Chip> : null}
                </div>
                <div className="mt-4 flex items-end gap-3">
                  <div className="text-[30px] font-semibold tracking-[-0.05em] text-[var(--text-primary)]">
                    {formatPrice(stock.current_price)}
                  </div>
                  <div className={cn('mb-1 inline-flex items-center gap-1 text-[15px] font-semibold', positive ? 'text-[rgb(21,128,61)]' : 'text-[rgb(185,28,28)]')}>
                    {positive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    {formatPercent(stock.change_percent)}
                  </div>
                </div>
              </>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-default)] text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            aria-label="关闭详情抽屉"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading || !stock ? (
            <div className="space-y-3">
              {Array.from({length: 4}).map((_, index) => (
                <div key={index} className="h-20 animate-pulse rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-hover)]" />
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              <section className="grid grid-cols-2 gap-3">
                {[
                  {label: '总市值', value: formatCompactNumber(stock.total_market_cap)},
                  {label: '流通市值', value: formatCompactNumber(stock.circulating_market_cap)},
                  {label: '市盈率TTM', value: stock.pe_ttm === null ? '--' : stock.pe_ttm.toFixed(2)},
                  {label: '换手率', value: formatPercent(stock.turnover_rate)},
                  {label: '开盘价', value: formatPrice(stock.open_price)},
                  {label: '昨收价', value: formatPrice(stock.prev_close)},
                  {label: '成交额', value: formatCompactNumber(stock.amount)},
                  {label: '更新时间', value: new Date(stock.updated_at).toLocaleString('zh-CN', {hour12: false})},
                ].map((item) => (
                  <div key={item.label} className="rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-3">
                    <div className="text-[11px] text-[var(--text-muted)]">{item.label}</div>
                    <div className="mt-2 text-[15px] font-semibold text-[var(--text-primary)]">{item.value}</div>
                  </div>
                ))}
              </section>

              <section className="rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-4">
                <div className="text-[14px] font-semibold text-[var(--text-primary)]">研究标签</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {stock.strategy_tags.length > 0 ? stock.strategy_tags.map((tag) => (
                    <Chip key={tag} tone="accent">{tag}</Chip>
                  )) : <div className="text-[12px] text-[var(--text-secondary)]">当前快照还没有命中策略标签</div>}
                </div>
              </section>

              <section className="rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-4">
                <div className="text-[14px] font-semibold text-[var(--text-primary)]">快照解读</div>
                <div className="mt-3 space-y-2 text-[13px] leading-6 text-[var(--text-secondary)]">
                  <div>当前标的位于 {exchangeLabel(stock.exchange)}，板块归属 {stock.board || '主板'}。</div>
                  <div>从交易维度看，涨跌幅 {formatPercent(stock.change_percent)}，成交额 {formatCompactNumber(stock.amount)}，换手率 {formatPercent(stock.turnover_rate)}。</div>
                  <div>从估值维度看，市盈率 TTM {stock.pe_ttm === null ? '--' : stock.pe_ttm.toFixed(2)}，总市值 {formatCompactNumber(stock.total_market_cap)}。</div>
                </div>
              </section>
            </div>
          )}
        </div>

        <div className="border-t border-[var(--border-default)] px-6 py-4">
          <div className="flex gap-3">
            <Button
              variant="primary"
              size="sm"
              className="flex-1"
              disabled={!stock}
              onClick={() => stock && onStartResearch?.(stock)}
            >
              发起 AI 研究
            </Button>
            <Button variant="ghost" size="sm" className="min-w-[112px]" onClick={onClose}>
              关闭
            </Button>
          </div>
        </div>
      </aside>
    </div>
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
          setError(loadError instanceof Error ? loadError.message : '加载股票列表失败');
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
        setError(loadError instanceof Error ? loadError.message : '加载股票分组失败');
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
          description="A股全量快照已接入。这里优先展示可筛、可比、可研究的候选池，而不是简单的行情列表。"
          actions={
            <div className="flex min-w-[320px] flex-1 items-center gap-3 xl:max-w-[480px]">
              <label className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="搜索股票名称 / 代码"
                  className="h-11 w-full rounded-[14px] border border-[var(--border-default)] bg-[var(--bg-elevated)] pl-10 pr-4 text-[13px] text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[rgba(42,74,111,0.42)] focus:ring-2 focus:ring-[rgba(42,74,111,0.12)]"
                />
              </label>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
                className="h-11 rounded-[14px] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 text-[13px] text-[var(--text-primary)] outline-none"
              >
                <option value="change_percent_desc">排序: 涨跌幅</option>
                <option value="market_cap_desc">排序: 总市值</option>
                <option value="turnover_rate_desc">排序: 换手率</option>
                <option value="pe_ttm_asc">排序: 市盈率</option>
              </select>
            </div>
          }
        />

        <div className="mt-5 rounded-[20px] border border-[var(--border-default)] bg-[rgba(255,255,255,0.74)] p-4 shadow-[0_16px_40px_rgba(15,23,42,0.05)] backdrop-blur-[10px]">
          <div className="flex flex-wrap items-center gap-2">
            {EXCHANGE_TABS.map((item) => (
              <Chip
                key={item.label}
                clickable
                active={exchange === item.value}
                tone={exchange === item.value ? 'brand' : 'outline'}
                onClick={() => setExchange(item.value)}
              >
                {item.label}
              </Chip>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {FILTER_TAGS.map((item) => (
              <Chip
                key={item}
                clickable
                active={tag === item}
                tone={tag === item ? 'accent' : 'outline'}
                onClick={() => setTag((current) => (current === item ? '' : item))}
              >
                {item}
              </Chip>
            ))}
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-[18px] border border-[rgba(239,68,68,0.16)] bg-[rgba(239,68,68,0.08)] px-4 py-3 text-[13px] text-[rgb(185,28,28)]">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-6 space-y-4">
            {Array.from({length: 5}).map((_, index) => (
              <div key={index} className="h-[98px] animate-pulse rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-elevated)]" />
            ))}
          </div>
        ) : showingSearchResults ? (
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[18px] font-semibold text-[var(--text-primary)]">筛选结果</div>
                <div className="mt-1 text-[12px] text-[var(--text-secondary)]">当前命中 {total} 只股票</div>
              </div>
            </div>
            {listItems.length === 0 ? (
              <EmptyPanel title="没有匹配到股票" description="可以清空筛选条件，或者尝试股票代码、简称和更宽泛的关键词。" />
            ) : (
              <div className="space-y-3">
                {listItems.map((stock) => (
                  <StockRow
                    key={stock.id}
                    stock={stock}
                    active={selectedStockId === stock.id}
                    onClick={() => setSelectedStockId(stock.id)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-6 space-y-7">
            {sections.map((section) => (
              <section key={section.key}>
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <div className="text-[18px] font-semibold text-[var(--text-primary)]">{section.key}</div>
                    <div className="mt-1 text-[12px] text-[var(--text-secondary)]">{section.description}</div>
                  </div>
                  <div className="text-[12px] text-[var(--text-muted)]">{section.items.length} 只</div>
                </div>
                <div className="space-y-3">
                  {section.items.map((stock) => (
                    <StockRow
                      key={stock.id}
                      stock={stock}
                      active={selectedStockId === stock.id}
                      onClick={() => setSelectedStockId(stock.id)}
                    />
                  ))}
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
