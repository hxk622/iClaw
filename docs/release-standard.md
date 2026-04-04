# iClaw 上线规范

更新时间：2026-04-05

## 1. 目标

本规范用于约束 `prod` 上线流程，解决以下问题：

- 同一次上线没有统一基线，代码、数据库、对象存储各发各的
- 线上变更无法追溯到唯一 `git tag` / `commit`
- 手工 SQL、手工传文件、手工改配置混在一起，后续无法审计和回滚
- 团队变大后，发布责任、发布范围、验证口径不一致

上线必须满足两个核心原则：

- 每次上线只认一个不可变基线：`git tag + commit SHA`
- 每次上线必须有一张结构化发布单，记录代码、数据库、对象存储、配置、验证和回滚

## 2. 发布对象

每次上线必须显式声明本次影响了哪些对象。发布对象分 5 类：

1. `Code`
   - `services/control-plane`
   - `admin-web`
   - `home-web`
   - `apps/desktop`
   - 其他服务或脚本
2. `DB Schema`
   - SQL migration
   - 索引
   - 约束
   - 表结构变更
3. `DB Data`
   - preset 同步
   - 品牌配置
   - 模型中心配置
   - 初始化数据
   - 数据修复脚本
4. `Object Storage`
   - MinIO / S3 bucket
   - OEM 资源
   - runtime 资源
   - desktop 安装包 / updater / manifest
5. `Infra Config`
   - `.env`
   - Nginx
   - PM2
   - Redis key prefix
   - 域名 / 证书 / 访问路径

发布单必须明确写出：

- 这次修改了哪些对象
- 哪些对象明确没有改动

## 3. 发布基线

每次上线必须先冻结发布基线，再执行任何发布动作。

发布基线字段：

- `version_no`
  - 例：`0001`
- `release_id`
  - 例：`release-2026-04-04-01`
- `environment`
  - 固定写 `prod`
- `git_tag`
  - 例：`v2026.04.04-rc1`
- `git_commit`
  - 例：`d19b7d3`
- `rollback_tag`
  - 上一个稳定版本
- `owner`
  - 实际执行人
- `reviewer`
  - 复核人
- `window`
  - 计划上线时间窗

并且发布产物必须同时生成并携带 `build-info.json`，至少包含：

- `git_commit`
- `git_tag`
- `release_version`
- `build_time`

硬规则：

- 未冻结 `tag/commit`，禁止上线
- 不允许“服务 A 用这个 commit，服务 B 用另一个 commit”
- 不允许先上线，事后补写发布单

桌面下载页补充规则：

- `package.json` 中的应用真实版本可以保留 SemVer build metadata，例如 `1.0.1+202604021919`
- 但下载页、公开安装包文件名、对外发布文档一律使用四段点号版本：`<baseVersion>.<timestamp>`
- 这个 `<timestamp>` 必须使用本次实际发布产物对应的最新时间戳，不允许继续暴露旧的 build metadata 时间
- 如果同一次发布重新补打 DMG / EXE，下载页必须同步切到最新产物时间戳，不能只上传文件不改页面

## 4. 发布单格式

每次上线必须落一份文档到：

- `docs/version_record/<发布版本号>.md`

命名规则：

- 文件名使用对外发布版本号
- 格式为 `1.0.1.<timestamp>.md`
- `version_record` 目录内只放版本记录，不放其他文件

建议同时维护一份目录外模板：

- `docs/version-record-template.md`

每份发布单至少包含：

1. 发布基线
2. 变更摘要
3. 发布范围
4. 发布顺序
5. 执行命令
6. 风险点
7. 验证项
8. 回滚方案
9. 实际执行记录

## 5. 数据库规范

数据库发布必须拆成两类，不允许混写。

### 5.1 Schema Release

适用于：

- 新表
- 新字段
- 新索引
- 约束修改

要求：

- 必须有版本化 migration
- 必须说明是否幂等
- 必须说明是否允许回滚
- 默认采取前滚策略，不承诺对所有 schema 变更做即时回滚

### 5.2 Data Release

适用于：

- preset 同步
- 业务初始化数据
- 品牌配置修正
- 模型中心 / Memory / OEM runtime 数据修正

要求：

- 必须写清作用表 / 作用对象
- 必须写清是否幂等
- 必须写清是否可逆
- 必须写进发布单，不允许只在终端里“手工跑一下”

## 6. 对象存储规范

所有 MinIO / S3 变更都必须进入发布单。

必须记录：

