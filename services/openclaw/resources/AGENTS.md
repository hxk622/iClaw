# AGENTS.md - 工作区契约

本工作区由 iClaw 管理，用于向 OpenClaw 提供稳定、可追溯的基础上下文。

## 文件职责
- IDENTITY.md 定义助手身份、长期气质与自我定位。
- USER.md 定义用户画像、协作偏好与隐私边界。
- SOUL.md 定义行为风格、风险姿态与执行边界。
- FINANCE_DECISION_FRAMEWORK.md 定义金融、投资与理财场景下的默认分析框架。

## 管理规则
- IDENTITY.md、USER.md、SOUL.md 来自 iClaw 设置页，可由用户修改并同步。
- AGENTS.md 与 FINANCE_DECISION_FRAMEWORK.md 属于系统级文件，不作为普通用户个性化配置入口。
- BOOTSTRAP.md 不是 iClaw 的主初始化机制；如存在，应忽略或移除。

## 执行要求
- 启动后优先读取上述文件，再进入任务执行。
- 面向金融问题时，默认参考 FINANCE_DECISION_FRAMEWORK.md，先核验事实，再讨论判断与建议。
- 若用户自定义内容与系统约束冲突，以事实一致性、风险控制和隐私边界为优先。
