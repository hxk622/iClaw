---
name: 金融仪表板
visibility: showcase
tags: 金融, 可视化
description: |
  构建金融数据仪表板和可视化。触发场景：
  - "做个股票仪表板" / "帮我搭个投资看板"
  - "可视化我的持仓" / "做个 portfolio tracker"
  - "实时显示股价" / "做个行情监控页面"
  - "KPI 面板" / "财务数据大屏"
  包括 Plotly/Dash 图表、数据表格、KPI 卡片、实时刷新。
  与 d3-visualization 的区别：本技能专注金融场景；d3 更通用。
  与 stock-technical-analysis 的区别：本技能侧重展示层；technical-analysis 侧重指标计算。
---

# Financial Dashboard Builder

## Overview

Create professional financial dashboards with interactive charts, data tables, KPIs, and real-time updates using Python visualization libraries.

## Core Components

### 1. Dashboard Layout with Plotly Dash

```python
import dash
from dash import dcc, html, dash_table
from dash.dependencies import Input, Output
import plotly.graph_objects as go
import plotly.express as px
import pandas as pd

def create_financial_dashboard(title: str = "Financial Dashboard"):
    """Create a basic financial dashboard structure."""
    app = dash.Dash(__name__)
    
    app.layout = html.Div([
        # Header
        html.H1(title, style={'textAlign': 'center', 'color': '#2c3e50'}),
        
        # KPI Cards Row
        html.Div([
            html.Div([
                html.H3("Portfolio Value", style={'color': '#7f8c8d'}),
                html.H2(id='portfolio-value', style={'color': '#27ae60'})
            ], className='kpi-card'),
            html.Div([
                html.H3("Daily P&L", style={'color': '#7f8c8d'}),
                html.H2(id='daily-pnl')
            ], className='kpi-card'),
            html.Div([
                html.H3("Total Return", style={'color': '#7f8c8d'}),
                html.H2(id='total-return')
            ], className='kpi-card'),
        ], style={'display': 'flex', 'justifyContent': 'space-around'}),
        
        # Charts Row
        html.Div([
            dcc.Graph(id='portfolio-chart', style={'width': '60%'}),
            dcc.Graph(id='allocation-chart', style={'width': '40%'}),
        ], style={'display': 'flex'}),
        
        # Holdings Table
        html.Div([
            html.H3("Holdings"),
            dash_table.DataTable(id='holdings-table')
        ]),
        
        # Auto-refresh
        dcc.Interval(id='interval-component', interval=60*1000, n_intervals=0)
    ])
    
    return app

# Usage
# app = create_financial_dashboard()
# app.run_server(debug=True)
```

### 2. Interactive Stock Charts

```python
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import pandas as pd
import yfinance as yf

def create_stock_chart(
    symbol: str,
    period: str = "1y",
    show_volume: bool = True,
    show_ma: list = [20, 50, 200]
) -> go.Figure:
    """
    Create interactive candlestick chart with technical indicators.
    """
    # Fetch data
    stock = yf.Ticker(symbol)
    df = stock.history(period=period)
    
    # Create figure with secondary y-axis
    fig = make_subplots(
        rows=2 if show_volume else 1, 
        cols=1,
        shared_xaxes=True,
        vertical_spacing=0.03,
        row_heights=[0.7, 0.3] if show_volume else [1]
    )
    
    # Candlestick
    fig.add_trace(
        go.Candlestick(
            x=df.index,
            open=df['Open'],
            high=df['High'],
            low=df['Low'],
            close=df['Close'],
            name='OHLC'
        ),
        row=1, col=1
    )
    
    # Moving Averages
    colors = ['#3498db', '#e74c3c', '#9b59b6']
    for i, ma in enumerate(show_ma):
        df[f'MA{ma}'] = df['Close'].rolling(window=ma).mean()
        fig.add_trace(
            go.Scatter(
                x=df.index,
                y=df[f'MA{ma}'],
                name=f'MA{ma}',
                line=dict(color=colors[i % len(colors)], width=1)
            ),
            row=1, col=1
        )
    
    # Volume
    if show_volume:
        colors = ['red' if row['Open'] > row['Close'] else 'green' 
                  for _, row in df.iterrows()]
        fig.add_trace(
            go.Bar(x=df.index, y=df['Volume'], name='Volume', marker_color=colors),
            row=2, col=1
        )
    
    fig.update_layout(
        title=f'{symbol} Stock Chart',
        xaxis_rangeslider_visible=False,
        template='plotly_white',
        height=600
    )
    
    return fig

# Usage
# fig = create_stock_chart('AAPL', period='6mo')
# fig.show()
```

