# iClaw 冻结决策（v0）

更新时间：2026-03-03

## 1. Monorepo 结构

```text
iClaw/
  apps/
    desktop/            # UI + Tauri 壳
  services/
    openclaw/           # OpenClaw 二开服务
  packages/
    sdk/                # iClaw 调 openclaw 的统一客户端封装
    shared/             # 共享类型/常量/错误码
  docs/
  scripts/
```

约束：`apps/desktop` 禁止直接依赖 `services/openclaw` 内部实现，只能通过 `packages/sdk`。

## 2. 职责边界

- 壳层（apps/desktop）：UI 展示、安装包、更新、登录页、错误提示。
- 云端 control plane（services/control-plane）：auth、session、credit、usage、run authorize。
- 能力层（services/openclaw）：能力选择、执行、skill 处理、回答生成。
- iClaw 不改写后端回答内容，不做能力编排。

## 3. v0 功能范围

只做基础对话能力：
- 登录/注册（走 iClaw 自有 control plane）
- 发送消息
- 流式显示后端返回
- 失败重试

暂不实现：
- 左侧菜单真实功能
- Settings 区域与 IM 配置（飞书/钉钉等）
- 深度会话管理功能

## 4. 展示策略

- 内容区只负责展示，后端返回什么就展示什么（raw render）。
- 前端不控制回答格式，不做润色、不做结构重写。
- 仅做安全处理（XSS 过滤、危险链接防护）与基础错误展示。

## 5. 平台与发布策略

- 首发平台：macOS（DMG）
- Windows（MSI/NSIS）：放到 v0.2
- 首版必须完成 macOS 签名 + 公证后公开分发

## 6. 登录策略

- 首版必须登录，不提供游客模式。
- 账号体系：迁移到 iClaw 自有 cloud control plane。
- PostgreSQL 用户体系全新设计，不复用 OpenAlpha 现有表。
- 用户名、邮箱、密码凭据使用 iClaw 独立 schema。
- token 存储：系统安全存储（macOS Keychain / Windows Credential Manager）。

## 6.1 计费策略

- credit、usage、billing 一律以云端 control plane 为准。
- 本地 sidecar 可缓存 usage 草稿，但不是最终计费依据。
- PostgreSQL 作为权威账本数据库，由 control plane 持有。

## 7. 本地运行模式

- iClaw 启动后自动拉起本地 sidecar（OpenClaw 服务）。
- 默认监听本地回环地址（如 `127.0.0.1`）固定端口（待最终确认）。
- 首启自动初始化数据目录和日志目录。

## 8. 自动更新

- v0 启用“检查更新 + 用户确认安装”。
- 更新源默认 GitHub Releases（后续可替换私有 CDN）。

## 9. 验收标准（DoD）

- 可安装（DMG）
- 可启动（首次启动不崩溃）
- 可登录
- 可对话（发送成功）
- 可流式展示
- 失败可重试
- 可导出或收集日志

## 10. OpenClaw Chat 包装边界

针对 `apps/desktop/src/app/components/OpenClawChatSurface.tsx`，冻结以下边界：

- 允许：
  - 挂载 `openclaw-app`
  - 设置公开配置：`gatewayUrl`、`token`、`password`、`sessionKey`、`tab`
  - 注入主题变量、品牌色、头像图片、外层容器留白
  - 隐藏 iClaw 页面不需要的外围导航区域
- 禁止：
  - 直接读写 `openclaw-app` 内部聊天状态，例如 `chatMessages`、`chatStream`、`chatThinkingLevel`
  - 通过 JS 手动回填 `chat.history`
  - 通过 JS 接管发送、停止、滚动、流式渲染
  - 隐藏或替换原生聊天输入区
  - 隐藏原生登录门、执行审批覆盖层等功能性 UI

升级 OpenClaw 版本时，优先验证“原生 control UI chat 在 iClaw 容器内可正常工作”，再评估是否需要额外样式覆盖。默认不新增 JS 层兼容逻辑。

补充说明：

- 详细的 wrapper 架构、`3.8` 经验复盘、auth bridge / theme bridge / diagnostics 分层，见：
  - [openclaw-wrapper-architecture.md](/Users/xingkaihan/Documents/Code/iClaw/docs/openclaw-wrapper-architecture.md)

## 11. OEM 能力架构冻结

OEM 后续不再按“每个品牌各自维护一份能力定义”的方式扩展。

冻结原则：

- 所有 OEM 能力采用“平台能力中心 + OEM 装配层”架构
- 平台能力主数据统一存数据库，不以代码常量作为长期权威来源
- OEM 侧只维护是否适用、默认项、推荐项、排序和少量装配参数
- `skill / mcp / model` 必须按此模式治理
- 运行时直接依赖的配置必须标记为 `runtime-bound`，由 control-plane 下发到本地 snapshot / runtime config，再供 sidecar 消费
- 不被 OpenClaw runtime 直接消费的配置可标记为 `cloud-live`，允许前端实时从云端获取
- 未来扩展到 `sidebar / header / input / home / menu / asset slot / surface block` 时，也优先遵循同一模式

详细说明见：

- [oem-capability-architecture.md](/Users/xingkaihan/Documents/Code/iClaw/docs/oem-capability-architecture.md)

## 12. 账号资产存储冻结

针对头像、用户上传文件、账户级附件等“用户资产”，冻结以下原则：

- 用户资产 bucket 使用固定基础设施 bucket，不再默认绑定 `${APP_NAME}-files`
- 默认 `tenantId = appName`
- 用户资产 object key 按业务归属编码，例如：
  - `tenants/{tenantId}/users/{userId}/avatar/{file}`
- OEM 品牌资源、安装包、runtime 包继续走品牌 / app 维度的存储路径
- 不允许通过切换本地 `.env` 中的 `APP_NAME`，静默改变用户资产的读取 bucket
- 历史遗留的用户头像 key 允许兼容旧 bucket 读取，但新写入必须走固定 bucket + tenant/user key 规则
