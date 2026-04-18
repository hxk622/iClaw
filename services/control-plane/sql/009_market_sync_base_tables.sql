create table if not exists stock_basics (
  stock_code varchar(10) primary key,
  stock_name varchar(50) not null,
  exchange varchar(2) not null,
  list_date date,
  company_name varchar(200),
  main_business text,
  industry varchar(50),
  region varchar(50),
  market_cap numeric(20, 2) default 0,
  float_cap numeric(20, 2) default 0,
  total_shares numeric(20) default 0,
  float_shares numeric(20) default 0,
  pe_ttm numeric(10, 2) default 0,
  pb numeric(10, 2) default 0,
  created_at timestamptz default current_timestamp,
  updated_at timestamptz default current_timestamp
);

create index if not exists idx_stock_basics_exchange on stock_basics(exchange);
create index if not exists idx_stock_basics_industry on stock_basics(industry);
create index if not exists idx_stock_basics_market_cap on stock_basics(market_cap desc);

create table if not exists stock_quotes (
  stock_code varchar(10) not null,
  trade_date date not null,
  open numeric(10, 2) default 0,
  high numeric(10, 2) default 0,
  low numeric(10, 2) default 0,
  close numeric(10, 2) default 0,
  volume numeric(20) default 0,
  amount numeric(20, 2) default 0,
  change numeric(10, 2) default 0,
  change_percent numeric(10, 2) default 0,
  turnover_rate numeric(10, 2) default 0,
  created_at timestamptz default current_timestamp,
  primary key (stock_code, trade_date)
);

create index if not exists idx_stock_quotes_trade_date on stock_quotes(trade_date);
create index if not exists idx_stock_quotes_change_percent on stock_quotes(change_percent desc);
create index if not exists idx_stock_quotes_stock_code_trade_date on stock_quotes(stock_code, trade_date desc);

create table if not exists stock_finance (
  stock_code varchar(10) not null,
  report_year integer not null,
  report_quarter integer not null,
  revenue numeric(20, 2) default 0,
  net_profit numeric(20, 2) default 0,
  roe numeric(10, 2) default 0,
  gross_margin numeric(10, 2) default 0,
  debt_ratio numeric(10, 2) default 0,
  eps numeric(10, 2) default 0,
  updated_at timestamptz default current_timestamp,
  primary key (stock_code, report_year, report_quarter)
);

alter table if exists stock_finance add column if not exists report_year integer;
alter table if exists stock_finance add column if not exists report_quarter integer;
alter table if exists stock_finance add column if not exists revenue numeric(20, 2) default 0;
alter table if exists stock_finance add column if not exists net_profit numeric(20, 2) default 0;
alter table if exists stock_finance add column if not exists roe numeric(10, 2) default 0;
alter table if exists stock_finance add column if not exists gross_margin numeric(10, 2) default 0;
alter table if exists stock_finance add column if not exists debt_ratio numeric(10, 2) default 0;
alter table if exists stock_finance add column if not exists eps numeric(10, 2) default 0;
alter table if exists stock_finance add column if not exists updated_at timestamptz default current_timestamp;

create index if not exists idx_stock_finance_report on stock_finance(report_year, report_quarter);
create index if not exists idx_stock_finance_roe on stock_finance(roe desc);

create table if not exists stock_industry_relation (
  id serial primary key,
  stock_code varchar(10) not null,
  industry_code varchar(20) not null,
  industry_name varchar(50) not null,
  unique (stock_code, industry_code)
);

create table if not exists stock_concept_relation (
  id serial primary key,
  stock_code varchar(10) not null,
  concept_code varchar(20) not null,
  concept_name varchar(50) not null,
  unique (stock_code, concept_code)
);

create table if not exists stock_top_holders (
  id serial primary key,
  stock_code varchar(10) not null,
  holder_name varchar(100) not null,
  hold_amount numeric(20) default 0,
  hold_ratio numeric(10, 2) default 0,
  report_period varchar(10) not null,
  unique (stock_code, holder_name, report_period)
);

create table if not exists sync_task_logs (
  id serial primary key,
  task_name varchar(50) not null,
  status varchar(20) not null,
  start_time timestamptz not null,
  end_time timestamptz,
  error_message text,
  sync_count integer default 0,
  data_source varchar(50),
  created_at timestamptz default current_timestamp
);

create index if not exists idx_sync_task_logs_task_name on sync_task_logs(task_name);
create index if not exists idx_sync_task_logs_status on sync_task_logs(status);
create index if not exists idx_sync_task_logs_start_time on sync_task_logs(start_time desc);
