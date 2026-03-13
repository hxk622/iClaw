---
name: 股票技术分析
visibility: showcase
tags: 金融, 技术分析
description: |
  股票技术分析和指标计算。触发场景：
  - "技术面怎么看" / "从图表上分析一下"
  - "RSI 多少" / "MACD 金叉了吗" / "均线怎么排列"
  - "支撑位阻力位在哪" / "布林带位置"
  - "超买还是超卖" / "有没有背离"
  - "画个 K 线图" / "技术信号是什么"
  包括 MA/EMA、RSI、MACD、布林带、KDJ、ATR、ADX、OBV、斐波那契。
  与 equity-research 的区别：本技能专注技术面；equity-research 侧重基本面和投资建议。
---

# Stock Technical Analysis

## Overview

Comprehensive technical analysis toolkit for calculating indicators, identifying patterns, and generating trading signals.

## Core Indicators

### 1. Moving Averages

```python
import pandas as pd
import numpy as np

def calculate_sma(prices: pd.Series, window: int) -> pd.Series:
    """Simple Moving Average"""
    return prices.rolling(window=window).mean()

def calculate_ema(prices: pd.Series, span: int) -> pd.Series:
    """Exponential Moving Average"""
    return prices.ewm(span=span, adjust=False).mean()

def calculate_wma(prices: pd.Series, window: int) -> pd.Series:
    """Weighted Moving Average"""
    weights = np.arange(1, window + 1)
    return prices.rolling(window).apply(lambda x: np.dot(x, weights) / weights.sum())

def calculate_vwap(df: pd.DataFrame) -> pd.Series:
    """Volume Weighted Average Price"""
    typical_price = (df['High'] + df['Low'] + df['Close']) / 3
    return (typical_price * df['Volume']).cumsum() / df['Volume'].cumsum()

# Moving Average Crossover Signal
def ma_crossover_signal(prices: pd.Series, fast: int = 12, slow: int = 26) -> pd.Series:
    """Generate buy/sell signals from MA crossover"""
    fast_ma = calculate_ema(prices, fast)
    slow_ma = calculate_ema(prices, slow)
    
    signal = pd.Series(0, index=prices.index)
    signal[fast_ma > slow_ma] = 1   # Buy
    signal[fast_ma < slow_ma] = -1  # Sell
    
    # Only return crossover points
    return signal.diff().fillna(0)
```

### 2. RSI (Relative Strength Index)

```python
def calculate_rsi(prices: pd.Series, period: int = 14) -> pd.Series:
    """
    Calculate RSI indicator.
    RSI > 70: Overbought
    RSI < 30: Oversold
    """
    delta = prices.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    
    rs = gain / loss
    rsi = 100 - (100 / (1 + rs))
    return rsi

def rsi_divergence(prices: pd.Series, rsi: pd.Series, lookback: int = 14) -> dict:
    """
    Detect RSI divergence.
    Bullish: Price makes lower low, RSI makes higher low
    Bearish: Price makes higher high, RSI makes lower high
    """
    price_min = prices.rolling(lookback).min()
    price_max = prices.rolling(lookback).max()
    rsi_min = rsi.rolling(lookback).min()
    rsi_max = rsi.rolling(lookback).max()
    
    bullish_div = (prices == price_min) & (rsi > rsi_min.shift(lookback))
    bearish_div = (prices == price_max) & (rsi < rsi_max.shift(lookback))
    
    return {'bullish': bullish_div, 'bearish': bearish_div}
```

### 3. MACD (Moving Average Convergence Divergence)

```python
def calculate_macd(
    prices: pd.Series,
    fast: int = 12,
    slow: int = 26,
    signal: int = 9
) -> pd.DataFrame:
    """
    Calculate MACD indicator.
    Returns: MACD line, Signal line, Histogram
    """
    fast_ema = prices.ewm(span=fast, adjust=False).mean()
    slow_ema = prices.ewm(span=slow, adjust=False).mean()
    
    macd_line = fast_ema - slow_ema
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    histogram = macd_line - signal_line
    
    return pd.DataFrame({
        'macd': macd_line,
        'signal': signal_line,
        'histogram': histogram
    })

def macd_signal(macd_df: pd.DataFrame) -> pd.Series:
    """Generate MACD crossover signals"""
    signal = pd.Series(0, index=macd_df.index)
    
    # Bullish crossover (MACD crosses above signal)
    signal[(macd_df['macd'] > macd_df['signal']) & 
           (macd_df['macd'].shift(1) <= macd_df['signal'].shift(1))] = 1
    
    # Bearish crossover (MACD crosses below signal)
    signal[(macd_df['macd'] < macd_df['signal']) & 
           (macd_df['macd'].shift(1) >= macd_df['signal'].shift(1))] = -1
    
    return signal
```

