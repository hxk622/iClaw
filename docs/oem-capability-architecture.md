# OEM 能力架构原则

更新时间：2026-03-25

## 1. 目标

iClaw 的 OEM 未来不会只有品牌换肤，而是会扩展为一套可运营、可组合、可发布的产品平台。

OEM 需要支持的不只是：

- logo / favicon / 主题色
- skill / MCP / model

未来还要支持：

- sidebar
- header
- input
- home
- skill-store
- menu
- asset slot
- 其它可配置 surface

因此，OEM 架构必须从一开始就采用“中心化能力中心 + OEM 装配层”的模式，而不是把能力定义散落到代码和各 OEM 配置里。

## 2. 总原则

所有 OEM 能力统一遵循以下原则：

1. 平台主数据中心化，统一存数据库。
2. OEM 侧不维护能力定义，只维护是否适用、默认项、推荐项、排序和少量装配信息。
3. 相同能力只维护一份，不允许为每个 OEM 复制一份完整定义。
4. 所有前台展示结果都应由“能力主表 + OEM 绑定表”计算得出，而不是靠代码常量拼接。
5. 所有 OEM 配置都必须先判断它是 `runtime-bound` 还是 `cloud-live`，不能混用一套分发策略。

一句话总结：

- 平台定义能力
- OEM 勾选能力
- 运行时按绑定结果装配能力

## 2.1 配置分层原则

OEM 配置不是一刀切地“全部实时读云端”，也不是“全部打包进本地”。

必须先区分两类配置：

### A. `runtime-bound`

指 OpenClaw runtime / sidecar 直接依赖的配置。

这类配置必须满足：

- 能被下发到本地
- 能落盘为本地 snapshot / runtime config
- 能在 sidecar 启动或 reload 时直接消费
- 在离线或 control-plane 短时不可用时，仍可依赖本地最后一次成功配置运行

典型对象：

- model allowlist / default / recommended
- provider 级模型配置
- MCP runtime config
- skill runtime binding
- OpenClaw 直接依赖的 capability gating

### B. `cloud-live`

指不被 OpenClaw runtime 直接消费，而主要被前端展示层、运营层使用的配置。

这类配置可以实时从云端获取。

典型对象：

- 商店列表
- 运营文案
- 营销位 / 展示位
- 非关键 UI 内容
- sidebar / header / input / home 等 shell 装配
- 左侧菜单显隐与排序
- 审计 / 统计 / 运营数据

### 分层结论

- `runtime-bound`：权威来源在数据库，但必须下发到本地再被 runtime 消费
- `cloud-live`：权威来源在数据库，可由前端直接实时查询

其中 `menu / sidebar / header / input / home` 这类不被 OpenClaw runtime 直接消费的 OEM shell 配置，默认应归类为 `cloud-live`。

推荐分发策略：

- 前端优先实时请求 `control-plane / portal/public-config`
- Tauri 桌面端可额外把最近一次成功配置写入本地 snapshot，作为离线兜底
- 但它们不应再被设计成“必须重新打包客户端才能生效”的静态配置

其中 `model list` 明确属于 `runtime-bound`，因为输入框最终展示的是 OpenClaw runtime 当前可消费的模型目录，而不是纯展示数据。

## 3. 两层架构

### 3.1 平台能力中心

平台能力中心负责维护能力全集，是权威数据源。

适用对象包括但不限于：

- skill
- mcp
- model
- menu
- surface template
- theme token set
- asset template
- layout block

平台能力中心负责：

- 基础定义
- 元数据
- 生命周期状态
- 版本
- 默认展示信息
- 兼容性 / 约束
- 审批 / 审计 / 发布策略

### 3.2 OEM 装配层

OEM 装配层只负责“把哪些能力装进某个 OEM app”。

OEM 装配层负责：

- 适用 / 不适用
- 默认项
- 推荐项
- 排序
- surface 级开关
- 少量 OEM 专属展示参数

OEM 装配层不负责：

- 定义一个 skill 是什么
- 定义一个 MCP 如何连接
- 定义一个 model 的 provider / model_id / api / base_url
- 复制一整份平台能力对象到 OEM 配置里

## 4. 统一数据模式

所有 OEM 能力优先采用以下数据模式：

### 4.1 能力主表

例如：

- `oem_skill_catalog`
- `oem_mcp_catalog`
- `oem_model_catalog`
- `oem_surface_catalog`
- `oem_component_catalog`

