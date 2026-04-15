-- 设置默认schema为app
set search_path to app;

-- 股票基础信息表
CREATE TABLE IF NOT EXISTS stock_basics (
  stock_code VARCHAR(10) PRIMARY KEY,
  stock_name VARCHAR(50) NOT NULL,
  exchange VARCHAR(2) NOT NULL,
  list_date DATE,
  company_name VARCHAR(200),
  main_business TEXT,
  industry VARCHAR(50),
  region VARCHAR(50),
  market_cap NUMERIC(20, 2) DEFAULT 0,
  float_cap NUMERIC(20, 2) DEFAULT 0,
  total_shares NUMERIC(20) DEFAULT 0,
  float_shares NUMERIC(20) DEFAULT 0,
  pe_ttm NUMERIC(10, 2) DEFAULT 0,
  pb NUMERIC(10, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stock_basics_exchange ON stock_basics(exchange);
CREATE INDEX IF NOT EXISTS idx_stock_basics_industry ON stock_basics(industry);
CREATE INDEX IF NOT EXISTS idx_stock_basics_market_cap ON stock_basics(market_cap DESC);

-- 行情数据表
CREATE TABLE IF NOT EXISTS stock_quotes (
  stock_code VARCHAR(10) NOT NULL,
  trade_date DATE NOT NULL,
  open NUMERIC(10, 2) DEFAULT 0,
  high NUMERIC(10, 2) DEFAULT 0,
  low NUMERIC(10, 2) DEFAULT 0,
  close NUMERIC(10, 2) DEFAULT 0,
  volume NUMERIC(20) DEFAULT 0,
  amount NUMERIC(20, 2) DEFAULT 0,
  change NUMERIC(10, 2) DEFAULT 0,
  change_percent NUMERIC(10, 2) DEFAULT 0,
  turnover_rate NUMERIC(10, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (stock_code, trade_date)
);

CREATE INDEX IF NOT EXISTS idx_stock_quotes_trade_date ON stock_quotes(trade_date);
CREATE INDEX IF NOT EXISTS idx_stock_quotes_change_percent ON stock_quotes(change_percent DESC);

-- 财务数据表
CREATE TABLE IF NOT EXISTS stock_finance (
  stock_code VARCHAR(10) NOT NULL,
  report_year INTEGER NOT NULL,
  report_quarter INTEGER NOT NULL,
  revenue NUMERIC(20, 2) DEFAULT 0,
  net_profit NUMERIC(20, 2) DEFAULT 0,
  roe NUMERIC(10, 2) DEFAULT 0,
  gross_margin NUMERIC(10, 2) DEFAULT 0,
  debt_ratio NUMERIC(10, 2) DEFAULT 0,
  eps NUMERIC(10, 2) DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (stock_code, report_year, report_quarter)
);

CREATE INDEX IF NOT EXISTS idx_stock_finance_report ON stock_finance(report_year, report_quarter);
CREATE INDEX IF NOT EXISTS idx_stock_finance_roe ON stock_finance(roe DESC);

-- 股票-行业关联表
CREATE TABLE IF NOT EXISTS stock_industry_relation (
  id SERIAL PRIMARY KEY,
  stock_code VARCHAR(10) NOT NULL,
  industry_code VARCHAR(20) NOT NULL,
  industry_name VARCHAR(50) NOT NULL,
  UNIQUE (stock_code, industry_code)
);

-- 股票-概念关联表
CREATE TABLE IF NOT EXISTS stock_concept_relation (
  id SERIAL PRIMARY KEY,
  stock_code VARCHAR(10) NOT NULL,
  concept_code VARCHAR(20) NOT NULL,
  concept_name VARCHAR(50) NOT NULL,
  UNIQUE (stock_code, concept_code)
);

-- 前十大股东表
CREATE TABLE IF NOT EXISTS stock_top_holders (
  id SERIAL PRIMARY KEY,
  stock_code VARCHAR(10) NOT NULL,
  holder_name VARCHAR(100) NOT NULL,
  hold_amount NUMERIC(20) DEFAULT 0,
  hold_ratio NUMERIC(10, 2) DEFAULT 0,
  report_period VARCHAR(10) NOT NULL,
  UNIQUE (stock_code, holder_name, report_period)
);

-- 同步任务日志表
CREATE TABLE IF NOT EXISTS sync_task_logs (
  id SERIAL PRIMARY KEY,
  task_name VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  error_message TEXT,
  sync_count INTEGER DEFAULT 0,
  data_source VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sync_task_logs_task_name ON sync_task_logs(task_name);
CREATE INDEX IF NOT EXISTS idx_sync_task_logs_status ON sync_task_logs(status);
CREATE INDEX IF NOT EXISTS idx_sync_task_logs_start_time ON sync_task_logs(start_time DESC);
