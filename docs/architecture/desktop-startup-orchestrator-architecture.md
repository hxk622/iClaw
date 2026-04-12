# Desktop Startup Orchestrator Architecture

更新时间：2026-04-08

## 1. 文档目的

本文定义桌面端启动链路的统一编排模型，用于替代当前分散在 React state、Rust probe、sidecar health check 之间的隐式布尔组合判断。

本文解决的问题不是“某个错误页文案不准确”，而是更底层的架构问题：

- 启动阶段没有单一真值
- UI 自行从多个布尔量推断当前阶段
- 可恢复中间态容易被误判成失败态
- 新增启动步骤时，旧条件分支容易漏改

## 2. 现状问题

当前桌面启动门禁主要依赖以下并行信号：

- `runtimeChecking`
- `runtimeInstalling`
- `runtimeReady`
- `runtimeInstallError`
- `runtimeDiagnosis`
- `healthChecking`
- `healthy`
- `healthError`
- `initialHealthResolved`

这些信号本身是合理的事实层输入，但不应直接成为 UI 判定层真相。

现状的主要问题：

1. 同一个“尚未完成探测”的中间态，可能被不同分支解释为不同错误。
2. React effect 的执行顺序与异步返回顺序耦合，容易出现先闪失败页、再恢复的体验问题。
3. 启动阶段的“可恢复失败”和“终局失败”没有统一分级。
4. `shouldShowStartupGate` 与 `buildInstallerViewModel` 各自维护一套推断逻辑，存在漂移风险。

## 3. 目标架构

### 3.1 单一启动真值

桌面端启动 UI 不再直接消费散落布尔量，而是统一消费一个纯计算得到的 `DesktopStartupSnapshot`：

- `state`: `loading | error | ready`
- `phase`: 当前精确阶段
- `shouldShowGate`: 是否展示启动门禁
- `shouldShowError`: 当前是否允许展示失败态

### 3.2 分层职责

启动架构拆为 4 层：

1. `Probe Layer`
   - 采集事实
   - 例如 runtime 是否存在、skills/mcp 是否就绪、health 是否通过

2. `Orchestrator Layer`
   - 把事实解释为单一启动状态
   - 例如“runtime 已存在但资源未同步完”属于 `preparing_runtime_assets`

3. `Recovery Layer`
   - 负责执行修复动作
   - 例如安装 runtime、拉起 sidecar、等待健康检查

4. `Presentation Layer`
   - 只消费 `DesktopStartupSnapshot`
   - 不再自己推断失败态

## 4. 当前已落地的实现

当前仓库已新增两层核心实现：

- [startup-orchestrator.ts](/D:/code/iClaw/apps/desktop/src/app/lib/startup-orchestrator.ts)
- [use-desktop-startup-controller.ts](/D:/code/iClaw/apps/desktop/src/app/lib/use-desktop-startup-controller.ts)

### 4.1 状态编排层

`startup-orchestrator.ts` 具备以下特征：

- 纯函数、无副作用
- 只接收启动事实输入
- 输出标准化快照
- 同时供：
  - `buildInstallerViewModel`
  - `resolveShouldShowStartupGate`
  使用

这意味着：

- “是否展示启动页”
- “启动页展示 loading 还是 error”
- “当前属于哪一个阶段”

已经开始由同一层统一裁决，而不是由多个函数分别猜测。

### 4.2 启动控制层

`use-desktop-startup-controller.ts` 已把 `App.tsx` 中与启动链路直接相关的时序下沉为独立控制层，统一负责：

- runtime 诊断与首次安装
- sidecar 拉起与健康检查
- 失败后诊断日志回填
- retry setup 重试入口
- 向 UI 暴露单一的 installer view 与 gate visibility

这一步的意义是：

- `App.tsx` 不再直接维护大段启动 effect 编排
- 启动恢复动作与展示裁决开始解耦
- 后续要加入 retry budget、grace window、degraded mode 时，有明确落点

## 5. 启动阶段模型

当前统一阶段定义如下：

- `probing_runtime`
- `installing_runtime`
- `preparing_runtime_assets`
- `starting_local_service`
- `verifying_local_service`
- `ready`
- `blocked_missing_runtime_source`
- `blocked_runtime_install`
- `blocked_port_conflict`
- `blocked_local_service`

### 5.1 阶段语义

`probing_runtime`

- 启动事实还在收集
- 包括 `runtimeDiagnosis` 尚未返回
- UI 必须显示“检测中”

`installing_runtime`

- 正在下载、解压、校验 runtime
- 属于首次启动初始化，不属于安装器阶段

`preparing_runtime_assets`

