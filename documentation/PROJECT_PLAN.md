# AIDICT — Project Plan

**Version:** 1.0 · **Date:** 2026-11-26 · **Current stage:** Stage 2: UI prototype (awaiting approval)

> Analyse the data. Calculate the probability. Explain the prediction. Track the results.

---

## 1. Inspection of the existing project (Phase 0, step 1)

| Item | Finding |
|---|---|
| Directory | `C:\Users\IBRAHIM\Desktop\Aidict System` |
| Existing code | **None.** No framework, dependencies or configuration, so there is nothing to preserve |
| Git | Not a git repository yet. `git init` and a private GitHub repo come at Stage 3 |
| Brand assets supplied | `aidict logo.png` (808×230, transparent: crimson "a" mark + **white "idict" wordmark**, designed for dark backgrounds), `aidict icon.png` (825×825 app icon, crimson tile, white mark) |
| UI reference | `UI.jpg`: three dark mobile livescore screens (line-ups, scores, match info) |
| Brand colour (sampled) | **#B50F31** (RGB 181,15,49), the dominant pixel colour in both logo and icon |
| Local tooling | Node 26.13, npm 11.3, Python 3.11 + 3.14, Git 2.49, Vercel CLI 50.38. *Not installed:* pnpm, GitHub CLI, Supabase CLI (will use `npx supabase`) |

### Reading of the UI reference
- Very dark, warm charcoal surfaces (not pure black) with soft glass cards and subtle top highlights.
- **Crimson glow** marks the active state: the active date, active tab and active nav item get a red underline glow. It matches the logo colour.
- **Neon green** is reserved for live states (LIVE pill, live minute "90+4").
- Gold star for favourites/saved.
- Large score numerals. Compact competition headers with country flag. Status chips (AET, 20:30, 65′) on the left edge of match rows.
- Segmented controls (Info · Summary · Report · Stats), date strip with arrows, floating pill bottom navigation on mobile.
- W/D/L form pills in green, grey and red.

The prototype keeps this direction and extends it to a desktop-class analytics product, adding data-dense tables, charts and methodology surfaces that the reference does not show.

---

## 2. Scope of the first release (web)
**In scope:** responsive web app, Supabase Auth (personal use), real football data (OpenFootball history, football-data.co.uk history, football-data.org current, OpenLigaDB German leagues, API-Football optional), data sync, the football prediction engine (Elo, Poisson, Dixon–Coles, logistic regression, GBM challengers, Monte Carlo), validated markets only, match analysis, Smart Predictions, Multi-Match Analyser, prediction history, performance analytics, admin, tests, Vercel deployment.

**Out of scope (by design):** payments, subscriptions, bookmaker accounts, bet placement, deposits, guarantees of any kind, and the Android app (Stage 7).

**Other sports:** basketball, tennis, cricket, baseball and ice hockey appear as *Planned / In development*. They are not shown as operational until their data and validation gates pass.

---

## 3. Approval gates
| Gate | Trigger | Status |
|---|---|---|
| G1: Research and architecture | Phase 0 documents delivered | ✅ Delivered 2026-11-26 |
| **G2: UI approval** | Interactive prototype presented | ⏳ **Waiting for your explicit approval** |
| G3: Web user testing | Deployed URL and testing guide delivered | Not started |
| G4: Android start | Your explicit request after G3 | Not started |
| G5: Android UI approval | Android designs presented | Not started |

No real application code (Next.js app, Supabase schema, providers, models) is written before G2.

---

## 4. Key decisions made (engineering judgement)
| # | Decision | Rationale |
|---|---|---|
| D1 | Add **football-data.co.uk** as a historical source | The only free source with historical stats **and** closing odds, which are needed to benchmark calibration and to test value claims honestly |
| D2 | OpenFootball for **history only** | Its auto-update has stalled since 2026-09-22 (verified via GitHub commits) |
| D3 | **GitHub Actions** for all scheduled jobs | Vercel Hobby cron is daily-only, Render free spins down, and Actions gives ~2,000 min/month on a private repo |
| D4 | **FastAPI on Vercel Python Functions** for on-demand calculations | Free, no cold-spin server to keep alive, shared by web and Android |
| D5 | Predictions precomputed and stored as **immutable snapshots** at T-24h and T-2h | Guarantees no post-kickoff edits and makes history auditable |
| D6 | **Dixon–Coles score matrix** as the single source for all goal markets | Keeps 1X2, O/U, BTTS, CS, AH and team goals mutually consistent |
| D7 | Market activation gate (n ≥ 300 OOS, beats baseline, ECE threshold) | Prevents unsupported markets from appearing operational |
| D8 | Prototype as a standalone **Vite + React + Tailwind v4** app with clearly separated sample data | Fast to iterate. Tokens and components port directly into Next.js |
| D9 | **Authentic provider-published crests** (football-data.org `team.crest`). National teams use the provider's flags. Neutral fallback only when no badge exists (*revised 2026-11-26 at your request*) | Shown unmodified, for identification only, in a personal app. Licensing review required before any public or commercial release. See `TEAM_BADGES.md` |
| D12 | **Smart Market Predictions**: 24 markets, each with its own model and gate. Strongest 4–5 per match chosen by probability, reliability and match-specific evidence, with correlated picks removed | Avoids "obvious" or poorly supported picks. Fewer than 4 are shown, with reasons, when evidence is lacking. See `PREDICTION_ENGINE.md` |
| D11 | **Original synthesised notification sounds** and a rules-based notification centre (de-duplicate, merge, coalesce, throttle) | No audio licensing risk. Calm defaults. Android channels planned. See `NOTIFICATIONS_PLAN.md` |
| D10 | Private GitHub repository | Personal app. Secrets in GitHub/Vercel env. Actions minutes are sufficient |

---

## 5. Decisions that need your input
1. **API-Football account:** create a free account and add the key when Stage 3 starts. Its free-plan season limits could not be verified (bot protection blocked automated reading).
2. **football-data.org token:** register a free token (email only) at Stage 3.
3. **GitHub repository visibility:** private is recommended (see D10).
4. **Light theme:** the prototype includes a light theme generated from the same tokens. Keep it, or ship dark-only for v1?

---

## 6. Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Free sources lack live scores for most leagues | High | Medium | Show delayed state honestly. Upgrade path is football-data.org €12/mo |
| Not enough clean data for some markets (HT, HT/FT, AH) | Medium | Medium | Market gating. Markets shown as "Validating" |
| Supabase 500 MB limit | Medium | Medium | Size budget, Parquet offload for stats, retention jobs |
| Provider terms change | Low | High | Licence register, per-provider kill switch in Admin |
| Overconfidence perceived as "tips" | Medium | High | Probability-first UI, SKIP recommendations, Responsible Use page, no guarantees anywhere |
