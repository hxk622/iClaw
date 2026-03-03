# Valuation Methods Reference

## 1. DCF 估值 (Discounted Cash Flow)

### 公式
```
Enterprise Value = Σ FCF_t / (1+WACC)^t + Terminal Value / (1+WACC)^n
```

### 关键输入
- **FCF 预测**: 通常 5-10 年
- **WACC**: 加权平均资本成本
  - Cost of Equity: CAPM = Rf + β × (Rm - Rf)
  - Cost of Debt: Kd × (1 - Tax Rate)
- **Terminal Value**: 
  - Gordon Growth: FCF × (1+g) / (WACC - g)
  - Exit Multiple: EBITDA × EV/EBITDA multiple

### 敏感性分析
| | WACC -1% | Base | WACC +1% |
|---|---------|------|----------|
| g +0.5% | | | |
| Base | | | |
| g -0.5% | | | |

## 2. 可比公司分析 (Comparable Company Analysis)

### 常用倍数
| 行业 | 主要倍数 | 次要倍数 |
|------|---------|---------|
| SaaS | EV/Revenue, EV/ARR | P/S |
| 金融 | P/B, P/E | ROE |
| 消费 | EV/EBITDA, P/E | EV/Sales |
| 工业 | EV/EBITDA | P/E |
| 地产 | P/NAV, Cap Rate | P/FFO |

### 可比公司选择标准
1. 相同行业/子行业
2. 相似商业模式
3. 相近规模 (Revenue ±50%)
4. 相似增长率
5. 相似地理分布

## 3. 可比交易分析 (Precedent Transactions)

### 溢价分析
- **1-day premium**: 交易价 vs 前一日收盘价
- **30-day premium**: 交易价 vs 30日VWAP
- **52-week premium**: 交易价 vs 52周高点

### 调整因素
- 控制权溢价 (20-40%)
- 协同效应预期
- 市场环境差异

## 4. LBO 分析 (Leveraged Buyout)

### 关键指标
- **Entry Multiple**: 通常 8-12x EBITDA
- **Exit Multiple**: 假设相同或略低
- **Debt/EBITDA**: 通常 4-6x
- **目标 IRR**: PE 基金通常 20%+
- **目标 MOIC**: 2.0-3.0x

### IRR 敏感性
```
IRR = (Exit Value / Entry Equity)^(1/n) - 1
```

### 价值创建来源
1. 收入增长
2. 利润率扩张
3. 去杠杆化
4. 倍数扩张

## 5. Sum-of-the-Parts (SOTP)

适用于多元化公司，分别估值各业务板块后加总。

```
Total EV = Σ (Business Unit Value) - Corporate Costs PV
Equity Value = Total EV - Net Debt + Associates/JVs
```

## 6. 早期公司估值 (VC Method)

### Pre-money / Post-money
```
Post-money = Pre-money + Investment
Ownership % = Investment / Post-money
```

### VC 回报要求
| 阶段 | 目标回报 |
|------|---------|
| Seed | 100x+ |
| Series A | 20-30x |
| Series B | 10-15x |
| Growth | 3-5x |

## 估值交叉验证

最佳实践：使用多种方法交叉验证
```
┌─────────────────┐
│ DCF: $X - $Y    │
├─────────────────┤
│ Comps: $A - $B  │
├─────────────────┤
│ M&A: $M - $N    │
└─────────────────┘
     ↓
Fair Value Range: $[min] - $[max]
```
