export type FinancePresetCategory = '全部' | '晨报复盘' | '提醒跟踪' | '风险巡检' | '周报简报';
export type FinancePresetMarket = 'A股' | '美股' | '港股' | '宏观' | '基金' | '加密';
export type FinancePresetOutputFormat = '摘要' | '表格' | '报告';
export type FinancePresetSelectionScope = '全部自选' | '核心关注' | '短线观察' | '长期配置';

export type FinancePresetScheduleChoice = {
  id: string;
  label: string;
  detail: string;
  frequency: 'daily' | 'weekly';
  runTime: string;
  weekday?: string;
};

export type FinancePresetInstallConfig = {
  markets: FinancePresetMarket[];
  selectionScope: FinancePresetSelectionScope;
  scheduleId: string;
  outputFormat: FinancePresetOutputFormat;
  focusKeywords: string;
};

export type FinancePresetTaskTemplate = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  category: Exclude<FinancePresetCategory, '全部'>;
  defaultTime: string;
  outputType: string;
  icon:
    | 'sunrise'
    | 'sun'
    | 'sunset'
    | 'moon'
    | 'bell'
    | 'file-text'
    | 'calendar'
    | 'shield-alert'
    | 'trending-up'
    | 'pie-chart';
  accent:
    | 'amber'
    | 'gold'
    | 'orange'
    | 'violet'
    | 'rose'
    | 'blue'
    | 'green'
    | 'red';
  defaultMarkets: FinancePresetMarket[];
  defaultSelectionScope: FinancePresetSelectionScope;
  defaultOutputFormat: FinancePresetOutputFormat;
  scheduleChoices: FinancePresetScheduleChoice[];
  promptTemplate: string;
};

export const FINANCE_PRESET_CATEGORIES: FinancePresetCategory[] = [
  '全部',
  '晨报复盘',
  '提醒跟踪',
  '风险巡检',
  '周报简报',
];

export const FINANCE_PRESET_MARKETS: FinancePresetMarket[] = ['A股', '美股', '港股', '宏观', '基金', '加密'];
export const FINANCE_SELECTION_SCOPE_OPTIONS: FinancePresetSelectionScope[] = [
  '全部自选',
  '核心关注',
  '短线观察',
  '长期配置',
];
export const FINANCE_OUTPUT_OPTIONS: FinancePresetOutputFormat[] = ['摘要', '表格', '报告'];

