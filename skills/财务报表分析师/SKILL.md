---
name: 财务报表分析
visibility: showcase
tags: 金融, 财务分析
description: 分析财务报表，包括利润表、资产负债表、现金流量表。计算财务比率，进行 DCF 估值和基本面分析。当用户需要公司估值、比率分析、盈利分析或财务健康评估时使用。
---

# Financial Statements Analysis

## Overview

Comprehensive financial statement analysis toolkit for fundamental analysis, ratio calculations, and company valuation.

## Core Analysis Functions

### 1. Financial Ratios

```python
import pandas as pd
import numpy as np

class FinancialRatios:
    """Calculate key financial ratios from financial statements."""
    
    def __init__(self, income_stmt: dict, balance_sheet: dict, cash_flow: dict = None):
        self.income = income_stmt
        self.balance = balance_sheet
        self.cash_flow = cash_flow or {}
    
    # Profitability Ratios
    def gross_margin(self) -> float:
        """Gross Profit / Revenue"""
        return self.income['gross_profit'] / self.income['revenue']
    
    def operating_margin(self) -> float:
        """Operating Income / Revenue"""
        return self.income['operating_income'] / self.income['revenue']
    
    def net_margin(self) -> float:
        """Net Income / Revenue"""
        return self.income['net_income'] / self.income['revenue']
    
    def roe(self) -> float:
        """Return on Equity = Net Income / Shareholders Equity"""
        return self.income['net_income'] / self.balance['shareholders_equity']
    
    def roa(self) -> float:
        """Return on Assets = Net Income / Total Assets"""
        return self.income['net_income'] / self.balance['total_assets']
    
    def roic(self) -> float:
        """Return on Invested Capital = NOPAT / Invested Capital"""
        nopat = self.income['operating_income'] * (1 - 0.25)  # Assume 25% tax
        invested_capital = (
            self.balance['total_assets'] - 
            self.balance.get('cash', 0) - 
            self.balance.get('current_liabilities', 0)
        )
        return nopat / invested_capital
    
    # Liquidity Ratios
    def current_ratio(self) -> float:
        """Current Assets / Current Liabilities"""
        return self.balance['current_assets'] / self.balance['current_liabilities']
    
    def quick_ratio(self) -> float:
        """(Current Assets - Inventory) / Current Liabilities"""
        return (
            (self.balance['current_assets'] - self.balance.get('inventory', 0)) /
            self.balance['current_liabilities']
        )
    
    def cash_ratio(self) -> float:
        """Cash / Current Liabilities"""
        return self.balance['cash'] / self.balance['current_liabilities']
    
    # Leverage Ratios
    def debt_to_equity(self) -> float:
        """Total Debt / Shareholders Equity"""
        return self.balance['total_debt'] / self.balance['shareholders_equity']
    
    def debt_to_assets(self) -> float:
        """Total Debt / Total Assets"""
        return self.balance['total_debt'] / self.balance['total_assets']
    
    def interest_coverage(self) -> float:
        """EBIT / Interest Expense"""
        return self.income['operating_income'] / self.income.get('interest_expense', 1)
    
    # Efficiency Ratios
    def asset_turnover(self) -> float:
        """Revenue / Total Assets"""
        return self.income['revenue'] / self.balance['total_assets']
    
    def inventory_turnover(self) -> float:
        """COGS / Average Inventory"""
        cogs = self.income['revenue'] - self.income['gross_profit']
        return cogs / self.balance.get('inventory', 1)
    
    def receivables_turnover(self) -> float:
        """Revenue / Accounts Receivable"""
        return self.income['revenue'] / self.balance.get('accounts_receivable', 1)
    
    def days_sales_outstanding(self) -> float:
        """365 / Receivables Turnover"""
        return 365 / self.receivables_turnover()
    
    # Valuation Ratios (requires market data)
    def pe_ratio(self, market_cap: float) -> float:
        """Price to Earnings = Market Cap / Net Income"""
        return market_cap / self.income['net_income']
    
    def pb_ratio(self, market_cap: float) -> float:
        """Price to Book = Market Cap / Book Value"""
        return market_cap / self.balance['shareholders_equity']
    
    def ps_ratio(self, market_cap: float) -> float:
        """Price to Sales = Market Cap / Revenue"""
        return market_cap / self.income['revenue']
    
    def ev_ebitda(self, market_cap: float) -> float:
        """EV / EBITDA"""
        ev = market_cap + self.balance['total_debt'] - self.balance['cash']
        ebitda = self.income['operating_income'] + self.income.get('depreciation', 0)
        return ev / ebitda
    
    def get_all_ratios(self, market_cap: float = None) -> dict:
        """Calculate all available ratios."""
        ratios = {
            'profitability': {
                'gross_margin': self.gross_margin(),
                'operating_margin': self.operating_margin(),
                'net_margin': self.net_margin(),
                'roe': self.roe(),
                'roa': self.roa(),
                'roic': self.roic()
            },
            'liquidity': {
                'current_ratio': self.current_ratio(),
                'quick_ratio': self.quick_ratio(),
                'cash_ratio': self.cash_ratio()
            },
            'leverage': {
                'debt_to_equity': self.debt_to_equity(),
                'debt_to_assets': self.debt_to_assets(),
                'interest_coverage': self.interest_coverage()
            },
            'efficiency': {
                'asset_turnover': self.asset_turnover(),
                'inventory_turnover': self.inventory_turnover(),
                'days_sales_outstanding': self.days_sales_outstanding()
            }
        }
        
        if market_cap:
            ratios['valuation'] = {
                'pe_ratio': self.pe_ratio(market_cap),
                'pb_ratio': self.pb_ratio(market_cap),
                'ps_ratio': self.ps_ratio(market_cap),
                'ev_ebitda': self.ev_ebitda(market_cap)
            }
        
        return ratios
```

