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
- 弹簧反馈包含 3 个动作：`hover` 轻微上浮、`active` 回弹并轻微缩放、颜色和阴影平滑过渡。
- 禁用态必须移除位移和缩放反馈，避免“看起来还能点”。

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
  - [WizardStepper.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/ui/WizardStepper.tsx)
  - [ChecklistPanel.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/ui/ChecklistPanel.tsx)
- 如果新页面需要“IM机器人式”的暖灰金卡片、按钮、步骤条、提示侧栏，应先扩展这些基础件，再改业务页。
- 共享基础件应优先吃系统 token，而不是写死 hex；本轮已把按钮、卡片、面板、标签的主配色切到统一 token。

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

这些模式的目标不是“复用 JSX 片段”，而是强制收口页面结构和视觉语义。后续如果要改暖金选中态、空状态层次、平台卡外壳或抽屉 section 结构，应该优先改共享组件，而不是回到业务页里批量搜 className。

## 卡片与列表规范

- 可整卡点击时优先使用 [PressableCard.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/ui/PressableCard.tsx) 的 `interactive` 模式。
- 平台接入卡片、列表卡片、选项卡、筛选块都应共享同一套弹簧曲线，不单独写一套 transition。
- 如果卡片内部已经有主按钮，整卡点击和按钮点击语义要一致，避免一个卡片里出现两个冲突动作。

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
