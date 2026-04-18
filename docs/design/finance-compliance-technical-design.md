# 理财客金融合规技术设计

更新时间：2026-04-18

## 1. 目标

为 `理财客` 建立一套统一的金融合规控制面，覆盖：

- 新 `skill` / `plugin` / `MCP` 的准入分级
- 用户输入意图识别
- 模型输出分类、降级、免责声明展示
- 定时任务、通知摘要、报告导出等多渠道一致性
- 全链路留痕、审计与规则回放

本文档目标不是定义最终法律结论，而是给出一套可落地的产品和技术约束，使 `理财客` 在现有 `iClaw + OpenClaw wrapper` 架构下，以最小内核改动完成金融场景的风险收敛。

## 1.1 源头定义

以下内容直接来自本需求对话，作为本文档的源头约束与解释基线。后续设计、拆分与实现，均不应偏离这一目标。

### 目标先行

你要的不是“给金融 skill 多加一句免责声明”，而是给 `理财客` 做一套**金融合规控制面**。它应该覆盖：

- 能力接入时的合规标注
- 用户提问前后的风险识别
- 输出时的免责声明 / 降级 / 拦截
- 定时任务、通知、结果页的一致策略
- 全链路留痕和可审计

并且要符合当前仓库边界：

- 尽量改 wrapper / integration 层
- 不直接改 OpenClaw kernel
- `skill` / `plugin` / `model` 都走中心化 catalog + OEM binding

### 六个合规面

作为第一性拆解，金融合规控制面至少包括 6 个面：

#### 1. 能力准入合规

新 `skill` / `plugin` / `MCP` 进 `理财客` 前，要先回答这些问题：

- 它是纯信息源，还是会生成投资观点
- 它会不会产出明确买卖建议、仓位建议、收益判断
- 它是否涉及个性化适配、风险等级匹配
- 它是否用了受限数据源、实时行情、研报、基金销售内容
- 它输出的是“研究参考”还是“可执行建议”

产品上对应一个能力分级：

- `data_only`
- `research_only`
- `investment_view`
- `actionable_advice`
- `execution_linked`

#### 2. 输入侧合规

用户问题要按风险与意图分层处理，不能把所有金融问题直接等价视为普通问答。

#### 3. 输出侧合规

不是所有财经回答都需要同一层级的免责声明，但高风险金融输出必须进入统一的展示、降级和拦截策略。

#### 4. 渠道合规

聊天、定时任务、通知、结果页、导出报告等不同渠道，不能复用完全相同的金融输出策略。

#### 5. 数据与个人信息合规

若涉及持仓、资产规模、风险偏好、交易行为等高敏金融数据，必须有最小必要、脱敏和审计机制。

#### 6. 审计与追责

所有分类、免责声明展示、降级、拦截都必须有留痕，并能回放“为什么这次这么处理”。

## 2. 范围

首期纳入：

- `理财客` 聊天主回答
- `定时任务` 结果页与通知摘要
- `基金市场` / `股票市场` / `投资专家` 等金融场景页面
- `skill` / `plugin` / `MCP` 的能力目录元数据与 OEM 绑定策略
- 金融导出内容，例如 HTML 研究报告、晨报、周报

首期不包含：

- 持牌投顾、基金销售、开户、交易执行等受强监管链路
- 真实适当性评估替代
- 自动化买卖、申赎、资金划转
- OpenClaw kernel 级主回复链路替换

## 3. 设计原则

- 平台 catalog 是全集，OEM binding 决定 `理财客` 如何使用、展示和约束能力
- 不把免责声明散落在各个 `skill` prompt 中
- 不依赖模型“自觉”合规，必须有展示层和规则层兜底
- 输入分类、输出分类、展示策略、审计留痕必须分离
- 优先改 wrapper / integration 层，不直接修改 `services/openclaw/runtime/openclaw/`
- 对金融高风险内容采用“分类 -> 降级 -> 展示/拦截 -> 审计”的链式处理

## 4. 产品经理视角的合规地图

从产品治理角度，`理财客` 可能触达的金融合规面至少包括以下 8 类：

### 4.1 牌照边界

核心问题：

- 产品是否已经越过“研究参考”进入“投资咨询”或“基金销售”
- 是否对用户输出了个性化建议、适当性判断、收益预期或执行导向结论

对 `理财客` 的产品要求：

