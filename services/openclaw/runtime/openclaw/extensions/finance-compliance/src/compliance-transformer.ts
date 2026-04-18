import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";

import type { FinanceCompliancePolicyRegistry } from "./policy-registry.js";

export interface FinanceComplianceTransformer {
  readonly kind: "compliance-transformer";
  buildPromptGuard(inputClassification: string | null): string | null;
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
  };
}
