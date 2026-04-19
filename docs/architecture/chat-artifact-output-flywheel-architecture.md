# Chat Artifact -> Output -> Knowledge Flywheel Architecture

更新时间：2026-04-19

## 1. 目标

定义聊天主页面中 `artifact` 与知识库 `OutputArtifact` 的关系，避免系统继续存在两套彼此脱节的“产物”概念：

- 聊天页里能预览的 artifact
- 知识库里能沉淀、检索、复用、回放的 output

本文冻结的核心结论是：

> chat 页面里的 artifact 不应直接等同于知识库 output，但它必须是 output 的一等来源。

也就是：

- `artifact` 是运行时执行产物 / 执行证据
- `OutputArtifact` 是知识库中的可复用成果对象
- 二者通过 `turn` 建立稳定 lineage，而不是靠 UI 文案或 DOM 猜测临时拼接

## 2. 当前问题

当前仓库里其实已经分别有这两条链：

### 2.1 Chat / Turn 链

- `conversation -> turn -> messages`
- `turn -> 0..N artifacts`
- 聊天页支持 artifact workbench / preview pane
- `ChatTurnRecord` 已经持有：
  - `turnId`
  - `conversationId`
  - `sessionKey`
  - `prompt`
  - `summary`
  - `artifacts`
  - `financeCompliance`

### 2.2 Knowledge Library 链

- `RawMaterial`
- `OntologyDocument`
- `OutputArtifact`

`OutputArtifact` 已经是知识飞轮中的正式对象：

- 可持久化
- 可检索
- 可回放
- 可作为第三栏 chat 的上下文源
- 可继续反哺 ontology

### 2.3 真正缺失的部分

缺的不是 preview，也不是第二个 artifact pane。

缺的是：

- 如何把 chat turn 里的 artifact 提升成知识库里的 `OutputArtifact`
- 如何把 chat answer 本身视为 output，而不只是临时消息
- 如何把 finance compliance、来源对象、turn 上下文一起带入 output lineage

## 3. 核心概念冻结

### 3.1 ExecutionArtifact

`ExecutionArtifact` 是运行时执行产物。

它强调：

- 某个 `turn` 执行过程中产出了什么
- 它可以是文件、网页、PDF、PPT、sheet、报告
- 它优先服务于当前会话的预览、下载、继续编辑

它不自动等于知识库对象。

### 3.2 OutputArtifact

`OutputArtifact` 是知识库成果对象。

它强调：

- 可复用
- 可检索
- 可追溯
- 可再消费
- 可进入知识飞轮

它必须带有明确 lineage：

- 来自哪个 `turn`
- 来自哪个 `conversation`
- 来自哪些 `RawMaterial`
- 来自哪些 `OntologyDocument`
- 是否携带 finance compliance snapshot

### 3.3 Promotion

`Promotion` 表示把 chat turn 中的执行结果或对话结论提升为知识库成果对象。

Promotion 不是简单“复制正文”，而是一次对象升级：

- 从临时执行产物
- 升级为可治理的 output 对象

## 4. 结构关系

冻结关系如下：

- `1 conversation -> N turns`
- `1 turn -> 0..N execution artifacts`
- `1 turn -> 0..N output artifacts`
- `1 output artifact -> 1 primary source turn`
- `1 output artifact -> 0..N source raw ids`
- `1 output artifact -> 0..N source ontology ids`

需要特别强调：

- `execution artifact` 是 turn 内部产物
- `output artifact` 是知识库对象
- 二者不能混叫
- 但二者必须通过 `turn` 建立一跳可追溯关系

## 5. 为什么 chat artifact 必须进入飞轮

用户在聊天页看到的 artifact，很多时候其实就是最终 output：

- 研究 memo
- 报告
- PPT
- 网页稿
- 可复用表格

如果这些对象只停留在 chat preview 里，会有 4 个问题：

### 5.1 无法检索

用户下次只能靠翻聊天记录找结果，无法在知识库成果层稳定复用。

### 5.2 无法形成 lineage

系统无法回答：

- 这个结果是从哪次对话来的
- 用了哪些素材
- 是否经过合规降级
- 是否可以继续编入 ontology

### 5.3 无法进入知识飞轮

知识飞轮要求：

- chat 既消费知识，也产生知识

如果 chat output 永远不入库，第三栏永远只是消费层，不是生产层。

### 5.4 无法审计

特别是在理财客金融场景下，output 进入知识库时必须一起携带：

- finance compliance snapshot
- disclaimer 策略
- 输出分类
- 风险等级

否则后续导出、分享、通知、再编辑都会丢失合规上下文。

## 6. 推荐对象模型

## 6.1 ExecutionArtifactRef

建议在 `OutputArtifact.metadata` 中以引用形式保存 execution artifact 线索，而不是把运行时文件本身塞进 output 主体。

建议字段：

- `kind`
  - `report`
  - `ppt`
  - `webpage`
  - `pdf`
  - `sheet`
- `path`
- `title`
- `mime_type`
- `preview_kind`

### 设计原因

- 运行时 artifact 更像执行证据
- output 是知识对象
- 不应该让知识库对象与本地文件路径强耦合

## 6.2 Output Lineage

