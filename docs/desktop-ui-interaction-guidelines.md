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
- 视觉上采用轻边框、浅高光、低厚度阴影，保持平整、干净、接近苹果扁平语义。

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
