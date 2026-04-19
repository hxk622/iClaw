export type FinanceCapabilityClass =
  | 'data_only'
  | 'research_only'
  | 'investment_view'
  | 'actionable_advice'
  | 'execution_linked';

export type FinanceInputClassification =
  | 'market_info'
  | 'research_request'
  | 'advice_request'
  | 'personalized_request'
  | 'execution_request';

export type FinanceOutputClassification =
  | 'market_data'
  | 'research_summary'
  | 'investment_view'
  | 'actionable_advice';

export type FinanceComplianceRiskLevel = 'low' | 'medium' | 'high';
export type FinanceComplianceChannel = 'chat' | 'cron' | 'notification' | 'report';

export interface FinanceCapabilityPolicy {
  domain: 'finance';
  capabilityClass: FinanceCapabilityClass;
  complianceProfile: string;
  adviceLevel: 'research_only' | 'investment_view' | 'actionable_advice';
  requiresDisclaimer: boolean;
  requiresRiskSection: boolean;
  forbidPersonalizedSuitability: boolean;
  forbidReturnPromise: boolean;
  allowNotificationSummary: boolean;
  allowCronDigest: boolean;
  dataDelayPolicy?: string | null;
}

export interface FinanceOemCompliancePolicy {
  complianceEnabled: boolean;
  classificationPolicy: string;
  disclaimerPolicy: string;
  disclaimerText: string;
  blockingPolicy: string;
  showFor: FinanceOutputClassification[];
  hideFor: FinanceOutputClassification[];
  blockFor: FinanceInputClassification[];
  degradeFor: FinanceInputClassification[];
}

export interface FinanceOemComplianceConfigShape {
  enabled: boolean;
  classificationPolicy: string;
  disclaimerPolicy: string;
  disclaimerText: string;
  blockingPolicy: string;
  showFor: FinanceOutputClassification[];
  hideFor: FinanceOutputClassification[];
  blockFor: FinanceInputClassification[];
  degradeFor: FinanceInputClassification[];
}

export interface ComplianceEnvelope {
  answer: string;
  compliance: {
    domain: 'finance';
    inputClassification: FinanceInputClassification | null;
    outputClassification: FinanceOutputClassification | null;
    riskLevel: FinanceComplianceRiskLevel;
    showDisclaimer: boolean;
    disclaimerText: string | null;
    requiresRiskSection: boolean;
    blocked: boolean;
    degraded: boolean;
    reasons: string[];
    usedCapabilities: string[];
    usedModel: string | null;
    sourceAttributionRequired: boolean;
    timestampRequired: boolean;
  };
}

export type FinanceComplianceSnapshot = ComplianceEnvelope['compliance'];

export interface ResolveFinanceComplianceInput {
  appName: string;
  channel: FinanceComplianceChannel;
  answer: string;
  inputClassification: FinanceInputClassification | null;
  outputClassification: FinanceOutputClassification | null;
  capabilityPolicies: FinanceCapabilityPolicy[];
  oemPolicy: FinanceOemCompliancePolicy | null;
  usedCapabilities?: string[];
  usedModel?: string | null;
}

export interface ResolveFinanceComplianceResult extends ComplianceEnvelope {
  presentation: {
    mode: 'show' | 'show_with_disclaimer' | 'degrade' | 'block';
    replacementText?: string | null;
  };
}

const DEFAULT_DISCLAIMER_TEXT = '本回答由AI生成，仅供参考，请仔细甄别，谨慎投资。';
const DEFAULT_FINANCE_OEM_POLICY: FinanceOemCompliancePolicy = {
  complianceEnabled: true,
  classificationPolicy: 'finance_v1',
  disclaimerPolicy: 'finance_inline_small',
  disclaimerText: DEFAULT_DISCLAIMER_TEXT,
  blockingPolicy: 'research_only',
  showFor: ['investment_view', 'actionable_advice'],
  hideFor: ['market_data'],
  blockFor: ['execution_request'],
  degradeFor: ['advice_request', 'personalized_request'],
};

