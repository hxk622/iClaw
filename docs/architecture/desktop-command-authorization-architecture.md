# Desktop Command Authorization Architecture

更新时间：2026-04-10

## 1. 文档目的

本文定义 iClaw / OpenClaw 桌面端在“模型请求执行本地命令、访问敏感资源、请求提权”时的统一授权架构。

本文不是只讨论一个弹窗，而是要同时解决以下问题：

- 用户为什么要授权，当前解释不清
- 同一类动作每次都重复授权，摩擦过高
- “命令白名单”如果按字符串做，脆弱且不可扩展
- 高危动作缺少统一风险分级和审计
- 不同 agent / skill / tool 未来会重复造权限逻辑

目标是形成一套可 review、可实现、可审计、可演进的产品与技术方案。

## 2. 核心结论

需要同时做两套能力，但必须分层：

1. 用户授权层
   - 解决“用户看得懂、愿意点、知道后果”
   - 面向意图解释、风险提示、交互体验

2. 策略白名单层
   - 解决“哪些动作可以减少重复授权、哪些永远不能自动放行”
   - 面向结构化策略、约束边界、长期可维护性

这两层不能互相替代。

如果只做授权弹窗，没有策略层，产品会越来越吵，最终不可用。
如果只做白名单，没有授权解释层，产品会变成黑盒高危自动执行器，最终不可被信任。

## 3. 要解决的真实场景

桌面端未来会持续出现以下动作：

- 读取本机系统信息
- 读取或写入工作区文件
- 启停本地 runtime / gateway / sidecar
- 拉取诊断日志
- 安装依赖或修复环境
- 打开外部浏览器、文件、链接
- 执行本地 shell 命令
- 请求管理员权限 / sudo / UAC
- 上传日志、诊断快照到企业对象存储

这些动作的风险完全不同，不应使用同一种授权模型。

## 4. 设计原则

### 4.1 先解释意图，再显示命令

用户首先要看到的是“为什么要做这件事”，而不是原始 shell。

推荐顺序：

- 意图说明
- 风险等级
- 影响范围
- 是否需要提权
- 是否可回滚
- 原始命令或动作明细

### 4.2 白名单不按命令字符串建模

禁止用以下模式做长期白名单：

- `sudo ls /etc/sudoers`
- `rm -rf /tmp/foo`
- `cmd /C start https://...`

原因：

- 同一意图可能有不同实现命令
- 参数顺序、转义方式、shell 差异会导致匹配脆弱
- 很容易被 prompt 拼接或参数变形绕过

白名单必须基于结构化策略，而不是字符串比较。

### 4.3 高危动作即使命中白名单，也不默认静默执行

以下动作默认需要显式确认：

- 删除文件
- 修改系统配置
- 写系统级目录
- 安装或卸载软件
- 注册开机启动 / 持久化服务
- 上传本地日志或数据到远端
- 访问用户敏感目录
- 执行需要管理员权限的动作

白名单只能降低低中风险动作的重复摩擦，不能抹平高风险确认。

### 4.4 优先做“受控动作模板”，再做“自由命令执行”

长期看，产品应优先暴露：

- 收集诊断信息
- 修复本地 runtime
- 重启本地网关
- 打开官方帮助页
- 导出最近 10 分钟日志

而不是一开始就让模型直接自由执行任意 shell。

模板化动作更容易：

- 做权限约束
- 给用户讲清楚
- 审计
- 做跨平台实现
- 控制回滚

### 4.5 授权必须可撤销、可过期、可审计

长期允许不是永久允许。

任何授权都至少要支持：

- 仅本次
- 当前任务
- 当前会话
- 指定期限
- 手动撤销

### 4.6 安全不变量优先于产品配置

以下约束定义为不可违反的安全不变量，不允许通过 admin-web、control-plane 配置或 OEM 定制绕过：

