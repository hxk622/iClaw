# Desktop Command Authorization Implementation Plan

更新时间：2026-04-10

## 1. 文档目的

本文是 [desktop-command-authorization-architecture.md](../architecture/desktop-command-authorization-architecture.md) 的实施层补充，面向产品、设计、桌面端、control-plane、admin-web 联合评审。

本文回答 5 个问题：

1. 第一阶段到底做哪些功能
2. 数据表和 API 怎么建
3. 桌面端状态机怎么拆
4. admin-web 菜单和页面怎么放
5. 哪些页面需要出 Figma 稿，以及对应 prompt 是什么

## 2. 实施边界

### 2.1 本阶段要做

- 桌面端高危动作统一进入授权流
- 支持一次性授权
- 仅对低中风险受控动作支持任务级与会话级授权缓存
- 本地审计日志
- control-plane 侧企业策略管理基础接口
- admin-web 基础查询页

### 2.2 本阶段不做

- 完整企业级多租户审批流
- 第三方 IAM / SSO 审批联动
- 复杂 RBAC 编排器
- 所有 shell 动作模板化
- 所有平台统一深度提权能力

## 3. MVP 定义

MVP 只覆盖以下动作类型：

- `open_external_link`
- `collect_diagnostics`
- `upload_diagnostics`
- `manage_local_process`
- `execute_shell`
- `elevated_execute`

约束说明：

- `execute_shell` 在 MVP 内只允许以 `allow_with_approval` 方式进入授权流，不允许自动静默放行
- `elevated_execute` 在 MVP 内只允许 `once`，不允许缓存为 `task` / `session`
- 白名单能力仅面向模板化动作和低风险受控动作，不面向自由文本 shell

MVP 成功标准：

- 用户发起后，高危动作不再直接执行
- 用户能看懂动作意图、风险、影响范围
- 允许一次 / 本任务 / 本会话三种授权
- 审计链完整
- admin-web 能看见策略和审计记录

## 4. 推荐表结构

### 4.1 `desktop_action_policy_rules`

用途：

- 存企业级或平台级动作策略

建议字段：

```sql
create table desktop_action_policy_rules (
  id text primary key,
  scope text not null, -- platform | oem | org
  scope_id text null,
  name text not null,
  effect text not null, -- allow | allow_with_approval | deny
  capability text not null,
  risk_level text not null, -- low | medium | high | critical
  official_only boolean not null default false,
  publisher_ids jsonb not null default '[]'::jsonb,
  package_digests jsonb not null default '[]'::jsonb,
  skill_slugs jsonb not null default '[]'::jsonb,
  workflow_ids jsonb not null default '[]'::jsonb,
  executor_types jsonb not null default '[]'::jsonb,
  executor_template_ids jsonb not null default '[]'::jsonb,
  canonical_path_prefixes jsonb not null default '[]'::jsonb,
  network_destinations jsonb not null default '[]'::jsonb,
  access_modes jsonb not null default '[]'::jsonb,
  allow_elevation boolean not null default false,
  allow_network_egress boolean not null default false,
  grant_scope text not null default 'once',
  max_grant_scope text not null default 'once',
  ttl_seconds integer null,
  enabled boolean not null default true,
  priority integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

字段约束：

- 不允许把自由文本 shell 命令存入策略表作为白名单条件
- `execute_shell` / `elevated_execute` 的策略 `effect` 只能是 `allow_with_approval` 或 `deny`
- `elevated_execute.max_grant_scope` 必须固定为 `once`
- `network_destinations` 必须记录 `scheme + host + port + pathPrefix + redirectPolicy`
- `official_only=true` 时，必须同时命中 `publisher_ids` 或 `package_digests`

### 4.2 `desktop_action_approval_grants`

用途：

- 记录用户授予的临时授权

建议字段：

```sql
create table desktop_action_approval_grants (
  id text primary key,
  user_id text not null,
  device_id text not null,
  app_name text not null,
  intent_fingerprint text not null,
  approved_plan_hash text not null,
  capability text not null,
  risk_level text not null,
  access_modes jsonb not null default '[]'::jsonb,
  normalized_resources jsonb not null default '[]'::jsonb,
  network_destinations jsonb not null default '[]'::jsonb,
  executor_type text not null,
  executor_template_id text null,
  publisher_id text null,
  package_digest text null,
  scope text not null, -- once | task | session | ttl
  task_id text null,
  session_key text null,
  expires_at timestamptz null,
  revoked_at timestamptz null,
  created_at timestamptz not null default now()
);

