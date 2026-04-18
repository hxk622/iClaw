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
