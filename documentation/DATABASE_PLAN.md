# AIDICT — Database Plan (Supabase PostgreSQL)

**Status:** Proposed (Phase 0) · **Date:** 2026-11-26
**Target:** Supabase Free: 500 MB database, no automatic backups, paused after 7 days of inactivity.

---

## 1. Principles
- **Normalised core, JSONB at the edges.** Sports entities are relational. Provider payloads and model input snapshots are compact JSONB.
- **One internal ID per real-world entity.** Provider IDs are kept in `provider_mappings` and never used as primary keys.
- **Append-only where history matters.** Predictions, sync logs and audit logs are insert-only.
- **UTC everywhere** (`timestamptz`). The display time zone is a user preference.
- **RLS on every table**, deny by default.
- Migrations are version-controlled in `supabase/migrations/` (timestamped SQL) and applied with the Supabase CLI. The CLI is not yet installed; it will be added as a dev dependency (`npx supabase`).

---

## 2. Schema overview

### 2.1 Users
| Table | Key columns | Notes |
|---|---|---|
| `user_profiles` | `user_id PK → auth.users`, `display_name`, `role ('user'·'admin')`, `created_at` | Role is mirrored in `auth.users.app_metadata.role` for JWT checks. Supabase owns `auth.users`, so there is no separate `users` table |
| `user_preferences` | `user_id PK`, `theme`, `time_zone`, `odds_format`, `probability_format`, `default_sport`, `reality_check_minutes`, `notification_prefs jsonb` | |
| `saved_matches` | `user_id`, `fixture_id`, `note`, `alert_kickoff bool`, `alert_result bool`, `created_at` · PK `(user_id, fixture_id)` | |
| `notifications` | `id`, `user_id`, `event_id`, `category`, `title`, `body`, `fixture_id?`, `read_at?`, `created_at` | Index `(user_id, read_at, created_at desc)` |
| `notification_events` | `id`, `category`, `fixture_id?`, `dedupe_key` **unique**, `payload jsonb`, `source`, `created_at` | One row per real-world event. Prevents duplicates |
| `notification_deliveries` | `event_id`, `user_id`, `channel`, `status`, `delivered_at` · unique `(event_id, user_id, channel)` | No double delivery per channel |
| `push_subscriptions` | `user_id`, `platform`, `endpoint` / `expo_token`, `keys jsonb`, `last_seen_at` | Web Push and Android (Stage 7). See `NOTIFICATIONS_PLAN.md` |

### 2.2 Sports data
| Table | Key columns | Notes |
|---|---|---|
| `sports` | `id smallint PK`, `slug`, `name`, `status ('active'·'validating'·'planned')` | |
| `competitions` | `id`, `sport_id`, `slug`, `name`, `country`, `type ('league'·'cup'·'international')`, `tier`, `is_active`, `coverage jsonb` | Unique `(sport_id, slug)` |
| `seasons` | `id`, `competition_id`, `label ('2026-27')`, `start_date`, `end_date`, `is_current` | Unique `(competition_id, label)` |
| `teams` | `id`, `sport_id`, `name`, `short_name`, `tla`, `country`, `colors jsonb` | |
| `team_aliases` | `team_id`, `alias`, `source` | Unique `(lower(alias), source)` for name normalisation |
| `team_badges` | `team_id` PK, `source`, `provider_team_id`, `source_url`, `override_url`, `storage_path`, `thumb_64`, `thumb_128`, `format`, `kind`, `contrast_hint`, `sha256`, `status`, `verified_at`, `history jsonb` | Authentic crest per team, auto-resolved on import. See `TEAM_BADGES.md` |
| `players` | `id`, `name`, `birth_date?`, `nationality?`, `position?` | Populated only where a source provides it |
| `fixtures` | `id bigint PK`, `season_id`, `home_team_id`, `away_team_id`, `kickoff_at timestamptz`, `status`, `round`, `venue?`, `source_tz?`, `primary_source`, `last_synced_at` | Index `(kickoff_at)`, `(season_id, kickoff_at)`, `(status) where status in ('LIVE','HT')` |
| `match_results` | `fixture_id PK`, `ft_home`, `ft_away`, `ht_home?`, `ht_away?`, `et_home?`, `pen_home?`, `outcome`, `is_final`, `confirmed_by text[]`, `updated_at` | `confirmed_by` lists the agreeing providers |
| `match_statistics` | `fixture_id`, `team_id`, `stat_key`, `value numeric`, `definition_source`, `provider_id` | PK `(fixture_id, team_id, stat_key, definition_source)`. Long format keeps it sparse and honest |
| `team_statistics` | `team_id`, `season_id`, `stat_key`, `value`, `as_of`, `definition_source` | Derived aggregates |
| `player_statistics` | `player_id`, `season_id`, `team_id`, `stat_key`, `value`, `definition_source` | |
| `provider_mappings` | `entity_type`, `entity_id`, `provider_id`, `provider_entity_id`, `first_seen_at` | Unique `(provider_id, entity_type, provider_entity_id)` |
| `provider_payloads` | `id`, `provider_id`, `endpoint`, `request_hash`, `payload jsonb`, `fetched_at` | **30-day retention.** Older payloads are deleted, and only the hash stays in the sync log |