create index desktop_action_approval_grants_lookup_idx
  on desktop_action_approval_grants(user_id, device_id, app_name, intent_fingerprint);
```

复用约束：

- grant 命中必须同时匹配 `intent_fingerprint + approved_plan_hash`
- L3 只能存 `once`
- L4 不允许落 grant
- `elevated_execute` 不允许命中 `task` / `session` grant

### 4.3 `desktop_action_audit_events`

用途：

- 记录动作全链路事件

建议字段：

```sql
create table desktop_action_audit_events (
  id text primary key,
  intent_id text not null,
  trace_id text not null,
  user_id text null,
  device_id text not null,
  app_name text not null,
  agent_id text null,
  skill_slug text null,
  workflow_id text null,
  capability text not null,
  risk_level text not null,
  requires_elevation boolean not null default false,
  decision text not null, -- allow | deny | pending
  stage text not null,
  summary text not null,
  reason text null,
  resources jsonb not null default '[]'::jsonb,
  matched_policy_rule_id text null,
  approved_plan_hash text null,
  executed_plan_hash text null,
  command_snapshot_redacted text null,
  result_code text null,
  result_summary text null,
  duration_ms integer null,
  created_at timestamptz not null default now()
);

create index desktop_action_audit_events_trace_idx
  on desktop_action_audit_events(trace_id, created_at desc);
```

审计约束：

- 默认不上报未脱敏的原始命令
- 若 `approved_plan_hash != executed_plan_hash`，必须记录专门的拒绝/失配事件
- 必须记录 `matched_policy_rule_id`，用于还原“命中哪条策略后执行”

### 4.4 `desktop_diagnostic_uploads`

用途：

- 记录本地日志上传结果，供后续“客户日志监控”复用

建议字段：

```sql
create table desktop_diagnostic_uploads (
  id text primary key,
  user_id text null,
  device_id text not null,
  app_name text not null,
  upload_bucket text not null,
  upload_key text not null,
  file_name text not null,
  file_size_bytes bigint not null,
  sha256 text null,
  source_type text not null, -- manual | auto_error_capture | approval_flow
  contains_customer_logs boolean not null default true,
  sensitivity_level text not null default 'customer',
  linked_intent_id text null,
  created_at timestamptz not null default now()
);
```

上传约束：

- 诊断上传必须绑定具体 bucket / key prefix / source_type
- `contains_customer_logs=true` 的对象在 admin-web 中必须按更严格权限展示和下载

## 5. API 草案

### 5.1 Admin 策略接口

#### `GET /admin/security/action-policies`

用途：

- 分页查看策略列表

筛选参数：

- `scope`
- `capability`
- `riskLevel`
- `enabled`
- `query`

返回示意：

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "pol_001",
        "name": "官方诊断日志采集",
        "scope": "platform",
        "effect": "allow_with_approval",
        "capability": "collect_diagnostics",
        "riskLevel": "medium",
        "maxGrantScope": "session",
        "enabled": true,
        "priority": 100
      }
    ],
    "total": 1
  }
}
```

#### `POST /admin/security/action-policies`

用途：

- 新建策略

服务端校验：

- 拒绝保存自由文本 shell 白名单
- `execute_shell` 不能保存为 `allow`
- `elevated_execute` 不能保存 `task` / `session`
- `official_only=true` 时必须提交发布者身份约束

#### `PUT /admin/security/action-policies/:id`

用途：

- 更新策略

#### `POST /admin/security/action-policies/:id/toggle`

用途：

- 启用或停用策略

### 5.2 Admin 审计接口

#### `GET /admin/security/action-audit-events`

用途：

- 查询动作审计日志

