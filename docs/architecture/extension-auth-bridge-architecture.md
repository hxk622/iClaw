# Extension Auth Bridge Architecture

## 目标

解决 iClaw 浏览器插件的自动登录问题，同时保持桌面端主登录态的安全边界。

问题本质：

- Tauri 桌面端的登录 token 存在系统安全存储（Keychain / Credential Manager）
- Chrome 插件无法直接读取桌面端安全存储
- 因此“桌面端已登录 != 插件自动已登录”

结论：

> 不直接把桌面端主 access token 暴露给插件。
>
> 对 iClaw 当前产品形态，正式用户路径以“桌面授权桥”为主；浏览器登录仅作为开发 / 自测兼容路径。

## 0. 运行态区分

iClaw 当前需要明确区分两种运行态：

### A. 用户态（正式产品）

- 插件不支持“单独安装后独立登录”
- 插件要获得登录态，必须依赖 Tauri 桌面端已打开且已登录
- 桌面端通过本地授权桥向插件签发“插件专用短期 session”

### B. 自测态 / 开发态

- 允许插件直接打开浏览器登录页登录 control-plane
- 该路径只用于：
  - 本地开发
  - 浏览器自测
  - CDP 自动化验证

因此，浏览器登录不是正式用户主路径，而是兼容开发与自测场景的辅助路径。

## 1. 推荐方案

采用双路径认证，但主次关系不同：

### Path A：桌面授权桥（正式主路径）

适用场景：

- 用户使用正式产品
- 插件随桌面端配套使用
- Tauri app 已打开且已登录

插件启动时：

1. 插件检测本地桌面桥是否可用
2. 请求桌面桥签发插件专用 session
3. 桌面端调用 control-plane 申请 extension token
4. 插件获得 extension access/refresh token
5. 插件进入已登录状态

优点：

- 与当前 iClaw 产品形态一致
- 不依赖浏览器里存在独立 iClaw 会话
- 用户心智清晰：桌面端登录是唯一正式登录入口

### Path B：浏览器登录（仅开发 / 自测兼容路径）

适用场景：

- 本地开发
- 浏览器自测
- 桌面端未启动但需要验证插件链路

该路径允许插件直接打开浏览器登录页并获得浏览器态会话，但不作为正式用户产品路径。

## 2. 为什么不能直接把桌面 token 给插件

不建议：

- 让插件直接读桌面安全存储
- 把桌面 access token 复制到 Chrome localStorage
- 把桌面 refresh token 明文同步到扩展本地存储

原因：

1. 浏览器插件的攻击面明显大于桌面端安全存储
2. 桌面 token 的权限通常比插件真正需要的权限更大
3. 一旦 token 被扩展环境泄露，会扩大整体账号风险

因此正确做法是：

- 桌面端保留主 token
- 插件只拿到 scope 更窄、生命周期更短的扩展 session

## 3. 桌面授权桥的推荐实现

### 推荐：本地 loopback bridge + 插件专用 session

桌面端在本机开启仅本地可访问的 loopback 接口，例如：

- `http://127.0.0.1:1537`

用途不是直接返回桌面 token，而是提供“签发插件 session”的能力。

### 本地桥接流程

1. 插件启动，发现浏览器态未登录
2. 插件请求本地桌面桥：
   - `POST /v1/extension/session`
3. 桌面端确认：
   - 当前桌面用户已登录
   - 请求来源合法
4. 桌面端用自己持有的主 token 调用 control-plane：
   - `POST /auth/extension/device-grant`
5. control-plane 返回：
   - extension access token
   - extension refresh token
   - scopes（插件专用）
   - expiry
6. 桌面端把这组“插件专用 token”返回给扩展
7. 插件把该 token 存到 `chrome.storage.local`
8. 插件后续用自己的 refresh token 完成续期

## 4. 插件专用 session 的约束

插件 token 必须和桌面主 token 区分对待。

### 建议约束

- 生命周期更短
  - access token: 15~30 分钟
  - refresh token: 1~7 天
- scope 更窄
  - 可读写知识素材
  - 可读当前用户基本信息
  - 不给高危后台权限
- 明确 token audience
  - `aud = extension`
- 支持单设备撤销

## 5. 控制平面建议新增接口

### 5.1 签发插件 session

`POST /auth/extension/device-grant`

由桌面端调用，入参包括：

- desktop access token（仅服务端校验，不下发给插件）
- device info
- extension id / brand id
- requested scopes

返回：

- extension access token
- extension refresh token
- expires_in
- scope list

### 5.2 刷新插件 session

`POST /auth/extension/refresh`

由插件自己调用。

### 5.3 当前用户信息

`GET /auth/me`

由插件在已登录后直接调用。

## 6. 本地桥的安全要求

### 必须满足

- 只监听 `127.0.0.1`
- 默认不开公网访问
- 只提供最小接口，不开放通用 RPC
- 插件请求必须带 nonce / challenge
- 桌面端只返回插件专用 session，不返回主 token

### 推荐增强

- 首次配对需用户确认一次
- 桌面端记录已授权 extension id
- 支持从桌面端撤销插件授权

## 7. 首次授权与后续自动登录

### 用户态首次

- 插件检测不到可用的插件 session
- 请求桌面桥
- 桌面端弹出确认：
  - “允许 iClaw 浏览器插件使用当前账号？”
- 用户确认后签发插件 session

### 用户态后续

- 插件优先尝试自己的 refresh token
- refresh 失败时再回退到桌面桥
- 如果桌面端未打开或未登录，则进入“等待桌面端登录”状态

### 自测态后续

- 允许插件直接走浏览器登录页
- 浏览器完成登录后，插件继续使用浏览器态会话
- 该路径不要求桌面端常开

## 8. 实施顺序建议

### V1

- 用户态：桌面授权桥为唯一正式登录路径
- 自测态：允许浏览器登录
- 两条路径都只下发插件专用 session 或插件可用会话，不暴露桌面主 token

### V1.5

- 完善桌面授权桥
- 支持“桌面已登录 -> 插件自动获取专用 session”
- 增加桌面端授权管理与错误提示

### V2

- 增加授权管理与撤销
- 增加更细粒度 scopes
- 增加多浏览器/多插件实例管理

## 9. 对当前项目的直接建议

当前最稳的落地顺序：

1. 正式产品直接以桌面授权桥为主
2. 浏览器登录仅保留给开发 / 自测环境
3. 从第一版开始就避免把“浏览器会话”当作正式用户的默认前提

不要第一版就让插件直接依赖 Tauri 主 token。

## 10. 最终结论

### 正确关系

- 桌面端主 token：权威、高权限、只存在安全存储
- 插件 token：派生、低权限、短生命周期

### 正确流程

- 用户态：向桌面申请插件专用 session
- 自测态：允许浏览器登录并复用浏览器会话

这才是 iClaw 插件自动登录的正确实现方式。
