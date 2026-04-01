import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

import {Pool} from 'pg';

import {config} from '../src/config.ts';
import {buildPgPoolConfig} from '../src/pg-connection.ts';
import {ensureControlPlaneSchema} from '../src/pg-store.ts';

type FundDirectoryItem = {
  code: string;
  name: string;
  fundType: string;
};

type CuratedFundSeed = {
  code: string;
  trackingTarget?: string | null;
  extraTags?: string[];
  summary?: string;
  aiFocus?: string;
  watchlisted?: boolean;
  instrumentKind?: 'fund' | 'etf' | 'qdii';
  region?: 'A股' | '海外' | '全球';
  riskLevel?: '低风险' | '中低风险' | '中风险' | '中高风险' | '高风险';
  themeKey?: string | null;
};

type PingzhongNetWorthPoint = {
  x?: number;
  y?: number;
  equityReturn?: number;
  unitMoney?: string;
};

type PingzhongScalePayload = {
  categories?: string[];
  series?: Array<{
    y?: number;
    mom?: string;
  }>;
};

type PingzhongManagerPayload = Array<{
  name?: string;
  workTime?: string;
  fundSize?: string;
}>;

type PingzhongData = {
  fundName: string;
  sourceRate: number | null;
  currentRate: number | null;
  return1m: number | null;
  return1y: number | null;
  navPrice: number | null;
  navChangePercent: number | null;
  navDate: string | null;
  maxDrawdown: number | null;
  scaleAmount: number | null;
  managerName: string | null;
  managerWorkTime: string | null;
  managerFundSizeText: string | null;
  dividendMode: string | null;
  dividendEvents: number;
  assetAllocation: Record<string, unknown>;
};

type EtfQuote = {
  currentPrice: number | null;
  changePercent: number | null;
  amount: number | null;
  raw: Record<string, unknown>;
};

type FundImportRow = {
  id: string;
  market: 'cn_fund';
  exchange: 'sh' | 'sz' | 'otc';
  symbol: string;
  fundName: string;
  fundType: string | null;
  instrumentKind: 'fund' | 'etf' | 'qdii';
  region: 'A股' | '海外' | '全球';
  riskLevel: '低风险' | '中低风险' | '中风险' | '中高风险' | '高风险' | null;
  managerName: string | null;
  trackingTarget: string | null;
  status: 'active' | 'suspended';
  source: 'eastmoney';
  sourceId: string;
  currentPrice: number | null;
  navPrice: number | null;
  changePercent: number | null;
  return1m: number | null;
  return1y: number | null;
  maxDrawdown: number | null;
  scaleAmount: number | null;
  feeRate: number | null;
  amount: number | null;
  turnoverRate: number | null;
  dividendMode: string | null;
  strategyTags: string[];
  metadata: Record<string, unknown>;
};

const execFileAsync = promisify(execFile);
const EIGHT_DIGIT_CODE_PATTERN = /^\d{6}$/;
const ETMONEY_FUND_LIST_URL = 'https://fund.eastmoney.com/js/fundcode_search.js';

