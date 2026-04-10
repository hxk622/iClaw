alter table if exists desktop_action_policy_rules
  add column if not exists publisher_ids jsonb not null default '[]'::jsonb,
  add column if not exists package_digests jsonb not null default '[]'::jsonb,
  add column if not exists executor_types jsonb not null default '[]'::jsonb,
  add column if not exists executor_template_ids jsonb not null default '[]'::jsonb,
  add column if not exists canonical_path_prefixes jsonb not null default '[]'::jsonb,
  add column if not exists network_destinations jsonb not null default '[]'::jsonb,
  add column if not exists access_modes jsonb not null default '[]'::jsonb,
  add column if not exists max_grant_scope text not null default 'once';

alter table if exists desktop_action_approval_grants
  add column if not exists approved_plan_hash text not null default '',
  add column if not exists risk_level text not null default 'medium',
  add column if not exists access_modes jsonb not null default '[]'::jsonb,
  add column if not exists normalized_resources jsonb not null default '[]'::jsonb,
  add column if not exists network_destinations jsonb not null default '[]'::jsonb,
  add column if not exists executor_type text not null default 'template',
  add column if not exists executor_template_id text,
  add column if not exists publisher_id text,
  add column if not exists package_digest text;

alter table if exists desktop_action_audit_events
  add column if not exists matched_policy_rule_id text,
  add column if not exists approved_plan_hash text,
  add column if not exists executed_plan_hash text,
  add column if not exists command_snapshot_redacted text;

update desktop_action_audit_events
set command_snapshot_redacted = command_snapshot
where command_snapshot is not null
  and command_snapshot_redacted is null;

alter table if exists desktop_diagnostic_uploads
  add column if not exists contains_customer_logs boolean not null default true,
  add column if not exists sensitivity_level text not null default 'customer';

create index if not exists idx_desktop_action_policy_rules_publisher
  on desktop_action_policy_rules using gin (publisher_ids);
create index if not exists idx_desktop_action_policy_rules_package_digests
  on desktop_action_policy_rules using gin (package_digests);
create index if not exists idx_desktop_action_policy_rules_executor_templates
  on desktop_action_policy_rules using gin (executor_template_ids);
create index if not exists idx_desktop_action_approval_grants_plan_hash
  on desktop_action_approval_grants(intent_fingerprint, approved_plan_hash, created_at desc);
create index if not exists idx_desktop_action_audit_events_policy_rule
  on desktop_action_audit_events(matched_policy_rule_id, created_at desc);
create index if not exists idx_desktop_action_audit_events_plan_hash
  on desktop_action_audit_events(approved_plan_hash, executed_plan_hash, created_at desc);
