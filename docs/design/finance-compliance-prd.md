# 理财客金融合规控制面 PRD

更新时间：2026-04-18

## 1. 背景

`理财客` 已具备金融研究、市场信息、投资专家、定时晨报等能力，但当前金融合规策略分散在：

- 若干 prompt 约束
- 服务协议条款
- 个别页面弱免责声明
- 人工经验判断

结果是：

- 有的回答有免责声明，有的没有
- 聊天、定时任务、通知、导出报告策略不一致
- 新接入的 skill / plugin / MCP 没有统一的金融风险标注
- 事后难以回放“为什么这次显示/没显示小字”

因此需要建设一套 **金融合规控制面**，而不是继续给单个金融 skill 临时补免责声明。

## 2. 产品目标

建立一套适用于 `理财客` 的统一金融合规系统，覆盖：

- 能力接入时的合规标注
- 用户提问前后的风险识别
- 输出时的免责声明、降级与拦截
- 定时任务、通知、结果页的一致策略
- 全链路留痕与可审计

## 3. 成功标准

### 产品成功标准

- 所有进入理财客的金融能力都带有合规档位
- 高风险金融回答统一显示免责声明
- 用户在聊天、定时任务、通知三个核心场景感知到一致的“研究参考”定位
- 产品能够回答“为什么这次有小字，那次没有”

### 技术成功标准

- 每次金融回答都能产出结构化合规分类结果
- 每次高风险输出都有审计记录
- 不修改 OpenClaw kernel 即可跑通主流程
- wrapper / integration 层可作为最终裁决器

## 4. 产品定位

`理财客` 当前定位应明确为：

- 金融研究与信息整理助手
- 市场、基金、股票、投资专家的研究入口
- 观点辅助与信息核验工具

当前不应定位为：

- 自动投顾
- 适当性判断器
- 交易执行代理

## 5. 用户与场景

目标用户：

- 普通投资者
- 金融内容重度用户
- 需要每日市场摘要与研究框架的用户
- 对基金、股票、行业信息有持续跟踪需求的用户

核心场景：

- 问行情和市场动态
- 问个股/基金/行业研究问题
- 问投资观点，但不进入真实执行
- 订阅晨报、周报、市场日报
- 浏览投资专家卡片、市场页、研究报告

## 6. 范围

首期纳入：

- 聊天主回答
- 定时任务结果页
- 通知摘要
- 首页卡片 / 专家卡片
- HTML 报告导出
- skill / plugin / MCP 准入

首期不纳入：

- 开户
- 下单
- 申赎
- 充值 / 交易执行
- 适当性替代

## 7. 核心需求

## 7.1 能力准入

所有进入理财客的能力必须有金融合规分级：

- `data_only`
- `research_only`
- `investment_view`
- `actionable_advice`
- `execution_linked`

策略：

- 默认允许前 3 档
- `actionable_advice` 默认只允许降级后输出
- `execution_linked` 默认不开放

## 7.2 输入识别

用户问题必须进行输入分类：

- `market_info`
- `research_request`
- `advice_request`
- `personalized_request`
- `execution_request`

对应策略：

- `market_info`
  - 正常回答
- `research_request`
  - 正常回答 + 风险框架
- `advice_request`
  - 降级成研究观点
- `personalized_request`
  - 要求更多信息，不替代适当性
- `execution_request`
  - 默认拒绝或转受监管流程

## 7.3 输出识别

输出按 4 档分类：

- `market_data`
- `research_summary`
- `investment_view`
- `actionable_advice`

展示策略：

- `market_data`
  - 可不显示免责声明或只显示弱提示
- `research_summary`
  - 轻提示
- `investment_view`
  - 标准免责声明
- `actionable_advice`
  - 强提示，必要时降级或拦截

## 7.4 渠道差异化

不同渠道必须独立处理：

- 聊天主回答
- 定时任务结果
- 通知中心摘要
- 首页卡片 / 专家卡片
- 营销文案 / push
- 导出报告 / HTML 报告

约束：

- 聊天能说的内容，不一定允许直接进入 push
- 定时任务正文不能直接截断成通知摘要
- 高风险渠道内容需要降噪或替换

## 7.5 数据与个人信息

若接入以下信息，必须视为高敏金融数据：

- 持仓
- 资产规模
- 风险偏好
- 身份信息
- 交易行为

首期至少支持：

- 最小必要使用
- 脱敏展示
- 审计谁读过
- 删除/导出能力预留
- 不向无关 plugin 透传

## 7.6 审计

必须留痕：

- 哪个能力参与了回答
- 用了哪个模型
- 输入分类
- 输出分类
- 是否展示免责声明
- 是否降级/拦截
- 是否进入定时任务、通知、导出

## 8. 用户可见设计

统一引入以下 UI 元素：

- `AI生成`
- `研究参考`
- `风险提示`

高风险场景增加结构化区块：

- 结论
- 前提
- 风险
- 失效条件
- 非投资建议提示

标准免责声明文案：

```text
本回答由AI生成，仅供参考，请仔细甄别，谨慎投资。
```

## 9. 方案选择

推荐采用 Hybrid 方案：

- `finance-compliance` plugin + hooks
  - 负责分类、打标、审计、准备 envelope
- 理财客 wrapper / integration 层
  - 负责展示、统一免责声明、通知降级、强拦截

原因：

- 纯 plugin/hook 只能做检测、记录、轻改写
- 不能稳定承担主回复链路的强拦截

## 10. 里程碑

### Phase 1：看得见、查得到

- catalog metadata 增加金融字段
- OEM binding 增加 disclaimer policy
- 输入分类
- 输出审计
- UI 统一渲染免责声明

### Phase 2：自动降级

- 高风险问题注入金融决策框架
- `actionable_advice` 自动降级为 `investment_view`
- 定时任务与通知摘要独立降级

### Phase 3：强拦截

- 禁止买卖建议直出
- 禁止适当性替代结论直出
- 禁止收益承诺类文案发送
- 对违规输出返回安全响应

## 11. 非目标

- 用免责声明替代法律义务
- 让模型自由决定是否合规
- 只改某一个金融 skill 的 prompt
- 在首期直接接入交易执行

## 12. 依赖

- 中心化 skill / MCP catalog metadata
- OEM binding 元数据能力
- OpenClaw hooks：
  - `message:preprocessed`
  - `agent:bootstrap`
  - `tool_result_persist`
  - `message:sent`
- wrapper / integration 层最终裁决

## 13. 风险

- 分类边界一定会有误判
- 如果只做 UI 文案，不做分类和审计，会继续失控
- 如果只做 plugin 不做 wrapper 裁决，无法完成强拦截
- 若 catalog metadata 不完整，能力准入会失真

## 14. 关联文档

- 技术设计：
  - [finance-compliance-technical-design.md](/Users/xingkaihan/Documents/Code/iClaw/docs/design/finance-compliance-technical-design.md)