const CURATED_FUND_UNIVERSE: CuratedFundSeed[] = [
  {
    code: '510300',
    trackingTarget: '沪深300指数',
    extraTags: ['宽基核心', '低费率'],
    summary: '流动性充足，适合作为 A 股核心 Beta 底仓。',
    aiFocus: '适合作为长期底仓的宽基 ETF',
    watchlisted: true,
    instrumentKind: 'etf',
    themeKey: 'core-beta',
  },
  {
    code: '510500',
    trackingTarget: '中证500指数',
    extraTags: ['中盘成长', '宽基配置'],
    summary: '补充中盘与成长风格暴露，适合和沪深300搭配。',
    aiFocus: '用于补充中盘成长风格暴露的指数 ETF',
    watchlisted: true,
    instrumentKind: 'etf',
    themeKey: 'core-beta',
  },
  {
    code: '510050',
    trackingTarget: '上证50指数',
    extraTags: ['大盘蓝筹', '央企权重'],
    summary: '偏大盘蓝筹和金融权重，适合作为稳健风格补充。',
    aiFocus: '大盘蓝筹和核心资产权重研究',
    instrumentKind: 'etf',
  },
  {
    code: '159919',
    trackingTarget: '沪深300指数',
    extraTags: ['宽基核心', '深市流动性'],
    summary: '沪深300 的另一只核心场内工具，适合做横向比较。',
    aiFocus: '比较同指数 ETF 的费率、流动性和跟踪效果',
    instrumentKind: 'etf',
  },
  {
    code: '159915',
    trackingTarget: '创业板指数',
    extraTags: ['成长', '高波动'],
    summary: '弹性强、波动也大，更适合做进攻仓位。',
    aiFocus: '高弹性成长风格 ETF',
    instrumentKind: 'etf',
  },
  {
    code: '159949',
    trackingTarget: '创业板50指数',
    extraTags: ['成长', '高弹性'],
    summary: '相较创业板宽指数更聚焦龙头，风格更集中。',
    aiFocus: '创业板龙头集中度与波动研究',
    instrumentKind: 'etf',
  },
  {
    code: '588000',
    trackingTarget: '科创50指数',
    extraTags: ['科技成长', '科创'],
    summary: '适合表达科创板风险偏好和科技成长风格。',
    aiFocus: '科创板景气度与估值弹性研究',
    instrumentKind: 'etf',
  },
  {
    code: '510880',
    trackingTarget: '中证红利指数',
    extraTags: ['红利', '低波'],
    summary: '兼顾现金流和防御属性，适合震荡市稳健配置。',
    aiFocus: '高股息低波动的红利底仓',
    watchlisted: true,
    instrumentKind: 'etf',
    themeKey: 'dividend',
  },
  {
    code: '515180',
    trackingTarget: '中证红利低波动指数',
    extraTags: ['红利', '低波'],
    summary: '更强调低波和分红质量，适合作为防御策略池。',
    aiFocus: '红利低波策略的收益稳定性研究',
    instrumentKind: 'etf',
  },
  {
    code: '511010',
    trackingTarget: '上证5年期国债指数',
    extraTags: ['债券', '低波动'],
    summary: '适合作为组合低波动配置和利率观察工具。',
    aiFocus: '利率敏感度与债券防御属性研究',
    instrumentKind: 'etf',
    riskLevel: '低风险',
  },
  {
    code: '518880',
    trackingTarget: '黄金现货合约',
    extraTags: ['黄金', '避险'],
    summary: '适合观察黄金和避险资产的配置价值。',
    aiFocus: '黄金 ETF 的商品属性与避险价值研究',
    instrumentKind: 'etf',
  },
  {
    code: '512170',
    trackingTarget: '中证医疗指数',
    extraTags: ['医药', '行业主题'],
    summary: '医药波动较大，适合事件和估值驱动研究。',
    aiFocus: '医药板块景气和政策扰动研究',
    instrumentKind: 'etf',
  },
  {
    code: '512660',
    trackingTarget: '中证军工指数',
    extraTags: ['军工', '行业主题'],
    summary: '主题弹性较强，更适合卫星仓和催化跟踪。',
    aiFocus: '军工主题的事件驱动和订单周期研究',
    instrumentKind: 'etf',
  },
  {
    code: '516160',
    trackingTarget: '新能源主题指数',
    extraTags: ['新能源', '行业主题'],
    summary: '适合观察新能源链条的景气和估值切换。',
    aiFocus: '新能源产业链景气和盈利兑现研究',
    instrumentKind: 'etf',
  },
  {
    code: '515170',
    trackingTarget: '食品饮料主题指数',
    extraTags: ['消费', '行业主题'],
    summary: '适合作为消费龙头和白酒链条的场内表达。',
    aiFocus: '消费龙头景气与估值修复研究',
    instrumentKind: 'etf',
  },
  {
    code: '513100',
    trackingTarget: '纳斯达克100指数',
    extraTags: ['全球分散', '海外科技'],
    summary: '适合补充海外科技资产敞口，但要一起看汇率和估值。',
    aiFocus: '海外科技与美元资产暴露',
    watchlisted: true,
    instrumentKind: 'qdii',
    region: '海外',
    themeKey: 'global-tech',
  },
  {
    code: '513500',
    trackingTarget: '标普500指数',
    extraTags: ['美股宽基', '全球分散'],
    summary: '适合获得更均衡的美股宽基敞口。',
    aiFocus: '标普500 的行业结构和美元风险研究',
    instrumentKind: 'qdii',
    region: '海外',
  },
  {
    code: '159941',
    trackingTarget: '纳斯达克100指数',
    extraTags: ['海外科技', 'QDII'],
    summary: '适合作为纳指场内替代工具，便于做费率和流动性比较。',
    aiFocus: '同类纳指 ETF 的跟踪效果与交易深度研究',
    instrumentKind: 'qdii',
    region: '海外',
  },
  {
    code: '159920',
    trackingTarget: '恒生指数',
    extraTags: ['港股', 'QDII'],
    summary: '适合观察港股核心资产与南向/外资风险偏好。',
    aiFocus: '港股宽基与宏观风险偏好联动研究',
    instrumentKind: 'qdii',
    region: '海外',
  },
  {
    code: '161005',
    trackingTarget: '主动成长选股',
    extraTags: ['主动管理', '长期跟踪'],
    summary: '适合研究基金经理风格稳定性与长期超额收益来源。',
    aiFocus: '主动权益基金经理风格研究',
    watchlisted: true,
  },
  {
    code: '161725',
    trackingTarget: '白酒消费链',
    extraTags: ['消费', '主题集中'],
    summary: '主题集中度高，更适合结构性表达而不是底仓。',
    aiFocus: '高集中度消费主题基金',
    watchlisted: true,
  },
  {
    code: '110017',
    trackingTarget: '中高等级信用债',
    extraTags: ['债券', '低回撤'],
    summary: '更适合做组合波动缓冲器，而不是承担高收益预期。',
    aiFocus: '稳健型债券底仓',
    riskLevel: '低风险',
  },
  {
    code: '005827',
    trackingTarget: '主动消费与港股成长',
    extraTags: ['主动管理', '消费成长'],
    summary: '适合研究跨市场消费与龙头选股风格。',
    aiFocus: '主动选股与行业集中度研究',
    watchlisted: true,
  },
  {
    code: '163406',
    trackingTarget: '主动均衡配置',
    extraTags: ['主动管理', '均衡配置'],
    summary: '适合作为主动均衡风格样本观察仓位与行业切换。',
    aiFocus: '均衡型主动基金的回撤与仓位管理研究',
    watchlisted: true,
  },
  {
    code: '163417',
    trackingTarget: '主动均衡配置',
    extraTags: ['主动管理', '均衡配置'],
    summary: '更适合作为中长期主动管理样本做风格对比。',
    aiFocus: '长期持有型主动基金的风格稳定性研究',
  },
  {
    code: '163402',
    trackingTarget: '主动价值成长',
    extraTags: ['主动管理', '价值成长'],
    summary: '适合作为价值成长混合风格的代表样本。',
    aiFocus: '价值成长风格与换手节奏研究',
  },
  {
    code: '110011',
    trackingTarget: '海外优质公司主动配置',
    extraTags: ['QDII', '主动管理'],
    summary: '适合研究主动型海外配置与汇率因素共同作用。',
    aiFocus: '主动 QDII 基金的海外行业配置研究',
    region: '海外',
    instrumentKind: 'qdii',
  },
  {
    code: '110022',
    trackingTarget: '消费行业主动配置',
    extraTags: ['主动管理', '消费'],
    summary: '适合作为消费行业主动配置风格的长期样本。',
    aiFocus: '消费行业主动基金的持仓集中度研究',
  },
  {
    code: '001717',
    trackingTarget: '医疗健康主动配置',
    extraTags: ['主动管理', '医药'],
    summary: '适合作为医药主题主动基金样本。',
    aiFocus: '医药主动基金的行业轮动与回撤研究',
  },
  {
    code: '260108',
    trackingTarget: '新兴成长主动配置',
    extraTags: ['主动管理', '成长'],
    summary: '适合作为老牌成长风格主动基金的观察样本。',
    aiFocus: '成长风格主动基金的长期收益来源研究',
  },
  {
    code: '519704',
    trackingTarget: '稳健配置',
    extraTags: ['主动管理', '均衡配置'],
    summary: '适合作为稳健混合风格和回撤控制样本。',
    aiFocus: '稳健配置基金的风险收益比研究',
  },
];

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

