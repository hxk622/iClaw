# Financial Data Sync Task Architecture

更新时间：2026-04-19

## 1. 目标

在当前 `services/control-plane/src/sync-tasks/` 的基础上，把金融数据抓取从“几段分散的 cron + 若干 Python/TypeScript 脚本”提升为一套可持续演进的调度架构。

目标不是推翻现有实现，而是基于现有链路收束为：

- 统一任务注册表
- 清晰的任务分类
- 同步抓取与异步补抓分层
- 明确的 freshness 语义
- 能被运营和开发观测、手动触发和扩展

## 2. 现状

当前仓库已经有一套可工作的抓取链路：

- 入口：`services/control-plane/src/sync-tasks/index.ts`
- 任务：
  - `sync-stock-basics`
  - `sync-stock-quotes`
  - `sync-industry-concept`
  - `sync-finance-data`
  - `sync-market-overview`
  - `sync-market-news`
- 运行方式：
  - `node-cron` 定时调度
  - Python 脚本负责第三方源抓取
  - TypeScript 任务负责入库、幂等、日志

这已经是一个正确方向，但还存在四个结构性问题：

1. 调度入口是手写的，新增任务会继续堆在 `index.ts`
2. 任务没有统一元数据，调度策略和用途不成体系
3. sync 与 async enrich 还没有统一边界
4. 数据 freshness、任务优先级、降级策略没有被系统化表达

## 2.1 当前实际依赖的数据源

基于当前仓库代码，金融数据已经实际依赖以下来源：

### A 股身份与初始目录

- `CNInfo`
  - `https://www.cninfo.com.cn/new/data/szse_stock.json`
- `腾讯行情`
  - `https://qt.gtimg.cn/q=...`

用途：

- `import-a-share-stocks.ts`
- 生成 `market_stock_catalog`

### A 股行情与基础面同步

- `AKShare`
  - 东方财富接口
  - 新浪接口
- `efinance`

用途：

- `fetch_stock_quotes.py`
- `fetch-stock-basics.py`
- `fetch_industry_concept.py`
- `fetch-finance-data.py`

### 基金市场

- `东方财富 fundcode_search`
  - `https://fund.eastmoney.com/js/fundcode_search.js`
- `东方财富 pingzhongdata`
  - `https://fund.eastmoney.com/pingzhongdata/{code}.js`
- `东方财富 push2`
  - `https://push2.eastmoney.com/api/qt/stock/get`

用途：

- `import-cn-funds.ts`
- 生成 `market_fund_catalog`

### 大盘指数

- `AKShare`
  - `stock_zh_index_spot_em`
  - `stock_zh_index_spot_sina`

用途：

- `fetch_market_indices.py`
- 生成 `market_index_snapshot`

### 热点快讯 / 新闻

- `AKShare` 封装的公开新闻源
  - `stock_info_global_em` -> 东方财富快讯
  - `stock_info_global_cls` -> 财联社电报
  - `stock_info_global_sina` -> 新浪快讯

用途：

- `fetch_market_news.py`
- 生成 `market_news_item`

### 财务数据兜底

- `Tushare`

用途：

- `fetch-finance-data.py`
- 当前作为季度财务数据的后备源

## 2.2 当前缺口

虽然基础源已经能跑起来，但仍有明显缺口：

- 基金新闻还没有 fund-specific 源，只是从通用 `market_news_item` 做前端匹配
- 基金经理 / 持仓 / 公告还没有正式 sync task
- 股票个股新闻正文、公告正文、研究材料还没有 async enrich
- `baostock` 已在 `data-source-scheduler.ts` 类型里出现，但当前未真正接入
- 各来源的 freshness / SLA / 字段覆盖能力还没有写成 source registry

## 3. 总体设计

```text
data-sync-service
  -> Task Registry
     -> Scheduler Layer
        -> Task Runner
           -> Execution Store
           -> Source Connectors
              -> Canonical Tables / Snapshot Tables

control-plane
  -> Surface APIs
  -> Admin task query / trigger APIs
```

