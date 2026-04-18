# Financial Market Data Architecture

更新时间：2026-04-18

## 1. 目标

为 iClaw 的股票、基金、ETF、指数等金融财经数据建立一套长期可扩展的数据架构，避免继续把“目录、行情、基础面、标签、展示字段”混在单一宽表里。

这套架构需要同时满足：

- 适配多市场：A 股、基金、ETF、QDII，后续可扩展到港股、美股、指数、债券、期货
- 适配多源：akshare、efinance、腾讯、Tushare，以及未来商业源
- 区分真值层和展示层：事实数据不直接等于页面返回
- 区分不同更新频率：目录、日级快照、分钟级行情、季度财务、衍生标签不能混成一个时间语义
- 支持 OEM 平台化：金融能力由平台维护，前端页面只是消费统一接口

一句话总结：

- `instrument` 负责“它是谁”
- `fact` / `snapshot` 负责“它现在或某时刻是什么”
- `derived view` 负责“页面应该怎么读”

## 2. 当前问题

当前仓库里的市场数据已经出现典型的短期演进痕迹：

- `market_stock_catalog` / `market_fund_catalog` 同时承担目录、行情、基础面、标签、页面投影
- `stock_basics` / `stock_quotes` 是另一套并行真值，但没有被统一并入 `/market/*` 接口
- 同一个字段在不同表里语义不一致
  - 例如市值既可能来自导入脚本，也可能来自实时行情脚本
- 页面拿到的是“某次导入留下的宽表快照”，而不是一个明确的金融数据读模型

结果是：

- 有些卡片有 instrument identity，但缺少行情字段
- 有些数据存在于数据库，但不在接口返回层
- 后续接更多源时只能继续给 catalog 表加列

这条路不可持续。

## 3. 架构原则

### 3.1 平台主数据中心化

金融 instrument 的主数据必须中心化，不能让每个页面或 OEM 各自维护股票/基金定义。

### 3.2 真值层与投影层分离

数据库中的事实表和页面接口中的展示对象不是同一层。

- 真值层：可追溯、可幂等、保留来源与时间语义
- 投影层：面向搜索、列表、详情、筛选与排序优化

### 3.3 不同时间语义分层

必须明确区分：

- 慢变主数据：代码、名称、交易所、板块、基金类型
- 日内或日级行情快照：价格、涨跌幅、成交额、换手率
- 季度或年级财务事实：营收、净利润、ROE、EPS
- 派生视图：低估值、高换手、强势异动、核心资产等标签

### 3.4 多源接入但单一规范输出

底层允许多源竞争，上层接口只暴露统一字段规范，不把源差异泄漏给前端。

### 3.5 页面只读稳定 API

桌面端与未来 Web 端不直接理解 akshare / Tushare 的原始结构，只消费 control-plane 的统一金融接口。

## 4. 目标分层

推荐采用六层模型：

```text
Data Source Layer
  -> Ingestion Layer
     -> Canonical Fact Layer
        -> Snapshot Layer
           -> Derived View Layer
              -> Public Market API Layer
```

### 4.1 Data Source Layer

数据源适配器层。负责和外部源交互。

来源示例：

- akshare
- efinance
- 腾讯行情
- Tushare
- 未来商业数据供应商

职责：

- 拉取原始数据
- 记录 provider、接口名、抓取时间、原始标识
- 不做页面字段拼接

### 4.2 Ingestion Layer

将外部数据转换为统一的内部事件或事实输入。

职责：

- 代码标准化
- 数值单位标准化
- 时间语义标准化
- 原始 payload 存档
- 幂等写入

### 4.3 Canonical Fact Layer

权威事实层。保存“某个 instrument 在某个时点/报告期的原子事实”。

职责：

- 可追溯
- 可重复计算
- 不为页面布局服务

### 4.4 Snapshot Layer

面向读路径的“最新有效快照”层。

职责：

- 为某个 instrument 维护最新行情快照、最新基础面摘要、最新财务摘要
- 明确 `as_of` 和 `source`
- 供上层接口快速读取

### 4.5 Derived View Layer

平台派生层。保存筛选标签、排序指标、搜索向量、市场主题分组等。

职责：

- 低估值、高换手、强势异动等标签计算
- 页面排序字段预计算
- AI 研究入口摘要

### 4.6 Public Market API Layer

对桌面端、Web 端和未来开放接口暴露稳定的金融对象。

职责：

- 返回统一 schema
- 保持向后兼容
- 隐藏底层多源与原始表细节

## 5. 长期领域模型

### 5.1 Instrument 主体