async function runCurlText(url: string, headers: string[] = []): Promise<string> {
  const args = ['-sS', '-L'];
  for (const header of headers) {
    args.push('-H', header);
  }
  args.push(url);
  const {stdout} = await execFileAsync('curl', args, {maxBuffer: 64 * 1024 * 1024});
  return stdout;
}

async function runCurlJson(url: string, headers: string[] = []): Promise<unknown> {
  const text = await runCurlText(url, headers);
  return JSON.parse(text);
}

function extractVarString(text: string, name: string): string | null {
  const match = text.match(new RegExp(`var\\s+${name}\\s*=\\s*"([^"]*)"`, 'm'));
  return match ? match[1] : null;
}

function extractVarJson<T>(text: string, name: string): T | null {
  const match = text.match(new RegExp(`var\\s+${name}\\s*=\\s*([\\[{][\\s\\S]*?[\\]}])\\s*;`, 'm'));
  if (!match) return null;
  try {
    return JSON.parse(match[1]) as T;
  } catch {
    return null;
  }
}

function parseFundDirectoryScript(text: string): FundDirectoryItem[] {
  const normalized = text.replace(/^\uFEFF?var\s+r\s*=\s*/, '').replace(/;\s*$/, '');
  const parsed = JSON.parse(normalized) as Array<[string, string, string, string, string]>;
  return parsed
    .map((item) => {
      const code = String(item[0] || '').trim();
      const name = String(item[2] || '').trim();
      const fundType = String(item[3] || '').trim();
      if (!EIGHT_DIGIT_CODE_PATTERN.test(code) || !name) {
        return null;
      }
      return {
        code,
        name,
        fundType,
      } satisfies FundDirectoryItem;
    })
    .filter((item): item is FundDirectoryItem => Boolean(item));
}