### 3. Portfolio Performance Dashboard

```python
def create_portfolio_performance_chart(
    portfolio_df: pd.DataFrame,
    benchmark_df: pd.DataFrame = None
) -> go.Figure:
    """
    Create portfolio performance chart with benchmark comparison.
    
    Args:
        portfolio_df: DataFrame with 'date' and 'value' columns
        benchmark_df: Optional DataFrame with 'date' and 'value' columns
    """
    fig = go.Figure()
    
    # Normalize to 100
    portfolio_df = portfolio_df.copy()
    portfolio_df['normalized'] = (portfolio_df['value'] / portfolio_df['value'].iloc[0]) * 100
    
    # Portfolio line
    fig.add_trace(go.Scatter(
        x=portfolio_df['date'],
        y=portfolio_df['normalized'],
        name='Portfolio',
        line=dict(color='#3498db', width=2),
        fill='tozeroy',
        fillcolor='rgba(52, 152, 219, 0.1)'
    ))
    
    # Benchmark
    if benchmark_df is not None:
        benchmark_df = benchmark_df.copy()
        benchmark_df['normalized'] = (benchmark_df['value'] / benchmark_df['value'].iloc[0]) * 100
        fig.add_trace(go.Scatter(
            x=benchmark_df['date'],
            y=benchmark_df['normalized'],
            name='Benchmark (SPY)',
            line=dict(color='#95a5a6', width=1, dash='dash')
        ))
    
    # Add horizontal line at 100
    fig.add_hline(y=100, line_dash="dot", line_color="gray", annotation_text="Starting Value")
    
    fig.update_layout(
        title='Portfolio Performance (Normalized to 100)',
        xaxis_title='Date',
        yaxis_title='Value',
        template='plotly_white',
        hovermode='x unified'
    )
    
    return fig
```

### 4. Asset Allocation Pie/Donut Chart

```python
def create_allocation_chart(
    holdings: dict,
    chart_type: str = 'donut'
) -> go.Figure:
    """
    Create asset allocation visualization.
    
    Args:
        holdings: dict like {'AAPL': 25000, 'GOOGL': 20000, 'MSFT': 15000}
        chart_type: 'pie' or 'donut'
    """
    labels = list(holdings.keys())
    values = list(holdings.values())
    total = sum(values)
    
    colors = px.colors.qualitative.Set3
    
    fig = go.Figure(data=[go.Pie(
        labels=labels,
        values=values,
        hole=0.4 if chart_type == 'donut' else 0,
        marker_colors=colors[:len(labels)],
        textinfo='label+percent',
        hovertemplate='%{label}<br>Value: $%{value:,.0f}<br>Percentage: %{percent}<extra></extra>'
    )])
    
    if chart_type == 'donut':
        fig.add_annotation(
            text=f'${total:,.0f}',
            x=0.5, y=0.5,
            font_size=20,
            showarrow=False
        )
    
    fig.update_layout(
        title='Asset Allocation',
        template='plotly_white'
    )
    
    return fig
```

### 5. Financial Data Tables