### 2. DuPont Analysis

```python
def dupont_analysis(income: dict, balance: dict) -> dict:
    """
    DuPont decomposition of ROE:
    ROE = Net Margin × Asset Turnover × Equity Multiplier
    """
    net_margin = income['net_income'] / income['revenue']
    asset_turnover = income['revenue'] / balance['total_assets']
    equity_multiplier = balance['total_assets'] / balance['shareholders_equity']
    
    roe = net_margin * asset_turnover * equity_multiplier
    
    return {
        'roe': roe,
        'net_margin': net_margin,
        'asset_turnover': asset_turnover,
        'equity_multiplier': equity_multiplier,
        'breakdown': {
            'profitability': net_margin,
            'efficiency': asset_turnover,
            'leverage': equity_multiplier
        }
    }

def extended_dupont(income: dict, balance: dict) -> dict:
    """
    5-Factor DuPont Analysis:
    ROE = (EBT/EBIT) × (EBIT/Revenue) × (Revenue/Assets) × (Assets/Equity) × (1-Tax Rate)
    """
    tax_burden = income['net_income'] / income.get('ebt', income['net_income'])
    interest_burden = income.get('ebt', income['operating_income']) / income['operating_income']
    operating_margin = income['operating_income'] / income['revenue']
    asset_turnover = income['revenue'] / balance['total_assets']
    equity_multiplier = balance['total_assets'] / balance['shareholders_equity']
    
    roe = tax_burden * interest_burden * operating_margin * asset_turnover * equity_multiplier
    
    return {
        'roe': roe,
        'tax_burden': tax_burden,
        'interest_burden': interest_burden,
        'operating_margin': operating_margin,
        'asset_turnover': asset_turnover,
        'equity_multiplier': equity_multiplier
    }
```

### 3. DCF Valuation