- runtime 已存在
- 但 skills / MCP / workspace 等初始化产物仍在 catch-up
- 这类状态仍然属于 loading

`starting_local_service`

- runtime 已就绪
- 正在拉起 sidecar

`verifying_local_service`

- sidecar 已启动或疑似已启动
- 正在等待健康检查稳定通过

`blocked_missing_runtime_source`

- 明确确认：
  - runtime 不存在
  - 无可安装来源
- 才允许进入该失败态

`blocked_runtime_install`

- runtime 安装动作本身失败
- 例如下载、解压、校验失败

`blocked_port_conflict`

- sidecar 无法拉起或健康检查无法通过
- 且错误可明确归因为端口占用

`blocked_local_service`

- sidecar / health check 最终失败
- 且不属于端口冲突

## 6. 错误分级模型

### 6.1 可恢复错误

以下错误默认不应立即显示错误页：

- `runtimeDiagnosis` 尚未返回
- `runtime` 已存在但 `skills/mcp` 尚未同步完成
- `initialHealthResolved` 尚未完成
- health probe 仍处于 grace window

它们应展示为：

- 检测中
- 启动中
- 同步中
- 验证中

### 6.2 终局错误

只有以下情况才适合切换到错误页：

- 明确没有 runtime 来源
- runtime 安装已明确失败
- 本地端口冲突明确成立
- sidecar / health check 经过完整等待窗口后仍失败

## 7. 已修复的两类误判

### 7.1 `runtimeDiagnosis === null` 被误判为缺少 runtime 来源

现在只有在以下条件同时成立时才会进入 `blocked_missing_runtime_source`：

- `runtimeDiagnosis` 已返回
- `runtime_found === false`
- `runtime_installable === false`
- `runtimeReady === false`

### 7.2 `runtime` 已存在但初始化产物未完成，被误判为无可用 runtime 来源

现在当：

- `runtime_found === true`
- `skills_dir_ready === false` 或 `mcp_config_ready === false`

时，会进入 `preparing_runtime_assets`，保持 loading，而不是直接展示失败页。

## 8. 技术领先型总结

从技术竞争力角度，这套架构的价值不只是“修复闪错页”，而是把桌面启动链从脚本式流程升级为可演化的系统级编排。

领先性主要体现在：

1. **单一状态真值**
   - 避免多布尔组合导致的非法态
   - 启动 UI 与启动恢复逻辑共享同一语义层

2. **可恢复错误优先**
   - 系统先问“是否还能自动恢复”，再决定是否向用户宣告失败
   - 这比传统桌面客户端“一失败就报错”更稳健

3. **从事实层到产品层的可解释映射**
   - Probe 采集技术事实
   - Orchestrator 解释为产品阶段
   - 这是用户友好性与工程可维护性的共同基础

4. **便于未来扩展**
   - 后续新增：
     - OEM runtime snapshot 同步
     - 本地数据库迁移
     - 插件初始化
     - 运行时权限检查
   - 都可以通过新增 phase 接入，而不必继续堆布尔量

5. **天然适合高可用与容错设计**
   - 更容易引入：
     - grace window
     - retry budget
     - degraded mode
     - delayed failure escalation

## 9. 下一阶段建议

当前已经完成“状态编排层 + 启动控制层”的第一阶段落地。下一阶段建议继续推进：

1. 为 startup controller 引入显式 event model
   - `runtime_probe_completed`
   - `runtime_install_failed`
   - `sidecar_started`
   - `health_check_passed`
   - `health_check_timed_out`
2. 在 startup controller 内收敛 retry policy
   - 明确区分首次拉起、后台保活探测、手动重试
   - 为每类动作定义不同 budget 和 escalation 规则
3. 引入统一的 startup diagnostics timeline，替代当前按需拼接 stderr/stdout tail
4. 为未来 degraded mode 预留 phase
   - 允许部分能力可用时进入受限主界面，而不是只有 ready / failed 二元态

## 10. 参考实现与文档

- [desktop-lifecycle-session-architecture.md](./desktop-lifecycle-session-architecture.md)
- [openclaw-wrapper-architecture.md](./openclaw-wrapper-architecture.md)
- [startup-orchestrator.ts](/D:/code/iClaw/apps/desktop/src/app/lib/startup-orchestrator.ts)
- [use-desktop-startup-controller.ts](/D:/code/iClaw/apps/desktop/src/app/lib/use-desktop-startup-controller.ts)
- [startup-gate.ts](/D:/code/iClaw/apps/desktop/src/app/lib/startup-gate.ts)
- [App.tsx](/D:/code/iClaw/apps/desktop/src/app/App.tsx)