### 4. Bollinger Bands

```python
def calculate_bollinger_bands(
    prices: pd.Series,
    window: int = 20,
    num_std: float = 2.0
) -> pd.DataFrame:
    """
    Calculate Bollinger Bands.
    """
    middle = prices.rolling(window=window).mean()
    std = prices.rolling(window=window).std()
    
    upper = middle + (std * num_std)
    lower = middle - (std * num_std)
    
    # %B indicator: (Price - Lower) / (Upper - Lower)
    percent_b = (prices - lower) / (upper - lower)
    
    # Bandwidth: (Upper - Lower) / Middle
    bandwidth = (upper - lower) / middle
    
    return pd.DataFrame({
        'middle': middle,
        'upper': upper,
        'lower': lower,
        'percent_b': percent_b,
        'bandwidth': bandwidth
    })

def bollinger_squeeze(bb_df: pd.DataFrame, threshold: float = 0.05) -> pd.Series:
    """Detect Bollinger Band squeeze (low volatility)"""
    return bb_df['bandwidth'] < threshold
```

### 5. Stochastic Oscillator

```python
def calculate_stochastic(
    df: pd.DataFrame,
    k_period: int = 14,
    d_period: int = 3
) -> pd.DataFrame:
    """
    Calculate Stochastic Oscillator.
    %K > 80: Overbought
    %K < 20: Oversold
    """
    lowest_low = df['Low'].rolling(window=k_period).min()
    highest_high = df['High'].rolling(window=k_period).max()
    
    stoch_k = 100 * (df['Close'] - lowest_low) / (highest_high - lowest_low)
    stoch_d = stoch_k.rolling(window=d_period).mean()
    
    return pd.DataFrame({
        'stoch_k': stoch_k,
        'stoch_d': stoch_d
    })
```

### 6. ATR (Average True Range)

```python
def calculate_atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    """
    Calculate Average True Range for volatility measurement.
    """
    high_low = df['High'] - df['Low']
    high_close = abs(df['High'] - df['Close'].shift())
    low_close = abs(df['Low'] - df['Close'].shift())
    
    true_range = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
    atr = true_range.rolling(window=period).mean()
    
    return atr

def calculate_atr_percent(df: pd.DataFrame, period: int = 14) -> pd.Series:
    """ATR as percentage of price"""
    atr = calculate_atr(df, period)
    return (atr / df['Close']) * 100
```

### 7. ADX (Average Directional Index)

```python
def calculate_adx(df: pd.DataFrame, period: int = 14) -> pd.DataFrame:
    """
    Calculate ADX for trend strength.
    ADX > 25: Strong trend
    ADX < 20: Weak trend / Ranging
    """
    # +DM and -DM
    plus_dm = df['High'].diff()
    minus_dm = -df['Low'].diff()
    
    plus_dm[plus_dm < 0] = 0
    minus_dm[minus_dm < 0] = 0
    
    # When both are positive, take the larger one
    plus_dm[(plus_dm > 0) & (minus_dm > 0) & (plus_dm <= minus_dm)] = 0
    minus_dm[(plus_dm > 0) & (minus_dm > 0) & (minus_dm <= plus_dm)] = 0
    
    # True Range
    tr = calculate_atr(df, 1) * df.shape[0]  # Unaveraged
    atr = calculate_atr(df, period)
    
    # Smoothed +DI and -DI
    plus_di = 100 * (plus_dm.rolling(period).mean() / atr)
    minus_di = 100 * (minus_dm.rolling(period).mean() / atr)
    
    # DX and ADX
    dx = 100 * abs(plus_di - minus_di) / (plus_di + minus_di)
    adx = dx.rolling(period).mean()
    
    return pd.DataFrame({
        'plus_di': plus_di,
        'minus_di': minus_di,
        'adx': adx
    })
```

### 8. Volume Indicators

```python
def calculate_obv(df: pd.DataFrame) -> pd.Series:
    """On-Balance Volume"""
    obv = pd.Series(0.0, index=df.index)
    
    for i in range(1, len(df)):
        if df['Close'].iloc[i] > df['Close'].iloc[i-1]:
            obv.iloc[i] = obv.iloc[i-1] + df['Volume'].iloc[i]
        elif df['Close'].iloc[i] < df['Close'].iloc[i-1]:
            obv.iloc[i] = obv.iloc[i-1] - df['Volume'].iloc[i]
        else:
            obv.iloc[i] = obv.iloc[i-1]
    
    return obv

def calculate_mfi(df: pd.DataFrame, period: int = 14) -> pd.Series:
    """Money Flow Index (Volume-weighted RSI)"""
    typical_price = (df['High'] + df['Low'] + df['Close']) / 3
    raw_money_flow = typical_price * df['Volume']
    
    positive_flow = raw_money_flow.where(typical_price > typical_price.shift(1), 0)
    negative_flow = raw_money_flow.where(typical_price < typical_price.shift(1), 0)
    
    positive_mf = positive_flow.rolling(period).sum()
    negative_mf = negative_flow.rolling(period).sum()
    
    mfi = 100 - (100 / (1 + positive_mf / negative_mf))
    return mfi
```

