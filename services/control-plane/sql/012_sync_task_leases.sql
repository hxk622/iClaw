create table if not exists sync_task_leases (
  task_id text primary key,
  owner_token text not null,
  run_id text,
  trigger_type text not null,
  leased_until timestamptz not null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sync_task_leases_leased_until
  on sync_task_leases(leased_until);
