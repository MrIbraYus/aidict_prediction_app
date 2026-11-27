-- AIDICT: complete schema + reference seed (generated from supabase/migrations and supabase/seed).
-- Run once in Supabase Dashboard -> SQL Editor -> New query -> paste -> Run. Safe on an empty project.

-- ===== supabase/migrations/20261126000001_enums.sql =====
-- AIDICT · 0001 · Enumerated types
-- Every timestamp in AIDICT is timestamptz (UTC). Display time zone is a user preference.

create type public.sport_status    as enum ('active', 'validating', 'planned');
create type public.fixture_status  as enum ('SCHEDULED', 'TIMED', 'LIVE', 'HT', 'FT', 'AET', 'PEN', 'POSTPONED', 'SUSPENDED', 'CANCELLED', 'AWARDED');
create type public.market_status   as enum ('active', 'validating', 'disabled', 'unavailable');
create type public.market_category as enum ('result', 'goals', 'handicap', 'double', 'first', 'sequence', 'player', 'corners', 'combined', 'other');
create type public.outcome_result  as enum ('won', 'lost', 'void', 'push', 'half_won', 'half_lost');
create type public.recommendation  as enum ('pick', 'lean', 'skip');
create type public.notif_category  as enum ('prediction', 'kickoff', 'live', 'goal', 'finished', 'settled', 'system');
create type public.notif_channel   as enum ('in_app', 'web_push', 'android');
create type public.data_type       as enum ('results', 'goal_times', 'corners', 'lineups', 'player_stats', 'penalties');
create type public.conflict_status as enum ('open', 'resolved', 'ignored');
create type public.badge_kind      as enum ('club-crest', 'national-flag');
create type public.badge_status    as enum ('active', 'fallback', 'needs_review');
create type public.app_role        as enum ('user', 'admin');

-- ===== supabase/migrations/20261126000002_sports_core.sql =====
-- AIDICT · 0002 · Sports core: sports, competitions, seasons, teams, badges, players, fixtures, results, events, line-ups

create table public.sports (
  id          smallint primary key,
  slug        text not null unique,
  name        text not null,
  status      public.sport_status not null default 'planned',
  note        text,
  created_at  timestamptz not null default now()
);

create table public.competitions (
  id          bigint generated always as identity primary key,
  sport_id    smallint not null references public.sports(id),
  slug        text not null,
  code        text,
  name        text not null,
  country     text,
  type        text not null default 'league' check (type in ('league', 'cup', 'international')),
  tier        smallint,
  is_active   boolean not null default false,
  coverage    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  unique (sport_id, slug)
);

create table public.seasons (
  id              bigint generated always as identity primary key,
  competition_id  bigint not null references public.competitions(id) on delete cascade,
  label           text not null,              -- '2026-27' or '2026'
  start_date      date,
  end_date        date,
  is_current      boolean not null default false,
  unique (competition_id, label)
);
create unique index seasons_one_current on public.seasons (competition_id) where is_current;

create table public.teams (
  id          bigint generated always as identity primary key,
  sport_id    smallint not null references public.sports(id),
  name        text not null,
  short_name  text,
  tla         text,
  country     text,
  is_national boolean not null default false,
  colors      jsonb,
  created_at  timestamptz not null default now()
);
create index teams_name_idx on public.teams (lower(name));

-- Name normalisation: every spelling a provider uses maps to one team.
create table public.team_aliases (
  team_id  bigint not null references public.teams(id) on delete cascade,
  alias    text not null,
  source   text not null,
  primary key (team_id, alias, source)
);
create unique index team_aliases_lookup on public.team_aliases (lower(alias), source);

-- Authentic badges (see documentation/TEAM_BADGES.md). Never generated.
create table public.team_badges (
  team_id           bigint primary key references public.teams(id) on delete cascade,
  source            text not null,                 -- football-data.org | api-football | openligadb | manual-override
  provider_team_id  text,
  source_url        text,
  override_url      text,
  storage_path      text,
  thumb_64          text,
  thumb_128         text,
  format            text check (format in ('svg', 'png', 'webp')),
  kind              public.badge_kind not null default 'club-crest',
  width             int,
  height            int,
  sha256            text,
  contrast_hint     text check (contrast_hint in ('dark', 'light', 'ok')),
  status            public.badge_status not null default 'needs_review',
  verified_at       timestamptz,
  last_checked_at   timestamptz,
  history           jsonb not null default '[]'::jsonb
);

create table public.players (
  id           bigint generated always as identity primary key,
  name         text not null,
  birth_date   date,
  nationality  text,
  position     text,
  created_at   timestamptz not null default now()
);

