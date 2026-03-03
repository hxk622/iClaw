# iClaw v0 发布检查清单（macOS）

更新时间：2026-03-03

## 1. 版本与构建

- [ ] 版本号已更新（app/package/tauri 配置一致）
- [x] sidecar 二进制版本已锁定
- [x] 本地全量构建通过
- [x] 产物包含：`.dmg`

## 2. 安装与启动

- [ ] DMG 可正常安装到 Applications
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

## 6. 更新

- [ ] 更新源可访问
- [ ] 更新检查可用
- [ ] 更新失败可回退

## 7. 发布门槛（必须全部满足）

- [ ] 可安装
- [ ] 可启动
- [ ] 可登录
- [ ] 可对话
- [ ] 可恢复（重试/重启后继续使用）
- [ ] 可收日志

## 首轮勾检（2026-03-03）

- 已完成：
  - monorepo 与 desktop/sdk/tauri 基础骨架
  - 登录/注册 + token 刷新链路
  - Tauri 环境 token 安全存储（keyring）
  - sidecar 打包脚本与 tauri externalBin 配置
  - 服务健康检查 + sidecar 启动尝试
  - 本地 DMG 打包成功：`apps/desktop/src-tauri/target/release/bundle/dmg/iClaw_1.0.0_aarch64.dmg`
  - 首启本地运行环境检查（sidecar/resources，API key 由后端控制）
  - skills/mcp 资源目录已接入 bundle resources
  - 已预置首发核心 skills（办公+金融）并完成同步
- 阻塞项：
  - 未提供 OpenClaw 正式 sidecar binary 时，构建会失败（已取消 fallback）
- 下一步：
  - 放置 OpenClaw 正式二进制后执行：`bash scripts/build-openclaw.sh`
  - 再执行：`cd apps/desktop && pnpm tauri build`
  - 执行签名与公证流程
