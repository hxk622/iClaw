create table if not exists market_overview_snapshot (
  overview_key text not null,
  market_scope text not null,
  source text,
  trading_date date,
  snapshot_at timestamptz not null,
  total_turnover numeric,
  northbound_net_inflow numeric,
  advancers integer,
  decliners integer,
  flat_count integer,
  limit_up_count integer,
  limit_down_count integer,
  top_sectors_json jsonb not null default '[]'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (overview_key, snapshot_at)
);

create index if not exists idx_market_overview_snapshot_scope_time
  on market_overview_snapshot(market_scope, snapshot_at desc);

create table if not exists market_index_snapshot (
  index_key text not null,
  index_name text not null,
  market_scope text not null,
  value numeric,
  change_amount numeric,
  change_percent numeric,
  source text,
  snapshot_at timestamptz not null,
  is_delayed boolean not null default false,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (index_key, snapshot_at)
);

create index if not exists idx_market_index_snapshot_scope_time
  on market_index_snapshot(market_scope, snapshot_at desc);

create table if not exists market_news_item (
  news_id text primary key,
  source text not null,
  source_item_id text,
  title text not null,
  summary text,
  content_url text,
  published_at timestamptz not null,
  occurred_at timestamptz,
  language text default 'zh-CN',
  market_scope text not null default 'cn',
  importance_score numeric(10, 4),
  sentiment_label text,
  related_symbols text[] not null default '{}'::text[],
  related_tags text[] not null default '{}'::text[],
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_market_news_item_source_item
  on market_news_item(source, source_item_id)
  where source_item_id is not null;

create index if not exists idx_market_news_item_scope_published
  on market_news_item(market_scope, published_at desc);

create index if not exists idx_market_news_item_related_symbols
  on market_news_item using gin(related_symbols);

create index if not exists idx_market_news_item_related_tags
  on market_news_item using gin(related_tags);
