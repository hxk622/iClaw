# P1 Payment Cases

## Case: OEM 未覆盖时继承平台支付方式

ID:
- `PAY-E2E-007`

脚本:
- `tests/payment/oem-payment-inheritance.test.mjs`

目标:
- 验证 OEM 未开启覆盖时，前台支付方式沿用平台配置

## Case: OEM 覆盖支付方式后前台即时生效

ID:
- `PAY-E2E-008`

脚本:
- `tests/payment/oem-payment-override.test.mjs`

目标:
- 验证 OEM 自定义支付方式与默认项会实时反映到前台

## Case: 支付网关缺失时前台有明确错误提示

ID:
- `PAY-E2E-009`

脚本:
- `tests/payment/misconfigured-gateway-error.test.mjs`

目标:
- 验证支付配置事故不会在前台表现为静默失败
