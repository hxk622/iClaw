import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";

import type { FinanceCompliancePolicyRegistry } from "./policy-registry.js";

export interface FinanceAuditRecorder {
  readonly kind: "audit-recorder";
  record(label: string, payload: Record<string, unknown>): void;
}

export function createAuditRecorder(
  _api: OpenClawPluginApi,
  _registry: FinanceCompliancePolicyRegistry,
): FinanceAuditRecorder {
  return {
    kind: "audit-recorder",
    record(label: string, payload: Record<string, unknown>) {
      _api.logger.info(`[finance-compliance] ${label}: ${JSON.stringify(payload)}`);
    },
  };
}
