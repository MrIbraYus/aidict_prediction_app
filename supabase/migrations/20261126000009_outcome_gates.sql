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
