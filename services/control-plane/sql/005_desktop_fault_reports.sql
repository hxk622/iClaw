create table if not exists desktop_fault_reports (
  id text primary key,
  report_id text not null,
  entry text not null,
  account_state text not null,
  user_id uuid references users(id) on delete set null,
  device_id text not null,
  install_session_id text,
  app_name text not null,
  brand_id text not null,
  app_version text not null,
  release_channel text,
  platform text not null,
  platform_version text,
  arch text not null,
  failure_stage text not null,
  error_title text not null,
  error_message text not null,
  error_code text,
  runtime_found boolean not null default false,
  runtime_installable boolean not null default false,
  runtime_version text,
  runtime_path text,
  work_dir text,
  log_dir text,
  runtime_download_url text,
  install_progress_phase text,
  install_progress_percent integer,
  upload_bucket text not null,
  upload_key text not null,
  file_name text not null,
  file_size_bytes bigint not null,
  file_sha256 text,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_desktop_fault_reports_report_id
  on desktop_fault_reports(report_id);
create index if not exists idx_desktop_fault_reports_created
  on desktop_fault_reports(created_at desc);
create index if not exists idx_desktop_fault_reports_device_created
  on desktop_fault_reports(device_id, created_at desc);
create index if not exists idx_desktop_fault_reports_user_created
  on desktop_fault_reports(user_id, created_at desc);
create index if not exists idx_desktop_fault_reports_platform_created
  on desktop_fault_reports(platform, created_at desc);
