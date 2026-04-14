# Hermes 自进化架构

更新时间：2026-04-15

## 1. 目标

`Hermes` 的定位不是另一个聊天内核，也不是对 `OpenClaw` kernel 的分叉改造，而是一层独立的“自进化控制层”。

它负责：

- 观察运行日志、memory、工具调用、用户补救行为
- 抽取高价值问题与高复用机会
- 生成候选的能力演化方案
- 通过自动验证后发布到平台能力中心

它不负责：

- 重写 `OpenClaw` 的对话内核
- 直接修改 `services/openclaw/runtime/openclaw/`
- 在主请求链路里直接替换 runtime 决策
- 把未经验证的 prompt / skill / workflow 直接推给生产用户

一句话总结：

- `OpenClaw` 负责运行
- `Hermes` 负责进化
- 平台 catalog 负责沉淀
- OEM binding 负责装配

## 2. 为什么需要独立的自进化层

当前系统已经有三层明确分工：

- `OpenClaw runtime`：执行层
- `control-plane`：产品与平台层
- `OEM app`：装配与展示层

自进化能力如果直接写进 `OpenClaw` kernel，会带来几个问题：

1. 运行时和平台治理耦合。
2. 升级 `OpenClaw` 时迁移成本高。
3. 审计、灰度、回滚困难。
4. 很容易把“经验记忆”误当成“可发布资产”。

因此更合理的做法是：

- 保持 `OpenClaw` 为稳定执行内核
- 将自进化设计为 wrapper / sidecar / platform service
- 所有演化结果都先进入平台 catalog，再由 OEM 或 runtime 绑定消费

这也符合现有 OEM 能力中心原则：

- 能力主数据中心化
- OEM 只维护绑定关系
- 不为每个 OEM 复制一套能力定义

参考：

- [oem-capability-architecture.md](/Users/xingkaihan/Documents/Code/iClaw/docs/architecture/oem-capability-architecture.md)
- [openclaw-wrapper-architecture.md](/Users/xingkaihan/Documents/Code/iClaw/docs/architecture/openclaw-wrapper-architecture.md)

## 3. 设计原则

`Hermes` 必须遵循以下原则：

1. 不侵入 `OpenClaw` kernel。
2. 演化对象优先是平台能力资产，而不是 runtime 源码。
3. 所有演化过程可审计、可回放、可回滚。
4. 所有自动生成的结果必须经过验证后才能发布。
5. `memory` 是输入源，不是能力资产的最终真值。
6. 数据库中的 platform catalog 才是能力真值，Git baseline 只用于导出、review 和追溯。

## 4. 演化对象范围

第一阶段推荐只允许 `Hermes` 演化以下对象：

- `skill`
- `prompt`
- `workflow`
- `routing_rule`
- `policy_rule`

后续可扩展到：

- `sidebar`
- `header`
- `input`
- `home`
- `menu`
- `asset slot`
- 其它 OEM surface/component

但这些对象仍应遵循同一条原则：

- 平台定义主数据
- OEM 只维护绑定、默认项、排序和轻量 metadata

第一阶段不建议让 `Hermes` 直接演化：

- `OpenClaw` kernel 代码
- tool executor
- sandbox engine
- session engine
- gateway 协议

## 5. 核心对象模型

`Hermes` 推荐使用以下 6 个核心对象。

### 5.1 Signal

`Signal` 是从运行日志和行为轨迹中抽取出来的结构化问题或机会。

典型来源：

- session memory
- tool logs
- error logs
- 用户反馈
- 用户补 prompt、补参数、手工修复的行为

典型类型：

- `repeated_failure`
- `missing_capability`
- `manual_repair_pattern`
- `high_frequency_request`
- `prompt_drift`
- `tool_misuse`
- `low_quality_output`

### 5.2 Gene

`Gene` 是“这类问题该怎么处理”的通用策略模板。

它不是具体案例，而是策略配方，至少应包含：

- 适配的 signal 类型
- 演化类别：`repair / optimize / innovate`
- 处理步骤
- 允许修改的对象范围
- 风险约束
- 验证模板

可以把 `Gene` 理解成：

- 面向一类问题的标准处理策略

### 5.3 Capsule

`Capsule` 是已经验证过的成功经验胶囊。

它描述的是：

- 在什么触发条件下
- 用了哪个 `Gene`
- 在什么环境里
- 产生了什么 proposal
- 最终效果如何

可以把 `Capsule` 理解成：

- 同类问题在历史上已经成功过一次的案例

### 5.4 Proposal

`Proposal` 是某次实际生成出来的候选演化方案。

