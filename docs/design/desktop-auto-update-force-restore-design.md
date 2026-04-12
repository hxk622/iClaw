# Desktop Auto Update, Force Upgrade, And Scene Restore

更新时间：2026-04-10

## 1. 目标

- 支持桌面端常规更新提醒与应用内自动更新。
- 支持后端统一裁决的强制更新能力，便于早期快速收敛到稳定版本。
- 强更不打断当前任务；允许当前任务跑到终态后再执行升级。
- 强更完成后自动拉起应用，并尽可能恢复用户刚才的工作现场。
- 保持架构边界清晰：后端控制策略和裁决，前端负责状态承接和 UI 展示。

## 2. 非目标

- 不在第一阶段实现复杂灰度系统、百分比分流、按用户分层放量。
- 不在第一阶段恢复“进行中的 run”；只恢复页面现场、会话入口和草稿。
- 不依赖前端自行判断哪些版本该强更；前端只消费服务端下发的策略结果。

## 3. 当前基础

- Desktop 已具备更新提示、应用内检查、下载、安装、重启能力。
- Control-plane 已具备 `/desktop/update-hint`、`/desktop/update` 与常规 API 响应头顺带回传更新提示能力。
- 发布脚本已具备 installer、updater archive、signature、manifest 的生成与上传基础。
- 当前强更来源仍是环境变量，尚未形成正式后台配置。
- 当前“恢复现场”仅覆盖 workspace backup，不覆盖聊天现场、路由、草稿和升级前上下文。

## 3.1 当前落地策略

- Windows 不把 Tauri native updater 作为正式发版主链路依赖。
- Windows 强更主链路是：
  - control-plane 基于版本检查下发 `mandatory` / `enforcement_state`
  - 客户端命中强更后禁止继续发起新任务
  - 客户端自动获取 installer 下载地址
  - 客户端自动下载完整安装包
  - 客户端自动拉起安装器
  - 升级完成后自动重启应用，并恢复到退出前页面
- `updater` / `signature` 在 Windows 上属于可选增强能力，不是强更是否生效的前提条件。
- 因此，Windows 侧“是否能强更”与“是否具备 native updater”必须分开验证，不能混为一谈。

### 3.2 架构决策

本项目从 `1.0.4` 开始，Windows 升级策略正式定为：

- 决策名：`Windows Installer-Driven Force Upgrade`
- 决策级别：架构级，不作为临时 workaround
- 默认链路：
  - `update-hint` 负责版本裁决与强更策略
  - installer 下载链路负责实际升级
  - scene snapshot 负责升级后的工作现场恢复
- 不再把 `native updater availability` 作为 Windows 正式发版的前置条件
- 若某次发布额外支持 native updater，只能算增强项，不能替代主链路验收

这意味着：

- Windows 强更的真值来源是 `control-plane policy + release installer`
- 不是 `updater/signature`
- 不是桌面端本地自行比较版本
- 不是下载页上的手工文案

## 4. 总体原则

### 4.1 后端是策略源

后端负责：

- 判断是否有更新。
- 判断是否强更。
- 判断何时开始强更。
- 判断当前用户是否允许继续发起新任务。
- 为前端提供统一的 update policy / enforcement result。

前端不负责：

- 直接比较版本后自行决定是否强更。
- 根据本地业务状态独立裁决是否允许继续跑新任务。

### 4.2 前端负责状态承接

前端负责：

- 展示更新提示与强更提示。
- 感知“是否有活动任务”。
- 在活动任务结束后触发升级。
- 在升级前保存本地现场快照。
- 升级后自动恢复现场。

桌面端升级执行原则：

- Windows：默认走 installer 模式，不要求 native updater 可用。
- 若 native updater 可用，可作为补充能力，但不能成为 Windows 正式发版的单点依赖。
- 对用户暴露的产品体验目标保持一致：
  - 自动检查版本
  - 自动进入升级
  - 自动拉起安装
  - 自动恢复现场

