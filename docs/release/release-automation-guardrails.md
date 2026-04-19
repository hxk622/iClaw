# Release Automation Guardrails

更新时间：2026-04-20

## 目标

把最近几轮 Windows prod 发版里反复出现的人为错误固化为脚本，做到：

- 本地构建前先拦截
- 上传下载站后自动复核
- 发布 desktop release policy 后再做一轮公网验真
- 入口机 nginx 指向错误时可一键修复

## 已落地脚本

### `scripts/release-prod-guardrails.mjs`

统一的 prod 发版守门脚本，支持：

```bash
node scripts/release-prod-guardrails.mjs --brand caiclaw --channel prod --target x86_64-pc-windows-msvc --release-version 1.0.x.yyyymmddHHMM --mode <pre|local|public|all>
```

当前覆盖：

- `pre`
  - `docs/version_record/<version>.md` 存在
  - `docs/version_record/test_report/<version>.md` 存在
  - 工作区干净
  - stash 为空
  - release 关键 `.sh` 脚本为 LF
- `local`
  - `dist/releases/<artifact>_<releaseVersion>_<arch>_<channel>.exe` 存在
  - 本地 `latest-*.json` 指向当前 installer
  - 本地 aggregate manifest 指向当前 installer
- `public`
  - 公网 `latest-*.json` 已更新
  - 公网 installer URL 可访问
  - 可选校验 `/desktop/release-manifest` 是否与本次 release 一致

说明：

- `desktop release api` 校验默认用 `ICLAW_CONTROL_PLANE_BASE_URL`
- 若未显式配置，则回退到品牌 `runtimeDistribution.<channel>.publicBaseUrl`
- 再兜底从 downloads 域名推导站点根地址

### `scripts/fix-nginx-download-proxy.py`

用于入口机检查或修复 `/downloads/`、`/runtime/` 反向代理是否还指向旧 bucket。

示例：

```bash
python scripts/fix-nginx-download-proxy.py \
  --host 39.106.110.149 \
  --user root \
  --password '***' \
  --config-path /etc/nginx/conf.d/caiclaw.conf \
  --minio-origin http://39.106.110.149:9000 \
  --downloads-bucket caiclaw-prod \
  --runtime-bucket caiclaw-prod
```

需要修复时：

```bash
python scripts/fix-nginx-download-proxy.py ... --apply --reload
```

当前覆盖：

- 读取 nginx 配置中的 `/downloads/` proxy_pass
- 读取 nginx 配置中的 `/runtime/` proxy_pass
- 对比期望 bucket
- 可自动备份配置、落盘、`nginx -t`、reload

## 已接入主流程

### `scripts/release-orchestrate-windows.mjs`

当前顺序：

1. 建立版本记录骨架
2. `guardrails --mode pre`
3. `release-guard`
4. `release-preflight`
5. 构建桌面包
6. `guardrails --mode local`
7. 再跑一轮 `release-guard`
8. 发布 downloads
9. `guardrails --mode public`
10. 发布 desktop release policy
11. `guardrails --mode public --check-desktop-release-api`

这意味着以下典型错误会在脚本阶段直接失败，而不是发出去后再被 QA 发现：

- 漏建 `version_record` / `test_report`
- 本地 manifest 指回旧版本
- 公网 manifest 没更新
- 公网 installer 404
- `/desktop/release-manifest` 版本与 installer 不一致
- 关键 shell 脚本被 CRLF 污染

## 这轮沉淀的高频坑

本次明确转成 guardrail / SOP 的问题：

1. 四段版本和 semver 三段版本混用，导致 manifest 漂移
2. `downloads` 已发新包，但 desktop release policy 仍指旧版本
3. 入口机 nginx 仍代理到旧 bucket，例如 `licaiclaw-prod`
4. `with-env.sh` 被 CRLF 污染后在 bash 宿主失效
5. 漏写 `version_record` / `test_report`
6. 本地有 stash / 脏工作区，发布结果无法追溯

## 还应继续脚本化的项

下一批建议继续自动化：

1. `deploy-control-plane.sh` / `deploy-admin.sh` / `deploy-home.sh` 完成后自动做健康检查和版本回读
2. 发布下载页后自动抓取 `home-web` 下载按钮目标并和 manifest 对比
3. Windows 包体、安装后目录大小、文件数、启动关键阶段耗时自动落档到 `test_report`
4. Windows 签名状态、时间戳状态、证书指纹自动校验
5. 桌面自测 smoke 结果自动回填到版本记录

## 推荐执行方式

正式发版时，优先使用：

```bash
node scripts/release-orchestrate-windows.mjs --brand caiclaw --channel prod --target x86_64-pc-windows-msvc --release-version <version> --execute
```

如果是排查单点问题，可单独跑：

```bash
node scripts/release-prod-guardrails.mjs --brand caiclaw --channel prod --target x86_64-pc-windows-msvc --release-version <version> --mode pre
node scripts/release-prod-guardrails.mjs --brand caiclaw --channel prod --target x86_64-pc-windows-msvc --release-version <version> --mode local
node scripts/release-prod-guardrails.mjs --brand caiclaw --channel prod --target x86_64-pc-windows-msvc --release-version <version> --mode public --check-desktop-release-api
```