1. 不允许将自由文本原始 shell 命令录入长期白名单。
2. `execute_shell` 不允许自动静默放行；只有受控模板 shell 动作才允许进入 `allow_with_approval`，且默认仅 `once`。
3. `elevated_execute` 永远不能静默放行，且不允许缓存为 `task` / `session` grant。
4. 白名单只允许覆盖模板化动作和低风险受控动作，不允许覆盖 L3 / L4 的自由执行能力。
5. grant 复用必须绑定结构化资源、访问模式、来源身份、风险等级和批准时的执行计划 hash。
6. 高风险动作一旦进入用户确认态，批准前后执行计划不可变。
7. control-plane 只负责下发策略与记录审计，最终强制执行必须在桌面端本地完成；离线时默认更保守，而不是更宽松。

## 5. 目标架构

整体拆成 6 层：

1. Intent Layer
   - 把模型原始动作请求翻译成稳定的“用户意图”

2. Policy Layer
   - 根据能力、资源范围、风险等级判断是否需要授权、是否允许自动执行

3. Approval Layer
   - 负责与用户交互
   - 记录授权范围和期限

4. Execution Layer
   - 负责真正落地执行
   - 包括 shell、浏览器、文件系统、网络上传等受控执行器

5. Audit Layer
   - 记录请求、裁决、执行结果、产物摘要

6. Governance Layer
   - 给 admin-web / 安全中心提供策略配置、授权撤销、审计查询

## 6. 核心对象模型

### 6.1 ActionIntent

模型或 workflow 不直接请求“执行字符串命令”，而是先生成 `ActionIntent`。

示意字段：

```ts
type ActionIntent = {
  id: string;
  source: {
    agentId: string | null;
    skillSlug: string | null;
    workflowId: string | null;
    publisherId: string | null;
    packageId: string | null;
    packageVersion: string | null;
    packageDigest: string | null;
    toolName: string;
  };
  capability:
    | 'read_system_info'
    | 'read_workspace_file'
    | 'write_workspace_file'
    | 'manage_local_process'
    | 'open_external_link'
    | 'collect_diagnostics'
    | 'upload_diagnostics'
    | 'install_dependency'
    | 'execute_shell'
    | 'elevated_execute';
  summary: string;
  reason: string;
  requiresElevation: boolean;
  resources: Array<{
    kind: 'path' | 'url' | 'port' | 'process' | 'bucket';
    value: string;
    access: 'read' | 'write' | 'execute' | 'connect';
    normalizedValue?: string;
  }>;
  executorType: 'template' | 'shell' | 'browser' | 'filesystem' | 'process' | 'upload';
  executorTemplateId: string | null;
  riskClass: 'L1' | 'L2' | 'L3' | 'L4';
  networkDestinations: Array<{
    scheme: string;
    host: string;
    port: number | null;
    pathPrefix: string | null;
    redirectPolicy: 'none' | 'same-origin-only' | 'allowlisted';
  }>;
  commandPreview: string | null;
  rollbackHint: string | null;
  compiledPlanHash: string;
  metadata: Record<string, unknown>;
};
```

### 6.2 PolicyRule

策略规则以“能力 + 范围 + 来源 + 风险”建模。

```ts
type PolicyRule = {
  id: string;
  effect: 'allow' | 'allow_with_approval' | 'deny';
  capability: string;
  sourceScopes: {
    officialOnly?: boolean;
    skillSlugs?: string[];
    agentIds?: string[];
    workflowIds?: string[];
  };
  constraints: {
    canonicalPathPrefixes?: string[];
    networkDestinations?: Array<{
      scheme: string;
      host: string;
      port?: number;
      pathPrefix?: string;
      redirectPolicy?: 'none' | 'same-origin-only' | 'allowlisted';
    }>;
    allowElevation?: boolean;
    allowNetworkEgress?: boolean;
    requiredAccessModes?: Array<'read' | 'write' | 'execute' | 'connect'>;
    executorTypes?: string[];
    executorTemplateIds?: string[];
    publisherIds?: string[];
    packageDigests?: string[];
  };
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  grantScope: 'once' | 'task' | 'session' | 'ttl';
  ttlSeconds?: number;
};
```