### 4.3 Rust / Web 分层

Rust 端负责：

- 校验下载 URL、目标路径和文件名
- 下载 installer 到本地临时目录
- 产出可订阅的下载进度
- 在 Windows 上拉起 installer 进程
- 在进入升级前把最终可恢复所需的最小状态写盘
- 在重启后提供读取和清理恢复快照的能力

前端负责：

- 根据 `update-hint` 决定何时开始升级
- 统一封禁新任务入口
- 归集当前页面、路由、会话、草稿等恢复信息
- 调用 Rust 下载 / 拉起安装器命令
- 启动后读取恢复快照并还原 UI 现场

约束：

- 前端不直接自己下载大文件
- 前端不直接用浏览器打开下载页替代正式升级链路
- Rust 不负责业务级“当前 run 是否结束”的判断

## 5. 产品语义

定义三类更新状态：

- `recommended`
  - 普通更新提醒，可跳过。
- `required_after_run`
  - 强更，但若当前有活动任务，允许该任务跑完。
  - 当前活动任务结束前，不允许再发起新任务。
- `required_now`
  - 强更，且当前无活动任务，立即进入升级流程。
  - 不允许继续使用会产生新 run 的功能。

这里的关键点不是“mandatory=true”，而是明确区分：

- 是否必须升级
- 是否允许等待当前任务结束
- 是否阻止新任务创建

## 6. 服务端设计

### 6.1 更新元数据来源

保持双源结构：

- 版本清单与安装包元数据：来自 MinIO / manifest
- 强更策略：来自 control-plane 配置

不要把“最新版本”手工录到后台。后台只配置策略，不维护发布产物真相。

### 6.2 新的服务端裁决结果

在现有 `latest_version`、`update_available`、`mandatory` 基础上，扩展为更完整的裁决结果：

```json
{
  "latest_version": "1.4.7",
  "update_available": true,
  "mandatory": true,
  "enforcement_state": "required_after_run",
  "block_new_runs": true,
  "reason_code": "stability_hotfix",
  "reason_message": "当前版本存在已知问题，请完成当前任务后升级。",
  "manifest_url": "https://...",
  "artifact_url": "https://..."
}
```

字段含义：

- `mandatory`
  - 是否必须升级。
- `enforcement_state`
  - `recommended | required_after_run | required_now`
- `block_new_runs`
  - 前端是否必须禁止新任务入口。
- `reason_code`
  - 便于埋点、客服、后续规则扩展。
- `reason_message`
  - 直接给 UI 用的人话文案。

### 6.3 强更策略模型

新增 `desktop_update_policy` 概念，建议最小字段如下：

- `channel`
- `mandatory`
- `force_update_below_version`
- `reason_code`
- `reason_message`
- `allow_current_run_to_finish`
- `enabled`
- `updated_by`
- `updated_at`

策略解释：

- `mandatory=false`
  - 普通更新提醒。
- `mandatory=true` 且 `allow_current_run_to_finish=true`
  - 命中旧版本时，下发 `required_after_run` 或 `required_now`。
- `force_update_below_version`
  - 用于快速把低于某版本的用户整体收敛到稳定版。

### 6.4 裁决逻辑

服务端只基于版本和策略裁决“应该进入什么执法状态”，不依赖前端运行态：

1. manifest 判断是否存在更高版本。
2. policy 判断当前版本是否命中强更范围。
3. 若未命中强更：
   - `enforcement_state = recommended`
4. 若命中强更：
   - 默认下发 `block_new_runs = true`
   - 前端若当前有活动任务，则表现为 `required_after_run`
   - 前端若无活动任务，则表现为 `required_now`

说明：

- 服务端不需要知道桌面端是否正在跑任务。
- “是否正在跑任务”是本地运行态，只应由桌面端补充成最终 UI 状态。
- 但“是否必须升级、是否必须封禁新任务”必须是后端给出的裁决。

## 7. 桌面端状态机设计