当前迁移原则：

- `control-plane` 保留 task admin 读口和触发口
- 真正的 cron/scheduler 角色逐步迁到 `services/data-sync-service`
- 在迁移期，embedded scheduler 仍可作为兼容路径，但长期目标是 data-sync-service 单独承担抓取职责

## 4. 任务分类

### 4.1 Snapshot Task

负责定时刷新某类最新快照。

典型任务：

- `sync-stock-quotes`
- `sync-market-overview`
- `sync-market-news`

特征：

- 高频
- 覆盖面广
- 写 snapshot 表
- 对页面影响直接

### 4.2 Reference Task

负责主数据、关系和基础信息。

典型任务：

- `sync-stock-basics`
- `sync-industry-concept`

特征：

- 中低频
- 数据变化慢
- 写 reference / relation 表

### 4.3 Fact Task

负责季度、报告期或深层事实。

典型任务：

- `sync-finance-data`

特征：

- 低频
- 更偏 canonical fact
- 不一定直接用于首页

### 4.4 Async Enrich Task

负责详情补抓和按需增强。

当前仓库尚未正式落地，但未来应该进入这一类：

- 个股新闻正文抓取
- 基金经理/持仓补抓
- 某主题热点详情页补抓

特征：

- 用户行为触发或后台队列触发
- 非 cron 优先
- 对详情页质量提升明显

## 5. 当前架构的正确边界

### 5.1 Python 只做 source connector

Python 脚本应该继续负责：

- 调第三方库
- 抓数据
- 输出 JSON

不应该承担：

- SQL 写入
- 幂等判断
- 页面字段组织

### 5.2 TypeScript task 负责 ingestion

TypeScript 任务负责：

- 数据完整性校验
- 入库事务
- 去重和 upsert
- 同步日志
- 清理旧数据

### 5.3 Control-plane 继续作为统一 serving 层

抓取任务的产物必须统一进入数据库，再由 control-plane API 对外服务。

不允许：

- 前端直接调用 Python 脚本
- 页面临时直连第三方源

## 6. 任务注册表

现有 `index.ts` 应收束为注册表驱动。

建议每个任务至少声明：

- `id`
- `label`
- `category`
- `schedule`
- `timezone`
- `warmupOnStartup`
- `run`

示例：

```ts
{
  id: 'market-news',
  label: '财经快讯同步',
  category: 'snapshot',
  schedule: '*/10 8-22 * * 1-5',
  timezone: 'Asia/Shanghai',
  warmupOnStartup: true,
  run: syncMarketNews,
}
```

这样做的好处：

- 新增任务不需要修改大量入口逻辑
- 后续可以直接做“按分类启停”“按任务手动执行”“生成任务文档”

当前仓库已落地：

- `task-registry.ts`
- `run-sync-task.ts --list / --task`

## 6.1 执行记录层

建议把“任务执行”从具体任务本身抽出来，统一写入执行记录。

当前仓库已落地：

- `sync_task_runs` 表
- `execution-store.ts`
- `runner.ts`

执行记录至少应包含：

- `run_id`
- `task_id`
- `task_label`
- `category`
- `trigger_type`
- `schedule`
- `status`
- `started_at`
- `finished_at`
- `duration_ms`
- `sync_count`
- `data_source`
- `error_message`

这样 cron、warmup、手工触发就能共用一套 execution log，而不是只在各任务内部零散写日志。

## 7. Freshness 设计

不同任务的 freshness 不能靠约定俗成。

建议在架构上明确：

- `stock-quotes`
  - 交易时段高频
  - freshness: 分钟级
- `market-overview`
  - 依赖 quotes 和指数
  - freshness: 分钟级
- `market-news`
  - freshness: 5-10 分钟级
- `stock-basics`
  - freshness: 日级
- `finance-data`
  - freshness: 季度级

