# Client Metrics Schema And API V1

更新时间：2026-04-12

## 目标

定义客户端指标监控系统首期的：

1. PostgreSQL 表结构建议
2. control-plane API 草案
3. 聚合与告警落地边界

本文件作为开发参考文档，不要求与现有数据库一字不差，但要求：

- 能直接指导建表
- 能直接指导 control-plane 路由设计
- 能直接指导 admin-web 看板取数

## 架构前提

首期架构基线：

- 结构化数据：`PostgreSQL`
- 大对象：`S3 / MinIO`
- 接入层：`services/control-plane`
- 展示层：`admin-web`

## PostgreSQL 表结构

### 1. `client_metric_events`

用途：

- 存业务事件原始明细

建议字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | uuid / text | 主键 |
| `event_name` | text | 事件名 |
| `event_time` | timestamptz | 事件发生时间 |
| `user_id` | uuid null | 用户 ID |
| `device_id` | text | 设备 ID |
| `session_id` | text null | 会话 ID |
| `install_id` | text null | 安装会话 ID |
| `app_name` | text | 应用标识 |
| `brand_id` | text | OEM 标识 |
| `app_version` | text | 客户端版本 |
| `release_channel` | text null | 发布通道 |
| `platform` | text | 平台 |
| `os_version` | text null | OS 版本 |
| `arch` | text | 架构 |
| `page` | text null | 页面 / 场景 |
| `result` | text null | 结果 |
| `error_code` | text null | 错误码 |
| `duration_ms` | integer null | 耗时 |
| `payload_json` | jsonb | 扩展字段 |
| `created_at` | timestamptz | 入库时间 |

建议索引：

- `idx_client_metric_events_name_time`
  - `(event_name, event_time desc)`
- `idx_client_metric_events_version_time`
  - `(app_version, event_time desc)`
- `idx_client_metric_events_platform_time`
  - `(platform, event_time desc)`
- `idx_client_metric_events_device_time`
  - `(device_id, event_time desc)`

### 2. `client_perf_samples`

用途：

- 存性能采样明细

建议字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | uuid / text | 主键 |
| `metric_name` | text | 指标名 |
| `metric_time` | timestamptz | 采样时间 |
| `user_id` | uuid null | 用户 ID |
| `device_id` | text | 设备 ID |
| `app_name` | text | 应用标识 |
| `brand_id` | text | OEM 标识 |
| `app_version` | text | 版本 |
| `platform` | text | 平台 |
| `os_version` | text null | OS 版本 |
| `arch` | text | 架构 |
| `value` | numeric | 指标值 |
| `unit` | text | 单位 |
| `sample_rate` | numeric null | 采样率 |
| `payload_json` | jsonb | 扩展字段 |
| `created_at` | timestamptz | 入库时间 |

建议索引：

- `(metric_name, metric_time desc)`
- `(app_version, metric_time desc)`
- `(platform, metric_time desc)`

### 3. `client_crash_events`

用途：

- 存 crash / fatal / 未处理异常

建议字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | uuid / text | 主键 |
| `crash_type` | text | native / renderer / sidecar |
| `event_time` | timestamptz | 事件时间 |
| `user_id` | uuid null | 用户 ID |
| `device_id` | text | 设备 ID |
| `app_name` | text | 应用标识 |
| `brand_id` | text | OEM 标识 |
| `app_version` | text | 版本 |
| `platform` | text | 平台 |
| `os_version` | text null | OS 版本 |
| `arch` | text | 架构 |
| `error_title` | text null | 错误标题 |
| `error_message` | text null | 错误摘要 |
| `stack_summary` | text null | 栈摘要 |
| `file_bucket` | text null | 附件 bucket |
| `file_key` | text null | 附件对象 key |
| `created_at` | timestamptz | 入库时间 |

建议索引：

- `(app_version, event_time desc)`
- `(platform, event_time desc)`
- `(device_id, event_time desc)`

### 4. `client_fault_reports`

用途：

- 存故障上报结构化记录

说明：

- 现有 `desktop_fault_reports` 可作为该表的实现基础继续扩展

建议字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | text | 主键 |
| `report_id` | text | 对外上报编号 |
| `entry` | text | `installer` / `exception-dialog` |
| `account_state` | text | `anonymous` / `authenticated` |
| `user_id` | uuid null | 用户 ID |
| `device_id` | text | 设备 ID |
| `install_session_id` | text null | 安装会话 ID |
| `app_name` | text | 应用标识 |
| `brand_id` | text | OEM 标识 |
| `app_version` | text | 版本 |
| `release_channel` | text null | 发布通道 |
| `platform` | text | 平台 |
| `platform_version` | text null | 平台版本 |
| `arch` | text | 架构 |
| `failure_stage` | text | 失败阶段 |
| `error_title` | text | 错误标题 |
| `error_message` | text | 错误描述 |
| `error_code` | text null | 错误码 |
| `runtime_found` | boolean | 是否发现 runtime |
| `runtime_installable` | boolean | 是否可安装 |
| `runtime_version` | text null | runtime 版本 |
| `runtime_path` | text null | runtime 路径 |
| `work_dir` | text null | 工作目录 |
| `log_dir` | text null | 日志目录 |
| `runtime_download_url` | text null | runtime 下载来源 |
| `install_progress_phase` | text null | 当前阶段 |
| `install_progress_percent` | integer null | 当前进度 |
| `file_bucket` | text | bucket |
| `file_key` | text | 对象 key |
| `file_name` | text | 文件名 |
| `file_size_bytes` | bigint | 文件大小 |
| `file_sha256` | text null | 文件校验 |
| `created_at` | timestamptz | 创建时间 |

