# @iclaw/desktop

iClaw 桌面壳（UI + Tauri）。

## 开发

1. 复制环境变量：
   `cp .env.example .env`
2. 设置：
   - `VITE_API_BASE_URL`
   - `VITE_SIDE_CAR_ARGS`
3. 启动：
   `pnpm dev:desktop`

## Web 模式联调（推荐）

在仓库根目录执行：

```bash
pnpm dev:web
```

该命令会自动：

1. 启动本地 OpenClaw（`127.0.0.1:2026`）  
2. 启动前端 Vite（`127.0.0.1:1420`）  

这样可以在浏览器直接联调，不必每次打 DMG。

后端日志目录：

- `logs/openclaw/`
- 实时查看：`tail -f logs/openclaw/latest.log`

## 说明

- 内容区为 raw render：后端返回什么展示什么。
- 左侧菜单和设置相关功能在 v0 为静态占位。
- 启动后先显示登录/注册面板，登录成功后进入对话页。
- Tauri 运行时会尝试拉起打包内置 sidecar，并周期性执行 `/health` 检查。
- 登录 token 在 Tauri 环境优先写入系统安全存储（macOS Keychain / Windows Credential Manager）。

## Sidecar 准备

在打包前先准备 OpenClaw 可执行文件：

1. 将二进制放到 `services/openclaw/bin/openclaw`（Windows 为 `.exe`）  
2. 或设置环境变量 `OPENCLAW_BINARY_PATH` 指向二进制路径  
3. 执行 `bash ../../scripts/build-openclaw.sh`，脚本会复制到 `src-tauri/binaries/openclaw-<target>`

## 本地能力资源（skills / mcp）

- 源目录（可维护）：`services/openclaw/resources/skills`、`services/openclaw/resources/mcp/mcp.json`
- 打包目录（自动同步）：`apps/desktop/src-tauri/resources/skills`、`apps/desktop/src-tauri/resources/mcp/mcp.json`
- 同步命令：`bash ../../scripts/sync-openclaw-resources.sh`

`tauri dev` / `tauri build` 会在 pre-command 自动执行资源同步。