这些表保存平台级能力全集。

### 4.2 OEM 绑定表

例如：

- `oem_app_skill_bindings`
- `oem_app_mcp_bindings`
- `oem_app_model_bindings`
- `oem_app_surface_bindings`
- `oem_app_component_bindings`

这些表保存某个 OEM app 与平台能力的绑定关系。

绑定表推荐至少包含：

- `app_id` / `brand_id`
- `capability_key` / `ref`
- `enabled`
- `is_default`
- `is_recommended`
- `sort_order`
- `metadata_json`
- `created_at`
- `updated_at`

## 5. skill / MCP / model 的统一治理

### 5.1 Skill

- Skill 权威来源必须是云端 `cloud skill catalog`
- `cloud skill catalog` 是 skill 全集，可达到 `30000+`，不是某个 OEM 或某个本地目录的子集
- 平台层与 OEM 层都不拥有 skill 主数据，只维护对云端总库的绑定关系
- OEM 不编辑 skill 定义本身

### 5.1.1 Skill 三层模型

Skill 明确按以下三层治理：

1. `cloud skill` 总库
2. 平台级 skill 绑定
3. OEM 级 skill 绑定

定义如下：

- `cloud skill` 总库
  - 是 skill 的唯一主数据中心
  - 保存 skill metadata、tag、版本、icon、来源、同步时间、扩展元数据等
  - ClawHub、GitHub、本地导入目录等都只是它的导入来源，不是长期真值
- 平台级 skill 绑定
  - 表示“平台默认安装 / 共享给所有 OEM 的 skill”
  - 这是共享层，不属于某个单独 OEM
  - 平台层只维护 `skill slug + enabled + sort_order + binding metadata`
  - 平台层不再单独上传或维护 skill artifact
- OEM 级 skill 绑定
  - 表示“某个 OEM app 额外启用的 skill”
  - 这是 app 自己的增量层

对某个 OEM app 来说，可见且可安装的 skill 集合计算规则固定为：

`visible_skills(app) = platform_level_skills + oem_level_skills(app)`

这里的 `+` 指按 `skill_key` 去重后的并集，而不是简单拼接。

在工程实现上，OEM 层允许额外配置一个“总库可见性策略”：

- `bindings_only`
  - 只展示平台级绑定 + OEM 级绑定
- `all_cloud`
  - 视为 OEM 层对 cloud 总库开启全量可见
  - 平台级绑定 / OEM 级绑定仍然存在，但主要承担默认安装、推荐、排序和运营治理职责

因此，`all_cloud` 不是另一套主数据源，而是 OEM 绑定层的一种可见性策略。

### 5.1.2 Skill 商店与菜单视图规则

左侧各技能菜单不是不同数据源，而是同一可见 skill 集合上的不同视图：

- `技能商店`
  - 展示当前 app 的全部 `visible_skills(app)`
- `财经技能`
  - 展示 `visible_skills(app)` 中带财经类 tag 的 skill
- `基础技能`
  - 展示 `visible_skills(app)` 中带基础办公 / 基础类 tag 的 skill

因此：

- 菜单分类必须基于 `tag` 等元数据过滤
- Skill 不再保留 `visibility = internal/showcase` 这类商店显隐字段
- 不存在“平台强制 skill 名单”这一独立业务概念；如果某个 skill 对所有 OEM 生效，它应当表现为平台级绑定

### 5.1.3 Skill 元数据与版本规则

从外部来源同步 skill 时，原则上应尽量保留原始 metadata，并统一写入云端总库。

至少应支持：

- 名称、简介、作者、来源链接
- tag / category
- icon / 封面
- 版本号
- 上游原始 metadata
- 最近同步时间

版本治理原则：

- 版本号用于判断是否需要替换 skill 内容
- 上游版本变化时，云端总库更新到新版本
- 平台不维护旧版本运行副本，默认只维护当前版本
- 用户安装某个 skill 后，如后台已升级到新版本，前台与运行时都应自动切换到当前版本

### 5.1.4 本地目录的角色

`skills/`、`mcp/` 等本地目录只允许作为以下用途：

- 开发态样例
- 调试态导入源
- 一次性初始化 / 迁移素材

它们不是长期权威来源，也不应决定：