- bucket 名称
- 变更类型：新增 / 覆盖 / 删除
- 影响对象路径
- 是否保留上一版
- 对外访问 URL 是否变化

约束：

- 不允许覆盖后不可恢复
- 对下载站、runtime 资源、OEM 静态资源，必须保留上一版可回退对象
- 对 desktop 下载对象，如存在“历史兼容文件名”和“当前正式文件名”两套对象，必须在发布单中显式记录哪一套是当前下载页真值

## 7. 发布顺序

标准顺序如下：

1. 冻结基线
   - 选定 `commit`
   - 创建 `tag`
   - 生成发布单
2. 执行 `DB Schema`
3. 执行 `DB Data`
4. 发布后端
   - `control-plane`
   - 其他依赖数据库的新服务
5. 发布前端与静态站
   - `admin-web`
   - `home-web`
6. 发布对象存储内容
   - MinIO / S3 资源
   - desktop 安装包 / 更新清单
7. 执行 smoke test
8. 记录结果并关闭发布

原因：

- 数据结构必须先于代码
- 业务数据必须先于依赖它的运行时
- 前端必须在后端可用后再切流
- desktop 重新补包后，必须在对象存储上传完成后再次发布 `home-web`，确保下载页链接与当前产物一致

## 8. 验证规范

每次上线必须至少覆盖以下验证：

### 8.1 服务健康

- `control-plane /health`
- `admin-web` 首页可访问
- `home-web` 首页可访问
- `control-plane /health` 返回 `git_commit / git_tag / release_version / build_time`
- `admin-web/build-info.json` 可访问且字段完整
- `home-web/build-info.json` 可访问且字段完整

### 8.2 业务链路

- 登录 / 注册
- OEM runtime 拉取
- chat 发一条真实消息
- 计费 / usage / 余额变化
- 关键配置页面读取正常

### 8.3 资源链路

- OEM logo / avatar / 静态资源可访问
- desktop 下载页可访问
- 安装包链接不 404
- updater manifest 可读取

验证结果必须写回发布单，不允许只口头确认。

## 9. 回滚规范

回滚按对象分类执行：

### 9.1 Code

- 按 `rollback_tag` 回滚
- 回滚动作必须重新发布，不允许线上手改代码

### 9.2 DB Schema

- 默认前滚
- 如涉及危险变更，发布前必须单独写明回滚策略

### 9.3 DB Data

- 必须写清楚：
  - 可逆脚本
  - 反向 SQL
  - 或明确标记不可逆

### 9.4 Object Storage

- 保留上一版对象路径或备份
- 明确恢复方式

## 10. 团队纪律

以下行为视为违规发布：

- 没有 `tag/commit` 直接上线
- 线上手工改代码
- 线上手工改数据库但没有写进发布单
- 同一次上线使用多个不一致的基线
- 发布后没有验证记录
- 发布内容超出发布单范围

## 11. 当前仓库脚本映射

当前已存在的脚本，可作为发布动作的一部分：

- 后端发布
  - `bash scripts/deploy-control-plane.sh prod`
- 管理后台发布
  - `bash scripts/deploy-admin.sh prod`
- 官网 / 下载页发布
  - `bash scripts/deploy-home.sh prod`
- 数据库同步
  - `bash scripts/sync-control-plane-db-to-prod.sh`
- 对象存储同步
  - `bash scripts/sync-minio-to-prod.sh`
- desktop 发布
  - `pnpm publish:desktop-release`

注意：

- 这些脚本是“执行器”，不是发布规范本身
- 是否执行、执行顺序、影响范围，必须由发布单定义
- 发布前必须确认脚本覆盖范围和当前品牌适配是否正确

## 12. 推荐后续改造

建议后续继续补齐：

1. 增加统一入口命令
   - 例：`pnpm release:prod --tag <tag>`
2. 增加 release manifest 生成脚本
   - 自动收集本次影响的服务、脚本、SQL、静态资源
3. 增加 migration 目录和执行记录
4. 增加发布完成后的自动 smoke test

## 13. 关联文档

- [release-checklist.md](/Users/xingkaihan/Documents/Code/iClaw/docs/release-checklist.md)
- [release-matrix.md](/Users/xingkaihan/Documents/Code/iClaw/docs/release-matrix.md)
- [prod-infra-inventory.md](/Users/xingkaihan/Documents/Code/iClaw/docs/prod-infra-inventory.md)
- [version-record-template.md](/Users/xingkaihan/Documents/Code/iClaw/docs/version-record-template.md)