典型类型：

- `skill_patch`
- `prompt_patch`
- `workflow_patch`
- `routing_patch`
- `policy_patch`

它是待验证、待发布的候选物，不是最终真值。

### 5.5 Validation

`Validation` 是对 proposal 的自动验证结果。

至少应覆盖：

- schema 校验
- sandbox 回放
- golden task 回归
- policy 检查

### 5.6 EvolutionEvent

`EvolutionEvent` 是整条自进化链路的审计日志。

它用于记录：

- 信号是怎么来的
- 选了哪个 `Gene`
- 参考了哪些 `Capsule`
- 生成了什么 proposal
- 验证是否通过
- 最终是否发布、拒绝或回滚

## 6. 与 `evolver` 的关系

`evolver` 值得借鉴，但更适合作为 `Hermes` 的“演化协议与策略参考层”，而不是直接替代 `OpenClaw`。

可直接借鉴的部分：

- `Signal -> Gene -> Capsule -> Event` 的协议化链路
- 用 append-only event 流记录演化过程
- 把“经验记忆”结构化，而不是散落在自然语言 memory 里

不建议直接照搬的部分：

- 让自进化直接改动 runtime 核心代码
- 让未经平台验证的 prompt 直接进入生产
- 把外部仓库的工作流目录结构原样嵌入主仓库

推荐姿势：

- 将 `evolver` 视为 `Hermes` 的策略引擎参考
- 在 `iClaw` 内部实现符合自身数据架构的 `signal / gene / capsule / proposal / validation / event` 体系
- 把最终发布动作接到平台 catalog 和 OEM binding 上

## 7. 系统分层

建议将 `Hermes` 拆为以下分层。

### 7.1 Runtime Observation Layer

负责从运行时采集原始输入：

- session memory
- tool invocation
- runtime error
- user feedback
- replay trace

这一层只做采集，不做业务判断。

### 7.2 Signal Layer

负责把原始日志标准化为结构化信号。

输出应尽量稳定，避免上层直接依赖原始自然语言日志。

### 7.3 Evolution Strategy Layer

负责：

- `Gene` 选择
- `Capsule` 召回
- proposal 生成策略

这一层是 `Hermes` 的核心决策层。

### 7.4 Validation Layer

负责对 proposal 执行回放、回归与约束检查。

只有通过验证的 proposal 才能继续往下流。

### 7.5 Catalog Publish Layer

负责把通过验证的 proposal 转换为平台能力资产：

- 写入平台 catalog
- 产生版本
- 进入灰度 / 发布流程

### 7.6 OEM Binding Layer

负责将已发布的平台能力按 OEM 规则装配出去：

- 是否启用
- 默认项
- 推荐项
- 排序
- 轻量 metadata

这一层不定义能力本身。

## 8. 端到端执行流程

推荐将自进化设计成异步流水线，而不是嵌进主请求链路。

### 8.1 观察

从以下来源采集：

- 对话 session
- memory
- tool call
- sandbox 执行结果
- 用户修复行为

### 8.2 抽取信号

将原始日志归一化为 `Signal`。

例如：

- “用户三次要求生成 HTML dashboard，前两次失败，第三次通过补 prompt 成功”
- 应被归一化为：
  - `signal_type = repeated_failure`
  - `fingerprint = html_dashboard_generation_unstable`

### 8.3 选择策略

根据 `Signal` 选择匹配的 `Gene`，同时召回相似 `Capsule`。

### 8.4 生成候选方案

生成一个或多个 `Proposal`。

例如：

- 新增 `dashboard-html-generator` skill
- 为某类任务增加 prompt contract
- 为路由器补一个 `routing_rule`

### 8.5 自动验证

至少执行：

- schema check
- sandbox replay
- golden task regression
- policy check

### 8.6 发布

只有验证通过，proposal 才能发布到平台 catalog。

### 8.7 装配

最终由 OEM binding 或 runtime binding 消费这些能力资产。

## 9. MVP 范围

`Hermes` 第一阶段建议只做这 4 件事：

1. 发现高价值问题
2. 生成候选演化方案
3. 自动验证候选方案
4. 经过门控后发布到平台 catalog

也就是：

- `observe -> propose -> validate -> publish`

MVP 先不要追求：

- 全自动改代码
- 全自动发布到全量用户
- 对 `OpenClaw` kernel 做自修改

## 10. 推荐数据模型

MVP 可先使用以下 6 张表。

### 10.1 `evolution_signals`

记录结构化信号。

建议字段：

