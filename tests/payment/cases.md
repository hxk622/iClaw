# Payment E2E Cases

支付 case 已改为按优先级管理，不再只维护单一文件。

请改读：

- `tests/cases/P0/payment.md`
- `tests/cases/P1/payment.md`
- `tests/cases/P2/payment.md`

如果你在补 payment 脚本：

- 主链路优先放到 `P0`
- OEM / 异常路径优先放到 `P1`
- 后台联动与长链路优先放到 `P2`