```python
def dcf_valuation(
    free_cash_flows: list,
    growth_rate: float,
    terminal_growth: float,
    wacc: float,
    shares_outstanding: float
) -> dict:
    """
    Discounted Cash Flow valuation.
    
    Args:
        free_cash_flows: List of projected FCF for forecast period
        growth_rate: Annual growth rate for forecast period
        terminal_growth: Perpetual growth rate (typically 2-3%)
        wacc: Weighted average cost of capital
        shares_outstanding: Number of shares
    
    Returns:
        Enterprise value, equity value, and per-share value
    """
    # Project FCFs if only base FCF provided
    if len(free_cash_flows) == 1:
        base_fcf = free_cash_flows[0]
        free_cash_flows = [base_fcf * (1 + growth_rate) ** i for i in range(1, 6)]
    
    # Discount FCFs
    discount_factors = [(1 + wacc) ** i for i in range(1, len(free_cash_flows) + 1)]
    pv_fcfs = [fcf / df for fcf, df in zip(free_cash_flows, discount_factors)]
    
    # Terminal value (Gordon Growth Model)
    terminal_fcf = free_cash_flows[-1] * (1 + terminal_growth)
    terminal_value = terminal_fcf / (wacc - terminal_growth)
    pv_terminal = terminal_value / discount_factors[-1]
    
    # Enterprise value
    enterprise_value = sum(pv_fcfs) + pv_terminal
    
    return {
        'enterprise_value': enterprise_value,
        'pv_forecast_fcfs': sum(pv_fcfs),
        'pv_terminal_value': pv_terminal,
        'terminal_value': terminal_value,
        'implied_ev_fcf': enterprise_value / free_cash_flows[0],
        'forecast_fcfs': free_cash_flows,
        'discount_factors': discount_factors
    }

def calculate_wacc(
    market_cap: float,
    total_debt: float,
    cost_of_equity: float,
    cost_of_debt: float,
    tax_rate: float = 0.25
) -> float:
    """Calculate Weighted Average Cost of Capital."""
    total_capital = market_cap + total_debt
    equity_weight = market_cap / total_capital
    debt_weight = total_debt / total_capital
    
    wacc = (equity_weight * cost_of_equity) + (debt_weight * cost_of_debt * (1 - tax_rate))
    return wacc

def capm_cost_of_equity(
    risk_free_rate: float,
    market_return: float,
    beta: float
) -> float:
    """Calculate cost of equity using CAPM."""
    return risk_free_rate + beta * (market_return - risk_free_rate)
```

### 4. Comparable Company Analysis

```python
def comparable_analysis(
    target_metrics: dict,
    comparables: list,
    valuation_multiples: list = ['pe', 'ev_ebitda', 'ps']
) -> dict:
    """
    Perform comparable company analysis.
    
    Args:
        target_metrics: Dict with target company metrics
        comparables: List of dicts with comparable company metrics
        valuation_multiples: List of multiples to use
    
    Returns:
        Implied valuations based on peer multiples
    """
    results = {}
    
    for multiple in valuation_multiples:
        peer_multiples = [c[multiple] for c in comparables if multiple in c]
        
        if not peer_multiples:
            continue
        
        avg_multiple = np.mean(peer_multiples)
        median_multiple = np.median(peer_multiples)
        
        # Calculate implied value
        if multiple == 'pe':
            base_metric = target_metrics['net_income']
            implied_avg = base_metric * avg_multiple
            implied_median = base_metric * median_multiple
        elif multiple == 'ev_ebitda':
            base_metric = target_metrics['ebitda']
            implied_avg = base_metric * avg_multiple - target_metrics['net_debt']
            implied_median = base_metric * median_multiple - target_metrics['net_debt']
        elif multiple == 'ps':
            base_metric = target_metrics['revenue']
            implied_avg = base_metric * avg_multiple
            implied_median = base_metric * median_multiple
        else:
            continue
        
        results[multiple] = {
            'peer_avg': avg_multiple,
            'peer_median': median_multiple,
            'peer_range': (min(peer_multiples), max(peer_multiples)),
            'implied_value_avg': implied_avg,
            'implied_value_median': implied_median
        }
    
    return results
```

### 5. Growth Analysis

```python
def analyze_growth(historical_data: pd.DataFrame) -> dict:
    """
    Analyze historical growth rates.
    
    Args:
        historical_data: DataFrame with annual financial metrics
    """
    results = {}
    
    for column in historical_data.columns:
        values = historical_data[column].values
        
        # Year-over-year growth
        yoy_growth = pd.Series(values).pct_change().dropna()
        
        # CAGR
        if len(values) >= 2 and values[0] > 0:
            cagr = (values[-1] / values[0]) ** (1 / (len(values) - 1)) - 1
        else:
            cagr = None
        
        results[column] = {
            'cagr': cagr,
            'avg_yoy_growth': yoy_growth.mean(),
            'yoy_growth_volatility': yoy_growth.std(),
            'latest_yoy': yoy_growth.iloc[-1] if len(yoy_growth) > 0 else None
        }
    
    return results

def sustainable_growth_rate(roe: float, payout_ratio: float) -> float:
    """
    Calculate sustainable growth rate.
    SGR = ROE × (1 - Payout Ratio)
    """
    retention_ratio = 1 - payout_ratio
    return roe * retention_ratio
```

### 6. Quality of Earnings

