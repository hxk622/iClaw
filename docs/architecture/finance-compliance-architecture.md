# 理财客金融合规架构

更新时间：2026-04-18

## 目标

在不修改 OpenClaw kernel 主回复链路的前提下，为 `理财客` 建立一套可扩展、可审计、可渠道复用的金融合规架构，覆盖：

- 能力准入与中心化元数据
- 输入与输出风险分类
- wrapper 层最终裁决
- 定时任务 / 通知 / 导出报告等渠道复用
- 审计与规则回放

本架构文档是对以下文档的实现层补充：

- 产品需求：[finance-compliance-prd.md](/Users/xingkaihan/Documents/Code/iClaw/docs/design/finance-compliance-prd.md)
- 技术设计：[finance-compliance-technical-design.md](/Users/xingkaihan/Documents/Code/iClaw/docs/design/finance-compliance-technical-design.md)
- OEM 原则：[oem-capability-architecture.md](/Users/xingkaihan/Documents/Code/iClaw/docs/architecture/oem-capability-architecture.md)
- OpenClaw wrapper 原则：[openclaw-wrapper-architecture.md](/Users/xingkaihan/Documents/Code/iClaw/docs/architecture/openclaw-wrapper-architecture.md)

## 架构边界

### 明确不做的事

- 不直接修改 `services/openclaw/runtime/openclaw/` 里的主回复链路
- 不把免责声明逻辑散落进单个 skill prompt
- 不让 plugin 单独承担“强拦截”职责
- 不在 wrapper 层复制第二套聊天 kernel 或 cron kernel

### 明确要做的事

- 用平台 catalog + OEM binding 存金融合规元数据
- 用 OpenClaw plugin + hooks 做 before / after 分类和打标
- 用 iClaw wrapper 做最终展示、降级与拦截裁决
- 用统一 envelope 让聊天、定时任务、通知、报告共用同一套合规结果

## 总体架构

```text
Platform Catalog
  ├─ cloud_skill_catalog.metadata_json
  ├─ cloud_mcp_catalog.metadata_json
  └─ oem binding metadata_json
        ↓
Finance Compliance Policy Registry
        ↓
OpenClaw Plugin: finance-compliance
  ├─ message:preprocessed
  ├─ agent:bootstrap
  ├─ tool_result_persist
  └─ message:sent
        ↓
Wrapper Compliance Resolver
  ├─ envelope 生成
  ├─ disclaimer 渲染
  ├─ 输出降级
  ├─ 渠道裁决
  └─ 强拦截
        ↓
Surfaces
  ├─ Chat
  ├─ Cron Result
  ├─ Notification
  ├─ Market / Expert Cards
  └─ HTML Report
        ↓
Audit Store
  └─ finance_compliance_events
```

## 分层职责

## 1. 平台目录层

职责：

- 给 skill / MCP / model 标记金融合规属性
- 作为所有 OEM 的统一能力真值

承载位置：

- `cloud_skill_catalog.metadata_json`
- `cloud_mcp_catalog.metadata_json`
- 必要时 `oem_model_catalog.metadata_json`

不做：

- 直接决定理财客是否显示免责声明
- 直接决定渠道级拦截策略

## 2. OEM 装配层

职责：

- 为 `理财客` 覆盖金融合规策略
- 定义哪些能力可用、默认项、推荐项、排序、展示策略

承载位置：

- `oem_bundled_skills.metadata_json`
- `oem_bundled_mcps.metadata_json`
- `oem_app_model_bindings.metadata_json`

参考现有表：

- [services/control-plane/sql/001_init.sql](/Users/xingkaihan/Documents/Code/iClaw/services/control-plane/sql/001_init.sql)

不做：

- 复制平台能力定义
- 直接读取模型输出并决定最终发送

## 3. OpenClaw Plugin 层

插件建议：`finance-compliance`

职责：

- 输入分类
- 输出分类
- 补充来源 / 时间 / 风险 metadata
- 记录规则命中与审计上下文

可用 hook：

- `message:preprocessed`
- `agent:bootstrap`
- `tool_result_persist`
- `message:sent`

边界：

- 现有 message hooks 为 fire-and-forget
- 不能 short-circuit 主回复路径

因此 plugin 是**分类器和标记者**，不是最终裁决器。

## 4. Wrapper 裁决层

职责：

