# P0 Auth Cases

## Case: 登录态 bootstrap 正常接管桌面入口

ID:
- `AUTH-E2E-001`

脚本:
- `tests/auth/login-session-bootstrap.test.mjs`

目标:
- 验证 guest 入口和 authenticated 入口的启动分流正常

前置:
- `desktop web shell` 运行在 `http://127.0.0.1:1520`
- `control-plane` 运行在 `http://127.0.0.1:2130`
- Chrome CDP 已开启
- 存在可登录测试账号

步骤:
1. 清空 guest 本地状态
2. 进入首页/聊天入口
3. 观察 guest 引导态
4. 注入真实登录态并刷新
5. 观察 authenticated 入口

断言:
- guest 模式下出现登录或欢迎引导
- 登录后不再卡在登录提示
- 登录后能进入正常 chat shell

截图点:
- guest 态
- 登录后态
