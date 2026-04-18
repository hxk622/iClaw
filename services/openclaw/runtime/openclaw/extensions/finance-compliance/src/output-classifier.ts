import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";

import type { FinanceCompliancePolicyRegistry } from "./policy-registry.js";

export interface FinanceOutputClassifier {
  readonly kind: "output-classifier";
  classify(text: string): string | null;
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

function containsKeyword(text: string, keywords: string[]): boolean {
  const normalized = text.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

export function createOutputClassifier(
  _api: OpenClawPluginApi,
  _registry: FinanceCompliancePolicyRegistry,
): FinanceOutputClassifier {
  return {
    kind: "output-classifier",
    classify(text: string): string | null {
      if (!containsKeyword(text, FINANCE_KEYWORDS)) {
        return null;
      }
      if (containsKeyword(text, ACTIONABLE_HINTS)) {
        return "actionable_advice";
      }
      if (containsKeyword(text, ["建议", "关注", "估值", "配置", "判断", "风险"])) {
        return "investment_view";
      }
      if (containsKeyword(text, ["总结", "摘要", "晨报", "复盘", "公告", "财报"])) {
        return "research_summary";
      }
      return "market_data";
    },
  };
}
