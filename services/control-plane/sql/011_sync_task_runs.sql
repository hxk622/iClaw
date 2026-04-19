create table if not exists sync_task_runs (
  run_id text primary key,
  task_id text not null,
  task_label text not null,
  category text not null,
  trigger_type text not null,
  schedule text,
  status text not null,
  started_at timestamptz not null,
  finished_at timestamptz,
  duration_ms integer,
  sync_count integer,
  data_source text,
  error_message text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sync_task_runs_task_started
  on sync_task_runs(task_id, started_at desc);

create index if not exists idx_sync_task_runs_status_started
  on sync_task_runs(status, started_at desc);

create index if not exists idx_sync_task_runs_trigger_started
  on sync_task_runs(trigger_type, started_at desc);
