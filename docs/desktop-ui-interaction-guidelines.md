# 桌面端交互规范

本规范先落在桌面端的 `IM机器人` 视图区，同时作为后续桌面 UI 的默认交互基线。

配套视觉规范位于：

- [desktop-visual-design-system.md](/Users/xingkaihan/Documents/Code/iClaw/docs/desktop-visual-design-system.md)

## 目标

- 所有鼠标悬停后显示小手的区域，都要有统一的弹簧反馈。
- 按钮视觉尽量保持苹果扁平风格，不做厚重拟物，也不做生硬的开发者工具风格。
- 页面优先复用共享基础件，不在业务页面重复拼接一套新的 hover / active / focus 规则。

## 统一交互规则

- 可点击控件统一使用 `SPRING_PRESSABLE`。
- 键盘可聚焦控件统一使用 `INTERACTIVE_FOCUS_RING`。
- 所有视觉上可点击的元素必须显式声明 `cursor-pointer`，不要依赖浏览器默认行为。
- 任何“用户理解为可以点”的区域，只要 hover 后不是小手，都视为交互缺陷，而不是视觉细节问题。
- 弹簧反馈包含 3 个动作：`hover` 轻微上浮、`active` 回弹并轻微缩放、颜色和阴影平滑过渡。
- 禁用态必须移除位移和缩放反馈，避免“看起来还能点”。

### 可点击元素判定规则

- 只要点击后会发生页面切换、tab 切换、筛选切换、抽屉打开、详情展开、卡片选中、弹窗打开、跳转、提交，就必须按“可点击元素”处理。
- 不允许出现“逻辑上可点击，但视觉上像纯展示”的灰区元素。
- 如果一个区域绑定了 `onClick`、`role="button"`、`role="tab"`、路由跳转、选择态切换，必须同时具备：
  - `cursor-pointer`
  - `hover` 反馈
  - `active` 反馈
  - `focus-visible` 反馈
- 只有纯文本说明、纯状态展示、纯信息卡片，才允许保持默认箭头光标。
- 禁用元素必须显式降级为禁用态样式；不要让用户看到小手后点击无反应。

### 高风险漏配场景

- 这几类区域最容易漏掉小手，后续排查时必须优先看：
- 一级 / 二级 tab，例如“智能投资专家”里的“价值投资”“红利收益”等视图切换项。
- 整卡可点的卡片，例如能力卡、策略卡、套餐卡、市场卡、详情入口卡。
- 左侧导航菜单、次级菜单、折叠组标题、可展开行。
- Header 胶囊入口、切换器、筛选 pill、分段控制器。
- 列表行、表格行、带“查看详情”“进入”“配置”语义的整行区域。

### 验收标准

- 设计稿里看起来能点，代码里也必须体现为能点，不允许“只有点击事件，没有交互态”。
- hover 到 tab、菜单项、整卡、可展开行、可选中块时，鼠标必须变成小手。
- hover / active / focus 的反馈要统一，不允许一个页面里同类元素有的有小手、有的没有。
- 同一容器内如果只有局部按钮可点，而整卡不可点，必须通过结构和视觉把点击边界说清楚；不能让用户误以为整卡可点。
- PR 自检时必须逐页扫描所有可点击区域，确认“不是小手”的地方要么改掉，要么删掉点击能力。

共享实现位于：

- [ui-interactions.ts](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/lib/ui-interactions.ts)

## 按钮规范

- 默认优先使用 [Button.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/ui/Button.tsx)。
- `primary` 用于主路径动作，例如“开始接入”“新建机器人”“下一步”。
- `secondary` 用于补充动作，例如“查看异常”“测试连通”“复制”。
- `ghost` 仅用于低强调操作，不要拿来做主 CTA。
- `primary` 采用 `IM机器人` Figma 的暖金主色体系：
  - `Light`: `#A88C5D`
  - `Dark`: `#B49A70`
- `primary` 的默认结构按 Figma 收敛为：`1px` 暖金边框 + 单层平面填充 + 轻量阴影，不做双层玻璃片或高光浮雕。
- `secondary` 采用同一套暖白/暖黑平面按钮，不使用蓝色默认 CTA，也不叠双层高光。
- 按钮默认保持单层、平整、克制，不做明显拟物，不叠“外层按钮 + 内层玻璃片”的双层观感。

当前共享按钮 token 位于 [theme.css](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/styles/theme.css)：

- `--button-primary-bg`
- `--button-primary-bg-hover`
- `--button-primary-border`
- `--button-primary-border-hover`
- `--button-primary-text`
- `--button-primary-shadow`
- `--button-primary-shadow-hover`
- `--button-secondary-bg`
- `--button-secondary-bg-hover`
- `--button-secondary-border`
- `--button-secondary-border-hover`
- `--button-secondary-text`
- `--button-secondary-shadow`