- `id`
- `session_id`
- `brand_id`
- `user_id`
- `signal_type`
- `severity`
- `title`
- `payload_json`
- `fingerprint`
- `status`
- `created_at`

### 10.2 `evolution_genes`

记录策略模板。

建议字段：

- `id`
- `code`
- `name`
- `category`
- `signal_match_json`
- `strategy_json`
- `constraints_json`
- `validation_template_json`
- `enabled`
- `version`

### 10.3 `evolution_capsules`

记录成功案例。

建议字段：

- `id`
- `gene_code`
- `trigger_fingerprint`
- `env_fingerprint`
- `proposal_type`
- `proposal_snapshot_json`
- `outcome`
- `confidence`
- `blast_radius`
- `validation_score`
- `created_at`

### 10.4 `evolution_proposals`

记录候选演化方案。

建议字段：

- `id`
- `signal_id`
- `gene_code`
- `capsule_ids_json`
- `proposal_type`
- `target_scope`
- `content_json`
- `risk_level`
- `status`
- `created_at`

### 10.5 `evolution_validations`

记录验证结果。

建议字段：

- `id`
- `proposal_id`
- `validation_type`
- `input_snapshot_json`
- `result_json`
- `score`
- `passed`
- `created_at`

### 10.6 `evolution_events`

记录审计事件流。

建议字段：

- `id`
- `entity_type`
- `entity_id`
- `event_type`
- `payload_json`
- `created_at`

## 11. 验证与发布策略

为了避免自进化污染生产环境，建议采用分级发布。

### 11.1 验证维度

至少包含：

- `schema_check`
- `sandbox_replay`
- `golden_task_regression`
- `policy_check`
- `compatibility_check`

### 11.2 统一评分

建议计算统一的 `readiness_score`，综合考虑：

- 成功率
- 稳定性
- token 成本
- 耗时
- blast radius
- 回归风险

### 11.3 发布阶段

建议分四档：

- `draft`
- `shadow`
- `canary`
- `general`

未经验证通过的 proposal 不得进入 `general`。

## 12. 与平台能力中心的衔接

`Hermes` 的输出不应直接停留在 memory 或本地文件里，而应进入平台能力中心。

推荐规则：

- `skill / prompt / workflow / policy / routing_rule` 的权威主数据在数据库 catalog
- baseline 文件只负责导出、review、diff、追溯
- OEM 侧只消费绑定关系，不维护能力定义

这意味着 `Hermes` 的产出不是“一段临时提示词”，而是“可版本化、可治理、可装配的能力资产”。

## 13. 一条典型链路示例

假设用户高频请求：

- 生成 HTML 演示页
- 带图表
- 可导出
- 在 sandbox 内运行

系统观察到：

- 多次代码生成失败
- 用户多次手工补 prompt
- 某次人工修复后成功

此时 `Hermes` 应执行：

1. 生成 `Signal`
   - `signal_type = repeated_failure`
   - `fingerprint = html_dashboard_generation_unstable`
2. 选择 `Gene`
   - `repair_from_errors`
   - 或 `extract_reusable_skill`
3. 召回相似 `Capsule`
4. 生成 `Proposal`
   - 新建一个 `dashboard-html-generator` skill
5. 执行验证
   - 对固定样例集回放
   - 检查运行成功率和输出质量
6. 发布到平台 catalog
7. 再由 OEM / routing 层决定是否启用

这样才能把“一次人工补救”沉淀为“长期可复用能力”。

## 14. 不建议的做法

以下路径风险很高，不建议采用：

1. 把自进化直接做进 `OpenClaw` kernel。
2. 让 `Hermes` 直接自动 commit 主仓库代码。
3. 把 `memory` 直接当作能力资产数据库。
4. 只靠 prompt 自进化，不做结构化验证。
5. 跳过平台 catalog，直接给某个 OEM 私有能力定义。

这些做法都会破坏：

- 可审计性
- 可回滚性
- OEM 统一治理
- 与 OpenClaw 的解耦能力

## 15. 推荐的下一步

在本架构基础上，下一阶段建议继续补三类文档或实现：

1. `Hermes MVP API / Event Contract`
   - 明确 `Signal`、`Proposal`、`Validation` 的 JSON 结构
2. `Hermes Validation Spec`
   - 明确 golden tasks、评分口径、发布阈值
3. `Hermes Catalog Integration Design`
   - 明确如何落到平台 catalog 与 OEM binding

当前结论不变：

- `Hermes` 应该是无侵入的自进化 sidecar / platform service
- `OpenClaw` 保持执行内核角色
- `evolver` 的价值主要在协议化思路，而不是直接替换现有内核
