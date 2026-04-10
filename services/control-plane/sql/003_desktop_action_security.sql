create table if not exists desktop_action_policy_rules (
  id text primary key,
  scope text not null,
  scope_id text,
  name text not null,
  effect text not null,
  capability text not null,
  risk_level text not null,
  official_only boolean not null default false,
  skill_slugs jsonb not null default '[]'::jsonb,
  workflow_ids jsonb not null default '[]'::jsonb,
  path_prefixes jsonb not null default '[]'::jsonb,
  domains jsonb not null default '[]'::jsonb,
  ports jsonb not null default '[]'::jsonb,
  allow_elevation boolean not null default false,
  allow_network_egress boolean not null default false,
  grant_scope text not null default 'once',
  ttl_seconds integer,
  enabled boolean not null default true,
  priority integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists desktop_action_approval_grants (
  id text primary key,
  user_id uuid not null references users(id) on delete cascade,
  device_id text not null,
  app_name text not null,
  intent_fingerprint text not null,
  capability text not null,
  scope text not null,
  task_id text,
  session_key text,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists desktop_action_audit_events (
  id text primary key,
  intent_id text not null,
  trace_id text not null,
  user_id uuid references users(id) on delete set null,
  device_id text not null,
  app_name text not null,
  agent_id text,
  skill_slug text,
  workflow_id text,
  capability text not null,
  risk_level text not null,
  requires_elevation boolean not null default false,
  decision text not null,
  stage text not null,
  summary text not null,
  reason text,
  resources_json jsonb not null default '[]'::jsonb,
  command_snapshot text,
  result_code text,
  result_summary text,
  duration_ms integer,
  created_at timestamptz not null default now()
);

create table if not exists desktop_diagnostic_uploads (
  id text primary key,
  user_id uuid references users(id) on delete set null,
  device_id text not null,
  app_name text not null,
  upload_bucket text not null,
  upload_key text not null,
  file_name text not null,
  file_size_bytes bigint not null,
  sha256 text,
  source_type text not null,
  linked_intent_id text,
  created_at timestamptz not null default now()
);

create index if not exists idx_desktop_action_policy_rules_scope_priority
  on desktop_action_policy_rules(scope, enabled, priority, updated_at desc);
create index if not exists idx_desktop_action_policy_rules_capability
  on desktop_action_policy_rules(capability, enabled, priority);
create index if not exists idx_desktop_action_approval_grants_lookup
  on desktop_action_approval_grants(user_id, device_id, app_name, intent_fingerprint, created_at desc);
create index if not exists idx_desktop_action_approval_grants_active
  on desktop_action_approval_grants(app_name, capability, revoked_at, expires_at desc);
create index if not exists idx_desktop_action_audit_events_trace
  on desktop_action_audit_events(trace_id, created_at desc);
create index if not exists idx_desktop_action_audit_events_app_created
  on desktop_action_audit_events(app_name, created_at desc);
create index if not exists idx_desktop_action_audit_events_intent
  on desktop_action_audit_events(intent_id, created_at desc);
create index if not exists idx_desktop_diagnostic_uploads_app_created
  on desktop_diagnostic_uploads(app_name, created_at desc);
create index if not exists idx_desktop_diagnostic_uploads_user_created
  on desktop_diagnostic_uploads(user_id, created_at desc);
