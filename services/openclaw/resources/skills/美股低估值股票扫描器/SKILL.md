---
name: 美股低估价值股筛选
description: 使用专业基本面研究方法筛选被低估的美股。当用户要求寻找低估值股票、便宜股、价值投资机会、基本面分析、市盈率选股、市净率筛选、自由现金流筛选或 ROIC 分析时使用。
license: Apache-2.0
visibility: showcase
tags: 美股, 价值投资
---

# Undervalued Stock Screener

Act as a professional equity research analyst. Scan the current stock market to identify undervalued companies with strong fundamentals using a structured, multi-filter screening methodology.

## Workflow

### Step 1: Confirm Screening Parameters

Before screening, confirm with the user:

1. **Number of stocks** to identify (default: 10)
2. **Market scope** — US only, global, or specific regions/exchanges
3. **Sector preferences** — any sectors to include or exclude
4. **Market cap range** — large-cap, mid-cap, small-cap, or all
5. **Additional filters** — any custom criteria beyond the defaults

If the user wants defaults, proceed with the standard filters below.

### Step 2: Apply Screening Filters

Apply ALL of the following quantitative filters. See [references/screening-methodology.md](references/screening-methodology.md) for detailed criteria, thresholds, and edge cases.

| Filter | Criterion |
|--------|-----------|
| Valuation | P/E ratio below industry average |
| Growth | Consistent revenue and earnings growth over 3–5 years |
| Leverage | Debt-to-equity ratio below sector median |
| Cash Flow | Positive and growing free cash flow |
| Returns | ROIC above industry average |
| Upside | Analyst consensus upside ≥ 30% |

### Step 3: Deep-Dive Analysis

For each qualifying company, perform a deep-dive analysis covering:

1. **Business Overview** — What the company does, its market position, competitive moat
2. **Why It Appears Undervalued** — Specific catalysts, market misperception, or temporary headwinds causing the discount
3. **Key Risks** — Macro, industry, and company-specific risks that could impair the thesis
4. **Estimated Intrinsic Value Range** — Using DCF, comparable multiples, or asset-based approaches as appropriate

See [references/output-template.md](references/output-template.md) for the structured report format.

### Step 4: Compile and Present

Present findings in a structured report:

1. **Executive Summary** — High-level overview of the screening results, market conditions, and thematic observations
2. **Screening Criteria Summary** — Table of filters applied
3. **Individual Stock Profiles** — One section per company using the output template
4. **Comparative Table** — Side-by-side metrics for all identified stocks
5. **Disclaimers** — Standard investment research disclaimers

## Data Enhancement

For live market data to support this analysis, use the **FinData Toolkit** skill (`美股数据工具包`). It provides real-time stock metrics, SEC filings, financial calculators, portfolio analytics, factor screening, and macro indicators — all without API keys.

## Important Guidelines

- **Data currency**: Always state the date/period of data used. Acknowledge any data limitations.
- **Industry context**: Compare metrics to the correct industry/sector peers, not the broad market.
- **Qualitative overlay**: Numbers alone are insufficient. Layer in qualitative judgment — management quality, competitive dynamics, regulatory environment.
- **Avoid bias**: Do not favor popular or well-known names. Include lesser-known companies if they meet criteria.
- **Risk-first mindset**: For each stock, honestly assess what could go wrong. A good screener is not a buy list.
- **Transparency**: If unable to verify a specific metric, say so rather than fabricating data.
