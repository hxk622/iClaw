---
name: 投资组合优化
visibility: showcase
tags: 金融, 组合优化
description: |
  投资组合优化和资产配置。触发场景：
  - "帮我配一个投资组合" / "怎么分配资金"
  - "100万怎么投" / "优化一下我的持仓比例"
  - "做个分散投资方案" / "降低组合波动"
  - "画个有效前沿" / "风险平价组合"
  - "需要再平衡吗" / "调仓建议"
  包括均值-方差、风险平价、Black-Litterman、因子配置。
  与 risk-management 的区别：本技能侧重权重优化；risk-management 侧重风险度量。
---

# Portfolio Optimizer

## Overview

Comprehensive portfolio optimization toolkit implementing modern portfolio theory, risk parity, and advanced allocation strategies.

## Core Optimization Methods

### 1. Mean-Variance Optimization (Markowitz)

```python
import numpy as np
import pandas as pd
from scipy.optimize import minimize
import yfinance as yf

def get_portfolio_stats(weights: np.ndarray, returns: pd.DataFrame) -> tuple:
    """Calculate portfolio return and volatility."""
    portfolio_return = np.sum(returns.mean() * weights) * 252
    portfolio_volatility = np.sqrt(
        np.dot(weights.T, np.dot(returns.cov() * 252, weights))
    )
    return portfolio_return, portfolio_volatility

def minimize_volatility(weights: np.ndarray, returns: pd.DataFrame) -> float:
    """Objective function to minimize volatility."""
    return get_portfolio_stats(weights, returns)[1]

def maximize_sharpe(weights: np.ndarray, returns: pd.DataFrame, rf: float = 0.02) -> float:
    """Objective function to maximize Sharpe ratio (negative for minimization)."""
    ret, vol = get_portfolio_stats(weights, returns)
    return -(ret - rf) / vol

def mean_variance_optimize(
    returns: pd.DataFrame,
    target: str = 'max_sharpe',
    rf: float = 0.02,
    constraints: dict = None
) -> dict:
    """
    Perform mean-variance optimization.
    
    Args:
        returns: Daily returns DataFrame
        target: 'max_sharpe', 'min_vol', or 'target_return'
        rf: Risk-free rate
        constraints: Optional dict with 'min_weight', 'max_weight', 'target_return'
    
    Returns:
        Optimal weights and portfolio statistics
    """
    n_assets = len(returns.columns)
    init_weights = np.array([1/n_assets] * n_assets)
    
    # Bounds
    min_weight = constraints.get('min_weight', 0) if constraints else 0
    max_weight = constraints.get('max_weight', 1) if constraints else 1
    bounds = tuple((min_weight, max_weight) for _ in range(n_assets))
    
    # Constraints - weights sum to 1
    cons = [{'type': 'eq', 'fun': lambda x: np.sum(x) - 1}]
    
    # Additional constraint for target return
    if target == 'target_return' and constraints:
        target_ret = constraints.get('target_return', 0.1)
        cons.append({
            'type': 'eq',
            'fun': lambda x: get_portfolio_stats(x, returns)[0] - target_ret
        })
    
    # Optimize
    if target == 'max_sharpe':
        result = minimize(maximize_sharpe, init_weights, 
                         args=(returns, rf), method='SLSQP',
                         bounds=bounds, constraints=cons)
    else:  # min_vol or target_return
        result = minimize(minimize_volatility, init_weights,
                         args=(returns,), method='SLSQP',
                         bounds=bounds, constraints=cons)
    
    optimal_weights = result.x
    ret, vol = get_portfolio_stats(optimal_weights, returns)
    sharpe = (ret - rf) / vol
    
    return {
        'weights': dict(zip(returns.columns, optimal_weights)),
        'return': ret,
        'volatility': vol,
        'sharpe_ratio': sharpe
    }

# Usage
# symbols = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'META']
# data = yf.download(symbols, period='2y')['Adj Close']
# returns = data.pct_change().dropna()
# optimal = mean_variance_optimize(returns, target='max_sharpe')
```

### 2. Efficient Frontier

