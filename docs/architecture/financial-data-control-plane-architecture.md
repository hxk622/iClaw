# Financial Data Control Plane Architecture

更新时间：2026-04-18

## 1. 目标

为 iClaw 建立一个独立的金融数据控制平面，统一承载股票市场、基金市场、Header 大盘信息、热点新闻与主题内容，而不是让每个页面分别拼接不同来源的行情、基础面与资讯。

控制平面必须同时支持：

- 股票、基金、ETF、指数等 instrument
- 同步和异步两类数据获取链路
- API、网页抓取、公开接口、未来商业数据源的统一接入
- 对前端暴露稳定的 surface API
- 对后端保留可追溯的 canonical truth

一句话总结：

- 前端只读 control-plane
- control-plane 负责聚合、仲裁、投影
- 数据源只是 connector，不直接定义页面模型

## 2. 问题定义

如果只按“补股票页字段、补基金页字段、给 Header 加个新闻 feed”来做，会马上出现三个问题：

1. 每个页面都绑定不同的字段集合，后续无法统一
2. 行情、基础面、净值、资讯、热点主题的更新频率不同，不能放在同一张宽表里
3. 同步全量抓取和用户触发的详情补抓混在一起后，很快会变成不可维护的定时任务堆

所以必须把“金融数据控制平面”单独建模。

## 3. 总体架构

```text
External Data Sources
  -> data-sync-service
     -> Source Connectors
     -> Ingestion Scheduler / Async Enrich Queue
     -> Canonical Data Layer
        -> PostgreSQL

Desktop / Web / admin-web
  -> control-plane
     -> Projection / Serving Layer
        -> Surface APIs
           -> Stock Market / Fund Market / Header / AI Research Entry
```

推荐边界：

- `control-plane` 负责读和管理面 API
- `data-sync-service` 负责调度、抓取、补抓和入库
- 前端不直接读取 `data-sync-service`

当前迁移状态：

- `control-plane` 内嵌 scheduler 已进入废弃路径
- 自动 cron / warmup 的角色应由 `data-sync-service` 独自承担
- `control-plane` 保留 admin 查询和手工触发接口

## 4. 五层模型

### 4.1 Source Connectors

每个数据源都以 connector 形式接入，不允许前端直接调用。

来源类型：

- API 类
  - akshare
  - efinance
  - Tushare
- 公开页面抓取类
  - 财经站点新闻页
  - 基金详情页
  - 指数概览页
- 未来商业数据源

connector 只负责：

- 拉取原始数据
- 记录来源与抓取时间
- 转成 ingestion payload

connector 不负责：

- 页面字段命名
- 前端 schema
- UI 逻辑

### 4.2 Ingestion Layer

统一 ingestion 层负责：

- 字段标准化
- 单位统一
- 时间语义统一
- 幂等写入
- 原始 payload 留档

数据进入系统后，必须先落 canonical truth，再产生 projection。

### 4.3 Canonical Data Layer

这是金融数据真值层。

建议长期核心对象：

- `market_instrument`
- `market_listing`
- `market_quote_fact`
- `market_quote_snapshot`
- `market_financial_snapshot`
- `market_fund_snapshot`
- `market_news_item`
- `market_theme_relation`
- `market_index_snapshot`
- `market_overview_snapshot`

真值层要求：

- 可以追溯来源
- 可以区分不同更新时间
- 不以页面为中心设计

### 4.4 Projection / Serving Layer

这一层面向页面消费。

作用：

- 为股票市场页提供 summary/detail 投影
- 为基金市场页提供 summary/detail 投影
- 为 Header 提供 quotes/headlines/overview 投影
- 为 AI 研究入口提供 instrument context 和 news context

推荐投影对象：

- `stock_market_projection`
- `fund_market_projection`
- `header_market_projection`
- `market_news_projection`

### 4.5 Surface API Layer

控制平面对外至少提供四组 API：

- `stock surface`
- `fund surface`
- `overview surface`
- `news surface`

建议路径：

- `GET /market/stocks`
- `GET /market/stocks/:id`
- `GET /market/funds`
- `GET /market/funds/:id`
- `GET /market/overview`
- `GET /market/news`
- `GET /market/news/:id`

## 5. 同步 + 异步双通道

### 5.1 同步通道

适合全市场、广覆盖、低个性化数据。

典型对象：

- A 股行情快照
- 股票基础信息
- 基金净值和规模
- 指数快照
- 行业概念关系
- 热门快讯池

