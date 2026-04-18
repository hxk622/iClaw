import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";

import type { FinanceCompliancePolicyRegistry } from "./policy-registry.js";

export interface FinanceInputClassifier {
  readonly kind: "input-classifier";
}

export function createInputClassifier(
  _api: OpenClawPluginApi,
  _registry: FinanceCompliancePolicyRegistry,
): FinanceInputClassifier {
  return {
    kind: "input-classifier",
  };
}