统一的金融 instrument 概念覆盖股票、基金、ETF、指数等。

建议核心表：

- `market_instrument`
- `market_instrument_alias`
- `market_listing`

#### `market_instrument`

只描述 identity，不放实时行情。

建议字段：

- `instrument_id`
- `instrument_type`
  - `equity`
  - `fund`
  - `etf`
  - `qdii`
  - `index`
  - `bond`
- `market`
  - `a_share`
  - `cn_fund`
  - 未来扩展 `hk`, `us`, `global`
- `canonical_symbol`
- `display_name`
- `legal_name`
- `status`
- `country_code`
- `currency_code`
- `created_at`
- `updated_at`

#### `market_listing`

一个 instrument 可以对应一个或多个上市/交易 listing。

建议字段：

- `listing_id`
- `instrument_id`
- `exchange`
- `symbol`
- `board`
- `lot_size`
- `trading_status`
- `listed_at`
- `delisted_at`
- `is_primary`
- `created_at`
- `updated_at`

#### `market_instrument_alias`

用于搜索和多源映射。

建议字段：

- `alias_id`
- `instrument_id`
- `alias_type`
  - `symbol`
  - `name`
  - `source_id`
  - `ticker`
- `alias_value`
- `source`

### 5.2 Source Registry

记录每个来源的可靠性、优先级和字段覆盖能力。

建议表：

- `market_data_source`
- `market_source_binding`

目的：

- 不是所有源都能提供全部字段
- 不同 instrument 类型可以配置不同主源和 fallback 源

### 5.3 Fact 层

建议至少拆三类事实表：

- `market_quote_fact`
- `market_fund_nav_fact`
- `market_financial_statement_fact`

#### `market_quote_fact`

原子行情事实。

建议字段：

- `fact_id`
- `instrument_id`
- `listing_id`
- `source`
- `source_record_id`
- `granularity`
  - `realtime`
  - `1m`
  - `5m`
  - `1d`
- `trade_date`
- `as_of`
- `open_price`
- `high_price`
- `low_price`
- `close_price`
- `prev_close_price`
- `change_amount`
- `change_percent`
- `volume`
- `amount`
- `turnover_rate`
- `pe_ttm`
- `pb`
- `total_market_cap`
- `circulating_market_cap`
- `raw_payload_json`
- `ingested_at`

#### `market_financial_statement_fact`

财务事实层，用于季度/年度数据。

建议字段：

- `fact_id`
- `instrument_id`
- `source`
- `statement_type`
  - `income`
  - `balance_sheet`
  - `cash_flow`
  - `derived_ratio`
- `fiscal_year`
- `fiscal_period`
- `report_date`
- `announce_date`
- `metrics_json`
- `raw_payload_json`
- `ingested_at`

### 5.4 Snapshot 层

这层服务于“最新值读取”，是页面最常用的后端读模型。

建议表：

- `market_quote_snapshot`
- `market_fund_snapshot`
- `market_financial_snapshot`

#### `market_quote_snapshot`

每个 listing 最新有效行情。

建议字段：

- `listing_id`
- `instrument_id`
- `source`
- `snapshot_at`
- `trade_date`
- `is_delayed`
- `price_currency`
- `current_price`
- `prev_close_price`
- `open_price`
- `high_price`
- `low_price`
- `change_amount`
- `change_percent`
- `volume`
- `amount`
- `turnover_rate`
- `pe_ttm`
- `pb`
- `total_market_cap`
- `circulating_market_cap`
- `quality_score`
- `updated_at`

#### `market_financial_snapshot`

页面常读的基础面摘要，不等同于完整财报。

建议字段：

- `instrument_id`
- `source`
- `as_of_report_date`
- `revenue_ttm`
- `net_profit_ttm`
- `roe_ttm`
- `gross_margin_ttm`
- `eps_ttm`
- `debt_ratio`
- `updated_at`

### 5.5 Derived View 层

页面筛选、排序、推荐分组都应该来自派生层，而不是散落在前端逻辑里。

建议表：

- `market_instrument_tag_view`
- `market_search_document`
- `market_surface_projection`

#### `market_instrument_tag_view`

建议字段：

- `instrument_id`
- `listing_id`
- `tag_key`
- `tag_label`
- `tag_source`
  - `rule_engine`
  - `analyst_curated`
  - `ml_model`
- `score`
- `effective_at`
- `expires_at`
- `updated_at`

#### `market_surface_projection`

这是长期上替代 `market_stock_catalog` / `market_fund_catalog` 的页面投影层。

建议字段：

