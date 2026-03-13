---
name: 期权定价
visibility: showcase
tags: 金融, 期权定价
description: 期权定价模型，包括 Black-Scholes、二叉树和蒙特卡洛。计算希腊字母（delta、gamma、theta、vega、rho），分析期权策略并进行波动率分析。当用户需要期权估值、希腊字母计算或期权策略分析时使用。
---

# Options Pricing & Analysis

## Overview

Comprehensive options pricing toolkit including Black-Scholes model, Greeks calculations, volatility analysis, and options strategy evaluation.

## Core Pricing Models

### 1. Black-Scholes Model

```python
import numpy as np
from scipy.stats import norm
from typing import Literal

def black_scholes(
    S: float,        # Current stock price
    K: float,        # Strike price
    T: float,        # Time to expiration (years)
    r: float,        # Risk-free rate
    sigma: float,    # Volatility (annualized)
    option_type: Literal['call', 'put'] = 'call'
) -> dict:
    """
    Black-Scholes option pricing model.
    
    Returns:
        Option price and all Greeks
    """
    # Handle edge cases
    if T <= 0:
        if option_type == 'call':
            return {'price': max(S - K, 0), 'd1': 0, 'd2': 0}
        else:
            return {'price': max(K - S, 0), 'd1': 0, 'd2': 0}
    
    # Calculate d1 and d2
    d1 = (np.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * np.sqrt(T))
    d2 = d1 - sigma * np.sqrt(T)
    
    # Option price
    if option_type == 'call':
        price = S * norm.cdf(d1) - K * np.exp(-r * T) * norm.cdf(d2)
    else:  # put
        price = K * np.exp(-r * T) * norm.cdf(-d2) - S * norm.cdf(-d1)
    
    # Greeks
    delta = norm.cdf(d1) if option_type == 'call' else norm.cdf(d1) - 1
    gamma = norm.pdf(d1) / (S * sigma * np.sqrt(T))
    vega = S * norm.pdf(d1) * np.sqrt(T) / 100  # Per 1% change
    theta = (-S * norm.pdf(d1) * sigma / (2 * np.sqrt(T)) - 
             r * K * np.exp(-r * T) * norm.cdf(d2 if option_type == 'call' else -d2)) / 365
    rho = K * T * np.exp(-r * T) * norm.cdf(d2 if option_type == 'call' else -d2) / 100
    
    if option_type == 'put':
        theta = (-S * norm.pdf(d1) * sigma / (2 * np.sqrt(T)) + 
                 r * K * np.exp(-r * T) * norm.cdf(-d2)) / 365
        rho = -K * T * np.exp(-r * T) * norm.cdf(-d2) / 100
    
    return {
        'price': price,
        'd1': d1,
        'd2': d2,
        'delta': delta,
        'gamma': gamma,
        'vega': vega,
        'theta': theta,
        'rho': rho
    }

# Usage
# result = black_scholes(S=100, K=105, T=0.25, r=0.05, sigma=0.2, option_type='call')
```

### 2. Greeks in Detail

