---
name: 加密货币分析
visibility: showcase
tags: 加密货币, DeFi
description: 加密货币分析，包括链上指标、DeFi 分析、代币分析和区块链数据。当用户需要分析加密资产、DeFi 协议、NFT、链上数据或区块链指标时使用。
---

# Crypto Analysis

## Overview

Comprehensive cryptocurrency analysis toolkit covering on-chain metrics, DeFi analytics, token fundamentals, and market analysis.

## Core Analysis Functions

### 1. Price and Market Data

```python
import pandas as pd
import numpy as np
import requests
from datetime import datetime, timedelta

def get_crypto_price(
    symbol: str,
    vs_currency: str = 'usd',
    days: int = 365
) -> pd.DataFrame:
    """
    Fetch historical price data from CoinGecko.
    """
    url = f"https://api.coingecko.com/api/v3/coins/{symbol}/market_chart"
    params = {'vs_currency': vs_currency, 'days': days}
    
    response = requests.get(url, params=params)
    data = response.json()
    
    df = pd.DataFrame(data['prices'], columns=['timestamp', 'price'])
    df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
    df.set_index('timestamp', inplace=True)
    
    if 'total_volumes' in data:
        volumes = pd.DataFrame(data['total_volumes'], columns=['timestamp', 'volume'])
        volumes['timestamp'] = pd.to_datetime(volumes['timestamp'], unit='ms')
        volumes.set_index('timestamp', inplace=True)
        df['volume'] = volumes['volume']
    
    if 'market_caps' in data:
        mcaps = pd.DataFrame(data['market_caps'], columns=['timestamp', 'market_cap'])
        mcaps['timestamp'] = pd.to_datetime(mcaps['timestamp'], unit='ms')
        mcaps.set_index('timestamp', inplace=True)
        df['market_cap'] = mcaps['market_cap']
    
    return df

def get_crypto_info(symbol: str) -> dict:
    """Get comprehensive crypto asset information."""
    url = f"https://api.coingecko.com/api/v3/coins/{symbol}"
    params = {
        'localization': 'false',
        'tickers': 'false',
        'market_data': 'true',
        'community_data': 'true',
        'developer_data': 'true'
    }
    
    response = requests.get(url, params=params)
    return response.json()

def crypto_market_overview() -> pd.DataFrame:
    """Get top cryptocurrencies by market cap."""
    url = "https://api.coingecko.com/api/v3/coins/markets"
    params = {
        'vs_currency': 'usd',
        'order': 'market_cap_desc',
        'per_page': 100,
        'sparkline': 'false'
    }
    
    response = requests.get(url, params=params)
    df = pd.DataFrame(response.json())
    
    return df[['id', 'symbol', 'name', 'current_price', 'market_cap', 
               'total_volume', 'price_change_percentage_24h', 
               'market_cap_rank']]
```

### 2. On-Chain Metrics

```python
def get_bitcoin_onchain_metrics() -> dict:
    """
    Fetch Bitcoin on-chain metrics.
    Note: Requires API key for production use (Glassnode, CryptoQuant, etc.)
    """
    # Placeholder - implement with your preferred data provider
    # Example metrics structure:
    return {
        'active_addresses': None,
        'transaction_count': None,
        'hash_rate': None,
        'difficulty': None,
        'fees_usd': None,
        'miner_revenue': None,
        'exchange_inflow': None,
        'exchange_outflow': None,
        'exchange_reserve': None,
        'nvt_ratio': None,
        'mvrv_ratio': None,
        'puell_multiple': None,
        'sopr': None  # Spent Output Profit Ratio
    }

def calculate_nvt_ratio(
    market_cap: float,
    transaction_volume_usd: float
) -> float:
    """
    Network Value to Transactions Ratio.
    High NVT (>90): Potentially overvalued
    Low NVT (<50): Potentially undervalued
    """
    return market_cap / transaction_volume_usd if transaction_volume_usd > 0 else None

def calculate_mvrv_ratio(
    market_cap: float,
    realized_cap: float
) -> float:
    """
    Market Value to Realized Value Ratio.
    MVRV > 3.5: Market top territory
    MVRV < 1: Market bottom territory
    """
    return market_cap / realized_cap if realized_cap > 0 else None

def holder_distribution_analysis(holders_data: dict) -> dict:
    """
    Analyze token holder distribution.
    """
    total_supply = holders_data.get('total_supply', 0)
    
    # Whale concentration
    top_10_holdings = holders_data.get('top_10_holdings', 0)
    top_100_holdings = holders_data.get('top_100_holdings', 0)
    
    whale_concentration = top_10_holdings / total_supply if total_supply > 0 else 0
    
    return {
        'total_holders': holders_data.get('total_holders', 0),
        'top_10_concentration': whale_concentration,
        'top_100_concentration': top_100_holdings / total_supply if total_supply > 0 else 0,
        'risk_level': 'High' if whale_concentration > 0.5 else 'Medium' if whale_concentration > 0.3 else 'Low'
    }
```

