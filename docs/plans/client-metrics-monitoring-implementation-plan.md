# Client Metrics Monitoring Implementation Plan

更新时间：2026-04-12

## 目标

将客户端指标监控系统从文档方案推进到仓库内可实施任务，覆盖：

1. 桌面端埋点与本地缓存
2. control-plane 接入、入库、聚合与告警
3. admin-web 看板与明细页
4. 与现有故障上报体系打通

## 成功标准

满足以下条件即可认为首期落地完成：

- 安装 / 启动 / crash / 故障上报 / 核心功能事件可持续上报
- `PostgreSQL` 能查询原始明细
- `admin-web` 有基础看板与故障上报中心
- 支持版本、平台、系统维度筛选
- 首期告警规则可运行

## 与现有代码的映射

### 客户端

- `apps/desktop/src/app/`
- `apps/desktop/src/app/lib/`
- `apps/desktop/src-tauri/src/main.rs`

### 控制面

- `services/control-plane/src/server.ts`
- `services/control-plane/src/service.ts`
- `services/control-plane/src/store.ts`
- `services/control-plane/src/pg-store.ts`
- `services/control-plane/sql/`

### 管理后台

- `admin-web/src/App.tsx`
- `admin-web/src/lib/adminApi.ts`
- `admin-web/src/lib/adminTypes.ts`
- `admin-web/src/components/`

## 分阶段实施

### Phase 1: 事件接入底座

#### 目标

让桌面端可以将结构化指标数据上报到 control-plane。

#### 数据范围

- `install_start`
- `install_success`
- `install_failed`
- `app_launch_start`
- `app_launch_success`
- `app_launch_failed`
- `runtime_healthcheck_failed`
- `login_success`
- `login_failed`
- `core_action_success`
- `core_action_failed`
- `fault_report_submit_start`
- `fault_report_submit_success`
- `fault_report_submit_failed`
- `crash`

#### 任务

##### A. control-plane

新增表：

- `client_metric_events`
- `client_crash_events`

新增接口：

- `POST /portal/client-metrics/events`
- `POST /portal/client-metrics/crash`

建议代码位置：

- SQL: `services/control-plane/sql/`
- domain: `services/control-plane/src/domain.ts`
- store: `services/control-plane/src/store.ts`
- pg store: `services/control-plane/src/pg-store.ts`
- service: `services/control-plane/src/service.ts`
- server routes: `services/control-plane/src/server.ts`

##### B. desktop

新增统一埋点层：

- `apps/desktop/src/app/lib/client-metrics.ts`

建议暴露：

- `trackClientMetricEvent()`
- `trackClientCrash()`
- `flushClientMetricQueue()`

首批接入位置：

- 安装启动链路
  - `useDesktopStartupController`
  - `startup-gate`
- 登录链路
  - `App.tsx`
  - `tauri-auth.ts`
- 故障上报链路
  - `fault-report.ts`

### Phase 2: 性能采样

#### 目标

补齐启动和性能指标。

#### 数据范围

- `cold_start_ms`
- `warm_start_ms`
- `page_load_ms`
- `api_latency_ms`
- `memory_mb`
- `cpu_percent`

#### 任务

##### A. control-plane

新增表：

- `client_perf_samples`

新增接口：

- `POST /portal/client-metrics/perf`

##### B. desktop

新增性能采样模块：

- `apps/desktop/src/app/lib/client-metrics-perf.ts`

建议能力：

- 启动耗时计算
- 页面级加载耗时
- API 拦截耗时统计
- 低频 CPU / 内存采样

### Phase 3: 聚合与 dashboard

#### 目标

让 admin-web 不直接扫描原始事件表。

#### 任务

##### A. control-plane

新增聚合表：

- `client_metric_daily_agg`

新增定时聚合任务：

- 原始事件 -> 日聚合
- 原始性能 -> P50 / P90 / P99 聚合

建议先用：

- control-plane 定时任务
- 或现有 cron/ops 机制

##### B. admin-web

新增页面：

- 安装与启动看板
- 稳定性看板
- 性能看板

建议代码位置：

- `admin-web/src/components/ClientMetricsOverviewPage.tsx`
- `admin-web/src/components/ClientMetricsStabilityPage.tsx`
- `admin-web/src/components/ClientMetricsPerformancePage.tsx`

