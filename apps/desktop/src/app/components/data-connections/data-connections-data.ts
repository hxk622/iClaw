export interface DataConnectionCapability {
  group: string;
  title: string;
  subtitle: string;
  markets: string[];
  capabilities: string[];
  status?: '已支持' | '规划中';
  scenarios: Array<'fundamental' | 'tracking' | 'quant'>;
}

export interface DataConnectionCapabilityGroup {
  title: string;
  description: string;
  items: DataConnectionCapability[];
}

export interface DataConnectionScenario {
  id: 'fundamental' | 'tracking' | 'quant';
  label: string;
  description: string;
  summary: string;
}

export const DATA_CONNECTION_MARKETS = [
  '全部',
  'A股',
  '美股',
  '港股',
  '期货',
  '黄金',
  '加密',
  '宏观',
  'ETF/基金',
  '外汇',
] as const;

export const DATA_CONNECTION_STATUS = ['全部', '已支持', '规划中'] as const;

export const DATA_CONNECTION_SCENARIOS: DataConnectionScenario[] = [
  {
    id: 'fundamental',
    label: '基本面研究',
    description: '财报、估值、盈利',
    summary: '偏公司财务与价值分析',
  },
  {
    id: 'tracking',
    label: '市场跟踪',
    description: '行情、资讯、事件',
    summary: '偏日常监控与异动追踪',
  },
  {
    id: 'quant',
    label: '量化分析',
    description: '因子、信号、筛选',
    summary: '偏结构化信号与策略研究',
  },
] as const;

