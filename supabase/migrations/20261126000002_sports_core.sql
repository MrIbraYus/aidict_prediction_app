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