```python
def calculate_efficient_frontier(
    returns: pd.DataFrame,
    n_points: int = 50,
    rf: float = 0.02
) -> pd.DataFrame:
    """
    Calculate the efficient frontier.
    
    Returns:
        DataFrame with return, volatility, sharpe for each point
    """
    n_assets = len(returns.columns)
    
    # Find min/max return portfolios
    min_vol = mean_variance_optimize(returns, target='min_vol')
    
    # Individual asset returns
    asset_returns = returns.mean() * 252
    min_ret = min_vol['return']
    max_ret = asset_returns.max() * 0.95  # Slightly below max
    
    target_returns = np.linspace(min_ret, max_ret, n_points)
    
    frontier = []
    for target_ret in target_returns:
        try:
            result = mean_variance_optimize(
                returns, 
                target='target_return',
                constraints={'target_return': target_ret}
            )
            frontier.append({
                'return': result['return'],
                'volatility': result['volatility'],
                'sharpe': result['sharpe_ratio'],
                'weights': result['weights']
            })
        except:
            continue
    
    return pd.DataFrame(frontier)

def plot_efficient_frontier(frontier_df: pd.DataFrame, returns: pd.DataFrame):
    """Plot the efficient frontier with individual assets."""
    import plotly.graph_objects as go
    
    fig = go.Figure()
    
    # Efficient frontier
    fig.add_trace(go.Scatter(
        x=frontier_df['volatility'],
        y=frontier_df['return'],
        mode='lines',
        name='Efficient Frontier',
        line=dict(color='blue', width=2)
    ))
    
    # Individual assets
    for col in returns.columns:
        ret = returns[col].mean() * 252
        vol = returns[col].std() * np.sqrt(252)
        fig.add_trace(go.Scatter(
            x=[vol], y=[ret],
            mode='markers+text',
            name=col,
            text=[col],
            textposition='top center',
            marker=dict(size=10)
        ))
    
    fig.update_layout(
        title='Efficient Frontier',
        xaxis_title='Volatility (Annual)',
        yaxis_title='Return (Annual)',
        template='plotly_white'
    )
    
    return fig
```

### 3. Risk Parity

```python
def risk_parity_optimize(returns: pd.DataFrame) -> dict:
    """
    Risk parity optimization - equal risk contribution from each asset.
    """
    n_assets = len(returns.columns)
    cov_matrix = returns.cov() * 252
    
    def risk_budget_objective(weights):
        """Minimize deviation from equal risk contribution."""
        portfolio_vol = np.sqrt(np.dot(weights.T, np.dot(cov_matrix, weights)))
        
        # Marginal risk contribution
        marginal_contrib = np.dot(cov_matrix, weights)
        
        # Risk contribution
        risk_contrib = weights * marginal_contrib / portfolio_vol
        
        # Target: equal risk contribution
        target_risk = portfolio_vol / n_assets
        
        return np.sum((risk_contrib - target_risk) ** 2)
    
    # Constraints and bounds
    constraints = {'type': 'eq', 'fun': lambda x: np.sum(x) - 1}
    bounds = tuple((0.01, 1) for _ in range(n_assets))
    init_weights = np.array([1/n_assets] * n_assets)
    
    result = minimize(risk_budget_objective, init_weights,
                     method='SLSQP', bounds=bounds, constraints=constraints)
    
    optimal_weights = result.x
    ret, vol = get_portfolio_stats(optimal_weights, returns)
    
    # Calculate risk contributions
    marginal_contrib = np.dot(cov_matrix, optimal_weights)
    risk_contrib = optimal_weights * marginal_contrib / vol
    
    return {
        'weights': dict(zip(returns.columns, optimal_weights)),
        'return': ret,
        'volatility': vol,
        'risk_contributions': dict(zip(returns.columns, risk_contrib / vol))
    }
```

### 4. Black-Litterman Model

