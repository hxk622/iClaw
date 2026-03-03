---
name: 风险管理
visibility: showcase
tags: 金融, 风险管理
description: |
  投资组合风险管理和压力测试。触发场景：
  - "我的持仓风险大吗" / "这个组合安全吗"
  - "最多会亏多少钱" / "最坏情况会怎样"
  - "压力测试一下" / "如果暴跌30%会怎样"
  - "算一下 VaR" / "回撤分析"
  - "2008年金融危机会亏多少"
  包括 VaR、CVaR、历史回撤、压力测试、情景分析。
  与 portfolio-optimizer 的区别：本技能侧重风险度量和测试；optimizer 侧重权重优化。
---

# Risk Management

## Overview

Comprehensive risk management toolkit for measuring, monitoring, and managing portfolio risk.

## Core Risk Metrics

### 1. Value at Risk (VaR)

```python
import numpy as np
import pandas as pd
from scipy.stats import norm, t

def var_historical(
    returns: pd.Series,
    confidence: float = 0.95,
    horizon: int = 1
) -> float:
    """
    Historical VaR using empirical distribution.
    
    Args:
        returns: Historical returns series
        confidence: Confidence level (e.g., 0.95 for 95%)
        horizon: Time horizon in days
    
    Returns:
        VaR as a positive number (loss)
    """
    # Scale for time horizon
    scaled_returns = returns * np.sqrt(horizon)
    
    # VaR is the negative of the quantile
    var = -np.percentile(scaled_returns, (1 - confidence) * 100)
    return var

def var_parametric(
    returns: pd.Series,
    confidence: float = 0.95,
    horizon: int = 1
) -> float:
    """
    Parametric VaR assuming normal distribution.
    """
    mu = returns.mean() * horizon
    sigma = returns.std() * np.sqrt(horizon)
    
    z_score = norm.ppf(1 - confidence)
    var = -(mu + z_score * sigma)
    return var

def var_monte_carlo(
    returns: pd.Series,
    confidence: float = 0.95,
    horizon: int = 1,
    n_simulations: int = 10000
) -> float:
    """
    Monte Carlo VaR simulation.
    """
    mu = returns.mean()
    sigma = returns.std()
    
    # Simulate returns
    simulated_returns = np.random.normal(mu * horizon, sigma * np.sqrt(horizon), n_simulations)
    
    var = -np.percentile(simulated_returns, (1 - confidence) * 100)
    return var

def var_cornish_fisher(
    returns: pd.Series,
    confidence: float = 0.95,
    horizon: int = 1
) -> float:
    """
    Cornish-Fisher VaR adjustment for skewness and kurtosis.
    """
    mu = returns.mean() * horizon
    sigma = returns.std() * np.sqrt(horizon)
    skew = returns.skew()
    kurt = returns.kurtosis()
    
    z = norm.ppf(1 - confidence)
    
    # Cornish-Fisher expansion
    z_cf = (z + 
            (z**2 - 1) * skew / 6 + 
            (z**3 - 3*z) * kurt / 24 - 
            (2*z**3 - 5*z) * skew**2 / 36)
    
    var = -(mu + z_cf * sigma)
    return var

def calculate_all_var(
    returns: pd.Series,
    confidence: float = 0.95,
    horizon: int = 1
) -> dict:
    """Calculate VaR using all methods."""
    return {
        'historical': var_historical(returns, confidence, horizon),
        'parametric': var_parametric(returns, confidence, horizon),
        'monte_carlo': var_monte_carlo(returns, confidence, horizon),
        'cornish_fisher': var_cornish_fisher(returns, confidence, horizon)
    }
```

### 2. Conditional VaR (CVaR / Expected Shortfall)

