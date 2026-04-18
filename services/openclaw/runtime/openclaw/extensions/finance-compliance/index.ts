import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";

import { createAuditRecorder } from "./src/audit-recorder.js";
import { createComplianceTransformer } from "./src/compliance-transformer.js";
import { createInputClassifier } from "./src/input-classifier.js";
import { createOutputClassifier } from "./src/output-classifier.js";
import { createPolicyRegistry } from "./src/policy-registry.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- hook payloads vary by event type
type GenericHookHandler = (event: any, ctx: any) => any;

function summarizeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "unknown error";
}

function wrapHookFailOpen(
  api: OpenClawPluginApi,
  hookName: string,
  handler: GenericHookHandler,
): GenericHookHandler {
  return async (event, ctx) => {
    try {
      return await handler(event, ctx);
    } catch (error) {
      api.logger.warn?.(`[finance-compliance] ${hookName} failed; fail-open: ${summarizeError(error)}`);
      return undefined;
    }
  };
}

function extractTextFromUnknown(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => extractTextFromUnknown(item)).filter(Boolean).join("\n");
  }
  if (!value || typeof value !== "object") {
    return "";
  }
  const source = value as Record<string, unknown>;
  return [
    extractTextFromUnknown(source.content),
    extractTextFromUnknown(source.body),
    extractTextFromUnknown(source.bodyForAgent),
    extractTextFromUnknown(source.text),
    extractTextFromUnknown(source.prompt),
  ]
    .filter(Boolean)
    .join("\n");
}

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

    api.on(
      "message_received",
      wrapHookFailOpen(api, "message_received", async (event) => {
        const text = extractTextFromUnknown(event);
        if (!inputClassifier.looksLikeFinance(text)) {
          return;
        }
        const inputClassification = inputClassifier.classify(text);
        auditRecorder.record("message_received", {
          inputClassification,
          preview: text.slice(0, 180),
        });
      }),
    );

    api.on(
      "before_prompt_build",
      wrapHookFailOpen(api, "before_prompt_build", async (event) => {
        const text = extractTextFromUnknown(event);
        const inputClassification = inputClassifier.classify(text);
        const promptGuard = complianceTransformer.buildPromptGuard(inputClassification);
        if (!promptGuard) {
          return;
        }
        auditRecorder.record("before_prompt_build", {
          inputClassification,
        });
        return {
          prependSystemContext: promptGuard,
        };
      }),
    );

    api.on(
      "llm_output",
      wrapHookFailOpen(api, "llm_output", async (event) => {
        const text = extractTextFromUnknown(event);
        const outputClassification = outputClassifier.classify(text);
        if (!outputClassification) {
          return;
        }
        auditRecorder.record("llm_output", {
          outputClassification,
          preview: text.slice(0, 180),
        });
      }),
    );

    api.on(
      "agent_end",
      wrapHookFailOpen(api, "agent_end", async (event) => {
        auditRecorder.record("agent_end", {
          status: typeof event?.status === "string" ? event.status : "unknown",
        });
      }),
    );
  },
};

export default financeCompliancePlugin;