```python
def black_litterman_optimize(
    returns: pd.DataFrame,
    market_caps: dict,
    views: list,
    view_confidences: list,
    risk_aversion: float = 2.5,
    tau: float = 0.05
) -> dict:
    """
    Black-Litterman portfolio optimization.
    
    Args:
        returns: Daily returns DataFrame
        market_caps: Dict of market capitalizations
        views: List of dicts with 'assets', 'weights', 'view_return'
        view_confidences: List of confidence levels (0-1)
        risk_aversion: Risk aversion coefficient
        tau: Uncertainty in equilibrium
    
    Example view:
        {'assets': ['AAPL', 'MSFT'], 'weights': [1, -1], 'view_return': 0.05}
        means AAPL will outperform MSFT by 5%
    """
    n_assets = len(returns.columns)
    assets = returns.columns.tolist()
    
    # Covariance matrix
    cov_matrix = returns.cov() * 252
    
    # Market cap weights
    total_cap = sum(market_caps.values())
    market_weights = np.array([market_caps.get(a, 0) / total_cap for a in assets])
    
    # Implied equilibrium returns (reverse optimization)
    implied_returns = risk_aversion * np.dot(cov_matrix, market_weights)
    
    # Build P matrix (view portfolios) and Q vector (view returns)
    n_views = len(views)
    P = np.zeros((n_views, n_assets))
    Q = np.zeros(n_views)
    
    for i, view in enumerate(views):
        for asset, weight in zip(view['assets'], view['weights']):
            if asset in assets:
                P[i, assets.index(asset)] = weight
        Q[i] = view['view_return']
    
    # Omega - uncertainty of views (diagonal)
    omega = np.diag([
        (1 - conf) * np.dot(P[i], np.dot(tau * cov_matrix, P[i].T))
        for i, conf in enumerate(view_confidences)
    ])
    
    # Black-Litterman formula
    tau_cov = tau * cov_matrix
    tau_cov_inv = np.linalg.inv(tau_cov)
    omega_inv = np.linalg.inv(omega)
    
    # Posterior expected returns
    M = np.linalg.inv(tau_cov_inv + np.dot(P.T, np.dot(omega_inv, P)))
    bl_returns = np.dot(M, np.dot(tau_cov_inv, implied_returns) + np.dot(P.T, np.dot(omega_inv, Q)))
    
    # Posterior covariance
    bl_cov = cov_matrix + M
    
    # Optimal weights
    optimal_weights = np.dot(np.linalg.inv(risk_aversion * bl_cov), bl_returns)
    optimal_weights = optimal_weights / np.sum(optimal_weights)  # Normalize
    
    return {
        'weights': dict(zip(assets, optimal_weights)),
        'expected_returns': dict(zip(assets, bl_returns)),
        'implied_returns': dict(zip(assets, implied_returns))
    }
```

### 5. Minimum Correlation Portfolio

```python
def minimum_correlation_optimize(returns: pd.DataFrame) -> dict:
    """
    Optimize for minimum average correlation between assets.
    """
    corr_matrix = returns.corr()
    n_assets = len(returns.columns)
    
    def correlation_objective(weights):
        """Minimize weighted average correlation."""
        weighted_corr = 0
        for i in range(n_assets):
            for j in range(n_assets):
                if i != j:
                    weighted_corr += weights[i] * weights[j] * corr_matrix.iloc[i, j]
        return weighted_corr
    
    constraints = {'type': 'eq', 'fun': lambda x: np.sum(x) - 1}
    bounds = tuple((0, 1) for _ in range(n_assets))
    init_weights = np.array([1/n_assets] * n_assets)
    
    result = minimize(correlation_objective, init_weights,
                     method='SLSQP', bounds=bounds, constraints=constraints)
    
    optimal_weights = result.x
    ret, vol = get_portfolio_stats(optimal_weights, returns)
    
    return {
        'weights': dict(zip(returns.columns, optimal_weights)),
        'return': ret,
        'volatility': vol
    }
```

### 6. Maximum Diversification