- 聚合分类结果与 OEM 策略
- 生成 `ComplianceEnvelope`
- 决定：
  - 是否展示
  - 是否挂免责声明
  - 是否降级
  - 是否进入通知 / 定时任务 / 导出报告
  - 是否拦截

承载位置建议：

- `apps/desktop/src/app/lib/`
- `apps/desktop/src/app/components/`
- 如需 control-plane 参与公共渲染策略，可在 portal/public payload 中附带 policy

## 数据模型与 Schema 变更

## 1. 平台 catalog metadata

### `cloud_skill_catalog.metadata_json`

建议统一使用：

```json
{
  "domain": "finance",
  "capability_class": "research_only",
  "compliance_profile": "finance_research_v1",
  "advice_level": "research_only",
  "requires_disclaimer": true,
  "requires_risk_section": true,
  "forbid_personalized_suitability": true,
  "forbid_return_promise": true,
  "allow_notification_summary": false,
  "allow_cron_digest": true,
  "data_delay_policy": "must_disclose_if_delayed"
}
```

SQL 首期不需要新增列，因为 `metadata_json` 已存在。

### `cloud_mcp_catalog.metadata_json`

建议统一使用：

```json
{
  "domain": "finance",
  "data_source_type": "market_data",
  "is_realtime": false,
  "quote_delay_minutes": 15,
  "requires_source_attribution": true,
  "requires_timestamp": true,
  "allowed_output_classes": ["market_data", "research_summary"]
}
```

## 2. OEM binding metadata

绑定层建议统一使用：

```json
{
  "compliance_enabled": true,
  "classification_policy": "finance_v1",
  "disclaimer_policy": "finance_inline_small",
  "disclaimer_text": "本回答由AI生成，仅供参考，请仔细甄别，谨慎投资。",
  "blocking_policy": "research_only",
  "show_for": ["investment_view", "actionable_advice"],
  "hide_for": ["market_data"],
  "block_for": ["execution_request"],
  "degrade_for": ["advice_request", "personalized_request"]
}
```

优先放在：

- `oem_bundled_skills.metadata_json`
- `oem_bundled_mcps.metadata_json`

对于 app 级默认策略，建议在后续增加统一 app policy 存储；Phase 1 可先放在 portal runtime/public config 中以避免 schema 过早膨胀。

## 3. 新增审计表

建议新增：

### `finance_compliance_events`

建议字段：

```text
id
app_name
session_key
conversation_id
channel
source_surface
input_classification
output_classification
risk_level
show_disclaimer
disclaimer_text
degraded
blocked
reasons_json
used_capabilities_json
used_model
created_at
```

说明：

- 这是合规决策事实表，不是完整 transcript
- 保留最小必要信息，避免再次扩大高敏数据面

## 核心接口定义

## 1. Policy Registry

TypeScript 建议：

```ts
export type FinanceCapabilityClass =
  | "data_only"
  | "research_only"
  | "investment_view"
  | "actionable_advice"
  | "execution_linked";

export type FinanceInputClassification =
  | "market_info"
  | "research_request"
  | "advice_request"
  | "personalized_request"
  | "execution_request";

export type FinanceOutputClassification =
  | "market_data"
  | "research_summary"
  | "investment_view"
  | "actionable_advice";

export interface FinanceCapabilityPolicy {
  domain: "finance";
  capabilityClass: FinanceCapabilityClass;
  complianceProfile: string;
  adviceLevel: "research_only" | "investment_view" | "actionable_advice";
  requiresDisclaimer: boolean;
  requiresRiskSection: boolean;
  forbidPersonalizedSuitability: boolean;
  forbidReturnPromise: boolean;
  allowNotificationSummary: boolean;
  allowCronDigest: boolean;
  dataDelayPolicy?: string | null;
}

export interface FinanceOemCompliancePolicy {
  complianceEnabled: boolean;
  classificationPolicy: string;
  disclaimerPolicy: string;
  disclaimerText: string;
  blockingPolicy: string;
  showFor: FinanceOutputClassification[];
  hideFor: FinanceOutputClassification[];
  blockFor: FinanceInputClassification[];
  degradeFor: FinanceInputClassification[];
}
```

## 2. Compliance Envelope

```ts
export interface ComplianceEnvelope {
  answer: string;
  compliance: {
    domain: "finance";
    inputClassification: FinanceInputClassification | null;
    outputClassification: FinanceOutputClassification | null;
    riskLevel: "low" | "medium" | "high";
    showDisclaimer: boolean;
    disclaimerText: string | null;
    requiresRiskSection: boolean;
    blocked: boolean;
    degraded: boolean;
    reasons: string[];
    usedCapabilities: string[];
    usedModel: string | null;
    sourceAttributionRequired: boolean;
    timestampRequired: boolean;
  };
}
```

