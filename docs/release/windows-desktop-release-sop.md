# Windows Desktop Release SOP

更新时间：2026-04-16

## 1. 目标

本文用于固定 `iClaw` / `LiCaiClaw` Windows 桌面正式发版的标准操作流程，解决以下反复出现的问题：

- 发版后没有 `version_record` / `test_report`
- 同一公开版本号下多次补包，基线不可追溯
- 多品牌并行打包复用中间态，导致串包风险
- QA 报“安装卡住 / 被拦截 / 没弹强更”，但机器侧没有足够日志
- 针对安装慢问题缺少定量指标，只能靠猜

本文是执行 SOP，不替代以下架构文档：

- [release-standard.md](./release-standard.md)
- [release-checklist.md](./release-checklist.md)
- [desktop-auto-update-force-restore-design.md](../design/desktop-auto-update-force-restore-design.md)

## 0. 自动化入口

本仓库已补齐 Windows 发版防踩坑自动化，统一入口如下：

```bash
node scripts/release-create-version-record.mjs --release-version <1.0.x.yyyymmddHHMM>
node scripts/release-guard.mjs --brand <iclaw|caiclaw> --channel prod --target x86_64-pc-windows-msvc --release-version <1.0.x.yyyymmddHHMM> --write-version-record
node scripts/release-orchestrate-windows.mjs --brand <iclaw|caiclaw> --channel prod --target x86_64-pc-windows-msvc --release-version <1.0.x.yyyymmddHHMM>
```

其中：

- `release-create-version-record` 负责补齐 `version_record` 和 `test_report`
- `release-guard` 负责统一生成发版守护报告，并把结果回填到版本记录
- `release-orchestrate-windows` 负责串起建档、守护检查、打包、再次守护、发布入口

## 0.2 品牌命名冻结规则

- 自 2026-04-16 起，业务品牌对外统一命名为 `caiclaw`
- 文档、发布记录、测试报告、对外沟通、下载链接说明中，默认使用 `caiclaw`
- 历史文档、历史脚本参数、历史构建产物中出现的 `licaiclaw`，视为旧内部标识，不再作为新增文档的首选称呼
- 如脚本/配置/数据库字段仍需兼容历史标识，必须在实现层做兼容；对外口径不再回退到 `licaiclaw`

## 0.1 已脚本化沉淀的 12 项

以下 12 项已落到脚本/SOP，不再靠口头记忆：

1. OpenClaw UI/runtime 版本一致性检查
2. OEM 品牌一致性检查
3. 桌面 bundle 完整性检查
4. 发版 smoke/守护入口统一
5. 本地 runtime cache 检查与复用约束
6. 安装包体积与 runtime 体积统计
7. 安装/启动日志指标提取
8. Windows 环境预检查
9. 图标链路检查
10. 本地 runtime snapshot / openclaw.json 检查
11. 发布链路命令统一输出
12. `version_record` / `test_report` 自动补齐与回填

## 2. 当前冻结口径

### 2.1 Windows 更新主链路

- Windows 正式发版默认走 `installer-driven force upgrade`
- 真值来源是：
  - `control-plane update-hint policy`
  - 发布到下载站的 installer / manifest
- Windows 不再把 `native updater` 作为正式发版前置门槛
- `updater/signature` 对 Windows 来说属于可选增强，不是强更是否成立的前提
- 发布脚本遇到 `.nsis.zip/.sig` 缺失或只存在一半时，不应阻断 `exe` 正式发布；最多记录 warning

### 2.2 厚包口径

- `dev`、`test`、`prod` 统一走厚包
- OpenClaw runtime 直接打入安装包
- 打包脚本默认会优先复用本地 runtime 缓存：
  - `.artifacts/openclaw-runtime/<brand>/<target>/<version>/...`
  - `.artifacts/openclaw-runtime/_shared/<target>/<version>/<sha256>/...`
- 不允许每次都重新下载远端 runtime 再打包

### 2.3 当前明确保留的优化

- 保留 Windows bundled runtime 瘦身
- 保留本地 runtime 缓存
- 保留 installer-driven 强更

### 2.4 当前明确不作为默认策略的项

- 不默认打包 offline WebView2
- 不把“补一个更大的安装包”当成根因修复
- 不在 Windows 上把未签名包当正式外发包

## 3. 发版前硬门槛

每次正式发版前，必须同时满足以下条件：

