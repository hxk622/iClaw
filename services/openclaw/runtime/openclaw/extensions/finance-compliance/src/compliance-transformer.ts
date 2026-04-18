import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";

import type { FinanceCompliancePolicyRegistry } from "./policy-registry.js";

export interface FinanceComplianceTransformer {
  readonly kind: "compliance-transformer";
}

export function createComplianceTransformer(
  _api: OpenClawPluginApi,
  _registry: FinanceCompliancePolicyRegistry,
): FinanceComplianceTransformer {
  return {
    kind: "compliance-transformer",
  };
}
