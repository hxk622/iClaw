# E2E Case Catalog

正式用户级自动化测试 case 按优先级分为三档：

- `tests/cases/P0/`
  - 发版前优先覆盖的主链路
- `tests/cases/P1/`
  - 第二优先级，通常是配置驱动场景、失败路径、外部依赖较强的链路
- `tests/cases/P2/`
  - 低频但重要的后台联动、长链路验证

## 设计原则

- **case 目录按优先级分层**
- **test 脚本目录按业务域放置**
  - 例如：`tests/chat/*.test.mjs`、`tests/payment/*.test.mjs`
- 一个脚本可以对应一个或多个 case，但每个 case 必须能回指：
  - 脚本路径
  - 断言口径
  - 截图/产物

## 当前目录

- `P0/chat.md`
- `P0/auth.md`
- `P0/payment.md`
- `P1/chat.md`
- `P1/auth.md`
- `P1/oem.md`
- `P1/payment.md`
- `P2/admin.md`
- `P2/payment.md`

## 编写规则

- 每个 case 必须包含：
  - `ID`
  - `脚本`
  - `目标`
  - `前置`
  - `步骤`
  - `断言`
  - `截图点`
- 新增 case 时，优先判断属于 `P0 / P1 / P2` 哪一档，而不是先堆到业务域 README
- 正式发版时，测试报告应引用这些 case 文档与实际执行脚本

## 模板

- `tests/cases/_template.md`