筛选参数：

- `appName`
- `userId`
- `deviceId`
- `capability`
- `riskLevel`
- `decision`
- `dateFrom`
- `dateTo`

#### `GET /admin/security/action-audit-events/:intentId`

用途：

- 查看单次动作详情

详情建议包含：

- 意图说明
- 资源范围
- 策略命中结果
- 用户授权方式
- 执行结果
- 关联日志与上传记录
- `matchedPolicyRuleId`
- `approvedPlanHash`
- `executedPlanHash`
- `commandSnapshotRedacted`

### 5.3 Admin 授权撤销接口

#### `GET /admin/security/action-grants`

用途：

- 查询当前生效授权

#### `POST /admin/security/action-grants/:id/revoke`

用途：

- 撤销授权

### 5.4 桌面端策略拉取接口

#### `GET /portal/runtime/security/action-policy-snapshot?app_name=<app>`

用途：

- 拉取当前 app 生效的动作策略快照

备注：

- 该接口只下发策略快照，不下发“可绕过本地校验”的执行许可
- 桌面端必须在本地再次做路径规范化、发布者校验、grant scope 裁剪和 plan hash 一致性校验

### 5.5 审计上报接口

#### `POST /portal/desktop/security/action-audit-events`

用途：

- 桌面端批量上报本地审计日志

要求：

- 仅允许上报脱敏后的命令摘要
- 必须携带 `matchedPolicyRuleId`、`approvedPlanHash`、`executedPlanHash`

### 5.6 诊断文件元数据接口

#### `POST /portal/desktop/security/diagnostic-uploads`

用途：

- 记录客户端已上传到 S3 / MinIO 的日志文件元数据

要求：

- 必须携带 bucket、object key、source type、是否包含客户真实日志
- 下载权限由 control-plane 侧更严格鉴权单独控制

## 6. 桌面端状态机

### 6.1 顶层状态

建议抽象为：

- `idle`
- `intent_preparing`
- `policy_evaluating`
- `approval_required`
- `approved_pending_execute`
- `executing`
- `completed`
- `denied`
- `plan_mismatch_denied`
- `failed`

### 6.2 状态转移

```text
idle
  -> intent_preparing
  -> policy_evaluating
  -> approval_required
      -> denied
      -> approved_pending_execute
      -> plan_mismatch_denied
  -> executing
      -> completed
      -> failed
```

### 6.3 前端组件建议

建议拆成 5 个组件：

1. `ActionIntentCard`
   - 展示动作意图、人话解释、风险标签

2. `ActionApprovalSheet`
   - 底部或中间确认层
   - 提供授权选项

3. `ActionExecutionResultCard`
   - 展示执行结果、日志摘要、下一步建议

4. `ActionAuditTimeline`
   - 开发态或安全中心查看完整事件链

5. `ActionPolicyBadge`
   - 展示“由策略自动允许”“需人工授权”“已被策略拒绝”

### 6.4 本地强制执行清单

以下逻辑必须由桌面端本地强制执行，不能只依赖 control-plane：

1. realpath / canonical path 规范化
2. scheme + host + port + pathPrefix + redirectPolicy 的网络目标校验
3. `official_only` 的发布者身份校验
4. capability 对应的最大 `grant_scope` 裁剪
5. `approved_plan_hash` 与 `executed_plan_hash` 一致性检查
6. 离线时默认更保守的拒绝或显式确认

### 6.5 与聊天页关系

聊天区建议按以下顺序串联：

- 用户消息
- 模型分析卡
- 行动建议卡
- 授权卡
- 执行结果卡

不要把授权按钮直接塞进“思考过程折叠区”里。

## 7. Admin-web 信息架构

### 7.1 左侧菜单建议

在 `admin-web` 左侧新增一级菜单：

- `安全治理`

二级建议：

- `动作策略`
- `授权记录`
- `动作审计`
- `客户日志监控`

### 7.2 页面职责

#### `动作策略`

右侧主表：

- 策略名
- 生效范围
- capability
- 风险级别
- 是否允许提权
- 授权粒度
- 状态
- 更新时间