create table public.fixtures (
  id              bigint generated always as identity primary key,
  season_id       bigint not null references public.seasons(id) on delete cascade,
  home_team_id    bigint not null references public.teams(id),
  away_team_id    bigint not null references public.teams(id),
  kickoff_at      timestamptz not null,
  kickoff_date    date not null,               -- UTC date, maintained by trigger (used for de-duplication)
  status          public.fixture_status not null default 'SCHEDULED',
  round           text,
  venue           text,
  source_tz       text,
  primary_source  text not null,
  last_synced_at  timestamptz not null default now(),
  check (home_team_id <> away_team_id)
);
create index fixtures_kickoff_idx on public.fixtures (kickoff_at);
create index fixtures_season_kickoff_idx on public.fixtures (season_id, kickoff_at);
create index fixtures_live_idx on public.fixtures (status) where status in ('LIVE', 'HT');
-- One real-world fixture → one row (duplicate protection across providers).
create unique index fixtures_no_duplicates on public.fixtures (season_id, home_team_id, away_team_id, kickoff_date) where status <> 'CANCELLED';

create or replace function public.set_kickoff_date() returns trigger
language plpgsql as $$
begin
  new.kickoff_date := (new.kickoff_at at time zone 'UTC')::date;
  return new;
end $$;
create trigger fixtures_kickoff_date before insert or update of kickoff_at on public.fixtures
  for each row execute function public.set_kickoff_date();

create table public.match_results (
  fixture_id    bigint primary key references public.fixtures(id) on delete cascade,
  ft_home       smallint not null check (ft_home >= 0),
  ft_away       smallint not null check (ft_away >= 0),
  ht_home       smallint check (ht_home >= 0),
  ht_away       smallint check (ht_away >= 0),
  et_home       smallint,
  et_away       smallint,
  pen_home      smallint,
  pen_away      smallint,
  outcome       char(1) generated always as (case when ft_home > ft_away then 'H' when ft_home < ft_away then 'A' else 'D' end) stored,
  is_final      boolean not null default false,
  confirmed_by  text[] not null default '{}',
  updated_at    timestamptz not null default now()
);

-- A final score can only change through conflict resolution.
create or replace function public.protect_final_result() returns trigger
language plpgsql as $$
begin
  if old.is_final and (new.ft_home, new.ft_away) is distinct from (old.ft_home, old.ft_away)
     and coalesce(current_setting('aidict.conflict_resolution', true), 'off') <> 'on' then
    raise exception 'Final result for fixture % is locked; resolve through data_conflicts', old.fixture_id
      using errcode = 'check_violation';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger match_results_protect before update on public.match_results
  for each row execute function public.protect_final_result();

-- Scoring order: needed by 1st Goal, goals-in-a-row and 1UP / 2UP / Never Down markets.
create table public.goal_events (
  id          bigint generated always as identity primary key,
  fixture_id  bigint not null references public.fixtures(id) on delete cascade,
  minute      smallint not null check (minute between 0 and 130),
  stoppage    smallint,
  team_id     bigint not null references public.teams(id),
  player_id   bigint references public.players(id),
  own_goal    boolean not null default false,
  penalty     boolean not null default false,
  source      text not null,
  confidence  real not null default 1.0
);
create index goal_events_fixture_idx on public.goal_events (fixture_id, minute, stoppage);

create table public.lineups (
  fixture_id    bigint not null references public.fixtures(id) on delete cascade,
  team_id       bigint not null references public.teams(id),
  player_id     bigint not null references public.players(id),
  starter       boolean not null,
  position      text,
  minutes       smallint,
  confirmed_at  timestamptz,
  source        text not null,
  primary key (fixture_id, player_id)
);

-- ===== supabase/migrations/20261126000003_statistics.sql =====
-- AIDICT · 0003 · Statistics (long format: sparse and honest — a missing stat is a missing row, never a zero)

create table public.match_statistics (
  fixture_id         bigint not null references public.fixtures(id) on delete cascade,
  team_id            bigint not null references public.teams(id),
  stat_key           text not null,          -- shots, shots_on_target, corners, fouls, yellow, red, xg …
  value              numeric not null,
  definition_source  text not null,          -- statistics from different definitions are never mixed
  provider           text not null,
  primary key (fixture_id, team_id, stat_key, definition_source)
);
create index match_statistics_team_idx on public.match_statistics (team_id, stat_key);

create table public.team_statistics (
  team_id            bigint not null references public.teams(id) on delete cascade,
  season_id          bigint not null references public.seasons(id) on delete cascade,
  stat_key           text not null,
  value              numeric not null,
  as_of              timestamptz not null,
  definition_source  text not null,
  primary key (team_id, season_id, stat_key, definition_source, as_of)
);

create table public.player_statistics (
  player_id          bigint not null references public.players(id) on delete cascade,
  season_id          bigint not null references public.seasons(id) on delete cascade,
  team_id            bigint not null references public.teams(id),
  stat_key           text not null,
  value              numeric not null,
  definition_source  text not null,
  primary key (player_id, season_id, team_id, stat_key, definition_source)
);

-- ===== supabase/migrations/20261126000004_providers.sql =====
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

-- ===== supabase/migrations/20261126000005_predictions.sql =====
-- AIDICT · 0005 · Models, market registry, immutable snapshots, smart picks, settlement, evaluation

create table public.prediction_models (
  id          text primary key,                 -- 'football-dc', 'football-elo', 'football-lgbm'
  sport_id    smallint not null references public.sports(id),
  family      text not null,
  description text
);

