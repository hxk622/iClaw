import type { ResolvedFinanceComplianceConfig } from './oem-runtime.ts';
import {
  resolveDisplayFinanceComplianceSnapshot,
  resolveDisplayFinanceDisclaimer,
  softenFinanceSummaryForChannel,
  toFinanceOemCompliancePolicy,
  type FinanceComplianceChannel,
  type FinanceComplianceSnapshot,
} from './finance-compliance.ts';

export function resolveSurfaceFinanceCompliance(input: {
  snapshot?: FinanceComplianceSnapshot | null;
  appName: string;
  channel: FinanceComplianceChannel;
  title?: string | null;
  prompt?: string | null;
  answer: string;
  usedModel?: string | null;
  financeComplianceConfig?: ResolvedFinanceComplianceConfig | null;
}) {
  const oemPolicy = toFinanceOemCompliancePolicy(input.financeComplianceConfig || null);
  const financeCompliance = resolveDisplayFinanceComplianceSnapshot({
    snapshot: input.snapshot,
    appName: input.appName,
    channel: input.channel,
    title: input.title,
    prompt: input.prompt,
    answer: input.answer,
    usedModel: input.usedModel,
    oemPolicy,
  });
  return {
    financeCompliance,
    disclaimerText: resolveDisplayFinanceDisclaimer({
      snapshot: financeCompliance,
      appName: input.appName,
      channel: input.channel,
      title: input.title,
      prompt: input.prompt,
      answer: input.answer,
      usedModel: input.usedModel,
      oemPolicy,
    }),
  };
}

export function resolveFinanceSummaryPresentation(input: {
  snapshot?: FinanceComplianceSnapshot | null;
  appName: string;
  channel: Extract<FinanceComplianceChannel, 'cron' | 'notification'>;
  title?: string | null;
  prompt?: string | null;
  answer: string;
  usedModel?: string | null;
  financeComplianceConfig?: ResolvedFinanceComplianceConfig | null;
}) {
  const { financeCompliance, disclaimerText } = resolveSurfaceFinanceCompliance(input);
  return {
    financeCompliance,
    disclaimerText,
    displayText: softenFinanceSummaryForChannel({
      text: input.answer,
      channel: input.channel,
      compliance: financeCompliance,
    }),
  };
}