```python
def cvar_historical(
    returns: pd.Series,
    confidence: float = 0.95,
    horizon: int = 1
) -> float:
    """
    CVaR (Expected Shortfall) - average loss beyond VaR.
    """
    scaled_returns = returns * np.sqrt(horizon)
    var = var_historical(returns, confidence, horizon)
    
    # Average of returns worse than VaR
    tail_returns = scaled_returns[scaled_returns <= -var]
    cvar = -tail_returns.mean()
    return cvar

def cvar_parametric(
    returns: pd.Series,
    confidence: float = 0.95,
    horizon: int = 1
) -> float:
    """
    Parametric CVaR assuming normal distribution.
    """
    mu = returns.mean() * horizon
    sigma = returns.std() * np.sqrt(horizon)
    
    z = norm.ppf(1 - confidence)
    cvar = -(mu - sigma * norm.pdf(z) / (1 - confidence))
    return cvar
```

### 3. Drawdown Analysis

```python
def calculate_drawdowns(prices: pd.Series) -> pd.DataFrame:
    """
    Calculate drawdown series and statistics.
    """
    # Running maximum
    running_max = prices.cummax()
    
    # Drawdown series
    drawdown = (prices - running_max) / running_max
    
    return pd.DataFrame({
        'price': prices,
        'running_max': running_max,
        'drawdown': drawdown,
        'drawdown_pct': drawdown * 100
    })

def drawdown_statistics(prices: pd.Series) -> dict:
    """
    Calculate comprehensive drawdown statistics.
    """
    dd_df = calculate_drawdowns(prices)
    drawdown = dd_df['drawdown']
    
    # Maximum drawdown
    max_dd = drawdown.min()
    max_dd_idx = drawdown.idxmin()
    
    # Find peak and trough
    peak_idx = prices[:max_dd_idx].idxmax()
    
    # Find recovery (if any)
    post_trough = prices[max_dd_idx:]
    recovery_idx = post_trough[post_trough >= prices[peak_idx]].first_valid_index()
    
    # Duration calculations
    drawdown_duration = (max_dd_idx - peak_idx).days if hasattr(peak_idx, 'days') else None
    recovery_duration = (recovery_idx - max_dd_idx).days if recovery_idx else None
    
    # Average drawdown
    avg_dd = drawdown[drawdown < 0].mean()
    
    # Count significant drawdowns (> 5%)
    significant_dds = (drawdown < -0.05).sum()
    
    return {
        'max_drawdown': max_dd,
        'max_drawdown_pct': f"{max_dd:.2%}",
        'peak_date': peak_idx,
        'trough_date': max_dd_idx,
        'recovery_date': recovery_idx,
        'drawdown_duration_days': drawdown_duration,
        'recovery_duration_days': recovery_duration,
        'average_drawdown': avg_dd,
        'significant_drawdowns_count': significant_dds,
        'current_drawdown': drawdown.iloc[-1]
    }

def underwater_chart(prices: pd.Series) -> pd.Series:
    """Return drawdown series for underwater chart visualization."""
    return calculate_drawdowns(prices)['drawdown']
```

### 4. Portfolio Risk Decomposition

```python
def risk_contribution(
    weights: np.ndarray,
    cov_matrix: np.ndarray
) -> dict:
    """
    Calculate risk contribution of each asset.
    """
    portfolio_vol = np.sqrt(np.dot(weights.T, np.dot(cov_matrix, weights)))
    
    # Marginal contribution to risk
    marginal_contrib = np.dot(cov_matrix, weights) / portfolio_vol
    
    # Component contribution to risk
    component_contrib = weights * marginal_contrib
    
    # Percentage contribution
    pct_contrib = component_contrib / portfolio_vol
    
    return {
        'portfolio_volatility': portfolio_vol,
        'marginal_contribution': marginal_contrib,
        'component_contribution': component_contrib,
        'percentage_contribution': pct_contrib
    }

def incremental_var(
    returns: pd.DataFrame,
    weights: np.ndarray,
    confidence: float = 0.95
) -> dict:
    """
    Calculate incremental VaR for each position.
    """
    portfolio_returns = returns.dot(weights)
    portfolio_var = var_parametric(portfolio_returns, confidence)
    
    incremental = {}
    for i, col in enumerate(returns.columns):
        # Temporarily remove position
        temp_weights = weights.copy()
        temp_weights[i] = 0
        temp_weights = temp_weights / temp_weights.sum()  # Renormalize
        
        temp_returns = returns.dot(temp_weights)
        temp_var = var_parametric(temp_returns, confidence)
        
        incremental[col] = portfolio_var - temp_var
    
    return incremental
```

