# CDP E2E Harness

目标：
- 用 Chrome DevTools Protocol 模拟真实用户行为
- 覆盖 `admin-web`、`desktop web shell`、支付链路等高价值页面
- 每条脚本都能输出截图，便于回归确认

## 当前结构

- `lib/cdp-helpers.mjs`
  通用 CDP 封装，包含页面创建、等待、点击、输入、读值、截图
- `payment-admin-gateway-read.test.mjs`
  第一条支付烟测脚本，验证 `admin-web` 平台支付网关表单可视化读取
- `payment-e2e-cases.md`
  支付端到端 case 清单

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
- `payment-recharge-package-flow.test.mjs`
- `payment-qr-layout.test.mjs`
- `payment-expired-refresh.test.mjs`

它们都已经有设计稿：
- `payment-e2e-cases.md`