```python
def calculate_all_greeks(
    S: float, K: float, T: float, r: float, sigma: float,
    option_type: str = 'call'
) -> dict:
    """Calculate all option Greeks with interpretations."""
    
    if T <= 0:
        return {'error': 'Option has expired'}
    
    d1 = (np.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * np.sqrt(T))
    d2 = d1 - sigma * np.sqrt(T)
    
    # First-order Greeks
    if option_type == 'call':
        delta = norm.cdf(d1)
    else:
        delta = norm.cdf(d1) - 1
    
    gamma = norm.pdf(d1) / (S * sigma * np.sqrt(T))
    vega = S * norm.pdf(d1) * np.sqrt(T)
    
    if option_type == 'call':
        theta = (-S * norm.pdf(d1) * sigma / (2 * np.sqrt(T)) - 
                 r * K * np.exp(-r * T) * norm.cdf(d2))
        rho = K * T * np.exp(-r * T) * norm.cdf(d2)
    else:
        theta = (-S * norm.pdf(d1) * sigma / (2 * np.sqrt(T)) + 
                 r * K * np.exp(-r * T) * norm.cdf(-d2))
        rho = -K * T * np.exp(-r * T) * norm.cdf(-d2)
    
    # Second-order Greeks
    vanna = vega / S * (1 - d1 / (sigma * np.sqrt(T)))
    volga = vega * d1 * d2 / sigma  # Vomma
    charm = -norm.pdf(d1) * (2 * r * T - d2 * sigma * np.sqrt(T)) / (2 * T * sigma * np.sqrt(T))
    
    return {
        'first_order': {
            'delta': delta,
            'gamma': gamma,
            'vega': vega / 100,  # Per 1% vol change
            'theta': theta / 365,  # Per day
            'rho': rho / 100  # Per 1% rate change
        },
        'second_order': {
            'vanna': vanna,
            'volga': volga,
            'charm': charm
        },
        'interpretations': {
            'delta': f"Option changes ${delta:.4f} for $1 stock move",
            'gamma': f"Delta changes {gamma:.4f} for $1 stock move",
            'theta': f"Option loses ${-theta/365:.4f} per day",
            'vega': f"Option changes ${vega/100:.4f} for 1% vol change"
        }
    }
```

### 3. Implied Volatility

```python
from scipy.optimize import brentq

def implied_volatility(
    market_price: float,
    S: float, K: float, T: float, r: float,
    option_type: str = 'call'
) -> float:
    """
    Calculate implied volatility using Brent's method.
    """
    def objective(sigma):
        return black_scholes(S, K, T, r, sigma, option_type)['price'] - market_price
    
    try:
        iv = brentq(objective, 0.001, 5.0)
        return iv
    except ValueError:
        return None

def iv_surface(
    options_data: list,  # List of dicts with strike, expiry, price, type
    S: float,
    r: float
) -> dict:
    """
    Build implied volatility surface.
    """
    surface = []
    
    for opt in options_data:
        iv = implied_volatility(
            market_price=opt['price'],
            S=S,
            K=opt['strike'],
            T=opt['expiry'],
            r=r,
            option_type=opt['type']
        )
        
        if iv:
            surface.append({
                'strike': opt['strike'],
                'expiry': opt['expiry'],
                'moneyness': S / opt['strike'],
                'iv': iv,
                'type': opt['type']
            })
    
    return surface

def volatility_smile(ivs: list, strikes: list, atm_strike: float) -> dict:
    """Analyze volatility smile/skew."""
    atm_idx = np.argmin(np.abs(np.array(strikes) - atm_strike))
    atm_iv = ivs[atm_idx]
    
    # Skew: difference between OTM put and OTM call IV
    otm_put_iv = ivs[0] if strikes[0] < atm_strike else None
    otm_call_iv = ivs[-1] if strikes[-1] > atm_strike else None
    
    skew = (otm_put_iv - otm_call_iv) if otm_put_iv and otm_call_iv else None
    
    return {
        'atm_iv': atm_iv,
        'otm_put_iv': otm_put_iv,
        'otm_call_iv': otm_call_iv,
        'skew': skew,
        'smile_shape': 'skew' if skew and skew > 0.02 else 'flat' if abs(skew or 0) < 0.02 else 'reverse_skew'
    }
```

### 4. Binomial Tree Model