### 5. Stress Testing

```python
def historical_stress_test(
    portfolio_returns: pd.Series,
    stress_periods: dict
) -> dict:
    """
    Test portfolio against historical stress periods.
    
    stress_periods: {'2008 Crisis': ('2008-09-01', '2009-03-01'), ...}
    """
    results = {}
    
    for period_name, (start, end) in stress_periods.items():
        try:
            period_returns = portfolio_returns[start:end]
            
            results[period_name] = {
                'total_return': (1 + period_returns).prod() - 1,
                'max_drawdown': calculate_drawdowns(
                    (1 + period_returns).cumprod()
                )['drawdown'].min(),
                'volatility': period_returns.std() * np.sqrt(252),
                'worst_day': period_returns.min(),
                'best_day': period_returns.max(),
                'trading_days': len(period_returns)
            }
        except:
            results[period_name] = {'error': 'Period not in data range'}
    
    return results

# Common stress periods
STRESS_PERIODS = {
    '2008 Financial Crisis': ('2008-09-01', '2009-03-31'),
    '2020 COVID Crash': ('2020-02-19', '2020-03-23'),
    '2022 Rate Hikes': ('2022-01-01', '2022-10-31'),
    'Flash Crash 2010': ('2010-05-06', '2010-05-06'),
    'Brexit 2016': ('2016-06-23', '2016-06-27')
}

def scenario_analysis(
    positions: dict,  # {asset: value}
    scenarios: dict   # {scenario: {asset: return}}
) -> dict:
    """
    Scenario analysis for portfolio.
    """
    total_value = sum(positions.values())
    weights = {k: v / total_value for k, v in positions.items()}
    
    results = {}
    for scenario_name, asset_returns in scenarios.items():
        portfolio_return = sum(
            weights.get(asset, 0) * ret 
            for asset, ret in asset_returns.items()
        )
        
        results[scenario_name] = {
            'portfolio_return': portfolio_return,
            'portfolio_pnl': total_value * portfolio_return,
            'asset_impacts': {
                asset: positions.get(asset, 0) * asset_returns.get(asset, 0)
                for asset in positions
            }
        }
    
    return results

# Example scenarios
EXAMPLE_SCENARIOS = {
    'Market Crash (-20%)': {'SPY': -0.20, 'QQQ': -0.25, 'TLT': 0.10, 'GLD': 0.05},
    'Rate Hike Shock': {'SPY': -0.05, 'QQQ': -0.08, 'TLT': -0.15, 'GLD': -0.03},
    'Inflation Surge': {'SPY': -0.10, 'QQQ': -0.12, 'TLT': -0.20, 'GLD': 0.15},
    'Risk-On Rally': {'SPY': 0.15, 'QQQ': 0.20, 'TLT': -0.05, 'GLD': -0.05}
}
```

### 6. Risk-Adjusted Performance Metrics

