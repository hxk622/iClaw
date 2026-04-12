# Client Metrics Monitoring Architecture

更新时间：2026-04-12

## 目标

为 `iClaw` 桌面客户端建立一套统一的客户端指标监控体系，覆盖：

1. 下载与安装
2. 启动与性能
3. 稳定性与异常
4. 用户行为与核心功能成功率
5. 故障上报与排障闭环

本文档定义 `客户端 -> control-plane -> PostgreSQL + S3/MinIO -> admin-web` 的最小可行架构，不引入额外消息队列或数仓作为首期前置条件。

## 范围

首期适用：

- `macOS` 桌面客户端
- `Windows` 桌面客户端

首期不包含：

- HarmonyOS 客户端实际采集实现
- Kafka / ClickHouse / TimescaleDB 等重型监控基础设施
- 自动静默上传全量日志

## 总体架构

```text
Desktop Client
  ├─ 业务事件埋点
  ├─ 性能采样
  ├─ 崩溃/异常上报
  └─ 故障上报诊断包
        ↓
Control Plane
  ├─ 鉴权 / 匿名接入
  ├─ 数据校验
  ├─ 原始事件入库 PostgreSQL
  ├─ 大对象写入 S3/MinIO
  ├─ 聚合任务
  └─ 告警任务
        ↓
PostgreSQL
  ├─ 原始事件表
  ├─ 性能样本表
  ├─ 崩溃事件表
  ├─ 故障上报表
  └─ 聚合表
        ↓
S3 / MinIO
  ├─ 故障上报 zip
  ├─ crash dump
  └─ 大日志附件
        ↓
admin-web
  ├─ 安装与启动看板
  ├─ 稳定性看板
  ├─ 性能看板
  └─ 故障上报中心
```

## 为什么采用这套架构

现有仓库已经具备：

- `services/control-plane`
- `PostgreSQL`
- `admin-web`
- `S3/MinIO` 风格对象存储

因此首期最短路径是：

1. 客户端把事件和诊断数据发给 `control-plane`
2. `control-plane` 直接落 `PostgreSQL`
3. 大文件落 `S3/MinIO`
4. `admin-web` 直接读取 PG 聚合结果与明细

避免一开始引入 Kafka / 数仓 / 时序数据库，降低系统复杂度与落地成本。

## 数据分类

客户端监控数据分为 4 类：

### 1. 业务事件

用途：

- 安装漏斗
- 登录转化
- 核心功能成功率
- 留存与活跃分析

典型事件：

- `download_click`
- `download_start`
- `download_complete`
- `install_start`
- `install_success`
- `install_failed`
- `app_launch_start`
- `app_launch_success`
- `app_launch_failed`
- `login_success`
- `login_failed`
- `core_action_success`
- `core_action_failed`

### 2. 性能指标

用途：

- 启动性能
- 页面性能
- 资源占用监控

典型指标：

- `cold_start_ms`
- `warm_start_ms`
- `page_load_ms`
- `api_latency_ms`
- `memory_mb`
- `cpu_percent`

### 3. 稳定性事件

用途：

- crash rate
- fatal error 定位
- 版本质量判断

典型事件：

- `crash`
- `fatal_error`
- `unhandled_exception`
- `runtime_healthcheck_failed`
- `sidecar_exit_early`

### 4. 故障上报

用途：

- 用户现场排障
- 管理后台下载日志包

内容：

- 结构化元信息入 PG
- zip 诊断包入 S3/MinIO

## 指标采集原则

### 必须保证开始 / 成功 / 失败成对

例如安装链路：

- `install_start`
- `install_success`
- `install_failed`

这样才能计算：

- 成功率
- 耗时
- 漏斗转化

### 所有事件必须带关键维度

至少包含：

- `app_version`
- `platform`
- `os_version`
- `device_id`

否则无法按版本、平台、系统定位问题。

### 大对象与结构化数据分离

- `PostgreSQL` 存结构化字段
- `S3/MinIO` 存 zip / dump / 大日志

## 客户端埋点字段规范

所有客户端事件建议共享以下公共字段：