export const FINANCE_CRON_PRESETS: FinancePresetTaskTemplate[] = [
  {
    id: 'open-morning-brief',
    name: '开盘前晨报',
    description: '开盘前快速掌握隔夜市场、重点事件与今日关注方向。',
    tags: ['A股', '美股', '每日', '晨报'],
    category: '晨报复盘',
    defaultTime: '每日 08:30',
    outputType: '摘要简报',
    icon: 'sunrise',
    accent: 'orange',
    defaultMarkets: ['A股', '美股'],
    defaultSelectionScope: '核心关注',
    defaultOutputFormat: '摘要',
    scheduleChoices: [
      { id: 'daily-0830', label: '每天 08:30', detail: '适合开盘前统一浏览重点信息', frequency: 'daily', runTime: '08:30' },
      { id: 'daily-0900', label: '每天 09:00', detail: '更靠近交易开始时段', frequency: 'daily', runTime: '09:00' },
    ],
    promptTemplate: '请生成一份开盘前晨报，覆盖隔夜市场、重点宏观事件、重要公告以及今天最值得关注的线索。',
  },
  {
    id: 'midday-market-snapshot',
    name: '午间市场快照',
    description: '午间快速查看指数表现、热点板块和资金风格变化。',
    tags: ['A股', '港股', '每日', '快照'],
    category: '晨报复盘',
    defaultTime: '每日 12:30',
    outputType: '摘要 + 表格',
    icon: 'sun',
    accent: 'gold',
    defaultMarkets: ['A股', '港股'],
    defaultSelectionScope: '全部自选',
    defaultOutputFormat: '表格',
    scheduleChoices: [
      { id: 'daily-1230', label: '每天 12:30', detail: '适合午间固定查看市场切片', frequency: 'daily', runTime: '12:30' },
      { id: 'daily-1300', label: '每天 13:00', detail: '更靠近下午盘前', frequency: 'daily', runTime: '13:00' },
    ],
    promptTemplate: '请生成一份午间市场快照，说明主要指数表现、热点板块、资金风格和值得继续跟踪的自选标的。',
  },
  {
    id: 'closing-recap',
    name: '收盘复盘',
    description: '收盘后自动整理市场表现、板块轮动与明日关注线索。',
    tags: ['A股', '美股', '每日', '复盘'],
    category: '晨报复盘',
    defaultTime: '每日 16:10',
    outputType: '复盘简报',
    icon: 'sunset',
    accent: 'amber',
    defaultMarkets: ['A股', '美股'],
    defaultSelectionScope: '核心关注',
    defaultOutputFormat: '报告',
    scheduleChoices: [
      { id: 'daily-1610', label: '每天 16:10', detail: '适合收盘后快速复盘', frequency: 'daily', runTime: '16:10' },
      { id: 'daily-1800', label: '每天 18:00', detail: '适合盘后信息更完整时输出', frequency: 'daily', runTime: '18:00' },
    ],
    promptTemplate: '请基于今天市场表现生成一份收盘复盘，覆盖指数、板块轮动、风险点以及明日关注线索。',
  },
  {
    id: 'us-night-watch',
    name: '夜间美股观察',
    description: '晚间跟踪美股指数、中概与重点科技股的盘中动态。',
    tags: ['美股', '每日', '跟踪'],
    category: '提醒跟踪',
    defaultTime: '每日 22:30',
    outputType: '消息摘要',
    icon: 'moon',
    accent: 'violet',
    defaultMarkets: ['美股'],
    defaultSelectionScope: '核心关注',
    defaultOutputFormat: '摘要',
    scheduleChoices: [
      { id: 'daily-2230', label: '每天 22:30', detail: '适合晚间查看美股开盘后动态', frequency: 'daily', runTime: '22:30' },
      { id: 'daily-2330', label: '每天 23:30', detail: '适合盘中进一步确认方向', frequency: 'daily', runTime: '23:30' },
    ],
    promptTemplate: '请跟踪美股夜盘表现，重点关注指数、中概股和科技龙头的关键变化，并输出值得继续跟踪的信号。',
  },
  {
    id: 'watchlist-announcement',
    name: '自选股公告提醒',
    description: '自动跟踪自选股公告、回购、分红和重大事项变化。',
    tags: ['A股', '美股', '提醒', '自选股'],
    category: '提醒跟踪',
    defaultTime: '每日 09:30',
    outputType: '提醒消息',
    icon: 'bell',
    accent: 'red',
    defaultMarkets: ['A股', '美股'],
    defaultSelectionScope: '全部自选',
    defaultOutputFormat: '摘要',
    scheduleChoices: [
      { id: 'daily-0930', label: '每天 09:30', detail: '开盘后统一检查一次重要公告', frequency: 'daily', runTime: '09:30' },
      { id: 'daily-1830', label: '每天 18:30', detail: '适合盘后集中查看公告更新', frequency: 'daily', runTime: '18:30' },
    ],
    promptTemplate: '请检查自选股相关公告、回购、分红和重大事项变化，只输出真正值得提醒的内容，并说明影响方向。',
  },
  {
    id: 'watchlist-earnings',
    name: '自选股财报提醒',
    description: '在财报前提醒，在财报后自动生成业绩解读。',
    tags: ['美股', 'A股', '财报', '自选股'],
    category: '提醒跟踪',
    defaultTime: '每日 08:00',
    outputType: '提醒 + 解读',
    icon: 'file-text',
    accent: 'blue',
    defaultMarkets: ['A股', '美股'],
    defaultSelectionScope: '核心关注',
    defaultOutputFormat: '报告',
    scheduleChoices: [
      { id: 'daily-0800', label: '每天 08:00', detail: '适合在交易前查看财报安排', frequency: 'daily', runTime: '08:00' },
      { id: 'daily-2000', label: '每天 20:00', detail: '适合盘后输出财报解读', frequency: 'daily', runTime: '20:00' },
    ],
    promptTemplate: '请检查自选股的财报安排与最新财报结果；如有财报，输出提醒并附上重点解读，包括预期差、风险和后续关注点。',
  },
  {
    id: 'macro-calendar',
    name: '宏观日历提醒',
    description: '自动提醒 CPI、PPI、PMI、非农、LPR 等关键宏观事件。',
    tags: ['宏观', '提醒', '数据日历'],
    category: '提醒跟踪',
    defaultTime: '每日 08:00',
    outputType: '提醒消息',
    icon: 'calendar',
    accent: 'green',
    defaultMarkets: ['宏观'],
    defaultSelectionScope: '全部自选',
    defaultOutputFormat: '摘要',
    scheduleChoices: [
      { id: 'daily-0800', label: '每天 08:00', detail: '适合交易日前统一看宏观事件', frequency: 'daily', runTime: '08:00' },
      { id: 'daily-1900', label: '每天 19:00', detail: '适合晚间同步第二天宏观日历', frequency: 'daily', runTime: '19:00' },
    ],
    promptTemplate: '请梳理接下来值得关注的宏观数据与政策事件，提醒时间、市场影响以及应该重点看的指标。',
  },
  {
    id: 'portfolio-risk-check',
    name: '持仓风险巡检',
    description: '定期检查组合集中度、波动、回撤与潜在风险暴露。',
    tags: ['组合', '风险', '巡检'],
    category: '风险巡检',
    defaultTime: '每日 21:00',
    outputType: '风险摘要',
    icon: 'shield-alert',
    accent: 'amber',
    defaultMarkets: ['A股', '美股', '基金'],
    defaultSelectionScope: '长期配置',
    defaultOutputFormat: '报告',
    scheduleChoices: [
      { id: 'daily-2100', label: '每天 21:00', detail: '适合收盘后做组合风险体检', frequency: 'daily', runTime: '21:00' },
      { id: 'weekly-0-2000', label: '每周日 20:00', detail: '适合周度风险巡检', frequency: 'weekly', runTime: '20:00', weekday: '0' },
    ],
    promptTemplate: '请对当前持仓做一次风险巡检，重点检查集中度、风格偏离、波动、回撤和潜在风险暴露，并给出建议。',
  },
  {
    id: 'weekly-investment-report',
    name: '每周投资周报',
    description: '每周自动汇总市场变化、持仓表现与下周关注重点。',
    tags: ['周报', '组合', '研究'],
    category: '周报简报',
    defaultTime: '每周日 20:00',
    outputType: '周报',
    icon: 'trending-up',
    accent: 'violet',
    defaultMarkets: ['A股', '美股', '宏观'],
    defaultSelectionScope: '核心关注',
    defaultOutputFormat: '报告',
    scheduleChoices: [
      { id: 'weekly-0-2000', label: '每周日 20:00', detail: '适合周末统一复盘并规划下周', frequency: 'weekly', runTime: '20:00', weekday: '0' },
      { id: 'weekly-6-1700', label: '每周六 17:00', detail: '适合周末更早查看周报', frequency: 'weekly', runTime: '17:00', weekday: '6' },
    ],
    promptTemplate: '请生成一份每周投资周报，覆盖市场变化、持仓表现、关键事件、风险和下周关注重点。',
  },
  {
    id: 'fund-tracking-brief',
    name: '基金跟踪简报',
    description: '跟踪基金净值变化、风格漂移、回撤与重仓变化。',
    tags: ['基金', '每周', '跟踪'],
    category: '周报简报',
    defaultTime: '每周五 18:30',
    outputType: '简报',
    icon: 'pie-chart',
    accent: 'green',
    defaultMarkets: ['基金'],
    defaultSelectionScope: '长期配置',
    defaultOutputFormat: '摘要',
    scheduleChoices: [
      { id: 'weekly-5-1830', label: '每周五 18:30', detail: '适合周内结束时跟踪基金表现', frequency: 'weekly', runTime: '18:30', weekday: '5' },
      { id: 'weekly-0-1000', label: '每周日 10:00', detail: '适合周末整理基金观察', frequency: 'weekly', runTime: '10:00', weekday: '0' },
    ],
    promptTemplate: '请生成一份基金跟踪简报，覆盖净值表现、回撤、风格漂移、重仓变化以及后续需要关注的要点。',
  },
];

