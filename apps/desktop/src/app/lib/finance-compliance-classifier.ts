import type {
  FinanceComplianceConfidence,
  FinanceComplianceDecisionSource,
  FinanceInputClassification,
  FinanceOutputClassification,
} from './finance-compliance';

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

export const FINANCE_CLASSIFIER_VERSION = 'finance_v2';

export type ClassifiedResult<T> = {
  classification: T | null;
  reasons: string[];
  matchedRules: string[];
  confidence: FinanceComplianceConfidence;
  decisionSource: FinanceComplianceDecisionSource;
  classifierVersion: string;
};

function containsKeyword(text: string, keywords: string[]): boolean {
  const normalized = text.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

export function looksLikeFinanceContent(input: string): boolean {
  return containsKeyword(input, FINANCE_KEYWORDS);
}

export function classifyFinanceInputDetailed(input: string): ClassifiedResult<FinanceInputClassification> {
  const reasons: string[] = [];
  const matchedRules: string[] = [];
  if (!looksLikeFinanceContent(input)) {
    return {
      classification: null,
      reasons,
      matchedRules,
      confidence: 'low',
      decisionSource: 'heuristic_fallback',
      classifierVersion: FINANCE_CLASSIFIER_VERSION,
    };
  }
  reasons.push('finance_keyword_hit');
  if (containsKeyword(input, EXECUTION_HINTS)) {
    reasons.push('execution_hint');
    matchedRules.push('execution_hint');
    return {
      classification: 'execution_request',
      reasons,
      matchedRules,
      confidence: 'high',
      decisionSource: 'heuristic_fallback',
      classifierVersion: FINANCE_CLASSIFIER_VERSION,
    };
  }
  if (containsKeyword(input, PERSONALIZED_HINTS)) {
    reasons.push('personalized_hint');
    matchedRules.push('personalized_hint');
    return {
      classification: 'personalized_request',
      reasons,
      matchedRules,
      confidence: 'medium',
      decisionSource: 'heuristic_fallback',
      classifierVersion: FINANCE_CLASSIFIER_VERSION,
    };
  }
  if (containsKeyword(input, ACTIONABLE_HINTS) || containsKeyword(input, ['能买吗', '该买', '该卖', '怎么配仓'])) {
    reasons.push('advice_request_hint');
    matchedRules.push('advice_request_hint');
    return {
      classification: 'advice_request',
      reasons,
      matchedRules,
      confidence: 'medium',
      decisionSource: 'heuristic_fallback',
      classifierVersion: FINANCE_CLASSIFIER_VERSION,
    };
  }
  if (containsKeyword(input, ['分析', '估值', '怎么看', '复盘', '研究', '拆解'])) {
    reasons.push('research_request_hint');
    matchedRules.push('research_request_hint');
    return {
      classification: 'research_request',
      reasons,
      matchedRules,
      confidence: 'medium',
      decisionSource: 'heuristic_fallback',
      classifierVersion: FINANCE_CLASSIFIER_VERSION,
    };
  }
  reasons.push('market_info_fallback');
  return {
    classification: 'market_info',
    reasons,
    matchedRules: ['market_info_fallback'],
    confidence: 'low',
    decisionSource: 'heuristic_fallback',
    classifierVersion: FINANCE_CLASSIFIER_VERSION,
  };
}

export function classifyFinanceOutputDetailed(input: string): ClassifiedResult<FinanceOutputClassification> {
  const reasons: string[] = [];
  const matchedRules: string[] = [];
  if (!looksLikeFinanceContent(input)) {
    return {
      classification: null,
      reasons,
      matchedRules,
      confidence: 'low',
      decisionSource: 'heuristic_fallback',
      classifierVersion: FINANCE_CLASSIFIER_VERSION,
    };
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
    matchedRules.push('strong_actionable_phrase');
    return {
      classification: 'actionable_advice',
      reasons,
      matchedRules,
      confidence: 'high',
      decisionSource: 'heuristic_fallback',
      classifierVersion: FINANCE_CLASSIFIER_VERSION,
    };
  }
  if (hasActionVerb && hasActionStructure) {
    reasons.push('action_verb');
    reasons.push('action_structure');
    matchedRules.push('action_verb', 'action_structure');
    return {
      classification: 'actionable_advice',
      reasons,
      matchedRules,
      confidence: 'medium',
      decisionSource: 'heuristic_fallback',
      classifierVersion: FINANCE_CLASSIFIER_VERSION,
    };
  }
  if (hasActionVerb) {
    reasons.push('action_verb_without_directive');
    matchedRules.push('action_verb_without_directive');
    return {
      classification: 'investment_view',
      reasons,
      matchedRules,
      confidence: 'medium',
      decisionSource: 'heuristic_fallback',
      classifierVersion: FINANCE_CLASSIFIER_VERSION,
    };
  }
  if (hasPortfolioViewHint) {
    reasons.push('portfolio_view_hint');
    matchedRules.push('portfolio_view_hint');
    return {
      classification: 'investment_view',
      reasons,
      matchedRules,
      confidence: 'medium',
      decisionSource: 'heuristic_fallback',
      classifierVersion: FINANCE_CLASSIFIER_VERSION,
    };
  }
  if (hasViewHints) {
    reasons.push('investment_view_hint');
    matchedRules.push('investment_view_hint');
    return {
      classification: 'investment_view',
      reasons,
      matchedRules,
      confidence: 'medium',
      decisionSource: 'heuristic_fallback',
      classifierVersion: FINANCE_CLASSIFIER_VERSION,
    };
  }
  if (hasSummaryHints) {
    reasons.push('research_summary_hint');
    matchedRules.push('research_summary_hint');
    return {
      classification: 'research_summary',
      reasons,
      matchedRules,
      confidence: 'medium',
      decisionSource: 'heuristic_fallback',
      classifierVersion: FINANCE_CLASSIFIER_VERSION,
    };
  }
  reasons.push('market_data_fallback');
  matchedRules.push('market_data_fallback');
  return {
    classification: 'market_data',
    reasons,
    matchedRules,
    confidence: 'low',
    decisionSource: 'heuristic_fallback',
    classifierVersion: FINANCE_CLASSIFIER_VERSION,
  };
}