### 6.3 ApprovalGrant

```ts
type ApprovalGrant = {
  id: string;
  intentFingerprint: string;
  approvedPlanHash: string;
  grantedByUserId: string;
  scope: 'once' | 'task' | 'session' | 'ttl';
  expiresAt: string | null;
  createdAt: string;
  revocable: boolean;
};
```

### 6.4 AuditEvent

```ts
type AuditEvent = {
  id: string;
  intentId: string;
  stage:
    | 'intent_created'
    | 'policy_evaluated'
    | 'approval_requested'
    | 'approval_granted'
    | 'approval_denied'
    | 'execution_started'
    | 'execution_finished';
  decision: 'allow' | 'deny' | 'pending';
  reason: string;
  matchedPolicyRuleId: string | null;
  approvedPlanHash: string | null;
  executedPlanHash: string | null;
  commandSnapshotRedacted: string | null;
  resultCode: string | null;
  durationMs: number | null;
  createdAt: string;
};
```

## 7. 风险分级模型

建议统一分为 4 级：

### 7.1 L1 低风险

- 读取工作区内非敏感文件
- 打开官方帮助链接
- 查询本地进程状态

默认策略：

- 可在规则命中时自动放行
- 仍保留审计
- 可进入模板级长期 allow

### 7.2 L2 中风险

- 重启本地 sidecar
- 读取系统配置
- 导出本地诊断包到用户指定目录

默认策略：

- 首次授权
- 支持任务级 / 会话级复用
- 仅允许模板化动作或受控 capability 进入复用

### 7.3 L3 高风险

- 提权执行
- 写系统目录
- 修改服务配置
- 上传日志到远端

默认策略：

- 每次显式确认
- 禁止普通长期静默放行
- grant scope 只能是 `once`
- 不允许通过自由 shell 白名单复用

### 7.4 L4 极高风险

- 批量删除
- 持久化启动项
- 修改防火墙、sudoers、注册表关键项
- 下载后直接执行未知脚本

默认策略：

- 默认拒绝
- 只有受控官方 workflow 且命中特批策略时才可进入人工确认
- 不允许缓存 grant
- 不允许静默自动执行

## 8. 用户授权交互设计

### 8.1 基本结构

授权卡片应分为两层：

1. 意图层
   - 为什么要做
   - 会影响什么
   - 风险等级

2. 技术层
   - 具体命令
   - 目标路径 / 目标 URL
   - 提权说明
   - 预计时长 / 回滚提示

默认展开意图层，默认折叠技术层。

### 8.2 推荐操作项

建议提供以下按钮：

- `允许一次`
- `本任务内允许`
- `本次会话内允许`
- `拒绝`
- `查看命令详情`

如果动作是高风险或涉及提权，则不要展示“长期允许”。

### 8.3 文案原则

不要只显示：

- “是否允许执行这个命令”

应该显示：

- “需要管理员权限来读取系统代理配置，用于诊断当前桌面端无法连接本地网关的问题”

再补充：

- 影响对象
- 是否写入
- 是否上传远端
- 失败后是否自动回滚

### 8.4 与思考过程的关系

授权不是“思考过程”的一部分，而是“行动审批”的一部分。

推荐 UI 分层：

- 思考过程：模型如何分析问题
- 行动卡：模型建议采取什么动作
- 授权卡：用户是否批准该动作
- 结果卡：动作执行结果

这样可以避免“思考内容”和“高危动作审批”混在同一视觉容器里。

## 9. 白名单设计

### 9.1 不做命令白名单，做策略白名单

建议允许长期配置的只有这几类：

