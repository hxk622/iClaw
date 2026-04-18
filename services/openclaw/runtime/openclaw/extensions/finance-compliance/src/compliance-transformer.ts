import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";

import type { FinanceCompliancePolicyRegistry } from "./policy-registry.js";

export interface FinanceComplianceTransformer {
  readonly kind: "compliance-transformer";
  buildPromptGuard(inputClassification: string | null): string | null;
  buildMessageMetadata(input: {
    inputClassification?: string | null;
    outputClassification?: string | null;
    usedModel?: string | null;
  }): Record<string, unknown> | null;
}

export function createComplianceTransformer(
  _api: OpenClawPluginApi,
  _registry: FinanceCompliancePolicyRegistry,
): FinanceComplianceTransformer {
  return {
    kind: "compliance-transformer",
    buildPromptGuard(inputClassification: string | null): string | null {
      if (!inputClassification) {
        return null;
      }
      return [
        "当前问题属于金融场景。",
        "请坚持研究参考口径：先事实，后判断，先风险，后收益。",
        "不要伪装成确定性投资建议，不要输出收益承诺，不要替代适当性判断。",
      ].join("\n");
    },
    buildMessageMetadata(input: {
      inputClassification?: string | null;
      outputClassification?: string | null;
      usedModel?: string | null;
    }): Record<string, unknown> | null {
      if (!input.inputClassification && !input.outputClassification) {
        return null;
      }
      const outputClassification = input.outputClassification ?? null;
      const riskLevel =
        outputClassification === "actionable_advice"
          ? "high"
          : outputClassification === "investment_view"
            ? "medium"
            : "low";
      const showDisclaimer = outputClassification === "investment_view" || outputClassification === "actionable_advice";
      const reasons = ["finance_domain"];
      if (showDisclaimer) {
        reasons.push("show_disclaimer");
      }
      return {
        financeCompliance: {
          domain: "finance",
          inputClassification: input.inputClassification ?? null,
          outputClassification,
          riskLevel,
          showDisclaimer,
          disclaimerText: showDisclaimer ? "本回答由AI生成，仅供参考，请仔细甄别，谨慎投资。" : null,
          requiresRiskSection: outputClassification === "investment_view" || outputClassification === "actionable_advice",
          blocked: false,
          degraded: false,
          reasons,
          usedCapabilities: [],
          usedModel: input.usedModel ?? null,
          sourceAttributionRequired: outputClassification === "market_data",
          timestampRequired: outputClassification === "market_data",
        },
      };
    },
  };
}
