create table if not exists finance_compliance_events (
  id text primary key,
  app_name text not null,
  session_key text not null,
  conversation_id text,
  channel text not null,
  source_surface text,
  input_classification text,
  output_classification text,
  risk_level text not null,
  show_disclaimer boolean not null default false,
  disclaimer_text text,
  degraded boolean not null default false,
  blocked boolean not null default false,
  reasons_json jsonb not null default '[]'::jsonb,
  used_capabilities_json jsonb not null default '[]'::jsonb,
  used_model text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_finance_compliance_events_app_created
  on finance_compliance_events(app_name, created_at desc);

create index if not exists idx_finance_compliance_events_channel_created
  on finance_compliance_events(channel, created_at desc);

create index if not exists idx_finance_compliance_events_session_created
  on finance_compliance_events(session_key, created_at desc);

create index if not exists idx_finance_compliance_events_input_output
  on finance_compliance_events(input_classification, output_classification, created_at desc);