| 字段 | 说明 |
| --- | --- |
| `event_name` | 事件名 |
| `event_time` | 事件时间 |
| `user_id` | 用户 ID，可空 |
| `device_id` | 设备 ID，必填 |
| `session_id` | 会话 ID |
| `install_id` | 安装会话 ID |
| `app_name` | 应用标识 |
| `brand_id` | OEM brand |
| `app_version` | 客户端版本 |
| `release_channel` | `dev` / `prod` |
| `platform` | `macos` / `windows` |
| `os_version` | 操作系统版本 |
| `arch` | `x64` / `aarch64` |
| `page` | 页面或场景 |
| `result` | `success` / `failed` |
| `error_code` | 错误码，可空 |
| `duration_ms` | 耗时，可空 |
| `payload_json` | 扩展字段 |

## PostgreSQL 表设计

首期建议至少建立 5 张表。

### 1. `client_metric_events`

存业务埋点原始事件。

关键字段：

- `id`
- `event_name`
- `event_time`
- `user_id`
- `device_id`
- `session_id`
- `install_id`
- `app_name`
- `brand_id`
- `app_version`
- `release_channel`
- `platform`
- `os_version`
- `arch`
- `page`
- `result`
- `error_code`
- `duration_ms`
- `payload_json`
- `created_at`

推荐索引：

- `(event_name, event_time desc)`
- `(app_version, event_time desc)`
- `(platform, event_time desc)`
- `(device_id, event_time desc)`

### 2. `client_perf_samples`

存性能指标采样。

关键字段：

- `id`
- `metric_name`
- `metric_time`
- `user_id`
- `device_id`
- `app_name`
- `brand_id`
- `app_version`
- `platform`
- `os_version`
- `arch`
- `value`
- `unit`
- `sample_rate`
- `payload_json`
- `created_at`

推荐索引：

- `(metric_name, metric_time desc)`
- `(app_version, metric_time desc)`
- `(platform, metric_time desc)`

### 3. `client_crash_events`

存 crash / fatal / 未处理异常。

关键字段：

- `id`
- `crash_type`
- `event_time`
- `user_id`
- `device_id`
- `app_name`
- `brand_id`
- `app_version`
- `platform`
- `os_version`
- `arch`
- `error_title`
- `error_message`
- `stack_summary`
- `file_bucket`
- `file_key`
- `created_at`

推荐索引：

- `(app_version, event_time desc)`
- `(platform, event_time desc)`
- `(device_id, event_time desc)`

### 4. `client_fault_reports`

存故障上报结构化记录。

说明：

- 该表与现有 `desktop_fault_reports` 语义一致，可直接作为客户端排障中心核心表
- 诊断包实体存对象存储

关键字段：

- `id`
- `report_id`
- `entry`
- `account_state`
- `user_id`
- `device_id`
- `install_session_id`
- `app_name`
- `brand_id`
- `app_version`
- `release_channel`
- `platform`
- `platform_version`
- `arch`
- `failure_stage`
- `error_title`
- `error_message`
- `error_code`
- `file_bucket`
- `file_key`
- `file_size_bytes`
- `sha256`
- `created_at`

推荐索引：

- `(report_id)`
- `(device_id, created_at desc)`
- `(user_id, created_at desc)`
- `(platform, created_at desc)`
- `(app_version, created_at desc)`

### 5. `client_metric_daily_agg`

存 dashboard 聚合结果。

关键字段：

- `metric_date`
- `app_name`
- `brand_id`
- `app_version`
- `platform`
- `metric_name`
- `metric_value`
- `dimensions_json`
- `updated_at`

适合聚合：

- 安装成功率
- 启动成功率
- crash rate
- D1 / D7 / D30
- 冷启动 P50 / P90 / P99

## S3 / MinIO 存储设计

对象存储仅用于大对象，不承担 dashboard 查询职责。

适合存放：

- 故障上报 zip
- crash dump
- 原始日志包
- 大型性能快照

对象 Key 规范建议：

```text
tenants/{tenant}/client-metrics/fault-reports/{report_id}/{file_name}
tenants/{tenant}/client-metrics/crashes/{event_id}/{file_name}
```

PG 中只存：

- `bucket`
- `object_key`
- `size_bytes`
- `sha256`