### 2.3 Data infrastructure
| Table | Key columns | Notes |
|---|---|---|
| `football_providers` | `id`, `slug`, `name`, `kind ('api'·'file')`, `licence`, `attribution_text`, `reliability_weight`, `daily_budget`, `minute_budget`, `is_enabled` | Generalised later as `data_providers` with `sport_id` |
| `provider_sync_logs` | `id`, `provider_id`, `job`, `endpoint`, `status_code`, `latency_ms`, `quota_remaining?`, `rows_upserted`, `error?`, `started_at` | Append-only. 90-day retention |
| `data_quality_reports` | `id`, `competition_id`, `season_id`, `completeness jsonb`, `freshness_minutes`, `issues jsonb`, `created_at` | |
| `data_conflicts` | `id`, `fixture_id`, `field`, `values jsonb (per provider)`, `status ('open'·'resolved'·'ignored')`, `resolution`, `resolved_by?`, `resolved_at?` | Fixtures with open conflicts are excluded from training |
| `scheduled_sync_jobs` | `job`, `cron`, `runner`, `last_run_at`, `last_status`, `next_expected_at`, `is_enabled` | Read by Admin. Runners report back |

### 2.4 Predictions
| Table | Key columns | Notes |
|---|---|---|
| `prediction_models` | `id`, `sport_id`, `slug ('dixon_coles')`, `family`, `description` | |
| `model_versions` | `id`, `model_id`, `version ('1.3.0')`, `trained_at`, `train_window`, `params jsonb`, `artifact_uri`, `status ('candidate'·'active'·'retired')`, `git_sha` | Large artefacts go to Supabase Storage (1 GB). DC parameters are small enough to keep in `params` |
| `model_evaluations` | `id`, `model_version_id`, `scope jsonb (competition/market)`, `n`, `brier`, `log_loss`, `rps`, `ece`, `ci jsonb`, `reliability jsonb`, `created_at` | |
| `prediction_markets` | `id`, `sport_id`, `slug ('1x2','ou_2_5','btts',…)`, `name`, `outcomes text[]`, `status ('active'·'validating'·'disabled')`, `status_reason`, `gate_metrics jsonb` | Market gating lives here |
| `prediction_snapshots` | `id uuid`, `fixture_id`, `model_version_id`, `snapshot_at`, `horizon ('T-24h','T-2h')`, `lambda_home`, `lambda_away`, `score_matrix smallint[]` (10×10 in basis points), `markets jsonb`, `inputs jsonb`, `input_hash`, `data_completeness`, `published bool` | **Immutable.** One row per fixture × model version × horizon |
| `predictions` | `id`, `snapshot_id`, `fixture_id`, `market_id`, `selection`, `probability numeric(6,5)`, `confidence_band`, `signal_score`, `recommendation ('pick'·'lean'·'skip')`, `skip_reason?`, `published_at` | The **published** selections shown in History. Immutable |
| `prediction_outcomes` | `prediction_id PK`, `result ('won'·'lost'·'void'·'push'·'half_won'·'half_lost')`, `settled_at`, `result_source` | Written by the settlement job only |
| `prediction_performance` | `scope_key`, `period`, `n`, `hits`, `brier`, `log_loss`, `rps`, `ece`, `updated_at` | Materialised aggregates for fast dashboards |
| `backtest_runs` | `id`, `model_version_id`, `config jsonb`, `split jsonb`, `metrics jsonb`, `started_at`, `finished_at` | Walk-forward runs, kept separate from production predictions |
| `odds_snapshots` | `fixture_id`, `market_id`, `selection`, `decimal_odds`, `bookmaker`, `source`, `captured_at` | Used only when a real odds source exists. Never synthesised |