1. 已冻结唯一公开版本号，格式为 `1.0.x.yyyymmddHHMM`
2. 已冻结唯一 `git tag + commit`
3. 已提前创建：
   - `docs/version_record/<version>.md`
   - `docs/version_record/test_report/<version>.md`
4. 已明确本次是否发布：
   - `control-plane`
   - `admin-web`
   - `home-web`
   - `desktop`
5. 已明确两个品牌是否都要发：
   - `iclaw`
   - `caiclaw`
6. 已明确本次 Windows 目标架构：
   - 正式默认 `x86_64-pc-windows-msvc`
7. 已确认不在同一工作区直接并行打多个品牌
8. 已确认签名状态：
   - 未签名只能做内部测试
   - 对外正式发布必须接入 Authenticode + 时间戳

禁止事项：

- 禁止先发版，事后补 `version_record`
- 禁止同一公开版本号下反复补包
- 禁止多品牌共享同一轮 `.env` / `brand-generated` / `tauri.generated.conf.json`
- 禁止未签名包作为“正式对外包”下结论

## 4. 标准执行顺序

### 4.1 冻结基线

1. 执行版本推进
2. 提交版本冻结 commit
3. 打 `release tag`
4. 先写发布单和测试报告骨架

示例：

```bash
bash scripts/version.sh 1.0.5 202604111430
git commit -m "chore: bump desktop version to 1.0.5.202604111430"
git tag release-1.0.5.202604111430
```

### 4.2 构建前检查

1. 确认当前品牌环境正确
2. 确认 `.artifacts/openclaw-runtime/` 缓存命中或对应 runtime 已准备好
3. 确认不要并行打两个品牌
4. 在当前宿主先空跑一轮打包脚本，避免 PowerShell / NSIS 参数差异
5. 先执行一次：

```bash
node scripts/release-guard.mjs --brand <brand> --channel prod --target x86_64-pc-windows-msvc --release-version <version> --write-version-record
```

必须检查 `dist/release-guard/*.json` 输出。

### 4.3 桌面构建

按品牌串行执行：

```bash
APP_NAME=iclaw ICLAW_BRAND=iclaw ICLAW_DESKTOP_TARGETS=x86_64-pc-windows-msvc ICLAW_DESKTOP_CHANNELS=prod bash scripts/build-desktop-matrix.sh <releaseVersion>
APP_NAME=licaiclaw ICLAW_BRAND=licaiclaw ICLAW_DESKTOP_TARGETS=x86_64-pc-windows-msvc ICLAW_DESKTOP_CHANNELS=prod bash scripts/build-desktop-matrix.sh <releaseVersion>
```

构建后必须核对：

- `dist/releases/` 中文件名前缀是否匹配品牌
- 文件版本是否为本次四段版本
- manifest 是否对应本次 installer
- 未出现旧版本残留文件被误上传

### 4.4 下载站发布

```bash
APP_NAME=iclaw ICLAW_BRAND=iclaw bash scripts/publish-downloads.sh prod
APP_NAME=licaiclaw ICLAW_BRAND=licaiclaw bash scripts/publish-downloads.sh prod
```

如需显式钉死某次补包的公开四段版本，必须带上：

```bash
APP_NAME=licaiclaw ICLAW_BRAND=licaiclaw ICLAW_RELEASE_VERSION=1.0.7.202604161352 bash scripts/publish-downloads.sh prod
```

脚本口径：

- 优先使用 `ICLAW_RELEASE_VERSION` / `ICLAW_DESKTOP_RELEASE_VERSION`
- 若未显式传入，则自动扫描 `dist/releases/`，选择当前品牌、当前 channel 下最新 installer 文件名中的四段版本
- 禁止再仅依据 `package.json` 的 `semver+build` 生成 `latest-prod*.json`，否则会把 manifest 回滚到旧包

必须验证：

- 下载页对外版本号与文件名一致
- `latest-prod*.json` 指向当前 installer
- 两个品牌 URL 都不 404

### 4.5 强更策略发布

```bash
APP_NAME=iclaw ICLAW_BRAND=iclaw pnpm publish:desktop-release -- --brand iclaw --channel prod --version <semver+build> --mandatory --disallow-current-run-to-finish --notes "<release notes>"
APP_NAME=licaiclaw ICLAW_BRAND=licaiclaw pnpm publish:desktop-release -- --brand licaiclaw --channel prod --version <semver+build> --mandatory --disallow-current-run-to-finish --notes "<release notes>"
```

