import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";

import type { FinanceCompliancePolicyRegistry } from "./policy-registry.js";

export interface FinanceInputClassifier {
  readonly kind: "input-classifier";
  classify(text: string): string | null;
  looksLikeFinance(text: string): boolean;
}

const FINANCE_KEYWORDS = [
  "投资",
  "理财",
  "基金",
  "股票",
  "etf",
  "a股",
  "港股",
  "美股",
  "债券",
  "估值",
  "仓位",
  "收益",
  "回撤",
  "分红",
  "晨报",
  "市场",
  "指数",
  "买入",
  "卖出",
  "加仓",
  "减仓",
  "配置",
];

const ACTIONABLE_HINTS = ["买入", "卖出", "加仓", "减仓", "建仓", "清仓", "止盈", "止损", "仓位"];
const PERSONALIZED_HINTS = ["我有", "我想投", "我该怎么配", "适合我", "我的持仓", "我的风险偏好"];
const EXECUTION_HINTS = ["帮我卖", "帮我买", "替我买", "替我卖", "直接下单", "执行交易"];

function containsKeyword(text: string, keywords: string[]): boolean {
  const normalized = text.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

export function createInputClassifier(
  _api: OpenClawPluginApi,
  _registry: FinanceCompliancePolicyRegistry,
): FinanceInputClassifier {
  return {
    kind: "input-classifier",
    classify(text: string): string | null {
      if (!containsKeyword(text, FINANCE_KEYWORDS)) {
        return null;
      }
      if (containsKeyword(text, EXECUTION_HINTS)) {
        return "execution_request";
      }
      if (containsKeyword(text, PERSONALIZED_HINTS)) {
        return "personalized_request";
      }
      if (containsKeyword(text, ACTIONABLE_HINTS)) {
        return "advice_request";
      }
      if (containsKeyword(text, ["分析", "估值", "怎么看", "复盘", "研究"])) {
        return "research_request";
      }
      return "market_info";
    },
    looksLikeFinance(text: string): boolean {
      return containsKeyword(text, FINANCE_KEYWORDS);
    },
  };
}
