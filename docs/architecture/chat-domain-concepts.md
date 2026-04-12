# Chat Domain Concepts

更新时间：2026-04-03

## 1. 目标

本文档冻结桌面端与 control-plane 在聊天域内的 3 个核心术语：

- `conversation`
- `turn`
- `session`

后续所有产品文案、前端状态、后端字段、数据库表、接口参数，都必须优先复用这 3 个术语，不再混用 `task / run / thread / window / chatSession` 等近义词来表达同一层概念。

本文档的目的不是解释某一段实现，而是统一“概念边界”。实现如果与本文档冲突，以本文档为准，并逐步改造。

## 2. 三个核心概念

### 2.1 `conversation`

`conversation` 表示一条用户可感知的独立对话线程。

它是产品层的主语义，等价于：

- 左侧列表中的一个独立聊天入口
- 一个独立聊天窗口
- 一段可以被继续追问、重命名、归档、恢复的完整对话

`conversation` 必须具备以下属性：

- 有稳定的 `conversationId`
- 有标题、创建时间、更新时间
- 可以包含多个 `turn`
- 生命周期内可以关联多个 `session`
- 用户切换左侧不同项时，本质上是在切换不同 `conversation`

不允许把以下概念误叫成 `conversation`：

- 单次提问
- 单条消息
- runtime session

### 2.2 `turn`

`turn` 表示一次完整的问答轮次。

一条 `turn` 通常从“用户发起一次输入”开始，到“该次输入的回答、工具过程、产物、计费结果收敛完成”结束。

它是 conversation 内部的业务单元，等价于：

- 一问一答
- 一次请求
- 一次完整执行轮次

`turn` 必须具备以下属性：

- 有稳定的 `turnId`
- 只属于一个 `conversation`
- 对应一次用户输入
- 可挂接该次轮次的消息、工具调用、artifact、usage、billing summary
- 可以有 `running / completed / failed / cancelled` 等状态

`turn` 是之前 `task / run` 这类概念的统一替代词。后续新代码优先使用 `turn`，不要再新增新的近义概念。

不允许把以下概念误叫成 `turn`：

- 一整条 conversation
- runtime session
- 左侧 conversation 入口

### 2.3 `session`

`session` 表示运行时技术上下文容器。

它属于实现层，不是产品主语义。它主要服务于：

- gateway / openclaw runtime 上下文承载
- 模型绑定、连接状态、重连
- 会话压力切换
- runtime 级资源隔离

`session` 必须具备以下属性：

- 有稳定的 `sessionId` 或 `sessionKey`
- 可以被轮换、接力、迁移
- 可以在同一个 `conversation` 生命周期内发生变化
- 不直接决定左侧 UI 展示项

不允许把以下概念误叫成 `session`：

- 用户看到的一条对话线程
- 一次具体 turn
- 历史任务列表项

## 3. 三者关系

冻结关系如下：

- `1 conversation -> N turns`
- `1 conversation -> N sessions`
- `1 turn -> 1 conversation`
- `1 turn -> 1 active session at execution time`
- `1 turn -> N messages`
- `1 turn -> 0..N artifacts`
- `1 turn -> 0..1 billing summary`

需要特别强调：

- `conversation` 是用户视角的线程
- `turn` 是 conversation 内部的执行轮次
- `session` 是底层运行容器

三者禁止互相冒充。

## 4. UI 映射规则

### 4.1 左侧列表

左侧聊天列表默认对应 `conversation`，不是 `turn`，也不是 `session`。

因此：

- 左侧一项 = 一个 `conversation`
- 点击左侧不同项 = 切换不同 `conversation`
- 左侧列表主键应使用 `conversationId`

如果某个页面要展示“历史任务”，那它展示的应该是 `turn` 列表，而不是 conversation 列表。

### 4.2 对话详情页

聊天主视图展示的是某个 `conversation` 的消息流。

在该视图内：

- 可以展示多个 `turn`
- 可以在某个 `turn` 上显示状态、产物、计费
- 可以定位到某个 `turn`

但页面本身仍然是 `conversation` 级页面。

### 4.3 历史任务 / 历史执行

如果产品保留“历史任务”这个概念，则它必须严格对应 `turn`。

因此：

- 一次用户提问应产生一个新的 `turnId`
- 历史任务列表项主键应使用 `turnId`
- 打开某条历史任务时，应进入其所属 `conversation`，并聚焦该 `turn`

不允许：

- 把 conversation 聚合结果命名为“历史任务”
- 用 `conversationId` 冒充 `turnId`

### 4.4 Runtime 恢复

恢复运行时上下文时可以使用 `sessionKey`，但这只是实现细节。

因此：

- UI 跳转目标优先由 `conversationId` 决定
- 运行时恢复可以再映射到对应 `sessionKey`
- `sessionKey` 不能直接作为产品层入口主键

### 4.5 当前对话单一真相

聊天主界面必须始终只有一个“当前对话”一等状态。