- 产品定位明确为“金融研究与信息整理助手”
- 没有受监管链路前，不把能力包装成“自动投顾”“私人顾问”“推荐买卖”
- 对 `execution_linked` 类能力默认禁用

### 4.2 投资者适当性

核心问题：

- 是否基于用户资产、风险承受能力、投资期限输出了看似“适配”的个性化结论
- 是否把普通研究观点包装成“适合你”的产品推荐

对 `理财客` 的产品要求：

- 不让免责声明替代适当性
- 对 `personalized_request` 问题默认触发降级或补充信息流程
- 不输出“你应该买 X”“这个产品适合你”类结论

### 4.3 内容与表达合规

核心问题：

- 是否存在保本保收益、夸大宣传、误导性比较、截图诱导
- 是否把市场观点伪装成确定性承诺

对 `理财客` 的产品要求：

- 标题、卡片、通知、导出报告、营销文案共用同一套内容分类和风险词规则
- 禁止“稳赚”“无风险”“抄底机会已确认”类高风险措辞
- 观点类输出必须附带前提与失效条件

### 4.4 AI 生成内容治理

核心问题：

- 用户是否知道这是 AI 生成内容
- 高风险输出是否明确标示“仅供参考”

对 `理财客` 的产品要求：

- 在高风险金融输出场景统一展示 AI 免责声明
- 解释“为什么这次显示/那次不显示”必须可回放
- 对重要结论增加时间点、来源与风险区块

### 4.5 数据与行情使用合规

核心问题：

- 行情、净值、研报、公告、新闻是否可商用
- 是否需要实时/延时披露
- 是否允许二次分发或用于推荐场景

对 `理财客` 的产品要求：

- 所有金融 `MCP` / 插件 / 数据源都必须声明 `source/timestamp/delay`
- 不允许没有来源约束的数据直接进入通知、导出或营销场景

### 4.6 个人信息与金融数据保护

核心问题：

- 是否处理持仓、资产规模、风险偏好、交易行为等高敏数据
- 是否把高敏数据透传给无关能力

对 `理财客` 的产品要求：

- 高敏金融数据默认只在最小必要链路可见
- 进入 transcript、工具结果和报告导出前要有脱敏策略
- 审计系统必须知道哪些能力接触过高敏数据

### 4.7 营销与渠道投放

核心问题：

- 是否把研究结论直接转成 push、营销卡片、海报文案
- 是否出现诱导开户、诱导购买、排行榜式刺激表达

对 `理财客` 的产品要求：

- 通知和营销渠道不复用聊天正文
- 对营销/通知单独建立“金融渠道文案规则”

### 4.8 审计与投诉追责

核心问题：

- 发生争议时，是否能重建“输入 -> 分类 -> 输出 -> 展示”的全链路

对 `理财客` 的产品要求：

- 分类结果、免责声明展示、降级/拦截决策必须可追踪
- 为法务、运营、客服预留可审计证据链

## 5. 模块化产品清单

为防止合规设计停留在抽象层，建议按产品模块明确责任：

### 5.1 聊天页

- 显示 `AI生成` 和 `研究参考` 标签
- 对 `investment_view` 及以上级别展示免责声明
- 对 `actionable_advice` 触发降级或替代文案

### 5.2 定时任务

- 允许金融研究摘要进入任务结果页
- 通知摘要禁止直接复用强观点句
- 晨报、周报类任务必须带统一免责声明和生成时间

### 5.3 技能 / 插件 / MCP 市场

- 所有金融能力必须有合规分级与来源说明
- 未标注金融合规 metadata 的能力不能进入理财客默认目录
- `execution_linked` 默认不在理财客展示

### 5.4 基金 / 股票详情页

- 事实数据与观点区分展示
- 显示数据来源、更新时间、是否延时
- 页面底部保留研究参考提示

### 5.5 通知 / Push / 卡片

- 仅允许事实型摘要或降噪后的弱观点
- 不允许直接推送买卖建议句
- 高风险通知默认改成“已生成分析，请打开查看”

### 5.6 导出报告

- 页脚固定免责声明
- 展示生成时间、数据时间、来源
- 对用户持仓与高敏输入做脱敏

## 6. 问题定义

当前 `理财客` 已有以下基础：

