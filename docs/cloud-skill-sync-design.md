# Admin Web 云技能同步设计

> 注：本文中的旧名 `oem_skill_catalog` / `oem_app_skill_bindings` 已在当前开发实现中收敛为 `platform_bundled_skills` / `oem_bundled_skills`。`cloud skill` 仍是唯一总库，platform / OEM 层都只保存 bundled binding，不再拥有 skill 主数据。

## 目标

在 `admin-web` 增加一个“技能同步中心”，支持：

- 从 `ClawHub` 同步公开 skill。
- 从若干个白名单 `GitHub` 仓库 / 组织同步 skill，例如 Claude Code skill 相关仓库。
- 将同步结果先进入“候选池”审核，而不是直接上线。
- 审核通过后写入公共 `cloud skill` 目录。
- 选择性地把公共 `cloud skill` 再映射到 portal 的 `oem_skill_catalog`，用于前台技能陈列。

这个方案的核心不是“多接几个抓取脚本”，而是补齐一条完整的运营链路：

`来源抓取 -> 归一化 -> 去重/风控 -> 人工审核 -> 公共 cloud catalog -> portal 陈列`

## 现状

仓库里已经有两套相关能力，但现在是割裂的：

### 1. 公共 cloud skill 目录

- 表：`cloud_skill_catalog`
- 版本表：`skill_releases`
- 接口：
  - `GET /skills/catalog`
  - `GET /admin/skills/catalog`
  - `PUT /admin/skills/catalog`
  - `DELETE /admin/skills/catalog`
- 现有脚本：`services/control-plane/scripts/sync-clawhub-top-skills.ts`

这套更像“真实可安装的 cloud 技能目录”。

### 2. portal 展示目录

- 表：`oem_skill_catalog`
- 接口：
  - `GET /admin/portal/catalog/skills`
  - `PUT /admin/portal/catalog/skills/:slug`
  - `DELETE /admin/portal/catalog/skills/:slug`
- `admin-web` 当前编辑的是这套，而不是公共 `cloud skill` 目录。

这套更像“品牌/门户陈列层”，不负责真正的来源同步、版本管理和公开 catalog 治理。

## 设计原则

- 不改 OpenClaw kernel，只补 wrapper / control-plane / admin-web。
- 同步源与展示层解耦。
- GitHub 来源默认进入审核态，不直接自动发布。
- `cloud skill` 是主目录，portal 陈列是下游投放。
- 任何同步结果都保留来源元数据、发布时间、版本、抓取时间和去重证据。

## 总体架构

### 一层：来源同步层

新增一套同步域模型：

- `skill_sync_sources`
- `skill_sync_runs`
- `skill_sync_candidates`

职责：

- 管理可用来源。
- 记录每次抓取执行。
- 存储还未发布的候选 skill。

### 二层：公共目录层

继续使用现有：

- `cloud_skill_catalog`
- `skill_releases`

职责：

- 作为最终“cloud skill”目录。
- 只存审核通过、可分发的技能。

### 三层：portal 陈列层

继续使用现有：

- `oem_skill_catalog`
- `oem_app_skill_bindings`

职责：

- 控制哪些 cloud skill 在品牌前台展示。
- 允许不同 app 做不同的陈列排序、启用状态和文案微调。

## 数据模型

### skill_sync_sources

建议字段：

- `id`
- `source_type`
  - `clawhub`
  - `github_repo`
  - `github_org`
- `source_key`
  - 例如 `clawhub:top`
  - `github:anthropics/claude-code-skills`
- `display_name`
- `base_url`
- `config_json`
- `active`
- `default_publish_mode`
  - `candidate_only`
  - `candidate_and_portal_draft`
- `created_at`
- `updated_at`

`config_json` 典型内容：

- `clawhub`
  - 排序规则
  - limit
  - blocklist
- `github`
  - owner / repo / branch
  - path globs
  - release asset 优先级
  - 是否允许 archive 打包
  - 白名单 slug 前缀

### skill_sync_runs

建议字段：

- `id`
- `source_id`
- `triggered_by`
- `trigger_mode`
  - `manual`
  - `scheduled`
- `status`
  - `running`
  - `succeeded`
  - `partial_failed`
  - `failed`
- `summary_json`
- `started_at`
- `finished_at`

### skill_sync_candidates

建议字段：

- `id`
- `source_id`
- `run_id`
- `source_skill_id`
- `source_url`
- `source_version`
- `slug`
- `name`
- `description`
- `publisher`
- `category`
- `market`
- `skill_type`
- `tags_json`
- `artifact_format`
- `artifact_url`
- `artifact_sha256`
- `artifact_source_path`
- `metadata_json`
- `dedupe_status`
  - `new`
  - `same_as_cloud`
  - `same_as_portal`
  - `conflict_slug`
  - `conflict_name`