推荐唯一主状态：

- `activeConversationId`
- 或 `activeChatRoute`，但其产品语义必须等价于“当前 `conversation`”

以下 UI / 状态都必须从这一主状态派生，而不能各自维护第二套“当前对话”：

- 左侧聊天列表选中态
- 右侧 chat view 当前展示态
- URL / 路由态
- 历史任务打开后的落点
- runtime 恢复时对应的 `sessionKey`

明确禁止双轨状态，例如：

- 一个 `activeConversationId`，再并行维护一个 `displayedConversationId`
- 一个 `activeChatRoute`，再并行维护一个产品语义上的 `displayedChatRoute`
- 左侧高亮跟 `conversationId`，右侧正文却跟另一套 “displayed surface key”

允许存在的从属状态：

- skeleton / loading / reactivating / reveal-ready
- surface cache key
- runtime session ready / connected / busy
- 本地 snapshot 是否命中

但这些状态只允许表达“当前 conversation 何时可展示、如何恢复”，不允许重新定义“当前是哪条 conversation”。

进一步约束：

- “有本地 snapshot” 不等于 “可以把 UI 主视图切到另一条 conversation”
- “surface 已挂载” 不等于 “可以改变左侧当前选中态”
- 任何 reveal / restore / warm cache 逻辑，都只能延迟或加速当前 conversation 的展示，不能创造第二套产品层当前态

一句话冻结：

- 聊天域永远不要双轨 current state
- 当前对话只能有一个单一真相
- 其它状态只能是从属状态，不得与之并列

## 5. 命名规范

### 5.1 必须使用

- `conversationId`
- `turnId`
- `sessionId` 或 `sessionKey`

### 5.2 禁止继续扩散的模糊词

除非是兼容历史字段，否则新代码禁止新增以下高歧义命名：

- `taskId`
- `runId`
- `threadId`
- `chatId`
- `windowId`
- `historyId`

如果短期内无法删除历史字段，必须显式写清楚映射关系，例如：

- `legacyTaskId -> turnId`
- `activeChatId -> conversationId`

### 5.3 组件 / 状态 / 函数命名建议

推荐命名：

- `activeConversationId`
- `selectedConversationId`
- `focusedTurnId`
- `conversationList`
- `turnList`
- `conversationRoute`
- `resolveSessionForConversation`

不推荐命名：

- `selectedTaskId` 用来表示左侧 conversation
- `chatSessionId` 用来表示产品对话线程
- `openTaskChat()` 实际却打开 conversation

## 6. 主键与数据归属规范

### 6.1 `conversationId`

`conversationId` 只负责标识线程。

可归属的数据：

- 标题
- 更新时间
- 当前活跃 session
- conversation 级摘要

不应直接归属的数据：

- 单次计费结果
- 单次 turn 状态
- 某一次具体 prompt

### 6.2 `turnId`

`turnId` 只负责标识轮次。

可归属的数据：

- prompt
- completion status
- tool traces
- artifact 列表
- usage / settlement

不应直接归属的数据：

- conversation 标题
- conversation 排序
- active session 指针

### 6.3 `sessionId / sessionKey`

`sessionId / sessionKey` 只负责标识 runtime 容器。

可归属的数据：

- gateway connection state
- model binding
- runtime secret / auth
- session handoff / rotation

不应直接归属的数据：

- 左侧列表展示身份
- 历史任务主键
- 用户可见标题

## 7. 当前代码中的典型混乱点

以下模式视为需要逐步清理的反模式：

- 用 `conversationId` 聚合记录，但 UI 文案叫“历史任务”
- 用 `taskId` 作为 UI 操作主键，但实际语义是 conversation 代表项
- 打开某条“任务”时，最终落到 conversation 的 active session，却没有 turn 级聚焦
- `sessionKey` 同时参与业务语义和运行时语义

这些实现可以暂时兼容，但不能再作为新代码模板继续复制。

## 8. 后续改造原则

后续相关改造统一遵循以下顺序：

1. 先把左侧列表的语义固定为 `conversation`
2. 再引入明确的 `turn` 模型，承接历史任务、计费、artifact、状态
3. 最后把 `session` 收回到底层运行时边界，只做技术承载

具体要求：

- conversation 列表按 `conversationId` 管理
- turn 列表按 `turnId` 管理
- 打开 turn 时，进入所属 conversation 并聚焦到对应 turn
- session 轮换不得改变 conversation 身份
- session 变更不得导致 UI 把同一 conversation 误识别为新窗口

## 9. 冻结结论

自本文档起，聊天域只承认以下 3 个一等概念：

- `conversation`
- `turn`
- `session`

术语映射冻结如下：

- 用户看到的独立窗口 / 左侧一项：`conversation`
- 一问一答的一次执行轮次：`turn`
- runtime / gateway 的技术上下文：`session`

任何新设计、新字段、新接口、新表，如果无法明确落入这 3 类之一，说明概念设计还没有收敛，不允许直接进入实现。