## 颜色系统

- 桌面端默认颜色系统以 `IM机器人` Figma 为基线，不再以蓝白灰 SaaS 视觉为默认方向。
- 系统主题 token 的单一来源位于：
  - [theme.css](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/styles/theme.css)
- 当前默认语义映射如下，后续页面应优先复用，不再自行起新色：
  - 页面背景 `surface.page`
    - `Light`: `#F7F5F0`
    - `Dark`: `#11100F`
  - 卡片背景 `surface.card`
    - `Light`: `#FCFBF8`
    - `Dark`: `#191715`
  - 浮层背景 `surface.popover`
    - `Light`: `#FCFBF8`
    - `Dark`: `#211E1B`
  - 高层表面 `surface.elevated`
    - `Light`: `#FFFFFF`
    - `Dark`: `#211E1B`
  - 弱化表面 `surface.subtle`
    - `Light`: `#F1EEE8`
    - `Dark`: `#26221F`
  - 主文字 `text.primary`
    - `Light`: `#1A1A18`
    - `Dark`: `#F2EEE6`
  - 次级文字 `text.secondary`
    - `Light`: `#6B655D`
    - `Dark`: `#B9B0A5`
  - 弱化文字 `text.muted`
    - `Light`: `#9A9288`
    - `Dark`: `#80786E`
  - 默认边框 `border.default`
    - `Light`: `#DED7CC`
    - `Dark`: `#3A342E`
  - 强边框 `border.strong`
    - `Light`: `#C8BEAF`
    - `Dark`: `#534A42`
  - 主品牌 `brand.primary`
    - `Light`: `#A88C5D`
    - `Dark`: `#B49A70`
  - 次级品牌 `brand.secondary`
    - `Light`: `#6B655D`
    - `Dark`: `#B9B0A5`
  - 成功态 `state.success`
    - `Light`: `#4A6B5A`
    - `Dark`: `#6B8C7A`
  - 警告态 `state.warning`
    - `Light`: `#C49850`
    - `Dark`: `#C49850`
  - 失败态 `state.destructive`
    - `Light`: `#B84F4F`
    - `Dark`: `#C46B6B`
  - 焦点环 `focus.ring`
    - `Light`: `#A88C5D`
    - `Dark`: `#B49A70`
  - 图表色板 `chart.1-5`
    - `Light`: `#A88C5D`, `#6B655D`, `#4A6B5A`, `#C49850`, `#B84F4F`
    - `Dark`: `#B49A70`, `#B9B0A5`, `#6B8C7A`, `#C49850`, `#C46B6B`
  - Sidebar 色板
    - `Light`: `sidebar=#FCFBF8`, `sidebarAccent=#F7F5F0`, `sidebarBorder=#DED7CC`
    - `Dark`: `sidebar=#191715`, `sidebarAccent=#211E1B`, `sidebarBorder=#3A342E`

## 通用组件沉淀

- 下面这些样式不允许在业务页重复手写，必须优先复用通用组件：
  - [Button.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/ui/Button.tsx)
  - [PressableCard.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/ui/PressableCard.tsx)
  - [SurfacePanel.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/ui/SurfacePanel.tsx)
  - [Chip.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/ui/Chip.tsx)
  - [SegmentedTabs.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/ui/SegmentedTabs.tsx)
  - [FilterPill.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/ui/FilterPill.tsx)
  - [CompactSegmentedControl.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/ui/CompactSegmentedControl.tsx)
  - [StatCard.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/ui/StatCard.tsx)
  - [SummaryMetricItem.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/ui/SummaryMetricItem.tsx)
  - [InfoTile.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/ui/InfoTile.tsx)
  - [EmptyStatePanel.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/ui/EmptyStatePanel.tsx)
  - [SelectionCard.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/ui/SelectionCard.tsx)
  - [DrawerSection.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/ui/DrawerSection.tsx)
  - [PlatformCardShell.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/ui/PlatformCardShell.tsx)
  - [SecurityStatusBadge.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/ui/SecurityStatusBadge.tsx)
  - [SecurityStatusInline.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/ui/SecurityStatusInline.tsx)
  - [WizardStepper.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/ui/WizardStepper.tsx)
  - [ChecklistPanel.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/ui/ChecklistPanel.tsx)
