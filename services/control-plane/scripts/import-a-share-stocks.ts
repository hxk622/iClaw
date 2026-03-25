import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

import {Pool} from 'pg';

import {config} from '../src/config.ts';
import {ensureControlPlaneSchema} from '../src/pg-store.ts';

type CninfoStockListResponse = {
  stockList?: Array<{
    code?: string;
    category?: string;
    orgId?: string;
    zwjc?: string;
  }>;
};

type StockDirectoryItem = {
  code: string;
  companyName: string;
  exchange: 'sh' | 'sz' | 'bj';
  board: string | null;
  orgId: string | null;
};

type StockImportRow = {
  id: string;
  market: 'a_share';
  exchange: 'sh' | 'sz' | 'bj';
  symbol: string;
  companyName: string;
  board: string | null;
  status: 'active' | 'suspended';
  source: 'cninfo+tencent';
  sourceId: string;
  currentPrice: number | null;
  changePercent: number | null;
  amount: number | null;
  turnoverRate: number | null;
  peTtm: number | null;
  openPrice: number | null;
  prevClose: number | null;
  totalMarketCap: number | null;
  circulatingMarketCap: number | null;
  strategyTags: string[];
  metadata: Record<string, unknown>;
};

type QuoteSnapshot = {
  currentPrice: number | null;
  prevClose: number | null;
  openPrice: number | null;
  changePercent: number | null;
  amount: number | null;
  turnoverRate: number | null;
  peTtm: number | null;
  totalMarketCap: number | null;
  circulatingMarketCap: number | null;
  rawLine: string;
};

const execFileAsync = promisify(execFile);
const QUOTE_BATCH_SIZE = 80;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '' || value === '-') {
    return null;
  }
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

async function runCurlJson(url: string, headers: string[] = []): Promise<unknown> {
  const args = ['-sS', '-L'];
  for (const header of headers) {
    args.push('-H', header);
  }
  args.push(url);
  const {stdout} = await execFileAsync('curl', args, {maxBuffer: 64 * 1024 * 1024});
  return JSON.parse(stdout);
}

async function runCurlText(url: string, headers: string[] = []): Promise<string> {
  const args = ['-sS', '-L'];
  for (const header of headers) {
    args.push('-H', header);
  }
  args.push(url);
  const {stdout} = await execFileAsync('curl', args, {maxBuffer: 64 * 1024 * 1024});
  return stdout;
}

function deriveExchange(symbol: string, orgId: string | null): 'sh' | 'sz' | 'bj' {
  if (orgId?.startsWith('gfbj') || orgId?.startsWith('nssc') || symbol.startsWith('4') || symbol.startsWith('8') || symbol.startsWith('9')) {
    return 'bj';
  }
  if (symbol.startsWith('6') || symbol.startsWith('9')) {
    return 'sh';
  }
  return 'sz';
}

function deriveBoard(symbol: string, exchange: 'sh' | 'sz' | 'bj'): string | null {
  if (exchange === 'bj') return '北交所';
  if (exchange === 'sh' && symbol.startsWith('688')) return '科创板';
  if (exchange === 'sz' && symbol.startsWith('300')) return '创业板';
  return '主板';
}

function buildTicker(exchange: 'sh' | 'sz' | 'bj', symbol: string): string {
  return `${exchange}${symbol}`;
}

function buildStrategyTags(row: {
  board: string | null;
  peTtm: number | null;
  turnoverRate: number | null;
  totalMarketCap: number | null;
  changePercent: number | null;
  amount: number | null;
}): string[] {
  const tags = new Set<string>();
  if (row.board) tags.add(row.board);
  if (row.peTtm !== null && row.peTtm > 0 && row.peTtm <= 20) tags.add('低估值');
  if (row.totalMarketCap !== null && row.totalMarketCap >= 100_000_000_000) tags.add('大盘核心');
  if (row.totalMarketCap !== null && row.totalMarketCap <= 20_000_000_000) tags.add('小盘成长');
  if (row.turnoverRate !== null && row.turnoverRate >= 5) tags.add('高换手');
  if (row.changePercent !== null && row.changePercent >= 3) tags.add('强势异动');
  if (row.amount !== null && row.amount >= 2_000_000_000) tags.add('高成交额');
  return Array.from(tags);
}

