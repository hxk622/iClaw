# P1 Auth Cases

## Case: OAuth callback 完成后正确回到业务页

ID:
- `AUTH-E2E-002`

脚本:
- `tests/auth/oauth-callback-complete.test.mjs`

目标:
- 验证 `1520/oauth-callback.html` 完成授权后能稳定回到正确页面

前置:
- 外部 OAuth 环境可用
- 测试账号与回调配置可控

步骤:
1. 发起 OAuth 登录
2. 完成回调
3. 观察页面落点

断言:
- callback 页面不挂死
- 登录完成后回到预期业务页面
- 登录态建立成功

截图点:
- callback 完成态
- 登录后落点
