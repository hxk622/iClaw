# P0 Install Cases

## Case: 首次启动展示本地安装进度并自动进入应用

ID:
- `INSTALL-E2E-001`

脚本:
- `tests/install/first-run-setup-gate.test.mjs`

目标:
- 验证全新客户端首次启动时，会展示安装进度页，并在安装完成后自动进入应用

前置:
- 使用全新安装包或清空本地 runtime / workspace 后启动客户端
- 可观测桌面客户端窗口，或具备等价自动化入口
- 如需拉取远端 runtime，网络与安装源配置可用

步骤:
1. 清空本地 runtime、workspace、缓存与安装状态
2. 启动客户端
3. 观察安装进度页
4. 等待安装与健康检查完成

断言:
- 首屏出现安装进度页，而不是直接进入 chat shell
- 进度文案真实反映“检查 / 准备 / 安装 / 启动”阶段
- 安装完成后自动进入应用主界面
- 首次安装期间用户不能误入未准备好的业务界面

截图点:
- 安装页初始态
- 安装中
- 完成后进入应用

## Case: 安装失败时给出清晰错误并支持重试

ID:
- `INSTALL-E2E-002`

脚本:
- `tests/install/runtime-install-retry.test.mjs`

目标:
- 验证安装失败不是静默挂死，而是给出可读错误，并允许用户重试

前置:
- 可人为制造 runtime 安装失败场景
- 可重新恢复安装源并再次触发安装

步骤:
1. 注入一个可复现的安装失败条件
2. 启动客户端并等待进入失败态
3. 记录错误文案与当前进度
4. 恢复安装条件后点击“重新尝试”

断言:
- 出现明确失败态，而不是无限 loading
- 错误文案可读，能区分安装失败与启动失败
- 页面上存在“重新尝试”按钮
- 点击重试后会重新进入安装流程，并能继续推进

截图点:
- 安装失败态
- 点击重试后重新开始安装

备注:
- 自动化脚本待补；当前仅保留正式 case 设计，参考 [tests/install/README.md](/C:/hexun/code/iClaw/tests/install/README.md)

## Case: 已完成安装的客户端二次启动不重复安装

ID:
- `INSTALL-E2E-003`

脚本:
- `tests/install/installed-runtime-bootstrap.test.mjs`

目标:
- 验证首次安装完成后，再次启动客户端不会重复走完整安装流程

前置:
- 同一台机器上已完成一次成功安装
- 本地 runtime、workspace 与配置保持有效

步骤:
1. 完成首次安装并退出客户端
2. 再次启动客户端
3. 观察启动路径与耗时

断言:
- 不会再次进入完整安装流程
- 如出现启动 gate，也只停留在健康检查或短暂启动阶段
- 能稳定进入应用主界面

截图点:
- 二次启动首页

备注:
- 自动化脚本待补；当前仅保留正式 case 设计，参考 [tests/install/README.md](/C:/hexun/code/iClaw/tests/install/README.md)

## Case: 发布安装包包含首次安装所需关键资源

ID:
- `INSTALL-E2E-004`

脚本:
- `tests/install/desktop-package-smoke.test.mjs`
- `scripts/self-test-desktop-update.mjs`

目标:
- 验证发布安装包内包含首次安装所需的 runtime、manifest 与更新资源，不会出现“包能发但装不起来”

前置:
- 已生成当前版本的桌面安装包

步骤:
1. 执行安装包自检
2. 检查产物目录中的 installer / updater / manifest
3. 校验安装包携带的 runtime 资源与版本信息

断言:
- 安装包产物生成成功
- release artifact 与 manifest 匹配
- 首次安装所需关键资源齐全

截图点:
- 产物目录或自检结果摘要

备注:
- 自动化脚本待补；当前仅保留正式 case 设计，参考 [tests/install/README.md](/C:/hexun/code/iClaw/tests/install/README.md)