- 金融决策框架资源文件：[services/openclaw/resources/FINANCE_DECISION_FRAMEWORK.md](/Users/xingkaihan/Documents/Code/iClaw/services/openclaw/resources/FINANCE_DECISION_FRAMEWORK.md)
- 投资专家 catalog metadata 和风险边界 prompt 生成逻辑：[services/control-plane/src/catalog-defaults.ts](/Users/xingkaihan/Documents/Code/iClaw/services/control-plane/src/catalog-defaults.ts)
- 金融场景服务协议中的“仅供研究参考，不构成投资建议”条款：[services/control-plane/src/portal-store.ts](/Users/xingkaihan/Documents/Code/iClaw/services/control-plane/src/portal-store.ts)
- 个别金融页面已有弱免责声明，例如基金市场页：[apps/desktop/src/app/components/market/FundMarketView.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/market/FundMarketView.tsx)

现阶段主要缺口：

- `skill` / `plugin` / `MCP` 缺少统一金融合规元数据
- 聊天、定时任务、通知、报告没有共享同一套免责声明策略
- 无法解释“为什么这次有小字、那次没有”
- 输出是否应降级、拦截、改写没有统一控制面
- 审计只能看到最终文本，无法回放规则命中路径

## 7. 合规面拆解

### 能力准入合规

任何新能力接入 `理财客` 前，需要明确：

- 它是纯信息源、研究辅助，还是会生成投资观点
- 是否可能产出买卖建议、仓位建议、收益判断
- 是否涉及个性化适配、风险匹配、用户画像结论
- 是否引用受限数据源、延迟行情、第三方研报、基金销售内容
- 是否会进入通知、导出报告、营销文案等高风险渠道

### 输入侧合规

用户问题必须先进行意图分类，不能把所有金融问题都直接扔给模型。

### 输出侧合规

不是所有财经回答都要展示相同免责声明，但高风险输出必须统一进入展示层策略。

### 渠道合规

聊天正文、通知摘要、定时任务、研究报告的风险级别不同，不能复用同一份文本策略。

### 数据与隐私合规

若涉及持仓、资产规模、风险偏好、交易行为等信息，必须作为高敏金融数据处理，不能被任意 plugin / skill 透传。

### 审计与追责

必须能回放：

- 使用了哪些能力
- 规则命中什么分类
- 为什么显示或不显示免责声明
- 是否发生了降级、拦截或渠道降噪

## 8. 分类体系

### 能力分级

建议为 `理财客` 内的金融能力建立统一分级：

- `data_only`
  - 行情、净值、公告、财报日期、事实数据查询
- `research_only`
  - 新闻梳理、财报摘要、行业复盘、知识解释
- `investment_view`
  - 估值判断、配置观点、情景推演、策略分析
- `actionable_advice`
  - 买卖建议、仓位建议、择时建议
- `execution_linked`
  - 下单、申赎、开户、充值、转账、交易相关链路

`理财客` 首期默认允许：

- `data_only`
- `research_only`
- `investment_view`

默认限制：

- `actionable_advice`：允许接入，但输出需降级
- `execution_linked`：默认不开放，除非单独进入受监管链路

### 输入意图分类

用户输入建议统一归为：

- `market_info`
  - 例：今天市场怎么样
- `research_request`
  - 例：分析一下宁德时代
- `advice_request`
  - 例：现在能买吗
- `personalized_request`
  - 例：我有 50 万怎么配
- `execution_request`
  - 例：帮我卖掉基金

### 输出分类

模型和工具最终输出建议归为：

- `market_data`
- `research_summary`
- `investment_view`
- `actionable_advice`

## 9. 产品层解决方案

### 统一“研究参考”产品心智

`理财客` 当前更适合定义为：

- 金融研究与信息整理助手
- 研究框架和观点辅助系统
- 市场、基金、股票、专家的研究入口

不应定义为：

- 自动投顾
- 个性化适当性判断器
- 交易执行代理

### 统一展示元素

对金融回答与页面元素，建议统一引入以下 UI 组件：

- `AI生成` 标签
- `研究参考` 标签
- `风险提示` 小字
- `前提 / 风险 / 失效条件` 区块
- `数据时间 / 来源` 区块

标准免责声明文案建议：

```text
本回答由AI生成，仅供参考，请仔细甄别，谨慎投资。
```

该文案由展示层控制，不由模型自由生成。

### 渠道差异化策略

- 聊天主回答
  - 可展示完整研究摘要与观点
- 定时任务结果页
  - 可展示研究摘要与弱观点
