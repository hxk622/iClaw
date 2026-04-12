# 05. OEM Shell 与 admin-web 配置模型

## 平台判断

OEM 不是 UI 分叉，而是平台能力。

因此，学习系统的入口、壳层装配、展示位置，应该由 admin-web 的 shell/surface 配置模型来控制，而不是写死在每个行业版本里。

## 与当前仓库的关系

当前 `admin-web` 的 React 配置编辑器已存在这些 shell surface 概念：
- `home-web`
- `header`
- `sidebar`
- `input`
- menu bindings

这意味着平台层已经具备 OEM 化雏形。

## 当前优先级

第一批优先配置化的能力：
1. `sidebar`
2. `header`
3. `home-web` 入口与 CTA
4. menu bindings

## 平台层负责定义什么

平台层负责定义：
- 什么可以被 OEM
- 什么是 shell 入口 vs 学习逻辑
- 什么属于统一平台数据
- 什么属于品牌/行业绑定

## 垂类层只负责什么

垂类层只负责：
- 这个行业希望如何命名入口
- 默认打开哪个学习页
- 哪些内容模块启用
- 哪个 artifact 模板作为成果件

## 当前明确原则

- `home-web` 是官网，不是深度学习壳
- 真正的学校发生在客户端
- shell 的变化由配置驱动
- 学习逻辑本身不应被 OEM 文案层破坏

## 当前不做

- 不先把所有 surface 一次性全配置化
- 不先做“任意行业任意壳层”的无限组合
- 不让 OEM 配置侵入底层闭环协议