const FINANCE_KEYWORDS = [
  '投资',
  '理财',
  '基金',
  '股票',
  'etf',
  'a股',
  '港股',
  '美股',
  '债券',
  '估值',
  '仓位',
  '收益',
  '回撤',
  '分红',
  '晨报',
  '市场',
  '指数',
  '买入',
  '卖出',
  '加仓',
  '减仓',
  '配置',
];

const ACTIONABLE_HINTS = ['买入', '卖出', '加仓', '减仓', '建仓', '清仓', '止盈', '止损', '仓位'];
const DIRECT_ACTION_VERBS = ['买入', '卖出', '加仓', '减仓', '建仓', '清仓', '止盈', '止损'];
const PORTFOLIO_VIEW_HINTS = ['仓位', '配置', '配仓', '风险暴露'];
const PERSONALIZED_HINTS = ['我有', '我想投', '我该怎么配', '适合我', '我的持仓', '我的风险偏好'];
const EXECUTION_HINTS = ['帮我卖', '帮我买', '替我买', '替我卖', '直接下单', '执行交易'];
const STRONG_ACTIONABLE_PHRASES = [
  '建议买入',
  '建议卖出',
  '建议加仓',
  '建议减仓',
  '建议建仓',
  '建议清仓',
  '建议止盈',
  '建议止损',
  '现在可以买',
  '现在可以卖',
  '可以上车',
  '可以介入',
  '适合买入',
  '适合加仓',
];
const ACTIONABLE_STRUCTURE_HINTS = ['建议', '可以', '可考虑', '优先', '适合', '操作', '仓位'];
const INVESTMENT_VIEW_HINTS = ['关注', '估值', '配置', '判断', '风险', '赔率', '胜率', '逻辑', '周期', '流动性'];
const RESEARCH_SUMMARY_HINTS = ['总结', '摘要', '晨报', '复盘', '公告', '财报', '纪要', '提要'];

type ClassifiedResult<T> = {
  classification: T | null;
  reasons: string[];
};