### 2.4b Smart Market Predictions (24 markets; see `PREDICTION_ENGINE.md`)
| Table | Key columns | Notes |
|---|---|---|
| `market_definitions` | `id` ('ou', 'first-goal', '1x2-2up'…), `name`, `category`, `outcome_schema jsonb`, `model_module`, `required_data text[]`, `settlement_rules jsonb`, `settlement_verified bool`, `gate_thresholds jsonb` | The extensible registry. Replaces the simpler `prediction_markets` (kept as a view for compatibility) |
| `market_competition_status` | `market_id`, `competition_id`, `status` ('active'·'validating'·'disabled'·'unavailable'), `reason`, `oos_n`, `brier`, `log_loss`, `ece`, `evaluated_at` | Gate per market × competition. Written by backtests |
| `fixture_data_inventory` | `fixture_id`, `data_type` ('results'·'goal_times'·'corners'·'lineups'·'player_stats'·'penalties'), `available bool`, `completeness`, `source`, `as_of` | What exists for each fixture before any market is evaluated. Missing ≠ zero |
| `goal_events` | `fixture_id`, `minute`, `stoppage`, `team_id`, `player_id?`, `own_goal`, `penalty`, `source`, `confidence` | Scoring order for first-goal, consecutive-goal and 1UP/2UP/Never-Down markets (OpenLigaDB, OpenFootball "-full", API-Football events) |
| `lineups` | `fixture_id`, `team_id`, `player_id`, `starter bool`, `position`, `minutes?`, `confirmed_at`, `source` | Required for player markets |
| `market_outcome_probabilities` | `snapshot_id`, `market_id`, `outcome_key`, `probability`, `breakdown jsonb` (e.g. Asian full/half/push), `reliability`, `completeness`, `status` | Every evaluated outcome, also non-published ones, for transparency and backtesting. Immutable with the snapshot |
| `smart_picks` | `snapshot_id`, `fixture_id`, `rank` (1–5), `market_id`, `outcome_key`, `probability`, `reliability`, `confidence`, `lift`, `score`, `reasons jsonb`, `excluded jsonb` (alternatives and why), `published_at` | The strongest 4–5 per match. Immutable. Settled in `prediction_outcomes` |
| `market_backtests` | `backtest_run_id`, `market_id`, `competition_id`, `n`, `brier`, `log_loss`, `ece`, `reliability_bins jsonb`, `hit_rate`, `ci jsonb` | Independent evaluation of every market |

Size impact: about 60 outcome rows per fixture per snapshot at roughly 40 bytes each (packed), which is about 35 MB/year. Picks are about 5 per fixture. Both fit the 500 MB plan, with outcome rows older than 2 seasons archived to Storage as Parquet.

### 2.5 System
| Table | Notes |
|---|---|
| `app_settings` | Key/value JSONB, admin-only writes |
| `feature_flags` | `key`, `enabled`, `rollout jsonb`, `description` |
| `audit_logs` | `actor`, `action`, `entity`, `entity_id`, `diff jsonb`, `ip_hash`, `created_at`. Append-only |

---