### 3. DeFi Analytics

```python
def get_defi_tvl(protocol: str = None) -> dict:
    """
    Fetch DeFi TVL data from DeFiLlama.
    """
    if protocol:
        url = f"https://api.llama.fi/protocol/{protocol}"
    else:
        url = "https://api.llama.fi/protocols"
    
    response = requests.get(url)
    return response.json()

def defi_protocol_analysis(protocol_data: dict) -> dict:
    """
    Analyze DeFi protocol metrics.
    """
    tvl = protocol_data.get('tvl', 0)
    mcap = protocol_data.get('mcap', 0)
    
    # TVL to Market Cap ratio
    tvl_mcap_ratio = tvl / mcap if mcap > 0 else None
    
    return {
        'tvl': tvl,
        'market_cap': mcap,
        'tvl_mcap_ratio': tvl_mcap_ratio,
        'category': protocol_data.get('category', 'Unknown'),
        'chains': protocol_data.get('chains', []),
        'tvl_change_7d': protocol_data.get('change_7d', 0),
        'valuation': 'Undervalued' if tvl_mcap_ratio and tvl_mcap_ratio > 1 else 'Fair' if tvl_mcap_ratio and tvl_mcap_ratio > 0.5 else 'Overvalued'
    }

def yield_analysis(
    apy: float,
    tvl: float,
    token_price_change_30d: float,
    il_risk: str = 'low'
) -> dict:
    """
    Analyze DeFi yield opportunity.
    """
    # Adjust APY for impermanent loss risk
    il_factor = {'low': 1.0, 'medium': 0.85, 'high': 0.7}
    adjusted_apy = apy * il_factor.get(il_risk, 1.0)
    
    # Risk score (simplified)
    risk_score = 0
    if apy > 100:
        risk_score += 3  # Very high APY = high risk
    elif apy > 50:
        risk_score += 2
    elif apy > 20:
        risk_score += 1
    
    if tvl < 1_000_000:
        risk_score += 2  # Low TVL = higher risk
    elif tvl < 10_000_000:
        risk_score += 1
    
    return {
        'raw_apy': apy,
        'adjusted_apy': adjusted_apy,
        'tvl': tvl,
        'impermanent_loss_risk': il_risk,
        'risk_score': risk_score,  # 0-5 scale
        'risk_level': 'High' if risk_score >= 4 else 'Medium' if risk_score >= 2 else 'Low'
    }

def calculate_impermanent_loss(
    price_ratio_change: float
) -> float:
    """
    Calculate impermanent loss for a 50/50 LP position.
    
    Args:
        price_ratio_change: Ratio of new price to original price
    
    Returns:
        Impermanent loss as a decimal (negative = loss)
    """
    r = price_ratio_change
    il = 2 * np.sqrt(r) / (1 + r) - 1
    return il

def il_scenarios() -> dict:
    """Show IL for common price scenarios."""
    scenarios = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0, 5.0]
    return {
        f"{s}x": f"{calculate_impermanent_loss(s):.2%}"
        for s in scenarios
    }
```

### 4. Token Analysis

