import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildHeuristicFinanceComplianceEnvelope,
  hasExplicitFinanceComplianceSnapshot,
  resolveDisplayFinanceComplianceSnapshot,
  resolveDisplayFinanceDisclaimer,
  resolveEffectiveFinanceComplianceSnapshot,
  resolveEffectiveFinanceDisclaimer,
  resolveFinanceDisclaimerFromSnapshot,
  resolveFinanceComplianceEnvelope,
  softenFinanceSummaryForChannel,
  shouldShowFinanceDisclaimer,
  type FinanceCapabilityPolicy,
  type FinanceOemCompliancePolicy,
} from './finance-compliance.ts';
import { resolveFinanceSummaryPresentation, resolveSurfaceFinanceCompliance } from './finance-compliance-surface.ts';

const baseCapabilityPolicy: FinanceCapabilityPolicy = {
  domain: 'finance',
  capabilityClass: 'research_only',
  complianceProfile: 'finance_research_v1',
  adviceLevel: 'research_only',
  requiresDisclaimer: true,
  requiresRiskSection: true,
  forbidPersonalizedSuitability: true,
  forbidReturnPromise: true,
  allowNotificationSummary: false,
  allowCronDigest: true,
  dataDelayPolicy: null,
};

const baseOemPolicy: FinanceOemCompliancePolicy = {
  complianceEnabled: true,
  classificationPolicy: 'finance_v1',
  disclaimerPolicy: 'finance_inline_small',
  disclaimerText: '本回答由AI生成，仅供参考，请仔细甄别，谨慎投资。',
  blockingPolicy: 'research_only',
  showFor: ['investment_view', 'actionable_advice'],
  hideFor: ['market_data'],
  blockFor: ['execution_request'],
  degradeFor: ['advice_request', 'personalized_request'],
};

test('shouldShowFinanceDisclaimer hides market data when OEM policy hides it', () => {
  const result = shouldShowFinanceDisclaimer({
    outputClassification: 'market_data',
    capabilityPolicies: [baseCapabilityPolicy],
    oemPolicy: baseOemPolicy,
  });

  assert.equal(result, false);
});

test('resolveFinanceComplianceEnvelope degrades advice requests into disclaimer flow', () => {
  const result = resolveFinanceComplianceEnvelope({
    appName: 'licaiclaw',
    channel: 'chat',
    answer: '当前估值偏低，可以考虑关注。',
    inputClassification: 'advice_request',
    outputClassification: 'investment_view',
    capabilityPolicies: [baseCapabilityPolicy],
    oemPolicy: baseOemPolicy,
    usedCapabilities: ['a-share-factor-screener'],
    usedModel: 'bailian/qwen3.5-plus',
  });

  assert.equal(result.compliance.degraded, true);
  assert.equal(result.compliance.showDisclaimer, true);
  assert.equal(result.presentation.mode, 'degrade');
  assert.match(result.presentation.replacementText || '', /研究参考/);
});

test('resolveFinanceComplianceEnvelope blocks execution requests', () => {
  const result = resolveFinanceComplianceEnvelope({
    appName: 'licaiclaw',
    channel: 'chat',
    answer: '已为你卖出基金。',
    inputClassification: 'execution_request',
    outputClassification: 'actionable_advice',
    capabilityPolicies: [baseCapabilityPolicy],
    oemPolicy: baseOemPolicy,
  });

  assert.equal(result.compliance.blocked, true);
  assert.equal(result.presentation.mode, 'block');
  assert.match(result.presentation.replacementText || '', /高风险金融执行/);
});

test('buildHeuristicFinanceComplianceEnvelope detects finance advice text', () => {
  const result = buildHeuristicFinanceComplianceEnvelope({
    appName: 'licaiclaw',
    channel: 'cron',
    title: '开盘前晨报 · A股 / 美股',
    prompt: '请生成一份开盘前晨报，分析今天市场和仓位配置。',
    answer: '当前A股估值分化较大，建议关注高股息方向，控制仓位。',
  });

  assert.ok(result);
  assert.equal(result?.compliance.domain, 'finance');
  assert.equal(result?.compliance.showDisclaimer, true);
  assert.equal(result?.compliance.outputClassification, 'actionable_advice');
});

test('softenFinanceSummaryForChannel degrades actionable cron summary', () => {
  const result = softenFinanceSummaryForChannel({
    text: '建议关注高股息方向，控制仓位，必要时止盈。',
    channel: 'cron',
    compliance: {
      domain: 'finance',
      inputClassification: 'advice_request',
      outputClassification: 'actionable_advice',
      riskLevel: 'high',
      showDisclaimer: true,
      disclaimerText: '本回答由AI生成，仅供参考，请仔细甄别，谨慎投资。',
      requiresRiskSection: true,
      blocked: false,
      degraded: true,
      reasons: ['finance_domain'],
      usedCapabilities: [],
      usedModel: null,
      sourceAttributionRequired: false,
      timestampRequired: false,
    },
  });

  assert.match(result, /可关注|风险暴露|关注/);
  assert.doesNotMatch(result, /止盈/);
});