```python
def maximum_diversification_optimize(returns: pd.DataFrame) -> dict:
    """
    Maximize diversification ratio:
    DR = weighted average volatility / portfolio volatility
    """
    n_assets = len(returns.columns)
    asset_vols = returns.std() * np.sqrt(252)
    cov_matrix = returns.cov() * 252
    
    def neg_diversification_ratio(weights):
        portfolio_vol = np.sqrt(np.dot(weights.T, np.dot(cov_matrix, weights)))
        weighted_vol = np.dot(weights, asset_vols)
        return -weighted_vol / portfolio_vol  # Negative for minimization
    
    constraints = {'type': 'eq', 'fun': lambda x: np.sum(x) - 1}
    bounds = tuple((0, 1) for _ in range(n_assets))
    init_weights = np.array([1/n_assets] * n_assets)
    
    result = minimize(neg_diversification_ratio, init_weights,
                     method='SLSQP', bounds=bounds, constraints=constraints)
    
    optimal_weights = result.x
    ret, vol = get_portfolio_stats(optimal_weights, returns)
    diversification_ratio = -neg_diversification_ratio(optimal_weights)
    
    return {
        'weights': dict(zip(returns.columns, optimal_weights)),
        'return': ret,
        'volatility': vol,
        'diversification_ratio': diversification_ratio
    }
```

### 7. Factor-Based Allocation

```python
def factor_tilt_optimize(
    returns: pd.DataFrame,
    factor_exposures: pd.DataFrame,
    target_exposures: dict,
    risk_budget: float = 0.15
) -> dict:
    """
    Optimize portfolio with target factor exposures.
    
    Args:
        returns: Asset returns
        factor_exposures: DataFrame with factor loadings per asset
        target_exposures: Dict of target factor exposures
        risk_budget: Maximum portfolio volatility
    """
    n_assets = len(returns.columns)
    cov_matrix = returns.cov() * 252
    
    def factor_deviation(weights):
        """Minimize deviation from target factor exposures."""
        portfolio_exposures = np.dot(factor_exposures.T, weights)
        target = np.array([target_exposures.get(f, 0) for f in factor_exposures.columns])
        return np.sum((portfolio_exposures - target) ** 2)
    
    constraints = [
        {'type': 'eq', 'fun': lambda x: np.sum(x) - 1},
        {'type': 'ineq', 'fun': lambda x: risk_budget - np.sqrt(np.dot(x.T, np.dot(cov_matrix, x)))}
    ]
    bounds = tuple((0, 0.3) for _ in range(n_assets))
    init_weights = np.array([1/n_assets] * n_assets)
    
    result = minimize(factor_deviation, init_weights,
                     method='SLSQP', bounds=bounds, constraints=constraints)
    
    optimal_weights = result.x
    ret, vol = get_portfolio_stats(optimal_weights, returns)
    
    return {
        'weights': dict(zip(returns.columns, optimal_weights)),
        'return': ret,
        'volatility': vol,
        'achieved_exposures': dict(zip(
            factor_exposures.columns,
            np.dot(factor_exposures.T, optimal_weights)
        ))
    }
```

### 8. Rebalancing

```python
def calculate_rebalance_trades(
    current_holdings: dict,
    target_weights: dict,
    portfolio_value: float,
    current_prices: dict,
    min_trade_value: float = 100
) -> dict:
    """
    Calculate trades needed to rebalance portfolio.
    """
    trades = {}
    
    for asset in set(current_holdings.keys()) | set(target_weights.keys()):
        current_value = current_holdings.get(asset, 0) * current_prices.get(asset, 0)
        target_value = target_weights.get(asset, 0) * portfolio_value
        
        trade_value = target_value - current_value
        
        if abs(trade_value) >= min_trade_value:
            trade_shares = trade_value / current_prices.get(asset, 1)
            trades[asset] = {
                'shares': round(trade_shares, 4),
                'value': trade_value,
                'action': 'BUY' if trade_value > 0 else 'SELL'
            }
    
    return trades

def threshold_rebalance(
    current_weights: dict,
    target_weights: dict,
    threshold: float = 0.05
) -> bool:
    """Check if rebalancing is needed based on drift threshold."""
    for asset in target_weights:
        current = current_weights.get(asset, 0)
        target = target_weights[asset]
        if abs(current - target) > threshold:
            return True
    return False
```

## Installation

```bash
pip install numpy pandas scipy yfinance plotly cvxpy
```

## Best Practices

1. **Data Quality**: Use adjusted prices, handle missing data
2. **Estimation Error**: Use shrinkage estimators for covariance
3. **Transaction Costs**: Include in optimization for realistic results
4. **Constraints**: Add realistic position limits
5. **Backtesting**: Validate strategies with out-of-sample testing
6. **Rebalancing Frequency**: Balance tracking error vs costs