```python
def token_metrics_analysis(token_data: dict) -> dict:
    """
    Comprehensive token metrics analysis.
    """
    total_supply = token_data.get('total_supply', 0)
    circulating_supply = token_data.get('circulating_supply', 0)
    max_supply = token_data.get('max_supply', total_supply)
    
    # Fully Diluted Valuation
    price = token_data.get('price', 0)
    fdv = price * max_supply
    market_cap = price * circulating_supply
    
    # Supply metrics
    circulating_ratio = circulating_supply / max_supply if max_supply > 0 else 0
    
    return {
        'price': price,
        'market_cap': market_cap,
        'fdv': fdv,
        'mcap_fdv_ratio': market_cap / fdv if fdv > 0 else 0,
        'circulating_supply': circulating_supply,
        'max_supply': max_supply,
        'circulating_ratio': circulating_ratio,
        'inflation_risk': 'High' if circulating_ratio < 0.3 else 'Medium' if circulating_ratio < 0.6 else 'Low'
    }

def token_unlock_analysis(unlock_schedule: list) -> dict:
    """
    Analyze token unlock schedule.
    
    unlock_schedule: [{'date': '2024-01-01', 'amount': 1000000, 'type': 'team'}, ...]
    """
    df = pd.DataFrame(unlock_schedule)
    df['date'] = pd.to_datetime(df['date'])
    
    # Next 30 days unlocks
    today = datetime.now()
    next_30_days = today + timedelta(days=30)
    
    upcoming = df[(df['date'] >= today) & (df['date'] <= next_30_days)]
    upcoming_amount = upcoming['amount'].sum()
    
    # Next 90 days unlocks
    next_90_days = today + timedelta(days=90)
    upcoming_90 = df[(df['date'] >= today) & (df['date'] <= next_90_days)]
    
    return {
        'total_locked': df[df['date'] > today]['amount'].sum(),
        'unlock_next_30_days': upcoming_amount,
        'unlock_next_90_days': upcoming_90['amount'].sum(),
        'upcoming_unlocks': upcoming.to_dict('records'),
        'sell_pressure_risk': 'High' if upcoming_amount > 0 else 'Low'
    }
```

### 5. Technical Analysis for Crypto

```python
def crypto_technical_analysis(df: pd.DataFrame) -> dict:
    """
    Technical analysis specific to crypto (includes crypto-specific indicators).
    """
    close = df['price']
    
    # Standard indicators
    df['sma_50'] = close.rolling(50).mean()
    df['sma_200'] = close.rolling(200).mean()
    df['rsi_14'] = calculate_rsi(close, 14)
    
    # Crypto-specific: Fear & Greed consideration
    volatility_30d = close.pct_change().rolling(30).std() * np.sqrt(365)
    
    # Price vs ATH
    ath = close.max()
    current_price = close.iloc[-1]
    distance_from_ath = (current_price - ath) / ath
    
    # Golden/Death cross
    golden_cross = (df['sma_50'].iloc[-1] > df['sma_200'].iloc[-1]) and \
                   (df['sma_50'].iloc[-2] <= df['sma_200'].iloc[-2])
    death_cross = (df['sma_50'].iloc[-1] < df['sma_200'].iloc[-1]) and \
                  (df['sma_50'].iloc[-2] >= df['sma_200'].iloc[-2])
    
    return {
        'current_price': current_price,
        'ath': ath,
        'distance_from_ath': distance_from_ath,
        'rsi': df['rsi_14'].iloc[-1],
        'trend': 'Bullish' if df['sma_50'].iloc[-1] > df['sma_200'].iloc[-1] else 'Bearish',
        'golden_cross': golden_cross,
        'death_cross': death_cross,
        'volatility_30d': volatility_30d.iloc[-1],
        'overbought': df['rsi_14'].iloc[-1] > 70,
        'oversold': df['rsi_14'].iloc[-1] < 30
    }

def calculate_rsi(prices: pd.Series, period: int = 14) -> pd.Series:
    """Calculate RSI for crypto."""
    delta = prices.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    rs = gain / loss
    return 100 - (100 / (1 + rs))
```

### 6. Correlation Analysis

