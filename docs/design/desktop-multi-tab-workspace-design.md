# Desktop 多页签工作区设计

更新时间：2026-04-18

## 1. 背景

当前 `iClaw` 桌面端已经具备稳定的聊天工作区基础：

- 应用主壳层以单活动 `chat route` 驱动当前聊天现场。
- 当前活动会话会持久化到本地，刷新或重启后可以恢复。
- 聊天 surface 已支持 keep-mounted / cache 语义，避免频繁切换时反复重建。

相关现状代码位于：

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/src/app/lib/chat-navigation.ts`
- `apps/desktop/src/app/lib/chat-route-persistence.ts`

但当前产品仍然是“单轨工作区”：

- 同一时刻只有一个活动聊天页。
- 用户在“新对话 / 历史对话 / 任务中心消息跳转 / sidebar 最近对话”之间切换时，本质是在替换同一个工作区。
- 多个正在进行的分析任务、不同主题的会话、不同 agent / skill 上下文无法并排保留为稳定工作单元。

这会直接带来几个问题：

1. 用户在多个任务间来回切换时，缺少明确的工作单元边界。
2. “当前会话”与“当前页面”强耦合，导致历史恢复、通知跳转、手动新建都在争夺同一个活动槽位。
3. 用户无法像桌面应用一样管理多个并行上下文，也无法进行重命名、分组感知和视觉标记。

因此，桌面端需要引入“多页签工作区”，把当前单活动会话升级为多个稳定、可切换、可持久化的工作单元。

## 2. 核心结论

`iClaw` 的多页签采用“聊天工作区优先”的方案：

1. 第一阶段只把 `chat` 工作区升级为多页签，不把所有一级菜单都立即 tab 化。
2. 一个页签代表一个用户工作单元，而不是一个临时路由片段。
3. 页签状态分为两层：
   - 持久层：tab 元数据、顺序、颜色、用户重命名结果、绑定的 route
   - 运行层：surface runtime、busy 状态、未发送草稿、恢复中状态
4. 现有 `chat route`、`conversationId`、`sessionKey`、surface cache 继续保留，不推倒现有聊天内核。
5. 多页签是桌面壳层能力，属于 `apps/desktop` 的 wrapper / integration 设计，不要求 OpenClaw kernel 改动。

一句话总结：

- 先把“单活动聊天工作区”升级为“多个稳定聊天工作区 tab”，并复用现有 route 与 surface 缓存体系承接运行态。

## 3. 设计目标

### 3.1 目标

1. 支持多个聊天工作单元并行存在，并可快速切换。
2. 支持桌面应用常见页签交互：
   - 新建
   - 切换
   - 关闭
   - 拖拽排序
   - 右键菜单
   - 重命名
   - 修改颜色
3. 在不破坏现有聊天恢复能力的前提下，引入新的 tab 持久化层。
4. 尽量复用现有 `chatSurfaceEntries`、`surface cache`、`persisted route`。
5. 为后续的“页签固定、未读提醒、分屏、artifact 页签”保留扩展位。

### 3.2 非目标

1. 第一阶段不实现 IDE 式分屏 / panel tree。
2. 第一阶段不把 `knowledge-library`、`task-center`、`settings` 等一级视图全部做成 tab。
3. 第一阶段不做跨设备同步；tab 状态仅本机持久化。
4. 第一阶段不改动聊天消息、conversation、turn 的底层存储模型。
5. 第一阶段不把右键菜单做成无限扩展命令平台，只覆盖高频工作区操作。

## 4. 方案选择

在方向上有三个可选方案：

### 方案 A：继续单轨，只加强最近对话切换

优点：

- 最简单
- 风险最低

缺点：

- 本质上没有多工作单元
- 无法支持重命名、改色、并行任务管理

结论：

- 不满足目标。

### 方案 B：直接做 IDE 式“多页签 + 分屏树”

优点：

- 一步到位
- 后续扩展空间最大

缺点：

- 对当前 `iClaw` 来说过重
- 当前产品的核心矛盾是并行聊天，而不是复杂 panel 编排
- 实现面和测试面都会显著膨胀

结论：

- 可作为未来阶段，不作为第一阶段主方案。

### 方案 C：先做“聊天工作区多页签”，分屏留作后续扩展

优点：

- 解决当前最强用户痛点
- 与现有 `App.tsx` 的 chat route/surface cache 模型兼容
- 可以较低风险落地 rename / color / close / reorder / keep-alive

缺点：

- 第一阶段不是全应用通用 tab 壳
- 后续如果要做 split，需要再升级数据模型

结论：

- 采用此方案。

## 5. 当前基础与设计边界

当前实现里，`App.tsx` 已经具备以下可复用基础：

### 5.1 单活动 route 持久化

- `readPersistedActiveChatRoute()` / `writePersistedActiveChatRoute()`
- `buildConversationBackedChatRoute()`
- `resolveInitialChatRoute()`

这些能力说明：当前系统已经能把“活动聊天入口”稳定映射到 `conversationId + sessionKey`。

### 5.2 工作区场景持久化

- `readPersistedWorkspaceScene()`
- `writePersistedWorkspaceScene()`

这些能力说明：当前系统已经有“工作区 UI 场景”持久化，而不仅仅是聊天消息持久化。

### 5.3 聊天 surface 缓存与保活

`App.tsx` 当前已经有：

- `chatSurfaceEntries`
- `chatSurfaceRuntimeState`
- `buildChatSurfaceCacheKey(route)`
- `keepChatSurfaceMounted`

这意味着我们不需要重新设计消息页保活逻辑，只需要把“谁是 active route”升级为“哪个 tab 的 route 是 active route”。

### 5.4 交互视觉基线

多页签必须遵循现有桌面交互规范与视觉 token：

- `docs/design/desktop-ui-interaction-guidelines.md`
- `apps/desktop/src/styles/theme.css`

特别是：

- 所有 tab 项都必须 `cursor-pointer`
- hover / active / focus 必须统一
- 颜色体系优先复用暖金 / 暖灰 token，不做浏览器原生蓝灰标签页风格

## 6. 范围定义

第一阶段，多页签只覆盖桌面端主聊天工作区：

- 新建聊天
- 打开历史对话
- 从任务中心 / 通知 / 最近对话跳转到已有会话
- 保留多个聊天现场

第一阶段不进入 tab 模型的内容：

- 一级菜单主视图切换
- 账户 / 设置 / 充值 overlay
- 非聊天 surface 的多实例化

这样做的原因是：

- 当前最需要稳定并行的是聊天上下文，而不是菜单页
- 先把“聊天 tab”做稳定，再评估是否把 `knowledge-library` 或 `task-center` 升级为 tab 型 surface

## 7. 数据模型

### 7.1 新增持久化键

新增本地持久化 key，建议继续走 scoped key 体系：

- `iclaw.desktop.workspace-tabs.v1`

推荐通过现有 `buildChatScopedStorageKey(...)` 做 scope 包装，保持：

- 品牌隔离
- 登录态 / guest scope 隔离
- 与旧 key 共存

### 7.2 页签快照结构

```ts
type WorkspaceTabsSnapshot = {
  version: 1;
  activeTabId: string | null;
  tabs: WorkspaceTabRecord[];
  recentlyClosedTabIds?: string[];
};
```

### 7.3 页签记录结构

```ts
type WorkspaceTabKind = 'chat';

