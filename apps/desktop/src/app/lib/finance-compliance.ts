import {
  classifyFinanceInputDetailed as classifyFinanceInputDetailedCore,
  classifyFinanceOutputDetailed as classifyFinanceOutputDetailedCore,
  FINANCE_CLASSIFIER_VERSION,
  looksLikeFinanceContent as looksLikeFinanceContentCore,
} from './finance-compliance-classifier.ts';
import type { ClassifiedResult } from './finance-compliance-classifier.ts';

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
  | 'execution_request'
  | 'unknown';

export type FinanceOutputClassification =
  | 'market_data'
  | 'research_summary'
  | 'investment_view'
  | 'actionable_advice'
  | 'unknown';

export type FinanceComplianceRiskLevel = 'low' | 'medium' | 'high';
export type FinanceComplianceChannel = 'chat' | 'cron' | 'notification' | 'report';
export type FinanceComplianceConfidence = 'low' | 'medium' | 'high';
export type FinanceComplianceDecisionSource = 'plugin' | 'server' | 'heuristic_fallback';

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
    matchedRules: string[];
    confidence: FinanceComplianceConfidence;
    classifierVersion: string | null;
    decisionSource: FinanceComplianceDecisionSource;
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
  hideFor: ['market_data', 'unknown'],
  blockFor: ['execution_request'],
  degradeFor: ['advice_request', 'personalized_request'],
};

function normalizeDisclaimerText(input: string | null | undefined): string | null {
  const text = (input || '').trim();
  return text || null;
}

function classifyConfidence(input: {
  inputClassification: FinanceInputClassification | null;
  outputClassification: FinanceOutputClassification | null;
  reasons: string[];
}): FinanceComplianceConfidence {
  if (!input.inputClassification || !input.outputClassification) {
    return 'low';
  }
  if (input.inputClassification === 'unknown' || input.outputClassification === 'unknown') {
    return 'low';
  }
  if (input.outputClassification === 'actionable_advice') {
    return input.reasons.some((reason) => reason.includes('strong_actionable_phrase')) ? 'high' : 'medium';
  }
  if (input.outputClassification === 'investment_view') {
    return 'medium';
  }
  return 'high';
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
  const fallback = input.heuristic?.compliance ?? null;
  if (fallback) {
    return fallback;
  }
  return {
    domain: 'finance',
    inputClassification: 'unknown',
    outputClassification: 'unknown',
    riskLevel: 'high',
    showDisclaimer: true,
    disclaimerText: DEFAULT_DISCLAIMER_TEXT,
    requiresRiskSection: true,
    blocked: false,
    degraded: true,
    reasons: ['missing_structured_finance_snapshot'],
    matchedRules: [],
    confidence: 'low',
    classifierVersion: null,
    decisionSource: 'heuristic_fallback',
    usedCapabilities: [],
    usedModel: null,
    sourceAttributionRequired: false,
    timestampRequired: false,
  };
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
      matchedRules: reasons.filter((reason) => reason !== 'finance_domain'),
      confidence: classifyConfidence({
        inputClassification: input.inputClassification,
        outputClassification: input.outputClassification,
        reasons,
      }),
      classifierVersion: input.oemPolicy?.classificationPolicy || 'finance_v1',
      decisionSource: 'heuristic_fallback',
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

export function classifyFinanceInputDetailed(input: string): ClassifiedResult<FinanceInputClassification> {
  return classifyFinanceInputDetailedCore(input);
}

export function classifyFinanceOutputDetailed(input: string): ClassifiedResult<FinanceOutputClassification> {
  return classifyFinanceOutputDetailedCore(input);
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
  if (!looksLikeFinanceContentCore(joined)) {
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
  result.compliance.matchedRules = Array.from(
    new Set([
      ...inputDecision.matchedRules.map((rule) => `input:${rule}`),
      ...outputDecision.matchedRules.map((rule) => `output:${rule}`),
    ]),
  );
  result.compliance.confidence = classifyConfidence({
    inputClassification: inputDecision.classification,
    outputClassification: outputDecision.classification,
    reasons: result.compliance.reasons,
  });
  result.compliance.classifierVersion = FINANCE_CLASSIFIER_VERSION;
  return result;
}

export function resolveHeuristicFinanceComplianceEnvelope(input: {
  snapshot?: FinanceComplianceSnapshot | null;
  appName: string;
  channel: FinanceComplianceChannel;
  title?: string | null;
  prompt?: string | null;
  answer: string;
  usedCapabilities?: string[];
  usedModel?: string | null;
  oemPolicy?: FinanceOemCompliancePolicy | null;
}): ResolveFinanceComplianceResult | null {
  if (hasExplicitFinanceComplianceSnapshot(input.snapshot)) {
    return null;
  }
  return buildHeuristicFinanceComplianceEnvelope({
    appName: input.appName,
    channel: input.channel,
    title: input.title,
    prompt: input.prompt,
    answer: input.answer,
    usedCapabilities: input.usedCapabilities,
    usedModel: input.usedModel,
    oemPolicy: input.oemPolicy,
  });
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
  const heuristic = resolveHeuristicFinanceComplianceEnvelope(input);
  return resolveEffectiveFinanceComplianceSnapshot({
    snapshot: input.snapshot,
    heuristic,
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
  const heuristic = resolveHeuristicFinanceComplianceEnvelope(input);
  return resolveEffectiveFinanceDisclaimer({
    snapshot: input.snapshot,
    heuristic,
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
