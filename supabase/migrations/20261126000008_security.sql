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