- 平台 skill 全集
- admin-web 可见 skill 列表
- 某个 OEM 最终可见 skill 集合

长期原则是：

- 云端数据库为准
- 本地目录可被删除
- runtime / portal / admin-web 都从数据库驱动

### 5.2 MCP

- MCP 定义统一存 `MCP catalog`
- MCP 原始内容、元数据、logo、分类、连接方式、抓取结果统一归平台级共享 catalog
- OEM 只勾选哪些 MCP 可用
- OEM 不复制 MCP config
- OEM app 不是 MCP 内容拥有者，只是当前 app 的装配与投影视图

### 5.2.1 MCP 的平台级与 OEM 级边界

为了避免后续实现再次混淆，MCP 明确按下面两层治理：

平台级共享主数据：

- 只有一份平台级 `MCP catalog`
- 所有 MCP 原始数据进入平台共享总库，而不是进入 `iclaw` / `licaiclaw` 各自私有库
- 平台级字段包括但不限于：
  - `mcp_key`
  - 名称、简介、分类、标签
  - logo、截图、文档链接、仓库链接、官网链接
  - transport、安装方式、运行方式、依赖说明
  - 抓取来源、抓取时间、审核状态、风险标记
  - 平台级默认展示元数据

OEM 级绑定数据：

- `iclaw` / `licaiclaw` 只维护与平台 MCP 的绑定关系
- OEM 只控制：
  - 是否显示
  - 是否默认已安装
  - 是否推荐
  - 排序
  - 分组、轻量文案、运营位等少量装配信息
- OEM 不拥有 MCP 原始内容，不单独维护一份 MCP 主数据

实现要求：

- `control-plane` 必须以“平台 catalog + OEM binding”合成当前 app 视图
- `admin-web` 必须区分“平台中心编辑主数据”和“OEM 装配页编辑绑定”
- 前端只展示合成结果，不自行推断某个 bundled MCP 是否等于某个 OEM 默认安装结果
- 如果某个 MCP 是 OEM 默认预置，也应表现为“平台 MCP 被该 OEM 默认绑定”，而不是“这个 MCP 属于该 OEM”

### 5.3 Model

- Model 定义统一存 `model catalog`
- OEM 只勾选哪些 model 可用
- OEM 只维护：
  - 是否适用
  - 默认模型
  - 推荐模型
  - 排序

## 6. Surface 与积木化扩展

OEM 的未来重点不只是能力启停，还包括 UI/交互的积木化搭配。

因此，以下对象也要按同一原则演进：

- `sidebar`
- `header`
- `input`
- `home`
- `skill-store`
- `menu`
- `asset slot`
- `theme token`
- `layout block`

建议演进路径：

1. 平台维护可复用的 surface / component / block catalog
2. OEM 在后台选择“启用哪些积木”
3. OEM 再配置少量 surface 级参数
4. 运行时由组合结果生成最终 UI

目标不是“每个 OEM 手写一套页面”，而是：

- 平台提供积木
- OEM 通过后台组合积木
- 不同 OEM 产出不同体验

## 7. 前台运行时原则

前台或客户端拿到的最终配置，应当是数据库计算后的装配结果。

运行时只关心：

- 当前 OEM 可用哪些 skill
- 当前 OEM 可用哪些 MCP
- 当前 OEM 可用哪些 model
- 当前 OEM 启用了哪些 surface
- 当前 OEM 选择了哪些 UI 积木

运行时不应直接依赖代码里的 OEM 常量全集作为权威来源。

对于 `runtime-bound` 配置，运行时理想链路应是：

`control-plane -> public-config -> local snapshot -> local runtime config -> sidecar -> models.list / skills.list / mcp runtime`

桌面端实现要求：

- 前端可主动触发 snapshot 同步，用于尽早更新本地配置
- Rust 必须在 sidecar 启动前做一次 best-effort 兜底同步
- 这样即使前端同步丢失，runtime-bound 配置也不会 silently 退回旧配置

而不是：

- 输入框实时直连 control-plane
- 前端直接把云端结果当 runtime 真值
- 把运行时依赖配置长期写死在代码或安装包里

## 8. 管理控制台设计原则

`admin-web` 未来要对应两套视图：

### 8.1 平台中心视图

用于维护：

- skill center
- MCP center
- model center
- surface center
- component center

### 8.2 OEM 装配视图

用于维护某个 OEM app：

