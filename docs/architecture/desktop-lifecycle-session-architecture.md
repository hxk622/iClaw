# Desktop Lifecycle, Bootstrap, And Session Recovery Architecture

更新时间：2026-04-07

补充阅读：

- [desktop-startup-orchestrator-architecture.md](./desktop-startup-orchestrator-architecture.md)

## 1. 目标

- 统一 `iClaw` 桌面端在 Windows 与 macOS 上的安装、首次启动初始化、日常启动、窗口关闭与应用退出语义。
- 明确 runtime 下载、解压、校验、sidecar 拉起、健康检查、认证恢复的阶段归属。
- 消除当前“安装阶段”和“首次启动初始化阶段”混用导致的产品与技术歧义。
- 为启动失败、终端弹窗、登录态丢失等问题提供统一架构边界。
- 形成后续实现、测试、文案和验收的共同依据。

## 2. 非目标

- 本文不直接修改当前 Tauri、OpenClaw 或 control-plane 实现。
- 本文不定义具体 UI 视觉稿，只定义用户可感知状态与行为边界。
- 本文不在第一阶段设计复杂灰度发布、A/B 或安装器多渠道裁决能力。
- 本文不将 OpenClaw kernel 改造成另一套 OEM 内核；重点仍是 wrapper 与 lifecycle orchestration。

## 3. 背景与现状

当前桌面端存在 4 类相互耦合的问题：

1. 首次启动时的 runtime 下载与部署被 UI 表述为“安装过程”。
2. 启动失败没有按阶段拆分，导致“安装失败”和“启动失败”混淆。
3. Windows 上 sidecar 启动时弹出终端窗口，暴露内部实现。
4. 用户执行 `Quit -> 双击重新打开` 后，登录态恢复不稳定。

现有代码证据表明，runtime 相关流程发生在应用启动后，而非安装器内部：