function containsKeyword(text: string, keywords: string[]): boolean {
  const normalized = text.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

function normalizeDisclaimerText(input: string | null | undefined): string | null {
  const text = (input || '').trim();
  return text || null;
}

function hasCapabilityDisclaimerRequirement(capabilityPolicies: FinanceCapabilityPolicy[]): boolean {
  return capabilityPolicies.some((item) => item.requiresDisclaimer);
}

function requiresSourceAttribution(capabilityPolicies: FinanceCapabilityPolicy[]): boolean {
  return capabilityPolicies.some(
    (item) => item.capabilityClass === 'data_only' || item.dataDelayPolicy === 'must_disclose_if_delayed',
  );
}

function requiresTimestamp(capabilityPolicies: FinanceCapabilityPolicy[]): boolean {
  return capabilityPolicies.some((item) => item.capabilityClass === 'data_only');
}

export function shouldShowFinanceDisclaimer(input: {
  outputClassification: FinanceOutputClassification | null;
  capabilityPolicies?: FinanceCapabilityPolicy[];
  oemPolicy?: FinanceOemCompliancePolicy | null;
}): boolean {
  const outputClassification = input.outputClassification;
  const capabilityPolicies = input.capabilityPolicies || [];
  const oemPolicy = input.oemPolicy || null;

  if (oemPolicy?.hideFor.includes(outputClassification || 'market_data')) {
    return false;
  }
  if (outputClassification && oemPolicy?.showFor.includes(outputClassification)) {
    return true;
  }
  return hasCapabilityDisclaimerRequirement(capabilityPolicies);
}

export function resolveFinanceDisclaimerText(input: {
  capabilityPolicies?: FinanceCapabilityPolicy[];
  oemPolicy?: FinanceOemCompliancePolicy | null;
}): string | null {
  const oemText = normalizeDisclaimerText(input.oemPolicy?.disclaimerText);
  if (oemText) {
    return oemText;
  }
  return input.capabilityPolicies && input.capabilityPolicies.length > 0 ? DEFAULT_DISCLAIMER_TEXT : null;
}

export function toFinanceOemCompliancePolicy(
  config: FinanceOemComplianceConfigShape | null | undefined,
): FinanceOemCompliancePolicy | null {
  if (!config) {
    return null;
  }
  return {
    complianceEnabled: config.enabled,
    classificationPolicy: config.classificationPolicy,
    disclaimerPolicy: config.disclaimerPolicy,
    disclaimerText: config.disclaimerText,
    blockingPolicy: config.blockingPolicy,
    showFor: config.showFor,
    hideFor: config.hideFor,
    blockFor: config.blockFor,
    degradeFor: config.degradeFor,
  };
}

export function hasExplicitFinanceComplianceSnapshot(
  snapshot: FinanceComplianceSnapshot | null | undefined,
): snapshot is FinanceComplianceSnapshot {
  return Boolean(snapshot && snapshot.domain === 'finance');
}

export function resolveFinanceDisclaimerFromSnapshot(
  snapshot: FinanceComplianceSnapshot | null | undefined,
): string | null {
  if (!hasExplicitFinanceComplianceSnapshot(snapshot)) {
    return null;
  }
  if (!snapshot.showDisclaimer) {
    return null;
  }
  return snapshot.disclaimerText || DEFAULT_DISCLAIMER_TEXT;
}

export function resolveEffectiveFinanceComplianceSnapshot(input: {
  snapshot?: FinanceComplianceSnapshot | null;
  heuristic?: ResolveFinanceComplianceResult | null;
}): FinanceComplianceSnapshot | null {
  if (hasExplicitFinanceComplianceSnapshot(input.snapshot)) {
    return input.snapshot;
  }
  return input.heuristic?.compliance ?? null;
}

export function resolveEffectiveFinanceDisclaimer(input: {
  snapshot?: FinanceComplianceSnapshot | null;
  heuristic?: ResolveFinanceComplianceResult | null;
}): string | null {
  const effective = resolveEffectiveFinanceComplianceSnapshot(input);
  return resolveFinanceDisclaimerFromSnapshot(effective);
}

export function resolveFinanceComplianceEnvelope(
  input: ResolveFinanceComplianceInput,
): ResolveFinanceComplianceResult {
  const capabilityPolicies = input.capabilityPolicies;
  const showDisclaimer = shouldShowFinanceDisclaimer({
    outputClassification: input.outputClassification,
    capabilityPolicies,
    oemPolicy: input.oemPolicy,
  });
  const disclaimerText = showDisclaimer
    ? resolveFinanceDisclaimerText({ capabilityPolicies, oemPolicy: input.oemPolicy })
    : null;
  const blocked = Boolean(
    input.inputClassification && input.oemPolicy?.blockFor.includes(input.inputClassification),
  );
  const degraded = Boolean(
    !blocked && input.inputClassification && input.oemPolicy?.degradeFor.includes(input.inputClassification),
  );
  const reasons: string[] = ['finance_domain'];
  if (blocked && input.inputClassification) {
    reasons.push(`blocked:${input.inputClassification}`);
  }
  if (degraded && input.inputClassification) {
    reasons.push(`degraded:${input.inputClassification}`);
  }
  if (showDisclaimer) {
    reasons.push('show_disclaimer');
  }

  const presentationMode = blocked
    ? 'block'
    : degraded
      ? 'degrade'
      : showDisclaimer
        ? 'show_with_disclaimer'
        : 'show';

  return {
    answer: input.answer,
    compliance: {
      domain: 'finance',
      inputClassification: input.inputClassification,
      outputClassification: input.outputClassification,
      riskLevel:
        blocked || input.outputClassification === 'actionable_advice'
          ? 'high'
          : input.outputClassification === 'investment_view'
            ? 'medium'
            : 'low',
      showDisclaimer,
      disclaimerText,
      requiresRiskSection: capabilityPolicies.some((item) => item.requiresRiskSection),
      blocked,
      degraded,
      reasons,
      usedCapabilities: input.usedCapabilities || [],
      usedModel: input.usedModel || null,
      sourceAttributionRequired: requiresSourceAttribution(capabilityPolicies),
      timestampRequired: requiresTimestamp(capabilityPolicies),
    },
    presentation: {
      mode: presentationMode,
      replacementText: blocked
        ? '该请求涉及高风险金融执行或受限建议场景，当前仅支持研究参考，不直接提供执行性结论。'
        : degraded
          ? '以下内容已按研究参考口径降级展示，请结合风险与前提自行判断。'
          : null,
    },
  };
}

export function looksLikeFinanceContent(input: string): boolean {
  return containsKeyword(input, FINANCE_KEYWORDS);
}

export function classifyFinanceInputFromText(input: string): FinanceInputClassification | null {
  return classifyFinanceInputDetailed(input).classification;
}

export function classifyFinanceOutputFromText(input: string): FinanceOutputClassification | null {
  return classifyFinanceOutputDetailed(input).classification;
}

export function classifyFinanceInputDetailed(input: string): ClassifiedResult<FinanceInputClassification> {
  const reasons: string[] = [];
  if (!looksLikeFinanceContent(input)) {
    return { classification: null, reasons };
  }
  reasons.push('finance_keyword_hit');
  if (containsKeyword(input, EXECUTION_HINTS)) {
    reasons.push('execution_hint');
    return { classification: 'execution_request', reasons };
  }
  if (containsKeyword(input, PERSONALIZED_HINTS)) {
    reasons.push('personalized_hint');
    return { classification: 'personalized_request', reasons };
  }
  if (containsKeyword(input, ACTIONABLE_HINTS) || containsKeyword(input, ['能买吗', '该买', '该卖', '怎么配仓'])) {
    reasons.push('advice_request_hint');
    return { classification: 'advice_request', reasons };
  }
  if (containsKeyword(input, ['分析', '估值', '怎么看', '复盘', '研究', '拆解'])) {
    reasons.push('research_request_hint');
    return { classification: 'research_request', reasons };
  }
  reasons.push('market_info_fallback');
  return { classification: 'market_info', reasons };
}

export function classifyFinanceOutputDetailed(input: string): ClassifiedResult<FinanceOutputClassification> {
  const reasons: string[] = [];
  if (!looksLikeFinanceContent(input)) {
    return { classification: null, reasons };
  }
  reasons.push('finance_keyword_hit');
  const hasStrongActionablePhrase = containsKeyword(input, STRONG_ACTIONABLE_PHRASES);
  const hasActionVerb = containsKeyword(input, DIRECT_ACTION_VERBS);
  const hasPortfolioViewHint = containsKeyword(input, PORTFOLIO_VIEW_HINTS);
  const hasActionStructure = containsKeyword(input, ACTIONABLE_STRUCTURE_HINTS);
  const hasViewHints = containsKeyword(input, INVESTMENT_VIEW_HINTS);
  const hasSummaryHints = containsKeyword(input, RESEARCH_SUMMARY_HINTS);

  if (hasStrongActionablePhrase) {
    reasons.push('strong_actionable_phrase');
    return { classification: 'actionable_advice', reasons };
  }
  if (hasActionVerb && hasActionStructure) {
    reasons.push('action_verb');
    reasons.push('action_structure');
    return { classification: 'actionable_advice', reasons };
  }
  if (hasActionVerb) {
    reasons.push('action_verb_without_directive');
    return { classification: 'investment_view', reasons };
  }
  if (hasPortfolioViewHint) {
    reasons.push('portfolio_view_hint');
    return { classification: 'investment_view', reasons };
  }
  if (hasViewHints) {
    reasons.push('investment_view_hint');
    return { classification: 'investment_view', reasons };
  }
  if (hasSummaryHints) {
    reasons.push('research_summary_hint');
    return { classification: 'research_summary', reasons };
  }
  reasons.push('market_data_fallback');
  return { classification: 'market_data', reasons };
}

export function buildHeuristicFinanceComplianceEnvelope(input: {
  appName: string;
  channel: FinanceComplianceChannel;
  title?: string | null;
  prompt?: string | null;
  answer: string;
  usedCapabilities?: string[];
  usedModel?: string | null;
  oemPolicy?: FinanceOemCompliancePolicy | null;
}): ResolveFinanceComplianceResult | null {
  const joined = [input.title, input.prompt, input.answer].filter(Boolean).join('\n');
  if (!looksLikeFinanceContent(joined)) {
    return null;
  }
  const inputDecision = classifyFinanceInputDetailed([input.title, input.prompt].filter(Boolean).join('\n'));
  const outputDecision = classifyFinanceOutputDetailed(input.answer);
  const result = resolveFinanceComplianceEnvelope({
    appName: input.appName,
    channel: input.channel,
    answer: input.answer,
    inputClassification: inputDecision.classification,
    outputClassification: outputDecision.classification,
    capabilityPolicies: [],
    oemPolicy: input.oemPolicy || DEFAULT_FINANCE_OEM_POLICY,
    usedCapabilities: input.usedCapabilities,
    usedModel: input.usedModel,
  });
  result.compliance.reasons = Array.from(
    new Set([
      ...result.compliance.reasons,
      ...inputDecision.reasons.map((reason) => `input:${reason}`),
      ...outputDecision.reasons.map((reason) => `output:${reason}`),
    ]),
  );
  return result;
}

export function resolveDisplayFinanceComplianceSnapshot(input: {
  snapshot?: FinanceComplianceSnapshot | null;
  appName: string;
  channel: FinanceComplianceChannel;
  title?: string | null;
  prompt?: string | null;
  answer: string;
  usedModel?: string | null;
  oemPolicy?: FinanceOemCompliancePolicy | null;
}): FinanceComplianceSnapshot | null {
  return resolveEffectiveFinanceComplianceSnapshot({
    snapshot: input.snapshot,
    heuristic: buildHeuristicFinanceComplianceEnvelope({
      appName: input.appName,
      channel: input.channel,
      title: input.title,
      prompt: input.prompt,
      answer: input.answer,
      usedModel: input.usedModel,
      oemPolicy: input.oemPolicy,
    }),
  });
}

export function resolveDisplayFinanceDisclaimer(input: {
  snapshot?: FinanceComplianceSnapshot | null;
  appName: string;
  channel: FinanceComplianceChannel;
  title?: string | null;
  prompt?: string | null;
  answer: string;
  usedModel?: string | null;
  oemPolicy?: FinanceOemCompliancePolicy | null;
}): string | null {
  return resolveEffectiveFinanceDisclaimer({
    snapshot: input.snapshot,
    heuristic: buildHeuristicFinanceComplianceEnvelope({
      appName: input.appName,
      channel: input.channel,
      title: input.title,
      prompt: input.prompt,
      answer: input.answer,
      usedModel: input.usedModel,
      oemPolicy: input.oemPolicy,
    }),
  });
}

export function softenFinanceSummaryForChannel(input: {
  text: string;
  channel: Extract<FinanceComplianceChannel, 'cron' | 'notification'>;
  compliance: FinanceComplianceSnapshot | null | undefined;
}): string {
  const raw = input.text.trim();
  if (!raw) {
    return raw;
  }
  if (!input.compliance || input.compliance.outputClassification !== 'actionable_advice') {
    return raw;
  }

  const softened = raw
    .replace(/建议(关注|加仓|减仓|买入|卖出|配置)/g, '可关注')
    .replace(/(买入|卖出|加仓|减仓|建仓|清仓|止盈|止损)/g, '关注')
    .replace(/仓位/g, '风险暴露')
    .replace(/可以考虑/g, '可进一步研究')
    .replace(/优先/g, '可优先观察');

  if (input.channel === 'notification') {
    return `已生成金融研究结果，请打开查看详情。`;
  }
  return softened;
}
