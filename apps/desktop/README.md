# @iclaw/desktop

iClaw 桌面壳（UI + Tauri）。

## 开发

1. 在仓库根目录切换环境：
   `pnpm env:dev`
2. 如需修改配置，编辑根目录：
   - `.env.dev` / `.env.test` / `.env.prod`
3. 启动：
   `pnpm dev:desktop`

## Web 模式联调（推荐）

在仓库根目录执行：

```bash
pnpm dev:web
```

该命令会自动：

1. 启动本地 OpenClaw（`127.0.0.1:2126`）  
2. 启动前端 Vite（`127.0.0.1:1520`）  

`pnpm dev:web` / `pnpm dev:api` 不会自动启动 control-plane；如需登录/注册联调，请单独执行 `pnpm dev:control-plane`。

这样可以在浏览器直接联调，不必每次打 DMG。

端口约定：

- 前端页面固定使用 `http://127.0.0.1:1520`
- OAuth 回调页固定挂在前端 origin：`http://127.0.0.1:1520/oauth-callback.html`
- 登录/注册相关 control-plane 接口默认走 `http://127.0.0.1:2130`

后端日志目录：

- `logs/openclaw/`
- 实时查看：`tail -f logs/openclaw/latest.log`

## 说明

- 内容区为 raw render：后端返回什么展示什么。
- 左侧菜单和设置相关功能在 v0 为静态占位。
- 启动后先显示登录/注册面板，登录成功后进入对话页。
- Tauri 运行时只使用已安装的 OpenClaw runtime，若配置了下载地址，会在应用启动阶段安装。
- 登录 token 在 Tauri 环境优先写入系统安全存储（macOS Keychain / Windows Credential Manager）。
- 本地 OpenClaw gateway 使用应用生成并保存在系统安全存储里的共享 token，不再依赖隐式 fallback。

## OpenClaw Runtime

发布包不再内置 sidecar 二进制。推荐流程：

1. 基于 OpenClaw npm 发布包构建 runtime artifact：
   `OPENCLAW_NPM_SPEC=openclaw@2026.3.7 pnpm build:openclaw-runtime`
2. 原始 npm package tgz 会保留到 `.artifacts/openclaw-runtime/packages/`，便于 `dev:api` 和 DMG 验收复用同一份输入。
3. 将产物上传到可访问的下载地址。
3. 填写 `src-tauri/resources/config/openclaw-runtime.json`，或设置环境变量：
   - `ICLAW_OPENCLAW_RUNTIME_VERSION`
   - `ICLAW_OPENCLAW_RUNTIME_URL`
   - `ICLAW_OPENCLAW_RUNTIME_SHA256`
   - `ICLAW_OPENCLAW_RUNTIME_FORMAT`
   - `ICLAW_OPENCLAW_RUNTIME_LAUNCHER`

运行时会将 artifact 下载到应用数据目录下的 `openclaw/runtime/versions/<version>` 并从那里启动。

`artifact_url` 既可以是 HTTPS 地址，也可以是本机绝对路径，便于本地联调验证。

桌面端当前只按以下顺序解析 runtime：

1. `ICLAW_OPENCLAW_RUNTIME_DIR`
2. 已安装的 runtime
3. `src-tauri/resources/openclaw-runtime`

找不到就直接报错，不再回退到本地源码或 mock runtime。

## 本地能力资源（skills / mcp）

- 源目录（可维护）：`skills`、`services/openclaw/resources/mcp/mcp.json`
- 打包目录（自动同步）：`apps/desktop/src-tauri/resources/skills`、`apps/desktop/src-tauri/resources/mcp/mcp.json`
- 同步命令：`bash ../../scripts/sync-openclaw-resources.sh`

`tauri dev` / `tauri build` 会在 pre-command 自动执行资源同步。
