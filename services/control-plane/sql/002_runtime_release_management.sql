create table if not exists runtime_release_catalog (
  id uuid primary key,
  runtime_kind text not null,
  version text not null,
  channel text not null,
  platform text not null,
  arch text not null,
  target_triple text not null,
  artifact_type text not null default 'tar.gz',
  storage_provider text not null default 's3',
  bucket_name text,
  object_key text,
  artifact_url text not null,
  artifact_sha256 text,
  artifact_size_bytes bigint,
  launcher_relative_path text,
  git_commit text,
  git_tag text,
  release_version text,
  build_time timestamptz,
  build_info_json jsonb not null default '{}'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  unique (runtime_kind, channel, target_triple, version),
  unique (artifact_url)
);

create table if not exists runtime_release_bindings (
  id uuid primary key,
  scope_type text not null,
  scope_key text not null,
  runtime_kind text not null,
  channel text not null,
  platform text not null,
  arch text not null,
  target_triple text not null,
  release_id uuid not null references runtime_release_catalog(id) on delete restrict,
  enabled boolean not null default true,
  metadata_json jsonb not null default '{}'::jsonb,
  updated_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scope_type, scope_key, runtime_kind, channel, target_triple)
);

create table if not exists runtime_release_binding_history (
  id uuid primary key,
  binding_id uuid not null references runtime_release_bindings(id) on delete cascade,
  scope_type text not null,
  scope_key text not null,
  runtime_kind text not null,
  channel text not null,
  platform text not null,
  arch text not null,
  target_triple text not null,
  from_release_id uuid references runtime_release_catalog(id) on delete set null,
  to_release_id uuid references runtime_release_catalog(id) on delete set null,
  change_reason text,
  operator_user_id uuid references users(id) on delete set null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_runtime_release_catalog_lookup
  on runtime_release_catalog(runtime_kind, channel, target_triple, status, published_at desc nulls last);

create index if not exists idx_runtime_release_catalog_build_commit
  on runtime_release_catalog(git_commit, release_version, build_time desc nulls last);

create index if not exists idx_runtime_release_bindings_scope_lookup
  on runtime_release_bindings(scope_type, scope_key, runtime_kind, channel, target_triple);

create index if not exists idx_runtime_release_bindings_release_id
  on runtime_release_bindings(release_id);

create index if not exists idx_runtime_release_binding_history_binding_created
  on runtime_release_binding_history(binding_id, created_at desc);

create index if not exists idx_runtime_release_binding_history_scope_created
  on runtime_release_binding_history(scope_type, scope_key, runtime_kind, channel, target_triple, created_at desc);