```python
def sharpe_ratio(
    returns: pd.Series,
    rf: float = 0.02,
    periods_per_year: int = 252
) -> float:
    """Sharpe Ratio: (Return - Rf) / Volatility"""
    excess_return = returns.mean() * periods_per_year - rf
    volatility = returns.std() * np.sqrt(periods_per_year)
    return excess_return / volatility

def sortino_ratio(
    returns: pd.Series,
    rf: float = 0.02,
    periods_per_year: int = 252
) -> float:
    """Sortino Ratio: Uses downside deviation instead of total volatility"""
    excess_return = returns.mean() * periods_per_year - rf
    downside_returns = returns[returns < 0]
    downside_std = downside_returns.std() * np.sqrt(periods_per_year)
    return excess_return / downside_std

def calmar_ratio(
    returns: pd.Series,
    periods_per_year: int = 252
) -> float:
    """Calmar Ratio: Annual Return / Max Drawdown"""
    annual_return = returns.mean() * periods_per_year
    prices = (1 + returns).cumprod()
    max_dd = abs(calculate_drawdowns(prices)['drawdown'].min())
    return annual_return / max_dd if max_dd > 0 else 0

def omega_ratio(
    returns: pd.Series,
    threshold: float = 0
) -> float:
    """Omega Ratio: Probability weighted gains / losses"""
    gains = returns[returns > threshold] - threshold
    losses = threshold - returns[returns <= threshold]
    return gains.sum() / losses.sum() if losses.sum() > 0 else np.inf

def information_ratio(
    portfolio_returns: pd.Series,
    benchmark_returns: pd.Series,
    periods_per_year: int = 252
) -> float:
    """Information Ratio: Active Return / Tracking Error"""
    active_returns = portfolio_returns - benchmark_returns
    active_return = active_returns.mean() * periods_per_year
    tracking_error = active_returns.std() * np.sqrt(periods_per_year)
    return active_return / tracking_error

def calculate_all_risk_metrics(
    returns: pd.Series,
    benchmark_returns: pd.Series = None,
    rf: float = 0.02
) -> dict:
    """Calculate comprehensive risk-adjusted metrics."""
    prices = (1 + returns).cumprod()
    dd_stats = drawdown_statistics(prices)
    
    metrics = {
        'total_return': (1 + returns).prod() - 1,
        'annual_return': returns.mean() * 252,
        'annual_volatility': returns.std() * np.sqrt(252),
        'sharpe_ratio': sharpe_ratio(returns, rf),
        'sortino_ratio': sortino_ratio(returns, rf),
        'calmar_ratio': calmar_ratio(returns),
        'omega_ratio': omega_ratio(returns),
        'max_drawdown': dd_stats['max_drawdown'],
        'var_95': var_historical(returns, 0.95),
        'cvar_95': cvar_historical(returns, 0.95),
        'skewness': returns.skew(),
        'kurtosis': returns.kurtosis()
    }
    
    if benchmark_returns is not None:
        metrics['information_ratio'] = information_ratio(returns, benchmark_returns)
        metrics['beta'] = returns.cov(benchmark_returns) / benchmark_returns.var()
        metrics['alpha'] = (returns.mean() - rf/252) - metrics['beta'] * (benchmark_returns.mean() - rf/252)
    
    return metrics
```

### 7. Risk Limits and Alerts

```python
def check_risk_limits(
    current_metrics: dict,
    limits: dict
) -> dict:
    """
    Check if current risk metrics exceed defined limits.
    """
    breaches = {}
    warnings = {}
    
    for metric, limit in limits.items():
        if metric not in current_metrics:
            continue
        
        current = current_metrics[metric]
        
        if isinstance(limit, dict):
            if 'max' in limit and current > limit['max']:
                breaches[metric] = {
                    'current': current,
                    'limit': limit['max'],
                    'breach': current - limit['max']
                }
            elif 'min' in limit and current < limit['min']:
                breaches[metric] = {
                    'current': current,
                    'limit': limit['min'],
                    'breach': limit['min'] - current
                }
            elif 'warning' in limit:
                if current > limit['warning']:
                    warnings[metric] = {
                        'current': current,
                        'warning_level': limit['warning']
                    }
        else:
            if abs(current) > abs(limit):
                breaches[metric] = {
                    'current': current,
                    'limit': limit
                }
    
    return {
        'breaches': breaches,
        'warnings': warnings,
        'status': 'BREACH' if breaches else 'WARNING' if warnings else 'OK'
    }

# Example limits
EXAMPLE_LIMITS = {
    'var_95': {'max': 0.05, 'warning': 0.04},
    'max_drawdown': {'max': -0.20, 'warning': -0.15},
    'annual_volatility': {'max': 0.25},
    'sharpe_ratio': {'min': 0.5}
}
```

## Installation

```bash
pip install numpy pandas scipy yfinance
```

## Best Practices

1. **Multiple Methods**: Use multiple VaR methods and compare
2. **Confidence Levels**: Report 95% and 99% VaR
3. **Backtesting**: Validate VaR models with historical exceedances
4. **Stress Testing**: Regularly update stress scenarios
5. **Limits**: Set and monitor risk limits proactively
6. **Tail Risk**: Focus on CVaR for tail risk management