建议所有 chat 派生的 output 都带统一 lineage：

```json
{
  "generated_from": "chat-turn",
  "lineage": {
    "source": "chat-turn",
    "turn_id": "turn_xxx",
    "conversation_id": "conv_xxx",
    "session_key": "agent:main:main",
    "artifact_kinds": ["ppt", "webpage"],
    "artifact_refs": [],
    "prompt_excerpt": "请帮我生成一份投资备忘录",
    "source_raw_ids": ["raw_1", "raw_2"],
    "source_ontology_ids": ["graph_1"]
  }
}
```

## 6.3 Finance Compliance Snapshot

金融类 output 建议把合规快照一并写入 metadata：

```json
{
  "finance_compliance": {
    "domain": "finance",
    "riskLevel": "medium",
    "outputClassification": "investment_view",
    "showDisclaimer": true,
    "blocked": false,
    "degraded": true
  }
}
```

这不是为了展示层偷懒，而是为了后续：

- 输出页统一渲染 disclaimer
- 导出时补 footer
- 再次分享到通知时重新判断降级
- 审计系统回放“为什么这次能出库”

## 7. Chat Surface 的职责

聊天主页面的 artifact workbench 不应直接承担知识库存储逻辑，但它必须成为 promotion 的入口。

### 7.1 Chat Surface 负责

- 展示 execution artifact
- 提供 preview / open / compare / continue edit
- 提供“沉淀到知识库”动作
- 把 turn context 交给 output promotion bridge

### 7.2 Knowledge Library 负责

- 持久化 `OutputArtifact`
- 建立 source raw / ontology 关联
- 支持检索、浏览、再创作
- 让 output 重新进入 ontology / chat

### 7.3 不能做的事

聊天页不能直接把 preview 文件路径当成知识库真值。

否则会导致：

- 路径失效
- 端内路径不可同步
- output 与 lineage 断裂

## 8. Promotion 策略

推荐分两层：

### Layer A：Output Candidate

当 turn 完成时，wrapper 层可以构造 `OutputArtifactCandidate`：

- 仅在本地内存 / 轻缓存里存在
- 持有 turn 上下文
- 持有 artifact kinds / refs
- 持有 answer snapshot
- 持有 finance compliance snapshot

### Layer B：Persisted OutputArtifact

只有在满足以下任一条件时，才真正入库：

- 用户显式点击“沉淀到知识库”
- OEM / workflow 明确声明该类 turn 需要自动沉淀
- 定时任务结果页明确声明该结果属于可复用研究成果

### 不建议

不建议默认把所有 chat artifact 自动入库。

原因：

- artifact 里有大量临时文件
- 有些只是过程性中间稿
- 金融合规下自动入库会放大错误传播范围

## 9. Output Type 归一策略

chat artifact 到 `OutputArtifact.type` 不是 1:1 映射，推荐规则：

- `ppt` -> `ppt`
- `webpage` -> `article`
- 其它类型默认先归为 `memo`

关键点：

- `OutputArtifact.type` 表达的是知识对象类别
- `artifact_kinds` 表达的是运行时执行产物类别
- 两层都要保留，不能互相覆盖

## 10. 与 Thought Library 的关联

知识库第三栏里的嵌入 chat，不应继续是纯临时会话。

正确关系应该是：

- 第一栏选中对象
- 第三栏 chat 围绕该对象生成新结论
- 这些结论可以 promotion 为新的 `OutputArtifact`
- 新 `OutputArtifact` 进入第二栏 / 第一栏的成果层
- 后续再反哺 ontology

也就是：

- chat 不是 Output 的旁路
- chat 是 Output 的生产入口之一

## 11. 与理财客金融合规的关系

在理财客里，chat output 一旦 promotion 成知识库 output，就必须继续继承金融合规控制面。

至少要带：

- `finance_compliance`
- `source_surface`
  - `chat`
  - `cron`
  - `notification`
- `disclaimer_strategy`
- `blocked / degraded` 决策结果

否则会出现：

- 聊天页有 disclaimer
- 成果页没有 disclaimer
- 导出报告不带 disclaimer
- 通知摘要又把高风险内容直接暴露出去

## 12. 最小落地方案

### Phase 1

- 定义 `chat -> OutputArtifactCandidate` bridge
- 统一 metadata.lineage
- 统一 finance compliance metadata
- 聊天页增加“沉淀到知识库”入口

### Phase 2

- 在 thought library 中展示“来自哪次对话”
- 支持从 output 回跳到 source turn
- 让 output 成为 ontology 的 `Output` 节点

### Phase 3

- 支持 OEM / workflow 配置自动 promotion
- 支持 cron output 统一进入成果层
- 支持 output 审计与导出策略联动

## 13. 冻结结论

最终冻结如下：

1. chat 页面 artifact 是 `ExecutionArtifact`，不是知识库真值。
2. 知识库中的成果统一使用 `OutputArtifact`，它必须可追溯到 `turn`。
3. `turn` 是 chat artifact 与 output 之间的唯一稳定桥。
4. 金融场景下，promotion 后的 output 必须携带 finance compliance snapshot。
5. 不做“所有 artifact 自动入库”；先做 `candidate -> explicit promotion` 的稳态链路。
