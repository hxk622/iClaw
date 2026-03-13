---
name: 投资备忘录
visibility: showcase
tags: 金融, 投资备忘录
description: |
  生成投资备忘录和 IC 材料。触发场景：
  - "写份投资报告" / "帮我做个投资分析"
  - "准备投委会材料" / "IC memo"
  - "分析一下这个项目值不值得投" / "投资论点是什么"
  - "TAM 有多大" / "市场机会规模"
  - "退出策略怎么设计" / "IRR 能到多少"
  适用于 PE/VC 一级市场和二级市场深度研究。
  与 equity-research 的区别：本技能是投资决策文档；equity-research 是研报形式。
---

# Investment Memo Generator

生成机构级投资备忘录，支持 PE/VC 和二级市场投研场景。

## 输出格式

### 标准投资备忘录结构

```markdown
# [公司名称] 投资备忘录

## Executive Summary
- **推荐**: [买入/增持/中性/减持/卖出] | **目标价**: $X | **当前价**: $Y
- **核心论点**: [1-2句话总结]
- **关键催化剂**: [近期事件]
- **主要风险**: [最大担忧]

## 1. Investment Thesis
### 核心投资逻辑
[3-5个要点，每点2-3句话阐述]

### Bull/Base/Bear Case
| 情景 | 概率 | 目标价 | 关键假设 |
|------|------|--------|----------|
| Bull | 25%  | $X     | [假设]   |
| Base | 55%  | $Y     | [假设]   |
| Bear | 20%  | $Z     | [假设]   |

## 2. 市场机会
### TAM/SAM/SOM 分析
- **TAM (Total Addressable Market)**: $Xbn - [全球/区域市场总规模]
- **SAM (Serviceable Addressable Market)**: $Xbn - [可服务市场]
- **SOM (Serviceable Obtainable Market)**: $Xbn - [可获得市场份额]

### 市场增长驱动力
[2-3个核心增长因素]

## 3. 商业模式分析
### 收入模式
[订阅/交易/广告/许可等]

### 单位经济模型
- **CAC**: $X
- **LTV**: $Y
- **LTV/CAC**: X.Xx
- **Payback Period**: X months

### 护城河评估
[网络效应/规模经济/品牌/专利/转换成本]

## 4. 财务分析
### 关键指标
| 指标 | FY-2 | FY-1 | FY | FY+1E | FY+2E |
|------|------|------|-----|-------|-------|
| Revenue | | | | | |
| Gross Margin | | | | | |
| EBITDA Margin | | | | | |
| FCF | | | | | |

### 估值
- **EV/Revenue**: Xx (vs peers Xx)
- **EV/EBITDA**: Xx (vs peers Xx)
- **P/E**: Xx (vs peers Xx)

## 5. 管理层 & 治理
[关键管理层背景、股权结构、激励机制]

## 6. 风险因素
| 风险 | 严重性 | 可能性 | 缓释措施 |
|------|--------|--------|----------|
| [风险1] | 高/中/低 | 高/中/低 | [措施] |

## 7. 退出策略 (PE/VC适用)
- **目标退出时间**: X年
- **退出方式**: IPO / 并购 / 二次出售
- **目标回报**: Xx MOIC / XX% IRR

## 8. 行动建议
[具体下一步行动]
```

## 工作流程

1. **信息收集**: 使用 MCP 工具获取财务数据、公告、新闻
   - `openbb` - 财务数据
   - `sec-edgar` - SEC 公告 (如适用)
   - `tavily/exa` - 新闻搜索

2. **分析框架**: 根据投资类型选择
   - **成长股**: 侧重 TAM/SAM、增速、护城河
   - **价值股**: 侧重估值、现金流、资产重估
   - **PE/VC**: 侧重退出策略、IRR/MOIC 预测

3. **生成输出**: 
   - Markdown 格式供阅读
   - 如需正式文档，配合 `pptx` 或 `docx` skill

## 估值方法参考

详细估值方法请参阅 [references/valuation-methods.md](references/valuation-methods.md)

## 注意事项

- 所有数据需标注来源和日期
- 预测需明确假设条件
- 包含风险披露声明
- 非投资建议，仅供研究参考
