# AIDICT

Professional multi-sport intelligence, statistics and prediction platform. Personal use, free-tier infrastructure.

> Analyse the data. Calculate the probability. Explain the prediction. Track the results.

## Status
- ✅ Stage 1: research and architecture (`documentation/`)
- ✅ Stage 2: UI prototype, **approved 2026-11-26** (`prototype/`, sample data only)
- 🔨 **Stage 3: production build in progress**: database, data engine, prediction engine (see `documentation/DEVELOPMENT_ROADMAP.md`)
- ⏳ Stage 4–6: integration, deployment, your testing. Stage 7 (Android) only after your explicit approval.

## Repository
| Path | What it is |
|---|---|
| `supabase/migrations/` | PostgreSQL schema (47 tables), RLS, immutability triggers. `supabase/seed/` holds reference data only (no predictions) |
| `supabase/tests/` | Applies all migrations to a real Postgres engine (PGlite) and verifies security and integrity rules |
| `services/data-engine/` | Python provider adapters (OpenFootball, football-data.co.uk, football-data.org, OpenLigaDB, API-Football), normalisation, cross-provider merging |
| `services/prediction-engine/` | Elo, Dixon–Coles, market derivations (incl. goal-order model), metrics, walk-forward backtest |
| `services/scripts/run_backtest.py` | Real-data backtest. Writes `documentation/BACKTEST_RESULTS.md` |
| `apps/web/` | Next.js application (next step) |
| `prototype/` | Approved interactive design reference |
| `.github/workflows/` | CI (migrations, Python tests, prototype build, secret scan) and the weekly backtest |

## Run the checks
```powershell
npm install
npm run db:test
```
```powershell
cd services
py -3.11 -m venv .venv
.venv\Scripts\python -m pip install -e ".[dev]"
.venv\Scripts\python -m pytest -m "not live"
.venv\Scripts\python scripts\run_backtest.py --leagues PL BL1
```

## Configuration
Copy `.env.example` to `.env.local` (web) or `services/.env` (jobs) and fill in your own values. Never commit secrets.