### Phase 4: 告警与版本健康

#### 目标

形成可执行的版本质量治理闭环。

#### 任务

##### A. control-plane

新增表：

- `client_metric_alerts`
- `client_release_health_snapshots`

新增定时扫描逻辑：

- 安装成功率阈值
- 启动成功率阈值
- crash rate 阈值
- 核心功能成功率阈值

建议首批阈值：

- 安装成功率 `< 99%`
- 启动成功率 `< 99.5%`
- crash rate `> 0.3%`
- 核心功能成功率 `< 99.5%`

##### B. admin-web

新增：

- 版本健康列表
- 告警列表
- 告警详情

## 数据表拆解

### `client_metric_events`

首期职责：

- 业务事件原始表

高频查询场景：

- 某版本安装失败
- 某平台启动失败
- 某功能失败率

### `client_perf_samples`

首期职责：

- 性能采样原始表

高频查询场景：

- 冷启动分布
- 页面耗时
- CPU / 内存异常

### `client_crash_events`

首期职责：

- crash / fatal / 未处理异常

高频查询场景：

- 某版本 crash 激增
- 某系统 crash TopN

### `client_fault_reports`

首期职责：

- 现场排障

说明：

- 该表可基于现有 `desktop_fault_reports` 继续扩展

### `client_metric_daily_agg`

首期职责：

- admin-web dashboard 聚合表

## API 设计落点

### `POST /portal/client-metrics/events`

实现建议：

- 支持批量 `items`
- 限制单次条数
- 限制 payload 体积

### `POST /portal/client-metrics/perf`

实现建议：

- 支持批量 `items`
- 限制采样量

### `POST /portal/client-metrics/crash`

实现建议：

- 支持可选 crash 附件
- crash dump 走 S3 / MinIO

### `POST /portal/client-metrics/fault-reports`

实现建议：

- 直接复用当前故障上报链路
- 让监控体系与故障排查共用数据

## admin-web 页面建议

### 1. 安装与启动

卡片：

- 下载完成率
- 安装成功率
- 启动成功率
- 启动失败量

表格：

- 失败 TopN 版本
- 失败 TopN 平台

### 2. 稳定性

卡片：

- crash rate
- fatal error 数
- runtime healthcheck fail 数

表格：

- 错误 TopN
- 版本 TopN

### 3. 性能

卡片：

- 冷启动 P50/P90/P99
- 热启动 P50/P90/P99
- 页面耗时 P90

表格：

- 慢页面
- 慢接口

### 4. 故障上报

建议继续复用：

- 已有故障上报列表
- 详情页
- 诊断包下载

## 桌面端代码接入建议

### 统一埋点入口

建议不要分散调用 fetch。

统一模块：

- `client-metrics.ts`

内部负责：

- 公共字段拼装
- 本地队列
- 批量 flush
- 弱网重试

### 关键接入点

#### 安装 / 启动

- `useDesktopStartupController.ts`
- `startup-gate.ts`
- `App.tsx`

#### 登录

- `tauri-auth.ts`
- `App.tsx`

#### 故障上报

- `fault-report.ts`
- `FaultReportModal.tsx`

#### 异常

- `GlobalExceptionDialog.tsx`
- 全局 `error` / `unhandledrejection` 监听

## 风险与注意事项

### 1. 不要过早引入重型基础设施

首期不建议：

- Kafka
- ClickHouse
- Flink

### 2. 不要把所有日志都落 PG

大对象必须放：

- S3 / MinIO

### 3. 不要缺关键维度

至少保证：

- `app_version`
- `platform`
- `os_version`
- `device_id`

### 4. 不要只记录成功

每个核心漏斗都必须有：

- `start`
- `success`
- `failed`

## 建议实施顺序

1. 先建事件表和 crash 表
2. 先接安装 / 启动 / 登录 / crash / 故障上报
3. 先出 admin-web 安装与稳定性看板
4. 再补性能采样
5. 再补日聚合
6. 最后补告警

## 配套文档

- [客户端监控架构](../architecture/client-metrics-monitoring-architecture.md)
- [事件字典 V1](../reference/client-metrics-event-dictionary-v1.md)
