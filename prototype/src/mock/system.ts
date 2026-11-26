/**
 * ⚠ DESIGN PROTOTYPE SAMPLE DATA — provider states, quotas, notifications and admin records are illustrative.
 * Provider facts (licences, free-tier limits) reflect documentation/DATA_PROVIDER_RESEARCH.md.
 */

export type ProviderStatus = 'operational' | 'degraded' | 'down' | 'not_configured' | 'stale'

export const PROVIDERS = [
  {
    id: 'football-data-org', name: 'football-data.org', role: 'Current fixtures · results · standings', status: 'operational' as ProviderStatus,
    lastSync: '2026-11-28T15:53:00Z', freshness: 'Scores delayed (free tier)', quota: { used: 4, limit: 10, unit: 'per minute' }, daily: { used: 236, limit: null as number | null },
    coverage: '12 competitions', licence: 'Terms not published — personal use', key: '••••••••••••3f2a', latency: 312, uptime: 0.998,
  },
  {
    id: 'openligadb', name: 'OpenLigaDB', role: 'German leagues · goal events', status: 'degraded' as ProviderStatus,
    lastSync: '2026-11-28T15:51:00Z', freshness: 'Community-entered, near real time', quota: { used: 9, limit: 60, unit: 'per minute' }, daily: { used: 412, limit: null },
    coverage: 'bl1 · bl2 · bl3 · dfb', licence: 'ODbL 1.0 · attribution required', key: 'No key required', latency: 1840, uptime: 0.962, incident: '3 timeouts in the last hour — retries succeeding',
  },
  {
    id: 'api-football', name: 'API-Football', role: 'Statistics · line-ups · injuries (featured only)', status: 'operational' as ProviderStatus,
    lastSync: '2026-11-28T16:01:00Z', freshness: 'Budget-capped enrichment', quota: { used: 63, limit: 100, unit: 'per day' }, daily: { used: 63, limit: 100 },
    coverage: 'Featured & saved matches', licence: 'Free plan — terms to confirm', key: '••••••••••••a91c', latency: 428, uptime: 0.999,
  },
  {
    id: 'openfootball', name: 'OpenFootball', role: 'Historical results 2010-11 → 2025-26', status: 'stale' as ProviderStatus,
    lastSync: '2026-11-23T04:00:00Z', freshness: 'Upstream last updated 22 Sep 2026', quota: null, daily: { used: 0, limit: null },
    coverage: '20 leagues · 16 seasons', licence: 'CC0 · public domain', key: 'No key required', latency: 0, uptime: 1, incident: 'Current-season files stalled upstream — used for history only',
  },
  {
    id: 'football-data-co-uk', name: 'football-data.co.uk', role: 'Historical stats & closing odds', status: 'operational' as ProviderStatus,
    lastSync: '2026-11-23T04:10:00Z', freshness: 'Weekly CSV import', quota: null, daily: { used: 0, limit: null },
    coverage: '22 divisions · from 2000-01', licence: 'Private individuals only', key: 'No key required', latency: 0, uptime: 1,
  },
]

export const SYNC_JOBS = [
  { job: 'sync_current', runner: 'GitHub Actions', cron: '17 * * * *', last: '2026-11-28T15:17:00Z', status: 'success', duration: '48s', rows: 184 },
  { job: 'predict_upcoming', runner: 'GitHub Actions', cron: '0 3,9,15,21 * * *', last: '2026-11-28T15:00:00Z', status: 'success', duration: '3m 12s', rows: 46 },
  { job: 'settle_results', runner: 'GitHub Actions', cron: '30 5,23 * * *', last: '2026-11-28T05:30:00Z', status: 'success', duration: '1m 05s', rows: 58 },
  { job: 'retrain_and_backtest', runner: 'GitHub Actions', cron: '0 4 * * 1', last: '2026-11-23T04:00:00Z', status: 'success', duration: '24m 40s', rows: 0 },
  { job: 'sync_history', runner: 'GitHub Actions', cron: '0 4 * * 1', last: '2026-11-23T04:00:00Z', status: 'warning', duration: '2m 31s', rows: 0, note: 'OpenFootball upstream unchanged since 22 Sep' },
  { job: 'live_refresh', runner: 'Next.js route (on demand)', cron: 'on view · 60s cache', last: '2026-11-28T16:04:00Z', status: 'success', duration: '0.4s', rows: 9 },
]

