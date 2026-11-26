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