后续应把 freshness 暴露到：

- snapshot 表
- API 字段
- UI 提示

## 8. Warmup 设计

当前已经有 startup warmup：

- `market-overview`
- `market-news`

这条路径是对的，但长期应该遵循两个原则：

1. 只有直接影响首页/头部/基础体验的 snapshot 任务才能 warmup
2. warmup 失败只能降级，不能阻塞 control-plane 启动

因此：

- `market-overview`、`market-news` 适合 warmup
- `finance-data` 不适合 warmup
- `industry-concept` 通常也不应阻塞启动

## 8.1 多实例防重

当前定时任务仍然跑在 `control-plane` 进程内，因此一旦进入多实例部署，必须解决“同一个 cron 在多个副本上同时触发”的问题。

推荐做法：

- 在数据库中维护 `sync_task_leases`
- runner 执行前先尝试获取 `task_id` 对应 lease
- 未获取到 lease 的实例直接把本次 run 标记为 `skipped`
- 获取到 lease 的实例负责实际执行
- 任务正常结束后主动释放 lease
- 任务异常退出时依赖 `leased_until` 超时恢复

这意味着：

- 调度器仍可以暂时留在 `control-plane`
- 但多实例部署不会重复抓同一份数据
- 后续即使接入 XXL-JOB / K8s CronJob，也可以复用同一套 lease 逻辑

## 9. 手工触发与运维

当前已经新增：

- `sync:market-overview`
- `sync:market-news`
- 以及建议统一的 `run-sync-task.ts`

当前已经可用：

- `pnpm --filter @iclaw/control-plane sync:task -- --list`
- `pnpm --filter @iclaw/control-plane sync:task -- --task market-news`

这条方向也应该继续保留，并统一成标准模式。

每个任务未来都应支持：

- cron 自动执行
- 手工脚本执行
- 后台管理触发

建议统一入口：

- `scripts/run-sync-task.ts --task <task-id>`
- 后续 Admin API / XXL-JOB / K8s CronJob 都只调用这个 runner

## 10. Async Enrich 未来设计

基于现有结构，推荐新增一个轻量队列层，而不是直接把 enrich 混进 cron。

建议表：

- `market_enrich_jobs`

建议字段：

- `job_id`
- `job_type`
- `entity_type`
- `entity_id`
- `priority`
- `status`
- `attempt_count`
- `payload_json`
- `scheduled_at`
- `started_at`
- `finished_at`
- `last_error`

适用任务：

- 某只基金详情打开后触发“相关新闻补抓”
- 某只股票详情缺行业/主营业务时触发 enrich
- 某条新闻点击后抓正文

## 11. 失败与降级策略

### 11.1 单任务失败

- 只影响该任务对应的数据域
- 不能影响 control-plane 主服务启动

### 11.2 单数据源失败

- 优先 fallback 源
- 若无 fallback，则沿用旧 snapshot

### 11.3 数据不足

- task 层应有最低完整性校验
- 不满足阈值则回滚或拒绝覆盖现有 snapshot

## 12. 基于现有仓库的下一步建议

### 12.1 已完成

- `overview/news` schema
- `overview/news` API
- `overview/news` sync task
- startup warmup

### 12.2 下一步优先级

1. 把 `sync-tasks/index.ts` 改成注册表驱动
2. 给任务增加 category/freshness/warmup 元数据
3. 把基金详情 enrich 迁移到 async queue，而不是前端临时匹配
4. 增加任务观测面板或 admin API

## 13. Definition of Done

调度架构真正完成的标志不是“多了几个 cron”。

而是：

- 所有任务都有统一元数据
- 新增任务只需要注册，不需要复制入口逻辑
- snapshot / reference / fact / enrich 的边界清晰
- warmup 与 cron 的职责清晰
- 任务失败不会拖垮主服务
- 前端不再感知第三方抓取细节

这才是基于当前仓库可持续扩张的定时抓取架构。
