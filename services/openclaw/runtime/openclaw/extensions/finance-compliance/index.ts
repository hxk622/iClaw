import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";

import { createAuditRecorder } from "./src/audit-recorder.js";
import { createComplianceTransformer } from "./src/compliance-transformer.js";
import { createInputClassifier } from "./src/input-classifier.js";
import { createOutputClassifier } from "./src/output-classifier.js";
import { createPolicyRegistry } from "./src/policy-registry.js";

const financeCompliancePlugin = {
  id: "finance-compliance",
  name: "Finance Compliance",
  description: "Financial compliance classification, envelope metadata, and audit helpers for OEM finance surfaces.",
  register(api: OpenClawPluginApi) {
    const policyRegistry = createPolicyRegistry(api);
    const inputClassifier = createInputClassifier(api, policyRegistry);
    const outputClassifier = createOutputClassifier(api, policyRegistry);
    const complianceTransformer = createComplianceTransformer(api, policyRegistry);
    const auditRecorder = createAuditRecorder(api, policyRegistry);

    api.logger.info("[finance-compliance] plugin skeleton loaded");

    void inputClassifier;
    void outputClassifier;
    void complianceTransformer;
    void auditRecorder;
  },
};

export default financeCompliancePlugin;
