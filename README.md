# AIDICT

Professional multi-sport intelligence, statistics and prediction platform. Personal use, free-tier infrastructure.

> Analyse the data. Calculate the probability. Explain the prediction. Track the results.

## Status
- ✅ Stage 1: research and architecture (`documentation/`)
- ✅ Stage 2: UI prototype, **approved 2026-11-26** (`prototype/`, sample data only)
- 🔨 **Stage 3: production build in progress**: database, data engine, prediction engine and the web app (see `documentation/DEVELOPMENT_ROADMAP.md`)
- ⏳ Stage 4–6: integration, deployment, your testing. Stage 7 (Android) only after your explicit approval.

## Repository
| Path | What it is |
|---|---|
| `supabase/migrations/` | PostgreSQL schema (47 tables), RLS, immutability triggers. `supabase/seed/` holds reference data only (no predictions) |
| `supabase/tests/` | Applies all migrations to a real Postgres engine (PGlite) and verifies security and integrity rules |
| `services/data-engine/` | Python provider adapters (OpenFootball, football-data.co.uk, football-data.org, OpenLigaDB, API-Football), normalisation, cross-provider merging |
| `services/prediction-engine/` | Elo, Dixon–Coles, market derivations (incl. goal-order model), metrics, walk-forward backtest |
| `services/scripts/run_backtest.py` | Real-data backtest. Writes `documentation/BACKTEST_RESULTS.md` |
| `apps/web/` | Next.js 16 web app (Supabase auth, RLS, every page on real data) |
| `prototype/` | Approved interactive design reference |
| `.github/workflows/` | CI, the weekly backtest and the data pipeline (sync, predict, settle, gates) |

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

## Run the web app
```powershell
npm run db:apply
```
```powershell
npm run web:dev
```
`db:apply` creates the schema once (it refuses to run if the tables already exist). Later schema changes: `npm run db:migrate`. Load the first data from `services/`:
```powershell
$env:PYTHONPATH = "data-engine;prediction-engine"; .venv\Scripts\python -m aidict_data.jobs.sync_current; .venv\Scripts\python -m aidict_engine.jobs.gates; .venv\Scripts\python -m aidict_engine.jobs.predict
```
Then open http://localhost:3000/signup. The first account becomes the owner (admin), and sign-up closes after it.

## Configuration
Copy `.env.example` to `.env.local` at the repository root and fill in your own values. Use the Supabase **Session pooler** connection string for `SUPABASE_DB_URL`. Never commit secrets.