function determineExchange(directory: FundDirectoryItem, instrumentKind: 'fund' | 'etf' | 'qdii'): 'sh' | 'sz' | 'otc' {
  const code = directory.code;
  if (code.startsWith('5')) return 'sh';
  if (code.startsWith('15') || code.startsWith('16')) return 'sz';
  if ((instrumentKind === 'etf' || /ETF/i.test(directory.name)) && code.startsWith('1')) return 'sz';
  return 'otc';
}

function normalizeFundName(name: string): string {
  return name.replace(/\s+/g, '').trim();
}

function looksLikeEtf(name: string, fundType: string): boolean {
  if (/ETF联接/.test(name)) return false;
  if (/ETF/i.test(name)) return true;
  return /指数型/.test(fundType) && /^5\d{5}$|^1[56]\d{4}$/.test(name) === false;
}

function determineInstrumentKind(
  directory: FundDirectoryItem,
  seed?: CuratedFundSeed,
): 'fund' | 'etf' | 'qdii' {
  if (seed?.instrumentKind) {
    return seed.instrumentKind;
  }
  const name = normalizeFundName(directory.name);
  const qdii = /QDII/i.test(directory.fundType) || /QDII/i.test(name);
  if (qdii) {
    return /ETF/i.test(name) && !/联接/.test(name) ? 'qdii' : 'qdii';
  }
  if (looksLikeEtf(name, directory.fundType)) {
    return 'etf';
  }
  return 'fund';
}

function determineRegion(
  directory: FundDirectoryItem,
  instrumentKind: 'fund' | 'etf' | 'qdii',
  seed?: CuratedFundSeed,
): 'A股' | '海外' | '全球' {
  if (seed?.region) {
    return seed.region;
  }
  if (instrumentKind !== 'qdii') {
    return 'A股';
  }
  if (/全球|环球/.test(directory.name)) {
    return '全球';
  }
  return '海外';
}

