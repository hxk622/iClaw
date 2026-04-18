# 理财客金融合规 Phase 1 实施计划

更新时间：2026-04-18

## 目标

将理财客金融合规从设计推进到首期可运行版本，完成：

1. 能力目录与 OEM 绑定的金融合规 metadata
2. 输入分类与输出审计
3. wrapper 层免责声明统一渲染
4. 初版合规 envelope
5. 审计落库

Phase 1 不做强拦截与自动降级，只做“看得见、查得到”。

## 成功标准

- 至少一类金融 skill 和一类金融 MCP 能带上合规元数据
- 理财客聊天高风险输出可统一显示免责声明
- 至少一个金融定时任务结果页沿用同一 disclaimer 逻辑
- 每次高风险金融回答都能写入合规审计记录
- 可以排查“为什么这次显示/没显示小字”

## 与现有代码映射

### control-plane

- `services/control-plane/sql/001_init.sql`
- `services/control-plane/src/portal-store.ts`
- `services/control-plane/src/pg-store.ts`

### desktop wrapper

- `apps/desktop/src/app/lib/`
- `apps/desktop/src/app/components/`
- `apps/desktop/src/app/lib/oem-runtime.ts`

### OpenClaw runtime / plugin

- `services/openclaw/runtime/openclaw/extensions/`
- `services/openclaw/runtime/openclaw/docs/automation/hooks.md`

## Phase 1 范围

### 纳入

- `cloud_skill_catalog.metadata_json`
- `cloud_mcp_catalog.metadata_json`
- OEM binding metadata 约定
- `message:preprocessed` 输入分类
- `message:sent` 输出审计
- wrapper disclaimer 渲染
- `ComplianceEnvelope` v1
- 审计表 `finance_compliance_events`

### 不纳入

- `actionable_advice` 自动改写
- 强拦截
- `tool_result_persist` 深度改写
- 通知摘要单独降噪
- 适当性流程接入

## 工作分解

## A. control-plane

### A1. metadata 协议落地

任务：

- 约定并文档化 `cloud_skill_catalog.metadata_json` 的金融字段
- 约定并文档化 `cloud_mcp_catalog.metadata_json` 的金融字段
- 约定 OEM binding metadata 的金融字段

建议位置：

- `services/control-plane/src/portal-store.ts`
- `packages/sdk/src/index.ts`

产出：

- 读写路径支持这些 metadata 字段透传
- portal/public payload 能取到这些字段

### A2. 审计表

任务：

- 新增 `finance_compliance_events`

建议位置：

- SQL migration: `services/control-plane/sql/`
- store interface: `services/control-plane/src/store.ts`
- pg store: `services/control-plane/src/pg-store.ts`

建议接口：

- `insertFinanceComplianceEvent()`
- `listFinanceComplianceEvents()`

## B. skill / MCP seed 与 OEM 绑定

### B1. 选首批样本能力

建议至少选择：

- 1 个金融 skill
- 1 个金融 MCP
- 1 个理财客 OEM 绑定

任务：

- 给样本 skill 补金融 metadata
- 给样本 MCP 补金融 metadata
- 给理财客 binding 补 disclaimer policy

建议位置：

- `services/control-plane/src/catalog-defaults.ts`
- OEM 绑定相关 SQL / store 逻辑

## C. OpenClaw plugin / hook

### C1. 插件骨架

任务：

- 新建 `finance-compliance` plugin 文档和目录骨架
- 预留 config schema

建议位置：

- `services/openclaw/runtime/openclaw/extensions/finance-compliance/`

### C2. 输入分类

任务：

- 基于 `message:preprocessed` 做输入分类

首期分类最小集：

- `market_info`
- `research_request`
- `advice_request`
- `personalized_request`
- `execution_request`

产出：

- 将分类结果挂到可被 wrapper 读取的 metadata 或 side-channel 状态里

### C3. 发送后审计

任务：

- 基于 `message:sent` 写审计事件

至少记录：

- app
- channel
- input classification
- output classification
- show disclaimer
- degraded
- blocked
- used model

## D. desktop wrapper

### D1. Compliance Envelope v1

任务：

- 定义 `ComplianceEnvelope` TS 类型
- 定义 wrapper resolver 输入输出

建议位置：

- `apps/desktop/src/app/lib/finance-compliance.ts`

建议暴露：

- `resolveFinanceComplianceEnvelope()`
- `shouldShowFinanceDisclaimer()`
- `resolveFinanceDisclaimerText()`

### D2. 聊天页 disclaimer 渲染

任务：

- 在聊天页根据 envelope 渲染标准小字

首期要求：

- 先只覆盖理财客金融回答
- 不改变非金融回答

### D3. 定时任务结果页复用

任务：

- 在定时任务结果页读取同一 disclaimer policy
- 确保与聊天页一致

## E. 验证

### E1. 用例验证

至少验证 5 类问题：

- “今天市场怎么样”
- “分析一下宁德时代估值”
- “现在能买吗”
- “我 50 万怎么配”
- “帮我卖掉基金”

验证项：

- 输入分类是否正确
- disclaimer 是否符合预期
- 审计是否入库
- 定时任务结果页是否一致

### E2. 回归验证

确认：

- 非金融回答不受影响
- 普通聊天流程不受影响
- OpenClaw kernel 无需修改

## 分阶段顺序

### Step 1

- metadata 协议
- 样本能力打标

### Step 2

- 审计表与 store

### Step 3

- plugin 输入分类
- plugin 发送后审计

### Step 4

- wrapper envelope
- 聊天页 disclaimer

### Step 5

- 定时任务结果页 disclaimer
- 用例验证

## 风险

- 若 metadata 约定不稳定，后续策略会反复返工
- 若输入分类结果无法稳定透传给 wrapper，UI 层会退化成重新猜测
- 若审计字段设计过大，容易把高敏金融数据误写入审计表
- 若 Phase 1 直接尝试做拦截，会显著增加实现复杂度和误伤概率

## Phase 1 交付物

- `finance-compliance` plugin 骨架
- metadata 字段约定落地
- `finance_compliance_events` 表
- wrapper `ComplianceEnvelope` v1
- 聊天页与定时任务结果页统一 disclaimer
- 测试清单与样例问题集
