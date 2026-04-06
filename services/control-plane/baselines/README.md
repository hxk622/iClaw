# Control-plane DB Baselines

这里存的是 **数据库导出的平台/OEM baseline 快照**，不是运行时真值。

## 原则

- 真值在数据库：
  - `cloud_skill_catalog`
  - `cloud_mcp_catalog`
  - `oem_apps`
  - 以及相关 platform / OEM binding 表
- Git 里的 baseline 文件只做：
  - 变更留档
  - 发版前后 diff
  - 人工 review
  - 漂移检查

## Commands

导出当前数据库 baseline：

```bash
pnpm baseline:export
```

检查当前数据库是否与仓库快照一致：

```bash
pnpm baseline:doctor
```

## 当前策略

- `services/control-plane/presets/core-oem.json` 已降级为 legacy seed / repair 素材
- 新的日常维护策略应是：
  1. 先改数据库
  2. 再导出 baseline 到 git
  3. 最后把 diff 纳入 code review / version record