function determineRiskLevel(
  directory: FundDirectoryItem,
  instrumentKind: 'fund' | 'etf' | 'qdii',
  tags: string[],
  seed?: CuratedFundSeed,
): '低风险' | '中低风险' | '中风险' | '中高风险' | '高风险' | null {
  if (seed?.riskLevel) {
    return seed.riskLevel;
  }
  const type = directory.fundType;
  const name = directory.name;
  if (/货币/.test(type)) return '低风险';
  if (/中短债|短债/.test(type)) return '低风险';
  if (/债券型/.test(type)) return '中低风险';
  if (/FOF|偏债/.test(type)) return '中低风险';
  if (/军工|医药|新能源|创业板|科创|纳斯达克|互联网|白酒/.test(name) || tags.includes('高波动')) {
    return instrumentKind === 'qdii' ? '高风险' : '中高风险';
  }
  if (instrumentKind === 'qdii') return '高风险';
  if (/股票型|指数型-股票/.test(type) || instrumentKind === 'etf') return '中风险';
  if (/混合型/.test(type)) return '中风险';
  return null;
}

function inferTrackingTarget(directory: FundDirectoryItem, seed?: CuratedFundSeed): string | null {
  if (seed?.trackingTarget !== undefined) {
    return seed.trackingTarget;
  }
  const name = directory.name;
  if (/ETF联接/.test(name)) {
    return name.replace(/^.*?([A-Za-z\u4e00-\u9fa5\d]+ETF)联接.*$/, '$1');
  }
  if (/指数/.test(name) || /ETF/.test(name) || /LOF/.test(name)) {
    return name.replace(/^[^中沪深上证科创创业恒生纳斯达克标普日经全球港股美股油气黄金债券]+/, '').replace(/[A-C](\)|$)/g, '').replace(/\(LOF\)/g, '').trim();
  }
  if (/债/.test(name)) return '债券组合配置';
  return '主动选股';
}

function buildStrategyTags(
  directory: FundDirectoryItem,
  instrumentKind: 'fund' | 'etf' | 'qdii',
  region: 'A股' | '海外' | '全球',
  seed?: CuratedFundSeed,
): string[] {
  const tags = new Set<string>(seed?.extraTags || []);
  const name = directory.name;
  const type = directory.fundType;

  if (instrumentKind === 'etf') tags.add('ETF');
  if (instrumentKind === 'qdii') tags.add('QDII');
  if (instrumentKind === 'fund' && /混合|股票/.test(type)) tags.add('主动管理');
  if (/指数/.test(type)) tags.add('指数');
  if (/债券/.test(type) || /债/.test(name)) tags.add('债券');
  if (/红利|股息|低波/.test(name)) tags.add('红利');
  if (/沪深300|中证500|上证50|科创50|创业板|中证1000/.test(name)) tags.add('宽基核心');
  if (/军工/.test(name)) tags.add('军工');
  if (/医药|医疗/.test(name)) tags.add('医药');
  if (/新能源/.test(name)) tags.add('新能源');
  if (/消费|白酒|食品饮料/.test(name)) tags.add('消费');
  if (/纳斯达克|标普|美股|恒生|日经/.test(name)) tags.add('海外配置');
  if (region === '全球') tags.add('全球分散');
  return Array.from(tags);
}

function computeMaxDrawdown(points: PingzhongNetWorthPoint[]): number | null {
  const validPoints = points
    .filter((point) => typeof point.x === 'number' && typeof point.y === 'number' && Number.isFinite(point.y))
    .sort((left, right) => Number(left.x) - Number(right.x));
  if (validPoints.length === 0) return null;

  const latestTimestamp = Number(validPoints[validPoints.length - 1]?.x || 0);
  const trailing = validPoints.filter((point) => Number(point.x) >= latestTimestamp - 365 * 24 * 60 * 60 * 1000);
  const series = trailing.length > 20 ? trailing : validPoints;
  let peak = Number(series[0]?.y || 0);
  let worst = 0;
  for (const point of series) {
    const value = Number(point.y || 0);
    if (value > peak) {
      peak = value;
      continue;
    }
    if (peak <= 0) continue;
    const drawdown = ((value / peak) - 1) * 100;
    if (drawdown < worst) {
      worst = drawdown;
    }
  }
  return Number.isFinite(worst) ? Number(worst.toFixed(2)) : null;
}