```python
def binomial_tree(
    S: float, K: float, T: float, r: float, sigma: float,
    N: int = 100,  # Number of steps
    option_type: str = 'call',
    american: bool = False
) -> dict:
    """
    Binomial tree option pricing (Cox-Ross-Rubinstein).
    Supports American options.
    """
    dt = T / N
    u = np.exp(sigma * np.sqrt(dt))  # Up factor
    d = 1 / u  # Down factor
    p = (np.exp(r * dt) - d) / (u - d)  # Risk-neutral probability
    
    # Initialize asset prices at maturity
    asset_prices = np.zeros(N + 1)
    for i in range(N + 1):
        asset_prices[i] = S * (u ** (N - i)) * (d ** i)
    
    # Initialize option values at maturity
    if option_type == 'call':
        option_values = np.maximum(asset_prices - K, 0)
    else:
        option_values = np.maximum(K - asset_prices, 0)
    
    # Backward induction
    for j in range(N - 1, -1, -1):
        for i in range(j + 1):
            asset_price = S * (u ** (j - i)) * (d ** i)
            option_values[i] = np.exp(-r * dt) * (p * option_values[i] + (1 - p) * option_values[i + 1])
            
            # Early exercise for American options
            if american:
                if option_type == 'call':
                    option_values[i] = max(option_values[i], asset_price - K)
                else:
                    option_values[i] = max(option_values[i], K - asset_price)
    
    return {
        'price': option_values[0],
        'u': u,
        'd': d,
        'p': p,
        'steps': N
    }
```

### 5. Monte Carlo Simulation

```python
def monte_carlo_option(
    S: float, K: float, T: float, r: float, sigma: float,
    option_type: str = 'call',
    n_simulations: int = 100000,
    n_steps: int = 252
) -> dict:
    """
    Monte Carlo option pricing with confidence interval.
    """
    dt = T / n_steps
    
    # Generate random paths
    Z = np.random.standard_normal((n_simulations, n_steps))
    
    # Simulate price paths
    price_paths = np.zeros((n_simulations, n_steps + 1))
    price_paths[:, 0] = S
    
    for t in range(1, n_steps + 1):
        price_paths[:, t] = price_paths[:, t-1] * np.exp(
            (r - 0.5 * sigma**2) * dt + sigma * np.sqrt(dt) * Z[:, t-1]
        )
    
    # Calculate payoffs at maturity
    final_prices = price_paths[:, -1]
    if option_type == 'call':
        payoffs = np.maximum(final_prices - K, 0)
    else:
        payoffs = np.maximum(K - final_prices, 0)
    
    # Discount to present value
    option_price = np.exp(-r * T) * np.mean(payoffs)
    std_error = np.exp(-r * T) * np.std(payoffs) / np.sqrt(n_simulations)
    
    return {
        'price': option_price,
        'std_error': std_error,
        'confidence_interval_95': (option_price - 1.96 * std_error, option_price + 1.96 * std_error),
        'n_simulations': n_simulations
    }
```

### 6. Options Strategies