- 勾选适用 / 不适用
- 设默认项
- 设推荐项
- 排序
- 配置少量 surface 参数

平台中心负责“定义能力”，OEM 视图负责“装配能力”。

对 `admin-web` 的具体约束：

- `MCP center` 编辑的是平台级共享 catalog，不带某个 OEM 归属语义
- OEM app 页面编辑的是 `oem_app_mcp_bindings` 这类绑定，不直接改 MCP 主数据
- 页面文案、接口命名、表头、操作按钮都要避免把“平台主数据编辑”和“OEM 显隐配置”混成一个概念
- 任何“默认已安装 / 是否显示 / 排序 / 推荐”都应落在 OEM binding，而不是改写平台 catalog 真值

对 `skill center` 额外增加约束：

- `admin-web` 平台视角必须能看到云端 skill 总库全集，而不是只看到已安装的少量 skill
- 平台视角允许分页、搜索、筛选，但不应把“未安装”从全集里裁掉
- 某个 OEM 视角看到的是“平台层 + OEM 层”合成后的可见集合及安装状态
- `技能商店 / 财经技能 / 基础技能` 三个菜单看到的是同一可见集合的不同 tag 视图

## 9. 禁止事项

后续实现时，默认禁止以下做法：

- 把平台能力全集只写在代码常量里长期维护
- 在每个 OEM 配置里复制完整的 skill / MCP / model 定义
- 让 OEM 页面直接编辑平台能力主定义
- 同一能力在多个地方维护多份真值
- 前台靠硬编码条件判断拼出不同 OEM 的能力列表
- 用本地 `skills/` 目录扫描结果长期替代云端 skill 总库
- 为 skill 继续保留 `visibility`、`internal`、`showcase` 之类历史字段
- 额外引入“平台强制 skill 名单”来替代平台级 binding

## 10. 当前落地要求

从现在开始，以下能力按同一方向演进：

- `skill`
- `mcp`
- `model`
- `sidebar`
- `header`
- `input`
- `home`

优先级上，先把 `skill / mcp / model` 完整迁到“中心化主数据 + OEM 绑定”模式，再逐步把 surface / block / template 纳入同一架构。

## 11. 当前还需要补的架构改造

在本原则下，当前还需要继续改造以下部分：

### 11.1 Runtime-bound 配置同步链路

目标：

- control-plane 是唯一真相源
- 客户端本地 snapshot 是 runtime 消费入口
- sidecar 不直接查 control-plane

还需要补强：

- 本地 snapshot 同步成功 / 失败的明确状态
- snapshot 版本号与最近同步时间可观测
- snapshot 更新后的 sidecar reload 机制
- reload 失败时保留旧配置并显式提示，而不是 silent fail

### 11.2 OEM 配置分发边界

需要把所有 OEM 能力显式标注为：

- `runtime-bound`
- `cloud-live`

否则后续很容易出现：

- 本该下发本地的配置被错误做成前端实时查云
- 本该云端实时展示的内容被错误塞进本地 runtime config

建议后续在 catalog / binding 设计里增加一个明确的 `delivery_mode` / `runtime_scope` 概念。

### 11.3 业务模块中心化

当前 `skill / mcp / model` 已经中心化，但 `龙虾商店 / 智能投资专家 / 安全中心 / 数据连接 / IM 机器人 / 任务中心` 这类业务模块还需要进一步抽象：

- 平台模块目录
- OEM 模块绑定
- 模块入口显隐
- 模块 surface 配置

这样品牌详情页的“业务模块”才能真正与 `skill / mcp / model` 一样按统一模式治理。

### 11.4 Menu / Surface / Module 三层拆分

当前容易混淆的几个对象需要继续拉开：

- `menu`
  - 是否显示入口
- `surface`
  - 某个页面 / 区域的配置载体
- `module`
  - 一块业务能力，如龙虾商店、安全中心

理想关系应是：

- module 可以拥有 surface
- module 可以映射 menu entry
- OEM 对三者分别做绑定和配置

### 11.5 Admin 可观测性

`admin-web` 后续需要增加至少以下状态面板：

- 当前品牌 publishedVersion
- 当前本地客户端已同步 version
- 最近 snapshot 同步状态
- sidecar 当前应用的 runtime version / config version

否则运营后台改完配置后，很难区分是：

- 后端没发布
- 客户端没同步
- sidecar 没 reload