右抽屉：

- 匹配范围
- 来源限制
- 资源约束
- 命中示例
- 修改历史

#### `授权记录`

右侧主表：

- 用户
- 设备
- app
- capability
- 授权范围
- 生效状态
- 过期时间
- 创建时间

右抽屉：

- 对应 intent 指纹
- 命中资源范围
- 来源 skill / workflow
- 撤销按钮

#### `动作审计`

右侧主表：

- 时间
- 用户
- 设备
- capability
- 风险等级
- 决策
- 是否提权
- app

右抽屉：

- 事件时间线
- 原始命令摘要
- 策略命中结果
- 执行结果
- 关联日志上传

#### `客户日志监控`

这是你前面提的需求，建议直接纳入同一安全治理域。

右侧主表：

- 上传时间
- 用户
- 设备
- app
- 文件名
- 文件大小
- 来源
- 关联动作

右抽屉：

- 文件详情
- 文本预览
- 关联对话 / intent / trace
- 下载
- 跳转动作审计

## 8. 第一期任务拆解

### 8.1 桌面端

- 新增 `ActionIntent` 类型与规范化函数
- 新增 `PolicyEngine` 本地执行器
- 新增授权卡 UI
- 接入聊天动作流
- 本地 grant cache
- 本地 audit log queue

### 8.2 Control-plane

- 新增策略表
- 新增授权表
- 新增审计表
- 新增日志上传元数据表
- 新增 admin API
- 新增 runtime snapshot API

### 8.3 Admin-web

- 新增 `安全治理` 菜单
- 新增 4 个列表页
- 新增右抽屉详情
- 新增筛选器和撤销操作

### 8.4 对象存储 / 运维

- 新增 `customer-logs/` 前缀规范
- 对接 S3 / MinIO 生命周期
- 设置保留期
- 设置下载鉴权

## 9. Figma 设计范围

建议至少出 6 个关键稿：

1. 聊天页内的动作建议卡
2. 授权弹层 / 授权卡
3. 高危动作二次确认态
4. 执行结果卡
5. admin-web `动作审计` 列表 + 右抽屉
6. admin-web `客户日志监控` 列表 + 右抽屉

## 10. 给 Figma / 设计师 / AI 设计工具的 Prompt

以下 prompt 偏高保真方向，适合直接喂给 Figma AI、Lovable、v0、Claude Artifacts 或设计师作为设计说明。

### 10.1 聊天页授权卡 Prompt

```text
为一个桌面端 AI 助手设计“动作授权卡”组件，场景位于聊天页面中部，紧跟在 AI 的行动建议之后。

产品背景：
- 这是一个本地执行型桌面 AI，不只是聊天机器人
- 当 AI 需要读取系统信息、执行命令、上传日志、提权时，必须向用户请求授权
- 目标是让普通用户看得懂、愿意点，同时让专业用户可以展开查看技术细节

设计目标：
- 第一眼先看到“为什么要授权”，而不是原始 shell 命令
- 视觉上明确区分：普通动作、中风险动作、高风险动作
- 让用户感到可控、可信、非惊吓式
- 支持授权粒度：允许一次、本任务允许、本会话允许、拒绝

信息结构：
- 标题：需要你的授权
- 意图说明：例如“需要管理员权限来读取系统代理配置，用于诊断当前桌面端无法连接本地网关的问题”
- 风险标签：低 / 中 / 高 / 极高
- 影响范围：读取哪些路径、是否写入、是否上传远端、是否需要提权
- 折叠区：原始命令、目标路径、预计时长、回滚提示
- 底部操作：允许一次、本任务允许、本会话允许、拒绝

视觉要求：
- 桌面端、专业、克制、可信，不要做成营销弹窗
- 不要使用大面积纯红；高风险通过信息层级和边框/标签表达
- 风格接近现代企业级安全产品 + 高级 AI 工作台
- 卡片内信息密度高但层次清晰
- 支持亮色主题

请输出：
- 组件主态
- 展开技术详情态
- 高风险态
- 已批准态
- 已拒绝态
```

