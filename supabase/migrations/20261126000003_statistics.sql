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
