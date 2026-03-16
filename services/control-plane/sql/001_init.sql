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
  balance bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists credit_ledger (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  event_type text not null,
  delta bigint not null,
  balance_after bigint not null,
  reference_type text,
  reference_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

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

create table if not exists user_workspace_backups (
  user_id uuid primary key references users(id) on delete cascade,
  identity_md text not null,
  user_md text not null,
  soul_md text not null,
  agents_md text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists skill_catalog_entries (
  slug text primary key,
  name text not null,
  description text not null,
  visibility text not null default 'showcase',
  market text,
  category text,
  skill_type text,
  publisher text not null default 'iClaw',
  distribution text not null default 'cloud',
  tags jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists skill_releases (
  skill_slug text not null references skill_catalog_entries(slug) on delete cascade,
  version text not null,
  artifact_format text not null,
  artifact_url text,
  artifact_sha256 text,
  artifact_source_path text,
  status text not null default 'published',
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (skill_slug, version)
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

insert into skill_catalog_entries (
  slug,
  name,
  description,
  visibility,
  market,
  category,
  skill_type,
  publisher,
  distribution,
  tags,
  active
) values
  (
    'a-share-esg',
    'A股ESG筛选分析',
    '从ESG角度筛选A股上市公司，评估可持续发展实践与争议风险。',
    'showcase',
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
    'showcase',
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
    'showcase',
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
    'showcase',
    'A股',
    'data',
    '工具包',
    'iClaw',
    'cloud',
    '["A股","数据","工具包"]'::jsonb,
    true
  ),
  (
    'us-esg',
    '美股ESG筛选分析',
    '从ESG角度筛选美股公司，评估可持续发展实践、争议风险与治理质量。',
    'showcase',
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
    'showcase',
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
    'showcase',
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
    'showcase',
    '美股',
    'data',
    '工具包',
    'iClaw',
    'cloud',
    '["美股","数据","工具包"]'::jsonb,
    true
  )
on conflict (slug) do nothing;

insert into skill_releases (
  skill_slug,
  version,
  artifact_format,
  artifact_url,
  artifact_sha256,
  artifact_source_path,
  status,
  published_at
) values
  ('a-share-esg', '1.0.0', 'tar.gz', null, null, 'A股ESG筛选器', 'published', now()),
  ('a-share-factor-screener', '1.0.0', 'tar.gz', null, null, 'A股量化因子筛选器', 'published', now()),
  ('a-share-industry-rotation', '1.0.0', 'tar.gz', null, null, 'A股行业轮动探测器', 'published', now()),
  ('a-share-data-toolkit', '1.0.0', 'tar.gz', null, null, 'A股数据工具包', 'published', now()),
  ('us-esg', '1.0.0', 'tar.gz', null, null, '美股ESG筛选器', 'published', now()),
  ('us-factor-screener', '1.0.0', 'tar.gz', null, null, '美股量化因子扫描器', 'published', now()),
  ('us-industry-rotation', '1.0.0', 'tar.gz', null, null, '美股行业轮动探测器', 'published', now()),
  ('us-data-toolkit', '1.0.0', 'tar.gz', null, null, '美股数据工具包', 'published', now())
on conflict (skill_slug, version) do nothing;

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
create index if not exists idx_usage_events_user_id_created_at on usage_events(user_id, created_at desc);
create index if not exists idx_user_workspace_backups_updated_at on user_workspace_backups(updated_at desc);
create index if not exists idx_skill_catalog_entries_distribution_active
  on skill_catalog_entries(distribution, active, name);
create index if not exists idx_skill_releases_skill_slug_published_at
  on skill_releases(skill_slug, published_at desc, created_at desc);
create index if not exists idx_user_skill_library_user_id_installed_at
  on user_skill_library(user_id, installed_at desc);