function resolveDividendMode(points: PingzhongNetWorthPoint[], tags: string[]): {mode: string | null; count: number} {
  const events = points.filter((point) => String(point.unitMoney || '').includes('分红')).length;
  if (events > 0 && tags.includes('红利')) {
    return {mode: '高频分红', count: events};
  }
  if (events > 0) {
    return {mode: '有分红记录', count: events};
  }
  if (tags.includes('红利')) {
    return {mode: '按基金公告', count: 0};
  }
  return {mode: null, count: 0};
}

async function fetchFundDirectory(): Promise<Map<string, FundDirectoryItem>> {
  const text = await runCurlText(ETMONEY_FUND_LIST_URL, ['User-Agent: Mozilla/5.0']);
  const directory = parseFundDirectoryScript(text);
  return new Map(directory.map((item) => [item.code, item] satisfies [string, FundDirectoryItem]));
}

async function fetchPingzhongData(code: string): Promise<PingzhongData> {
  const text = await runCurlText(`https://fund.eastmoney.com/pingzhongdata/${code}.js?v=${Date.now()}`, ['User-Agent: Mozilla/5.0']);
  const fundName = extractVarString(text, 'fS_name') || code;
  const netWorthTrend = extractVarJson<PingzhongNetWorthPoint[]>(text, 'Data_netWorthTrend') || [];
  const latestPoint = netWorthTrend
    .filter((point) => typeof point.x === 'number' && typeof point.y === 'number')
    .sort((left, right) => Number(left.x) - Number(right.x))
    .at(-1);
  const scalePayload = extractVarJson<PingzhongScalePayload>(text, 'Data_fluctuationScale');
  const managerPayload = extractVarJson<PingzhongManagerPayload>(text, 'Data_currentFundManager') || [];
  const assetAllocation = extractVarJson<Record<string, unknown>>(text, 'Data_assetAllocation') || {};
  const tags = Array.from(new Set<string>());
  const dividend = resolveDividendMode(netWorthTrend, tags);

  return {
    fundName,
    sourceRate: parseNumber(extractVarString(text, 'fund_sourceRate')),
    currentRate: parseNumber(extractVarString(text, 'fund_Rate')),
    return1m: parseNumber(extractVarString(text, 'syl_1y')),
    return1y: parseNumber(extractVarString(text, 'syl_1n')),
    navPrice: latestPoint?.y ?? null,
    navChangePercent: parseNumber(latestPoint?.equityReturn),
    navDate:
      typeof latestPoint?.x === 'number' && Number.isFinite(latestPoint.x)
        ? new Date(latestPoint.x).toISOString()
        : null,
    maxDrawdown: computeMaxDrawdown(netWorthTrend),
    scaleAmount: parseNumber(scalePayload?.series?.at(-1)?.y) === null ? null : Number(scalePayload?.series?.at(-1)?.y || 0) * 100_000_000,
    managerName: managerPayload[0]?.name?.trim() || null,
    managerWorkTime: managerPayload[0]?.workTime?.trim() || null,
    managerFundSizeText: managerPayload[0]?.fundSize?.trim() || null,
    dividendMode: dividend.mode,
    dividendEvents: dividend.count,
    assetAllocation,
  };
}

async function fetchEtfQuote(code: string, exchange: 'sh' | 'sz' | 'otc'): Promise<EtfQuote | null> {
  if (exchange === 'otc') {
    return null;
  }
  const secid = `${exchange === 'sh' ? '1' : '0'}.${code}`;
  const payload = (await runCurlJson(
    `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f43,f48,f57,f58,f60,f170`,
    ['User-Agent: Mozilla/5.0', 'Referer: https://quote.eastmoney.com/'],
  )) as {data?: Record<string, unknown> | null};
  const data = payload?.data;
  if (!data) {
    return null;
  }
  return {
    currentPrice: parseNumber(data.f43) === null ? null : Number(data.f43) / 1000,
    changePercent: parseNumber(data.f170) === null ? null : Number(data.f170) / 100,
    amount: parseNumber(data.f48),
    raw: data,
  };
}

