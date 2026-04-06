# E2E Test Harness

目标：
- 用 Chrome DevTools Protocol 模拟真实用户行为
- 覆盖 `admin-web`、`desktop web shell`、支付链路等高价值页面
- 每条脚本都能输出截图，便于回归确认
- 发版前将本次用户级测试结果汇总到 `docs/version_record/test_report/`

## 目录结构

- `tests/shared/cdp/cdp-helpers.mjs`
  通用 CDP 封装，包含页面创建、等待、点击、输入、读值、截图
- `tests/cases/`
  正式 case catalog，总入口；按 `P0 / P1 / P2` 分目录
- `tests/payment/admin-gateway-read.test.mjs`
  第一条支付烟测脚本，验证 `admin-web` 平台支付网关表单可视化读取
- `tests/payment/admin-gateway-scope-isolation.test.mjs`
  支付网关作用域隔离烟测，验证 OEM 保存不会覆盖平台或其它 OEM
- `tests/payment/cases.md`
  payment case 的兼容跳转说明
- `tests/chat/`
  桌面对话类 CDP 回归

## 运行前置

需要先启动：
- Chrome，且远程调试端口为 `9223`
- `admin-web` at `http://127.0.0.1:1479`
- `desktop web shell` at `http://127.0.0.1:1520`
- `control-plane` at `http://127.0.0.1:2130`

## 已有脚本

运行平台支付网关烟测：

```bash
pnpm test:e2e:payment:admin-gateway
```

运行 OEM / 平台支付网关隔离烟测：

```bash
pnpm test:e2e:payment:admin-gateway-scope
```

运行后会自动触发 `.tmp-tests` 留存：
- 扫描当前 `.tmp-tests`
- 自动分类到 `tests/archive/tmp-tests`
- 生成 `catalog.json` 与 `README.md`
- 为每个文件保留 `latest` 镜像和按内容 hash 切分的 `snapshots`

也可以单独执行留存：

```bash
pnpm tmp-tests:harvest
```

可选环境变量：

```bash
ICLAW_ADMIN_URL=http://127.0.0.1:1479
ICLAW_ADMIN_USERNAME=admin
ICLAW_ADMIN_PASSWORD=admin
ICLAW_CDP_PORT=9223
ICLAW_TEST_PAYMENT_PARTNER_ID=1242
ICLAW_TEST_PAYMENT_GATEWAY=https://vip1.zhunfu.cn/submit.php
ICLAW_TEST_PAYMENT_KEY=5yr5JZxRXxDR5yuxV7z5p7yxbybU5Bxj
ICLAW_TEST_SCREENSHOT_PATH=/tmp/iclaw-payment-admin-gateway-read.png
```

## 选择器策略

新增 `data-testid` 的原则：
- 不和视觉 class 强绑定
- 优先标记用户关键动作和关键断言点
- 尽量一眼能看懂含义

当前已补：
- admin 登录表单
- admin 平台支付网关表单与字段
- 充值中心入口
- 充值套餐卡片
- 支付页根节点
- 支付方式项
- 二维码容器
- 过期遮罩
- 刷新二维码按钮

## 下一步建议

优先继续实现：
- `tests/payment/recharge-package-flow.test.mjs`
- `tests/payment/qr-layout.test.mjs`
- `tests/payment/expired-refresh.test.mjs`

它们对应的正式 case 已改为按优先级沉淀在：
- `tests/cases/P0/payment.md`

其他域也按相同方式维护：
- `tests/cases/P0/`
- `tests/cases/P1/`
- `tests/cases/P2/`

## 临时脚本自动留存

`.tmp-tests` 不再只是一次性目录。

正式入口脚本现在会在执行后自动收割 `.tmp-tests`：
- 脚本：`scripts/harvest-tmp-tests.mjs`
- 包装器：`scripts/run-with-tmp-harvest.mjs`
- 归档目录：`tests/archive/tmp-tests`

自动机制做的事情：
- 自动扫描 `.tmp-tests` 全量文件
- 根据文件名自动判断模块和用途
- 自动复制到 `latest/<module>/`
- 按内容 hash 自动生成 `snapshots/<module>/`
- 自动生成索引：
  - `tests/archive/tmp-tests/catalog.json`
  - `tests/archive/tmp-tests/README.md`

这样即使某个临时脚本后面被删掉，最后一次收割到的版本仍然会保留在归档里。

## 发版测试报告要求

- 每次正式发版前，必须至少整理一份测试报告到：
  - `docs/version_record/test_report/<version>.md`
- 对应发版文档必须填写：
  - `test_report: docs/version_record/test_report/<version>.md`
- 测试报告应优先引用：
  - 本次实际执行的正式脚本
  - 截图路径
  - `tests/archive/tmp-tests` 中相关归档（如有）