- `surface_key`
  - `stock_market_list`
  - `stock_market_detail`
  - `fund_market_list`
  - `fund_market_detail`
- `instrument_id`
- `listing_id`
- `projection_version`
- `payload_json`
- `search_text`
- `sort_metrics_json`
- `updated_at`

关键原则：

- projection 可以删了重建
- projection 不是金融真值
- projection 面向页面性能和稳定 schema

## 6. 推荐表演进策略

### 6.1 现有表的长期定位

当前表不建议继续扩列作为长期真值。

- `market_stock_catalog`
  - 短期：保留为旧投影层
  - 长期：由 `market_surface_projection` 替代
- `market_fund_catalog`
  - 短期：保留为旧投影层
  - 长期：由 `market_surface_projection` 替代
- `stock_quotes`
  - 短期：保留并升级为 `market_quote_fact` 的输入来源
  - 长期：迁入统一事实/快照模型
- `stock_basics`
  - 短期：保留并升级为 instrument/basics snapshot 输入来源
  - 长期：迁入 `market_instrument` + `market_financial_snapshot`

### 6.2 迁移原则

- 不直接重写现有前台接口
- 先建立新真值层
- 再建立新 projection
- 最后把 `/market/*` 切到新读模型

## 7. 上层接口设计

### 7.1 接口分层原则

金融接口不应只有“一个列表接口 + 一个详情接口”。

建议拆为三类：

- Directory API：查 instrument identity
- Snapshot API：查最新行情/基础面
- Surface API：查页面聚合结果

### 7.2 对前端暴露的稳定对象

建议新增统一顶层对象：

- `MarketInstrumentSummary`
- `MarketInstrumentDetail`
- `MarketQuoteSnapshot`
- `MarketDataSourceStatus`

#### `MarketInstrumentSummary`

用于列表页。

建议字段：

- `instrument_id`
- `listing_id`
- `instrument_type`
- `market`
- `exchange`
- `symbol`
- `display_name`
- `board`
- `status`
- `quote`
  - `current_price`
  - `change_percent`
  - `amount`
  - `turnover_rate`
  - `pe_ttm`
  - `total_market_cap`
  - `circulating_market_cap`
  - `snapshot_at`
  - `is_delayed`
- `tags`
- `summary`
- `source_status`

#### `MarketInstrumentDetail`

用于详情页。

建议字段：

- `instrument`
- `primary_listing`
- `quote_snapshot`
- `financial_snapshot`
- `derived_tags`
- `risk_flags`
- `data_sources`
- `updated_context`

### 7.3 Surface API 建议

建议保留现有路径，但升级语义。

#### 列表接口

- `GET /market/instruments`
- `GET /market/stocks`
- `GET /market/funds`

查询参数建议统一：

- `instrument_type`
- `market`
- `exchange`
- `search`
- `tag`
- `sort`
- `limit`
- `offset`
- `fields`
- `as_of`

#### 详情接口

- `GET /market/instruments/:instrumentId`
- `GET /market/stocks/:stockId`
- `GET /market/funds/:fundId`

详情接口返回必须带：

- 数据时间
- 数据来源
- 字段级可用性

#### 数据质量接口

- `GET /market/data-sources/status`
- `GET /market/instruments/:instrumentId/data-health`

这类接口给运营后台和调试视图用，不直接给普通用户暴露复杂原始结构。

## 8. 接口返回规范

### 8.1 不再把“字段为空”当成失败

金融数据天然存在字段覆盖不完整的情况。

因此接口必须区分：

- `field missing`
- `field not applicable`
- `field stale`
- `field delayed`

建议对关键对象增加：

- `field_status`
- `snapshot_at`
- `source`
- `confidence`

### 8.2 最佳努力返回

接口应遵循：

- identity 一定返回
- quote 有就返回 quote snapshot
- fundamentals 有就返回 fundamentals snapshot
- derived tags 独立返回

而不是因为某一个源缺了 `pe_ttm` 就把整个 instrument 卡片做成空壳。

### 8.3 示例

```json
{
  "instrument_id": "ins_a_share_600519",
  "listing_id": "lst_sh_600519",
  "instrument_type": "equity",
  "market": "a_share",
  "exchange": "sh",
  "symbol": "600519",
  "display_name": "贵州茅台",
  "quote": {
    "current_price": 1414.80,
    "change_percent": 0.53,
    "amount": 1061208579,
    "turnover_rate": 0.06,
    "pe_ttm": 19.68,
    "total_market_cap": 1771712000000,
    "circulating_market_cap": 1771712000000,
    "snapshot_at": "2026-04-18T09:51:49+08:00",
    "source": "tencent",
    "is_delayed": true
  },
  "tags": ["低估值", "大盘核心"],
  "field_status": {
    "financial_snapshot": "missing",
    "quote": "ready"
  }
}
```