create table public.model_versions (
  id            bigint generated always as identity primary key,
  model_id      text not null references public.prediction_models(id),
  version       text not null,                  -- semver
  trained_at    timestamptz not null,
  train_window  tstzrange,
  params        jsonb not null default '{}'::jsonb,
  artifact_uri  text,
  status        text not null default 'candidate' check (status in ('candidate', 'active', 'retired')),
  git_sha       text,
  unique (model_id, version)
);
create unique index model_versions_one_active on public.model_versions (model_id) where status = 'active';

create table public.model_evaluations (
  id                bigint generated always as identity primary key,
  model_version_id  bigint not null references public.model_versions(id) on delete cascade,
  scope             jsonb not null,             -- {competition, market, horizon}
  n                 int not null,
  brier             numeric,
  log_loss          numeric,
  rps               numeric,
  ece               numeric,
  ci                jsonb,
  reliability       jsonb,
  created_at        timestamptz not null default now()
);

-- The extensible market registry (24 Smart Markets + classic markets). See documentation/PREDICTION_ENGINE.md.
create table public.market_definitions (
  id                   text primary key,
  sport_id             smallint not null references public.sports(id),
  name                 text not null,
  category             public.market_category not null,
  outcome_schema       jsonb not null default '{}'::jsonb,
  model_module         text not null,
  required_data        public.data_type[] not null,
  settlement_rules     jsonb not null default '{}'::jsonb,
  settlement_verified  boolean not null default true,
  gate_thresholds      jsonb not null default '{"min_n": 1000, "max_ece": 0.03}'::jsonb,
  result_dependent     boolean not null default false,
  created_at           timestamptz not null default now()
);

create table public.market_competition_status (
  market_id       text not null references public.market_definitions(id) on delete cascade,
  competition_id  bigint not null references public.competitions(id) on delete cascade,
  status          public.market_status not null default 'validating',
  reason          text,
  oos_n           int,
  brier           numeric,
  log_loss        numeric,
  ece             numeric,
  evaluated_at    timestamptz,
  primary key (market_id, competition_id)
);

create table public.backtest_runs (
  id                bigint generated always as identity primary key,
  model_version_id  bigint references public.model_versions(id),
  config            jsonb not null,
  split             jsonb not null,
  metrics           jsonb,
  started_at        timestamptz not null default now(),
  finished_at       timestamptz
);

create table public.market_backtests (
  backtest_run_id   bigint not null references public.backtest_runs(id) on delete cascade,
  market_id         text not null references public.market_definitions(id),
  competition_id    bigint references public.competitions(id),
  n                 int not null,
  brier             numeric,
  log_loss          numeric,
  ece               numeric,
  hit_rate          numeric,
  reliability_bins  jsonb,
  ci                jsonb,
  primary key (backtest_run_id, market_id, competition_id)
);

-- Immutable snapshot of the model state for a fixture at a horizon (T-24h, T-2h).
create table public.prediction_snapshots (
  id                 uuid primary key default gen_random_uuid(),
  fixture_id         bigint not null references public.fixtures(id),
  model_version_id   bigint not null references public.model_versions(id),
  snapshot_at        timestamptz not null default now(),
  horizon            text not null check (horizon in ('T-24h', 'T-2h', 'manual')),
  lambda_home        numeric(6,4) not null,
  lambda_away        numeric(6,4) not null,
  score_matrix       smallint[] not null,      -- 10×10 in basis points, row-major
  inputs             jsonb not null,
  input_hash         text not null,
  data_completeness  real not null,
  published          boolean not null default true,
  unique (fixture_id, model_version_id, horizon)
);

create table public.market_outcome_probabilities (
  snapshot_id   uuid not null references public.prediction_snapshots(id),
  market_id     text not null references public.market_definitions(id),
  outcome_key   text not null,
  probability   numeric(6,5) not null check (probability between 0 and 1),
  base_rate     numeric(6,5),
  breakdown     jsonb,
  reliability   real,
  completeness  real,
  status        public.market_status not null,
  primary key (snapshot_id, market_id, outcome_key)
);

-- Signal-ranked single predictions (Smart Predictions page).
create table public.predictions (
  id              uuid primary key default gen_random_uuid(),
  snapshot_id     uuid not null references public.prediction_snapshots(id),
  fixture_id      bigint not null references public.fixtures(id),
  market_id       text not null references public.market_definitions(id),
  selection       text not null,
  probability     numeric(6,5) not null check (probability between 0 and 1),
  confidence_band numrange,
  signal_score    smallint check (signal_score between 0 and 100),
  recommendation  public.recommendation not null,
  skip_reason     text,
  published_at    timestamptz not null default now()
);
create index predictions_fixture_idx on public.predictions (fixture_id);

-- The strongest 4–5 market predictions per fixture (Smart Market Predictions).
create table public.smart_picks (
  id            uuid primary key default gen_random_uuid(),
  snapshot_id   uuid not null references public.prediction_snapshots(id),
  fixture_id    bigint not null references public.fixtures(id),
  rank          smallint not null check (rank between 1 and 5),
  market_id     text not null references public.market_definitions(id),
  outcome_key   text not null,
  probability   numeric(6,5) not null check (probability between 0 and 1),
  reliability   real not null,
  confidence    text not null check (confidence in ('High', 'Medium', 'Low')),
  lift          real not null,
  score         real not null,
  reasons       jsonb not null,
  excluded      jsonb not null default '[]'::jsonb,
  published_at  timestamptz not null default now(),
  unique (snapshot_id, rank),
  unique (snapshot_id, market_id)
);
create index smart_picks_fixture_idx on public.smart_picks (fixture_id);