export function buildFinancePresetJobName(
  task: FinancePresetTaskTemplate,
  input: FinancePresetInstallConfig,
): string {
  const marketLabel = input.markets.slice(0, 2).join(' / ');
  const suffix = marketLabel ? ` · ${marketLabel}` : '';
  return `${task.name}${suffix}`;
}

export function buildFinancePresetPrompt(
  task: FinancePresetTaskTemplate,
  input: FinancePresetInstallConfig,
): string {
  const lines = [
    task.promptTemplate,
    '',
    '执行要求：',
    `- 覆盖市场：${input.markets.join('、') || task.defaultMarkets.join('、')}`,
    `- 自选范围：${input.selectionScope}`,
    `- 输出方式：${input.outputFormat}`,
    input.focusKeywords.trim() ? `- 重点关注：${input.focusKeywords.trim()}` : null,
    '',
    '输出规则：',
    input.outputFormat === '摘要'
      ? '- 请优先给出简洁摘要和关键判断。'
      : input.outputFormat === '表格'
        ? '- 请优先使用表格整理关键信息，并补充简短说明。'
        : '- 请按结构化报告方式输出结论、数据、风险和后续关注点。',
    '- 如果没有值得提醒或复盘的内容，也请明确说明“本次无重要变化”。',
  ].filter((line): line is string => Boolean(line));

  return lines.join('\n');
}
