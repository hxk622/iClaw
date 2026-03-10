create table if not exists users (
  id uuid primary key,
  username text not null unique,
  display_name text,
  avatar_url text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table users add column if not exists avatar_url text;

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