-- Settlement for both prediction types (exactly one reference set).
create table public.pick_outcomes (
  id             bigint generated always as identity primary key,
  prediction_id  uuid unique references public.predictions(id),
  smart_pick_id  uuid unique references public.smart_picks(id),
  result         public.outcome_result not null,
  settled_at     timestamptz not null default now(),
  result_source  text not null,
  check ((prediction_id is null) <> (smart_pick_id is null))
);

create table public.prediction_performance (
  scope_key   text not null,     -- e.g. 'market:ou|comp:pl'
  period      text not null,     -- 'all', '2026-W48'
  n           int not null,
  hits        int not null,
  brier       numeric,
  log_loss    numeric,
  rps         numeric,
  ece         numeric,
  updated_at  timestamptz not null default now(),
  primary key (scope_key, period)
);

create table public.odds_snapshots (
  fixture_id    bigint not null references public.fixtures(id) on delete cascade,
  market_id     text not null references public.market_definitions(id),
  selection     text not null,
  decimal_odds  numeric(8,3) not null check (decimal_odds > 1),
  bookmaker     text not null,
  source        text not null,
  captured_at   timestamptz not null,
  primary key (fixture_id, market_id, selection, bookmaker, captured_at)
);

-- ===== supabase/migrations/20261126000006_users_notifications.sql =====
-- AIDICT · 0006 · Users, preferences, saved matches, notifications (Supabase owns auth.users)

create table public.user_profiles (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  role          public.app_role not null default 'user',
  created_at    timestamptz not null default now()
);

create table public.user_preferences (
  user_id                uuid primary key references auth.users(id) on delete cascade,
  theme                  text not null default 'dark' check (theme in ('dark', 'light', 'system')),
  time_zone              text not null default 'UTC',
  odds_format            text not null default 'decimal' check (odds_format in ('decimal', 'fractional', 'american')),
  probability_format     text not null default 'percent' check (probability_format in ('percent', 'decimal')),
  default_sport          text not null default 'football',
  reality_check_minutes  smallint not null default 60,
  hide_value             boolean not null default false,
  notification_prefs     jsonb not null default '{}'::jsonb,
  updated_at             timestamptz not null default now()
);

create table public.saved_matches (
  user_id        uuid not null references auth.users(id) on delete cascade,
  fixture_id     bigint not null references public.fixtures(id) on delete cascade,
  note           text check (char_length(note) <= 500),
  alert_kickoff  boolean not null default true,
  alert_result   boolean not null default true,
  created_at     timestamptz not null default now(),
  primary key (user_id, fixture_id)
);

create table public.favourite_teams (
  user_id     uuid not null references auth.users(id) on delete cascade,
  team_id     bigint not null references public.teams(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, team_id)
);

-- One row per real-world event; the unique dedupe key guarantees nobody is alerted twice.
create table public.notification_events (
  id          bigint generated always as identity primary key,
  category    public.notif_category not null,
  fixture_id  bigint references public.fixtures(id) on delete cascade,
  dedupe_key  text not null unique,
  payload     jsonb not null,
  source      text not null,
  created_at  timestamptz not null default now()
);