```python
def strategy_payoff(
    legs: list,  # List of option positions
    spot_range: tuple = None,
    S: float = None
) -> dict:
    """
    Calculate strategy payoff diagram.
    
    Each leg: {'type': 'call'/'put', 'strike': K, 'premium': p, 'position': 'long'/'short', 'quantity': n}
    """
    if spot_range is None:
        strikes = [leg['strike'] for leg in legs]
        spot_range = (min(strikes) * 0.8, max(strikes) * 1.2)
    
    spots = np.linspace(spot_range[0], spot_range[1], 100)
    payoffs = np.zeros_like(spots)
    
    total_premium = 0
    
    for leg in legs:
        K = leg['strike']
        premium = leg['premium']
        qty = leg.get('quantity', 1)
        multiplier = 1 if leg['position'] == 'long' else -1
        
        if leg['type'] == 'call':
            leg_payoff = np.maximum(spots - K, 0) - premium
        else:  # put
            leg_payoff = np.maximum(K - spots, 0) - premium
        
        payoffs += multiplier * qty * leg_payoff
        total_premium += multiplier * qty * premium
    
    # Calculate key metrics
    max_profit = np.max(payoffs)
    max_loss = np.min(payoffs)
    breakeven = spots[np.argmin(np.abs(payoffs))]
    
    return {
        'spots': spots.tolist(),
        'payoffs': payoffs.tolist(),
        'max_profit': max_profit,
        'max_loss': max_loss,
        'breakeven': breakeven,
        'net_premium': -total_premium
    }

# Common Strategies
def bull_call_spread(S: float, K1: float, K2: float, premium1: float, premium2: float) -> dict:
    """Bull call spread: Long lower strike call, short higher strike call."""
    return strategy_payoff([
        {'type': 'call', 'strike': K1, 'premium': premium1, 'position': 'long'},
        {'type': 'call', 'strike': K2, 'premium': premium2, 'position': 'short'}
    ], S=S)

def iron_condor(K1: float, K2: float, K3: float, K4: float, 
               p1: float, p2: float, p3: float, p4: float) -> dict:
    """Iron condor: Short strangle inside, long strangle outside."""
    return strategy_payoff([
        {'type': 'put', 'strike': K1, 'premium': p1, 'position': 'long'},
        {'type': 'put', 'strike': K2, 'premium': p2, 'position': 'short'},
        {'type': 'call', 'strike': K3, 'premium': p3, 'position': 'short'},
        {'type': 'call', 'strike': K4, 'premium': p4, 'position': 'long'}
    ])

def straddle(K: float, call_premium: float, put_premium: float, position: str = 'long') -> dict:
    """Straddle: Long/short both call and put at same strike."""
    return strategy_payoff([
        {'type': 'call', 'strike': K, 'premium': call_premium, 'position': position},
        {'type': 'put', 'strike': K, 'premium': put_premium, 'position': position}
    ])

def strangle(K_put: float, K_call: float, put_premium: float, call_premium: float, 
             position: str = 'long') -> dict:
    """Strangle: Long/short OTM call and OTM put."""
    return strategy_payoff([
        {'type': 'put', 'strike': K_put, 'premium': put_premium, 'position': position},
        {'type': 'call', 'strike': K_call, 'premium': call_premium, 'position': position}
    ])

def butterfly(K1: float, K2: float, K3: float, p1: float, p2: float, p3: float) -> dict:
    """Butterfly spread with calls."""
    return strategy_payoff([
        {'type': 'call', 'strike': K1, 'premium': p1, 'position': 'long'},
        {'type': 'call', 'strike': K2, 'premium': p2, 'position': 'short', 'quantity': 2},
        {'type': 'call', 'strike': K3, 'premium': p3, 'position': 'long'}
    ])
```

### 7. Position Greeks Aggregation

```python
def aggregate_position_greeks(positions: list, S: float, r: float) -> dict:
    """
    Calculate aggregate Greeks for a portfolio of options.
    
    Each position: {'type', 'strike', 'expiry', 'sigma', 'quantity', 'position'}
    """
    total_greeks = {
        'delta': 0, 'gamma': 0, 'vega': 0, 'theta': 0, 'rho': 0
    }
    
    for pos in positions:
        greeks = black_scholes(
            S=S,
            K=pos['strike'],
            T=pos['expiry'],
            r=r,
            sigma=pos['sigma'],
            option_type=pos['type']
        )
        
        multiplier = pos['quantity'] * (1 if pos['position'] == 'long' else -1)
        
        total_greeks['delta'] += greeks['delta'] * multiplier * 100  # Per contract
        total_greeks['gamma'] += greeks['gamma'] * multiplier * 100
        total_greeks['vega'] += greeks['vega'] * multiplier * 100
        total_greeks['theta'] += greeks['theta'] * multiplier * 100
        total_greeks['rho'] += greeks['rho'] * multiplier * 100
    
    return total_greeks
```

## Installation

```bash
pip install numpy scipy pandas yfinance
```

## Best Practices

1. **Model Selection**: Use Black-Scholes for European, binomial for American options
2. **Volatility**: Use implied vol for pricing, historical for risk
3. **Greeks Management**: Monitor delta for directional risk, gamma for convexity
4. **Time Decay**: Theta accelerates near expiration
5. **Liquidity**: Check bid-ask spreads before trading
