-- AIDICT · 0011 · Owner-only internals
-- Members see outcomes (fixtures, probabilities, picks, their track record). How AIDICT produces them — models, parameters,
-- calibration, validation, data pipeline — is readable only by admins. The web server reads technical fields with the
-- service key after checking the admin role; a member's own token cannot reach them through the database API.

-- 1) Tables that become admin-only (replacing the read-all policies from 0008/0009).
do $$
declare t text;
begin
  foreach t in array array[
    'prediction_models', 'model_versions', 'model_evaluations', 'backtest_runs', 'market_backtests', 'market_competition_status',
    'prediction_performance', 'odds_snapshots', 'data_providers', 'scheduled_sync_jobs', 'fixture_data_inventory', 'feature_flags',
    'team_aliases', 'outcome_gates', 'outcome_calibration'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_admin())', t || '_admin_read', t);
  end loop;
end $$;

-- 2) Member-safe explanation for each pick (plain language, no method names, thresholds or backtest figures).
alter table public.smart_picks add column if not exists public_reasons jsonb;

-- 3) Column-level access: technical fields are not granted to signed-in users at all.
revoke select on public.prediction_snapshots from authenticated;
grant select (id, fixture_id, model_version_id, snapshot_at, horizon, lambda_home, lambda_away, score_matrix, data_completeness, published)
  on public.prediction_snapshots to authenticated;                          -- not: inputs, input_hash

revoke select on public.smart_picks from authenticated;
grant select (id, snapshot_id, fixture_id, rank, market_id, outcome_key, probability, reliability, confidence, lift, published_at, public_reasons)
  on public.smart_picks to authenticated;                                   -- not: score, reasons, excluded

revoke select on public.market_outcome_probabilities from authenticated;
grant select (snapshot_id, market_id, outcome_key, probability, base_rate, status)
  on public.market_outcome_probabilities to authenticated;                  -- not: breakdown, reliability, completeness

-- 4) Saving preferences is an upsert, which needs INSERT as well as UPDATE (RLS still limits it to the user's own row).
grant insert on public.user_preferences to authenticated;
