---
name: 股票研究
visibility: showcase
tags: 金融, 研究报告
description: |
  生成机构级股票研究报告。触发场景：
  - "帮我看看 XX 股票" / "分析一下 AAPL"
  - "XX 能买吗" / "该不该卖 XX"
  - "给我一份 XX 的研报" / "XX 的投资价值"
  - "对比分析 A 和 B 股票"
  与 stock-analysis 的区别：本技能由 LLM 直接撰写分析；stock-analysis 运行自动化脚本生成 HTML 报告。
  与 stock-technical-analysis 的区别：本技能侧重基本面和投资建议；technical-analysis 侧重技术指标计算。
---

# Equity Research Skill

Generate professional, institutional-grade equity research reports for any publicly traded stock.

## When to Use This Skill

Activate this skill when the user:
- Asks to analyze a stock (e.g., "分析一下 AAPL", "Analyze NVDA")
- Requests equity research or stock research
- Wants investment analysis or trading ideas
- Asks for buy/sell/hold recommendations
- Needs a stock report or company evaluation
- Mentions any stock ticker with research intent

## Research Methodology

### Required Search Strategy (Execute in Parallel)

1. **Financial Performance**: Search for recent earnings, revenue growth, margins, key business metrics, and analyst coverage
2. **Market Positioning**: Search for peer comparisons, sector performance, competitive analysis, and market share data
3. **Advanced Intelligence**: Search for technical analysis, options flow, insider activity, institutional ownership, and regulatory concerns

### Data Requirements

- Use specific numbers and percentages where available
- Include timeframes for all metrics (YoY, QoQ, etc.)
- Cite price targets with analyst firm names when possible
- Provide exact financial figures (revenue, margins, EPS, etc.)

## Output Format

Generate analysis using this EXACT structure:

```markdown
# [TICKER] - ENHANCED EQUITY RESEARCH

## EXECUTIVE SUMMARY
**[BUY/SELL/HOLD]** with $[X] price target ([X]% upside/downside) over [timeframe]. [Key catalyst and investment thesis in 1-2 sentences]. [Risk-reward ratio description].

## FUNDAMENTAL ANALYSIS
**Recent Financial Metrics**: [Specific revenue growth %, margins, key business KPIs with exact numbers and timeframes]

**Peer Comparison**: [Valuation multiples vs competitors with specific P/E, P/S ratios and company names]

**Forward Outlook**: [Management guidance, analyst consensus, growth projections with specific numbers]

## CATALYST ANALYSIS
**Near-term (0-6 months)**: [Specific upcoming events with dates - earnings, product launches, regulatory decisions]
**Medium-term (6-24 months)**: [Strategic initiatives, market expansion, competitive positioning changes]
**Event-driven**: [M&A potential, index inclusion, spin-offs, special dividends]

## VALUATION & PRICE TARGETS
Current consensus: $[X] (range $[low]-$[high]). Bull case $[X] assumes [specific scenario]. Base case $[X] reflects [scenario]. Bear case $[X] on [risk scenario]. Probability weighting: [X]%/[Y]%/[Z]%.

## RISK ASSESSMENT
**Company risks**: [Specific business risks - competitive threats, regulatory issues, operational challenges]
**Macro risks**: [Interest rate sensitivity, economic cycle impact, sector rotation effects]
**Position sizing**: [X]%-[Y]% allocation based on [volatility/beta/risk factors]. 
**ESG considerations**: [If material to institutional ownership].

## TECHNICAL CONTEXT & OPTIONS INTELLIGENCE
[Current price vs 52-week range]. [Key support/resistance levels]. [Recent volume patterns]. 
**Options flow**: [Put/call ratios, unusual activity, implied volatility trends]. 
[Momentum indicators and trend analysis].

## MARKET POSITIONING
**Sector Performance**: [Stock performance vs sector ETF and broader market with specific %]. 
[Rotation trends affecting the position]. [Relative strength analysis].

## INSIDER SIGNALS
[Recent insider buying/selling with specific dollar amounts and executives]. 
[Share buyback programs]. [Institutional ownership changes]. [Pattern analysis of insider behavior].

---

## RECOMMENDATION SUMMARY

| Metric | Value |
|--------|-------|
| **Rating** | [BUY/SELL/HOLD] |
| **Conviction** | [High/Medium/Low] |
| **Price Target** | $[X] |
| **Timeframe** | [X] months |
| **Upside/Downside** | [X]% |
| **Position Size** | [X]%-[Y]% |

---

**IMPORTANT DISCLAIMER**: This analysis is for educational and research purposes only. Not financial advice. Past performance does not guarantee future results. Consult qualified financial professionals before making investment decisions. All investments carry risk of loss.
```

## Quality Standards

### Required Elements
- All financial metrics must include specific numbers and percentages
- Price targets must show upside/downside calculation
- Risk assessment must include position sizing guidance
- Technical analysis must include specific support/resistance levels
- Options data must include put/call ratios when available
- Insider activity must include dollar amounts and executive names

### Professional Tone
- Use institutional terminology (EBITDA, P/E, EV/Sales, etc.)
- Include probability weightings for scenarios
- Provide conviction levels (High/Medium/Low)
- Reference specific analyst firms and price target updates
- Maintain objective, data-driven analysis

### Critical Requirements
- Always include the disclaimer section
- Provide specific position sizing recommendations
- Include both bullish and bearish scenarios
- Use web searches for comprehensive data gathering
- Format all tables and sections consistently

## Supported Markets

### Primary Support
- **NYSE** (New York Stock Exchange)
- **NASDAQ** (NASDAQ Stock Market)
- **US Over-the-Counter** (major OTC stocks)

### Coverage Quality
- Large-cap stocks (>$10B market cap): Comprehensive data availability
- Mid-cap stocks ($2B-$10B): Good data coverage
- Small-cap stocks (<$2B): Basic coverage, limited analyst data

### International Stocks
Use US ADR ticker symbols:
- Alibaba: `BABA` (not `9988.HK`)
- Toyota: `TM` (not `7203.T`)
- TSMC: `TSM` (not `2330.TW`)

## Example Usage

User: "帮我分析一下 NVDA"
→ Generate full equity research report for NVIDIA

User: "AAPL 现在能买吗？"
→ Generate analysis with BUY/SELL/HOLD recommendation

User: "对比分析 MSFT 和 GOOGL"
→ Generate comparative equity research for both stocks
