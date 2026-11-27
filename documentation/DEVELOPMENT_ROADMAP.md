# AIDICT — Development Roadmap

**Date:** 2026-11-26 · Each stage ends with explicit acceptance criteria. Stages 2, 6 and 7 have approval gates.

---

## Stage 1: Research ✅
**Deliverables:** `PROJECT_PLAN.md`, `TECHNICAL_ARCHITECTURE.md`, `DATA_PROVIDER_RESEARCH.md`, `DATABASE_PLAN.md`, `DEVELOPMENT_ROADMAP.md`.

## Stage 2: UI prototype ⏳ (current; approval gate)
**Deliverables:** an interactive prototype in `prototype/` covering all 22 screens plus the admin area, with desktop and mobile layouts, loading/empty/error/success states, a design-system page and screenshots.
**Exit criteria:** your explicit "UI approved", or revision instructions (iterate, then present again).

## Stage 3: Approved web application (UI approved 2026-11-26 · in progress)

**Progress log**
- 2026-11-26 · 3.1 monorepo (npm workspaces, git, `.env.example`, CI). 3.2 migrations 0001–0008 + reference seed, verified on PGlite with 30 security and integrity checks (no Docker on this machine, so the Supabase local stack is not used). 3.4 five provider adapters + normaliser + merge with conflict detection. 3.7 Elo, Dixon–Coles (analytic-gradient MLE), market maths, walk-forward backtest on real data.
- 2026-11-26 · **First real backtest** (`BACKTEST_RESULTS.md`, PL and BL1, 2019-20 → 2025-26, 4,802 out-of-sample matches): Dixon–Coles 1X2 beats the base rate (log loss −0.087 PL / −0.077 BL1, CIs exclude zero) and **passes its gate**. It trails closing odds by 0.021 / 0.025. **Over/Under 2.5 and BTTS fail their gates** on the raw model (weak signal and/or calibration), so they stay *validating*. Next modelling steps: isotonic calibration layer, shots-based features from football-data.co.uk, then extend the backtest to every score-matrix market (handicaps, double chance, combined) before any of them can publish.
- 2026-11-26 · **Per-market backtest** of 26 outcomes with leak-free Platt calibration and real Bundesliga goal order (OpenLigaDB, ~99% coverage). PL: 8 outcomes publishable. BL1: 20 publishable, including 1st Goal, all goals-in-a-row markets, 1UP and Never Down; 1UP-type markets stay blocked on settlement rules. Over/Under and BTTS fail in the PL. Rules added: per-line gating, persistence across two weekly runs. Next: corners model (football-data.co.uk HC/AC), shots features, then sync jobs and the web app.
- 2026-11-26 · **Web app (3.3, 3.9, 3.11, 3.12)**: Next.js 16 app in `apps/web` with Supabase auth (first account becomes the owner/admin, sign-up then closed; owner can reopen it), RLS-backed pages for dashboard, matches, match detail (all markets, score matrix, form/H2H, data provenance), Smart Picks, history, performance, competitions/standings, teams, saved, notifications, settings, data status and admin. Theme system rebuilt: saved per device, follows the OS live in System mode (with a focus fallback for webviews), synced across tabs, never reset by server re-renders. Settlement job (`aidict_engine.jobs.settle`) and a scheduled pipeline workflow added. Production build passes (24 routes).
- Defaults applied (changeable): selection rules unchanged · 1UP/2UP/Never Down stay validating until settlement rules are supplied · player markets unavailable.
- 2026-11-27 · **Live Supabase connected** (Session pooler, eu-west-1). Schema applied; migrations now tracked in `aidict_private.migrations` (`npm run db:migrate`). Synced 10 competitions (3,340 fixtures, 1,419 results, 187 teams with official crests, Bundesliga goal minutes for 83 matches). The sync was rewritten for bulk writes (one read per season, pipelined batches, only changed rows): La Liga went from about 25 minutes to 39 seconds, at ~200 ms per database round trip. Fixed: "Paris FC" was merged into PSG by a bare "paris" alias, and the team cache now clears on rollback. Backtests and gates ran for all 8 leagues; FL1 was re-run after the Paris fix, and a re-run in the same week now replaces that week's result instead of counting as a second consecutive pass. Snapshot schedule corrected: **T-7d preview → T-24h → T-2h** (migration 0010, model version 1.0.1; the mislabelled 1.0.0 snapshots stay as the immutable record and are superseded, and history counts only each match's latest snapshot). Published 97 predictions with 139 picks.
- 2026-11-27 · Sign-up fix: the first (unconfirmed) account locked the workspace because confirmation was required. The owner bootstrap now creates a confirmed account directly, usernames work as logins (stored as `<name>@users.aidict.local`, which has no mailbox; change the password in Settings), unconfirmed email accounts get a resend option, and the unconfirmed account was deleted at the owner's request.
- **Waiting on you:** create the owner account at /signup, then `vercel login` for deployment and a private GitHub repository for the scheduled pipeline. API-Football key optional.
| Step | Work | Acceptance |
|---|---|---|
| 3.1 | Monorepo setup (npm workspaces), git and private GitHub repo, CI (lint, typecheck, test) | CI green on an empty app |
| 3.2 | Supabase project, migrations 0001–0008, RLS, seeds (no sample predictions) | `supabase db reset` works locally. RLS tests pass |
| 3.3 | Next.js app: port design tokens and components from the prototype, auth flows, protected routes | Login, logout and password reset work against Supabase |
| 3.4 | Data engine: adapters, normaliser, merger, budget manager | Unit tests per adapter on recorded fixtures. Duplicate and conflict tests |
| 3.5 | History import: OpenFootball 2010-11→2025-26, football-data.co.uk stats and odds | Row counts reconciled per league/season. Aliasing report with 0 unmapped teams in top 8 leagues |
| 3.6 | Current sync: football-data.org and OpenLigaDB (+ API-Football if a key is provided) | Hourly job idempotent. Fixtures for the next 14 days present |
| 3.7 | Prediction engine: Elo → Poisson → Dixon–Coles → LogReg → GBM challengers. Calibration | Walk-forward backtest report with Brier, log loss, RPS, ECE and CIs vs baselines |
| 3.8 | Market derivation and activation gates | Only gate-passing markets are `active`. Others shown as validating/disabled |
| 3.8a | **Smart Markets, phase A**: market registry, data inventory, score-matrix markets (O/U, Handicap, Asian Handicap, Double Chance, 6 combined) | Each market has its own walk-forward backtest. Joint probabilities verified against brute-force score simulation |
| 3.8b | **Phase B**: corners (football-data.co.uk history), negative-binomial model, Corners O/U and 1X2 | Calibration within gate on n ≥ 1,000 per competition group |
| 3.8c | **Phase C**: goal events ingestion (OpenLigaDB, OpenFootball "-full", API-Football budget), goal-order model, 1st Goal, consecutive-goal markets, 1UP/2UP/Never Down/DC-1UP | Settlement rules confirmed with you before 1UP-type markets can publish. Sequence statistics validated against observed goal orders |
| 3.8d | **Phase D**: player markets, **only if** a player-minutes/line-ups source is added (decision for you; likely paid) | Stays "data unavailable" otherwise |
| 3.8e | Selection engine (eligibility, scoring, de-correlation, shortfall reasons), `smart_picks`, explanation payloads | Unit tests: an 85% low-reliability outcome never outranks a well-supported 78%. Correlated duplicates removed. Fewer than 4 shown with reasons |
| 3.9 | Snapshot publishing (T-24h, T-2h), settlement, performance aggregates | Immutability tests: UPDATE/DELETE rejected. Post-kickoff insert rejected |
| 3.10 | FastAPI on-demand endpoints (markets, multi-match MC) | Contract tests. JWT verified |
| 3.11 | Smart Predictions, Multi-Match, History, Performance with real data | No sample data reachable in production builds |
| 3.12 | Admin: providers, sync, competitions, models, quality, flags, logs | Admin routes rejected for non-admin (E2E). Keys masked |

