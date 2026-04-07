# Install Test Lane

这里预留桌面客户端安装链路测试：

- `first-run-setup-gate.test.mjs`
  - 首次启动展示安装进度页并自动进入应用
- `runtime-install-retry.test.mjs`
  - 安装失败后展示错误并支持重试
- `installed-runtime-bootstrap.test.mjs`
  - 已安装环境二次启动不重复安装
- `desktop-package-smoke.test.mjs`
  - 安装包与首次安装资源 smoke 校验

正式 case 见：

- `tests/cases/P0/install.md`