```python
def crypto_correlation_matrix(
    symbols: list,
    days: int = 90
) -> pd.DataFrame:
    """
    Calculate correlation matrix for multiple cryptocurrencies.
    """
    prices = {}
    
    for symbol in symbols:
        try:
            df = get_crypto_price(symbol, days=days)
            prices[symbol] = df['price']
        except:
            continue
    
    price_df = pd.DataFrame(prices)
    returns_df = price_df.pct_change().dropna()
    
    return returns_df.corr()

def btc_correlation(
    alt_returns: pd.Series,
    btc_returns: pd.Series
) -> dict:
    """
    Analyze altcoin correlation with Bitcoin.
    """
    correlation = alt_returns.corr(btc_returns)
    beta = alt_returns.cov(btc_returns) / btc_returns.var()
    
    # Rolling correlation
    rolling_corr = alt_returns.rolling(30).corr(btc_returns)
    
    return {
        'correlation': correlation,
        'beta': beta,
        'interpretation': 'High correlation' if correlation > 0.7 else 'Medium' if correlation > 0.4 else 'Low correlation',
        'rolling_corr_current': rolling_corr.iloc[-1],
        'rolling_corr_min': rolling_corr.min(),
        'rolling_corr_max': rolling_corr.max()
    }
```

### 7. Risk Assessment

```python
def crypto_risk_score(token_data: dict) -> dict:
    """
    Calculate comprehensive risk score for a cryptocurrency.
    """
    risk_factors = {}
    total_score = 0
    max_score = 0
    
    # Market cap risk (larger = safer)
    mcap = token_data.get('market_cap', 0)
    if mcap < 10_000_000:
        risk_factors['market_cap'] = {'score': 5, 'level': 'Very High'}
        total_score += 5
    elif mcap < 100_000_000:
        risk_factors['market_cap'] = {'score': 4, 'level': 'High'}
        total_score += 4
    elif mcap < 1_000_000_000:
        risk_factors['market_cap'] = {'score': 2, 'level': 'Medium'}
        total_score += 2
    else:
        risk_factors['market_cap'] = {'score': 1, 'level': 'Low'}
        total_score += 1
    max_score += 5
    
    # Age risk (older = safer)
    age_days = token_data.get('age_days', 0)
    if age_days < 90:
        risk_factors['age'] = {'score': 5, 'level': 'Very High'}
        total_score += 5
    elif age_days < 365:
        risk_factors['age'] = {'score': 3, 'level': 'Medium'}
        total_score += 3
    else:
        risk_factors['age'] = {'score': 1, 'level': 'Low'}
        total_score += 1
    max_score += 5
    
    # Holder concentration risk
    top_10_concentration = token_data.get('top_10_concentration', 0)
    if top_10_concentration > 0.5:
        risk_factors['concentration'] = {'score': 5, 'level': 'Very High'}
        total_score += 5
    elif top_10_concentration > 0.3:
        risk_factors['concentration'] = {'score': 3, 'level': 'Medium'}
        total_score += 3
    else:
        risk_factors['concentration'] = {'score': 1, 'level': 'Low'}
        total_score += 1
    max_score += 5
    
    # Volatility risk
    volatility = token_data.get('volatility_30d', 0)
    if volatility > 1.5:  # 150% annualized
        risk_factors['volatility'] = {'score': 5, 'level': 'Very High'}
        total_score += 5
    elif volatility > 0.8:
        risk_factors['volatility'] = {'score': 3, 'level': 'Medium'}
        total_score += 3
    else:
        risk_factors['volatility'] = {'score': 1, 'level': 'Low'}
        total_score += 1
    max_score += 5
    
    # Overall risk score (0-100)
    overall_risk = (total_score / max_score) * 100
    
    return {
        'overall_risk_score': overall_risk,
        'risk_level': 'Very High' if overall_risk > 80 else 'High' if overall_risk > 60 else 'Medium' if overall_risk > 40 else 'Low',
        'risk_factors': risk_factors,
        'recommendation': 'Avoid' if overall_risk > 80 else 'Caution' if overall_risk > 60 else 'Moderate Position' if overall_risk > 40 else 'Consider'
    }
```

## Installation

```bash
pip install pandas numpy requests web3 python-dotenv
```

## API Sources

- **Price Data**: CoinGecko (free), CoinMarketCap
- **On-Chain**: Glassnode, CryptoQuant, Nansen
- **DeFi**: DeFiLlama, DeBank
- **NFT**: OpenSea API, Reservoir

## Best Practices

1. **DYOR**: Always verify smart contract addresses
2. **Risk Management**: Size positions based on risk score
3. **Diversification**: Don't concentrate in single token
4. **On-Chain Verification**: Check contract on block explorer
5. **Liquidity**: Ensure sufficient exit liquidity before entering
