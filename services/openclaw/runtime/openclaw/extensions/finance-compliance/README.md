# Finance Compliance Plugin

`finance-compliance` 是面向 `理财客` 等金融 OEM 场景的 OpenClaw plugin 骨架。

当前阶段目标：

- 给 runtime 提供统一的金融合规插件挂载点
- 为后续输入分类、输出分类、审计打标和 envelope 注入预留模块边界
- 不修改 OpenClaw kernel 主回复链路

当前阶段不做：

- 强拦截
- 自动改写模型正文
- 替代 wrapper 做最终裁决

后续计划：

- `policy-registry`
- `input-classifier`
- `output-classifier`
- `compliance-transformer`
- `audit-recorder`

设计文档：

- `/docs/design/finance-compliance-technical-design.md`
- `/docs/architecture/finance-compliance-architecture.md`
- `/docs/plans/finance-compliance-phase1-implementation-plan.md`
