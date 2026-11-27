-- AIDICT · 0012 · Access periods
-- Every new account starts a 3-day trial. Admins can make an account unlimited, give it a period, extend it or end it at any
-- time. When access ends the member can still sign in but cannot read any app data (enforced here, not only in the UI).
-- Admins are always unlimited. Each sign-up notifies every admin in the in-app inbox.

create table public.user_access (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  plan         text not null check (plan in ('trial', 'period', 'unlimited')),
  access_until timestamptz,                         -- null only for 'unlimited'
  reminded_at  timestamptz,                         -- "1 day left" reminder sent for the current period
  updated_by   uuid,
  updated_at   timestamptz not null default now(),
  check ((plan = 'unlimited') = (access_until is null))
);
alter table public.user_access enable row level security;
-- New tables inherit Supabase's default "all privileges" grants; take them back explicitly. Writes are service-key only.
revoke all on public.user_access from anon, authenticated;
grant select on public.user_access to authenticated;
revoke all on public.outcome_gates, public.outcome_calibration from anon, authenticated;
grant select on public.outcome_gates, public.outcome_calibration to authenticated;  -- rows still admin-only (0011 policies)
create policy user_access_own_read on public.user_access for select to authenticated using (user_id = auth.uid());
create policy user_access_admin_read on public.user_access for select to authenticated using (public.is_admin());

-- Access check used by every member-readable policy. security definer so it can read user_access regardless of the caller.
create or replace function public.has_access() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.user_access a
    where a.user_id = auth.uid() and (a.plan = 'unlimited' or a.access_until > now())
  )
$$;
revoke all on function public.has_access() from public;
grant execute on function public.has_access() to authenticated;

-- Member-readable data now also requires active access. "(select …)" lets Postgres evaluate it once per query.
do $$
declare t text;
begin
  foreach t in array array[
    'sports', 'competitions', 'seasons', 'teams', 'team_badges', 'players', 'fixtures', 'match_results', 'goal_events', 'lineups',
    'match_statistics', 'team_statistics', 'player_statistics', 'market_definitions', 'prediction_snapshots',
    'market_outcome_probabilities', 'predictions', 'smart_picks', 'pick_outcomes'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select public.has_access()))', t || '_read', t);
  end loop;
end $$;

-- Sign-up: profile, preferences, a 3-day trial, and a notification for every admin.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  name text := split_part(coalesce(new.email, ''), '@', 1);
  trial_end timestamptz := now() + interval '3 days';
begin
  insert into public.user_profiles (user_id, display_name) values (new.id, name) on conflict do nothing;
  insert into public.user_preferences (user_id) values (new.id) on conflict do nothing;
  insert into public.user_access (user_id, plan, access_until) values (new.id, 'trial', trial_end) on conflict do nothing;
  insert into public.notifications (user_id, category, title, body)
    select u.id, 'system', 'New account: ' || name, 'Free trial until ' || to_char(trial_end at time zone 'UTC', 'DD Mon YYYY HH24:MI') || ' UTC.'
    from auth.users u
    where u.id <> new.id and coalesce(u.raw_app_meta_data ->> 'role', '') = 'admin';
  return new;
end $$;

-- Existing accounts: admins unlimited, everyone else a fresh 3-day trial from today.
insert into public.user_access (user_id, plan, access_until)
select u.id,
       case when coalesce(u.raw_app_meta_data ->> 'role', '') = 'admin' then 'unlimited' else 'trial' end,
       case when coalesce(u.raw_app_meta_data ->> 'role', '') = 'admin' then null else now() + interval '3 days' end
from auth.users u
on conflict do nothing;
