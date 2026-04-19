# Ontology Pipeline Architecture

## 目标

定义 iClaw `Ontology / 本体图谱` 的真正编译流水线。

本文件回答四个问题：

1. Raw 如何进入 ontology pipeline
2. Graphify 在系统中到底负责什么
3. ontology 如何具备本体论语义，而不是普通节点图
4. 如何让 Ontology 成为飞轮的中间知识层

## 1. 核心结论

### 结论 1

Ontology 不是静态图，也不是 tag 图。

它必须至少同时满足：

- 实体类型化
- 关系类型化
- 来源可追溯
- 证据可回链

### 结论 2

Graphify 是 `render + graphify` 候选内核，不是系统总模型。

- iClaw 负责对象协议与知识边界
- Graphify 负责把编译后的结构化图谱变成可视关系图，并承担 graphify 流程中的关系生成与图结构组织能力

### 结论 3

Ontology 是 Raw 与 Output 之间的必经中间层。

如果 Output 可以绕开 Ontology 直接从 Raw 长出来，本体图谱就会退化为装饰层。

## 2. Pipeline 分层

## Layer 1：Raw Intake

输入对象：

- RawMaterial

输入内容包括：

- title
- excerpt
- content_text
- source_url
- source_type
- tags
- metadata

## Layer 2：Preprocess

目标：

- 统一文本
- 去噪
- chunk 化
- 标准化来源元信息

输出对象：

- `PreprocessedRawChunk`

建议字段：

- `raw_id`
- `chunk_id`
- `text`
- `token_estimate`
- `chunk_order`
- `source_metadata`

## Layer 3：Entity Extraction

目标：

从 chunk 中抽出实体候选：

- person
- company
- concept
- asset
- event
- thesis
- evidence anchor

输出对象：

- `OntologyNodeCandidate`

## Layer 4：Relation Extraction

目标：

从 chunk 中抽出关系候选：

- supports
- contradicts
- influences
- belongs_to
- mentions
- derived_from

输出对象：

- `OntologyEdgeCandidate`

## Layer 5：Ontology Typing

这是和普通知识图最大的区别。

目标：

- 给节点赋 ontology type
- 给边赋 ontology relation type
- 让关系带语义约束

例如：

- `Person -> proposes -> Thesis`
- `Company -> belongs_to -> Sector`
- `Asset -> influenced_by -> MacroFactor`
- `Memo -> derived_from -> RawMaterial`

输出对象：

- `OntologyNode`
- `OntologyEdge`

## Layer 6：Evidence Linking

目标：

每条节点和边都能回链到 Raw 证据。

建议：

- `node.evidence_raw_ids`
- `edge.evidence_raw_ids`
- `edge.evidence_chunk_ids`

## Layer 7：Graph Materialization

目标：

把 ontology 对象组织成真正可被第二栏消费的图谱文档。

输出对象：

- `OntologyDocument`
- `OntologyNode[]`
- `OntologyEdge[]`

## 3. Graphify 的系统角色

Graphify 在 iClaw 中的角色应明确为：

### 负责

- graphify 过程中的图结构组织
- 节点/边可视化
- force-directed / relation graph 渲染
- 节点聚类与中心节点聚焦
- Ontology graph 的第二栏关系图视图

### 不负责

- RawMaterial 定义
- OutputArtifact 定义
- Chat 对象协议
- 插件采集协议
- OEM 结构

也就是：

> Graphify 是 Ontology layer 的编译/渲染内核之一，不是整个知识库系统的母体。

## 4. 本体论最小要求

要叫 `Ontology / 本体图谱`，至少必须有：

### 4.1 节点本体类型

例如：

- `Person`
- `Organization`
- `Concept`
- `Asset`
- `Event`
- `Claim`
- `Evidence`
- `Output`

### 4.2 关系本体类型

例如：

- `supports`
- `contradicts`
- `influences`
- `belongs_to`
- `mentions`
- `authored_by`
- `derived_from`
- `evidenced_by`

### 4.3 类型约束

关系两端不能任意连。

例子：

- `Person -> authored_by -> Claim` 不成立
- 应该是 `Claim -> authored_by -> Person`

也就是说 ontology layer 必须至少具备基本的语义方向性和类型合法性。

## 5. 第二栏视图要求

第二栏对 Ontology 需要至少支持两种 viewer：

### 5.1 Ontology 页面视图

显示：

- 标题
- 摘要
- 核心实体
- 核心关系
- 证据列表
- 更新时间

### 5.2 Ontology 图谱视图

显示：

- 中心节点
- 邻接节点
- 关系连线
- 类别颜色
- 节点大小权重
- hover / focus / click

## 6. 与 Output 的关系

Output 不应只“引用图谱”，而应进入 ontology。

例如：

- 一篇 memo 是一个 `OutputArtifact`
- 同时它也可以成为 ontology 中的 `Output` 节点
- 并与来源 Raw / OntologyNode / OntologyEdge 建立 `derived_from` 关系

这样成果才能真的反哺本体图谱。

## 7. 与 Chat 的关系

Chat 不直接产 ontology，但可以触发 ontology 更新。

### 触发方式

- 用户确认“保存到知识库”
- AI 生成的结构化摘要被确认沉淀
- 用户修正节点含义或关系含义

这些都不直接写进 UI，而是进入 pipeline：

- 先沉淀为 Raw / Output
- 再编译到 Ontology

## 8. 推荐实现顺序

### Phase A

- 建立 ontology schema
- 明确 node type / edge type / evidence model

### Phase B

- 接通 Raw -> Ontology 编译入口
- 先做单文档 / 小批次 graphify

### Phase C

- 接入 Graphify 的图谱视图
- 第二栏展示真实关系图

### Phase D

- Output -> Ontology 回写
- Chat feedback -> Ontology 更新

## 9. 最终结论

真正的 `Ontology / 本体图谱` 不是一个 tab 名称升级，而是把 Graph 从“图形展示层”升级成：

> Raw 的语义编译层、Output 的中间知识层、Chat 的结构化上下文层。

只有这样，本体图谱才是飞轮，而不是贴图。
