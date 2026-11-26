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
