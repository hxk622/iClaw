create table if not exists users (
  id uuid primary key,
  username text not null unique,
  display_name text,
  avatar_url text,
  role text not null default 'user',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table users add column if not exists avatar_url text;
alter table users add column if not exists role text not null default 'user';

create table if not exists user_emails (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  email text not null unique,
  is_primary boolean not null default true,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists user_oauth_accounts (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  provider text not null,
  provider_id text not null,
  created_at timestamptz not null default now(),
  unique (provider, provider_id)
);

create table if not exists user_password_credentials (
  user_id uuid primary key references users(id) on delete cascade,
  password_hash text not null,
  password_algo text not null default 'scrypt',
  password_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists device_sessions (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  device_id text not null,
  client_type text not null,
  status text not null default 'active',
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists access_tokens (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  device_session_id uuid not null references device_sessions(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists refresh_tokens (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  device_session_id uuid not null references device_sessions(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists credit_accounts (
  user_id uuid primary key references users(id) on delete cascade,
  daily_free_balance bigint not null default 0,
  topup_balance bigint not null default 0,
  daily_free_granted_at timestamptz not null default now(),
  daily_free_expires_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table credit_accounts add column if not exists daily_free_balance bigint;
alter table credit_accounts add column if not exists topup_balance bigint;
alter table credit_accounts add column if not exists daily_free_granted_at timestamptz;
alter table credit_accounts add column if not exists daily_free_expires_at timestamptz;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_name = 'credit_accounts'
      and column_name = 'balance'
      and table_schema = any (current_schemas(false))
  ) then
    execute $sql$
      update credit_accounts
      set
        daily_free_balance = coalesce(daily_free_balance, balance, 0),
        topup_balance = coalesce(topup_balance, 0),
        daily_free_granted_at = coalesce(daily_free_granted_at, updated_at, now()),
        daily_free_expires_at = coalesce(daily_free_expires_at, updated_at, now())
      where
        daily_free_balance is null
        or topup_balance is null
        or daily_free_granted_at is null
        or daily_free_expires_at is null
    $sql$;
  else
    update credit_accounts
    set
      daily_free_balance = coalesce(daily_free_balance, 0),
      topup_balance = coalesce(topup_balance, 0),
      daily_free_granted_at = coalesce(daily_free_granted_at, updated_at, now()),
      daily_free_expires_at = coalesce(daily_free_expires_at, updated_at, now())
    where
      daily_free_balance is null
      or topup_balance is null
      or daily_free_granted_at is null
      or daily_free_expires_at is null;
  end if;
end $$;

alter table credit_accounts alter column daily_free_balance set default 0;
alter table credit_accounts alter column topup_balance set default 0;
alter table credit_accounts alter column daily_free_granted_at set default now();
alter table credit_accounts alter column daily_free_expires_at set default now();
alter table credit_accounts alter column updated_at set default now();
alter table credit_accounts alter column daily_free_balance set not null;
alter table credit_accounts alter column topup_balance set not null;
alter table credit_accounts alter column daily_free_granted_at set not null;
alter table credit_accounts alter column daily_free_expires_at set not null;
alter table credit_accounts alter column updated_at set not null;

create table if not exists credit_ledger (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  bucket text not null,
  direction text not null,
  amount bigint not null,
  delta bigint not null,
  balance_after bigint not null,
  reference_type text,
  reference_id text,
  event_type text not null,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table credit_ledger add column if not exists bucket text;
alter table credit_ledger add column if not exists direction text;
alter table credit_ledger add column if not exists amount bigint;
alter table credit_ledger add column if not exists idempotency_key text;

update credit_ledger
set
  bucket = coalesce(
    bucket,
    case
      when event_type = 'daily_reset' then 'daily_free'
      when coalesce(delta, 0) >= 0 then 'topup'
      else 'daily_free'
    end
  ),
  direction = coalesce(
    direction,
    case
      when event_type = 'daily_reset' then 'grant'
      when event_type = 'topup' then 'topup'
      when coalesce(delta, 0) >= 0 then 'refund'
      else 'consume'
    end
  ),
  amount = coalesce(amount, abs(coalesce(delta, 0)))
where bucket is null or direction is null or amount is null;

alter table credit_ledger alter column bucket set not null;
alter table credit_ledger alter column direction set not null;
alter table credit_ledger alter column amount set not null;

create table if not exists run_grants (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  device_session_id uuid references device_sessions(id) on delete set null,
  status text not null default 'issued',
  nonce text not null unique,
  max_input_tokens integer,
  max_output_tokens integer,
  credit_limit bigint,
  expires_at timestamptz not null,
  used_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists usage_events (
  id uuid primary key,
  event_id text not null unique,
  user_id uuid not null references users(id) on delete cascade,
  run_grant_id uuid references run_grants(id) on delete set null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  credit_cost bigint not null default 0,
  provider text,
  model text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists payment_orders (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  provider text not null,
  package_id text not null,
  package_name text not null,
  credits bigint not null,
  bonus_credits bigint not null default 0,
  amount_cny_fen bigint not null,
  currency text not null default 'cny',
  status text not null default 'pending',
  provider_order_id text,
  provider_prepay_id text,
  payment_url text,
  paid_at timestamptz,
  expired_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payment_webhook_events (
  id uuid primary key,
  provider text not null,
  event_id text not null,
  event_type text,
  order_id uuid references payment_orders(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  signature text,
  processed_at timestamptz,
  process_status text not null default 'pending',
  created_at timestamptz not null default now(),
  unique (provider, event_id)
);

create table if not exists payment_provider_profiles (
  id uuid primary key,
  provider text not null,
  scope_type text not null,
  scope_key text not null,
  channel_kind text not null,
  display_name text not null,
  enabled boolean not null default true,
  config_json jsonb not null default '{}'::jsonb,
  configured_secret_keys jsonb not null default '[]'::jsonb,
  secret_payload_encrypted text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, scope_type, scope_key)
);

create table if not exists user_workspace_backups (
  user_id uuid primary key references users(id) on delete cascade,
  identity_md text not null,
  user_md text not null,
  soul_md text not null,
  agents_md text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists agent_catalog_entries (
  slug text primary key,
  name text not null,
  description text not null,
  category text not null,
  publisher text not null default 'iClaw',
  featured boolean not null default false,
  official boolean not null default true,
  tags jsonb not null default '[]'::jsonb,
  capabilities jsonb not null default '[]'::jsonb,
  use_cases jsonb not null default '[]'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,
  sort_order integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_agent_library (
  user_id uuid not null references users(id) on delete cascade,
  agent_slug text not null references agent_catalog_entries(slug) on delete cascade,
  installed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, agent_slug)
);

create table if not exists skill_catalog_entries (
  slug text primary key,
  name text not null,
  description text not null,
  market text,
  category text,
  skill_type text,
  publisher text not null default 'iClaw',
  distribution text not null default 'cloud',
  tags jsonb not null default '[]'::jsonb,
  version text not null default '1.0.0',
  artifact_format text not null default 'tar.gz',
  artifact_url text,
  artifact_sha256 text,
  artifact_source_path text,
  origin_type text not null default 'manual',
  source_url text,
  metadata_json jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table skill_catalog_entries add column if not exists version text not null default '1.0.0';
alter table skill_catalog_entries add column if not exists artifact_format text not null default 'tar.gz';
alter table agent_catalog_entries add column if not exists metadata_json jsonb not null default '{}'::jsonb;
alter table skill_catalog_entries add column if not exists artifact_url text;
alter table skill_catalog_entries add column if not exists artifact_sha256 text;
alter table skill_catalog_entries add column if not exists artifact_source_path text;
alter table skill_catalog_entries add column if not exists origin_type text not null default 'manual';
alter table skill_catalog_entries add column if not exists source_url text;
alter table skill_catalog_entries add column if not exists metadata_json jsonb not null default '{}'::jsonb;
alter table skill_catalog_entries drop column if exists visibility;

create table if not exists skill_sync_sources (
  id text primary key,
  source_type text not null,
  source_key text not null unique,
  display_name text not null,
  source_url text not null,
  config_json jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists skill_sync_runs (
  id text primary key,
  source_id text not null references skill_sync_sources(id) on delete cascade,
  source_key text not null,
  source_type text not null,
  display_name text not null,
  status text not null,
  summary_json jsonb not null default '{}'::jsonb,
  items_json jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists user_private_skills (
  user_id uuid not null references users(id) on delete cascade,
  slug text not null,
  name text not null,
  description text not null,
  market text,
  category text,
  skill_type text,
  publisher text not null default '个人导入',
  tags jsonb not null default '[]'::jsonb,
  source_kind text not null,
  source_url text,
  version text not null,
  artifact_format text not null,
  artifact_key text not null,
  artifact_sha256 text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, slug)
);

create table if not exists user_files (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  tenant_id text not null,
  kind text not null,
  status text not null default 'active',
  storage_provider text not null default 'minio',
  object_key text not null,
  original_file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  sha256 text not null,
  source text,
  task_id text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists user_files_user_created_idx on user_files (user_id, created_at desc);
create index if not exists user_files_user_status_idx on user_files (user_id, status, created_at desc);

create table if not exists user_skill_library (
  user_id uuid not null references users(id) on delete cascade,
  skill_slug text not null,
  source text not null default 'cloud',
  installed_version text not null,
  enabled boolean not null default true,
  installed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, skill_slug)
);

alter table user_skill_library add column if not exists source text not null default 'cloud';

create table if not exists user_mcp_library (
  user_id uuid not null references users(id) on delete cascade,
  mcp_key text not null,
  source text not null default 'cloud',
  enabled boolean not null default true,
  installed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, mcp_key)
);

create table if not exists user_extension_install_configs (
  user_id uuid not null references users(id) on delete cascade,
  extension_type text not null,
  extension_key text not null,
  schema_version integer,
  status text not null default 'configured',
  config_json jsonb not null default '{}'::jsonb,
  configured_secret_keys jsonb not null default '[]'::jsonb,
  secret_payload_encrypted text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, extension_type, extension_key)
);

create index if not exists user_extension_install_configs_user_type_idx
  on user_extension_install_configs (user_id, extension_type, updated_at desc);

create table if not exists oem_brand_profiles (
  brand_id text primary key,
  tenant_key text not null,
  display_name text not null,
  product_name text not null,
  status text not null default 'draft',
  draft_config jsonb not null default '{}'::jsonb,
  published_config jsonb,
  published_version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists oem_brand_versions (
  id uuid primary key,
  brand_id text not null references oem_brand_profiles(brand_id) on delete cascade,
  version_no integer not null,
  config jsonb not null,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz not null default now(),
  unique (brand_id, version_no)
);

create table if not exists oem_asset_registry (
  id uuid primary key,
  brand_id text not null references oem_brand_profiles(brand_id) on delete cascade,
  asset_key text not null,
  kind text not null,
  storage_provider text not null default 'minio',
  object_key text not null,
  public_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, asset_key)
);

create table if not exists oem_audit_events (
  id uuid primary key,
  brand_id text not null,
  action text not null,
  actor_user_id uuid references users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists oem_apps (
  app_name text primary key,
  display_name text not null,
  description text,
  status text not null default 'active',
  default_locale text not null default 'zh-CN',
  config_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists platform_bundled_skills (
  skill_slug text primary key references skill_catalog_entries(slug) on delete cascade,
  sort_order integer not null default 100,
  metadata_json jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists cloud_mcp_catalog (
  mcp_key text primary key,
  name text not null,
  description text not null,
  transport text not null default 'config',
  object_key text,
  config_json jsonb not null default '{}'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists platform_bundled_mcps (
  mcp_key text primary key references cloud_mcp_catalog(mcp_key) on delete cascade,
  sort_order integer not null default 100,
  metadata_json jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists oem_model_catalog (
  ref text primary key,
  label text not null,
  provider_id text not null,
  model_id text not null,
  api text not null default 'openai-completions',
  base_url text,
  use_runtime_openai boolean not null default false,
  auth_header boolean not null default true,
  reasoning boolean not null default false,
  input_json jsonb not null default '[]'::jsonb,
  context_window integer not null default 0,
  max_tokens integer not null default 0,
  metadata_json jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists model_provider_profiles (
  id uuid primary key,
  scope_type text not null,
  scope_key text not null,
  provider_key text not null,
  provider_label text not null,
  api_protocol text not null default 'openai-completions',
  base_url text not null,
  auth_mode text not null default 'bearer',
  api_key text not null,
  logo_preset_key text,
  metadata_json jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scope_type, scope_key, provider_key)
);

create table if not exists model_provider_profile_models (
  id uuid primary key,
  profile_id uuid not null references model_provider_profiles(id) on delete cascade,
  model_ref text not null,
  model_id text not null,
  label text not null,
  logo_preset_key text,
  billing_multiplier double precision not null default 1.0,
  reasoning boolean not null default false,
  input_modalities_json jsonb not null default '[]'::jsonb,
  context_window integer,
  max_tokens integer,
  enabled boolean not null default true,
  sort_order integer not null default 100,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, model_ref),
  unique (profile_id, model_id)
);

alter table if exists model_provider_profile_models
  add column if not exists billing_multiplier double precision not null default 1.0;

create table if not exists app_model_runtime_overrides (
  app_name text primary key references oem_apps(app_name) on delete cascade,
  provider_mode text not null default 'inherit_platform',
  active_profile_id uuid references model_provider_profiles(id) on delete set null,
  cache_version bigint not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists memory_embedding_profiles (
  id uuid primary key,
  scope_type text not null,
  scope_key text not null,
  provider_key text not null,
  provider_label text not null,
  base_url text not null,
  auth_mode text not null default 'bearer',
  api_key text not null,
  embedding_model text not null,
  logo_preset_key text,
  auto_recall boolean not null default true,
  metadata_json jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scope_type, scope_key)
);

create table if not exists app_payment_provider_overrides (
  app_name text not null references oem_apps(app_name) on delete cascade,
  provider text not null,
  mode text not null default 'inherit_platform',
  active_profile_id uuid references payment_provider_profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (app_name, provider)
);

create table if not exists oem_menu_catalog (
  menu_key text primary key,
  display_name text not null,
  category text,
  route_key text,
  icon_key text,
  metadata_json jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists market_stock_catalog (
  id text primary key,
  market text not null,
  exchange text not null,
  symbol text not null,
  company_name text not null,
  board text,
  status text not null default 'active',
  source text not null default 'eastmoney',
  source_id text,
  current_price numeric,
  change_percent numeric,
  amount numeric,
  turnover_rate numeric,
  pe_ttm numeric,
  open_price numeric,
  prev_close numeric,
  total_market_cap numeric,
  circulating_market_cap numeric,
  strategy_tags text[] not null default '{}',
  metadata_json jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (market, exchange, symbol)
);

create unique index if not exists idx_market_stock_catalog_source_id
  on market_stock_catalog(source, source_id)
  where source_id is not null;

create table if not exists market_fund_catalog (
  id text primary key,
  market text not null,
  exchange text not null,
  symbol text not null,
  fund_name text not null,
  fund_type text,
  instrument_kind text not null,
  region text not null,
  risk_level text,
  manager_name text,
  tracking_target text,
  status text not null default 'active',
  source text not null default 'eastmoney',
  source_id text,
  current_price numeric,
  nav_price numeric,
  change_percent numeric,
  return_1m numeric,
  return_1y numeric,
  max_drawdown numeric,
  scale_amount numeric,
  fee_rate numeric,
  amount numeric,
  turnover_rate numeric,
  dividend_mode text,
  strategy_tags text[] not null default '{}',
  metadata_json jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (market, exchange, symbol)
);

create unique index if not exists idx_market_fund_catalog_source_id
  on market_fund_catalog(source, source_id)
  where source_id is not null;

create table if not exists oem_composer_control_catalog (
  control_key text primary key,
  display_name text not null,
  control_type text not null default 'static',
  icon_key text,
  metadata_json jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists oem_composer_control_option_catalog (
  control_key text not null references oem_composer_control_catalog(control_key) on delete cascade,
  option_value text not null,
  label text not null,
  description text not null default '',
  sort_order integer not null default 100,
  metadata_json jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (control_key, option_value)
);

create table if not exists oem_composer_shortcut_catalog (
  shortcut_key text primary key,
  display_name text not null,
  description text not null default '',
  template_text text not null,
  icon_key text,
  tone text,
  metadata_json jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists oem_bundled_skills (
  app_name text not null references oem_apps(app_name) on delete cascade,
  skill_slug text not null references skill_catalog_entries(slug) on delete cascade,
  enabled boolean not null default true,
  sort_order integer not null default 100,
  config_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (app_name, skill_slug)
);

create table if not exists oem_bundled_mcps (
  app_name text not null references oem_apps(app_name) on delete cascade,
  mcp_key text not null references cloud_mcp_catalog(mcp_key) on delete cascade,
  enabled boolean not null default true,
  sort_order integer not null default 100,
  config_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (app_name, mcp_key)
);

drop table if exists oem_app_mcp_bindings cascade;
drop table if exists oem_mcp_catalog cascade;

create table if not exists oem_app_model_bindings (
  app_name text not null references oem_apps(app_name) on delete cascade,
  model_ref text not null references oem_model_catalog(ref) on delete cascade,
  enabled boolean not null default true,
  sort_order integer not null default 100,
  config_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (app_name, model_ref)
);

create table if not exists oem_app_menu_bindings (
  app_name text not null references oem_apps(app_name) on delete cascade,
  menu_key text not null,
  enabled boolean not null default true,
  sort_order integer not null default 100,
  config_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (app_name, menu_key)
);

create table if not exists oem_app_composer_control_bindings (
  app_name text not null references oem_apps(app_name) on delete cascade,
  control_key text not null references oem_composer_control_catalog(control_key) on delete cascade,
  enabled boolean not null default true,
  sort_order integer not null default 100,
  config_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (app_name, control_key)
);

create table if not exists oem_app_composer_shortcut_bindings (
  app_name text not null references oem_apps(app_name) on delete cascade,
  shortcut_key text not null references oem_composer_shortcut_catalog(shortcut_key) on delete cascade,
  enabled boolean not null default true,
  sort_order integer not null default 100,
  config_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (app_name, shortcut_key)
);

create table if not exists oem_app_assets (
  id uuid primary key,
  app_name text not null references oem_apps(app_name) on delete cascade,
  asset_key text not null,
  storage_provider text not null default 's3',
  object_key text not null,
  public_url text,
  content_type text,
  sha256 text,
  size_bytes bigint,
  metadata_json jsonb not null default '{}'::jsonb,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (app_name, asset_key)
);

create table if not exists oem_system_state (
  state_key text primary key,
  state_value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists oem_app_releases (
  id uuid primary key,
  app_name text not null references oem_apps(app_name) on delete cascade,
  version_no integer not null,
  snapshot_json jsonb not null default '{}'::jsonb,
  summary_json jsonb not null default '{}'::jsonb,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz not null default now(),
  unique (app_name, version_no)
);

create table if not exists oem_app_audit_events (
  id uuid primary key,
  app_name text not null references oem_apps(app_name) on delete cascade,
  action text not null,
  actor_user_id uuid references users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table oem_app_assets add column if not exists storage_provider text not null default 's3';
alter table oem_app_assets add column if not exists public_url text;
alter table oem_app_assets add column if not exists created_by uuid references users(id) on delete set null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'user_skill_library_skill_slug_fkey'
  ) then
    alter table user_skill_library drop constraint user_skill_library_skill_slug_fkey;
  end if;
exception
  when undefined_object then null;
end $$;

insert into agent_catalog_entries (
  slug,
  name,
  description,
  category,
  publisher,
  featured,
  official,
  tags,
  capabilities,
  use_cases,
  metadata_json,
  sort_order,
  active
) values
  (
    'stock-expert',
    '股票专家',
    '专业 AI 助手，专注于 A 股公告追踪、全球市场分析和交易复盘，提供数据驱动的投资决策参考。',
    'finance',
    'iClaw',
    true,
    true,
    '["金融","股票","研究"]'::jsonb,
    '["A 股公告追踪","全球股票分析","交易绩效复盘"]'::jsonb,
    '["没时间看盘时，让我持续追踪 A 股重大事件。","希望快速获得全球市场技术指标和走势摘要。","导入交割单后定位交易中的执行问题。"]'::jsonb,
    '{"surface":"lobster-store"}'::jsonb,
    10,
    true
  ),
  (
    'summary-expert',
    '全能总结专家',
    '将音频、视频、网页链接、文档、文字和图片整理成结构化摘要、重点结论与行动清单。',
    'productivity',
    'iClaw',
    true,
    true,
    '["总结","效率","多模态"]'::jsonb,
    '["多模态内容摘要","会议纪要整理","行动项提炼"]'::jsonb,
    '["把冗长会议录音整理成纪要和待办。","快速读懂长文档、网页和视频重点。","把素材归纳成便于分享的结构化摘要。"]'::jsonb,
    '{"surface":"lobster-store"}'::jsonb,
    20,
    true
  ),
  (
    'mail-assistant',
    '邮件助手',
    '跨账号智能邮件管家，帮助整理收件箱、草拟回复、提炼待办并减少遗漏。',
    'productivity',
    'iClaw',
    false,
    true,
    '["邮件","办公","效率"]'::jsonb,
    '["收件箱分诊","回复草拟与润色","跟进提醒提取"]'::jsonb,
    '["批量归类需要回复和可归档的邮件。","根据历史语气快速生成专业回复。","从长邮件线程里提炼明确待办和截止时间。"]'::jsonb,
    '{"surface":"lobster-store"}'::jsonb,
    30,
    true
  ),
  (
    'wechat-writer',
    '微信公众号写作专家',
    '提供选题、标题、结构和长文润色，帮助稳定产出高质量的公众号内容。',
    'content',
    'iClaw',
    false,
    true,
    '["公众号","写作","内容"]'::jsonb,
    '["选题策划","标题与结构生成","成稿改写润色"]'::jsonb,
    '["围绕热点快速产出公众号选题和提纲。","把口语素材整理成长文表达。","优化标题、开头和结尾，提高完读率。"]'::jsonb,
    '{"surface":"lobster-store"}'::jsonb,
    40,
    true
  ),
  (
    'x-content-operator',
    'X 平台内容运营专家',
    '一站式 X 平台内容创作与运营助手，支持选题、写推、线程编排与复盘。',
    'content',
    'iClaw',
    true,
    true,
    '["X","运营","内容增长"]'::jsonb,
    '["热点选题发现","推文与线程生成","发布节奏复盘"]'::jsonb,
    '["持续输出品牌化、专业感强的短内容。","把长内容拆解成可发布线程。","复盘哪些内容更容易带来互动和转化。"]'::jsonb,
    '{"surface":"lobster-store"}'::jsonb,
    50,
    true
  ),
  (
    'cross-border-radar',
    '跨境电商选品雷达',
    '集成多平台数据，辅助竞争分析、选品判断与需求机会发现，适合跨境业务调研。',
    'commerce',
    'iClaw',
    false,
    true,
    '["跨境电商","选品","调研"]'::jsonb,
    '["平台竞品监控","选品机会分析","评论痛点提炼"]'::jsonb,
    '["比较多个平台的热门品类和价格带。","从用户评论中提炼产品优化方向。","快速发现高需求低竞争的选品机会。"]'::jsonb,
    '{"surface":"lobster-store"}'::jsonb,
    60,
    true
  )
on conflict (slug)
do update set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  publisher = excluded.publisher,
  featured = excluded.featured,
  official = excluded.official,
  tags = excluded.tags,
  capabilities = excluded.capabilities,
  use_cases = excluded.use_cases,
  metadata_json = excluded.metadata_json,
  sort_order = excluded.sort_order,
  active = excluded.active,
  updated_at = now();

insert into agent_catalog_entries (
  slug,
  name,
  description,
  category,
  publisher,
  featured,
  official,
  tags,
  capabilities,
  use_cases,
  metadata_json,
  sort_order,
  active
) values
  (
    'a-share-value-hunter',
    'A股价值投资专家',
    '聚焦低估值、现金流和分红质量，帮助你从安全边际出发筛选A股长期配置机会。',
    'finance',
    'iClaw',
    true,
    true,
    '["A股","价值投资","低估值"]'::jsonb,
    '["低估值筛选","分红质量评估","价值股比较"]'::jsonb,
    '["快速筛选A股价值型机会池。","判断高股息是否可持续。","为长期配置构建更稳健的候选名单。"]'::jsonb,
    '{"surface":"investment-experts","subtitle":"低估值筛选 · 红利质量 · 长线配置","investment_category":"stock","avatar_url":"https://images.unsplash.com/photo-1738566061505-556830f8b8f5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080","usage_count":12543,"task_count":8932,"rating":4.9,"is_online":true,"is_recommended":true,"is_hot":false,"primary_skill_slug":"a-share-low-valuation","skill_slugs":["a-share-low-valuation","a-share-dividend","a-share-data-toolkit"],"skill_highlights":[{"title":"低估值机会扫描","description":"筛选估值偏低但基本面稳健的A股公司。"},{"title":"红利与现金流核查","description":"判断分红是否可持续，避免高股息陷阱。"},{"title":"价值股对比","description":"横向比较ROE、现金流、估值与安全边际。"}],"task_examples":["筛选当前A股里低估值且现金流健康的公司","对比中国神华和长江电力的红利质量","找出适合长期配置的高股息价值股"],"conversation_preview":[{"role":"user","content":"帮我找3只适合长期持有的A股价值股。"},{"role":"expert","content":"我会先按低估值、自由现金流、分红覆盖率和行业稳定性筛选，再给你逐只拆解投资逻辑与主要风险。"}],"system_prompt":"你是一名克制、审慎的A股价值投资专家。优先从估值、安全边际、现金流、分红质量和周期位置来回答问题，避免追逐情绪化题材。","mcp_preset_keys":["browser","tavily","serper","yahoo-finance"]}'::jsonb,
    110,
    true
  ),
  (
    'a-share-quant-pilot',
    'A股量化因子专家',
    '基于多因子框架分析A股，适合做系统选股、风格暴露识别和规则化研究。',
    'finance',
    'iClaw',
    true,
    true,
    '["A股","量化","因子"]'::jsonb,
    '["多因子筛选","风格暴露分析","量化选股"]'::jsonb,
    '["建立规则化的A股股票池。","分析组合风格偏移。","把量化思路转成可执行筛选条件。"]'::jsonb,
    '{"surface":"investment-experts","subtitle":"多因子模型 · 系统选股 · 风格暴露","investment_category":"quant","avatar_url":"https://images.unsplash.com/photo-1739300293504-234817eead52?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080","usage_count":9876,"task_count":6543,"rating":4.8,"is_online":true,"is_recommended":false,"is_hot":true,"primary_skill_slug":"a-share-factor-screener","skill_slugs":["a-share-factor-screener","a-share-data-toolkit"],"skill_highlights":[{"title":"多因子打分","description":"从价值、动量、质量等维度给出量化排序。"},{"title":"风格暴露识别","description":"分析当前组合偏向大盘、成长还是红利。"},{"title":"规则化选股","description":"把主观筛选变成可复用的量化框架。"}],"task_examples":["筛出A股质量因子排名前20的股票","做一个偏价值加低波的A股候选池","看看我当前持仓有哪些风格暴露过重"],"conversation_preview":[{"role":"user","content":"帮我做一个A股多因子候选池。"},{"role":"expert","content":"我会先明确因子框架，再用数据工具包拉取指标，最后输出排序名单、因子解释和风险约束。"}],"system_prompt":"你是一名量化投资专家。回答时优先使用清晰的筛选条件、因子框架和可复核的指标，不要只给模糊观点。","mcp_preset_keys":["browser","tavily","serper","yahoo-finance"]}'::jsonb,
    120,
    true
  ),
  (
    'a-share-rotation-strategist',
    'A股行业轮动专家',
    '结合宏观与产业周期分析A股板块轮动，适合做中期配置与景气度判断。',
    'finance',
    'iClaw',
    false,
    true,
    '["A股","行业轮动","宏观"]'::jsonb,
    '["行业景气判断","轮动节奏识别","中期配置建议"]'::jsonb,
    '["判断当前市场偏向哪类行业风格。","构建中期轮动配置框架。","把宏观变量映射到A股行业机会。"]'::jsonb,
    '{"surface":"investment-experts","subtitle":"宏观周期 · 板块轮动 · 中期配置","investment_category":"macro","avatar_url":"https://images.unsplash.com/photo-1758599543154-76ec1c4257df?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080","usage_count":8421,"task_count":6028,"rating":4.8,"is_online":true,"is_recommended":false,"is_hot":false,"primary_skill_slug":"a-share-industry-rotation","skill_slugs":["a-share-industry-rotation","a-share-data-toolkit"],"skill_highlights":[{"title":"行业景气监测","description":"识别景气上行和盈利改善的细分板块。"},{"title":"轮动线索梳理","description":"从政策、利率和库存周期看板块切换。"},{"title":"配置路径建议","description":"给出超配、低配和观察名单。"}],"task_examples":["未来6个月A股哪些行业更值得超配","利率下行环境下A股板块如何轮动","当前市场更偏成长还是红利"],"conversation_preview":[{"role":"user","content":"接下来A股轮动更看好哪些方向？"},{"role":"expert","content":"我会先判断宏观环境，再映射到行业盈利和估值，给你超配、低配和观察三层结论。"}],"system_prompt":"你是一名宏观与行业轮动专家。回答时要把宏观变量、产业逻辑、估值位置和时间维度说清楚，避免只给结论不给链路。","mcp_preset_keys":["browser","tavily","serper","yahoo-finance","fred"]}'::jsonb,
    130,
    true
  ),
  (
    'a-share-signal-scout',
    'A股信号侦察专家',
    '围绕内部交易、小盘成长和数据线索寻找被市场忽视的A股机会，更适合做机会发现。',
    'finance',
    'iClaw',
    false,
    true,
    '["A股","内部人交易","小盘成长"]'::jsonb,
    '["内部交易线索","小盘成长发现","机会清单输出"]'::jsonb,
    '["快速发现被忽视的A股机会。","跟踪管理层信心与资金行为。","搭建高弹性股票观察名单。"]'::jsonb,
    '{"surface":"investment-experts","subtitle":"内部人信号 · 小盘成长 · 机会发现","investment_category":"comprehensive","avatar_url":"https://images.unsplash.com/photo-1772987057599-2f1088c1e993?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080","usage_count":7654,"task_count":5432,"rating":4.7,"is_online":true,"is_recommended":false,"is_hot":false,"primary_skill_slug":"a-share-insider","skill_slugs":["a-share-insider","a-share-small-cap-growth","a-share-data-toolkit"],"skill_highlights":[{"title":"内部人信号识别","description":"跟踪董监高和大股东增减持动向。"},{"title":"小盘成长机会","description":"挖掘关注度不足但成长快的小市值公司。"},{"title":"线索式机会池","description":"把零散异动整理成可追踪清单。"}],"task_examples":["最近A股有哪些管理层增持比较值得跟踪","帮我找几个小盘成长方向的候选标的","把近期的内部交易和小盘成长信号整合成清单"],"conversation_preview":[{"role":"user","content":"最近有哪些A股内部人交易信号值得看？"},{"role":"expert","content":"我会从增持强度、历史行为、一致性和基本面承接能力四个层面筛掉噪音，给你更可信的信号名单。"}],"system_prompt":"你是一名机会发现型研究专家。善于从内部交易、小盘成长和异动数据里挖线索，但必须强调噪音过滤和风险甄别。","mcp_preset_keys":["browser","tavily","serper","yahoo-finance"]}'::jsonb,
    140,
    true
  ),
  (
    'us-value-compass',
    '美股价值配置专家',
    '围绕美股低估值、分红和财务稳健性做组合候选筛选，适合中长期配置研究。',
    'finance',
    'iClaw',
    true,
    true,
    '["美股","价值投资","股息"]'::jsonb,
    '["低估值筛选","股息质量分析","美股长期配置"]'::jsonb,
    '["筛选适合长期持有的美股价值公司。","比较不同红利型公司质量。","构建偏稳健的海外配置候选池。"]'::jsonb,
    '{"surface":"investment-experts","subtitle":"低估值筛选 · 股息质量 · 长期配置","investment_category":"global","avatar_url":"https://images.unsplash.com/photo-1701463387028-3947648f1337?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080","usage_count":9321,"task_count":6880,"rating":4.9,"is_online":true,"is_recommended":true,"is_hot":false,"primary_skill_slug":"us-low-valuation","skill_slugs":["us-low-valuation","us-dividend-aristocrats","us-data-toolkit"],"skill_highlights":[{"title":"美股低估值筛选","description":"从估值、现金流和财务稳健性找便宜货。"},{"title":"股息贵族分析","description":"识别分红历史稳定、质量较高的公司。"},{"title":"海外长期配置","description":"为美股价值配置提供候选池和比较框架。"}],"task_examples":["帮我筛几只美股低估值高现金流公司","对比几只美股股息贵族的分红质量","做一个偏价值风格的美股候选组合"],"conversation_preview":[{"role":"user","content":"现在有哪些美股价值股值得重点看？"},{"role":"expert","content":"我会先排除价值陷阱，再按估值、现金流、分红和行业位置给你分层候选池。"}],"system_prompt":"你是一名美股价值配置专家。优先从估值、自由现金流、资本回报和分红持续性来分析，避免仅凭题材热度做判断。","mcp_preset_keys":["browser","tavily","serper","yahoo-finance","sec-edgar"]}'::jsonb,
    150,
    true
  ),
  (
    'us-sector-rotation-expert',
    '美股行业轮动专家',
    '从宏观周期、行业景气和风格切换出发，帮助判断美股板块轮动与阶段性配置机会。',
    'finance',
    'iClaw',
    false,
    true,
    '["美股","行业轮动","宏观"]'::jsonb,
    '["行业轮动判断","宏观变量映射","风格切换分析"]'::jsonb,
    '["构建美股行业轮动框架。","把宏观环境映射到行业配置。","跟踪成长与价值风格切换。"]'::jsonb,
    '{"surface":"investment-experts","subtitle":"宏观周期 · 板块轮动 · 全球视角","investment_category":"macro","avatar_url":"https://images.unsplash.com/photo-1579540830482-659e7518c895?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080","usage_count":8543,"task_count":6021,"rating":4.8,"is_online":true,"is_recommended":false,"is_hot":false,"primary_skill_slug":"us-industry-rotation","skill_slugs":["us-industry-rotation","us-factor-screener","us-data-toolkit"],"skill_highlights":[{"title":"行业轮动识别","description":"识别未来6到12个月可能占优的板块。"},{"title":"宏观变量映射","description":"把利率、通胀、美元等变量映射到行业表现。"},{"title":"风格切换跟踪","description":"判断成长、价值、防御之间的切换节奏。"}],"task_examples":["降息预期下美股哪些行业更受益","当前美股更适合成长还是价值","给我一份未来半年美股行业轮动框架"],"conversation_preview":[{"role":"user","content":"接下来美股应该重点看哪些行业？"},{"role":"expert","content":"我会先判断宏观阶段，再给出受益行业、受压行业和需要观察的领先指标。"}],"system_prompt":"你是一名美股行业轮动专家。请用全球资产和宏观变量视角来解释行业切换，明确时间框架、催化和风险。","mcp_preset_keys":["browser","tavily","serper","yahoo-finance","fred"]}'::jsonb,
    160,
    true
  )
on conflict (slug)
do update set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  publisher = excluded.publisher,
  featured = excluded.featured,
  official = excluded.official,
  tags = excluded.tags,
  capabilities = excluded.capabilities,
  use_cases = excluded.use_cases,
  metadata_json = excluded.metadata_json,
  sort_order = excluded.sort_order,
  active = excluded.active,
  updated_at = now();

insert into skill_catalog_entries (
  slug,
  name,
  description,
  market,
  category,
  skill_type,
  publisher,
  distribution,
  tags,
  active
) values
  (
    'docx',
    'DOCX 文档工具',
    '创建、编辑和分析 Word 文档，支持修订、批注、格式保留与文本提取。',
    '通用',
    'report',
    '工具包',
    'iClaw',
    'cloud',
    '["文档","Word","办公"]'::jsonb,
    true
  ),
  (
    'xlsx',
    'XLSX 表格工具',
    '创建、编辑和分析电子表格，支持公式、格式、数据处理与可视化。',
    '通用',
    'data',
    '工具包',
    'iClaw',
    'cloud',
    '["表格","Excel","数据"]'::jsonb,
    true
  ),
  (
    'pdf',
    'PDF 工具包',
    '提取文本和表格、合并拆分 PDF、处理表单并生成新的 PDF 文档。',
    '通用',
    'report',
    '工具包',
    'iClaw',
    'cloud',
    '["PDF","文档","办公"]'::jsonb,
    true
  ),
  (
    'a-share-esg',
    'A股ESG筛选分析',
    '从ESG角度筛选A股上市公司，评估可持续发展实践与争议风险。',
    'A股',
    'research',
    '分析师',
    'iClaw',
    'cloud',
    '["A股","ESG","筛选"]'::jsonb,
    true
  ),
  (
    'a-share-factor-screener',
    'A股量化因子筛选',
    '使用多因子框架筛选A股，识别价值、动量、质量等因子暴露有利的股票。',
    'A股',
    'research',
    '扫描器',
    'iClaw',
    'cloud',
    '["A股","量化","因子"]'::jsonb,
    true
  ),
  (
    'a-share-industry-rotation',
    'A股行业轮动检测',
    '通过宏观经济指标与经济周期定位，识别未来可能跑赢或跑输的A股行业。',
    'A股',
    'research',
    '扫描器',
    'iClaw',
    'cloud',
    '["A股","行业","轮动"]'::jsonb,
    true
  ),
  (
    'a-share-data-toolkit',
    'A股金融数据工具包',
    '提供A股实时行情、财务指标、董监高增减持和宏观数据抓取能力。',
    'A股',
    'data',
    '工具包',
    'iClaw',
    'cloud',
    '["A股","数据","工具包"]'::jsonb,
    true
  ),
  (
    'a-share-low-valuation',
    'A股低估值股票筛选',
    '扫描A股低估值机会，筛选基本面稳健但被市场低估的公司。',
    'A股',
    'research',
    '扫描器',
    'iClaw',
    'cloud',
    '["A股","低估值","价值投资"]'::jsonb,
    true
  ),
  (
    'a-share-insider',
    'A股内部交易分析',
    '分析董监高与重要股东增减持行为，识别管理层信心信号与潜在机会。',
    'A股',
    'research',
    '分析师',
    'iClaw',
    'cloud',
    '["A股","内部人交易","管理层"]'::jsonb,
    true
  ),
  (
    'a-share-small-cap-growth',
    'A股小盘成长股筛选',
    '识别A股被忽视的小市值高成长公司，适合寻找高弹性成长机会。',
    'A股',
    'research',
    '扫描器',
    'iClaw',
    'cloud',
    '["A股","小盘成长","高增长"]'::jsonb,
    true
  ),
  (
    'a-share-tech-valuation',
    'A股科技股估值分析',
    '对比分析A股科技公司的估值泡沫与基本面，识别高估与低估标的。',
    'A股',
    'research',
    '分析师',
    'iClaw',
    'cloud',
    '["A股","科技估值","估值"]'::jsonb,
    true
  ),
  (
    'a-share-dividend',
    'A股高股息策略分析',
    '评估A股高股息与红利策略的收益可持续性、分红质量与长期回报。',
    'A股',
    'portfolio',
    '分析师',
    'iClaw',
    'cloud',
    '["A股","红利","股息"]'::jsonb,
    true
  ),
  (
    'us-esg',
    '美股ESG筛选分析',
    '从ESG角度筛选美股公司，评估可持续发展实践、争议风险与治理质量。',
    '美股',
    'research',
    '分析师',
    'iClaw',
    'cloud',
    '["美股","ESG","筛选"]'::jsonb,
    true
  ),
  (
    'us-factor-screener',
    '美股量化因子筛选',
    '使用正式因子模型进行系统性多因子股票筛选，识别因子暴露有利的股票。',
    '美股',
    'research',
    '扫描器',
    'iClaw',
    'cloud',
    '["美股","量化","因子"]'::jsonb,
    true
  ),
  (
    'us-industry-rotation',
    '美股行业轮动检测',
    '通过宏观经济指标和商业周期定位，识别未来可能表现优异或落后的美股行业。',
    '美股',
    'research',
    '扫描器',
    'iClaw',
    'cloud',
    '["美股","行业","轮动"]'::jsonb,
    true
  ),
  (
    'us-data-toolkit',
    '美股金融数据工具包',
    '提供实时股票数据、SEC 文件、财务计算器和宏观指标抓取能力。',
    '美股',
    'data',
    '工具包',
    'iClaw',
    'cloud',
    '["美股","数据","工具包"]'::jsonb,
    true
  ),
  (
    'us-low-valuation',
    '美股低估值股票筛选',
    '筛选基本面扎实但估值偏低的美股公司，适合价值投资与安全边际场景。',
    '美股',
    'research',
    '扫描器',
    'iClaw',
    'cloud',
    '["美股","低估值","价值投资"]'::jsonb,
    true
  ),
  (
    'us-insider',
    '美股内部人交易分析',
    '分析内部人交易模式与表格披露，识别管理层增持与看涨信号。',
    '美股',
    'research',
    '分析师',
    'iClaw',
    'cloud',
    '["美股","内部人交易","管理层"]'::jsonb,
    true
  ),
  (
    'us-small-cap-growth',
    '美股小盘成长股筛选',
    '筛选小市值高成长、机构覆盖少但基本面强劲的美股成长机会。',
    '美股',
    'research',
    '扫描器',
    'iClaw',
    'cloud',
    '["美股","小盘成长","高增长"]'::jsonb,
    true
  ),
  (
    'us-tech-valuation',
    '美股科技股估值分析',
    '对比头部科技公司增长与估值，区分合理定价与高估泡沫。',
    '美股',
    'research',
    '分析师',
    'iClaw',
    'cloud',
    '["美股","科技估值","估值"]'::jsonb,
    true
  ),
  (
    'us-dividend-aristocrats',
    '美股股息贵族分析',
    '分析连续提高分红的美股公司，评估股息可持续性与长期总回报。',
    '美股',
    'portfolio',
    '分析师',
    'iClaw',
    'cloud',
    '["美股","股息","红利"]'::jsonb,
    true
  )
on conflict (slug) do nothing;

update skill_catalog_entries entry
set distribution = 'cloud',
    version = seeded.version,
    artifact_format = seeded.artifact_format,
    artifact_url = seeded.artifact_url,
    artifact_sha256 = seeded.artifact_sha256,
    artifact_source_path = null,
    origin_type = seeded.origin_type,
    source_url = seeded.source_url,
    updated_at = now()
from (
  values
    ('docx', '1.0.0', 'tar.gz', null::text, null::text, null::text, 'manual', null::text),
    ('xlsx', '1.0.0', 'tar.gz', null, null, null, 'manual', null),
    ('pdf', '1.0.0', 'tar.gz', null, null, null, 'manual', null),
    ('a-share-esg', '1.0.0', 'tar.gz', null, null, null, 'manual', null),
    ('a-share-factor-screener', '1.0.0', 'tar.gz', null, null, null, 'manual', null),
    ('a-share-industry-rotation', '1.0.0', 'tar.gz', null, null, null, 'manual', null),
    ('a-share-data-toolkit', '1.0.0', 'tar.gz', null, null, null, 'manual', null),
    ('a-share-low-valuation', '1.0.0', 'tar.gz', null, null, null, 'manual', null),
    ('a-share-insider', '1.0.0', 'tar.gz', null, null, null, 'manual', null),
    ('a-share-small-cap-growth', '1.0.0', 'tar.gz', null, null, null, 'manual', null),
    ('a-share-tech-valuation', '1.0.0', 'tar.gz', null, null, null, 'manual', null),
    ('a-share-dividend', '1.0.0', 'tar.gz', null, null, null, 'manual', null),
    ('us-esg', '1.0.0', 'tar.gz', null, null, null, 'manual', null),
    ('us-factor-screener', '1.0.0', 'tar.gz', null, null, null, 'manual', null),
    ('us-industry-rotation', '1.0.0', 'tar.gz', null, null, null, 'manual', null),
    ('us-data-toolkit', '1.0.0', 'tar.gz', null, null, null, 'manual', null),
    ('us-low-valuation', '1.0.0', 'tar.gz', null, null, null, 'manual', null),
    ('us-insider', '1.0.0', 'tar.gz', null, null, null, 'manual', null),
    ('us-small-cap-growth', '1.0.0', 'tar.gz', null, null, null, 'manual', null),
    ('us-tech-valuation', '1.0.0', 'tar.gz', null, null, null, 'manual', null),
    ('us-dividend-aristocrats', '1.0.0', 'tar.gz', null, null, null, 'manual', null)
) as seeded(slug, version, artifact_format, artifact_url, artifact_sha256, artifact_source_path, origin_type, source_url)
where entry.slug = seeded.slug;

insert into skill_catalog_entries (
  slug,
  name,
  description,
  market,
  category,
  skill_type,
  publisher,
  distribution,
  tags,
  active
) values
  (
    'admapix',
    'AdMapix',
    '广告素材检索、App 排名、下载收入追踪与市场洞察助手，适合增长运营与竞品研究。',
    '通用',
    'data',
    '工具包',
    'ClawHub · fly0pants',
    'cloud',
    '["运营增长","广告投放","市场洞察"]'::jsonb,
    true
  ),
  (
    'marketing-strategy-pmm',
    'Marketing Strategy Pmm',
    '围绕定位、GTM、竞品洞察与产品发布制定产品营销策略，适合产品营销与增长规划。',
    '通用',
    'general',
    '分析师',
    'ClawHub · alirezarezvani',
    'cloud',
    '["运营增长","GTM","产品营销"]'::jsonb,
    true
  ),
  (
    'marketing-demand-acquisition',
    'Marketing Demand Acquisition',
    '设计获客投放、SEO 与渠道增长方案，适合增长运营、需求获取与渠道扩张场景。',
    '通用',
    'general',
    '分析师',
    'ClawHub · alirezarezvani',
    'cloud',
    '["运营增长","增长获客","SEO"]'::jsonb,
    true
  ),
  (
    'revenue-operations',
    'Revenue Operations',
    '分析销售漏斗、收入预测与 GTM 效率，适合营收运营和销售流程优化。',
    '通用',
    'data',
    '分析师',
    'ClawHub · alirezarezvani',
    'cloud',
    '["运营增长","营收运营","销售漏斗"]'::jsonb,
    true
  ),
  (
    'x-publisher',
    'X tweet publisher',
    '发布 X/Twitter 文本、图片和视频内容，适合账号运营与社交分发。',
    '通用',
    'general',
    '工具包',
    'ClawHub · AlphaFactor',
    'cloud',
    '["自媒体","社交分发","X"]'::jsonb,
    true
  ),
  (
    'ghost',
    'ghost cms',
    '管理 Ghost CMS 博客文章的创建、更新、删除与列表，适合内容发布与博客运维。',
    '通用',
    'report',
    '工具包',
    'ClawHub · AlphaFactor',
    'cloud',
    '["自媒体","博客","内容管理"]'::jsonb,
    true
  ),
  (
    'video-transcript-downloader',
    'Video Transcript Downloader',
    '下载视频、音频、字幕并生成清洗后的 transcript，适合内容二创与素材整理。',
    '通用',
    'data',
    '工具包',
    'ClawHub · steipete',
    'cloud',
    '["自媒体","视频","转录"]'::jsonb,
    true
  ),
  (
    'video-summary',
    'Video Summary',
    '总结 B 站、小红书、抖音与 YouTube 视频内容，提炼结构化洞察和重点摘要。',
    '通用',
    'report',
    '生成器',
    'ClawHub · lifei68801',
    'cloud',
    '["自媒体","视频总结","内容创作"]'::jsonb,
    true
  ),
  (
    'xiaohongshu-search-summarizer',
    'Xiaohongshu Search Summarizer',
    '搜索小红书关键词，提取笔记、图片与评论并生成总结，适合选题与内容洞察。',
    '通用',
    'report',
    '扫描器',
    'ClawHub · piekill',
    'cloud',
    '["自媒体","小红书","内容洞察"]'::jsonb,
    true
  ),
  (
    'productivity',
    'Productivity',
    '围绕时间块、目标、项目、习惯和复盘提升个人执行效率，适合超级个体日常工作流。',
    '通用',
    'general',
    '分析师',
    'ClawHub · ivangdavila',
    'cloud',
    '["超级个体","效率","任务管理"]'::jsonb,
    true
  ),
  (
    'notion-sync',
    'Notion Sync',
    '双向同步和管理 Notion 页面与数据库，适合个人知识库与项目协作。',
    '通用',
    'data',
    '工具包',
    'ClawHub · robansuini',
    'cloud',
    '["超级个体","Notion","知识库"]'::jsonb,
    true
  ),
  (
    'todo',
    'Todo',
    '管理任务、项目、提醒、承诺与 follow-up，帮助个人形成执行闭环。',
    '通用',
    'general',
    '工具包',
    'ClawHub · agenticio',
    'cloud',
    '["超级个体","待办","任务管理"]'::jsonb,
    true
  ),
  (
    'cron',
    'Cron',
    '本地优先的周期计划与重复提醒引擎，适合 recurring task 与定时执行场景。',
    '通用',
    'general',
    '工具包',
    'ClawHub · qclawbot',
    'cloud',
    '["超级个体","定时","自动化"]'::jsonb,
    true
  ),
  (
    'temporal-cortex',
    'temporal-cortex',
    '管理 Google、Outlook 与 CalDAV 日历、会议和可用时间，适合个人日程协同。',
    '通用',
    'general',
    '工具包',
    'ClawHub · billylui',
    'cloud',
    '["超级个体","日程","日历"]'::jsonb,
    true
  ),
  (
    'word-docx',
    'Word / DOCX',
    '创建、检查和编辑 Word 文档，支持样式、编号、修订、表格与兼容性检查。',
    '通用',
    'report',
    '工具包',
    'ClawHub · ivangdavila',
    'cloud',
    '["办公效率","文档","Word"]'::jsonb,
    true
  ),
  (
    'excel-xlsx',
    'Excel / XLSX',
    '创建、检查和编辑 Excel 工作簿，支持公式、格式、数据类型与重算。',
    '通用',
    'data',
    '工具包',
    'ClawHub · ivangdavila',
    'cloud',
    '["办公效率","表格","Excel"]'::jsonb,
    true
  ),
  (
    'powerpoint-pptx',
    'Powerpoint / PPTX',
    '创建、检查和编辑 PowerPoint 演示文稿，支持模板、布局、备注与图表。',
    '通用',
    'report',
    '工具包',
    'ClawHub · ivangdavila',
    'cloud',
    '["办公效率","演示","PPT"]'::jsonb,
    true
  ),
  (
    'paddleocr-doc-parsing',
    'PaddleOCR Document Parsing',
    '将复杂 PDF 与文档图片解析为保留结构的 Markdown 和 JSON，适合文档数字化。',
    '通用',
    'data',
    '工具包',
    'ClawHub · Bobholamovic',
    'cloud',
    '["办公效率","OCR","文档解析"]'::jsonb,
    true
  ),
  (
    'feishu-send-file',
    'feishu-send-file',
    '通过飞书发送附件与文件，适合办公协同、结果交付与自动化通知。',
    '通用',
    'general',
    '工具包',
    'ClawHub · dadaniya99',
    'cloud',
    '["办公效率","飞书","协同"]'::jsonb,
    true
  )
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  market = excluded.market,
  category = excluded.category,
  skill_type = excluded.skill_type,
  publisher = excluded.publisher,
  distribution = excluded.distribution,
  tags = excluded.tags,
  active = excluded.active,
  updated_at = now();

update skill_catalog_entries entry
set version = seeded.version,
    artifact_format = seeded.artifact_format,
    artifact_url = seeded.artifact_url,
    artifact_sha256 = seeded.artifact_sha256,
    artifact_source_path = seeded.artifact_source_path,
    origin_type = seeded.origin_type,
    source_url = seeded.source_url,
    updated_at = now()
from (
  values
    ('admapix', '1.0.14', 'zip', 'https://wry-manatee-359.convex.site/api/v1/download?slug=admapix&version=1.0.14', null::text, null::text, 'clawhub', 'https://wry-manatee-359.convex.site/skills/admapix'),
    ('marketing-strategy-pmm', '2.1.1', 'zip', 'https://wry-manatee-359.convex.site/api/v1/download?slug=marketing-strategy-pmm&version=2.1.1', null, null, 'clawhub', 'https://wry-manatee-359.convex.site/skills/marketing-strategy-pmm'),
    ('marketing-demand-acquisition', '2.1.1', 'zip', 'https://wry-manatee-359.convex.site/api/v1/download?slug=marketing-demand-acquisition&version=2.1.1', null, null, 'clawhub', 'https://wry-manatee-359.convex.site/skills/marketing-demand-acquisition'),
    ('revenue-operations', '1.0.0', 'zip', 'https://wry-manatee-359.convex.site/api/v1/download?slug=revenue-operations&version=1.0.0', null, null, 'clawhub', 'https://wry-manatee-359.convex.site/skills/revenue-operations'),
    ('x-publisher', '1.0.6', 'zip', 'https://wry-manatee-359.convex.site/api/v1/download?slug=x-publisher&version=1.0.6', null, null, 'clawhub', 'https://wry-manatee-359.convex.site/skills/x-publisher'),
    ('ghost', '1.0.5', 'zip', 'https://wry-manatee-359.convex.site/api/v1/download?slug=ghost&version=1.0.5', null, null, 'clawhub', 'https://wry-manatee-359.convex.site/skills/ghost'),
    ('video-transcript-downloader', '1.0.0', 'zip', 'https://wry-manatee-359.convex.site/api/v1/download?slug=video-transcript-downloader&version=1.0.0', null, null, 'clawhub', 'https://wry-manatee-359.convex.site/skills/video-transcript-downloader'),
    ('video-summary', '1.6.4', 'zip', 'https://wry-manatee-359.convex.site/api/v1/download?slug=video-summary&version=1.6.4', null, null, 'clawhub', 'https://wry-manatee-359.convex.site/skills/video-summary'),
    ('xiaohongshu-search-summarizer', '1.0.3', 'zip', 'https://wry-manatee-359.convex.site/api/v1/download?slug=xiaohongshu-search-summarizer&version=1.0.3', null, null, 'clawhub', 'https://wry-manatee-359.convex.site/skills/xiaohongshu-search-summarizer'),
    ('productivity', '1.0.4', 'zip', 'https://wry-manatee-359.convex.site/api/v1/download?slug=productivity&version=1.0.4', null, null, 'clawhub', 'https://wry-manatee-359.convex.site/skills/productivity'),
    ('notion-sync', '2.5.3', 'zip', 'https://wry-manatee-359.convex.site/api/v1/download?slug=notion-sync&version=2.5.3', null, null, 'clawhub', 'https://wry-manatee-359.convex.site/skills/notion-sync'),
    ('todo', '3.0.1', 'zip', 'https://wry-manatee-359.convex.site/api/v1/download?slug=todo&version=3.0.1', null, null, 'clawhub', 'https://wry-manatee-359.convex.site/skills/todo'),
    ('cron', '1.0.0', 'zip', 'https://wry-manatee-359.convex.site/api/v1/download?slug=cron&version=1.0.0', null, null, 'clawhub', 'https://wry-manatee-359.convex.site/skills/cron'),
    ('temporal-cortex', '0.9.1', 'zip', 'https://wry-manatee-359.convex.site/api/v1/download?slug=temporal-cortex&version=0.9.1', null, null, 'clawhub', 'https://wry-manatee-359.convex.site/skills/temporal-cortex'),
    ('word-docx', '1.0.2', 'zip', 'https://wry-manatee-359.convex.site/api/v1/download?slug=word-docx&version=1.0.2', null, null, 'clawhub', 'https://wry-manatee-359.convex.site/skills/word-docx'),
    ('excel-xlsx', '1.0.2', 'zip', 'https://wry-manatee-359.convex.site/api/v1/download?slug=excel-xlsx&version=1.0.2', null, null, 'clawhub', 'https://wry-manatee-359.convex.site/skills/excel-xlsx'),
    ('powerpoint-pptx', '1.0.1', 'zip', 'https://wry-manatee-359.convex.site/api/v1/download?slug=powerpoint-pptx&version=1.0.1', null, null, 'clawhub', 'https://wry-manatee-359.convex.site/skills/powerpoint-pptx'),
    ('paddleocr-doc-parsing', '2.0.8', 'zip', 'https://wry-manatee-359.convex.site/api/v1/download?slug=paddleocr-doc-parsing&version=2.0.8', null, null, 'clawhub', 'https://wry-manatee-359.convex.site/skills/paddleocr-doc-parsing'),
    ('feishu-send-file', '1.2.1', 'zip', 'https://wry-manatee-359.convex.site/api/v1/download?slug=feishu-send-file&version=1.2.1', null, null, 'clawhub', 'https://wry-manatee-359.convex.site/skills/feishu-send-file')
) as seeded(slug, version, artifact_format, artifact_url, artifact_sha256, artifact_source_path, origin_type, source_url)
where entry.slug = seeded.slug;

insert into skill_sync_sources (
  id,
  source_type,
  source_key,
  display_name,
  source_url,
  config_json,
  active
) values (
  'clawhub-top',
  'clawhub',
  'clawhub:catalog',
  'ClawHub 全量技能',
  'https://clawhub.ai',
  '{"sort":"downloads","limit":0,"page_size":100,"detail_concurrency":8,"include_detail":false,"convex_url":"https://wry-manatee-359.convex.cloud","detail_api_base":"https://wry-manatee-359.convex.site/api/v1","client_version":"npm-1.34.0"}'::jsonb,
  true
)
on conflict (id) do update set
  source_type = excluded.source_type,
  source_key = excluded.source_key,
  display_name = excluded.display_name,
  source_url = excluded.source_url,
  config_json = excluded.config_json,
  active = excluded.active,
  updated_at = now();

update skill_catalog_entries
set active = false,
    updated_at = now()
where slug in ('github', 'gog', 'ontology', 'skill-vetter', 'summarize');

create index if not exists idx_device_sessions_user_id on device_sessions(user_id);
create index if not exists idx_access_tokens_user_id on access_tokens(user_id);
create index if not exists idx_access_tokens_device_session_id on access_tokens(device_session_id);
create index if not exists idx_user_emails_user_id on user_emails(user_id);
create index if not exists idx_user_oauth_accounts_user_id on user_oauth_accounts(user_id);
create index if not exists idx_refresh_tokens_user_id on refresh_tokens(user_id);
create index if not exists idx_refresh_tokens_device_session_id on refresh_tokens(device_session_id);
create index if not exists idx_run_grants_nonce on run_grants(nonce);
create index if not exists idx_usage_events_event_id on usage_events(event_id);
create index if not exists idx_credit_ledger_user_id_created_at on credit_ledger(user_id, created_at desc);
create index if not exists idx_run_grants_user_id_created_at on run_grants(user_id, created_at desc);
create index if not exists idx_run_grants_billing_session_lookup
  on run_grants (
    user_id,
    (coalesce(metadata->>'session_key', 'main')),
    (coalesce(used_at, created_at)) desc,
    created_at desc
  )
  where status = 'settled' and metadata ? 'billing_summary';
create index if not exists idx_usage_events_user_id_created_at on usage_events(user_id, created_at desc);
create index if not exists idx_payment_orders_created_at
  on payment_orders(created_at desc);
create index if not exists idx_payment_orders_status_created_at
  on payment_orders(status, created_at desc);
create index if not exists idx_payment_orders_provider_created_at
  on payment_orders(provider, created_at desc);
create index if not exists idx_payment_orders_app_name_created_at
  on payment_orders((coalesce(metadata->>'app_name', '')), created_at desc);
create index if not exists idx_payment_webhook_events_order_created_at
  on payment_webhook_events(order_id, created_at desc);
create index if not exists idx_user_workspace_backups_updated_at on user_workspace_backups(updated_at desc);
create index if not exists idx_agent_catalog_entries_active_sort
  on agent_catalog_entries(active, sort_order, name);
create index if not exists idx_user_agent_library_user_id_installed_at
  on user_agent_library(user_id, installed_at desc);
drop index if exists idx_skill_catalog_entries_distribution_active;
create index if not exists idx_skill_catalog_entries_distribution_active
  on skill_catalog_entries(distribution, active);
create index if not exists idx_skill_sync_sources_type_active
  on skill_sync_sources(source_type, active, display_name);
create index if not exists idx_skill_sync_runs_source_started_at
  on skill_sync_runs(source_id, started_at desc);
create index if not exists idx_skill_sync_runs_started_at
  on skill_sync_runs(started_at desc);
create index if not exists idx_user_private_skills_user_updated_at
  on user_private_skills(user_id, updated_at desc, created_at desc);
create index if not exists idx_user_skill_library_user_id_installed_at
  on user_skill_library(user_id, installed_at desc);
create index if not exists idx_user_mcp_library_user_id_installed_at
  on user_mcp_library(user_id, installed_at desc);
create index if not exists idx_app_payment_provider_overrides_provider_app
  on app_payment_provider_overrides(provider, app_name);
create index if not exists idx_payment_provider_profiles_scope_lookup
  on payment_provider_profiles(scope_type, scope_key, provider, display_name);
create index if not exists idx_platform_bundled_skills_sort
  on platform_bundled_skills(active, sort_order, skill_slug);
create index if not exists idx_cloud_mcp_catalog_active_name
  on cloud_mcp_catalog(active, name);
create index if not exists idx_platform_bundled_mcps_sort
  on platform_bundled_mcps(active, sort_order, mcp_key);
create index if not exists idx_oem_bundled_skills_app_sort
  on oem_bundled_skills(app_name, sort_order, skill_slug);
create index if not exists idx_oem_bundled_mcps_app_sort
  on oem_bundled_mcps(app_name, sort_order, mcp_key);
create index if not exists idx_oem_app_model_bindings_app_sort
  on oem_app_model_bindings(app_name, sort_order, model_ref);

create index if not exists idx_model_provider_profiles_scope_sort
  on model_provider_profiles(scope_type, scope_key, sort_order, provider_key);

create index if not exists idx_model_provider_profile_models_profile_sort
  on model_provider_profile_models(profile_id, sort_order, model_ref);

create index if not exists idx_app_model_runtime_overrides_mode
  on app_model_runtime_overrides(provider_mode, app_name);
create index if not exists idx_memory_embedding_profiles_scope
  on memory_embedding_profiles(scope_type, scope_key, enabled);
create index if not exists idx_oem_app_menu_bindings_app_sort
  on oem_app_menu_bindings(app_name, sort_order, menu_key);
create index if not exists idx_oem_menu_catalog_category_key
  on oem_menu_catalog(category, menu_key);
create index if not exists idx_market_stock_catalog_market_exchange_symbol
  on market_stock_catalog(market, exchange, symbol);
create index if not exists idx_market_stock_catalog_company_name
  on market_stock_catalog(company_name);
create index if not exists idx_market_stock_catalog_total_market_cap
  on market_stock_catalog(total_market_cap desc nulls last);
create index if not exists idx_market_stock_catalog_change_percent
  on market_stock_catalog(change_percent desc nulls last);
create index if not exists idx_market_stock_catalog_turnover_rate
  on market_stock_catalog(turnover_rate desc nulls last);
create index if not exists idx_market_stock_catalog_strategy_tags
  on market_stock_catalog using gin(strategy_tags);
create index if not exists idx_market_fund_catalog_market_exchange_symbol
  on market_fund_catalog(market, exchange, symbol);
create index if not exists idx_market_fund_catalog_fund_name
  on market_fund_catalog(fund_name);
create index if not exists idx_market_fund_catalog_instrument_kind_region
  on market_fund_catalog(instrument_kind, region);
create index if not exists idx_market_fund_catalog_return_1y
  on market_fund_catalog(return_1y desc nulls last);
create index if not exists idx_market_fund_catalog_change_percent
  on market_fund_catalog(change_percent desc nulls last);
create index if not exists idx_market_fund_catalog_scale_amount
  on market_fund_catalog(scale_amount desc nulls last);
create index if not exists idx_market_fund_catalog_strategy_tags
  on market_fund_catalog using gin(strategy_tags);
create index if not exists idx_oem_composer_control_catalog_type_key
  on oem_composer_control_catalog(control_type, control_key);
create index if not exists idx_oem_composer_control_option_catalog_sort
  on oem_composer_control_option_catalog(control_key, sort_order, option_value);
create index if not exists idx_oem_composer_shortcut_catalog_sort
  on oem_composer_shortcut_catalog(shortcut_key);
create index if not exists idx_oem_app_composer_control_bindings_app_sort
  on oem_app_composer_control_bindings(app_name, sort_order, control_key);
create index if not exists idx_oem_app_composer_shortcut_bindings_app_sort
  on oem_app_composer_shortcut_bindings(app_name, sort_order, shortcut_key);
create index if not exists idx_oem_app_assets_app_updated
  on oem_app_assets(app_name, updated_at desc, asset_key);
create index if not exists idx_oem_app_releases_app_published
  on oem_app_releases(app_name, published_at desc, version_no desc);
create index if not exists idx_oem_app_audit_events_app_created
  on oem_app_audit_events(app_name, created_at desc);