export const DATA_CONNECTION_GROUPS: DataConnectionCapabilityGroup[] = [
  {
    title: '行情与价格',
    description: '实时与历史价格数据，覆盖股票、指数、期货、贵金属与加密资产。',
    items: [
      {
        group: '行情与价格',
        title: '获取实时行情',
        subtitle: '获取股票、指数、期货、黄金与加密资产的最新价格、涨跌幅与成交信息。',
        markets: ['A股', '美股', '港股', '期货', '黄金', '加密'],
        capabilities: ['最新价', '涨跌幅', '成交额', '盘口快照'],
        status: '已支持',
        scenarios: ['tracking', 'quant'],
      },
      {
        group: '行情与价格',
        title: '获取历史行情',
        subtitle: '查询多市场资产的历史价格走势，支持区间、日线、周线与分时维度。',
        markets: ['A股', '美股', '港股', '期货', '黄金', '加密'],
        capabilities: ['日线', '分时', '复权', '区间涨跌'],
        status: '已支持',
        scenarios: ['tracking', 'quant'],
      },
    ],
  },
  {
    title: '财务与估值',
    description: '上市公司财务报表、关键指标与估值数据。',
    items: [
      {
        group: '财务与估值',
        title: '获取财务报表',
        subtitle: '获取上市公司的利润表、资产负债表与现金流量表。',
        markets: ['A股', '美股', '港股'],
        capabilities: ['利润表', '资产负债表', '现金流量表'],
        status: '已支持',
        scenarios: ['fundamental'],
      },
      {
        group: '财务与估值',
        title: '获取财务指标',
        subtitle: '提取估值、盈利能力、杠杆、成长与现金流等关键财务指标。',
        markets: ['A股', '美股', '港股'],
        capabilities: ['PE', 'PB', 'ROE', '毛利率', '自由现金流'],
        status: '已支持',
        scenarios: ['fundamental', 'quant'],
      },
      {
        group: '财务与估值',
        title: '获取 ETF 与基金数据',
        subtitle: '获取 ETF、基金的行情、持仓、分红、成分与结构信息。',
        markets: ['ETF/基金', 'A股', '美股', '港股'],
        capabilities: ['持仓', '成分', '分红', '折溢价'],
        status: '已支持',
        scenarios: ['fundamental', 'tracking'],
      },
    ],
  },
  {
    title: '新闻与披露',
    description: '公司资讯、监管披露与内部人交易信息。',
    items: [
      {
        group: '新闻与披露',
        title: '获取公司资讯',
        subtitle: '获取公司新闻、公告、财报发布与重大事件动态。',
        markets: ['A股', '美股', '港股'],
        capabilities: ['新闻', '公告', '重大事件', '舆情追踪'],
        status: '已支持',
        scenarios: ['tracking', 'fundamental'],
      },
      {
        group: '新闻与披露',
        title: '获取内部人交易与监管披露',
        subtitle: '获取内部交易、监管文件与关键披露信息。',
        markets: ['A股', '美股'],
        capabilities: ['Form 4', 'SEC 披露', '董监高增减持'],
        status: '已支持',
        scenarios: ['tracking', 'fundamental'],
      },
      {
        group: '新闻与披露',
        title: '获取港股数据',
        subtitle: '获取港股与港股通标的的行情、财报、新闻与 ETF 数据。',
        markets: ['港股'],
        capabilities: ['港股通', '恒生科技', '财报', 'ETF'],
        status: '已支持',
        scenarios: ['tracking', 'fundamental'],
      },
    ],
  },
  {
    title: '宏观与利率',
    description: '宏观经济指标、利率数据与经济日历。',
    items: [
      {
        group: '宏观与利率',
        title: '获取宏观与利率数据',
        subtitle: '获取通胀、利率、就业、增长与流动性等核心宏观指标。',
        markets: ['中国', '美国', '全球', '宏观'],
        capabilities: ['CPI', 'PPI', 'PMI', '非农', 'GDP', '利率'],
        status: '已支持',
        scenarios: ['fundamental', 'tracking'],
      },
      {
        group: '宏观与利率',
        title: '获取外汇与经济日历',
        subtitle: '获取汇率、美元指数、宏观发布时间与经济事件日历。',
        markets: ['外汇', '宏观', '全球'],
        capabilities: ['汇率', '美元指数', '经济日历', '发布时间'],
        status: '已支持',
        scenarios: ['tracking', 'fundamental'],
      },
    ],
  },
  {
    title: '加密与另类资产',
    description: '加密货币、数字资产与另类投资数据。',
    items: [
      {
        group: '加密与另类资产',
        title: '获取加密资产数据',
        subtitle: '获取加密货币价格、历史走势、市值、成交量与市场概览。',
        markets: ['加密'],
        capabilities: ['实时价格', '历史价格', '币种列表', '市值排名'],
        status: '已支持',
        scenarios: ['tracking', 'quant'],
      },
      {
        group: '加密与另类资产',
        title: '获取期货与贵金属数据',
        subtitle: '获取主要期货合约、黄金、白银及大宗商品市场数据。',
        markets: ['期货', '黄金', '贵金属'],
        capabilities: ['主力合约', '黄金', '白银', '原油'],
        status: '已支持',
        scenarios: ['tracking', 'quant'],
      },
    ],
  },
  {
    title: '量化与筛选',
    description: '技术指标、量化因子与结构化筛选工具。',
    items: [
      {
        group: '量化与筛选',
        title: '获取技术指标',
        subtitle: '基于历史行情计算常用技术指标与趋势信号。',
        markets: ['A股', '美股', '港股', '加密'],
        capabilities: ['MA', 'MACD', 'RSI', '布林带', 'ATR'],
        status: '已支持',
        scenarios: ['quant', 'tracking'],
      },
      {
        group: '量化与筛选',
        title: '获取量化因子与筛选结果',
        subtitle: '获取价值、动量、质量、成长等因子分析与筛选结果。',
        markets: ['A股', '美股', '量化'],
        capabilities: ['价值因子', '动量因子', '质量因子', '多因子筛选'],
        status: '已支持',
        scenarios: ['quant', 'fundamental'],
      },
    ],
  },
];

export const DATA_CONNECTION_CAPABILITIES = DATA_CONNECTION_GROUPS.flatMap((group) => group.items);
