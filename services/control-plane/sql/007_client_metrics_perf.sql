create table if not exists client_perf_samples (
  id text primary key,
  metric_name text not null,
  metric_time timestamptz not null,
  user_id uuid references users(id) on delete set null,
  device_id text not null,
  app_name text not null,
  brand_id text not null,
  app_version text not null,
  release_channel text,
  platform text not null,
  os_version text,
  arch text not null,
  value numeric not null,
  unit text not null,
  sample_rate numeric,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_client_perf_samples_name_time
  on client_perf_samples(metric_name, metric_time desc);
create index if not exists idx_client_perf_samples_version_time
  on client_perf_samples(app_version, metric_time desc);
create index if not exists idx_client_perf_samples_platform_time
  on client_perf_samples(platform, metric_time desc);
create index if not exists idx_client_perf_samples_device_time
  on client_perf_samples(device_id, metric_time desc);