export const NOTIFICATIONS = [
  { id: 'n1', kind: 'prediction', title: 'Predictions published for Saturday', body: '46 matches analysed · 9 picks · 14 skipped for insufficient evidence.', at: '2026-11-28T15:00:00Z', matchId: undefined as string | undefined },
  { id: 'n2', kind: 'kickoff', title: 'Arsenal vs Chelsea starts in 90 minutes', body: 'Confirmed line-ups are now included in the analysis.', at: '2026-11-28T16:00:00Z', matchId: 'm-pl-ars-che' },
  { id: 'n3', kind: 'provider', title: 'OpenLigaDB degraded', body: 'Timeouts detected. Bundesliga live updates may lag by a few minutes.', at: '2026-11-28T15:40:00Z', matchId: undefined },
  { id: 'n4', kind: 'result', title: 'Prediction settled: Newcastle 2–1 Aston Villa', body: 'Newcastle to win (58%) — correct. Brier contribution 0.176.', at: '2026-11-28T14:25:00Z', matchId: 'm-pl-new-avl' },
  { id: 'n5', kind: 'model', title: 'Asian handicap remains in validation', body: 'Calibration error 0.041 is above the 0.04 gate. Market stays unpublished.', at: '2026-11-23T04:30:00Z', matchId: undefined },
  { id: 'n6', kind: 'result', title: 'Prediction settled: Getafe 0–0 Valencia', body: 'Under 2.5 goals (61%) — correct.', at: '2026-11-28T14:55:00Z', matchId: 'm-pd-get-val' },
  { id: 'n7', kind: 'conflict', title: 'Data conflict needs review', body: 'Roma’s result vs Lecce differs between two providers.', at: '2026-11-27T22:10:00Z', matchId: 'm-sa-juv-rom' },
  { id: 'n8', kind: 'kickoff', title: 'Saved match tomorrow: Liverpool vs Man City', body: 'Prediction snapshot will lock at kickoff (16:30 UTC).', at: '2026-11-27T18:00:00Z', matchId: 'm-pl-liv-mci' },
]

export const CONFLICTS = [
  { id: 'c-311', fixture: 'Roma vs Lecce · 23 Nov', field: 'Full-time score', values: [{ source: 'football-data.org', value: '2–1', reliability: 0.95 }, { source: 'OpenFootball', value: '2–2', reliability: 0.8 }], status: 'open', age: '18 h' },
  { id: 'c-309', fixture: 'Mainz vs Union Berlin · 8 Nov', field: 'Kickoff time', values: [{ source: 'football-data.org', value: '14:30 UTC', reliability: 0.95 }, { source: 'OpenLigaDB', value: '15:30 UTC', reliability: 0.85 }], status: 'resolved', age: '20 d', resolution: 'Time-zone offset bug in OpenLigaDB local time — UTC field used' },
  { id: 'c-302', fixture: 'Getafe vs Alavés · 2 Nov', field: 'Home team name', values: [{ source: 'football-data.org', value: 'Getafe CF', reliability: 0.95 }, { source: 'OpenFootball', value: 'Getafe', reliability: 0.8 }], status: 'resolved', age: '26 d', resolution: 'Alias added to team_aliases' },
]

export const MODEL_VERSIONS = [
  { version: 'football-dc 1.3.0', family: 'Dixon–Coles + isotonic', trained: '2026-11-23', window: '2016-08 → 2026-11', status: 'active', brier: 0.586, logLoss: 0.991, ece: 0.014 },
  { version: 'football-lgbm 0.4.2', family: 'LightGBM (challenger)', trained: '2026-11-23', window: '2016-08 → 2026-11', status: 'candidate', brier: 0.592, logLoss: 1.002, ece: 0.031 },
  { version: 'football-dc 1.2.1', family: 'Dixon–Coles', trained: '2026-10-05', window: '2016-08 → 2026-10', status: 'retired', brier: 0.589, logLoss: 0.995, ece: 0.019 },
  { version: 'football-logreg 0.9.0', family: 'Multinomial logistic', trained: '2026-11-23', window: '2016-08 → 2026-11', status: 'candidate', brier: 0.588, logLoss: 0.994, ece: 0.017 },
]

export const FEATURE_FLAGS = [
  { key: 'smart_predictions', description: 'Smart Predictions ranking page', enabled: true },
  { key: 'value_indicators', description: 'Show EV only when a real odds source is attached', enabled: true },
  { key: 'multi_match_mc', description: 'Monte Carlo multi-match analysis', enabled: true },
  { key: 'api_football_enrichment', description: 'Use API-Football budget for featured matches', enabled: true },
  { key: 'in_play_model', description: 'In-play probability updates (not built)', enabled: false },
  { key: 'basketball_module', description: 'Basketball predictions (validating)', enabled: false },
]

export const LOGS = [
  { at: '2026-11-28T15:41:12Z', level: 'warn', source: 'openligadb', message: 'GET /getmatchdata/bl1/2026/12 timed out after 8000 ms (attempt 1/3)' },
  { at: '2026-11-28T15:41:21Z', level: 'info', source: 'openligadb', message: 'Retry succeeded (attempt 2/3) · 9 matches upserted' },
  { at: '2026-11-28T15:17:48Z', level: 'info', source: 'sync_current', message: 'football-data.org · 12 competitions · 184 rows · quota remaining 6/min' },
  { at: '2026-11-28T15:00:07Z', level: 'info', source: 'predict_upcoming', message: 'Snapshots written: 46 fixtures × T-24h · model football-dc 1.3.0' },
  { at: '2026-11-27T22:10:03Z', level: 'error', source: 'merge', message: 'Score conflict on fixture 88213 (Roma–Lecce): 2–1 vs 2–2 → conflict c-311 opened' },
  { at: '2026-11-27T04:00:55Z', level: 'audit', source: 'admin', message: 'Feature flag value_indicators enabled by admin' },
  { at: '2026-11-23T04:24:40Z', level: 'info', source: 'retrain_and_backtest', message: 'Backtest complete · n=31,482 · DC log loss 0.991 · LightGBM not promoted' },
]