执行方式：

- cron 定时任务
- 全量 / 增量同步
- 覆盖 snapshot

### 5.2 异步通道

适合详情增强和按需补洞。

典型对象：

- 某只股票的行业/主营业务补全
- 某只基金的经理、费率、持仓细节
- 某条新闻的正文抓取
- 某主题的二级关联内容

执行方式：

- 用户打开详情页时触发
- 搜索命中后触发 enrich
- 字段缺失时写队列异步补抓

### 5.3 设计原则

同步负责“广”，异步负责“深”。

不要用异步补抓替代全量同步，也不要指望定时全量同步补足每个详情页需要的深度字段。

## 6. Source Policy

每种 instrument 和字段都有自己的 source policy。

### 6.1 股票

- 实时/准实时行情
  - primary: 腾讯 / akshare / efinance
  - fallback: 同类免费源
- 财务和基础面
  - primary: Tushare 或 AKShare
  - fallback: efinance / 页面抓取
- 行业概念关系
  - primary: AKShare

### 6.2 基金

- 净值、收益、规模、费率
  - primary: AKShare / 公共基金源
  - fallback: efinance / 页面抓取
- 基金经理与持仓
  - primary: 详情页抓取或专门 API

### 6.3 Header / 概览

- 指数行情
  - 来自 `market_index_snapshot`
- 市场宽度与总成交额
  - 来自 `market_overview_snapshot`
- 热点新闻
  - 来自 `market_news_item`

## 7. Header 不是特殊逻辑，而是独立 surface

Header 不应继续依赖硬编码 fallback feed 作为长期方案。

Header 长期应消费统一投影：

- quotes：主要指数 / 市场温度
- headlines：热点快讯
- status：更新时间 / live 状态

推荐专门的 serving object：

- `HeaderMarketFeed`

字段建议：

- `quotes`
- `headlines`
- `snapshot_at`
- `live`
- `source_status`

Header 只是 surface，不拥有自己的数据真值。

## 8. 新闻与热点内容层

新闻层需要和行情层分开建模。

### 8.1 `market_news_item`

建议字段：

- `news_id`
- `source`
- `source_item_id`
- `title`
- `summary`
- `content_url`
- `published_at`
- `occurred_at`
- `language`
- `market_scope`
- `importance_score`
- `sentiment_label`
- `related_symbols`
- `related_tags`
- `raw_payload_json`
- `created_at`
- `updated_at`

### 8.2 新闻层的职责

- 给 Header 提供 headline
- 给股票/基金详情提供相关资讯
- 给 AI 研究提供上下文材料

新闻不是附属功能，而是金融产品核心 surface 的一部分。

## 9. 基金市场与股票市场的统一规则

不要把基金市场当成另一个完全独立系统。

统一规则：

- 都基于 instrument/listing
- 都有 snapshot
- 都有 summary/detail
- 都能关联 news/theme
- 都能作为 AI research target

差异只在字段集不同：

- 股票侧重 price / PE / PB / market cap / turnover
- 基金侧重 nav / return / drawdown / scale / manager / tracking target

## 10. 第一批 API 边界

### 10.1 Overview API

`GET /market/overview`

职责：

- 返回大盘概览
- 返回主要指数
- 返回 Header 可直接消费的 headlines

### 10.2 News API

`GET /market/news`

职责：

- 返回新闻列表
- 支持按 symbol / market_scope / tag 过滤

### 10.3 后续扩展

- `GET /market/news/:id`
- `GET /market/themes`
- `GET /market/themes/:id`

## 11. 分阶段实施

### Phase 1

目标：

- 股票市场统一读模型上线
- 建立 overview/news 的底层 schema 和 API 骨架

### Phase 2

目标：

- 基金市场统一读模型上线
- Header 默认切到 control-plane overview/news feed

### Phase 3

目标：

- canonical `instrument/snapshot/projection` 正式落地
- 同步 + 异步抓取链路分离

### Phase 4

目标：

- 港股、美股、指数、主题和公告纳入统一金融数据控制平面

## 12. Definition of Done

真正完成不是“页面上多了几个字段”，而是：

- 股票、基金、Header、新闻都能从同一控制平面读数据
- 数据来源、时间、延迟状态可追踪
- sync 和 async 补抓职责分离
- 新增一个数据源不需要改前端 schema
- 前端页面只依赖稳定 surface API

这才是长期架构，而不是临时补字段。
