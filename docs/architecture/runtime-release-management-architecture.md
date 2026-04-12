# Runtime 包版本管理架构

更新时间：2026-04-04

## 1. 背景

当前 OpenClaw runtime 包已经发布到 S3，但“哪个 OEM / channel / 平台 当前实际使用哪个 runtime 包”还没有进入统一管理面。

现状问题：

- runtime 包本体在 S3，但当前生效版本主要靠脚本和静态 bootstrap config 推断
- 运维无法快速回答“`iclaw prod macOS arm64` 当前到底跑哪个 runtime 包”
- 回滚依赖手工改文件或重发包，不是切绑定
- runtime 包和 desktop installer/update manifest 已经各有一套逻辑，缺少统一追溯关系

## 2. 目标

形成一套单轨 runtime 管理架构：

1. S3 只负责存 runtime 包本体
2. PostgreSQL 负责存 runtime release 元数据和当前绑定真值
3. control-plane 负责解析“当前 app/channel/platform/arch 生效哪个 runtime”
4. admin-web 负责配置、切换、回滚、审计
5. 桌面端和打包脚本只消费 control-plane 下发的 resolved runtime manifest

## 3. 非目标

- 本阶段不改 OpenClaw kernel
- 本阶段不做灰度百分比分流
- 本阶段不把 runtime 包本体搬离 S3
- 本阶段不替换现有 desktop release 机制；desktop installer/updater 与 runtime release 分开管理

## 4. 核心原则

### 4.1 包和绑定分离

必须区分两类事实：

- `runtime release`
  - 某一个具体构建产物是什么
- `runtime binding`
  - 当前谁在用哪个 release

只有这样才能做到：

- 同一个包可被多个 OEM 复用
- 回滚时只切绑定，不重传包
- 运维排障时能同时看到“包事实”和“生效事实”

### 4.2 S3 不是真值源

S3 只保存文件，不表达“当前生效的是谁”。

真值源必须在 DB：

- release 元数据
- 平台默认 binding
- OEM override binding
- binding 变更历史

### 4.3 不覆盖对象，只切绑定

runtime 对象路径必须版本化、不可覆盖：

- `runtime/openclaw/1.2.3/aarch64-apple-darwin/openclaw-runtime.tar.gz`
- `runtime/openclaw/1.2.3/x86_64-pc-windows-msvc/openclaw-runtime.zip`

新版本发布：

- 只新增对象
- 不覆盖旧对象

版本切换：

- 只更新 DB binding

### 4.4 平台默认 + OEM fallback

runtime 采用和模型 provider 类似的两层结构，但粒度是 release binding：

- 平台层配置默认 runtime binding
- OEM 层可选择绑定自己的 runtime
- 解析顺序：`OEM binding -> platform binding -> error`

不允许隐式猜测。

## 5. 总体模型

### 5.1 Release Catalog

`runtime_release_catalog` 存储一个具体 runtime 包的事实。

一条记录对应：

- 一个 `runtime_kind`
- 一个 `version`
- 一个 `channel`
- 一个 `platform`
- 一个 `arch`
- 一个 `artifact_url`
- 一组 build metadata

### 5.2 Binding

`runtime_release_bindings` 存储“当前生效关系”。

同一时刻，对某个：

- `scope_type`
- `scope_key`
- `runtime_kind`
- `channel`
- `platform`
- `arch`

只能有一条 enabled binding。

### 5.3 History

`runtime_release_binding_history` 记录每次切换：

- 从哪个 release 切到哪个 release
- 谁操作的
- 为什么切
- 何时切

## 6. 数据模型

### 6.1 表一：`runtime_release_catalog`

用途：

- 记录 runtime 构建产物事实

建议字段：

- `id uuid primary key`
- `runtime_kind text not null`
  - 例如 `openclaw`
- `version text not null`
- `channel text not null`
  - 例如 `dev` / `prod`
- `platform text not null`
  - 例如 `darwin` / `windows` / `linux`
- `arch text not null`
  - 例如 `aarch64` / `x64`
- `target_triple text not null`
- `artifact_type text not null default 'tar.gz'`
- `storage_provider text not null default 's3'`
- `bucket_name text`
- `object_key text`
- `artifact_url text not null`
- `artifact_sha256 text`
- `artifact_size_bytes bigint`
- `launcher_relative_path text`
- `git_commit text`
- `git_tag text`
- `release_version text`
- `build_time timestamptz`
- `build_info_json jsonb not null default '{}'::jsonb`
- `metadata_json jsonb not null default '{}'::jsonb`
- `status text not null default 'draft'`
  - `draft | published | deprecated | archived`
