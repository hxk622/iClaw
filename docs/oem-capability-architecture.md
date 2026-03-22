# OEM 能力架构原则

更新时间：2026-03-22

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

一句话总结：

- 平台定义能力
- OEM 勾选能力
- 运行时按绑定结果装配能力

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

- Skill 定义统一存 `skill catalog`
- OEM 只勾选哪些 skill 可用
- OEM 不编辑 skill 定义本身

### 5.2 MCP

- MCP 定义统一存 `MCP catalog`
- OEM 只勾选哪些 MCP 可用
- OEM 不复制 MCP config

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

## 9. 禁止事项

后续实现时，默认禁止以下做法：

- 把平台能力全集只写在代码常量里长期维护
- 在每个 OEM 配置里复制完整的 skill / MCP / model 定义
- 让 OEM 页面直接编辑平台能力主定义
- 同一能力在多个地方维护多份真值
- 前台靠硬编码条件判断拼出不同 OEM 的能力列表

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
