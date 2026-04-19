alter table finance_compliance_events
  add column if not exists matched_rules_json jsonb not null default '[]'::jsonb,
  add column if not exists confidence text,
  add column if not exists classifier_version text,
  add column if not exists decision_source text;

create index if not exists idx_finance_compliance_events_confidence_created
  on finance_compliance_events(confidence, created_at desc);

create index if not exists idx_finance_compliance_events_decision_source_created
  on finance_compliance_events(decision_source, created_at desc);