- 通知摘要
  - 仅展示事实与弱观点，禁止强建议句
- 导出报告
  - 页脚固定免责声明 + 时间 + 来源
- 营销/推送素材
  - 单独规则集，不复用聊天正文

## 10. 技术总方案

采用 **Hybrid 模式**：

- `OpenClaw plugin + hooks`
  - 做前后检查、分类、打标、审计、工具结果改写
- `理财客 wrapper / integration 层`
  - 做最终免责声明渲染、结果降级、渠道拦截、通知摘要裁决

原因：

- OpenClaw 当前 hooks 适合事件监听和轻改写
- 现有 message hooks 不能 short-circuit 主回复路径
- 因此强拦截、强降级必须由 wrapper 作为最终裁决器完成

相关参考：

- hooks 能力说明：[services/openclaw/runtime/openclaw/docs/automation/hooks.md](/Users/xingkaihan/Documents/Code/iClaw/services/openclaw/runtime/openclaw/docs/automation/hooks.md)
- plugin hook 边界说明：[services/openclaw/runtime/openclaw/docs/experiments/plans/acp-thread-bound-agents.md](/Users/xingkaihan/Documents/Code/iClaw/services/openclaw/runtime/openclaw/docs/experiments/plans/acp-thread-bound-agents.md)

## 11. 数据模型设计

### `cloud_skill_catalog.metadata_json`

给平台 skill catalog 增加统一金融元数据：

```json
{
  "domain": "finance",
  "capability_class": "research_only",
  "compliance_profile": "finance_research_v1",
  "advice_level": "research_only",
  "requires_disclaimer": true,
  "requires_risk_section": true,
  "forbid_personalized_suitability": true,
  "forbid_return_promise": true,
  "allow_notification_summary": false,
  "allow_cron_digest": true,
  "data_delay_policy": "must_disclose_if_delayed"
}
```

建议语义：

- `domain`
  - 业务域，`finance`
- `capability_class`
  - 能力分级，对应第 6.1 节
- `compliance_profile`
  - 平台默认合规档案
- `advice_level`
  - 能力天然允许输出的最高建议等级
- `requires_disclaimer`
  - 是否默认需要免责声明
- `requires_risk_section`
  - 是否必须带风险区块
- `forbid_personalized_suitability`
  - 是否禁止个性化适当性结论
- `forbid_return_promise`
  - 是否禁止收益承诺型表达
- `allow_notification_summary`
  - 是否允许进入通知摘要
- `allow_cron_digest`
  - 是否允许进入晨报/周报结果流
- `data_delay_policy`
  - 行情延迟披露规则

### `cloud_mcp_catalog.metadata_json`

对 `MCP` / `plugin` 的金融数据源补充：

```json
{
  "domain": "finance",
  "data_source_type": "market_data",
  "is_realtime": false,
  "quote_delay_minutes": 15,
  "requires_source_attribution": true,
  "requires_timestamp": true,
  "allowed_output_classes": ["market_data", "research_summary"]
}
```

### OEM binding metadata

理财客在 OEM binding 层覆盖 app-specific 策略：

```json
{
  "compliance_enabled": true,
  "classification_policy": "finance_v1",
  "disclaimer_policy": "finance_inline_small",
  "disclaimer_text": "本回答由AI生成，仅供参考，请仔细甄别，谨慎投资。",
  "show_for": ["investment_view", "actionable_advice"],
  "hide_for": ["market_data"],
  "block_for": ["execution_request"],
  "degrade_for": ["advice_request", "personalized_request"]
}
```

说明：

- 平台 catalog 定义能力全集和天然风险属性
- OEM binding 只定义 `理财客` 内的适用性、默认展示、默认阻断与降级策略

## 12. Compliance Envelope

wrapper 层不应只接收纯文本，而应接收一份结构化合规包：

```json
{
  "answer": "正文内容",
  "compliance": {
    "domain": "finance",
    "input_classification": "advice_request",
    "output_classification": "investment_view",
    "risk_level": "high",
    "show_disclaimer": true,
    "disclaimer_text": "本回答由AI生成，仅供参考，请仔细甄别，谨慎投资。",
    "requires_risk_section": true,
    "blocked": false,
    "degraded": true,
    "reasons": [
      "finance_domain",
      "advice_request_detected",
      "research_only_policy"
    ],
    "used_capabilities": [
      "a-share-factor-screener",
      "yahoo-finance"
    ],
    "source_attribution_required": true,
    "timestamp_required": true
  }
}
```

