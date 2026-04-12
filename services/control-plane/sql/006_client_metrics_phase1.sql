create table if not exists client_metric_events (
  id text primary key,
  event_name text not null,
  event_time timestamptz not null,
  user_id uuid references users(id) on delete set null,
  device_id text not null,
  session_id text,
  install_id text,
  app_name text not null,
  brand_id text not null,
  app_version text not null,
  release_channel text,
  platform text not null,
  os_version text,
  arch text not null,
  page text,
  result text,
  error_code text,
  duration_ms integer,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists client_crash_events (
  id text primary key,
  crash_type text not null,
  event_time timestamptz not null,
  user_id uuid references users(id) on delete set null,
  device_id text not null,
  app_name text not null,
  brand_id text not null,
  app_version text not null,
  platform text not null,
  os_version text,
  arch text not null,
  error_title text,
  error_message text,
  stack_summary text,
  file_bucket text,
  file_key text,
  created_at timestamptz not null default now()
);

create index if not exists idx_client_metric_events_name_time
  on client_metric_events(event_name, event_time desc);
create index if not exists idx_client_metric_events_version_time
  on client_metric_events(app_version, event_time desc);
create index if not exists idx_client_metric_events_platform_time
  on client_metric_events(platform, event_time desc);
create index if not exists idx_client_metric_events_device_time
  on client_metric_events(device_id, event_time desc);

create index if not exists idx_client_crash_events_version_time
  on client_crash_events(app_version, event_time desc);
create index if not exists idx_client_crash_events_platform_time
  on client_crash_events(platform, event_time desc);
create index if not exists idx_client_crash_events_device_time
  on client_crash_events(device_id, event_time desc);
