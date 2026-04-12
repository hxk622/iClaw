# Provider Fallback 模型架构设计

更新时间：2026-03-27

## 1. 背景

当前模型能力同时涉及：

- 平台默认模型供应层
- OEM 应用的独立模型供应层
- OpenClaw runtime 的 `models.providers`
- 前端输入框中的实时模型选择器

此前如果采用 `model-level override`，会带来几个问题：

- 同名模型在不同 provider 下容易冲突
- 平台层与 OEM 层 merge 规则复杂
- 运维排障时很难快速判断“当前到底走的是谁”
- 输入框模型列表和 runtime 生效集容易不一致

因此本设计将 override 粒度从 `model` 提升到 `provider layer`。

## 2. 目标

形成一套简单、稳定、可运营的两层模型供应架构：

1. 平台层维护默认 provider profile。
2. OEM 层可以选择继承平台层，或完整切换到自己的 provider profile。
3. 一旦 OEM 层配置了自己的 provider profile，就整套使用 OEM 层，不再和平台层做 model 级 merge。
4. 前端输入框只展示当前生效 provider layer 下的 model list。
5. admin-web 在一个模型管理页中同时维护平台层和各 OEM 层。
6. 前端模型列表支持实时获取，并可通过 Redis 做缓存。

## 3. 核心原则

### 3.1 Provider-Level Fallback

最终规则只有一句话：

`effective provider profile set = OEM providers if OEM configured, else platform providers`

这意味着：

- 平台层不是“可被局部覆盖的基类”
- OEM 层也不是“补丁层”
- 两者之间不存在 `model-level override`
- 两者之间只有 `provider-layer fallback`

### 3.2 单一生效层

对某个 OEM app，在任意时刻只允许一个生效层：

- 要么平台层生效
- 要么 OEM 层生效

不允许：

- 一半模型来自平台
- 一半模型来自 OEM

### 3.3 模型列表属于 runtime-bound

输入框里的模型列表不是纯展示数据，而是 runtime 可真正消费的模型集合。

因此它必须满足：

- 来源可追溯
- 与当前 provider profile 生效层一致
- 能下发到 OpenClaw runtime
- 能被前端快速读取

### 3.4 Redis 不是权威源

Redis 只做缓存，不做真值源。

权威来源仍然是：

- PostgreSQL 中的平台/OEM 模型配置

Redis 只缓存：

- `resolved model list`
- `provider layer version`
- `logo metadata`

## 4. 分层设计

### 4.1 平台层

平台层维护默认 provider profile，例如：

- 阿里云百炼

包含：

- `baseUrl`
- `api protocol`
- `apiKey`
- `model list`
- `logo preset`

### 4.2 OEM 层

每个 OEM app 有两种状态：

1. 未配置 OEM provider profile
   - 继承平台层
2. 已配置 OEM provider profile
   - 全量切到 OEM provider profile

例如：

- 平台层：阿里云百炼
- OEM1：未配置 provider
  - 生效层 = 平台层百炼
- OEM2：配置了硅基流动
  - 生效层 = OEM2 自己的硅基流动

## 5. 运行时生效规则

对任意 `app_name`：

1. 查询该 app 是否存在启用中的 OEM provider profile。
2. 如果存在：
   - 使用 OEM provider profile
   - 忽略平台层 provider profile
3. 如果不存在：
   - 使用平台层 provider profile
4. 基于生效 provider profile 生成 resolved model list。
5. 前端输入框展示 resolved model list。
6. OpenClaw runtime 消费同一份 resolved provider/model 配置。

## 6. 数据模型设计

本设计不再把“模型主数据”和“provider 配置”完全拆散，而是显式引入 `provider profile`。

### 6.1 表一：`model_provider_profiles`

用途：

- 保存平台层和 OEM 层的 provider profile

建议字段：

- `id uuid primary key`
- `scope_type text not null`
  - 取值：`platform` | `app`
- `scope_key text not null`
  - `platform` 固定为 `platform`
  - `app` 时为 `app_name`