必须验证：

- `update-hint` 返回最新版本
- 命中旧版本时返回 `mandatory`
- 返回 installer URL

### 4.6 共享服务发布

优先顺序：

1. `control-plane`
2. `admin-web`
3. `home-web`

可优先使用统一脚本：

```bash
ICLAW_CONTROL_PLANE_PASSWORD='***' \
ICLAW_NGINX_PASSWORD='***' \
pnpm deploy:prod:marketing
```

## 5. 发布后必测项

### 5.1 下载与安装

- 安装包可下载
- 安装器可完成安装
- 首次启动成功
- 本地 runtime 正常拉起

### 5.2 强更链路

- QA baseline 先手工升到前一稳定版本
- 再验证 `N -> N+1` 强更
- 验证项固定包括：
  - 收到强更提示
  - 自动下载安装包
  - 自动拉起安装器
  - 安装完成后恢复到退出前页面

### 5.3 指标留档

每次正式版至少记录以下指标并写入测试报告：

- installer 文件大小
- 安装后目录总大小
- 安装后文件数
- 安装总耗时
- 是否命中缓存 runtime
- 是否命中签名 / SmartScreen / 杀软拦截

当前已知经验值：

- 未瘦身厚包安装后约 `617.9 MB / 37453 files`，本机约 `86.9s`
- 瘦身后安装后约 `390.4 MB / 18088 files`，本机约 `57.6s`

这些数字只用于趋势判断，不替代本次实测。

## 6. 问题排查 SOP

### 6.1 安装卡在高百分比

先排查以下事实，不要先猜根因：

1. 当前 installer 文件大小
2. 安装后目录大小和文件数
3. QA 机器是否被 SmartScreen 或杀软拦截
4. QA 机器是否存在 WebView2
5. 同一安装包能否在本机完成安装

排查纪律：

- 先复现，再归因
- 先看安装重量和落盘文件数，再讨论 WebView2
- 没有机器侧日志前，不把单点猜测当 root cause

### 6.2 SmartScreen / 被识别为病毒

默认判断顺序：

1. 先看是否未签名 / 无时间戳
2. 再看是否信誉不足
3. 不要直接把“无法识别的应用”归类为“确认病毒”

决策规则：

- 未签名包只能算内部测试包
- 对外正式包必须完成 Windows Authenticode 签名

### 6.3 强更没生效

依次核对：

1. 客户端当前版本号
2. `control-plane update-hint` 返回内容
3. 当前品牌 / channel / 平台 manifest 是否已更新
4. 下载页 installer 是否与 update-hint 返回版本一致
5. 共享服务是否已切到本次 release baseline

## 7. 必须沉淀的证据

每次发版后，必须把以下内容沉淀到仓库：

- `docs/version_record/<version>.md`
- `docs/version_record/test_report/<version>.md`
- 关键命令
- 关键结果
- 偏差说明
- 回滚方式

如有截图、日志、HAR、安装录像等非文本证据：

- 上传到 dev MinIO
- 在测试报告中回填对象路径

## 8. 本轮已确认的坑

后续发版不得再犯：

- 漏写 `version_record`
- 漏写 `test_report`
- 不打 `release tag`
- 同版本号多次补包
- 未签名就把包给 QA 当正式包
- 多品牌并行复用同一工作区
- 在没有机器侧日志时靠猜测做 RCA
- 为一个未证实的问题引入体积几乎翻倍的默认依赖

## 8.1 当前自动守护报告位置

- 守护报告输出目录：`dist/release-guard/`
- 版本记录目录：`docs/version_record/`
- 测试报告目录：`docs/version_record/test_report/`

每次正式发版都必须至少保留一份与当前公开版本号一致的守护报告。

## 9. 下一步必做改造

以下事项未完成，但已被提升为后续正式发版前的高优先级改造：

1. 安装页面和应用内增加一键故障上报
2. 自动收集最新日志尾部 `1000` 行
3. 上传到服务端并在 `admin-web` 可检索 / 下载
4. 安装阶段输出明确的步骤日志和耗时日志
5. Windows 签名接入打包 / 发布链路

## 10. 关联历史记录

- [1.0.3.202604092345.md](../version_record/1.0.3.202604092345.md)
- [1.0.4.202604101315.md](../version_record/1.0.4.202604101315.md)
