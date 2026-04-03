# Desktop Surface Cache Architecture

更新时间：2026-04-03

## 目标

为 `apps/desktop` 建立统一的多 surface 保活架构，解决以下问题：

- 左侧菜单切换导致 `OpenClawChatSurface` 被卸载，触发 websocket 重连
- 运行中的 tool / billing / artifact / draft 状态在切页时丢失
- chat 与其它工作台页面都缺少统一的生命周期与回收策略
- 当前页面切换语义更像“销毁重建”，而不是“工作台 surface 切换”

这套架构只解决桌面壳层的 surface 生命周期，不改变 OpenClaw kernel 的协议、计费口径或运行时责任边界。

## 核心原则

- 先保活，再淘汰；不再默认“切页即卸载”
- `chat` 与左侧工作台页面分池管理，不共享同一个全局 LRU
- 淘汰策略不是裸 LRU，而是 `guarded LRU`
- `active / busy / pending-billing` 的实例不能被淘汰
- 淘汰前必须先持久化必要状态
- 非可见 surface 进入低活跃模式，避免后台继续高频 re-render / polling
- surface cache 只负责生命周期与恢复效率，不负责定义产品层“当前对话”
- 聊天域禁止双轨 current state；当前 `conversation` 只能有一个单一真相

## 术语

- `surface`：桌面壳中的一个页面实例，例如一个 chat session、一个 skill-store 页、一个 memory 页
- `surface key`：唯一标识一个 surface 实例的 key
- `surface pool`：某类 surface 的缓存池
- `active`：当前可见实例
- `busy`：存在运行中任务、连接中任务或不可中断的执行态
- `pending-billing`：当前 surface 还有计费结算未完成
- `warm-hidden`：已挂载但隐藏，保持最小必要状态
- `cold-evicted`：已被淘汰，只保留持久化快照

## 问题拆分

### 1. Chat 类问题

`OpenClawChatSurface` 不是普通页面，它持有：

- gateway 连接
- 当前 run 状态
- tool 调用链路
- usage / billing settlement 定时器
- artifact 打开状态
- 输入草稿与 session 级缓存

因此它不能跟随左侧菜单一起销毁。

### 2. 工作台页面问题

`skill-store / mcp-store / memory / task-center / market` 这类页面虽然没有 chat 那么重，但也存在：

- 搜索条件
- 筛选条件
- 列表分页 / 滚动位置
- 局部草稿 / 选择态

这类页面也不该在每次切换时全部重建。

## 总体架构

采用“两级缓存池 + guarded LRU”：

### 1. Chat Pool

职责：

- 管理多个 chat session surface
- 保持 `OpenClawChatSurface` 在切左菜单时不卸载
- 允许多个 chat session 在桌面壳内保活

补充冻结约束：

- 即使存在多个已缓存 chat surface，产品层仍然只能有一个当前 `conversation`
- 左侧选中态与右侧主视图必须由同一个 `activeConversationId` 或等价主状态驱动
- `surface key`、`mounted surface`、`reveal-ready` 只能决定“何时展示当前 conversation”，不能决定“当前是哪条 conversation”
- 不允许额外引入与 `activeConversationId` 并列的 `displayedConversationId`、`displayedChatRoute` 一类产品态

默认上限：

- `chatPool.max = 50`

surface key：

- `chat:{conversationId || "none"}:{sessionKey}`

### 2. Menu Pool

职责：

- 管理左侧工作台类页面实例
- 保留筛选、分页、滚动、局部草稿等状态

默认上限：

- `menuPool.max = 8`

surface key：

- `menu:{primaryView}`

说明：

- 左侧菜单通常是“一类一个实例”，不建议给到 `50`
- menu pool 与 chat pool 分开，避免 chat 大量实例把工作台页面挤掉

### 3. Overlay Pool

职责：

- 管理账户面板、充值、设置等 overlay

默认上限：

- `overlayPool.max = 5`

## Surface 元数据模型

```ts
type SurfacePoolKind = 'chat' | 'menu' | 'overlay';

type SurfaceLifecycleState = 'active' | 'warm-hidden' | 'cold-evicted';

type SurfaceRecord = {
  id: string;
  pool: SurfacePoolKind;
  key: string;
  visible: boolean;
  mounted: boolean;
  busy: boolean;
  hasPendingBilling: boolean;
  hasUnsavedDraft: boolean;
  lastActiveAt: number;
  mountedAt: number;
  lifecycleState: SurfaceLifecycleState;
  snapshotVersion: number;
};
```

补充约束：

- `busy=true` 由 surface 主动上报
- `hasPendingBilling=true` 由 chat surface 主动上报
- `hasUnsavedDraft=true` 可用于淘汰前持久化或保护

## Guarded LRU 规则

当某个 pool 达到上限时：