function buildFundRow(
  directory: FundDirectoryItem,
  pingzhong: PingzhongData,
  quote: EtfQuote | null,
  seed?: CuratedFundSeed,
): FundImportRow {
  const instrumentKind = determineInstrumentKind(directory, seed);
  const exchange = determineExchange(directory, instrumentKind);
  const region = determineRegion(directory, instrumentKind, seed);
  const strategyTags = buildStrategyTags(directory, instrumentKind, region, seed);
  const riskLevel = determineRiskLevel(directory, instrumentKind, strategyTags, seed);
  const dividend = resolveDividendMode([], strategyTags);
  const feeRate = pingzhong.sourceRate ?? pingzhong.currentRate;
  const currentPrice = instrumentKind === 'etf' || instrumentKind === 'qdii' ? quote?.currentPrice ?? pingzhong.navPrice : pingzhong.navPrice;
  const changePercent = instrumentKind === 'etf' || instrumentKind === 'qdii' ? quote?.changePercent ?? pingzhong.navChangePercent : pingzhong.navChangePercent;
  const trackingTarget = inferTrackingTarget(directory, seed);
  const active = (currentPrice ?? pingzhong.navPrice ?? 0) > 0;

  return {
    id: `fund:cn_fund:${exchange}:${directory.code}`,
    market: 'cn_fund',
    exchange,
    symbol: directory.code,
    fundName: pingzhong.fundName || directory.name,
    fundType: directory.fundType || null,
    instrumentKind,
    region,
    riskLevel,
    managerName: pingzhong.managerName,
    trackingTarget,
    status: active ? 'active' : 'suspended',
    source: 'eastmoney',
    sourceId: directory.code,
    currentPrice,
    navPrice: pingzhong.navPrice,
    changePercent,
    return1m: pingzhong.return1m,
    return1y: pingzhong.return1y,
    maxDrawdown: pingzhong.maxDrawdown,
    scaleAmount: pingzhong.scaleAmount,
    feeRate,
    amount: quote?.amount ?? null,
    turnoverRate: null,
    dividendMode: pingzhong.dividendMode || dividend.mode,
    strategyTags,
    metadata: {
      provider: 'eastmoney',
      universe: 'core_fund_market',
      summary: seed?.summary || null,
      ai_focus: seed?.aiFocus || null,
      watchlisted: Boolean(seed?.watchlisted),
      theme_key: seed?.themeKey || null,
      manager_work_time: pingzhong.managerWorkTime,
      manager_fund_size_text: pingzhong.managerFundSizeText,
      latest_nav_date: pingzhong.navDate,
      dividend_events: pingzhong.dividendEvents,
      asset_allocation: pingzhong.assetAllocation,
      raw_quote: quote?.raw || null,
    },
  };
}