### 10.2 高危动作二次确认 Prompt

```text
设计一个“高危动作二次确认弹层”，用于桌面端 AI 在执行提权、删除文件、修改系统配置、上传本地日志到云端前的最终确认。

目标：
- 让用户明确知道自己正在批准一个高风险动作
- 强调后果和影响范围
- 避免误触

必须包含：
- 风险等级高亮
- 人话说明为什么需要这步动作
- 影响对象清单
- 是否可回滚
- 原始命令摘要
- 明确的主次按钮：确认执行 / 取消

风格要求：
- 企业级安全产品风格
- 可信、冷静、专业
- 不要夸张恐吓，但必须让用户感知这是 serious action
- 亮色主题优先
```

### 10.3 Admin-web 动作审计页 Prompt

```text
设计一个 admin-web 页面，名称为“动作审计”。

业务背景：
- 管理员需要查看桌面端 AI 发起的本地动作执行记录
- 需要知道是谁、在哪台设备、哪个 app、由哪个 skill / workflow 发起、执行了什么、是否提权、结果如何

页面结构：
- 左侧沿用现有 admin-web 导航
- 顶部是标题区和筛选区
- 主体是数据表
- 点击行后右侧滑出详情抽屉

列表字段：
- 时间
- 用户
- 设备
- App
- Capability
- 风险等级
- 决策结果
- 是否提权
- 来源 skill / workflow

详情抽屉：
- 意图说明
- 事件时间线
- 原始命令摘要
- 资源范围
- 策略命中结果
- 用户授权方式
- 执行结果
- 关联日志上传记录

设计风格：
- 企业级后台
- 高信息密度
- 清晰筛选和状态标签
- 支持长文本与结构化字段展示
- 亮色主题，避免普通 BI 风格的沉闷蓝灰模板
```

### 10.4 Admin-web 客户日志监控页 Prompt

```text
设计一个 admin-web 页面，名称为“客户日志监控”。

业务背景：
- 客户本地桌面端在异常时会自动上传日志到 S3 / 对象存储
- 运营、客服、技术支持需要按用户、设备、app、时间查看日志文件，并在右侧抽屉预览内容

页面结构：
- 顶部筛选区：用户、设备、App、时间范围、来源类型
- 中间主表：上传时间、用户、设备、App、文件名、大小、来源、关联动作
- 点击后右侧抽屉展示：
  - 文件元信息
  - 日志文本预览
  - 关联对话 / trace / intent
  - 下载按钮
  - 跳转到动作审计

设计目标：
- 兼顾客服和技术同学使用
- 列表清晰，右侧阅读区舒适
- 强调“这是客户侧真实日志”，需要专业但克制
- 支持长日志文本的分段阅读、搜索、高亮时间戳

视觉要求：
- 企业运维 + 安全后台风格
- 亮色主题
- 信息密度高但不拥挤
```

### 10.5 全流程 Storyboard Prompt

```text
请为一个桌面端 AI 助手绘制完整授权流程的高保真 storyboard，共 6 个连续画面：

1. 用户在聊天页提出问题
2. AI 输出行动建议卡
3. 系统弹出授权卡
4. 用户展开命令细节
5. 用户批准后显示执行中状态
6. 执行完成并展示结果卡

要求：
- 所有画面保持同一设计系统
- 桌面端应用窗口比例
- 亮色主题
- 高级、专业、可信
- 不要科幻风，不要消费级娱乐感
```

## 11. 评审建议

这份实施稿建议按以下顺序评审：

1. 产品确认授权粒度与默认策略，但不得突破安全不变量
2. 设计确认聊天页与 admin-web 的信息层级
3. 桌面端确认本地强制执行边界与离线保守策略
4. control-plane 确认表结构、接口与服务端拒绝保存非法策略
5. 运维确认日志上传、保留期、对象存储前缀与敏感日志下载权限

## 12. 下一步建议

如果本稿评审通过，建议直接进入三个并行输出：

1. 后端 SQL migration + domain types
2. 桌面端授权流 PRD + 本地强制校验实现清单
3. admin-web `安全治理` 菜单与页面实现