1. 当前 `active` surface 不参与淘汰
2. `busy=true` 的 surface 不参与淘汰
3. `hasPendingBilling=true` 的 surface 不参与淘汰
4. 剩余候选里按 `lastActiveAt` 升序淘汰最旧实例

如果没有可淘汰实例：

- 不强制回收
- 允许短时突破上限
- 等待 busy surface 结束后再回收

这比“纯 LRU”更符合 chat 与任务型页面的生命周期。

## 生命周期

### 1. 激活

当用户切到某个 surface：

- 若实例已存在：直接切为 `active`
- 若实例不存在：创建并挂载
- 更新 `lastActiveAt`

### 2. 隐藏

当用户离开当前 surface：

- 不卸载
- 切为 `warm-hidden`
- 进入低活跃模式

### 3. 淘汰

命中 pool 上限后：

- 先做快照持久化
- 再卸载 React 实例
- lifecycle 标记为 `cold-evicted`

## 低活跃模式

surface 隐藏后，不应该完全“假死”，但也不能继续高耗运行。

### Chat Surface

隐藏时保留：

- gateway 连接
- 当前 run
- tool / billing / usage settlement
- session snapshot

隐藏时降载：

- 暂停非关键诊断轮询
- 暂停非必要 DOM observer
- 暂停与可见性强相关的动画和自动滚动
- 避免因隐藏页继续驱动高频 re-render

### Menu Surface

隐藏时保留：

- 页面本地状态
- 查询条件
- 列表与滚动位置

隐藏时降载：

- 停止与可见性强相关的 revalidate
- 暂停非关键定时刷新

## 快照与恢复

淘汰前必须先写快照。

### Chat Snapshot

最小快照包含：

- `sessionKey`
- `conversationId`
- `messages`
- `pendingUsageSettlements`
- 输入草稿
- 视图局部状态（如滚动锚点、已打开 artifact token）

### Menu Snapshot

按页面类型保存：

- filters
- search
- pagination
- selected item
- scroll position

### 恢复原则

- 优先从 warm-hidden 实例直接恢复
- 其次从 cold-evicted snapshot 恢复
- 恢复失败时才走全量重建

## React 壳层改造方向

### 当前问题

`AuthedView` 当前是基于 `resolvedPrimaryView` 条件渲染：

- 某个页面可见时 mount
- 切走后直接 unmount

这对 chat 是错误的。

### 目标结构

引入 `SurfaceCacheManager`：

```ts
type SurfaceCacheManager = {
  chatPool: SurfacePool;
  menuPool: SurfacePool;
  overlayPool: SurfacePool;
  activate(surfaceKey: string): void;
  hide(surfaceKey: string): void;
  evictIfNeeded(pool: SurfacePoolKind): void;
  updateMeta(surfaceKey: string, patch: Partial<SurfaceRecord>): void;
};
```

React 层改造：

- `AuthedView` 不再用单一条件分支直接决定 mount / unmount
- 改为：
  - pool 决定实例是否存在
  - view state 决定实例是否可见
- 视觉上仍然是单页切换
- 生命周期上是 keep-alive

## 分阶段落地

### Phase 1

先完成 chat 保活：

- `OpenClawChatSurface` 切左菜单不卸载
- chat session 可保留运行中状态
- 解决 reconnect / tool fail / billing fail 主问题

### Phase 2

引入 chat pool：

- 支持多个 chat session 同时保活
- 加入 `chatPool.max = 50`
- 加入 guarded LRU

### Phase 3

引入 menu pool：

- `skill-store / mcp-store / memory / task-center / market` 保活
- `menuPool.max = 8`

### Phase 4

统一 surface manager：

- 所有 surface 使用同一套注册、保活、隐藏、回收协议
- overlay 也纳入统一生命周期

## 验收标准

### Chat

- 左侧切菜单再回到原会话，不触发“重新连接”
- 运行中的 tool 不因切页中断
- usage / billing settlement 不因切页丢失
- 输入草稿与滚动位置保留

### Menu

- 切回后搜索条件、筛选、分页、滚动位置保留
- 隐藏页不再继续高频刷新

### Cache

- 超过上限后，最旧且可淘汰实例被回收
- `active / busy / pending-billing` 实例不会被误回收
- 被淘汰实例可从快照恢复

## 非目标

- 不修改 OpenClaw kernel 的 chat / gateway / billing 协议
- 不把计费逻辑迁回前端
- 不在壳层复制第二套 chat engine
- 不在本轮设计里处理 runtime 包瘦身

## 推荐默认值

- `chatPool.max = 50`
- `menuPool.max = 8`
- `overlayPool.max = 5`

如果后续发现内存占用偏高，再优先优化：

- hidden surface 降载
- chat snapshot 粒度
- menu 页二级缓存策略

而不是退回“切页即销毁”。
