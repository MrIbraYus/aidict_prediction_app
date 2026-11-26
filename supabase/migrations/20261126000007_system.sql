-- AIDICT · 0007 · System settings, feature flags, audit log

create table public.app_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

create table public.feature_flags (
  key          text primary key,
  enabled      boolean not null default false,
  rollout      jsonb not null default '{}'::jsonb,
  description  text not null
);

create table public.audit_logs (
  id          bigint generated always as identity primary key,
  actor       uuid,
  action      text not null,
  entity      text not null,
  entity_id   text,
  diff        jsonb,
  ip_hash     text,
  created_at  timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