```python
from dash import dash_table
import pandas as pd

def create_holdings_table(df: pd.DataFrame) -> dash_table.DataTable:
    """
    Create interactive holdings table with conditional formatting.
    """
    return dash_table.DataTable(
        id='holdings-table',
        columns=[
            {'name': 'Symbol', 'id': 'symbol'},
            {'name': 'Shares', 'id': 'shares', 'type': 'numeric', 
             'format': {'specifier': ',.0f'}},
            {'name': 'Avg Cost', 'id': 'avg_cost', 'type': 'numeric',
             'format': {'specifier': '$,.2f'}},
            {'name': 'Current Price', 'id': 'current_price', 'type': 'numeric',
             'format': {'specifier': '$,.2f'}},
            {'name': 'Market Value', 'id': 'market_value', 'type': 'numeric',
             'format': {'specifier': '$,.2f'}},
            {'name': 'P&L', 'id': 'pnl', 'type': 'numeric',
             'format': {'specifier': '$,.2f'}},
            {'name': 'P&L %', 'id': 'pnl_pct', 'type': 'numeric',
             'format': {'specifier': '.2%'}},
        ],
        data=df.to_dict('records'),
        style_data_conditional=[
            {
                'if': {
                    'filter_query': '{pnl} > 0',
                    'column_id': ['pnl', 'pnl_pct']
                },
                'color': '#27ae60',
                'fontWeight': 'bold'
            },
            {
                'if': {
                    'filter_query': '{pnl} < 0',
                    'column_id': ['pnl', 'pnl_pct']
                },
                'color': '#e74c3c',
                'fontWeight': 'bold'
            }
        ],
        style_header={
            'backgroundColor': '#2c3e50',
            'color': 'white',
            'fontWeight': 'bold'
        },
        style_cell={
            'textAlign': 'right',
            'padding': '10px'
        },
        sort_action='native',
        filter_action='native',
        page_size=20
    )
```

### 6. KPI Cards

```python
def create_kpi_card(
    title: str,
    value: str,
    change: float = None,
    prefix: str = '$'
) -> html.Div:
    """Create a styled KPI card component."""
    
    change_color = '#27ae60' if change and change >= 0 else '#e74c3c'
    change_arrow = '↑' if change and change >= 0 else '↓'
    
    return html.Div([
        html.H4(title, style={
            'margin': '0',
            'color': '#7f8c8d',
            'fontSize': '14px'
        }),
        html.H2(f'{prefix}{value}', style={
            'margin': '5px 0',
            'color': '#2c3e50'
        }),
        html.Span(
            f'{change_arrow} {abs(change):.2%}' if change else '',
            style={'color': change_color, 'fontSize': '14px'}
        )
    ], style={
        'backgroundColor': 'white',
        'padding': '20px',
        'borderRadius': '10px',
        'boxShadow': '0 2px 10px rgba(0,0,0,0.1)',
        'textAlign': 'center',
        'minWidth': '200px'
    })
```

### 7. Real-Time Price Ticker

```python
def create_price_ticker(symbols: list) -> html.Div:
    """Create a scrolling price ticker component."""
    
    ticker_items = []
    for symbol in symbols:
        ticker_items.append(html.Span([
            html.Strong(symbol),
            html.Span(id=f'price-{symbol}', style={'marginLeft': '5px'}),
            html.Span(id=f'change-{symbol}', style={'marginLeft': '5px'})
        ], style={'marginRight': '30px'}))
    
    return html.Div(
        ticker_items,
        style={
            'backgroundColor': '#2c3e50',
            'color': 'white',
            'padding': '10px',
            'overflow': 'hidden',
            'whiteSpace': 'nowrap'
        },
        className='ticker-scroll'
    )
```

### 8. Heatmap for Sector Performance

```python
def create_sector_heatmap(sector_data: dict) -> go.Figure:
    """
    Create sector performance heatmap.
    
    Args:
        sector_data: dict like {'Technology': 2.5, 'Healthcare': -1.2, ...}
    """
    sectors = list(sector_data.keys())
    values = list(sector_data.values())
    
    # Create grid layout
    n_cols = 4
    n_rows = (len(sectors) + n_cols - 1) // n_cols
    
    fig = go.Figure(data=go.Heatmap(
        z=[values[i:i+n_cols] for i in range(0, len(values), n_cols)],
        text=[[f'{sectors[j]}<br>{values[j]:+.2f}%' 
               for j in range(i, min(i+n_cols, len(sectors)))]
              for i in range(0, len(sectors), n_cols)],
        texttemplate='%{text}',
        colorscale='RdYlGn',
        zmid=0,
        showscale=True
    ))
    
    fig.update_layout(
        title='Sector Performance',
        xaxis_showgrid=False,
        yaxis_showgrid=False,
        xaxis_showticklabels=False,
        yaxis_showticklabels=False
    )
    
    return fig
```