## Control-plane 接口设计

首期建议 4 类接入接口。

### 1. 业务事件

`POST /portal/client-metrics/events`

用途：

- 安装
- 启动
- 登录
- 核心功能

### 2. 性能采样

`POST /portal/client-metrics/perf`

用途：

- 启动耗时
- 页面耗时
- CPU / 内存采样

### 3. 稳定性事件

`POST /portal/client-metrics/crash`

用途：

- crash
- fatal error
- unhandled exception

### 4. 故障上报

`POST /portal/client-metrics/fault-reports`

说明：

- 结构化元信息 + 文件上传
- 可拆为两段：
  - 先传文件
  - 再创建记录

首期为了简化，也可采用单接口 multipart 上传。

## 客户端上报策略

### 实时上报

适用于：

- `install_failed`
- `app_launch_failed`
- `login_failed`
- `payment_failed`
- `crash`
- `fault_report_submit`

### 批量上报

适用于：

- 普通业务事件
- 性能采样
- 低优先级状态事件

建议：

- 本地队列缓存
- 定时 flush
- 指数退避重试
- 弱网保留

### 采样原则

性能数据不应全量上报。

建议：

- CPU / 内存按采样率上报
- 高频事件本地聚合后上报
- 关键失败事件全量上报

## 聚合与定时任务

control-plane 内增加定时任务：

1. 原始事件聚合到小时表 / 日表
2. 生成版本健康快照
3. 扫描异常版本
4. 触发告警

建议频率：

- 小时聚合：每 5 分钟
- 日聚合：每小时
- 告警扫描：每 5 分钟

## Admin-web 模块设计

建议新增或明确以下后台模块：

### 1. 安装与启动看板

核心指标：

- 下载完成率
- 安装成功率
- 启动成功率
- 安装失败 TopN
- 启动失败 TopN

### 2. 稳定性看板

核心指标：

- crash rate
- fatal error rate
- runtime healthcheck failed
- 版本错误 TopN

### 3. 性能看板

核心指标：

- 冷启动 P50 / P90 / P99
- 热启动 P50 / P90 / P99
- 页面加载耗时
- 内存 / CPU 分布

### 4. 故障上报中心

核心能力：

- 列表
- 筛选
- 详情
- 下载诊断包
- 查看同设备历史

## 告警设计

首期告警不需要实时流式计算，建议基于聚合结果定时扫描。

建议阈值：

- 安装成功率 < 99%
- 启动成功率 < 99.5%
- crash rate > 0.3%
- 核心功能成功率 < 99.5%
- 某版本错误量 5 分钟内异常激增

告警记录建议落表：

- `client_metric_alerts`

关键字段：

- `id`
- `metric_name`
- `scope_type`
- `scope_key`
- `severity`
- `current_value`
- `threshold_value`
- `status`
- `summary`
- `created_at`
- `resolved_at`

## 首期最重要的事件集合

建议首批只做这些：

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

## 最小可行落地顺序

### Phase 1

- 接入安装 / 启动 / crash / 故障上报
- 建原始表
- admin-web 做安装与稳定性基础看板

### Phase 2

- 接入性能采样
- 建日聚合表
- 增加版本健康看板

### Phase 3

- 增加自动告警
- 增加留存与功能渗透率
- 增加更细的平台 / 版本 / 设备兼容分析

## 与当前仓库的映射关系

建议直接复用现有模块：

- 接入层：`services/control-plane`
- 明细库：`PostgreSQL`
- 大对象：`S3 / MinIO`
- 后台：`admin-web`
- 故障上报中心：复用现有 `desktop_fault_reports` 体系继续扩展

## 结论

首期客户端监控系统不需要额外引入重型中间件。

最合适的落地形态是：

1. 客户端埋点与异常上报
2. `control-plane` 统一接入与聚合
3. `PostgreSQL` 存结构化事件与聚合结果
4. `S3 / MinIO` 存诊断包与大对象
5. `admin-web` 提供看板、明细、下载与告警入口

这套方案与当前仓库形态一致，投入最小，能最快形成安装质量、启动质量、稳定性与排障能力的统一闭环。
