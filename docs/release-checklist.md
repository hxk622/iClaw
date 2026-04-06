# iClaw v0 发布检查清单（macOS / Windows）

更新时间：2026-04-05

## 1. 版本与构建

- [ ] 版本号已更新（app/package/tauri 配置一致）
- [ ] 下载页对外版本号已切到本次最新四段时间戳（不是旧的 `+build` 版本）
- [x] sidecar 二进制版本已锁定
- [x] 本地全量构建通过
- [ ] macOS 产物包含：`.dmg`
- [ ] Windows 产物包含：`.exe`
- [ ] updater 产物包含：
  - macOS：`.app.tar.gz` + `.sig`
  - Windows：`.nsis.zip` + `.sig`

## 2. 安装与启动

- [ ] DMG 可正常安装到 Applications
- [ ] Windows 安装包可正常安装
- [ ] 首次启动无崩溃
- [ ] sidecar 自动拉起成功
- [ ] 健康检查通过（`/health`）

## 3. 核心功能

- [ ] 登录/注册可用
- [ ] token 刷新可用
- [ ] 发送消息可用
- [ ] SSE 流式显示可用
- [ ] 失败后可重试

## 4. 稳定性

- [ ] 弱网场景不会卡死 UI
- [ ] sidecar 不可用时有明确提示
- [ ] 日志可收集/导出

## 5. 安全与签名

- [ ] macOS 代码签名完成
- [ ] macOS 公证完成
- [ ] 安装与运行不触发高危安全拦截
- [ ] Windows 签名完成
- [ ] Windows SmartScreen 风险已评估

## 6. 更新

- [ ] 更新源可访问
- [ ] 更新检查可用
- [ ] 更新失败可回退
- [ ] macOS 自动更新链路可用
- [ ] Windows 自动更新链路可用
- [ ] `home-web` 下载链接与当前 installer 文件名一致

## 7. 发布门槛（必须全部满足）

- [ ] 可安装
- [ ] 可启动
- [ ] 可登录
- [ ] 可对话
- [ ] 可恢复（重试/重启后继续使用）
- [ ] 可收日志

## 平台构建命令

- macOS 主机：
  - `bash scripts/build-desktop-matrix.sh`
- Windows 主机：
  - `bash scripts/build-desktop-matrix.sh`

说明：

- 脚本会根据宿主平台自动选择 target：
  - macOS：当前正式发版默认只使用 `aarch64-apple-darwin`
  - Windows：`x86_64-pc-windows-msvc`、`aarch64-pc-windows-msvc`
- 如只打单个 target，可加：
  - `ICLAW_DESKTOP_TARGETS=x86_64-pc-windows-msvc bash scripts/build-desktop-matrix.sh`
- 构建后的规范化产物统一写到：
  - `dist/releases/`

补充：

- `macOS x64` 当前不属于默认正式发版范围
- 只有在 `openclaw-runtime-x86_64-apple-darwin` 和 `x64 node` 构建环境都具备后，才允许恢复 `x86_64-apple-darwin` 发版

## 首轮勾检（2026-03-21）

- 已完成：
  - monorepo 与 desktop/sdk/tauri 基础骨架
  - 登录/注册 + token 刷新链路
  - Tauri 环境 token 安全存储（keyring）
  - sidecar 打包脚本与 tauri externalBin 配置
  - 服务健康检查 + sidecar 启动尝试
  - 本地 DMG 打包成功：`apps/desktop/src-tauri/target/release/bundle/dmg/*.dmg`
  - 首启本地运行环境检查（sidecar/resources，API key 由后端控制）
  - skills/mcp 资源目录已接入 bundle resources
  - 已预置首发核心 skills（办公+金融）并完成同步
  - 发布清单生成脚本已支持 macOS / Windows 双平台
  - 下载上传脚本已支持 `.dmg` / `.exe` 与对应 updater 产物
- 阻塞项：
  - 未提供 OpenClaw 正式 sidecar binary 时，构建会失败（已取消 fallback）
  - Windows 实机打包与自动更新仍需在 Windows 宿主完成一轮验收
- 下一步：
  - macOS：完成签名、公证、自动更新验收
  - Windows：完成签名、自动更新验收、安装回归