## Complete Dashboard Example

```python
import dash
from dash import dcc, html
from dash.dependencies import Input, Output
import plotly.graph_objects as go
import yfinance as yf
import pandas as pd

app = dash.Dash(__name__)

app.layout = html.Div([
    html.H1('Portfolio Dashboard', style={'textAlign': 'center'}),
    
    # Symbol Input
    dcc.Input(id='symbol-input', value='AAPL', type='text'),
    html.Button('Update', id='update-btn'),
    
    # KPIs Row
    html.Div(id='kpi-row', style={'display': 'flex', 'justifyContent': 'space-around', 'margin': '20px 0'}),
    
    # Charts
    html.Div([
        dcc.Graph(id='price-chart', style={'width': '70%'}),
        dcc.Graph(id='volume-chart', style={'width': '30%'})
    ], style={'display': 'flex'}),
    
    # Auto refresh
    dcc.Interval(id='interval', interval=60000)
])

@app.callback(
    [Output('kpi-row', 'children'),
     Output('price-chart', 'figure'),
     Output('volume-chart', 'figure')],
    [Input('update-btn', 'n_clicks'),
     Input('interval', 'n_intervals')],
    [dash.dependencies.State('symbol-input', 'value')]
)
def update_dashboard(n_clicks, n_intervals, symbol):
    # Fetch data
    stock = yf.Ticker(symbol)
    df = stock.history(period='6mo')
    info = stock.info
    
    # KPIs
    current_price = df['Close'].iloc[-1]
    prev_close = df['Close'].iloc[-2]
    change = (current_price - prev_close) / prev_close
    
    kpis = html.Div([
        create_kpi_card('Current Price', f'{current_price:.2f}', change),
        create_kpi_card('52W High', f'{info.get("fiftyTwoWeekHigh", 0):.2f}'),
        create_kpi_card('52W Low', f'{info.get("fiftyTwoWeekLow", 0):.2f}'),
        create_kpi_card('Market Cap', f'{info.get("marketCap", 0)/1e9:.1f}B', prefix='$'),
    ], style={'display': 'flex', 'gap': '20px'})
    
    # Price chart
    price_fig = create_stock_chart(symbol, period='6mo')
    
    # Volume chart
    volume_fig = go.Figure(go.Bar(x=df.index[-30:], y=df['Volume'].iloc[-30:]))
    volume_fig.update_layout(title='30-Day Volume', template='plotly_white')
    
    return kpis, price_fig, volume_fig

if __name__ == '__main__':
    app.run_server(debug=True, port=8050)
```

## Installation

```bash
pip install dash plotly pandas yfinance dash-bootstrap-components
```

## Styling with CSS

```css
/* dashboard.css */
.kpi-card {
    background: white;
    border-radius: 10px;
    padding: 20px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    text-align: center;
    min-width: 180px;
}

.ticker-scroll {
    animation: scroll 20s linear infinite;
}

@keyframes scroll {
    0% { transform: translateX(0); }
    100% { transform: translateX(-50%); }
}

.positive { color: #27ae60; }
.negative { color: #e74c3c; }
```

## Best Practices

1. **Performance**: Use callbacks efficiently, avoid unnecessary data fetches
2. **Caching**: Cache expensive API calls using `@lru_cache` or Redis
3. **Responsive**: Use CSS Grid/Flexbox for responsive layouts
4. **Real-time**: Use WebSocket for real-time data when available
5. **Error Handling**: Always handle API failures gracefully