作用：

- 聊天页统一渲染免责声明
- 通知和定时任务统一读取同一分类结论
- 报告导出统一落 footer
- 审计中心可直接回放规则结果

## 13. `finance-compliance` 插件设计

建议新增一个 OpenClaw plugin：`finance-compliance`

### 职责

- `policy-registry`
  - 读取 skill / MCP / OEM binding 合规元数据
- `input-classifier`
  - 分类用户问题意图
- `output-classifier`
  - 分类最终输出风险等级
- `compliance-transformer`
  - 注入风险 metadata、建议降级、准备 envelope 字段
- `audit-recorder`
  - 写审计事件与调试日志

### 非职责

插件不负责：

- 直接替代主回复链路
- 单独决定最终是否发送
- 直接承担持牌合规判断

最终展示、拦截、降级裁决应由 wrapper 层完成。

## 14. Hook 方案

### `message:preprocessed`

用途：输入前置检查。

时机：媒体与链接理解完成后、agent 看到消息之前。

处理内容：

- 识别是否为金融问题
- 识别是否命中 `advice_request` / `personalized_request` / `execution_request`
- 给上下文打输入分类标签
- 为后续 bootstrap 注入合规策略

### `agent:bootstrap`

用途：条件注入金融决策框架。

处理内容：

- 对高风险金融问题注入 `FINANCE_DECISION_FRAMEWORK.md`
- 对低风险市场数据查询不注入额外框架，减少 token 成本

### `tool_result_persist`

用途：同步改写工具结果在 transcript 中的落库内容。

处理内容：

- 为行情类工具结果补 `source/timestamp/delay` metadata
- 对高敏信息做脱敏
- 为 envelope 提供结构化依据

该 hook 是同步的，适合做“结果写入前的最小变换”，不适合做长耗时合规审查。

### `message:sent`

用途：发送后审计。

处理内容：

- 记录最终对外内容是否带免责声明
- 记录分类结果、渠道、命中的降级/拦截原因
- 为后台分析“为什么这次显示/没显示小字”提供依据

## 15. Wrapper 层设计

wrapper 层需要新增一个 **合规裁决器**，负责做最终用户可见结果的决策。

### 输入

- 原始回答文本
- 插件输出的 classification / metadata
- 能力目录 metadata
- OEM binding policy
- 当前渠道上下文
  - chat / cron / notification / report

### 输出

- 原样展示
- 原样展示 + 免责声明
- 降级改写后展示
- 拦截并返回安全替代文案

### 强制规则

示例：

- 命中 `execution_request`
  - 直接拦截或转受监管流程
- 命中 `actionable_advice` 且能力仅允许 `research_only`
  - 自动降级为 `investment_view`
- 命中 `notification` 渠道且 `allow_notification_summary = false`
  - 不推送正文，只推送“任务已生成，请打开查看”

## 16. 事件流

```text
User Input
  ↓
message:preprocessed
  ↓ 输入分类 + 风险标签
agent:bootstrap
  ↓ 条件注入金融决策框架
OpenClaw Agent Run
  ↓
tool_result_persist
  ↓ 为工具结果补金融 metadata
Wrapper Compliance Resolver
  ↓ 产出 compliance envelope
Channel Decision
  ├─ Chat View
  ├─ Cron Result
  ├─ Notification Summary
  └─ Export Report
  ↓
message:sent
  ↓
Audit Log
```

## 17. 决策表

| 输入分类 | 输出分类 | 渠道 | 动作 |
| --- | --- | --- | --- |
| `market_info` | `market_data` | `chat` | 正常展示 |
| `research_request` | `research_summary` | `chat` | 展示，可选轻提示 |
| `advice_request` | `investment_view` | `chat` | 展示 + 标准免责声明 |
| `advice_request` | `actionable_advice` | `chat` | 降级为 `investment_view` |
| `personalized_request` | `investment_view` | `chat` | 展示 + 免责声明 + 补充信息提示 |
| `personalized_request` | `actionable_advice` | `chat` | 降级或拦截 |
| `execution_request` | 任意 | `chat` | 拦截或转受监管链路 |
| 任意金融分类 | 任意观点类 | `notification` | 降噪摘要，禁止强建议句 |
| 任意金融分类 | 任意观点类 | `cron` | 展示 + 免责声明 |
| 任意金融分类 | 任意观点类 | `report` | 页脚固定免责声明 + 时间来源 |