```python
def earnings_quality_analysis(
    income: dict,
    cash_flow: dict,
    balance: dict
) -> dict:
    """
    Assess earnings quality through accruals analysis.
    """
    # Accruals = Net Income - Operating Cash Flow
    accruals = income['net_income'] - cash_flow['operating_cash_flow']
    
    # Accruals Ratio = Accruals / Average Total Assets
    accruals_ratio = accruals / balance['total_assets']
    
    # Cash Flow to Net Income
    cf_ni_ratio = cash_flow['operating_cash_flow'] / income['net_income']
    
    # Free Cash Flow to Net Income
    fcf = cash_flow['operating_cash_flow'] - cash_flow.get('capex', 0)
    fcf_ni_ratio = fcf / income['net_income']
    
    # Quality score (simplified)
    quality_score = 0
    if cf_ni_ratio > 1:
        quality_score += 2
    elif cf_ni_ratio > 0.8:
        quality_score += 1
    
    if accruals_ratio < 0.05:
        quality_score += 2
    elif accruals_ratio < 0.10:
        quality_score += 1
    
    return {
        'accruals': accruals,
        'accruals_ratio': accruals_ratio,
        'cf_to_ni_ratio': cf_ni_ratio,
        'fcf_to_ni_ratio': fcf_ni_ratio,
        'quality_score': quality_score,  # Max 4
        'quality_assessment': 'High' if quality_score >= 3 else 'Medium' if quality_score >= 1 else 'Low'
    }
```

### 7. Fetch Financial Data (yfinance)

```python
import yfinance as yf

def get_financial_statements(symbol: str) -> dict:
    """Fetch financial statements from Yahoo Finance."""
    ticker = yf.Ticker(symbol)
    
    return {
        'income_statement': ticker.financials,
        'balance_sheet': ticker.balance_sheet,
        'cash_flow': ticker.cashflow,
        'quarterly_income': ticker.quarterly_financials,
        'quarterly_balance': ticker.quarterly_balance_sheet,
        'info': ticker.info
    }

def create_financial_summary(symbol: str) -> dict:
    """Create comprehensive financial summary."""
    data = get_financial_statements(symbol)
    info = data['info']
    
    # Latest annual data
    income = data['income_statement'].iloc[:, 0]
    balance = data['balance_sheet'].iloc[:, 0]
    cash_flow = data['cash_flow'].iloc[:, 0]
    
    # Build standardized dictionaries
    income_dict = {
        'revenue': income.get('Total Revenue', 0),
        'gross_profit': income.get('Gross Profit', 0),
        'operating_income': income.get('Operating Income', 0),
        'net_income': income.get('Net Income', 0),
        'ebitda': income.get('EBITDA', income.get('Operating Income', 0))
    }
    
    balance_dict = {
        'total_assets': balance.get('Total Assets', 0),
        'current_assets': balance.get('Total Current Assets', 0),
        'cash': balance.get('Cash And Cash Equivalents', 0),
        'total_debt': balance.get('Total Debt', 0),
        'current_liabilities': balance.get('Total Current Liabilities', 0),
        'shareholders_equity': balance.get('Total Stockholders Equity', 0)
    }
    
    cash_flow_dict = {
        'operating_cash_flow': cash_flow.get('Operating Cash Flow', 0),
        'capex': abs(cash_flow.get('Capital Expenditure', 0)),
        'free_cash_flow': cash_flow.get('Free Cash Flow', 0)
    }
    
    # Calculate ratios
    ratios = FinancialRatios(income_dict, balance_dict, cash_flow_dict)
    market_cap = info.get('marketCap', 0)
    
    return {
        'symbol': symbol,
        'company_name': info.get('shortName', ''),
        'sector': info.get('sector', ''),
        'industry': info.get('industry', ''),
        'market_cap': market_cap,
        'income_statement': income_dict,
        'balance_sheet': balance_dict,
        'cash_flow': cash_flow_dict,
        'ratios': ratios.get_all_ratios(market_cap)
    }

# Usage
# summary = create_financial_summary('AAPL')
```

## Installation

```bash
pip install pandas numpy yfinance
```

## Best Practices

1. **Data Quality**: Verify data consistency across sources
2. **Normalization**: Adjust for one-time items and accounting changes
3. **Industry Context**: Compare ratios within same industry
4. **Time Series**: Analyze trends, not just point-in-time values
5. **Cash vs Accrual**: Focus on cash flow for quality assessment
