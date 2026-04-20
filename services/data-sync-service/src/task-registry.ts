import type { SyncTaskDefinition } from '../../../packages/market-sync-core/src/types.ts';
import { syncFinanceData } from '../../control-plane/src/sync-tasks/tasks/sync-finance-data.ts';
import { syncIndustryConcept } from '../../control-plane/src/sync-tasks/tasks/sync-industry-concept.ts';
import { syncMarketNews } from './tasks/sync-market-news.ts';
import { syncMarketOverview } from './tasks/sync-market-overview.ts';
import { syncStockBasics } from './tasks/sync-stock-basics.ts';
import { syncStockQuotes } from './tasks/sync-stock-quotes.ts';

export const MARKET_SYNC_TASKS: SyncTaskDefinition[] = [
  {
    id: 'stock-basics',
    label: '股票基础信息同步',
    category: 'reference',
    schedule: '0 17 * * 1-5',
    timezone: 'Asia/Shanghai',
    warmupOnStartup: false,
    run: syncStockBasics,
  },
  {
    id: 'stock-quotes',
    label: '股票行情快照同步',
    category: 'snapshot',
    schedule: '0 9-15 * * 1-5',
    timezone: 'Asia/Shanghai',
    warmupOnStartup: false,
    run: syncStockQuotes,
  },
  {
    id: 'market-overview',
    label: '市场概览同步',
    category: 'snapshot',
    schedule: '*/15 9-15 * * 1-5',
    timezone: 'Asia/Shanghai',
    warmupOnStartup: true,
    run: syncMarketOverview,
  },
  {
    id: 'market-news',
    label: '财经快讯同步',
    category: 'snapshot',
    schedule: '*/10 8-22 * * 1-5',
    timezone: 'Asia/Shanghai',
    warmupOnStartup: true,
    run: syncMarketNews,
  },
  {
    id: 'industry-concept',
    label: '行业概念关系同步',
    category: 'reference',
    schedule: '0 18 * * 1-5',
    timezone: 'Asia/Shanghai',
    warmupOnStartup: false,
    run: syncIndustryConcept,
  },
  {
    id: 'finance-data',
    label: '季度财务数据同步',
    category: 'fact',
    schedule: '0 10 1 1,4,7,10 *',
    timezone: 'Asia/Shanghai',
    warmupOnStartup: false,
    run: syncFinanceData,
  },
];
