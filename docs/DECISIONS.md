# iClaw 冻结决策（v0）

更新时间：2026-03-25

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

## 7.1 本地 Gateway 凭据冻结

针对桌面端本地 OpenClaw gateway 认证，进一步冻结以下原则：

- 本地 gateway token / password 属于“安装实例级本地 secret”，不是环境级配置
- 安装实例级本地 secret 必须在运行时生成，并保存在系统安全存储：
  - macOS：Keychain
  - Windows：Credential Manager
- 本地 runtime 配置中的 gateway auth 必须与系统安全存储里的同一份 secret 保持一致
- 桌面安装包在 Tauri 运行时，前端连接本地 `127.0.0.1:2126` 时，必须优先读取系统安全存储中的真实凭据
- 禁止把本地 gateway token / password 通过 `.env.prod`、`VITE_*`、前端 bundle、安装包静态资源等方式编译进 prod 包
- `.env.xxx` 只允许承载环境级公共配置，例如：
  - `APP_NAME`
  - `VITE_AUTH_BASE_URL`
  - `VITE_API_BASE_URL`
  - 品牌 / 发布渠道等非实例级配置
- control-plane access token / refresh token 与本地 gateway token 必须严格分离，禁止混用
- 若线上已发布安装包把本地 gateway secret 编译进包，该安装包视为发布缺陷，必须重新打包并替换下载页产物，不能指望后端热修复

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
- 其中 `MCP` 必须明确区分“平台级共享 catalog”与“OEM 级 binding”：
  - MCP 内容、元数据、logo、分类、连接方式、抓取结果属于平台级共享主数据
  - `iclaw` / `licaiclaw` 等 OEM app 只负责显隐、默认已安装、推荐、排序等绑定结果
  - 不允许把 OEM app 当成 MCP 内容拥有者，也不允许为不同 OEM 复制多份 MCP 主数据
- 运行时直接依赖的配置必须标记为 `runtime-bound`，由 control-plane 下发到本地 snapshot / runtime config，再供 sidecar 消费
- 不被 OpenClaw runtime 直接消费的配置可标记为 `cloud-live`，允许前端实时从云端获取
- 未来扩展到 `sidebar / header / input / home / menu / asset slot / surface block` 时，也优先遵循同一模式

详细说明见：

- [oem-capability-architecture.md](/Users/xingkaihan/Documents/Code/iClaw/docs/oem-capability-architecture.md)

## 11.1 Skill 分层与展示冻结

针对 `skill`，进一步冻结以下原则：

- `cloud skill` 是唯一权威总库，是 skill 全集；规模可以是 `30000+`
- 平台级 skill 只是共享绑定层，不是另一份 skill 主数据
- OEM 级 skill 是 app 自己的增量绑定层，不是私有 skill 总库
- `admin/portal/catalog/skills` 在语义上是“平台级 skill 绑定视图”
- 平台侧不再上传或维护 skill artifact，本地 `skills/` 目录也不是平台 skill 真值
- 某个 OEM app 的可见 skill 集合固定为：
  - `visible_skills(app) = platform_level_skills + oem_level_skills(app)`
  - 合并时按 `skill_key` 去重
- OEM app 允许配置 `capabilities.skill_catalog.visibility_mode`
  - `bindings_only`：只显示绑定集合
  - `all_cloud`：OEM 默认全量可见 cloud 总库
- 左侧菜单是同一可见集合上的 tag 视图：
  - `技能商店` = 全部可见 skill
  - `财经技能` = 可见 skill 中带财经 tag 的集合
  - `基础技能` = 可见 skill 中带基础办公 / 基础 tag 的集合
- skill 不再保留 `visibility / internal / showcase` 这类展示字段
- 不单独引入“平台强制 skill 名单”业务概念；对所有 OEM 生效的 skill 应通过平台级绑定表达
- `skills/`、`mcp/` 等本地目录只作为开发 / 导入 / 迁移源，不再作为长期权威来源
- `admin-web` 平台视角必须能看到 skill 总库全集，只允许通过分页 / 搜索改善体验，不允许通过“只看已安装项”缩小全集定义

## 12. 账号资产存储冻结

针对头像、用户上传文件、账户级附件等“用户资产”，冻结以下原则：

- 用户资产 bucket 使用固定基础设施 bucket，不再默认绑定 `${APP_NAME}-files`
- 默认 `tenantId = appName`
- 用户资产 object key 按业务归属编码，例如：
  - `tenants/{tenantId}/users/{userId}/avatar/{file}`
  - `tenants/{tenantId}/users/{userId}/skills/private/{slug}/{version}/artifact.{ext}`
  - `tenants/{tenantId}/users/{userId}/uploads/{kind}/{fileId}/{file}`
- OEM 品牌资源、安装包、runtime 包继续走品牌 / app 维度的存储路径
- 不允许通过切换本地 `.env` 中的 `APP_NAME`，静默改变用户资产的读取 bucket
- 历史遗留的用户资产 key 允许兼容旧 bucket 读取，但新写入必须走固定 bucket + tenant/user key 规则

## 13. 禁止 Fallback 冻结

针对 OEM profile 同步、runtime 同步、桌面打包等关键链路，冻结以下原则：

- 禁止用 fallback 掩盖真实错误
- 一旦源 PostgreSQL / MinIO / control-plane 数据不可用，流程必须直接失败并暴露明确错误
- 禁止继续使用缓存 profile、旧 runtime 快照、本地陈旧资源偷偷产出“看起来成功”的包
- `prod` 打包与发布链必须显式依赖配置好的 source 环境，不允许在 source 失败时回退到当前开发机残留状态
- 错误优先级高于“勉强产物可出”；没有正确数据源，就不允许生成发布候选产物
- 打包 source 配置与运行时配置必须分离，禁止复用同一组变量
- `dev / test / prod` 各自的打包链只读取各自 `.env.xxx` 中的 `ICLAW_PACKAGE_SOURCE_*` 变量
- 打包链禁止跨环境偷读配置，例如 `prod` 打包禁止回读 `.env.dev`
