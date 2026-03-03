# @iclaw/desktop

iClaw 桌面壳（UI + Tauri）。

## 开发

1. 复制环境变量：
   `cp .env.example .env`
2. 设置：
   - `VITE_API_BASE_URL`
3. 启动：
   `pnpm dev:desktop`

## 说明

- 内容区为 raw render：后端返回什么展示什么。
- 左侧菜单和设置相关功能在 v0 为静态占位。
- 启动后先显示登录/注册面板，登录成功后进入对话页。