### 9. Fibonacci Retracement

```python
def calculate_fibonacci_levels(high: float, low: float) -> dict:
    """
    Calculate Fibonacci retracement levels.
    """
    diff = high - low
    
    levels = {
        '0%': high,
        '23.6%': high - diff * 0.236,
        '38.2%': high - diff * 0.382,
        '50%': high - diff * 0.5,
        '61.8%': high - diff * 0.618,
        '78.6%': high - diff * 0.786,
        '100%': low
    }
    
    # Extension levels
    levels['161.8%'] = low - diff * 0.618
    levels['261.8%'] = low - diff * 1.618
    
    return levels

def auto_fibonacci(df: pd.DataFrame, lookback: int = 50) -> dict:
    """Auto-detect swing high/low and calculate Fibonacci"""
    recent = df.tail(lookback)
    high = recent['High'].max()
    low = recent['Low'].min()
    
    return calculate_fibonacci_levels(high, low)
```

### 10. Complete Technical Analysis Function

```python
def full_technical_analysis(df: pd.DataFrame) -> pd.DataFrame:
    """
    Apply all technical indicators to a DataFrame.
    
    Args:
        df: DataFrame with OHLCV columns
    
    Returns:
        DataFrame with all indicators added
    """
    result = df.copy()
    
    # Moving Averages
    for period in [5, 10, 20, 50, 200]:
        result[f'sma_{period}'] = calculate_sma(df['Close'], period)
        result[f'ema_{period}'] = calculate_ema(df['Close'], period)
    
    # RSI
    result['rsi_14'] = calculate_rsi(df['Close'], 14)
    
    # MACD
    macd = calculate_macd(df['Close'])
    result = pd.concat([result, macd], axis=1)
    
    # Bollinger Bands
    bb = calculate_bollinger_bands(df['Close'])
    result = pd.concat([result, bb.add_prefix('bb_')], axis=1)
    
    # Stochastic
    stoch = calculate_stochastic(df)
    result = pd.concat([result, stoch], axis=1)
    
    # ATR
    result['atr_14'] = calculate_atr(df, 14)
    result['atr_pct'] = calculate_atr_percent(df, 14)
    
    # ADX
    adx = calculate_adx(df)
    result = pd.concat([result, adx], axis=1)
    
    # Volume
    result['obv'] = calculate_obv(df)
    result['mfi_14'] = calculate_mfi(df, 14)
    result['vwap'] = calculate_vwap(df)
    
    return result

# Usage
# import yfinance as yf
# df = yf.download('AAPL', period='1y')
# analysis = full_technical_analysis(df)
```

## Signal Generation

```python
def generate_composite_signal(df: pd.DataFrame) -> pd.Series:
    """
    Generate composite trading signal based on multiple indicators.
    Returns: -2 (Strong Sell) to +2 (Strong Buy)
    """
    signal = pd.Series(0.0, index=df.index)
    
    # RSI signals
    signal[df['rsi_14'] < 30] += 1   # Oversold = buy
    signal[df['rsi_14'] > 70] -= 1   # Overbought = sell
    
    # MACD signals
    signal[df['macd'] > df['signal']] += 0.5
    signal[df['macd'] < df['signal']] -= 0.5
    
    # MA crossover
    signal[df['ema_20'] > df['ema_50']] += 0.5
    signal[df['ema_20'] < df['ema_50']] -= 0.5
    
    # Bollinger Bands
    signal[df['Close'] < df['bb_lower']] += 0.5
    signal[df['Close'] > df['bb_upper']] -= 0.5
    
    # Trend strength (ADX)
    strong_trend = df['adx'] > 25
    signal[strong_trend] *= 1.5  # Amplify signals in strong trends
    
    return signal.clip(-2, 2)
```

## Installation

```bash
pip install pandas numpy yfinance ta-lib matplotlib plotly
```

## Best Practices

1. **Multiple Timeframes**: Confirm signals across different timeframes
2. **Volume Confirmation**: Validate price moves with volume
3. **Trend Context**: Use ADX to identify trending vs ranging markets
4. **Divergence**: Watch for indicator-price divergences
5. **Support/Resistance**: Combine with key price levels