- 官方诊断动作
- 官方修复动作
- 低风险读取动作
- 指定 skill / workflow 的受控动作

禁止用户直接对白名单录入原始 shell 命令。

### 9.2 白名单匹配维度

一个动作能否复用授权，至少要同时匹配：

- capability
- resource scope
- source scope
- risk level
- elevation flag
- network egress flag

例如：

- `collect_diagnostics`
- 仅允许读取 `%APPDATA%/iClaw/logs` 与 runtime 日志目录
- 来源必须是官方 `desktop-runtime-repair` workflow
- 不允许提权
- 不允许上传外网

### 9.3 Fingerprint 规则

建议使用结构化指纹，而不是命令字符串：

```text
capability
+ normalized resources
+ resource access mode
+ executor type / template id
+ source identity(publisher/package/workflow)
+ risk class
+ elevation
+ network destination set
+ approved plan hash
```

这样同一动作即使底层实现命令有微调，也能安全复用授权，同时避免“读”和“写”、“官方旧版本”和“被替换版本”共用同一 grant。

### 9.4 默认禁止的白名单方向

以下动作禁止加入长期白名单：

- 任意 `rm -rf`
- 任意 `sudo`
- 任意外网上传
- 任意浏览器打开非企业信任域名
- 任意执行下载后脚本
- 任意自由文本 shell / powershell / bash / cmd 命令

## 10. 执行平面设计

### 10.1 受控执行器，而不是直接裸 shell

执行层建议抽象为多个 executor：

- `ShellExecutor`
- `BrowserExecutor`
- `FilesystemExecutor`
- `ProcessExecutor`
- `UploadExecutor`

所有 executor 都走统一的：

- intent 创建
- policy 评估
- approval 申请
- audit 记录

### 10.2 优先路由到高层 executor

例如：

- 打开网页，不要走 `cmd /C start`
- 重启 gateway，不要先拼 shell，再间接调用
- 收集日志，不要让模型自由写压缩脚本

应该优先使用平台级 API 或受控模板动作。

### 10.3 提权动作单独治理

`elevated_execute` 必须单独经过：

- 平台确认
- 用户显式同意
- 更严格的审计
- 更短的授权 TTL

不能把提权动作和普通 shell 动作混到一套默认策略里。

### 10.4 批准前后计划必须一致

用户批准的是“已编译完成的那个动作计划”，不是模糊意图。

因此系统必须满足：

- 用户看到确认卡时，已经生成稳定的 `compiledPlanHash`
- grant 记录中保存 `approvedPlanHash`
- 执行开始时重新计算并记录 `executedPlanHash`
- 若 `approvedPlanHash != executedPlanHash`，必须中止执行并重新申请授权

这条规则用于防止批准前后参数漂移、执行器切换、资源范围扩大等 TOCTOU 问题。

## 11. 审计与安全中心

### 11.1 最低审计要求

每次动作至少记录：

- 用户
- 设备
- app / brand
- agent / skill / workflow 来源
- 意图说明
- 风险等级
- 资源范围
- 实际执行摘要
- 是否提权
- 是否命中白名单
- 用户如何授权
- 执行结果
- 关联日志 / 产物位置

同时默认遵循最小暴露原则：

- control-plane 默认只保存脱敏后的 `commandSnapshotRedacted`
- 原始命令和客户本地真实日志不进入普通 admin 查询
- 下载客户日志必须走更严格鉴权并单独审计

### 11.2 Admin 侧能力

后续建议在 admin-web 增加：

- 授权策略管理
- 审计日志查询
- 用户授权撤销
- 高危动作告警
- 企业级默认策略下发

### 11.3 用户侧安全中心

桌面端建议补充：

- 我授权过什么
- 哪些授权仍有效
- 一键撤销全部会话授权
- 是否允许诊断日志上传

## 12. 本地强制执行边界

以下校验必须在桌面端本地强制执行，不能仅依赖 control-plane 返回结果：