- `review_status`
  - `pending`
  - `approved`
  - `rejected`
  - `published`
- `review_note`
- `published_skill_slug`
- `published_portal_slug`
- `created_at`
- `updated_at`

`metadata_json` 建议保留：

- 来源平台信息
- repo / owner / branch / commit
- README / `SKILL.md` 路径
- release tag
- stars / downloads / installs
- moderation 结果
- 原始 frontmatter

## GitHub 来源规则

GitHub 不应该按“任意 repo”开放，而应该是“平台白名单 + 路径约束”。

### 支持的来源类型

#### 1. 单仓库模式

适合：

- `owner/repo` 明确
- skill 放在固定目录，比如 `skills/*/SKILL.md`

抓取规则：

- 扫描配置目录下的 `SKILL.md`
- 解析 frontmatter
- 尝试定位打包来源：
  - 优先 release asset
  - 次选 repo archive + path
  - 再次选 raw source path

#### 2. 组织聚合模式

适合：

- 同一个组织下有多个 skill 仓库
- 例如若干 Claude Code skill 官方相关 repo

抓取规则：

- 先读取配置中的 repo allowlist
- 每个 repo 再按单仓库模式处理

### GitHub skill 识别标准

候选 repo 或目录至少满足以下之一：

- 包含 `SKILL.md`
- 包含 skill frontmatter
- 目录结构符合 `skills/<slug>/SKILL.md`
- 配套存在 `README.md` / `package.json` / `openclaw.plugin.json` / 打包文件

### GitHub 风险约束

- 仅同步白名单 repo。
- 默认不允许用户在 admin-web 临时输入任意 GitHub URL 直接上线。
- 若没有稳定 artifact，仅进入候选池，不允许直接进入 public catalog。
- 若缺少版本信息，自动生成 `0.0.0+git.<short_sha>` 作为候选版本，但发布前需要人工确认。

## 同步流程

### A. 来源同步

管理员在 `admin-web` 选择来源并执行“立即同步”：

1. 创建 `skill_sync_runs`
2. 调用对应 source adapter
3. 拉取原始 skill 列表
4. 归一化为统一 candidate 结构
5. 执行去重 / 风控 / 合规校验
6. 写入 `skill_sync_candidates`

### B. 候选审核

管理员在候选池处理每个 skill：

- 查看来源详情
- 查看版本、artifact、slug、描述、标签
- 查看与已有 cloud / portal skill 的相似度和冲突
- 选择：
  - 忽略
  - 合并到现有 slug
  - 作为新 skill 发布
  - 直接发布并同步到 portal

### C. 发布到公共 cloud skill

发布动作执行：

1. `upsert cloud_skill_catalog`
2. `upsert skill_releases`
3. 回写 candidate 的 `published_skill_slug`
4. `review_status = published`

### D. 投放到 portal 陈列

如果管理员勾选“加入 cloud skill 陈列”：

1. 从公共 catalog 读取已发布 skill
2. 映射到 `oem_skill_catalog`
3. 在 metadata 中写入：
   - `upstreamSlug`
   - `sourceType`
   - `sourceId`
   - `syncCandidateId`
4. 可选自动绑定到指定 app，例如 `home-web`

## 去重与冲突策略

### 去重优先级

1. `slug` 完全一致
2. `source_url` 完全一致
3. `name` 归一化一致
4. `artifact_url` 一致
5. `publisher + name` 高相似

### 冲突处理

#### 场景 1：已经存在同 slug cloud skill

- 默认进入“更新现有 skill”流程
- 如果版本更新，则新增 release
- 如果描述 / 发布者变化过大，标为人工审核

#### 场景 2：portal 已有同 slug 但公共 catalog 没有

- 标记为“portal only”
- 建议先补齐公共 catalog，再决定是否覆盖 portal 记录

#### 场景 3：同名不同 slug

- 标记 `conflict_name`
- 需要人工决定：
  - 合并
  - 重命名
  - 拒绝

## Admin Web 交互设计

在现有 `技能与 MCP` 页面里增加一个新的二级工作区：`来源同步`。

### 左侧：同步来源列表

每个来源显示：

- 名称
- 类型
- 最近同步时间
- 最近结果
- 候选数

操作：

- 立即同步
- 编辑来源
- 启停来源

### 中间：候选池

默认字段：

- 名称
- slug
- 来源
- 版本
- 去重状态
- 审核状态
- 最近同步时间

筛选：

- 来源
- `pending / conflict / approved / published / rejected`
- `new / duplicate / conflict`

### 右侧：候选详情

详情区块：