create table public.notifications (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  event_id    bigint references public.notification_events(id) on delete cascade,
  category    public.notif_category not null,
  title       text not null,
  body        text not null,
  fixture_id  bigint references public.fixtures(id) on delete set null,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_inbox_idx on public.notifications (user_id, read_at, created_at desc);

create table public.notification_deliveries (
  event_id      bigint not null references public.notification_events(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  channel       public.notif_channel not null,
  status        text not null check (status in ('queued', 'sent', 'failed', 'suppressed')),
  delivered_at  timestamptz,
  primary key (event_id, user_id, channel)
);

create table public.push_subscriptions (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  platform      text not null check (platform in ('web', 'android')),
  endpoint      text,
  expo_token    text,
  keys          jsonb,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  check (endpoint is not null or expo_token is not null)
);

-- New sign-up → profile + default preferences.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_profiles (user_id, display_name) values (new.id, split_part(coalesce(new.email, ''), '@', 1));
  insert into public.user_preferences (user_id) values (new.id);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===== supabase/migrations/20261126000007_system.sql =====
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

-- ===== supabase/migrations/20261126000008_security.sql =====
-- AIDICT · 0008 · Row Level Security, grants and immutability guarantees
-- Model: deny by default. Clients (anon/authenticated) read through RLS; only the service role
-- (GitHub Actions jobs, server code) writes sports, prediction and pipeline data.

-- ───────────── Helpers ─────────────
create or replace function public.is_admin() returns boolean
language sql stable as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
$$;

-- ───────────── Immutability: published predictions are append-only ─────────────
create or replace function public.forbid_mutation() returns trigger
language plpgsql as $$
begin
  raise exception '% is append-only: published records can never be changed or deleted', tg_table_name
    using errcode = 'insufficient_privilege';
end $$;

create trigger prediction_snapshots_immutable before update or delete on public.prediction_snapshots
  for each row execute function public.forbid_mutation();
create trigger market_outcome_probabilities_immutable before update or delete on public.market_outcome_probabilities
  for each row execute function public.forbid_mutation();
create trigger predictions_immutable before update or delete on public.predictions
  for each row execute function public.forbid_mutation();
create trigger smart_picks_immutable before update or delete on public.smart_picks
  for each row execute function public.forbid_mutation();
create trigger audit_logs_immutable before update or delete on public.audit_logs
  for each row execute function public.forbid_mutation();

-- Nothing may be published at or after kick-off.
create or replace function public.require_before_kickoff() returns trigger
language plpgsql as $$
declare
  ko timestamptz;
  at timestamptz;
begin
  select kickoff_at into ko from public.fixtures where id = new.fixture_id;
  -- Column differs per table (snapshot_at vs published_at); read it generically.
  at := coalesce((to_jsonb(new) ->> 'snapshot_at')::timestamptz, (to_jsonb(new) ->> 'published_at')::timestamptz);
  if ko is null then
    raise exception 'Unknown fixture %', new.fixture_id using errcode = 'foreign_key_violation';
  end if;
  if at >= ko then
    raise exception '% for fixture % must be recorded before kick-off (% >= %)', tg_table_name, new.fixture_id, at, ko
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger prediction_snapshots_before_kickoff before insert on public.prediction_snapshots
  for each row execute function public.require_before_kickoff();
create trigger predictions_before_kickoff before insert on public.predictions
  for each row execute function public.require_before_kickoff();
create trigger smart_picks_before_kickoff before insert on public.smart_picks
  for each row execute function public.require_before_kickoff();

-- ───────────── Grants ─────────────
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- Readable sports, prediction and transparency data (authenticated only — AIDICT is private).
grant select on
  public.sports, public.competitions, public.seasons, public.teams, public.team_aliases, public.team_badges,
  public.players, public.fixtures, public.match_results, public.goal_events, public.lineups,
  public.match_statistics, public.team_statistics, public.player_statistics,
  public.prediction_models, public.model_versions, public.model_evaluations,
  public.market_definitions, public.market_competition_status, public.backtest_runs, public.market_backtests,
  public.prediction_snapshots, public.market_outcome_probabilities, public.predictions, public.smart_picks,
  public.pick_outcomes, public.prediction_performance, public.odds_snapshots, public.fixture_data_inventory,
  public.data_providers, public.scheduled_sync_jobs, public.feature_flags
to authenticated;

-- Admin-only reads.
grant select on
  public.provider_mappings, public.provider_payloads, public.provider_sync_logs, public.data_quality_reports,
  public.data_conflicts, public.app_settings, public.audit_logs, public.notification_events, public.notification_deliveries
to authenticated;

-- Admin writes (limited columns).
grant update (status, resolution, resolved_by, resolved_at) on public.data_conflicts to authenticated;
grant update (enabled, rollout) on public.feature_flags to authenticated;
grant update (is_enabled, daily_budget, minute_budget) on public.data_providers to authenticated;
grant update (value, updated_at, updated_by) on public.app_settings to authenticated;
grant update (override_url) on public.team_badges to authenticated;
grant update (settlement_rules, settlement_verified) on public.market_definitions to authenticated;

-- Own-row user data. Role is NOT client-editable (only display_name).
grant select on public.user_profiles to authenticated;
grant update (display_name) on public.user_profiles to authenticated;
grant select, update on public.user_preferences to authenticated;
grant select, insert, update, delete on public.saved_matches, public.favourite_teams to authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant usage on sequence public.push_subscriptions_id_seq to authenticated;

-- ───────────── Row Level Security ─────────────
do $$
declare t text;
begin
  foreach t in array array[
    'sports','competitions','seasons','teams','team_aliases','team_badges','players','fixtures','match_results',
    'goal_events','lineups','match_statistics','team_statistics','player_statistics','data_providers',
    'provider_mappings','provider_payloads','provider_sync_logs','data_quality_reports','data_conflicts',
    'scheduled_sync_jobs','fixture_data_inventory','prediction_models','model_versions','model_evaluations',
    'market_definitions','market_competition_status','backtest_runs','market_backtests','prediction_snapshots',
    'market_outcome_probabilities','predictions','smart_picks','pick_outcomes','prediction_performance',
    'odds_snapshots','user_profiles','user_preferences','saved_matches','favourite_teams','notification_events',
    'notifications','notification_deliveries','push_subscriptions','app_settings','feature_flags','audit_logs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;

  -- Read-all for signed-in users.
  foreach t in array array[
    'sports','competitions','seasons','teams','team_aliases','team_badges','players','fixtures','match_results',
    'goal_events','lineups','match_statistics','team_statistics','player_statistics','data_providers',
    'scheduled_sync_jobs','fixture_data_inventory','prediction_models','model_versions','model_evaluations',
    'market_definitions','market_competition_status','backtest_runs','market_backtests','prediction_snapshots',
    'market_outcome_probabilities','predictions','smart_picks','pick_outcomes','prediction_performance',
    'odds_snapshots','feature_flags'
  ] loop
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_read', t);
  end loop;

  -- Admin-only reads.
  foreach t in array array[
    'provider_mappings','provider_payloads','provider_sync_logs','data_quality_reports','data_conflicts',
    'app_settings','audit_logs','notification_events','notification_deliveries'
  ] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.is_admin())', t || '_admin_read', t);
  end loop;

  -- Admin updates (column grants above limit what can change).
  foreach t in array array['data_conflicts','feature_flags','data_providers','app_settings','team_badges','market_definitions'] loop
    execute format('create policy %I on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())', t || '_admin_update', t);
  end loop;
end $$;

-- Own rows.
create policy user_profiles_own_read on public.user_profiles for select to authenticated using (user_id = auth.uid());
create policy user_profiles_own_update on public.user_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy user_preferences_own on public.user_preferences for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy saved_matches_own on public.saved_matches for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy favourite_teams_own on public.favourite_teams for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_own_read on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_own_mark_read on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy push_subscriptions_own on public.push_subscriptions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ===== supabase/migrations/20261126000009_outcome_gates.sql =====
-- AIDICT · 0009 · Per-outcome gates and calibration
-- Real backtests showed the same market can pass on one line and fail on another (e.g. Asian Handicap −0.25 vs 0),
-- so publication is decided per outcome × competition, with a persistence rule (two consecutive weekly passes).

create table public.outcome_gates (
  market_id        text not null references public.market_definitions(id) on delete cascade,
  outcome_key      text not null,
  competition_id   bigint not null references public.competitions(id) on delete cascade,
  status           public.market_status not null default 'validating',
  reason           text,
  n                int not null default 0,
  log_loss         numeric,
  base_log_loss    numeric,
  ece              numeric,
  ci_high          numeric,             -- upper 95% bound of (model − base) log loss; must be < 0
  passes_in_row    smallint not null default 0,
  fails_in_row     smallint not null default 0,
  label            text,
  evaluated_at     timestamptz not null default now(),
  primary key (market_id, outcome_key, competition_id)
);

-- Platt scaling parameters applied to raw probabilities before publication: p' = σ(a · logit(p) + b).
create table public.outcome_calibration (
  market_id       text not null references public.market_definitions(id) on delete cascade,
  outcome_key     text not null,
  competition_id  bigint not null references public.competitions(id) on delete cascade,
  a               double precision not null,
  b               double precision not null,
  n               int not null,
  fitted_at       timestamptz not null default now(),
  primary key (market_id, outcome_key, competition_id)
);

alter table public.outcome_gates enable row level security;
alter table public.outcome_calibration enable row level security;
grant select on public.outcome_gates, public.outcome_calibration to authenticated;
create policy outcome_gates_read on public.outcome_gates for select to authenticated using (true);
create policy outcome_calibration_read on public.outcome_calibration for select to authenticated using (true);

-- ===== supabase/migrations/20261126000010_snapshot_horizons.sql =====
-- AIDICT · 0010 · Snapshot horizons
-- Adds a 7-day preview horizon. Snapshots are still immutable: a fixture gets at most one snapshot per horizon and model
-- version (T-7d preview → T-24h → T-2h), and the latest one before kick-off is the official prediction that gets settled.
alter table public.prediction_snapshots drop constraint if exists prediction_snapshots_horizon_check;
alter table public.prediction_snapshots add constraint prediction_snapshots_horizon_check check (horizon in ('T-7d', 'T-24h', 'T-2h', 'manual'));
update public.scheduled_sync_jobs set cron = '17 * * * *' where job = 'predict_upcoming';

-- ===== supabase/seed/0001_reference.sql =====
-- AIDICT · reference seed. Contains NO sample predictions, results or performance data.

insert into public.sports (id, slug, name, status, note) values
  (1, 'football',   'Football',   'active',     'First fully implemented prediction engine'),
  (2, 'basketball', 'Basketball', 'validating', 'Data collection; no published model'),
  (3, 'tennis',     'Tennis',     'planned',    'Historical source under review'),
  (4, 'cricket',    'Cricket',    'planned',    'Cricsheet candidate'),
  (5, 'baseball',   'Baseball',   'planned',    null),
  (6, 'hockey',     'Ice Hockey', 'planned',    null);

insert into public.data_providers (id, name, sport_id, kind, licence, attribution_text, reliability_weight, daily_budget, minute_budget) values
  ('football-data-org',   'football-data.org',   1, 'api',  'Terms not published — personal use', null, 0.95, null, 10),
  ('openligadb',          'OpenLigaDB',          1, 'api',  'ODbL 1.0', 'Daten von OpenLigaDB (www.openligadb.de), lizenziert unter ODbL 1.0', 0.85, null, 60),
  ('api-football',        'API-Football',        1, 'api',  'Free plan — terms to confirm', null, 0.9, 90, null),
  ('openfootball',        'OpenFootball',        1, 'file', 'CC0-1.0 (public domain)', null, 0.8, null, null),
  ('football-data-co-uk', 'football-data.co.uk', 1, 'file', 'Private individuals only', null, 0.85, null, null);

insert into public.competitions (sport_id, slug, code, name, country, type, tier, is_active, coverage) values
  (1, 'premier-league',   'PL',  'Premier League',      'England',       'league', 1, true,  '{"goal_times": "partial", "corners": true}'),
  (1, 'laliga',           'PD',  'LaLiga',              'Spain',         'league', 1, true,  '{"goal_times": false, "corners": true}'),
  (1, 'bundesliga',       'BL1', 'Bundesliga',          'Germany',       'league', 1, true,  '{"goal_times": true, "corners": true}'),
  (1, 'serie-a',          'SA',  'Serie A',             'Italy',         'league', 1, true,  '{"goal_times": false, "corners": true}'),
  (1, 'ligue-1',          'FL1', 'Ligue 1',             'France',        'league', 1, true,  '{"goal_times": false, "corners": true}'),
  (1, 'eredivisie',       'DED', 'Eredivisie',          'Netherlands',   'league', 1, true,  '{"goal_times": false, "corners": true}'),
  (1, 'champions-league', 'CL',  'Champions League',    'Europe',        'cup',    0, true,  '{"goal_times": false, "corners": false}'),
  (1, 'championship',     'ELC', 'Championship',        'England',       'league', 2, true,  '{"goal_times": false, "corners": true}'),
  (1, 'primeira-liga',    'PPL', 'Primeira Liga',       'Portugal',      'league', 1, true,  '{"goal_times": false, "corners": true}'),
  (1, 'brasileirao',      'BSA', 'Brasileirão Série A', 'Brazil',        'league', 1, false, '{"goal_times": false, "corners": false}'),
  (1, 'world-cup',        'WC',  'FIFA World Cup',      'International', 'international', 0, false, '{"goal_times": false, "corners": false}');

insert into public.prediction_models (id, sport_id, family, description) values
  ('football-elo',    1, 'rating',     'Elo with home advantage, competition K-factor and season regression'),
  ('football-dc',     1, 'goals',      'Dixon–Coles with time decay and low-score correction; primary score matrix'),
  ('football-logreg', 1, 'classifier', 'Multinomial logistic regression on rating, form and shot features'),
  ('football-lgbm',   1, 'classifier', 'LightGBM challenger — promoted only on better log loss and calibration'),
  ('football-order',  1, 'sequence',   'Goal-order model (time-varying, score-state-dependent intensities)'),
  ('football-corners',1, 'counts',     'Negative-binomial corners model'),
  ('football-player', 1, 'player',     'Player scoring model (requires line-ups and minutes)');

-- Market registry: 24 Smart Markets + classic markets. All start "validating" per competition until backtests pass.
insert into public.market_definitions (id, sport_id, name, category, model_module, required_data, settlement_verified, result_dependent, gate_thresholds) values
  ('1x2-1up',          1, '1X2 – 1UP',                                   'result',   'markets.result_up',      '{results,goal_times}', false, true,  '{"min_n":1000,"max_ece":0.03}'),
  ('1x2-2up',          1, '1X2 – 2UP',                                   'result',   'markets.result_up',      '{results,goal_times}', false, true,  '{"min_n":1000,"max_ece":0.03}'),
  ('1x2-never-down',   1, '1X2 – Never Down',                            'result',   'markets.never_down',     '{results,goal_times}', false, true,  '{"min_n":1000,"max_ece":0.03}'),
  ('ou',               1, 'Over/Under',                                  'goals',    'markets.over_under',     '{results}',            true,  false, '{"min_n":1000,"max_ece":0.03}'),
  ('handicap',         1, 'Handicap',                                    'handicap', 'markets.handicap',       '{results}',            true,  true,  '{"min_n":1000,"max_ece":0.04}'),
  ('asian-handicap',   1, 'Asian Handicap',                              'handicap', 'markets.asian_handicap', '{results}',            true,  true,  '{"min_n":1000,"max_ece":0.04}'),
  ('dc',               1, 'Double Chance',                               'double',   'markets.double_chance',  '{results}',            true,  true,  '{"min_n":1000,"max_ece":0.03}'),
  ('dc-1up',           1, 'Double Chance – 1UP',                         'double',   'markets.result_up',      '{results,goal_times}', false, true,  '{"min_n":1000,"max_ece":0.03}'),
  ('first-goal',       1, '1st Goal',                                    'first',    'markets.first_goal',     '{results,goal_times}', true,  false, '{"min_n":1000,"max_ece":0.04}'),
  ('any-2-row',        1, 'Any Team To Score 2 or More Goals in a Row',  'sequence', 'markets.goal_runs',      '{results,goal_times}', true,  false, '{"min_n":1000,"max_ece":0.03}'),
  ('any-3-row',        1, 'Any Team To Score 3 or More Goals in a Row',  'sequence', 'markets.goal_runs',      '{results,goal_times}', true,  false, '{"min_n":1000,"max_ece":0.03}'),
  ('home-2-row',       1, 'Home Team To Score 2 or More Goals in a Row', 'sequence', 'markets.goal_runs',      '{results,goal_times}', true,  false, '{"min_n":1000,"max_ece":0.03}'),
  ('home-3-row',       1, 'Home Team To Score 3 or More Goals in a Row', 'sequence', 'markets.goal_runs',      '{results,goal_times}', true,  false, '{"min_n":1000,"max_ece":0.03}'),
  ('away-2-row',       1, 'Away Team To Score 2 or More Goals in a Row', 'sequence', 'markets.goal_runs',      '{results,goal_times}', true,  false, '{"min_n":1000,"max_ece":0.03}'),
  ('goalscorer',       1, 'Goalscorer',                                  'player',   'markets.player',         '{results,lineups,player_stats,penalties}', true, false, '{"min_n":1000,"max_ece":0.03}'),
  ('player-not-score', 1, 'Player Not to Score',                         'player',   'markets.player',         '{results,lineups,player_stats,penalties}', true, false, '{"min_n":1000,"max_ece":0.03}'),
  ('corners-ou',       1, 'Corners – Over/Under',                        'corners',  'markets.corners',        '{corners}',            true,  false, '{"min_n":1000,"max_ece":0.03}'),
  ('corners-1x2',      1, 'Corners – 1X2',                               'corners',  'markets.corners',        '{corners}',            true,  false, '{"min_n":1000,"max_ece":0.04}'),
  ('home-or-over25',   1, 'Home Team or Over 2.5',                       'combined', 'markets.combined',       '{results}',            true,  true,  '{"min_n":1000,"max_ece":0.03}'),
  ('home-or-under25',  1, 'Home Team or Under 2.5',                      'combined', 'markets.combined',       '{results}',            true,  true,  '{"min_n":1000,"max_ece":0.03}'),
  ('draw-or-over25',   1, 'Draw or Over 2.5',                            'combined', 'markets.combined',       '{results}',            true,  true,  '{"min_n":1000,"max_ece":0.03}'),
  ('draw-or-under25',  1, 'Draw or Under 2.5',                           'combined', 'markets.combined',       '{results}',            true,  true,  '{"min_n":1000,"max_ece":0.03}'),
  ('away-or-over25',   1, 'Away or Over 2.5',                            'combined', 'markets.combined',       '{results}',            true,  true,  '{"min_n":1000,"max_ece":0.03}'),
  ('away-or-under25',  1, 'Away or Under 2.5',                           'combined', 'markets.combined',       '{results}',            true,  true,  '{"min_n":1000,"max_ece":0.03}'),
  ('1x2',              1, 'Full-time result',                            'other',    'markets.one_x_two',      '{results}',            true,  true,  '{"min_n":1000,"max_ece":0.03}'),
  ('btts',             1, 'Both teams to score',                         'other',    'markets.btts',           '{results}',            true,  false, '{"min_n":1000,"max_ece":0.03}'),
  ('dnb',              1, 'Draw no bet',                                 'other',    'markets.draw_no_bet',    '{results}',            true,  true,  '{"min_n":1000,"max_ece":0.03}'),
  ('correct-score',    1, 'Correct score',                               'other',    'markets.correct_score',  '{results}',            true,  true,  '{"min_n":1000,"max_ece":0.01}'),
  ('ht-result',        1, 'Half-time result',                            'other',    'markets.half_time',      '{results}',            true,  true,  '{"min_n":1000,"max_ece":0.03}'),
  ('ht-ft',            1, 'Half-time / Full-time',                       'other',    'markets.half_time',      '{results}',            true,  true,  '{"min_n":1000,"max_ece":0.03}');

insert into public.feature_flags (key, enabled, description) values
  ('smart_predictions',       true,  'Smart Predictions ranking page'),
  ('smart_markets',           true,  'Smart Market Predictions (24 markets)'),
  ('value_indicators',        true,  'Show EV only when a real odds source is attached'),
  ('multi_match_mc',          true,  'Monte Carlo multi-match analysis'),
  ('api_football_enrichment', true,  'Use API-Football budget for featured matches'),
  ('in_play_model',           false, 'In-play probability updates (not built)'),
  ('basketball_module',       false, 'Basketball predictions (validating)');

insert into public.scheduled_sync_jobs (job, cron, runner) values
  ('sync_current',         '17 * * * *',        'github-actions'),
  ('predict_upcoming',     '17 * * * *',        'github-actions'),
  ('settle_results',       '30 5,23 * * *',     'github-actions'),
  ('retrain_and_backtest', '0 4 * * 1',         'github-actions'),
  ('sync_history',         '0 4 * * 1',         'github-actions'),
  ('backup_database',      '30 4 * * 0',        'github-actions');

insert into public.app_settings (key, value) values
  ('selection', '{"min_probability":0.6,"min_reliability":0.62,"min_lift":0.03,"max_base_rate":0.85,"max_correlation":0.5,"max_picks":5,"min_picks":4}'),
  ('reliability_weights', '{"calibration":0.4,"sample":0.25,"completeness":0.25,"coverage":0.1}'),
  ('signup', '{"open":false}');