建议索引：

- `unique(report_id)`
- `(device_id, created_at desc)`
- `(user_id, created_at desc)`
- `(platform, created_at desc)`
- `(app_version, created_at desc)`

### 5. `client_metric_daily_agg`

用途：

- dashboard 日级聚合

建议字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `metric_date` | date | 统计日期 |
| `app_name` | text | 应用 |
| `brand_id` | text | OEM |
| `app_version` | text | 版本 |
| `platform` | text | 平台 |
| `metric_name` | text | 聚合指标名 |
| `metric_value` | numeric | 指标值 |
| `dimensions_json` | jsonb | 附加维度 |
| `updated_at` | timestamptz | 更新时间 |

建议聚合：

- 安装成功率
- 启动成功率
- crash rate
- 冷启动 P50 / P90 / P99
- 故障上报量

## S3 / MinIO 对象存储

### 用途

适合存放：

- 故障上报 zip
- crash dump
- 原始大日志

### Key 建议

```text
tenants/{tenant}/client-metrics/fault-reports/{report_id}/{file_name}
tenants/{tenant}/client-metrics/crashes/{event_id}/{file_name}
```

### 原则

- `PG` 只存元信息
- `S3/MinIO` 存文件实体

## Control-plane API 草案

首期建议以下 API。

### 1. 业务事件批量写入

`POST /portal/client-metrics/events`

请求体：

```json
{
  "items": [
    {
      "event_name": "install_start",
      "event_time": "2026-04-12T08:00:00.000Z",
      "user_id": null,
      "device_id": "D-001",
      "install_id": "install-001",
      "app_name": "iclaw",
      "brand_id": "iclaw",
      "app_version": "1.0.5",
      "platform": "windows",
      "arch": "x64",
      "result": "success",
      "payload_json": {}
    }
  ]
}
```

响应：

```json
{
  "accepted": 1
}
```

### 2. 性能采样写入

`POST /portal/client-metrics/perf`

请求体：

```json
{
  "items": [
    {
      "metric_name": "cold_start_ms",
      "metric_time": "2026-04-12T08:00:05.000Z",
      "device_id": "D-001",
      "app_name": "iclaw",
      "brand_id": "iclaw",
      "app_version": "1.0.5",
      "platform": "windows",
      "arch": "x64",
      "value": 1820,
      "unit": "ms",
      "sample_rate": 1
    }
  ]
}
```

响应：

```json
{
  "accepted": 1
}
```

### 3. 崩溃与稳定性事件

`POST /portal/client-metrics/crash`

请求体：

```json
{
  "crash_type": "renderer",
  "event_time": "2026-04-12T08:01:00.000Z",
  "device_id": "D-001",
  "app_name": "iclaw",
  "brand_id": "iclaw",
  "app_version": "1.0.5",
  "platform": "windows",
  "arch": "x64",
  "error_title": "Unhandled Exception",
  "error_message": "Cannot read property ...",
  "stack_summary": "..."
}
```

响应：

```json
{
  "id": "crash-001"
}
```

### 4. 故障上报

建议采用 multipart。

`POST /portal/client-metrics/fault-reports`

字段：

- `file`
- `payload`

其中 `payload` 示例：

```json
{
  "report_id": "FR-ABC123",
  "entry": "installer",
  "account_state": "anonymous",
  "device_id": "D-001",
  "install_session_id": "install-001",
  "app_name": "iclaw",
  "brand_id": "iclaw",
  "app_version": "1.0.5",
  "release_channel": "prod",
  "platform": "windows",
  "platform_version": "Windows 11",
  "arch": "x64",
  "failure_stage": "runtime_install",
  "error_title": "Runtime Installation Failed",
  "error_message": "permission denied",
  "runtime_found": false,
  "runtime_installable": true
}
```

响应：

```json
{
  "id": "fault-001",
  "report_id": "FR-ABC123",
  "download_url": "..."
}
```

## Admin-web 取数建议

### 看板页

建议查聚合表：

- `client_metric_daily_agg`

### 明细页

建议查原始表：

- `client_metric_events`
- `client_perf_samples`
- `client_crash_events`
- `client_fault_reports`

### 故障上报页

建议能力：

- 列表
- 详情
- 下载 zip
- 查看同设备历史

## 告警落地建议

首期基于聚合表定时扫描即可。

建议告警规则：

- 安装成功率 < 99%
- 启动成功率 < 99.5%
- crash rate > 0.3%
- 核心功能成功率 < 99.5%

建议新增表：

### `client_metric_alerts`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | uuid / text | 主键 |
| `metric_name` | text | 指标名 |
| `scope_type` | text | `global` / `brand` / `version` / `platform` |
| `scope_key` | text | 作用域键 |
| `severity` | text | `warning` / `critical` |
| `current_value` | numeric | 当前值 |
| `threshold_value` | numeric | 阈值 |
| `status` | text | `open` / `resolved` |
| `summary` | text | 告警摘要 |
| `created_at` | timestamptz | 创建时间 |
| `resolved_at` | timestamptz null | 解除时间 |

## 首期实施顺序

### Phase 1

- `client_metric_events`
- `client_fault_reports`
- 安装 / 启动 / crash / 故障上报接入
- admin-web 基础看板

### Phase 2

- `client_perf_samples`
- 性能采样
- 聚合表

### Phase 3

- 告警表
- 定时扫描告警
- 版本健康快照

## 与现有文档关系

- 上层架构说明：
  - [client-metrics-monitoring-architecture.md](../architecture/client-metrics-monitoring-architecture.md)
- 事件字典：
  - [client-metrics-event-dictionary-v1.md](./client-metrics-event-dictionary-v1.md)
