-- AIDICT · 0004 · Data providers, mappings, payloads, sync logs, quality, conflicts, jobs, fixture data inventory

create table public.data_providers (
  id                  text primary key,          -- 'football-data-org', 'openligadb', …
  name                text not null,
  sport_id            smallint references public.sports(id),
  kind                text not null check (kind in ('api', 'file')),
  licence             text not null,
  attribution_text    text,
  reliability_weight  real not null default 0.8 check (reliability_weight between 0 and 1),
  daily_budget        int,
  minute_budget       int,
  is_enabled          boolean not null default true,
  created_at          timestamptz not null default now()
);

create table public.provider_mappings (
  entity_type         text not null check (entity_type in ('competition', 'season', 'team', 'player', 'fixture')),
  entity_id           bigint not null,
  provider_id         text not null references public.data_providers(id),
  provider_entity_id  text not null,
  first_seen_at       timestamptz not null default now(),
  primary key (provider_id, entity_type, provider_entity_id)
);
create index provider_mappings_entity_idx on public.provider_mappings (entity_type, entity_id);

-- Raw payloads kept 30 days (see retention job); only the hash stays in the sync log afterwards.
create table public.provider_payloads (
  id            bigint generated always as identity primary key,
  provider_id   text not null references public.data_providers(id),
  endpoint      text not null,
  request_hash  text not null,
  payload       jsonb not null,
  fetched_at    timestamptz not null default now()
);
create index provider_payloads_fetched_idx on public.provider_payloads (fetched_at);

create table public.provider_sync_logs (
  id               bigint generated always as identity primary key,
  provider_id      text not null references public.data_providers(id),
  job              text not null,
  endpoint         text,
  status_code      int,
  latency_ms       int,
  quota_remaining  int,
  rows_upserted    int not null default 0,
  payload_hash     text,
  error            text,
  started_at       timestamptz not null default now()
);
create index provider_sync_logs_started_idx on public.provider_sync_logs (provider_id, started_at desc);

create table public.data_quality_reports (
  id                 bigint generated always as identity primary key,
  competition_id     bigint references public.competitions(id) on delete cascade,
  season_id          bigint references public.seasons(id) on delete cascade,
  completeness       jsonb not null,
  freshness_minutes  int,
  issues             jsonb not null default '[]'::jsonb,
  created_at         timestamptz not null default now()
);

create table public.data_conflicts (
  id           bigint generated always as identity primary key,
  fixture_id   bigint not null references public.fixtures(id) on delete cascade,
  field        text not null,
  values       jsonb not null,                 -- [{provider, value, reliability, fetched_at}]
  status       public.conflict_status not null default 'open',
  resolution   text,
  resolved_by  uuid,
  resolved_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index data_conflicts_open_idx on public.data_conflicts (fixture_id) where status = 'open';

create table public.scheduled_sync_jobs (
  job               text primary key,
  cron              text not null,
  runner            text not null,
  last_run_at       timestamptz,
  last_status       text,
  next_expected_at  timestamptz,
  is_enabled        boolean not null default true
);

-- What exists for each fixture BEFORE any market is evaluated. Missing ≠ zero.
create table public.fixture_data_inventory (
  fixture_id    bigint not null references public.fixtures(id) on delete cascade,
  data_type     public.data_type not null,
  available     boolean not null,
  completeness  real check (completeness between 0 and 1),
  source        text,
  as_of         timestamptz not null default now(),
  primary key (fixture_id, data_type)
);