- 如果新页面需要“IM机器人式”的暖灰金卡片、按钮、步骤条、提示侧栏，应先扩展这些基础件，再改业务页。
- 共享基础件应优先吃系统 token，而不是写死 hex；本轮已把按钮、卡片、面板、标签的主配色切到统一 token。
- 设置类选项卡如果本质是“单选/多选的大卡片”，应优先让 [SettingsChoiceCard.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/settings/ui/SettingsChoiceCard.tsx) 复用 [SelectionCard.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/ui/SelectionCard.tsx) 的选中语义，而不是单独再做一套高亮边框。
- 设置页中的内容卡如果只是信息/表单分区，应优先让 [SettingsCard.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/settings/ui/SettingsCard.tsx) 复用 [DrawerSection.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/ui/DrawerSection.tsx)。

## 页面模式规范

- 状态摘要项必须优先使用 [SummaryMetricItem.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/ui/SummaryMetricItem.tsx)。
  - 适用场景：顶部摘要条、轻量 KPI 行、单行状态概览。
- 信息摘要小卡必须优先使用 [InfoTile.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/ui/InfoTile.tsx)。
  - 适用场景：详情抽屉中的平台摘要、最近测试块、模板预览块、测试消息/回复块、轻量审计信息块。
- 空状态卡片必须优先使用 [EmptyStatePanel.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/ui/EmptyStatePanel.tsx)。
  - 适用场景：列表为空、平台未接入、侧栏空审计/空待办。
- 选中卡片态必须优先使用 [SelectionCard.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/ui/SelectionCard.tsx)。
  - 适用场景：单选助手卡、绑定范围卡、当前状态块、未来的套餐/模板单选器。
- 侧边抽屉中的 section 容器必须优先使用 [DrawerSection.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/ui/DrawerSection.tsx)。
  - 适用场景：详情抽屉、设置抽屉、配置面板里的分区块。
- 平台接入卡片外壳必须优先使用 [PlatformCardShell.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/ui/PlatformCardShell.tsx)。
  - 适用场景：飞书/钉钉/企微/QQ 接入卡、未来新增渠道卡、连接入口卡。
- 安全状态徽标必须优先使用 [SecurityStatusBadge.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/ui/SecurityStatusBadge.tsx)。
  - 适用场景：header 顶栏安全状态、详情页轻量防护状态、模块开关后的全局保护提示。
- 纯文本型安全状态行必须优先使用 [SecurityStatusInline.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/ui/SecurityStatusInline.tsx)。
  - 适用场景：header 右侧状态说明、额度/订阅前的轻量防护提示、无需胶囊外壳的安全文案。

这些模式的目标不是“复用 JSX 片段”，而是强制收口页面结构和视觉语义。后续如果要改暖金选中态、空状态层次、平台卡外壳或抽屉 section 结构，应该优先改共享组件，而不是回到业务页里批量搜 className。

## 任务页空状态规范

任务页的空状态不应被设计成“还没有内容”的通用列表页，而应明确表达 `P2K2C` 的产品路径：

- `Platform -> KOL -> Consumer`
- 平台先服务 `KOL`，帮助其组织任务、沉淀方法、形成可复用的服务能力。
- `KOL` 再把这些能力交付给粉丝和终端用户，而不是平台直接面向所有消费者做统一服务。

因此，任务页空状态的产品语义应统一为“`KOL` 的任务运营起点”，不是“暂无数据”。

### 定位原则

- 首屏要让用户理解，这里是管理和沉淀任务能力的地方，不是一个孤立的历史列表。
- 空状态首先服务 `KOL`，强调“先创建、先验证、先沉淀”，再强调后续如何服务粉丝。
- 文案要体现经营感、交付感、可复用感，避免“空空如也”“你还没有任何内容”这种纯工具型表达。
- 不把任务页描述成单纯的 AI 聊天入口，而要描述成任务资产和服务能力的承载位。

### 信息层级

- 第一层：说明这里是什么。
  - 建议语义：任务中心、任务运营台、专家任务工作台。
- 第二层：说明为什么现在值得开始。
  - 建议语义：先把一个可复用任务跑通，再逐步扩展为面向粉丝的服务。
- 第三层：给出清晰的第一步动作。
  - 默认应只有一个主动作，例如“发起第一个任务”或“创建第一个专家任务”。
- 第四层：补充下游价值。
  - 用一句话交代任务完成后，可以沉淀为方法、模版、服务流或面向粉丝的交付能力。

### 文案口径

- 优先强调“为粉丝提供服务前，先完成自己的任务验证”。
- 优先强调“沉淀可复用能力”，不要只强调“生成一次结果”。
- 可以出现 `KOL`、粉丝、用户服务这些业务词，但不要把界面写成招商页或品牌宣传页。
- 默认避免使用“暂无任务记录”作为唯一标题；它只能做辅助描述，不能做核心表达。