test('softenFinanceSummaryForChannel replaces notification summary for actionable advice', () => {
  const result = softenFinanceSummaryForChannel({
    text: '建议买入并加仓。',
    channel: 'notification',
    compliance: {
      domain: 'finance',
      inputClassification: 'advice_request',
      outputClassification: 'actionable_advice',
      riskLevel: 'high',
      showDisclaimer: true,
      disclaimerText: '本回答由AI生成，仅供参考，请仔细甄别，谨慎投资。',
      requiresRiskSection: true,
      blocked: false,
      degraded: true,
      reasons: ['finance_domain'],
      usedCapabilities: [],
      usedModel: null,
      sourceAttributionRequired: false,
      timestampRequired: false,
    },
  });

  assert.equal(result, '已生成金融研究结果，请打开查看详情。');
});

test('explicit finance compliance snapshot suppresses heuristic fallback when disclaimer is false', () => {
  const snapshot = {
    domain: 'finance' as const,
    inputClassification: 'market_info' as const,
    outputClassification: 'market_data' as const,
    riskLevel: 'low' as const,
    showDisclaimer: false,
    disclaimerText: null,
    requiresRiskSection: false,
    blocked: false,
    degraded: false,
    reasons: ['finance_domain'],
    usedCapabilities: [],
    usedModel: null,
    sourceAttributionRequired: true,
    timestampRequired: true,
  };

  assert.equal(hasExplicitFinanceComplianceSnapshot(snapshot), true);
  assert.equal(resolveFinanceDisclaimerFromSnapshot(snapshot), null);
});

test('resolveEffectiveFinanceComplianceSnapshot prefers explicit snapshot over heuristic', () => {
  const snapshot = {
    domain: 'finance' as const,
    inputClassification: 'market_info' as const,
    outputClassification: 'market_data' as const,
    riskLevel: 'low' as const,
    showDisclaimer: false,
    disclaimerText: null,
    requiresRiskSection: false,
    blocked: false,
    degraded: false,
    reasons: ['explicit'],
    usedCapabilities: [],
    usedModel: null,
    sourceAttributionRequired: false,
    timestampRequired: false,
  };
  const heuristic = buildHeuristicFinanceComplianceEnvelope({
    appName: 'licaiclaw',
    channel: 'chat',
    prompt: '帮我看看股票能买吗',
    answer: '建议买入并控制仓位。',
  });

  const effective = resolveEffectiveFinanceComplianceSnapshot({ snapshot, heuristic });
  assert.deepEqual(effective, snapshot);
  assert.equal(resolveEffectiveFinanceDisclaimer({ snapshot, heuristic }), null);
});

test('resolveDisplayFinanceDisclaimer uses explicit snapshot before heuristic', () => {
  const snapshot = {
    domain: 'finance' as const,
    inputClassification: 'research_request' as const,
    outputClassification: 'research_summary' as const,
    riskLevel: 'medium' as const,
    showDisclaimer: true,
    disclaimerText: '显式 disclaimer',
    requiresRiskSection: false,
    blocked: false,
    degraded: false,
    reasons: ['explicit'],
    usedCapabilities: [],
    usedModel: null,
    sourceAttributionRequired: false,
    timestampRequired: false,
  };

  const result = resolveDisplayFinanceDisclaimer({
    snapshot,
    appName: 'licaiclaw',
    channel: 'notification',
    title: '晨报',
    prompt: null,
    answer: '建议买入并加仓。',
    usedModel: null,
  });

  assert.equal(result, '显式 disclaimer');
});

test('resolveDisplayFinanceComplianceSnapshot falls back to heuristic when no snapshot exists', () => {
  const result = resolveDisplayFinanceComplianceSnapshot({
    snapshot: null,
    appName: 'licaiclaw',
    channel: 'cron',
    title: '晨报',
    prompt: '请生成一份晨报',
    answer: '建议关注高股息方向并控制仓位。',
    usedModel: null,
  });

  assert.equal(result?.domain, 'finance');
  assert.equal(result?.outputClassification, 'actionable_advice');
});

test('resolveSurfaceFinanceCompliance returns explicit disclaimer when snapshot exists', () => {
  const result = resolveSurfaceFinanceCompliance({
    snapshot: {
      domain: 'finance',
      inputClassification: 'research_request',
      outputClassification: 'investment_view',
      riskLevel: 'medium',
      showDisclaimer: true,
      disclaimerText: '显式 disclaimer',
      requiresRiskSection: false,
      blocked: false,
      degraded: false,
      reasons: ['explicit'],
      usedCapabilities: [],
      usedModel: null,
      sourceAttributionRequired: false,
      timestampRequired: false,
    },
    appName: 'licaiclaw',
    channel: 'chat',
    title: '标题',
    prompt: '提示',
    answer: '建议关注高股息方向',
    usedModel: null,
  });

  assert.equal(result.disclaimerText, '显式 disclaimer');
  assert.equal(result.financeCompliance?.outputClassification, 'investment_view');
});

test('resolveFinanceSummaryPresentation softens actionable cron summaries', () => {
  const result = resolveFinanceSummaryPresentation({
    snapshot: null,
    appName: 'licaiclaw',
    channel: 'cron',
    title: '晨报',
    prompt: '请生成晨报',
    answer: '建议买入并控制仓位。',
    usedModel: null,
  });

  assert.ok(result.financeCompliance);
  assert.equal(result.financeCompliance?.outputClassification, 'actionable_advice');
  assert.match(result.displayText, /关注|风险暴露|可进一步研究/);
});
