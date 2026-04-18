import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";

import type { FinanceCompliancePolicyRegistry } from "./policy-registry.js";

export interface FinanceAuditRecorder {
  readonly kind: "audit-recorder";
}

export function createAuditRecorder(
  _api: OpenClawPluginApi,
  _registry: FinanceCompliancePolicyRegistry,
): FinanceAuditRecorder {
  return {
    kind: "audit-recorder",
  };
}
