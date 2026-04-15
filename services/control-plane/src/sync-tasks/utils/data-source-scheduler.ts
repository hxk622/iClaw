import { logger } from '../../logger';

export type DataSourceName = 'akshare' | 'efinance' | 'baostock' | 'tushare';

export interface DataSource<T = any> {
  name: DataSourceName;
  priority: number; // 优先级，数字越小越优先
  fetch: () => Promise<T>;
  enabled: boolean;
}

interface DataSourceFuse {
  failCount: number;
  lastFailTime: number | null;
  isFused: boolean;
}

const fuses = new Map<DataSourceName, DataSourceFuse>();

// 熔断配置：连续失败3次熔断10分钟
const FUSE_CONFIG = {
  maxFailCount: 3,
  fuseDuration: 10 * 60 * 1000, // 10分钟
};

/**
 * 初始化熔断状态
 */
function initFuse(name: DataSourceName) {
  if (!fuses.has(name)) {
    fuses.set(name, {
      failCount: 0,
      lastFailTime: null,
      isFused: false,
    });
  }
}

/**
 * 数据源执行成功，重置熔断状态
 */
function markSuccess(name: DataSourceName) {
  const fuse = fuses.get(name);
  if (fuse) {
    fuse.failCount = 0;
    fuse.isFused = false;
    fuse.lastFailTime = null;
  }
}

/**
 * 数据源执行失败，更新熔断状态
 */
function markFail(name: DataSourceName) {
  const fuse = fuses.get(name);
  if (fuse) {
    fuse.failCount++;
    fuse.lastFailTime = Date.now();
    if (fuse.failCount >= FUSE_CONFIG.maxFailCount) {
      fuse.isFused = true;
      logger.warn(`DataSource ${name} is fused for ${FUSE_CONFIG.fuseDuration / 60000} minutes due to continuous failures`);
    }
  }
}

/**
 * 检查数据源是否被熔断
 */
function isFused(name: DataSourceName): boolean {
  const fuse = fuses.get(name);
  if (!fuse || !fuse.isFused) return false;
  if (!fuse.lastFailTime) return false;

  // 熔断时间到了，自动恢复
  if (Date.now() - fuse.lastFailTime > FUSE_CONFIG.fuseDuration) {
    fuse.isFused = false;
    fuse.failCount = 0;
    logger.info(`DataSource ${name} is recovered from fuse`);
    return false;
  }
  return true;
}

/**
 * 数据源调度器，按优先级执行，自动降级，自动熔断
 * @param dataSources 数据源列表
 * @returns 第一个执行成功的结果
 */
export async function scheduleDataSource<T>(dataSources: DataSource<T>[]): Promise<{ data: T; source: DataSourceName }> {
  // 按优先级排序
  const sortedSources = dataSources.filter(s => s.enabled).sort((a, b) => a.priority - b.priority);

  for (const source of sortedSources) {
    initFuse(source.name);
    if (isFused(source.name)) {
      logger.info(`DataSource ${source.name} is fused, skip`);
      continue;
    }

    try {
      logger.info(`Trying to fetch data from ${source.name}...`);
      const data = await source.fetch();
      markSuccess(source.name);
      logger.info(`Fetch data from ${source.name} successfully`);
      return { data, source: source.name };
    } catch (e) {
      markFail(source.name);
      logger.error(`Fetch data from ${source.name} failed:`, e);
    }
  }

  throw new Error('All data sources failed, could not fetch data');
}