- [App.tsx](/D:/code/iClaw/apps/desktop/src/app/App.tsx#L1250)
- [main.rs](/D:/code/iClaw/apps/desktop/src-tauri/src/main.rs#L3932)
- [main.rs](/D:/code/iClaw/apps/desktop/src-tauri/src/main.rs#L4775)

这意味着当前真正缺失的不是单点修复，而是统一的桌面生命周期定义。

## 4. 核心结论

### 4.1 runtime 下载的阶段归属

`runtime 下载` 不属于安装阶段，属于首次启动初始化阶段。

原因：

- 技术实现上，它由桌面应用启动后执行，而不是由 Windows NSIS 或 macOS DMG 安装器执行。
- 产品语义上，Windows 用户对“安装”的理解是安装向导流程；macOS 用户对“安装”的理解是拖拽复制应用。
- 架构上，把 runtime 下载放在首次启动初始化阶段，更利于失败重试、跨平台一致性和安装器轻量化。

### 4.2 Quit 后冷启动的登录态标准

`Quit -> 双击图标重新打开` 是一次完整冷启动。  
冷启动后默认应保留登录态，除非：

- refresh token 已失效
- absolute session 已过期
- 用户主动登出
- 服务端显式吊销会话

### 4.3 OpenClaw/runtime 的用户感知定位

OpenClaw/runtime 对用户而言应是桌面应用的内部运行环境，而不是外部命令行工具。  
因此 sidecar 必须后台静默运行，不应弹终端窗口。

## 5. 生命周期分层

桌面端统一划分为 3 个阶段。

### 5.1 安装阶段

Windows：

- NSIS 安装器执行阶段

macOS：

- DMG 拖拽到 `Applications` 的阶段

职责：

- 安装 app 本体
- 注册快捷方式、卸载信息与系统元数据
- 完成签名、权限、最小前置条件检查

不负责：

- 下载 runtime
- 解压运行环境
- 拉起 OpenClaw sidecar
- 恢复认证状态
- 业务级 workspace 初始化

原则：

- 安装器必须轻量、可预测、可回滚。
- 不把强网络依赖和长耗时部署逻辑塞入安装器。

### 5.2 首次启动初始化阶段

定义：

- 用户第一次打开 app 后，为让应用达到“可运行”状态而执行的环境准备流程。

职责：

- 解析 runtime 来源
- 下载 runtime 包
- 解压、校验与写入 receipt
- 建立 workspace、cache、log、config 目录
- 准备 skills、MCP、品牌运行时快照
- 拉起 sidecar
- 执行健康检查
- 恢复认证状态
- 暴露可重试的初始化错误

原则：

- 首次启动初始化可以相对重，但必须可观测、可重试、可诊断。
- 失败后用户不应被迫重新安装 app。
- 该阶段不再使用“安装失败”文案。

### 5.3 日常启动阶段

定义：

- 完成首次初始化后的常规打开流程。

职责：

- 恢复窗口状态
- 恢复认证状态
- 复用或快速拉起 sidecar
- 执行轻量健康检查
- 必要时做小范围自修复

原则：

- 日常启动必须轻，不应重复下载大 runtime。
- 用户感知应是“打开应用”，而不是“再次部署环境”。

## 6. 平台差异与统一口径

### 6.1 平台统一点

Windows 与 macOS 必须统一：

- 三段生命周期定义
- runtime 属于首次启动初始化
- `Quit` 后冷启动的认证恢复目标
- sidecar 后台静默运行
- 错误分层与状态机

### 6.2 平台差异点

仅在交互层尊重平台习惯：

Windows：

- 托盘是主要后台入口
- 关闭窗口可映射为隐藏或最小化
- 托盘菜单负责 `打开 / 隐藏 / 退出`

macOS：

- 关闭窗口不等于退出 app
- `Cmd+Q` 或应用菜单 `Quit` 才是完整退出
- Dock 或菜单栏恢复窗口应遵循 macOS 习惯

结论：

- 生命周期与技术状态机统一
- 关闭与退出的 UI 入口按平台习惯适配

## 7. 启动链路分层

建议将启动链路抽象为以下步骤：

1. `app_installed`
2. `bootstrap_runtime_resolving`
3. `bootstrap_runtime_downloading`
4. `bootstrap_runtime_extracting`
5. `bootstrap_runtime_verifying`
6. `bootstrap_workspace_preparing`
7. `bootstrap_sidecar_starting`
8. `bootstrap_health_checking`
9. `bootstrap_session_restoring`
10. `ready`

好处：

- 失败位置明确
- 文案可按阶段展示
- 日志与诊断更易定位
- QA 可按阶段编写验证用例

## 8. 错误分层模型

当前“启动失败”应拆为 3 层。

### 8.1 安装层错误

定义：

- 应用本体没有被正确安装或无法被系统打开

示例：

- Windows NSIS 安装失败
- macOS 应用包损坏
- 签名、权限或拷贝异常导致 app 无法运行

用户文案：

- `安装失败`
- `应用未正确安装`

### 8.2 初始化层错误

定义：

- 首次启动所需运行环境未准备完成

示例：

- runtime 来源不可用
- runtime 下载失败
- 解压失败
- receipt 校验失败
- workspace 初始化失败
- 品牌运行时配置生成失败

用户文案：

- `首次启动初始化失败`
- `运行环境准备失败`

### 8.3 运行层错误

定义：

- 运行环境已准备完成，但 sidecar 或本地服务未正常工作

示例：

- sidecar 启动后立刻退出
- 端口冲突
- 健康检查失败
- runtime 可执行文件存在但不可用

用户文案：

- `启动失败`
- `本地服务未能成功拉起`

## 9. 关闭、隐藏、退出的统一行为定义

### 9.1 定义

- `关闭窗口`
  - 仅关闭或隐藏当前主窗口
- `隐藏`
  - 窗口不可见，但应用仍在后台运行
- `退出应用 / Quit`
  - 结束主进程及其关联后台进程
- `重新打开`
  - 若 app 仍在后台，则恢复窗口
  - 若 app 已 Quit，则执行冷启动

### 9.2 Windows 标准

- 点击主窗口关闭按钮：默认不直接 Quit，而是隐藏或最小化
- 托盘菜单提供：
  - `打开`
  - `隐藏`
  - `退出`
- 选择 `退出`：必须彻底结束主进程与 sidecar
- 之后双击图标重新打开：视为完整冷启动

### 9.3 macOS 标准

- 关闭窗口不等于退出应用
- `Cmd+Q` 或菜单 `Quit` 才是彻底退出
- Dock/menu bar 恢复窗口属于 app 恢复，不是重新安装或重新部署

### 9.4 设计要求

- 不允许用户面对语义不稳定的“关闭”行为。
- 同一关闭入口不应根据焦点状态随机表现为“隐藏”或“退出”。
- `Quit` 必须是强语义，且跨平台一致。

## 10. 会话与持久化架构

### 10.1 设计目标

- 完整 `Quit -> 冷启动重开` 后默认保持登录
- access token 失效时优先静默 refresh
- refresh token 失效或 absolute session 过期时才要求重新登录

### 10.2 存储职责分层

#### 系统安全存储

职责：

- 存储 access token、refresh token、gateway token

平台实现：

- Windows：Credential Manager / keyring
- macOS：Keychain

要求：

- 桌面端主认证真相必须在系统安全存储中

#### WebView 本地存储

职责：

- 保存 UI 偏好、轻量缓存、非安全敏感状态

要求：

- 不作为桌面端主认证唯一真相来源

#### Cookie / OAuth 过程态

职责：

- 支撑 Web/OAuth 临时流程

要求：

- 不作为完整桌面会话恢复的唯一依赖

### 10.3 标准恢复流程

冷启动后建议统一为：

1. 从系统安全存储读取 token
2. 若 access token 仍有效，则直接恢复
3. 若 access token 失效但 refresh token 有效，则静默刷新
4. 若 refresh token 也失效，进入登录态

### 10.4 服务端时效基线

当前 control-plane 默认值：

- access token：7 天
- refresh token：7 天
- absolute session：30 天

因此产品标准应至少满足：

- 在 token 未过期的情况下，冷启动不要求重新登录
- 在 access token 过期但 refresh token 仍有效时，静默恢复

## 11. Sidecar 与终端窗口策略

### 11.1 设计原则

sidecar 是内部运行时，不是外部工具。  
用户只应感知“应用正在准备本地服务”，不应感知 node、wrapper 或终端窗口。

### 11.2 平台标准

Windows：

- sidecar 必须无控制台窗口后台启动
- 不弹黑色终端
- stdout/stderr 仅进入日志与诊断面板

macOS：

- 不唤起 Terminal.app
- 不通过 shell window 暴露内部进程
- sidecar 作为 app 管理的后台子进程存在

### 11.3 日志与诊断要求

- sidecar 标准输出进入固定日志目录
- UI 提供用户可理解的错误摘要
- 深层细节进入诊断日志，不直接暴露到主界面

## 12. 建议状态机

建议桌面端生命周期状态机如下：

- `not_installed`
- `installed`
- `first_bootstrap_pending`
- `initializing`
- `ready`
- `degraded`
- `failed`

其中 `initializing` 细分为：

- `runtime_resolving`
- `runtime_downloading`
- `runtime_extracting`
- `runtime_verifying`
- `workspace_preparing`
- `sidecar_starting`
- `health_checking`
- `session_restoring`

状态含义：

- `ready`
  - 应用主功能可用
- `degraded`
  - 可进入主界面，但存在需提示用户的受限功能
- `failed`
  - 当前阶段无法继续，需要重试、诊断或重新登录

## 13. 文案规范

建议统一如下：

- 安装器失败：
  - `安装失败`

- 首次启动环境准备失败：
  - `首次启动初始化失败`
  - `运行环境准备失败`

- 本地服务拉起失败：
  - `启动失败`
  - `本地服务未能成功拉起`

- 会话恢复失败但应用仍可进入：
  - `未能恢复登录状态，请重新登录`

避免继续使用：

- `安装过程中断`
- 把 runtime 初始化类错误统称为 `安装失败`

## 14. 实施优先级

后续进入实现阶段时，建议按以下优先级推进：

1. 统一生命周期术语、错误分层和文案口径
2. 统一 `关闭 / 隐藏 / Quit / 冷启动` 的行为定义
3. 治理 sidecar 静默启动与终端弹窗问题
4. 补强认证恢复链路的可观测性与稳定性
5. 视产品策略决定 runtime 是按首次启动下载，还是随安装包预置

原因：

- 先统一边界，才能避免修复一个问题时继续制造新的语义冲突。

当前进展补充：

- 启动门禁的阶段裁决已下沉到统一 `startup orchestrator`
- `App.tsx` 中核心启动时序已进一步下沉到 `startup controller`
- 当前剩余工作重点已经从“消除布尔散落”转向“补齐 event model、retry policy、diagnostics timeline”

## 15. 验收标准

### 15.1 生命周期边界

- Windows 与 macOS 上，runtime 下载均被定义为首次启动初始化，而非安装器阶段。
- 所有用户文案不再把 runtime bootstrap 错误表述为安装失败。

### 15.2 启动体验

- 首次启动可展示明确初始化进度
- 日常启动不重复执行大 runtime 下载
- sidecar 启动不弹终端窗口

### 15.3 关闭与退出

- 用户可明确区分关闭窗口与退出应用
- `Quit` 后双击重开被视为冷启动
- 冷启动行为在 Windows 与 macOS 上可预测

### 15.4 会话恢复

- 用户执行 `Quit -> 重开` 后，在 token 仍有效时默认保留登录态
- access token 过期时优先静默 refresh
- refresh token 失效后才要求重新登录

## 16. 参考证据

- [App.tsx](/D:/code/iClaw/apps/desktop/src/app/App.tsx#L1250)
- [App.tsx](/D:/code/iClaw/apps/desktop/src/app/App.tsx#L1670)
- [App.tsx](/D:/code/iClaw/apps/desktop/src/app/App.tsx#L1682)
- [FirstRunSetupPanel.tsx](/D:/code/iClaw/apps/desktop/src/app/components/FirstRunSetupPanel.tsx)
- [auth-storage.ts](/D:/code/iClaw/apps/desktop/src/app/lib/auth-storage.ts#L76)
- [main.rs](/D:/code/iClaw/apps/desktop/src-tauri/src/main.rs#L1)
- [main.rs](/D:/code/iClaw/apps/desktop/src-tauri/src/main.rs#L1182)
- [main.rs](/D:/code/iClaw/apps/desktop/src-tauri/src/main.rs#L3932)
- [main.rs](/D:/code/iClaw/apps/desktop/src-tauri/src/main.rs#L4775)
- [main.rs](/D:/code/iClaw/apps/desktop/src-tauri/src/main.rs#L4997)
- [main.rs](/D:/code/iClaw/apps/desktop/src-tauri/src/main.rs#L5010)
- [main.rs](/D:/code/iClaw/apps/desktop/src-tauri/src/main.rs#L6546)
- [config.ts](/D:/code/iClaw/services/control-plane/src/config.ts#L6)
- [service.ts](/D:/code/iClaw/services/control-plane/src/service.ts#L3868)