async function upsertBatch(pool: Pool, rows: FundImportRow[]): Promise<void> {
  if (rows.length === 0) return;
  const values: unknown[] = [];
  const tuples = rows.map((row, index) => {
    const offset = index * 27;
    values.push(
      row.id,
      row.market,
      row.exchange,
      row.symbol,
      row.fundName,
      row.fundType,
      row.instrumentKind,
      row.region,
      row.riskLevel,
      row.managerName,
      row.trackingTarget,
      row.status,
      row.source,
      row.sourceId,
      row.currentPrice,
      row.navPrice,
      row.changePercent,
      row.return1m,
      row.return1y,
      row.maxDrawdown,
      row.scaleAmount,
      row.feeRate,
      row.amount,
      row.turnoverRate,
      row.dividendMode,
      row.strategyTags,
      JSON.stringify(row.metadata),
    );
    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13}, $${offset + 14}, $${offset + 15}, $${offset + 16}, $${offset + 17}, $${offset + 18}, $${offset + 19}, $${offset + 20}, $${offset + 21}, $${offset + 22}, $${offset + 23}, $${offset + 24}, $${offset + 25}, $${offset + 26}, $${offset + 27}::jsonb)`;
  });

  await pool.query(
    `
      insert into market_fund_catalog (
        id,
        market,
        exchange,
        symbol,
        fund_name,
        fund_type,
        instrument_kind,
        region,
        risk_level,
        manager_name,
        tracking_target,
        status,
        source,
        source_id,
        current_price,
        nav_price,
        change_percent,
        return_1m,
        return_1y,
        max_drawdown,
        scale_amount,
        fee_rate,
        amount,
        turnover_rate,
        dividend_mode,
        strategy_tags,
        metadata_json
      )
      values ${tuples.join(',\n')}
      on conflict (id)
      do update set
        market = excluded.market,
        exchange = excluded.exchange,
        symbol = excluded.symbol,
        fund_name = excluded.fund_name,
        fund_type = excluded.fund_type,
        instrument_kind = excluded.instrument_kind,
        region = excluded.region,
        risk_level = excluded.risk_level,
        manager_name = excluded.manager_name,
        tracking_target = excluded.tracking_target,
        status = excluded.status,
        source = excluded.source,
        source_id = excluded.source_id,
        current_price = excluded.current_price,
        nav_price = excluded.nav_price,
        change_percent = excluded.change_percent,
        return_1m = excluded.return_1m,
        return_1y = excluded.return_1y,
        max_drawdown = excluded.max_drawdown,
        scale_amount = excluded.scale_amount,
        fee_rate = excluded.fee_rate,
        amount = excluded.amount,
        turnover_rate = excluded.turnover_rate,
        dividend_mode = excluded.dividend_mode,
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
  const directory = await fetchFundDirectory();
  const rows: FundImportRow[] = [];

  for (const [index, seed] of CURATED_FUND_UNIVERSE.entries()) {
    const directoryItem = directory.get(seed.code);
    if (!directoryItem) {
      console.warn(`[import-cn-funds] missing directory item for ${seed.code}`);
      continue;
    }

    try {
      const pingzhong = await fetchPingzhongData(seed.code);
      const instrumentKind = determineInstrumentKind(directoryItem, seed);
      const exchange = determineExchange(directoryItem, instrumentKind);
      let quote: EtfQuote | null = null;
      if (instrumentKind === 'etf' || instrumentKind === 'qdii') {
        try {
          quote = await fetchEtfQuote(seed.code, exchange);
        } catch (quoteError) {
          console.warn(
            `[import-cn-funds] quote fetch failed for ${seed.code}: ${
              quoteError instanceof Error ? quoteError.message.split('\n')[0] : String(quoteError)
            }`,
          );
        }
      }
      const row = buildFundRow(directoryItem, pingzhong, quote, seed);
      rows.push(row);
      console.log(
        `[import-cn-funds] prepared ${index + 1}/${CURATED_FUND_UNIVERSE.length} ${row.symbol} ${row.fundName}`,
      );
    } catch (error) {
      console.warn(
        `[import-cn-funds] skipped ${seed.code}: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`,
      );
    }
    await sleep(80);
  }

  const pool = new Pool(buildPgPoolConfig(config.databaseUrl));
  try {
    await pool.query(`delete from market_fund_catalog where market = 'cn_fund'`);
    for (let index = 0; index < rows.length; index += 100) {
      const batch = rows.slice(index, index + 100);
      await upsertBatch(pool, batch);
      const batchNo = Math.floor(index / 100) + 1;
      const batchTotal = Math.ceil(rows.length / 100);
      console.log(`[import-cn-funds] db batch ${batchNo}/${batchTotal} upserted ${batch.length} rows`);
    }
    const countResult = await pool.query<{count: string}>(
      `select count(*)::text as count from market_fund_catalog where market = 'cn_fund'`,
    );
    console.log(
      `[import-cn-funds] completed: prepared=${rows.length} stored=${countResult.rows[0]?.count || '0'}`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('[import-cn-funds] failed', error);
  process.exitCode = 1;
});
