# OpenClaw Sidecar CI 规范（DMG / EXE 统一）

## 目标
- iClaw 仅使用 `openclaw-server` sidecar 运行网关。
- DMG 和 EXE 使用同一产物规范，禁止 GUI binary fallback。
- 产物可验收：`/health` 可达、登录可用、流式对话可用。

## 产物规范
- 产物名：
  - `openclaw-<target-triple>`（mac/linux）
  - `openclaw-<target-triple>.exe`（windows）
- 运行时布局（随安装包分发，不入 git）：
  - `services/openclaw/bin/openclaw-server`
  - `services/openclaw/runtime/openclaw/{openclaw.mjs,dist,node_modules,extensions}`
  - `services/openclaw/runtime/node/node`

## 本地构建（当前推荐）
1. 基于 npm 发布包准备统一输入：
   - `OPENCLAW_NPM_SPEC=openclaw@<version> pnpm build:openclaw-runtime`
   - 原始 package tgz 会保留在 `.artifacts/openclaw-runtime/packages/`
2. 在 iClaw 里构建 sidecar runtime：
   - `OPENCLAW_PACKAGE_TGZ=<package-tgz> bash scripts/build-openclaw-server-runtime.sh`
3. 生成桌面包：
   - `pnpm tauri build`

## CI 流程（建议）
1. `checkout iClaw`
2. `checkout openclaw`（固定 tag / commit）
3. `pnpm install && pnpm build`（openclaw）
4. 执行 `scripts/build-openclaw-server-runtime.sh <target-triple>`
5. 执行打包（mac 产 DMG，windows 产 EXE）
6. 验收测试：
   - sidecar 启动成功
   - `GET /health` 返回 200
   - 登录接口成功（或 token refresh 成功）
   - 流式对话首 token 在 SLA 内返回

## 强约束
- 不提交 `services/openclaw/bin/*`、`services/openclaw/runtime/*`、`services/openclaw/Frameworks/*`。
- 打包流程中删除 GUI binary fallback。
- release 只允许从 CI 产物发布，不允许本地手工替换二进制。