### 7.1 本地状态

桌面端新增统一 update orchestrator，负责维护以下状态：

- `idle`
- `available_optional`
- `available_required_waiting_run`
- `available_required_blocking`
- `downloading`
- `ready_to_restart`
- `restoring_scene`
- `failed`

补充内部执行阶段：

- `preparing_upgrade`
- `saving_scene_snapshot`
- `downloading_installer`
- `launching_installer`
- `awaiting_app_restart`

### 7.2 运行态信号

桌面端需要统一抽象“是否存在活动任务”：

- 聊天 run 进行中
- cron / workflow run 进行中
- 其他会产生持续执行的任务

建议统一成：

- `hasActiveRun: boolean`
- `activeRunIds: string[]`

### 7.3 强更状态转换

1. 收到服务端结果为 `recommended`
   - 展示普通更新卡片
   - 允许跳过

2. 收到服务端结果为 `mandatory=true`
   - 立即关闭“跳过”能力
   - 立即禁止新任务入口

3. 若此时 `hasActiveRun=true`
   - 状态进入 `available_required_waiting_run`
   - UI 文案：当前任务完成后将自动升级

4. 若此时 `hasActiveRun=false`
   - 状态进入 `available_required_blocking`
   - 立即进入升级流程

5. 当活动任务从运行态转为终态
   - 若仍命中 mandatory，则自动开始升级

### 7.4 对业务入口的约束

命中强更后，所有“发起新 turn / 新执行”的入口统一禁用：

- composer 发送按钮
- slash command 执行入口
- workflow 创建入口
- 其他会消耗后端资源的新执行入口

浏览历史、查看结果、复制内容、导出内容等只读操作保持可用。

## 8. 升级前现场快照

### 8.1 设计目标

升级前保存一个轻量的本地 `scene snapshot`，用于升级后恢复用户现场。

这份快照是桌面端本地状态，不属于 control-plane 业务真相。

### 8.2 第一阶段需要保存的内容

- 当前页面路由
- 当前 `primaryView`
- 当前 `overlayView`
- 当前会话 `sessionKey`
- 当前 `conversationId`
- 当前聚焦轮次 `focusedTurnId`
- 最近一次可恢复的 prompt
- composer draft 文本
- composer 附件引用摘要
- 选中的模型
- 当前命中的更新版本
- 当前 installer URL
- 更新时间前的目标版本
- 快照创建时间

推荐数据结构：

```json
{
  "schemaVersion": 1,
  "reason": "desktop_force_upgrade",
  "targetVersion": "1.0.4",
  "installerUrl": "https://...",
  "createdAt": "2026-04-10T10:00:00.000Z",
  "scene": {
    "primaryView": "chat",
    "overlayView": null,
    "conversationId": "conv_xxx",
    "sessionKey": "agent:main:main",
    "focusedTurnId": "turn_xxx",
    "initialPrompt": null
  }
}
```

### 8.3 第一阶段不恢复的内容

- 精确滚动位置
- 半进行中的流式输出
- 未完成 run 的执行状态
- 临时浮层、hover、选区状态

### 8.4 存储位置

优先使用桌面端本地持久化：

- 首选：Tauri app data 内的本地状态文件
- 可接受的一阶段方案：localStorage

原则：

- 快照必须可在应用重启后读取。
- 恢复成功后必须清除，避免重复恢复。
- 若升级失败或版本未变化，不消费快照。

## 9. 升级后恢复设计

应用启动后执行：

1. 检查是否存在 `pending scene snapshot`
2. 校验当前版本是否已达到目标版本
3. 若达到：
   - 自动恢复路由和会话
   - 恢复 composer draft
   - 定位到最近上下文
   - 弹一条轻提示：已恢复升级前现场
4. 恢复完成后清理 snapshot

若恢复失败：

- 不阻塞应用正常进入首页
- 保留错误日志
- 给用户一条非阻断提示：升级成功，但未能完全恢复现场

