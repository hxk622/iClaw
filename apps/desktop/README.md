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
- 本地 OpenClaw gateway token 的唯一权威源是 `~/.openclaw/gateway-token`。
- Tauri 桌面端会把这个 token 同步到系统安全存储，但系统安全存储不再是权威源。
- `pnpm dev:api` 与 `pnpm dev:web` 也都读取同一份 `~/.openclaw/gateway-token`；如果文件不存在，会生成后复用。
- 重要：桌面安装包在 Tauri 运行时，禁止依赖 `.env.prod` 中编译进前端 bundle 的 `VITE_GATEWAY_TOKEN` / `VITE_GATEWAY_PASSWORD` 连接本地 gateway；本地 gateway 凭据只能以运行时共享 token 文件为准。

## Prod 打包注意事项

- `.env.prod` 只用于环境级公共配置，例如 `APP_NAME`、`VITE_AUTH_BASE_URL`、`VITE_API_BASE_URL`
- 不允许在 `.env.prod` 中写入安装实例级 secret，例如本地 gateway token / password
- 如果某个已发布安装包误把本地 gateway secret 编译进包，表现通常会是：
  - `ws://127.0.0.1:2126` 鉴权失败
  - `gateway token mismatch`
  - `too many failed authentication attempts (retry later)`
- 这类问题不能通过线上 control-plane 热修复；必须重新打新的 prod 包，并替换线上下载页中的旧安装包

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

开发环境与桌面包的 sidecar 启动链必须保持同一语义：

- `pnpm dev:api` 使用的本地 launcher
- 桌面包使用的 `openclaw-runtime` launcher

两者必须由同一套模板生成，并执行同样的 `openclaw.mjs gateway ...` 启动链，避免 dev / prod 之间出现理解漂移。

## 本地能力资源（skills / mcp）

- Skills 单轨：只以 cloud skill + 平台/OEM 绑定为准。桌面端会在 OpenClaw 启动前，把当前生效 skills 同步到 `~/.openclaw/workspace/skills`。
- 源目录（可维护）：`servers`、`services/openclaw/resources/mcp/mcp.json`
- `services/openclaw/resources/mcp/mcp.json` 是桌面端打包使用的唯一 MCP 配置来源；它本身应由 control-plane/runtime 同步链路生成，而不是再叠加仓库内 overlay。
- 打包目录（自动同步）：`apps/desktop/src-tauri/resources/mcp/mcp.json`
- 同步命令：`node ../../scripts/sync-openclaw-resources.mjs`

`tauri dev` / `tauri build` 会在 pre-command 自动执行资源同步。`pnpm tauri:build` 会在 macOS 产出 DMG，在 Windows 产出 NSIS 安装包 `.exe`。