- 基本信息
- 来源信息
- artifact 信息
- frontmatter / metadata
- 与现有 cloud skill 的 diff
- 与 portal skill 的 diff

操作按钮：

- 批准并发布到 cloud
- 批准并发布到 cloud + portal
- 合并到现有 skill
- 驳回

## API 设计

### 来源管理

- `GET /admin/skill-sync/sources`
- `PUT /admin/skill-sync/sources/:id`
- `POST /admin/skill-sync/sources/:id/run`

### 运行记录

- `GET /admin/skill-sync/runs`
- `GET /admin/skill-sync/runs/:id`

### 候选池

- `GET /admin/skill-sync/candidates`
- `GET /admin/skill-sync/candidates/:id`
- `POST /admin/skill-sync/candidates/:id/approve`
- `POST /admin/skill-sync/candidates/:id/reject`
- `POST /admin/skill-sync/candidates/:id/publish`

### 发布动作

`POST /admin/skill-sync/candidates/:id/publish`

请求体建议：

```json
{
  "target_slug": "claude-code-docs",
  "publish_to_cloud": true,
  "publish_to_portal": true,
  "portal_apps": ["home-web"],
  "merge_mode": "upsert"
}
```

### 复用现有接口

发布内部不要重新发明 catalog 写入逻辑，建议复用：

- `ControlPlaneService.upsertAdminSkillCatalogEntry`
- `PortalService.upsertSkill`

这样 admin-web 只是多了一层“来源同步与审核”，不需要拆掉现有 catalog 能力。

## 后端实现建议

### 1. 新建 source adapter 层

目录建议：

- `services/control-plane/src/skill-sync/`
  - `domain.ts`
  - `service.ts`
  - `store.ts`
  - `adapters/clawhub.ts`
  - `adapters/github.ts`
  - `normalize.ts`
  - `dedupe.ts`

### 2. 把现有脚本改造成 adapter

`services/control-plane/scripts/sync-clawhub-top-skills.ts`

不要继续只做一次性脚本，建议抽出可复用逻辑：

- ClawHub list / detail fetch
- 分类推断
- tag 推断
- moderation 过滤
- artifact URL 构造

脚本层保留为 CLI 入口，实际逻辑下沉到 adapter。

### 3. GitHub adapter 能力

第一阶段只支持：

- GitHub REST API / raw 内容读取
- repo allowlist
- `SKILL.md` 解析
- release asset / archive URL 构造

先不做：

- 任意代码执行验证
- 深度依赖安装
- 自动 malware sandbox

## 发布策略

### 推荐策略

- `ClawHub`：
  - 支持批量同步
  - 可允许部分来源自动批准进入候选池
- `GitHub`：
  - 只进候选池
  - 需要人工审核后再发布

### portal 同步策略

不要自动把所有 cloud skill 都塞进 portal。

推荐两种模式：

- `publish_to_cloud_only`
- `publish_to_cloud_and_portal`

这样 portal 仍然保持 curated showcase，而不是变成原始镜像。

## 元数据约定

为了以后可追溯，发布到公共 catalog 或 portal 时都建议写入统一 metadata：

```json
{
  "sourceType": "github_repo",
  "sourceKey": "github:anthropics/claude-code-skills",
  "sourceUrl": "https://github.com/anthropics/claude-code-skills",
  "syncRunId": "run_xxx",
  "syncCandidateId": "cand_xxx",
  "upstreamVersion": "v1.2.3",
  "upstreamCommitSha": "abc123",
  "publishMode": "manual_review"
}
```

## 分阶段落地

### Phase 1

- 新增同步中心 UI
- 支持 ClawHub 来源注册
- 支持 GitHub 白名单 repo 来源注册
- 写入候选池
- 支持人工发布到 `cloud_skill_catalog`

### Phase 2

- 支持一键发布到 `oem_skill_catalog`
- 支持 app 绑定
- 支持批量批准 / 批量驳回

### Phase 3

- 定时同步
- 版本 diff
- 自动更新提示
- 更严格的 artifact 校验

## 为什么这样设计

因为当前系统已经天然分成两层：

- `cloud_skill_catalog` 解决“云技能从哪来、版本是什么、怎么安装”
- `oem_skill_catalog` 解决“哪些技能要被前台陈列”

如果直接把 GitHub / ClawHub 同步写进 `oem_skill_catalog`，短期看省事，长期会出现三个问题：

1. 没有版本治理。
2. 没有来源审计和复盘能力。
3. portal 陈列层会承担不该承担的分发职责。

所以正确的方向是：

- **先把来源同步做成候选池和公共 catalog 能力**
- **再把 portal 当成下游展示层**

这套方案和现有代码最兼容，返工最少。