恢复规则补充：

- 若 `targetVersion` 大于当前版本，不恢复，说明升级未真正完成
- 若 `snapshot` 超过 24 小时未消费，默认丢弃
- 若恢复引用的会话不存在，则退回到同一 `primaryView` 的默认入口，不阻塞启动
- 若恢复引用的草稿已失效，则只恢复页面和会话，不强行注入坏数据

## 10. 后台配置设计

需要有正式后台配置，不再只依赖环境变量。

最小后台能力：

- 开关某 channel 的强更
- 配置 `force_update_below_version`
- 配置原因文案
- 配置是否允许当前任务跑完
- 查看当前生效策略

建议限制：

- `latest_version` 始终来自 manifest，不允许后台手填
- 强更策略只针对已发布的版本区间生效

## 11. 第一阶段最小闭环

第一阶段先做最短可用链路，不做复杂调度：

1. control-plane 提供正式的强更策略结果
2. desktop 统一识别 `hasActiveRun`
3. 命中强更时禁用新任务入口
4. 若有活动任务，则等待终态
5. 终态后自动开始升级
6. 升级前写入本地 `scene snapshot`
7. 通过 Rust 下载 Windows installer
8. 通过 Rust 自动拉起安装器
9. 升级后自动恢复路由、会话和 composer draft

做到这一步，就已经满足：

- 运营可强更
- 不打断当前任务
- 升级后基本回到工作现场

## 11.1 `1.0.4` 首轮范围

`1.0.4` 是 Windows 新升级链路的第一轮 baseline 验证版本，范围固定如下：

- 包含：
  - `1.0.3 -> 1.0.4` 的 Windows 强更识别
  - 自动下载安装包
  - 自动拉起安装器
  - 升级完成后恢复到退出前页面
- 不包含：
  - 增量 patch 更新
  - 中断后断点续传
  - 多版本跳跃升级编排
  - 未完成 run 的恢复
  - 精确滚动位置恢复

验收对象：

- QA 机器先手工升到 `1.0.3`
- 然后用 `1.0.4` 验证新链路
- 不要求 `1.0.2` 直接兼容这套新实现

## 12. 第二阶段增强项

- 灰度发布与人群分层
- 后台查看各版本存量分布
- 更细的恢复能力，如滚动位置、面板状态
- 强更前倒计时与多次提醒策略
- 更新失败后的自动重试与回退优化

## 13. 实施顺序

### Phase 1

- 补 control-plane 强更策略模型与接口
- 扩展 desktop update hint contract
- 在 desktop 加入 force-upgrade orchestrator
- 封禁新任务入口
- 接入 run 终态监听
- 加入 Windows installer 下载与启动命令

### Phase 2

- 加入 scene snapshot 持久化
- 升级后恢复路由、会话、composer draft
- 完成异常路径和回退测试

### Phase 3

- 后台可视化配置
- 灰度与监控

## 14. 验收标准

- 普通更新仍可手动跳过。
- 命中强更后，用户不能再发起新任务。
- 若当前已有任务运行，不会被中断。
- 当前任务结束后自动触发升级。
- Windows 可自动下载安装包并拉起安装器。
- 升级后自动重启应用。
- 升级后能恢复到原页面、原会话，并恢复输入草稿。
- manifest 异常、签名异常、下载失败时有清晰提示且不会破坏现有可用状态。

## 15. 失败与回滚策略

- 若 installer 下载失败：
  - 保持当前应用继续可用
  - 保持强更拦截状态
  - 提供“重试升级”入口
- 若 installer 启动失败：
  - 保持当前应用继续可用
  - 保留已下载文件，允许重试
- 若升级后恢复失败：
  - 不视为升级失败
  - 记录日志并降级进入首页
- 若 `1.0.4` 首轮验证失败：
  - 继续保留 `update-hint + 手工下载链接` 作为应急回退链路
  - 不回退到“强依赖 native updater”的旧策略
