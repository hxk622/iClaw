import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildHeuristicFinanceComplianceEnvelope,
  resolveFinanceComplianceEnvelope,
  shouldShowFinanceDisclaimer,
  type FinanceCapabilityPolicy,
  type FinanceOemCompliancePolicy,
} from './finance-compliance.ts';

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