- `provider_key text not null`
  - 例如 `bailian`、`siliconflow`
- `provider_label text not null`
  - 例如 `阿里云百炼`、`硅基流动`
- `api_protocol text not null`
  - 例如 `openai-completions`
- `base_url text not null`
- `auth_mode text not null default 'bearer'`
- `api_key text not null`
- `logo_preset_key text null`
  - 由管理员在 selector 中选择
- `metadata_json jsonb not null default '{}'::jsonb`
- `enabled boolean not null default true`
- `sort_order integer not null default 100`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

约束建议：

- `unique (scope_type, scope_key, provider_key)`

说明：

- 当前阶段建议每个 scope 只允许一套生效 provider profile
- 如果以后要支持多 provider，可保留扩展空间，但当前 UI 和运行时仍只消费一个生效集合

### 6.2 表二：`model_provider_profile_models`

用途：

- 保存某个 provider profile 下面的模型列表

建议字段：

- `id uuid primary key`
- `profile_id uuid not null references model_provider_profiles(id) on delete cascade`
- `model_ref text not null`
  - 建议格式：`provider_key/model_id`
- `model_id text not null`
- `label text not null`
- `logo_preset_key text null`
  - 默认可回退到 provider logo；也允许模型自定义 logo
- `reasoning boolean not null default false`
- `input_modalities jsonb not null default '[]'::jsonb`
- `context_window integer null`
- `max_tokens integer null`
- `enabled boolean not null default true`
- `sort_order integer not null default 100`
- `metadata_json jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

约束建议：

- `unique (profile_id, model_id)`
- `unique (profile_id, model_ref)`

### 6.3 表三：`model_logo_presets`

用途：

- 保存厂商 logo 选择器元数据

建议字段：

- `preset_key text primary key`
- `label text not null`
- `asset_url text not null`
- `asset_dark_url text null`
- `metadata_json jsonb not null default '{}'::jsonb`
- `active boolean not null default true`

说明：

- 你提供的各大厂商 logo 应进入这张表
- admin-web 里 provider/model 的 logo 都从这里选

### 6.4 表四：`app_model_runtime_overrides`

用途：

- 保存某个 OEM app 是否启用自有 provider layer

建议字段：

- `app_name text primary key`
- `provider_mode text not null default 'inherit_platform'`
  - `inherit_platform`
  - `use_app_profile`
- `active_profile_id uuid null references model_provider_profiles(id)`
- `cache_version bigint not null default 1`
- `updated_at timestamptz not null default now()`

说明：

- 这张表把“是否启用 OEM 自己的 provider layer”显式表达出来
- 它让运行时判断非常直接

## 7. API Key 存储决策

本轮设计直接采用：

- `apiKey` 可以落表
- 存在 `model_provider_profiles.api_key`

对应约束建议：

- admin-web 可以编辑和覆盖
- admin-web 不要求完整回显旧值
- 页面展示建议默认脱敏

这不是最强安全形态，但符合当前平台化阶段的工程优先级。

## 8. admin-web 设计

### 8.1 页面结构

模型管理页改为一个主 Tab，内部再分 `1 + N` 个子 Tab：

- `平台`
- `OEM A`
- `OEM B`
- `OEM C`

这里的 `N` 由品牌数决定。

### 8.2 每个 Tab 的内容

每个 Tab 下统一展示一个 provider profile 编辑器：

- `Provider Label`
- `Provider Key`
- `API Protocol`
- `Base URL`
- `API Key`
  - 允许直接写入数据库，展示时建议脱敏
- `Provider Logo`
  - 打开 selector 弹窗选择 logo preset
- `Model List`
  - 列表内每一项包含：
    - `label`
    - `model_id`
    - `model_ref`
    - `logo`
    - `reasoning`
    - `input modalities`
    - `context_window`
    - `max_tokens`
    - `enabled`
    - `sort_order`

### 8.3 平台 Tab

平台 Tab 维护默认 provider profile。

### 8.4 OEM Tab

OEM Tab 除了 provider/profile 编辑器外，还需要一个顶部开关：

- `继承平台层`
- `使用 OEM 独立 Provider`

当选择 `继承平台层` 时：

- 编辑器只读
- 页面显示当前平台层 provider profile 摘要

当选择 `使用 OEM 独立 Provider` 时：

- 编辑器可写
- 保存后 `app_model_runtime_overrides.provider_mode = use_app_profile`

### 8.5 Logo Selector

Logo selector 设计建议：

- 弹窗展示所有 `model_logo_presets`
- 支持搜索
- 支持预览浅色/深色版本
- 支持 provider logo 和 model logo 分别选择

## 9. 前端输入框模型列表

### 9.1 获取逻辑

输入框模型列表不应再直接依赖“静态 preset + 本地推断”。

应改成读取：

- `resolved model list for current app`

建议由 control-plane 暴露统一接口，例如：

- `GET /portal/runtime/models?app_name=<app>`

返回：

- `provider_mode`
- `resolved_scope`
  - `platform` | `app`
- `provider`
- `models[]`
- `version`

### 9.2 缓存逻辑

建议增加 Redis 缓存：

- key：`portal:runtime:models:<app_name>`
- value：resolved model list JSON
- TTL：300 秒到 900 秒

同时增加版本号：

- `portal:runtime:models:version:<app_name>`

### 9.3 失效策略

admin-web 更新以下任一内容时，应同步失效缓存：

- provider profile
- model list
- logo preset binding
- OEM provider mode

推荐做法：

1. DB 提交成功
2. 立即删除 Redis key
3. 由下一次读取 lazy rebuild

admin-web 可以直接承担缓存失效动作。

建议清理：

- `portal:runtime:models:<app_name>`
- `portal:runtime:models:version:<app_name>`

如果本次更新的是平台层 provider profile，则应额外清理：

- 所有当前处于 `inherit_platform` 的 OEM app 对应缓存 key

### 9.4 为什么可以加 Redis

这个点我支持。

因为输入框模型列表是高频读、低频写，非常适合缓存。

但要注意：

- Redis 缓存的是 resolved 结果
- 不是原始 provider/profile 配置

## 10. OpenClaw runtime 对接

### 10.1 当前阶段

当前桌面端仍可继续沿用“生成 runtime config + OpenClaw 消费 `models.providers`”的方式。

resolved provider profile 最终要能下发成：

- `models.providers`
- `agents.defaults.models`
- `agents.defaults.model.primary`

### 10.2 后续阶段

如果要做到真正的无重启热更新，推荐把“resolved model list”与“runtime provider config”进一步下沉到请求期解析，而不是完全依赖启动期配置文件。

但这属于下一阶段。

当前阶段先做到：

- admin-web 改配置
- control-plane 产出 resolved provider/model 集
- 桌面端同步 snapshot
- 前端模型列表与 runtime config 使用同一份 resolved 数据

## 11. 我对这套架构的评价

这套设计总体上是对的，而且比 `model-level override` 更稳。

我支持的点：

- provider-level fallback
- 单一生效层
- `1 + N` 的 admin-web 结构
- logo selector
- Redis 缓存 resolved model list

我建议收紧的点：

- `apiKey` 虽然允许落表，但 admin-web 默认仍应脱敏展示
- 不要让 Redis 成为真值源
- 不要允许平台层和 OEM 层同时混合出一份模型列表

## 12. 决策总结

最终决策如下：

1. 覆盖粒度从 `model` 提升到 `provider layer`
2. 平台层与 OEM 层之间不再做 model 级 override
3. OEM 未配置 provider 时，完整回落平台层
4. OEM 已配置 provider 时，完整使用 OEM 层
5. admin-web 采用 `1 + N` Tab 管理平台与 OEM provider profile
6. 输入框模型列表读取 resolved model list
7. Redis 只缓存 resolved model list，不做真值源
8. API Key 当前允许直接落表，admin-web 保存后负责清 Redis 让缓存失效