async function fetchStockDirectory(): Promise<StockDirectoryItem[]> {
  const payload = (await runCurlJson('https://www.cninfo.com.cn/new/data/szse_stock.json', [
    'User-Agent: Mozilla/5.0',
  ])) as CninfoStockListResponse;
  return (payload.stockList || [])
    .map((item) => {
      const code = String(item.code || '').trim();
      const companyName = String(item.zwjc || '').trim();
      if (!code || !companyName || String(item.category || '').trim() !== 'A股') {
        return null;
      }
      const orgId = String(item.orgId || '').trim() || null;
      const exchange = deriveExchange(code, orgId);
      return {
        code,
        companyName,
        exchange,
        board: deriveBoard(code, exchange),
        orgId,
      } satisfies StockDirectoryItem;
    })
    .filter((item): item is StockDirectoryItem => Boolean(item));
}

function parseTencentQuoteLine(line: string): [string, QuoteSnapshot] | null {
  const match = line.match(/^v_([a-z]{2}\d+)="(.*)";$/);
  if (!match) return null;
  const ticker = match[1];
  const fields = match[2].split('~');
  if (fields.length < 46) return null;

  const currentPrice = parseNumber(fields[3]);
  const prevClose = parseNumber(fields[4]);
  const openPrice = parseNumber(fields[5]);
  const changePercent = parseNumber(fields[32]);
  const amountWan = parseNumber(fields[37]);
  const turnoverRate = parseNumber(fields[38]);
  const peTtm = parseNumber(fields[39]);
  const totalMarketCapYi = parseNumber(fields[44]);
  const circulatingMarketCapYi = parseNumber(fields[45]);

  return [
    ticker,
    {
      currentPrice,
      prevClose,
      openPrice,
      changePercent,
      amount: amountWan === null ? null : amountWan * 10_000,
      turnoverRate,
      peTtm,
      totalMarketCap: totalMarketCapYi === null ? null : totalMarketCapYi * 100_000_000,
      circulatingMarketCap: circulatingMarketCapYi === null ? null : circulatingMarketCapYi * 100_000_000,
      rawLine: line,
    },
  ];
}

async function fetchQuoteBatch(tickers: string[]): Promise<Map<string, QuoteSnapshot>> {
  const url = `https://qt.gtimg.cn/q=${tickers.join(',')}`;
  const text = await runCurlText(url, ['Referer: https://finance.qq.com/', 'User-Agent: Mozilla/5.0']);
  const map = new Map<string, QuoteSnapshot>();
  for (const line of text.split(/\r?\n/)) {
    const parsed = parseTencentQuoteLine(line.trim());
    if (!parsed) continue;
    map.set(parsed[0], parsed[1]);
  }
  return map;
}

async function fetchAllQuotes(directory: StockDirectoryItem[]): Promise<Map<string, QuoteSnapshot>> {
  const result = new Map<string, QuoteSnapshot>();
  const tickers = directory.map((item) => buildTicker(item.exchange, item.code));
  const totalBatches = Math.ceil(tickers.length / QUOTE_BATCH_SIZE);
  for (let index = 0; index < tickers.length; index += QUOTE_BATCH_SIZE) {
    const batch = tickers.slice(index, index + QUOTE_BATCH_SIZE);
    const quoteMap = await fetchQuoteBatch(batch);
    for (const [ticker, snapshot] of quoteMap.entries()) {
      result.set(ticker, snapshot);
    }
    const batchNo = Math.floor(index / QUOTE_BATCH_SIZE) + 1;
    console.log(`[import-a-share-stocks] quote batch ${batchNo}/${totalBatches} fetched ${quoteMap.size} rows`);
    await sleep(80);
  }
  return result;
}

function toImportRow(item: StockDirectoryItem, quoteMap: Map<string, QuoteSnapshot>): StockImportRow {
  const ticker = buildTicker(item.exchange, item.code);
  const quote = quoteMap.get(ticker);
  const currentPrice = quote?.currentPrice ?? null;
  const status: 'active' | 'suspended' = currentPrice && currentPrice > 0 ? 'active' : 'suspended';
  const strategyTags = buildStrategyTags({
    board: item.board,
    peTtm: quote?.peTtm ?? null,
    turnoverRate: quote?.turnoverRate ?? null,
    totalMarketCap: quote?.totalMarketCap ?? null,
    changePercent: quote?.changePercent ?? null,
    amount: quote?.amount ?? null,
  });

  return {
    id: `stock:a_share:${item.exchange}:${item.code}`,
    market: 'a_share',
    exchange: item.exchange,
    symbol: item.code,
    companyName: item.companyName,
    board: item.board,
    status,
    source: 'cninfo+tencent',
    sourceId: ticker,
    currentPrice: currentPrice,
    changePercent: quote?.changePercent ?? null,
    amount: quote?.amount ?? null,
    turnoverRate: quote?.turnoverRate ?? null,
    peTtm: quote?.peTtm ?? null,
    openPrice: quote?.openPrice ?? null,
    prevClose: quote?.prevClose ?? null,
    totalMarketCap: quote?.totalMarketCap ?? null,
    circulatingMarketCap: quote?.circulatingMarketCap ?? null,
    strategyTags,
    metadata: {
      provider: 'cninfo+tencent',
      org_id: item.orgId,
      ticker,
      raw_quote: quote?.rawLine || null,
    },
  };
}

