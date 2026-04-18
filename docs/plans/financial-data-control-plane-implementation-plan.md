# Financial Data Control Plane Implementation Plan

更新时间：2026-04-18

## 1. Goal

为 iClaw 建立金融数据控制平面的第一批可运行骨架，覆盖股票市场、基金市场、Header 大盘信息和热点新闻的统一演进路径。

## 2. Approach

采用“先建控制平面骨架，再逐步迁移页面读模型”的方式，不直接重写所有市场功能。

本次先做三件事：

1. 完整设计文档
2. overview/news 底层 schema
3. control-plane overview/news API 骨架

## 3. Steps

1. 写架构文档：明确领域模型、source policy、sync/async 双通道和 surface API
2. 新增 migration：为 `market_index_snapshot`、`market_overview_snapshot`、`market_news_item` 建表
3. 扩展 domain/store/service/server/sdk：暴露 `market overview` 与 `market news`
4. 后续 checkpoint：
   [ ] 接入 Header surface
   [ ] 基金市场统一读模型
   [ ] async enrich 队列

## 4. Risks

- 现有市场数据仍有 catalog 宽表遗留
  - 缓解：先并存，不强制一次迁完
- Header 当前使用环境变量 feed URL
  - 缓解：本阶段先提供 control-plane API，下一阶段再切 Header 默认源
- 新闻源质量不稳定
  - 缓解：先建 schema 和 API，不把单一新闻源写死进 surface

## 5. Definition of Done

本阶段完成的标志：

- 仓库中存在完整的金融数据控制平面设计文档
- control-plane 已有 `overview/news` 的正式 schema 和 API 入口
- 后续 Header、股票、基金可以围绕这个骨架继续演进，而不是重新设计
