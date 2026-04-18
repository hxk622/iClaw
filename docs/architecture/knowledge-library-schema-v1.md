# Knowledge Library Schema V1

## 目标

定义 iClaw 知识库 V1 的最小对象模型，支撑以下闭环：

- Raw 导入
- Graph 编译
- Output 产出
- Chat 上下文绑定

V1 采用 local-first 思路，先保证本地对象可持久化、可查询、可去重，再逐步扩展远端同步与图谱编译能力。

## 1. RawMaterial

RawMaterial 是知识库素材层的统一对象。它兼容浏览器插件的 `source/snippet` 模型，同时扩展到上传、转写、聊天沉淀等来源。

### 建议字段

- `id`
- `user_id`
- `workspace_id`
- `kind`
  - `source`
  - `snippet`
  - `upload`
  - `transcript`
  - `chat`
  - `url`
- `source_url`
- `title`
- `excerpt`
- `content_text`
- `note`
- `mime_type`
- `source_name`
- `source_type`
  - `text`
  - `video`
  - `pdf`
  - `image`
  - `audio`
  - `chat`
- `source_icon`
- `snippet_kind`
  - `text`
  - `video`
- `timestamp_label`
- `thumbnail_url`
- `author_avatar_url`
- `favicon_url`
- `tags`
- `dedupe_key`
- `status`
  - `saved`
  - `parsed`
  - `indexed`
  - `graphified`
- `created_at`
- `updated_at`

## 2. GraphDocument

GraphDocument 是图谱层的主入口对象。它不是单节点，而是某一主题、子图或编译结果的聚合文档。

### 建议字段

- `id`
- `user_id`
- `workspace_id`
- `title`
- `summary`
- `source_raw_ids`
- `status`
  - `draft`
  - `compiled`
  - `stale`
- `layout_hint`
- `updated_at`
- `created_at`

## 3. GraphNode

### 建议字段

- `id`
- `graph_id`
- `label`
- `node_type`
  - `person`
  - `company`
  - `concept`
  - `asset`
  - `event`
  - `thesis`
  - `evidence`
- `summary`
- `evidence_raw_ids`
- `weight`
- `metadata`
- `created_at`
- `updated_at`

## 4. GraphEdge

### 建议字段

- `id`
- `graph_id`
- `from_node_id`
- `to_node_id`
- `relation_type`
  - `supports`
  - `contradicts`
  - `influences`
  - `belongs_to`
  - `mentions`
  - `derived_from`
- `weight`
- `evidence_raw_ids`
- `metadata`
- `created_at`
- `updated_at`

## 5. OutputArtifact

OutputArtifact 是成果层的统一对象。

### 建议字段

- `id`
- `user_id`
- `workspace_id`
- `type`
  - `memo`
  - `expert`
  - `card`
  - `article`
  - `wechat_post`
  - `xhs_post`
  - `ppt`
  - `doc`
  - `rule`
- `title`
- `summary`
- `content`
- `content_format`
  - `markdown`
  - `html`
  - `json`
  - `binary`
- `source_raw_ids`
- `source_graph_ids`
- `status`
  - `draft`
  - `published`
  - `archived`
- `publish_targets`
- `metadata`
- `created_at`
- `updated_at`

## 6. 映射：OpenAlpha extension -> iClaw RawMaterial

### 浏览器页面保存

OpenAlpha `source` -> `RawMaterial(kind='source')`

### 滑选摘录

OpenAlpha `snippet` -> `RawMaterial(kind='snippet')`

### 视频时间戳摘录

OpenAlpha `snippet(snippet_kind='video')` -> `RawMaterial(kind='snippet', timestamp_label=...)`

## 7. V1 存储建议

### 优先级

1. 本地持久化先跑通
2. 查询接口先稳定
3. 再扩展远端同步和图谱编译

### 建议

V1 可以先使用本地存储层承接：

- RawMaterial
- GraphDocument / GraphNode / GraphEdge
- OutputArtifact

但 API 层要从一开始就以 repository 模式组织，避免 UI 继续直接读取硬编码对象。