async function upsertBatch(pool: Pool, rows: StockImportRow[]): Promise<void> {
  if (rows.length === 0) return;
  const values: unknown[] = [];
  const tuples = rows.map((row, index) => {
    const offset = index * 20;
    values.push(
      row.id,
      row.market,
      row.exchange,
      row.symbol,
      row.companyName,
      row.board,
      row.status,
      row.source,
      row.sourceId,
      row.currentPrice,
      row.changePercent,
      row.amount,
      row.turnoverRate,
      row.peTtm,
      row.openPrice,
      row.prevClose,
      row.totalMarketCap,
      row.circulatingMarketCap,
      row.strategyTags,
      JSON.stringify(row.metadata),
    );
    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13}, $${offset + 14}, $${offset + 15}, $${offset + 16}, $${offset + 17}, $${offset + 18}, $${offset + 19}, $${offset + 20}::jsonb)`;
  });

  await pool.query(
    `
      insert into market_stock_catalog (
        id,
        market,
        exchange,
        symbol,
        company_name,
        board,
        status,
        source,
        source_id,
        current_price,
        change_percent,
        amount,
        turnover_rate,
        pe_ttm,
        open_price,
        prev_close,
        total_market_cap,
        circulating_market_cap,
        strategy_tags,
        metadata_json
      )
      values ${tuples.join(',\n')}
      on conflict (id)
      do update set
        market = excluded.market,
        exchange = excluded.exchange,
        symbol = excluded.symbol,
        company_name = excluded.company_name,
        board = excluded.board,
        status = excluded.status,
        source = excluded.source,
        source_id = excluded.source_id,
        current_price = excluded.current_price,
        change_percent = excluded.change_percent,
        amount = excluded.amount,
        turnover_rate = excluded.turnover_rate,
        pe_ttm = excluded.pe_ttm,
        open_price = excluded.open_price,
        prev_close = excluded.prev_close,
        total_market_cap = excluded.total_market_cap,
        circulating_market_cap = excluded.circulating_market_cap,
        strategy_tags = excluded.strategy_tags,
        metadata_json = excluded.metadata_json,
        imported_at = now(),
        updated_at = now()
    `,
    values,
  );
}

async function main() {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }
  await ensureControlPlaneSchema(config.databaseUrl);
  const directory = await fetchStockDirectory();
  console.log(`[import-a-share-stocks] directory loaded ${directory.length} A-share symbols`);
  const quoteMap = await fetchAllQuotes(directory);
  console.log(`[import-a-share-stocks] live quote snapshots loaded ${quoteMap.size} symbols`);

  const rows = directory.map((item) => toImportRow(item, quoteMap));
  const pool = new Pool({connectionString: config.databaseUrl});
  try {
    for (let index = 0; index < rows.length; index += 250) {
      const batch = rows.slice(index, index + 250);
      await upsertBatch(pool, batch);
      const batchNo = Math.floor(index / 250) + 1;
      const batchTotal = Math.ceil(rows.length / 250);
      console.log(`[import-a-share-stocks] db batch ${batchNo}/${batchTotal} upserted ${batch.length} rows`);
    }
    const activeIds = rows.map((item) => item.id);
    await pool.query(
      `
        delete from market_stock_catalog
        where market = 'a_share'
          and not (id = any($1::text[]))
      `,
      [activeIds],
    );
    const countResult = await pool.query<{count: string}>(
      `select count(*)::text as count from market_stock_catalog where market = 'a_share'`,
    );
    console.log(
      `[import-a-share-stocks] completed: prepared=${rows.length} stored=${countResult.rows[0]?.count || '0'}`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('[import-a-share-stocks] failed', error);
  process.exitCode = 1;
});