## 9. 数据源策略

### 9.1 主张：多源，但不多头真值

推荐策略：

- 免费源作为默认覆盖层
  - 腾讯、akshare、efinance
- Tushare 作为增强层
  - 更适合财务、日频、历史数据
- 未来商业源作为高可靠增强层

### 9.2 Source Policy

建议按字段和 instrument type 配置 source policy，而不是“整张表认一个 source”。

示例：

- A 股实时/准实时行情
  - primary: 腾讯
  - fallback: akshare / efinance
- A 股财务事实
  - primary: Tushare
  - fallback: akshare
- 基金净值/规模
  - primary: 天天基金 / akshare
  - fallback: efinance

### 9.3 字段级仲裁

同一个快照的不同字段可以来自不同源，但必须保留来源记录。

例如：

- `current_price` 来自腾讯
- `pe_ttm` 来自 akshare
- `roe_ttm` 来自 Tushare

因此 snapshot 层应支持字段级 provenance，至少在 metadata 中可追溯。

## 10. 服务层职责

### 10.1 Ingestion Service

负责：

- 调度数据源
- 拉取原始数据
- 写入 fact/snapshot
- 记录 source health

### 10.2 Market Domain Service

负责：

- identity 解析
- listing 解析
- quote 与 fundamentals 组合
- derived tag 计算
- surface projection 构建

### 10.3 Public Market API Service

负责：

- 对外提供稳定接口
- 字段兼容
- 错误与缺失语义统一

## 11. 前端消费原则

前端 UI 不应再假定“所有字段一定齐全”。

必须改为：

- `identity first`
- `quote best effort`
- `fundamentals best effort`
- 明确展示 `更新时间 / 数据源 / 是否延迟`

因此卡片和详情页长期建议：

- 顶部优先展示名称、代码、交易所、板块
- 第二层展示最新行情
- 第三层展示估值/规模/换手等可用字段
- 对不可用字段显示 `--`
- 在详情页增加“数据时间”和“来源说明”

## 12. 分阶段落地

### Phase 1：修通现状，不再空壳

目标：

- 让 `/market/stocks` 和 `/market/stocks/:id` 读到统一的最新行情快照

动作：

- 用现有 `stock_quotes`、`stock_basics` 回填或覆盖当前 `market_stock_catalog` 的空字段
- 接口返回增加 `snapshot_at`、`source`、`is_delayed`
- 前端 UI 改为 best-effort 展示

这一步不改公开路径，但会先救现有体验。

### Phase 2：建立统一真值层

目标：

- 引入 `market_instrument`、`market_listing`、`market_quote_snapshot`

动作：

- 新建 canonical 表
- 让现有同步任务写入新表
- 保留旧 catalog 作为兼容投影

### Phase 3：重建 projection 与 API

目标：

- 让 `/market/*` 不再直接绑定 catalog 宽表

动作：

- 建立 `market_surface_projection`
- service 层改读 projection
- SDK 引入新 summary/detail schema

### Phase 4：多市场扩展

目标：

- 同一套模型扩展到基金、ETF、指数、港股、美股

动作：

- instrument type 扩展
- source policy 扩展
- 页面按 instrument type 适配

## 13. 对当前仓库的明确建议

### 13.1 不要继续做的事

- 不要继续往 `market_stock_catalog` 里机械加金融字段
- 不要让前端直接对接 Tushare/akshare
- 不要把“研究标签”和“行情快照”混成同一来源语义
- 不要让一个 `/market/stocks` 结构同时承担 identity、quote、fundamentals、screening engine 的所有职责

### 13.2 应该立即做的事

- 把当前 `stock_quotes` / `stock_basics` 并入统一读模型
- 给市场接口增加 `snapshot_at` 和 `source`
- 把前端卡片和详情页改成 best-effort 金融 UI
- 规划 canonical schema，而不是继续把 catalog 当主数据库模型

## 14. Definition of Done

这套架构完成的标志不是“又多接了一个 API”，而是：

- 可以清楚回答一个字段来自哪一层、哪个源、哪个时间点
- 列表页和详情页不会因为个别字段缺失而退化成空壳
- 股票、基金、ETF 的接口风格开始统一
- 新接一个数据源时，不需要改前端 schema
- 未来扩展港股、美股、指数时，不需要再复制一套表结构

这才是金融财经类产品应有的数据架构边界。
