-- AIDICT · 0010 · Snapshot horizons
-- Adds a 7-day preview horizon. Snapshots are still immutable: a fixture gets at most one snapshot per horizon and model
-- version (T-7d preview → T-24h → T-2h), and the latest one before kick-off is the official prediction that gets settled.
alter table public.prediction_snapshots drop constraint if exists prediction_snapshots_horizon_check;
alter table public.prediction_snapshots add constraint prediction_snapshots_horizon_check check (horizon in ('T-7d', 'T-24h', 'T-2h', 'manual'));
update public.scheduled_sync_jobs set cron = '17 * * * *' where job = 'predict_upcoming';
