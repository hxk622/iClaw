# Client Metrics Event Dictionary V1

更新时间：2026-04-12

## 目标

定义 `iClaw` 客户端监控系统首期统一事件字典，作为：

- 客户端埋点实现基线
- control-plane 接口字段约束
- admin-web 看板与告警的统计口径来源

首期仅覆盖桌面端：

- `macOS`
- `Windows`

## 统一事件模型

所有事件都应尽量遵循同一结构：

### 公共字段

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `event_name` | string | 是 | 事件名 |
| `event_time` | string | 是 | ISO 时间 |
| `user_id` | string \| null | 否 | 登录用户 ID，安装期可空 |
| `device_id` | string | 是 | 设备唯一标识 |
| `session_id` | string \| null | 否 | 会话 ID |
| `install_id` | string \| null | 否 | 安装会话 ID |
| `app_name` | string | 是 | 应用标识 |
| `brand_id` | string | 是 | OEM 标识 |
| `app_version` | string | 是 | 客户端版本 |
| `release_channel` | string | 否 | `dev` / `prod` |
| `platform` | string | 是 | `macos` / `windows` |
| `os_version` | string | 否 | 操作系统版本 |
| `arch` | string | 是 | `x64` / `aarch64` |
| `page` | string \| null | 否 | 页面或场景 |
| `result` | string \| null | 否 | `success` / `failed` |
| `error_code` | string \| null | 否 | 错误码 |
| `duration_ms` | number \| null | 否 | 耗时 |
| `payload_json` | object | 否 | 扩展字段 |

### 命名约束

事件命名统一使用：

- 小写英文
- 下划线分词
- 动词放后缀

推荐：

- `install_start`
- `install_success`
- `install_failed`

避免：

- `InstallSuccess`
- `installSuccess`
- `install-ok`

## 首期事件分类

首期按 5 大类定义事件。

### 1. 下载与安装

#### `download_click`

说明：

- 用户点击下载按钮

补充字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `download_source` | string | 入口来源 |
| `target_platform` | string | 目标平台 |

#### `download_start`

说明：

- 客户端安装包下载开始

补充字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `artifact_url` | string \| null | 下载地址，可脱敏 |
| `package_size_bytes` | number \| null | 包大小 |

#### `download_complete`

说明：

- 安装包下载完成

补充字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `package_size_bytes` | number | 下载完成包大小 |

#### `download_failed`

说明：

- 安装包下载失败

补充字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `failure_stage` | string | DNS / TLS / timeout / canceled |

#### `install_start`

说明：

- 安装开始

补充字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `installer_type` | string \| null | dmg / exe / msi / nsis |

#### `install_success`

说明：

- 安装完成

补充字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `installer_type` | string \| null | 安装器类型 |

#### `install_failed`

说明：

- 安装失败

补充字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `failure_stage` | string | 安装失败阶段 |
| `error_title` | string \| null | 错误标题 |
| `error_message` | string \| null | 错误描述 |

### 2. 启动与生命周期

#### `app_launch_start`

说明：

- App 开始启动

补充字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `launch_type` | string | `cold` / `warm` |

#### `app_launch_success`

说明：

- App 启动完成，可进入主界面

补充字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `launch_type` | string | `cold` / `warm` |

#### `app_launch_failed`

说明：

- 启动失败

补充字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `failure_stage` | string | runtime_probe / startup_healthcheck 等 |
| `error_title` | string \| null | 错误标题 |
| `error_message` | string \| null | 错误描述 |

#### `runtime_healthcheck_failed`

说明：

- 本地 runtime 健康检查失败

补充字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `failure_stage` | string | healthcheck 失败阶段 |
| `port` | number \| null | 端口 |

#### `sidecar_exit_early`

说明：

- sidecar 在健康前退出

补充字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `exit_code` | string \| null | 退出码 |

### 3. 账号与核心业务

#### `login_success`

说明：

- 登录成功

#### `login_failed`

说明：

- 登录失败

补充字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `auth_provider` | string \| null | email / wechat / google |

#### `core_action_start`

说明：

- 核心功能开始执行

补充字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `action_name` | string | 核心动作名 |

#### `core_action_success`

说明：

- 核心功能成功

补充字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `action_name` | string | 核心动作名 |

#### `core_action_failed`

说明：

- 核心功能失败

补充字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `action_name` | string | 核心动作名 |

### 4. 性能采样

以下指标建议进入 `perf` 上报而不是通用事件表。

#### `cold_start_ms`

说明：

- 冷启动耗时

#### `warm_start_ms`

说明：

- 热启动耗时

#### `page_load_ms`

说明：

- 页面渲染完成耗时

补充字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `page` | string | 页面名 |

#### `api_latency_ms`

说明：

- API 请求耗时

补充字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `api_name` | string | 逻辑 API 名 |
| `status_code` | number \| null | HTTP 状态码 |

#### `memory_mb`

说明：

- 内存占用采样

#### `cpu_percent`

说明：

- CPU 占用采样

### 5. 稳定性与故障上报

#### `crash`

说明：

- 客户端 crash

补充字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `crash_type` | string | native / renderer / sidecar |
| `error_title` | string \| null | crash 标题 |
| `error_message` | string \| null | crash 描述 |

#### `fatal_error`

说明：

- 致命错误

#### `unhandled_exception`

说明：

- 未处理异常

#### `fault_report_submit_start`

说明：

- 用户点击故障上报并开始处理

补充字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `entry` | string | `installer` / `exception-dialog` |

#### `fault_report_submit_success`

说明：

- 故障上报成功

补充字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `entry` | string | 来源入口 |
| `report_id` | string | 故障编号 |
| `file_size_bytes` | number | 诊断包大小 |

#### `fault_report_submit_failed`

说明：

- 故障上报失败

补充字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `entry` | string | 来源入口 |
| `failure_stage` | string | collecting / compressing / uploading / server_record |

## 首期必须落地的事件集合

首期必须完成以下事件：

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

## 统计口径建议

### 安装成功率

```text
install_success / install_start
```

### 启动成功率

```text
app_launch_success / app_launch_start
```

### 核心功能成功率

```text
core_action_success / (core_action_success + core_action_failed)
```

### 故障上报成功率

```text
fault_report_submit_success / fault_report_submit_start
```

## 与现有文档关系

- 架构说明：
  - [client-metrics-monitoring-architecture.md](../architecture/client-metrics-monitoring-architecture.md)
- 表结构与 API：
  - `client-metrics-schema-and-api-v1.md`