- `created_by uuid references users(id) on delete set null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `published_at timestamptz`

约束建议：

- `unique (runtime_kind, channel, target_triple, version)`
- `unique (artifact_url)`

说明：

- `channel` 放在 release 上，是为了明确一个产物最初是按哪个发布通道生成/登记的
- `build_info_json` 直接存构建时产出的 `build-info.json`

### 6.2 表二：`runtime_release_bindings`

用途：

- 记录“当前谁用哪个 runtime 包”

建议字段：

- `id uuid primary key`
- `scope_type text not null`
  - `platform | app`
- `scope_key text not null`
  - `platform` 时固定为 `platform`
  - `app` 时为 `app_name`
- `runtime_kind text not null`
- `channel text not null`
- `platform text not null`
- `arch text not null`
- `target_triple text not null`
- `release_id uuid not null references runtime_release_catalog(id) on delete restrict`
- `enabled boolean not null default true`
- `metadata_json jsonb not null default '{}'::jsonb`
- `updated_by uuid references users(id) on delete set null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

约束建议：

- `unique (scope_type, scope_key, runtime_kind, channel, target_triple)`

说明：

- 这里只存“当前生效值”，不存切换过程
- `target_triple` 冗余存储，避免每次都从 `platform + arch` 推断

### 6.3 表三：`runtime_release_binding_history`

用途：

- 记录 binding 变更历史，支持审计和回滚

建议字段：

- `id uuid primary key`
- `binding_id uuid not null references runtime_release_bindings(id) on delete cascade`
- `scope_type text not null`
- `scope_key text not null`
- `runtime_kind text not null`
- `channel text not null`
- `platform text not null`
- `arch text not null`
- `target_triple text not null`
- `from_release_id uuid references runtime_release_catalog(id) on delete set null`
- `to_release_id uuid references runtime_release_catalog(id) on delete set null`
- `change_reason text`
- `operator_user_id uuid references users(id) on delete set null`
- `metadata_json jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`

## 7. 运行时解析规则

control-plane 新增统一 resolve 语义：

输入：

- `app_name`
- `channel`
- `platform`
- `arch`
- `runtime_kind`，默认 `openclaw`

解析顺序：

1. 优先查 `scope_type = app` 且 `scope_key = app_name`
2. 如果没有，查 `scope_type = platform` 且 `scope_key = platform`
3. 如果仍没有，直接报错

输出至少包含：

- `resolved_scope`
- `release_id`
- `version`
- `artifact_url`
- `artifact_sha256`
- `target_triple`
- `git_commit`
- `git_tag`
- `release_version`
- `build_time`

## 8. 与现有 desktop release 的关系

两者不是一回事：

- `desktop release`
  - 安装包 / updater / signature
- `runtime release`
  - OpenClaw runtime 本体

关系：

- desktop installer 中会携带一个 bundled runtime
- 但运行时真正的 runtime 版本切换，仍由 runtime binding 决定

推荐做法：

- desktop release 管“客户端壳”
- runtime release 管“OpenClaw runtime 包”
- 两者都返回 build metadata，但不强行混成一张表

## 9. 脚本和发布流改造

现有脚本保留，但职责收敛：

### 9.1 `build-openclaw-runtime.sh`

职责：

- 构建 runtime 包
- 生成产物
- 生成 `build-info.json`

不负责：

- 决定谁用这个包

### 9.2 `publish-openclaw-runtime.sh`

职责：

- 上传 runtime 包到 S3
- 根据产物信息登记 `runtime_release_catalog`

不负责：

- 直接改当前生效 binding

### 9.3 admin-web

新增 Runtime 管理页，最小能力：

- 查看 release 列表
- 查看 build metadata
- 登记/上传新的 runtime release
- 绑定到平台默认
- 绑定到某个 OEM
- 回滚到历史 release
- 查看 binding history

## 10. 运维问题回答能力

这套架构上线后，系统应能直接回答：

- `iclaw prod darwin aarch64` 当前使用哪个 runtime release
- 对应哪个 S3 object
- 对应哪个 `git commit`
- 何时生效
- 谁切的
- 上一个版本是什么
- 如何一键回滚

## 11. 分阶段实施

### Phase 1

- 建表
- control-plane 定义领域模型
- admin-web 先做只读列表和当前绑定展示

### Phase 2

- 上传/登记 runtime release
- 平台/OEM binding 切换
- binding history 审计

### Phase 3

- 打包脚本和桌面端 bootstrap 统一改成只认 control-plane resolved runtime
- 发布单与 `/health` 统一带 runtime release metadata

