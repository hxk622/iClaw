import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";

import type { FinanceCompliancePolicyRegistry } from "./policy-registry.js";

export interface FinanceOutputClassifier {
  readonly kind: "output-classifier";
}

export function createOutputClassifier(
  _api: OpenClawPluginApi,
  _registry: FinanceCompliancePolicyRegistry,
): FinanceOutputClassifier {
  return {
    kind: "output-classifier",
  };
}