### 视觉与交互约束

- 任务页空状态仍应优先基于 [EmptyStatePanel.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/ui/EmptyStatePanel.tsx) 收口，不单独再造一套空状态组件。
- 主视觉重点应放在“任务能力流转”，而不是装饰性插画。
- 若需要补充结构化提示，优先使用 3 段轻量信息表达链路：`平台能力`、`KOL 执行`、`粉丝交付`。
- CTA 不宜过多；空状态默认 1 个主按钮 + 1 个弱提示即可，不做复杂按钮矩阵。
- 语气保持专业、克制、面向执行，不做喊口号式增长文案。

### 推荐文案示例

- 标题示例：开始沉淀你的第一个专家任务
- 描述示例：先把一个高质量任务跑通，验证方法、沉淀流程，再逐步交付给粉丝和终端用户。
- 主按钮示例：发起第一个任务
- 辅助说明示例：任务完成后，可继续围绕结果复盘、复用和扩展服务场景。

## 卡片与列表规范

- 可整卡点击时优先使用 [PressableCard.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/ui/PressableCard.tsx) 的 `interactive` 模式。
- 平台接入卡片、列表卡片、选项卡、筛选块都应共享同一套弹簧曲线，不单独写一套 transition。
- 如果卡片内部已经有主按钮，整卡点击和按钮点击语义要一致，避免一个卡片里出现两个冲突动作。
- Header 胶囊入口、tabs、整卡选择器、充值卡、协议链接这类“用户认知上就是能点的区域”，都必须带小手。
- “智能投资专家”及类似业务视图区中的 tab、策略卡、分类卡、结果卡，只要 hover 可切换或可进入详情，一律必须带小手。
- 右侧视图区中的摘要卡、能力卡、市场卡、专家卡，如果点击后会切换上下文、打开抽屉、进入详情、触发选择态，也必须带小手；不要出现“卡片能点但光标还是箭头”的情况。
- 左侧菜单、二级菜单、菜单分组中的可点击项必须统一带小手；只有纯标题和纯分隔标签可以保留箭头。
- 充值中心的套餐卡必须遵循同一条路径：
  - 点击未选中的套餐卡：切换选中态。
  - 点击已选中的付费套餐卡：直接进入支付页。
  - 点击卡片内主 CTA：直接进入支付页。
  - 推荐态只允许作为角标提示，不能和选中态共用边框、阴影、按钮高亮。

## 裸按钮使用规则

只有这两类情况允许不用 `Button`：

- 纯图标关闭按钮、分段切换 tab。
- 需要做“选中卡片”式单选器，而不是传统按钮。

这时也必须显式带上：

- `SPRING_PRESSABLE`
- `INTERACTIVE_FOCUS_RING`

## 当前落地范围

这套规范已经用于以下实现：

- [IMBotsView.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/im-bots/IMBotsView.tsx)
- [IMBotSetupModal.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/im-bots/IMBotSetupModal.tsx)
- [SkillStoreImportSheet.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/skill-store/SkillStoreImportSheet.tsx)
- [SkillStoreAdminSheet.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/skill-store/SkillStoreAdminSheet.tsx)
- [SkillStoreDetailSheet.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/skill-store/SkillStoreDetailSheet.tsx)
- [SettingsPanel.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/settings/SettingsPanel.tsx)
- [SettingsCard.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/settings/ui/SettingsCard.tsx)
- [SettingsChoiceCard.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/settings/ui/SettingsChoiceCard.tsx)
- [AccountPanel.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/account/AccountPanel.tsx)
- [AuthPanel.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/AuthPanel.tsx)
- [FirstRunSetupPanel.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/FirstRunSetupPanel.tsx)
- [DesktopUpdateCard.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/DesktopUpdateCard.tsx)
- [Button.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/ui/Button.tsx)
- [PressableCard.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/ui/PressableCard.tsx)
- [Chip.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/ui/Chip.tsx)
- [SegmentedTabs.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/ui/SegmentedTabs.tsx)
- [FilterPill.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/ui/FilterPill.tsx)
- [CompactSegmentedControl.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/ui/CompactSegmentedControl.tsx)
- [StatCard.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/ui/StatCard.tsx)
- [SummaryMetricItem.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/ui/SummaryMetricItem.tsx)
- [InfoTile.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/ui/InfoTile.tsx)
- [EmptyStatePanel.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/ui/EmptyStatePanel.tsx)
- [SelectionCard.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/ui/SelectionCard.tsx)
- [DrawerSection.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/ui/DrawerSection.tsx)
- [PlatformCardShell.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/ui/PlatformCardShell.tsx)