## 18. 审计设计

建议新增统一审计事件模型，至少包括：

```json
{
  "event_type": "finance_compliance_decision",
  "app_name": "licaiclaw",
  "session_key": "agent:main:...",
  "channel": "chat",
  "input_classification": "advice_request",
  "output_classification": "investment_view",
  "used_capabilities": ["a-share-factor-screener"],
  "show_disclaimer": true,
  "degraded": true,
  "blocked": false,
  "reasons": ["research_only_policy"],
  "created_at": "2026-04-18T00:00:00Z"
}
```

审计目的：

- 后台定位误判
- 回答争议复盘
- 调整显示策略
- 为法务/运营提供证据链

## 19. 迭代计划

### Phase 1：可见、可解释

- 在 skill / MCP catalog 增加金融合规 metadata
- 在理财客 OEM binding 增加 disclaimer policy
- 实现 `message:preprocessed` 输入分类
- wrapper 层统一渲染免责声明
- `message:sent` 审计落库

### Phase 2：自动降级

- `agent:bootstrap` 条件注入金融决策框架
- `tool_result_persist` 补来源/时间/延迟 metadata
- 定时任务 / 通知 / 报告按渠道策略分流

### Phase 3：强裁决

- wrapper 层实现高风险回答降级与拦截
- 明确 `execution_request` 统一拒绝或转受监管流程
- 增加审计后台与规则回放能力

## 20. 风险与边界

- 免责声明不能替代牌照、适当性或法律义务
- 纯 plugin hook 无法承担主回复链路强拦截
- 金融输出分类必然存在边界样本，必须保留可回放审计
- 若能力元数据缺失，wrapper 需要默认保守策略
- 通知和摘要场景的风险高于聊天主回答，必须单独控制

## 21. 验收标准

### 产品验收

- 金融能力接入时必须配置合规档位
- 高风险金融输出统一显示免责声明
- 用户可理解“为什么这次有小字，那次没有”
- 聊天、定时任务、通知、报告策略一致

### 技术验收

- 每次金融回答都能产出 `compliance envelope`
- 审计记录可回放输入分类、输出分类、渠道决策
- 不改 OpenClaw kernel 也可跑通主流程
- wrapper 层可以单独控制拦截、降级、免责声明渲染

## 22. 法规与外部参考

以下条目用于帮助产品、法务、运营统一讨论边界，不代表本文档替代正式法律意见：

- 《证券、期货投资咨询管理暂行办法》
  - <https://xzfg.moj.gov.cn/front/law/detail?LawID=500>
- 《证券投资顾问业务暂行规定》
  - <https://www.csrc.gov.cn/csrc/c101838/c1022038/content.shtml>
- 《公开募集证券投资基金销售机构监督管理办法》
  - <https://www.csrc.gov.cn/csrc/c106256/c1653806/content.shtml>
- 《证券期货投资者适当性管理办法》
  - <https://www.csrc.gov.cn/csrc/c106256/c1653849/content.shtml>
- 《生成式人工智能服务管理暂行办法》
  - <https://www.gov.cn/zhengce/202311/content_6917778.htm>
- 《互联网信息服务深度合成管理规定》
  - <https://www.gov.cn/zhengce/202310/content_6909368.htm>
- 《中华人民共和国个人信息保护法》
  - <https://www.npc.gov.cn/WZWSREL25wYy9jMi9jMzA4MzQvMjAyMTA4L3QyMDIxMDgyMF8zMTMwODguaHRtbD9yZWY9aW1i>
- 《中华人民共和国广告法》
  - <https://www.npc.gov.cn/npc/c1773/c1848/c21114/c25274/c25277/201905/t20190521_207459.html>
- 《中华人民共和国反洗钱法（2024 修订）》
  - <https://www.gov.cn/yaowen/liebiao/202411/content_6985765.htm>

## 23. 后续开放问题

- 是否需要在 control-plane 新增独立的金融合规策略表，而非全部挂在 metadata 中
- 是否需要为不同金融场景定义不同免责声明模板
- 是否需要把误判样本回流成运营可编辑规则
- 是否需要在 admin 侧提供“高风险回答审核台”
- 后续若接入真实销售/交易链路，如何与持牌流程隔离