## 3. Wrapper Resolver

```ts
export interface ResolveFinanceComplianceInput {
  appName: string;
  channel: "chat" | "cron" | "notification" | "report";
  answer: string;
  inputClassification: FinanceInputClassification | null;
  outputClassification: FinanceOutputClassification | null;
  capabilityPolicies: FinanceCapabilityPolicy[];
  oemPolicy: FinanceOemCompliancePolicy | null;
  usedCapabilities: string[];
  usedModel: string | null;
}

export interface ResolveFinanceComplianceResult extends ComplianceEnvelope {
  presentation: {
    mode: "show" | "show_with_disclaimer" | "degrade" | "block";
    replacementText?: string | null;
  };
}
```

## 插件草案

## 插件目录建议

```text
extensions/finance-compliance/
  openclaw.plugin.json
  src/
    index.ts
    policy-registry.ts
    input-classifier.ts
    output-classifier.ts
    compliance-transformer.ts
    audit-recorder.ts
  hooks/
    finance-input-classifier/
      HOOK.md
      handler.ts
    finance-output-audit/
      HOOK.md
      handler.ts
```

## `openclaw.plugin.json` 草案

```json
{
  "id": "finance-compliance",
  "name": "Finance Compliance",
  "description": "Financial compliance classification, envelope metadata, and audit helpers for OEM finance surfaces.",
  "configSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "enabledApps": {
        "type": "array",
        "items": { "type": "string" }
      },
      "defaultDisclaimerText": {
        "type": "string"
      },
      "auditEnabled": {
        "type": "boolean"
      },
      "strictBlocking": {
        "type": "boolean"
      }
    }
  },
  "uiHints": {
    "enabledApps": {
      "label": "Enabled Apps",
      "help": "App names where finance compliance logic should run."
    },
    "defaultDisclaimerText": {
      "label": "Default Disclaimer Text",
      "help": "Fallback disclaimer text when OEM policy does not provide one."
    },
    "auditEnabled": {
      "label": "Audit Enabled"
    },
    "strictBlocking": {
      "label": "Strict Blocking",
      "help": "When enabled, wrapper should prefer block over degrade for severe finance policy violations."
    }
  }
}
```

说明：

- 插件 manifest 只负责 discovery 和 config schema
- 真正 hook 处理逻辑在 runtime 代码和 hooks 目录中

## 事件流细化

### 1. Before

1. `message:preprocessed`
2. 输入分类
3. 若命中高风险金融问题，标记 session context
4. `agent:bootstrap`
5. 条件注入 `FINANCE_DECISION_FRAMEWORK.md`

### 2. During

1. agent 执行
2. 工具结果写入前触发 `tool_result_persist`
3. 为行情和研究工具结果补 metadata

### 3. After

1. wrapper 读取分类结果 + 能力元数据 + OEM policy
2. 生成 `ComplianceEnvelope`
3. 进行渠道裁决
4. `message:sent` 记录最终发送审计

## 风险裁决优先级

建议统一优先级：

1. `block`
2. `degrade`
3. `show_with_disclaimer`
4. `show`

典型触发：

- `execution_request`
  - `block`
- `actionable_advice` + `research_only` policy
  - `degrade`
- `investment_view`
  - `show_with_disclaimer`
- `market_data`
  - `show`

## 与现有代码的映射

### control-plane

- `services/control-plane/sql/001_init.sql`
- `services/control-plane/src/portal-store.ts`
- `services/control-plane/src/pg-store.ts`

### desktop wrapper

- `apps/desktop/src/app/lib/`
- `apps/desktop/src/app/components/`
- `apps/desktop/src/app/lib/oem-runtime.ts`

### OpenClaw plugin / runtime

- `services/openclaw/runtime/openclaw/extensions/`
- `services/openclaw/runtime/openclaw/docs/automation/hooks.md`
- `services/openclaw/runtime/openclaw/docs/tools/plugin.md`

## Phase 1 架构落地范围

首期只做：

- catalog / binding metadata 约定
- plugin 输入分类
- plugin 发送后审计
- wrapper 免责声明渲染
- 初版 envelope

首期不做：

- 强拦截
- 自动改写模型回答
- 大规模历史回填
- 适当性流程接管
