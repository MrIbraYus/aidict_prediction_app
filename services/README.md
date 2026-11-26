# AIDICT services (Python)

| Package | Path | Purpose |
|---|---|---|
| `aidict_data` | `data-engine/` | Provider adapters, team-name normalisation, cross-provider merge and conflict detection, HTTP limits |
| `aidict_engine` | `prediction-engine/` | Elo, Dixon–Coles, market derivations (score matrix and goal order), metrics, walk-forward backtest |
| `aidict_api` | `api/` | FastAPI service for on-demand calculations (next step) |

## Adapter capabilities (free tiers)
| Method | OpenFootball | football-data.co.uk | football-data.org | OpenLigaDB | API-Football |
|---|---|---|---|---|---|
| fixtures / results | ✅ history | ✅ history | ✅ current (token) | ✅ German leagues | ✅ (budget) |
| goal order | ✅ `-full` files | — | — | ✅ minutes | ✅ `get_events` |
| standings | — | — | ✅ | ✅ | — |
| teams + crests | — | — | ✅ | — | — |
| match statistics | — | ✅ shots, SoT, corners, cards | — | — | ✅ per fixture |
| odds | — | ✅ closing (Pinnacle/avg/B365) | — | — | — |
| live | — | — | delayed | ✅ community | ✅ (budget) |

Unsupported methods return `Unsupported(reason)`. Nothing is faked or zero-filled.

## Setup
```powershell
py -3.11 -m venv .venv
.venv\Scripts\python -m pip install -e ".[dev]"
```

## Tests
```powershell
.venv\Scripts\python -m pytest -m "not live"
```
```powershell
.venv\Scripts\python -m pytest -m live
```
The first command runs offline against recorded payloads. The second hits the real keyless providers (OpenFootball, OpenLigaDB).

## Backtest (real data)
```powershell
.venv\Scripts\python scripts\run_backtest.py --leagues PL BL1 --first 2016-17 --last 2025-26 --test-from 2019-20
```
This writes `documentation/BACKTEST_RESULTS.md`, with per-match predictions in `.cache/backtest-<league>.csv`.

## Secrets
Provider keys are read from environment variables (`FOOTBALL_DATA_ORG_TOKEN`, `API_FOOTBALL_KEY`). See `/.env.example`.