## Stage 4: Integration and testing
Unit tests (normalisation, adapters, probability maths, market derivations, auth utilities), integration tests (DB, sync, persistence, settlement), and E2E with Playwright (login, dashboard, filters, match details, predictions, history, settings, admin). Also a secret scan, responsive checks at 360/768/1280/1440, and an error-handling review.

## Stage 5: Web deployment
Vercel project (web and API), environment variables, Supabase production project, GitHub Actions secrets, first full sync and prediction run. **Verified:** the deployed URL loads, auth works, predictions exist for the next matchday, and the Admin health page is green.

## Stage 6: User testing (gate)
Deliver the URL and a testing guide. Collect feedback, fix and refine. **No Android work until you explicitly request it.**

## Stage 7: Android (after explicit request)
Dedicated Android UI design → approval → Expo + React Native + Expo Router, shared API client and types, EAS Build release APK, install instructions. Not published to Google Play.

---

## Indicative effort (single developer + Claude Code)
| Stage | Estimate |
|---|---|
| 3.1–3.3 | 3–4 sessions |
| 3.4–3.6 | 4–5 sessions |
| 3.7–3.9 | 5–7 sessions (most model and validation work) |
| 3.10–3.12 | 4–5 sessions |
| 4–5 | 3–4 sessions |
