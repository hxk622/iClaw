import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";

export interface FinanceCompliancePolicyRegistry {
  readonly pluginId: "finance-compliance";
}

export function createPolicyRegistry(_api: OpenClawPluginApi): FinanceCompliancePolicyRegistry {
  return {
    pluginId: "finance-compliance",
  };
}