1. 路径规范化
   - 必须基于 realpath / canonical path
   - 处理 symlink、junction、`..`、大小写、UNC 路径

2. 网络目标规范化
   - 必须校验 scheme、host、port、path prefix、redirect policy
   - 不能只按 `allow_network_egress=true` 这种布尔开关放行

3. 发布者身份校验
   - `official_only` 必须绑定真实发布者身份、package/workflow id、版本或 digest

4. grant scope 上限
   - 本地按 capability / risk class 再次裁剪允许的最大 grant scope
   - 即使 control-plane 错配，本地也不能把 L3/L4 放宽成 task/session

5. 计划一致性校验
   - 比较 `approvedPlanHash` 与 `executedPlanHash`
   - 不一致直接拒绝执行并要求重新授权

6. 离线退化策略
   - control-plane 不可达时，不允许扩大权限
   - 无法验证策略时按更保守路径处理：要求显式授权或直接拒绝

## 13. 推荐实现顺序

### Phase 1：先把授权链路做正确

范围：

- `ActionIntent`
- `PolicyEngine` 基础版
- 授权卡 UI
- 一次性授权
- 审计日志落本地

目标：

- 高危动作不再黑盒执行
- 用户能看懂为什么授权

### Phase 2：受控模板动作

范围：

- 收集诊断
- 重启 runtime
- 修复本地环境
- 打开官方支持页

目标：

- 减少自由 shell 使用比例
- 提高跨平台稳定性

### Phase 3：结构化白名单

范围：

- 任务级 / 会话级 / TTL 授权
- 指纹匹配
- 安全中心撤销

目标：

- 降低重复授权摩擦
- 不牺牲高危动作安全性

### Phase 4：企业级治理

范围：

- admin-web 策略下发
- 组织级默认策略
- S3 / MinIO 审计归档
- 安全告警

目标：

- 从单机产品能力升级到企业可采购能力

## 13. 与当前 iClaw 架构的关系

### 13.1 适合放在 wrapper / desktop 壳层

- ActionIntent 生成
- 授权卡 UI
- 本地审批缓存
- 本地 executor 抽象
- 本地审计日志

### 13.2 适合放在 control-plane

- 企业级策略模板
- 组织级策略分发
- 审计汇聚与检索
- 高危动作分析报表

### 13.3 不建议直接下沉到 OpenClaw kernel

当前阶段更适合在 iClaw wrapper / integration 层治理。

原因：

- 这是 OEM 产品策略，不只是 kernel 能力
- 不同品牌、企业客户、合规要求会不同
- 它天然属于桌面壳、控制面、安全治理体系的一部分

## 14. 需要冻结的关键决策

建议团队 review 后冻结以下决策：

1. 不做字符串命令白名单
2. 高危动作不支持长期静默自动放行
3. 提权动作单独建模为 `elevated_execute`
4. 优先做受控动作模板，而不是放大自由 shell
5. 授权、执行、审计走统一事件链
6. 用户侧必须有授权撤销能力

## 15. 技术领先型总结

一个真正可扩展、可企业化的桌面 Agent，不是“能不能执行命令”，而是“能不能把命令执行变成可解释、可约束、可审计、可撤销的治理系统”。

行业里大量产品停留在两种初级形态：

- 只有弹窗，没有策略
- 只有白名单，没有解释

这两种都不够。

iClaw 更优的方向应是：

- 用 `ActionIntent` 把模型自由动作编译为稳定意图
- 用 `PolicyRule` 把安全约束从 prompt 里拿出来，放进平台真正规则层
- 用 `ApprovalGrant` 把“用户信任”变成可管理资产，而不是一次性点击事件
- 用统一 `AuditEvent` 把本地 AI 动作升级为企业级可审计行为流

这不是一个局部弹窗优化，而是桌面 Agent 从“玩具自动化”走向“企业级本地执行平台”的关键台阶。