type WorkspaceTabColor =
  | 'default'
  | 'gold'
  | 'olive'
  | 'teal'
  | 'slate'
  | 'rose'
  | 'charcoal';

type WorkspaceTabTitleSource = 'auto' | 'user';

type WorkspaceTabRecord = {
  id: string;
  kind: WorkspaceTabKind;
  color: WorkspaceTabColor;
  title: string;
  titleSource: WorkspaceTabTitleSource;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  lastVisitedAt: string;

  route: {
    conversationId: string | null;
    sessionKey: string;
    initialPrompt?: string | null;
    initialPromptKey?: string | null;
    focusedTurnId?: string | null;
    focusedTurnKey?: string | null;
    initialAgentSlug?: string | null;
    initialSkillSlug?: string | null;
    initialSkillOption?: ComposerSkillOption | null;
    initialStockContext?: ComposerStockContext | null;
  };
};
```

### 7.4 运行态结构

运行态不直接写入 tab 快照，单独维护：

```ts
type WorkspaceTabRuntimeState = {
  busy: boolean;
  ready: boolean;
  hasPendingBilling: boolean;
  hasUnsavedDraft: boolean;
  recovering: boolean;
};
```

说明：

- `route` 是 tab 的业务身份。
- `title/color/pinned/order` 是 tab 的壳层元数据。
- `conversation title` 与 `tab title` 不再强绑定。
- 如果用户未手动重命名，则 tab title 跟随 conversation 自动标题。
- 一旦用户重命名，`titleSource = 'user'`，后续不再被 conversation 自动覆盖。

## 8. 关键设计决策

### 8.1 tab 的业务身份以 route 为准

tab 不是 conversation 的别名，但 route 是 tab 的业务真值。

也就是说：

- 同一个 conversation 原则上只允许一个打开的 tab
- 但 tab 的标题、颜色、排序由用户单独控制

这样可以避免：

- 同一 conversation 被反复打开成多个几乎相同的标签页
- 标题修改误写回 conversation 主数据

### 8.2 用户元数据与 conversation 元数据分离

conversation 负责：

- 会话身份
- 历史消息
- conversation title
- session 绑定

tab 负责：

- 当前用户这次桌面工作里的呈现方式
- 颜色
- 重命名
- 固定状态
- 排序

不能把“页签颜色 / 页签标题”写回 conversation 主记录。

### 8.3 顶层永远有一个激活 tab

第一阶段不允许“没有活动页签”的状态。

规则：

- 启动应用时，若没有 tab 快照，则根据旧的活动 route 自动生成一个默认 tab
- 关闭最后一个 tab 时，不直接进入空白壳层，而是自动创建一个新的默认聊天 tab

### 8.4 历史会话打开策略

从 sidebar、任务中心、通知进入某个 conversation 时：

1. 若已存在绑定该 conversation 的 tab，则直接激活该 tab
2. 若不存在，则新建一个 tab，并把 route 绑定到该 conversation

默认不允许同 conversation 打开多个 tab。

### 8.5 新建聊天策略

点击“新对话”时：

1. 优先判断当前活动 tab 是否是“空白未命名、无有效消息”的 general chat
2. 若是，则复用当前 tab
3. 否则，新建一个 draft tab

这样可以避免用户频繁点“新对话”时产生一排空标签。

## 9. UI 设计

### 9.1 位置

tab bar 放在桌面主内容区顶部，位于：

- `IClawHeader` 下方
- `OpenClawChatSurface` 上方

它属于聊天工作区的一部分，不放到左侧 sidebar，也不和一级导航混在一起。

### 9.2 基础布局

建议结构：

1. 左侧：tab 列表
2. 右侧：`+ 新建页签`
3. 超出宽度后：
   - 横向滚动
   - 或“更多”折叠菜单

第一阶段优先采用横向滚动，不先做复杂折叠菜单。

### 9.3 视觉语义

active tab：

- 使用较强的暖金 / 高层面板背景
- 显示轻量阴影
- 边框更明确

inactive tab：

- 使用弱化表面
- hover 时上浮和轻阴影

tab 颜色：

- 不直接用任意 HEX 自定义
- 只允许系统调色板中若干离散颜色
- 颜色主要作用在：
  - 顶部细条
  - 左侧小圆点
  - 选中态光晕混色

推荐调色板：

- `default`
- `gold`
- `olive`
- `teal`
- `slate`
- `rose`
- `charcoal`

### 9.4 状态标记

tab 需要支持轻量状态徽标：

- `busy`：转圈 / 呼吸点
- `hasUnsavedDraft`：小圆点
- `recovering`：淡色 skeleton 状态

第一阶段不引入复杂 unread badge。

## 10. 交互设计

### 10.1 左键

- 点击 tab：切换到该 tab
- 点击关闭按钮：关闭该 tab
- 点击 `+`：新建 tab

### 10.2 双击

- 双击 tab 标题：进入重命名

### 10.3 右键菜单

右键菜单是第一阶段必须支持的能力。

菜单项建议如下：

1. `重命名`
2. `修改颜色`
3. `关闭标签页`
4. `关闭其他标签页`
5. `关闭右侧标签页`

第一阶段不建议加入：

- 固定 / 取消固定
- 复制会话链接
- 在浏览器打开
- 复制内部 ID

这些都不是高频桌面工作动作。

### 10.4 重命名规则

- 默认标题来自 conversation 自动标题或“新对话”
- 用户重命名后，写入 tab 自身 `title`
- 不回写 conversation title
- 空标题提交时回退到自动标题

### 10.5 修改颜色规则

- 颜色通过右键菜单中的离散色板选择
- 修改后立即生效并持久化
- 激活态和未激活态都能感知颜色，但不应过度花哨

### 10.6 拖拽排序

- 支持 header tab 横向拖拽排序
- 排序结果持久化
- pinned tab 永远位于非 pinned tab 左侧

### 10.7 关闭规则

关闭普通 tab：

- 直接关闭
- 若该 tab 是当前 active，则切回最近访问的可用 tab

关闭最后一个 tab：

- 自动生成一个新的默认聊天 tab

### 10.8 最近访问回退

关闭 active tab 后，不按视觉位置回退，而按最近访问历史回退。

原因：

- 更符合工作流预期
- 用户通常是在 A 和 B 间来回切换，而不是严格按左邻右舍切换

## 11. 渲染与保活策略

### 11.1 总原则

tab 切换不应默认销毁聊天 surface。

应尽量复用现有：

- `chatSurfaceEntries`
- `chatSurfaceRuntimeState`
- `buildChatSurfaceCacheKey(route)`

### 11.2 第一阶段保活策略

第一阶段建议：

- 所有已打开 tab 默认保活
- 非激活 tab 使用现有 hidden layer 模式隐藏
- 总 tab 数上限建议为 `12`

原因：

- 第一阶段优先保证体验正确
- `iClaw` 当前用户规模和桌面使用习惯下，12 个以内全保活可接受

### 11.3 第二阶段优化预留

如果后续发现内存或恢复成本过高，再增加 LRU 驱逐：

- 永远保活：active tab、busy tab、带未发送草稿的 tab
- 条件驱逐：长时间未访问且 idle 的 tab
- 被驱逐 tab 保留 route 和快照，重新激活时 remount

第一阶段不做这层复杂度。

## 12. 持久化与兼容策略

### 12.1 启动恢复

启动时按如下顺序恢复：

1. 读取新的 `workspace-tabs.v1`
2. 若存在且合法，则恢复 tabs + activeTabId
3. 若不存在，则读取旧的活动 route / workspace scene
4. 把旧状态转换成一个默认 tab

### 12.2 与旧 key 共存

在第一阶段 rollout 期间：

- active tab 变化后，继续镜像写入旧的 active route key
- 这样旧逻辑和已有测试仍可工作

待多页签稳定后，再评估是否彻底移除旧 key 读写。

### 12.3 scope 隔离

tab 持久化必须沿用当前 scope 语义：

- guest 与登录用户隔离
- 不同品牌隔离
- 不同 chat persistence scope 隔离

不能把所有场景写进一个全局未分 scope 的 key。

## 13. 与现有模块的集成点

### 13.1 `App.tsx`

新增状态：

- `workspaceTabs`
- `activeWorkspaceTabId`
- `workspaceTabVisitHistory`

改造点：

- `activeChatRoute` 不再直接由全局入口决定，而是来自 active tab
- `openChatRoute(...)` 变为“打开 / 激活某个 tab”

### 13.2 `chat-route-persistence.ts`

保留现有逻辑，但新增：

- `workspace-tabs` 的读写入口
- 旧 `active route` 的兼容镜像写入

### 13.3 `chat-navigation.ts`

`workspace scene` 继续只管理：

- primary view
- selected conversation

不直接承担 tab 快照真值。

### 13.4 `sidebar / task-center / notification-center`

这些入口不再“替换当前工作区”，而是统一走：

- `openConversationInWorkspaceTab(conversationId)`

### 13.5 删除 conversation

删除 conversation 时：

1. 找出所有绑定该 conversation 的 tab
2. 若 tab 内已有有效消息且 conversation 被删，则关闭对应 tab
3. 若被删的是 active tab，则按最近访问历史回退

第一阶段不做“conversation 删除后 tab 转孤儿草稿”的复杂兼容。

## 14. 分阶段实施

### Phase 1：可用版本

交付范围：

1. 顶部聊天 tab bar
2. 新建 / 切换 / 关闭
3. 打开历史会话时复用或新建 tab
4. 右键菜单：
   - 重命名
   - 修改颜色
   - 关闭
   - 关闭其他
   - 关闭右侧
5. 拖拽排序
6. 本地持久化恢复
7. active tab 镜像写回旧 active route key

### Phase 1.5：增强版

交付范围：

1. pinned tab
2. pin / unpin 右键菜单
3. busy / draft 状态指示
4. tab 上限和更好的溢出表现

### Phase 2：扩展版

待验证后再评估：

1. 非聊天 surface tab 化
2. artifact / detail tab
3. split panel
4. 最近关闭标签页恢复

## 15. 验收标准

### 15.1 基础行为

1. 用户可以同时保留多个聊天 tab，并在它们之间稳定切换。
2. 打开已有 conversation 时，不会重复生成多个相同 tab。
3. 关闭 active tab 后，会回到最近访问的 tab，而不是随机跳转。

### 15.2 右键交互

1. tab 右键菜单可正常打开。
2. 重命名结果立即生效并持久化。
3. 修改颜色后，tab 视觉立即变化并持久化。
4. “关闭其他 / 关闭右侧”行为正确，不误伤 pinned tab。

### 15.3 恢复与兼容

1. 应用重启后，tab 顺序、标题、颜色、active tab 可以恢复。
2. 没有 `workspace-tabs` 快照时，旧版本 active route 仍能平滑迁移为单个默认 tab。
3. guest / 登录态、不同 scope 之间互不串页签。

### 15.4 性能与稳定性

1. 在 8 到 12 个常规 tab 下，切换不可出现明显白屏。
2. 运行中的 tab 在切换后不中断其已建立的聊天 surface 生命周期。
3. tab 切换不应导致消息记录、滚动位置、草稿状态无故丢失。

## 16. 实施建议

为了降低风险，建议按下面顺序落地：

1. 先把 `workspaceTabs` 数据层与迁移逻辑加上，但 UI 只显示单 tab
2. 再接入顶部 tab bar 和 tab 切换
3. 再接入右键菜单、重命名、改色、拖拽
4. 最后补齐回归测试和恢复测试

推荐新增测试覆盖：

- tab 持久化恢复
- 历史会话复用 tab
- active tab 关闭回退
- rename / color 持久化
- scope 切换不串 tab

## 17. 最终决策

本项目的多页签设计，第一阶段采用：

- `chat-only multi-tab workspace`
- `tab metadata` 与 `conversation metadata` 分离
- 保留现有 `chat route + surface cache`
- 第一阶段提供桌面常见右键页签能力：重命名、改色、关闭、关闭其他、关闭右侧

这套设计不依赖其他项目的实现细节，可以借鉴成熟桌面工作台交互，但数据模型、持久化和运行态承接全部在 `iClaw` 自身完成。