## 3. Integrity rules (enforced in the database)
1. **Immutable predictions.** `prediction_snapshots`, `predictions`: `REVOKE UPDATE, DELETE` from all API roles. A `BEFORE UPDATE OR DELETE` trigger raises an exception, as defence in depth. A `BEFORE INSERT` trigger rejects a snapshot when `snapshot_at >= fixtures.kickoff_at`.
2. **No duplicate fixtures.** Unique partial index `(season_id, home_team_id, away_team_id, date(kickoff_at at time zone 'UTC'))`, excluding `CANCELLED`.
3. **Results are final-aware.** Updates that change a final score are blocked unless they come through conflict resolution (`set_config('aidict.conflict_resolution','on')`).
4. **Time-travel safety for features.** Feature views take an `as_of timestamptz` parameter and filter `match_results.updated_at < as_of` and `kickoff_at < as_of`.
5. **Check constraints:** probabilities in [0,1], 1X2 rows sum to 1 ± 1e-6 (validated on insert by the pipeline), non-negative scores.

---

## 4. Row Level Security (summary)
| Table group | `anon` | `authenticated` | `admin` (JWT `app_metadata.role`) | service role |
|---|---|---|---|---|
| Sports data, predictions, performance | — | SELECT | SELECT | ALL |
| `user_*`, `saved_matches`, `notifications` | — | own rows (`user_id = auth.uid()`) | own rows | ALL |
| Provider, sync, quality, conflicts, models, flags, settings | — | — | SELECT and limited UPDATE (flags, enable/disable, conflict resolution) | ALL |
| `audit_logs` | — | — | SELECT | INSERT |

The service-role key is used only by GitHub Actions jobs and server-side code. It is never shipped to a client.

---

## 5. Size budget (500 MB)
| Data | Estimate |
|---|---|
| Fixtures and results (≈25 competitions × 16 seasons × ~380) ≈ 150k rows | ~40 MB with indexes |
| Match statistics (long format, ~12 stats × 2 teams × 100k matches) ≈ 2.4M rows | ~180 MB, **largest item**. Keep top 8 leagues for stats, others results-only |
| Prediction snapshots (~350 fixtures/week × 2 horizons × 2 models, ~1.5 KB) | ~55 MB/year |
| Published predictions (~6 markets × 350/week) | ~15 MB/year |
| Raw payloads (30-day rolling) | ≤ 40 MB |
| Logs (90-day rolling) | ≤ 20 MB |
| **Total year 1** | **≈ 350 MB**. A weekly size check in Admin raises a warning at 400 MB |

Mitigations if the budget is tight: store statistics for training in Parquet in Supabase Storage (1 GB) or as a GitHub Actions artifact, and keep only recent seasons in Postgres.

---

## 6. Backups (free tier has none)
- A weekly GitHub Actions job runs `pg_dump --format=custom` and stores it as an encrypted, 90-day-retention workflow artifact (private repo).
- Migrations and seeds can rebuild the full schema. Historical sports data can be re-imported from the providers.
- **Predictions and outcomes cannot be re-created**, which is why they are in the weekly dump.

---

## 7. Migration plan (Stage 3)
1. `0001_extensions_enums.sql`: `pgcrypto`, enums (status, outcome, market status).
2. `0002_sports_core.sql`: sports, competitions, seasons, teams, aliases, players, fixtures, results.
3. `0003_statistics.sql`: match, team and player statistics.
4. `0004_providers.sql`: providers, mappings, payloads, sync logs, quality, conflicts, jobs.
5. `0005_predictions.sql`: models, versions, evaluations, markets, snapshots, predictions, outcomes, performance, backtests, odds.
6. `0006_users.sql`: profiles, preferences, saved matches, notifications, plus the `auth.users` insert trigger.
7. `0007_system.sql`: settings, flags, audit logs.
8. `0008_rls.sql`: all policies, grants and immutability triggers.
9. `seed/`: sports, markets (with initial `validating` status), providers and the licence register. **No sample predictions or performance data in production seeds.**
