# iClaw v0 发布检查清单（macOS / Windows）

更新时间：2026-04-10

## 1. 版本与构建

- [ ] 版本号已更新（app/package/tauri 配置一致）
- [ ] 本次测试报告已创建到 `docs/version_record/test_report/`
- [ ] 发版文档已填写 `test_report` 字段并指向对应测试报告
- [ ] 下载页对外版本号已切到本次最新四段时间戳（不是旧的 `+build` 版本）
- [x] sidecar 二进制版本已锁定
- [x] 本地全量构建通过
- [ ] macOS 产物包含：`.dmg`
- [ ] Windows 产物包含：`.exe`
- [ ] updater 产物包含：
  - macOS：`.app.tar.gz` + `.sig`
  - Windows：`.nsis.zip` + `.sig` 可选，不作为强更发布阻断项

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

Windows 补充要求：

- 未做 Windows Authenticode 签名的 `.exe`，默认视为“仅限内部测试包”，不允许当作正式外发包。
- QA 若看到 “Microsoft Defender SmartScreen 阻止了无法识别的应用启动”，优先判定为“未签名 / 信誉不足”，不要误判为“程序被识别为病毒”。
- 正式发布前必须至少确认：
  - 安装包已做 Authenticode 签名
  - 已附带时间戳
  - QA 干净 Windows 机器不再出现 SmartScreen 阻断，或已明确记录为仅内部灰测豁免

## 6. 更新

- [ ] 更新源可访问
- [ ] 更新检查可用
- [ ] 更新失败可回退
- [ ] macOS 自动更新链路可用
- [ ] Windows 强更链路可用
- [ ] Windows installer 下载地址与当前发布版本一致
- [ ] Windows 命中强更后可自动下载安装包并拉起安装器
- [ ] Windows 升级完成后可恢复到退出前页面
- [ ] `home-web` 下载链接与当前 installer 文件名一致

说明：

- Windows 正式发版默认不依赖 native updater。
- Windows 的发布验收主链路是：版本检查 -> 强更策略 -> installer 下载 -> 拉起安装器 -> 重启恢复现场。
- 因此 Windows `updater/signature` 缺失，不应单独阻断正式强更发布；但如果本次声明支持 native updater，则仍需额外验收。
- 但 Windows installer 若未完成 Authenticode 签名，仍应阻断正式对外发布。

## 7. 发布门槛（必须全部满足）

- [ ] 已有本次发版对应测试报告
- [ ] `tests/cases/P0/` 对应正式用例已全部跑通
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
- 每次正式发版前，测试结论必须同步沉淀到 `docs/version_record/test_report/`，并在对应发版文档中回填 `test_report`
- Windows 宿主如需并行构建多个品牌，不允许共享同一轮 `.env` / brand-generated 中间态；应串行打包，或先把打包工作目录彻底隔离

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
  - Windows：完成签名、强更 installer 链路验收、安装回归
