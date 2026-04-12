# Docs Organization Standard

更新时间：2026-04-12

## 目标

保证 `docs/` 目录长期可维护，避免文档重新堆回根目录。

## 总原则

1. `docs/` 根目录只保留总索引 `README.md`
2. 新文档必须进入明确主题子目录
3. 每个主题子目录必须维护自己的 `README.md`
4. 新文档优先复用现有命名后缀，不临时发明风格

## 目录归类规则

### `architecture/`

适用：

- 系统架构
- 模块边界
- 数据流
- 生命周期设计
- 运行时链路

命名建议：

- `*-architecture.md`
- `*-concepts.md`

### `design/`

适用：

- 产品设计
- 视觉设计
- 交互设计
- Figma 对应关系

命名建议：

- `*-design.md`
- `*-guidelines.md`
- `*-spec.md`

### `plans/`

适用：

- 实施计划
- 分阶段落地方案
- rollout plan

命名建议：

- `*-implementation-plan.md`
- `*-plan.md`

### `standards/`

适用：

- 规范
- 标准
- 统一约束

命名建议：

- `*-standard.md`

### `release/`

适用：

- 发版规范
- 发布 SOP
- release checklist
- 版本模板

命名建议：

- `release-*.md`
- `*-sop.md`
- `*-template.md`

### `reference/`

适用：

- API 合约
- 决策记录
- 通用参考资料

命名建议：

- `api-*.md`
- `DECISIONS.md`

### `ops/`

适用：

- 运维
- CI/CD
- 基础设施
- 部署配置

### `archive/`

适用：

- 临时保留
- 未分类
- 待后续清理

要求：

- 不应作为长期存放目录

## 命名规则

统一采用：

- 小写英文
- 单词间使用 `-`
- 后缀表达文档属性

推荐示例：

- `desktop-startup-orchestrator-architecture.md`
- `client-metrics-monitoring-architecture.md`
- `admin-web-interaction-standard.md`
- `native-agent-store-implementation-plan.md`

避免：

- 混合风格命名
- 无语义的 `new-doc.md`
- 临时命名长期保留在主题目录

## 链接规则

1. 优先使用仓库内相对路径
2. 避免硬编码本机绝对路径
3. 目录移动后，必须同步修正交叉引用

## 新文档流程

1. 先判断主题目录
2. 按既有后缀命名
3. 将文档加入对应子目录 `README.md`
4. 如属于高频入口，再加入 `docs/README.md`

## 历史兼容说明

当前保留以下历史目录命名，不主动重命名以减少引用扰动：

- `version_record/`

后续如需重命名，应单独做一次引用迁移。

## 自动检查

仓库提供：

- `pnpm docs:check`

用于检查：

- `docs/` 根目录是否出现新的散文件
- 主题目录是否缺少 `README.md`
- 文档中是否残留本机绝对路径链接
