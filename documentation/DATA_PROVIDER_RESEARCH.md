# AIDICT — Data Provider Research

**Status:** Phase 0 research · **Researched on:** 2026-11-26
**Method:** Official websites, official API documentation, GitHub API metadata, and live sample requests where no key was needed. Where an official page could not be read, the item is marked **UNVERIFIED**. Nothing here assumes a feature is free because it appears in general documentation.

---

## 1. Summary and recommended priorities

| Priority | Provider | Role in AIDICT | Cost | Key constraint |
|---|---|---|---|---|
| 1 | **OpenFootball** (`football.json`) | Historical backbone for model training (2010-11 → 2025-26) | Free, CC0 | No IDs, no stats. Current-season files **stopped updating on 2026-09-22** |
| 2 | **football-data.co.uk** (CSV) — *added by research* | Historical match statistics (shots, SoT, corners, cards) and **historical closing odds**, used for benchmarking and value backtests | Free | Terms: "private individuals only", not commercial or AI-training products. Fine for personal use; blocks commercial use without permission |
| 3 | **football-data.org** v4 (free) | Current fixtures, delayed results, standings for 12 competitions | Free forever | 10 req/min; scores and schedules **delayed**; no lineups, cards, odds or stats |
| 4 | **OpenLigaDB** | German leagues (bl1/bl2/bl3/DFB-Pokal), cross-checks, goal events | Free, no key | Community-entered with no editorial review. ODbL attribution required |
| 5 | **API-Football** v3 (free) | Selective enrichment: match statistics, lineups and injuries for featured matches only | Free tier | ~100 req/day. Season access on the free plan **UNVERIFIED** |
| — | Club Elo | Optional external rating benchmark | Free | API endpoints and terms not confirmed. Not relied on |

**Conclusion:** The prompt's starting priorities hold, with two corrections:

1. OpenFootball is a *historical* source only. Do not use it for the live 2026-27 season.
2. **football-data.co.uk should be added.** It is the only free source found with both historical match statistics and historical bookmaker odds. AIDICT needs those odds to benchmark calibration against the market and to backtest any "value" claim honestly.

---

## 2. OpenFootball

**Repos:** https://github.com/openfootball · https://github.com/openfootball/football.json

| Item | Finding |
|---|---|
| Free plan | Free. No API, no key. Static JSON served from GitHub raw URLs |
| Authentication | None |
| Licence | **CC0-1.0 (public domain)**. Confirmed via the GitHub API licence field and the README ("dedicated to the public domain"). Commercial use is allowed |
| Seasons | Folders `2010-11` … `2026-27`, plus some single-year folders (`2019`, `2020`, `2025`, `2026`) for calendar-year leagues |
| 2025-26 files | `at.1, at.2, be.1, de.1, de.2, en.1, en.2, en.3, en.4, es.1, es.2, fr.1, fr.2, gr.1, it.1, it.2, nl.1, pt.1, sco.1, tr.1`. Also `*-full.json` variants for `at.1`, `de.1` and `en.1` |
| 2026-27 files | `de.1, en.1, en.2, es.1, fr.1, it.1, nl.1, pt.1` |
| Structure (basic) | `{name, matches:[{round, date, time, team1, team2, score:{ht:[h,a], ft:[h,a]}}]}`. Teams are **name strings only (no IDs)**. `ht` is sometimes missing |
| Structure (`-full`) | Adds `goals1/goals2` (scorer and minute), `ground`, `attendance`, `lineup` (starters and bench, captain flag). Available only for a few leagues and seasons |
| Fixtures | Yes, the full season schedule is included |
| Live scores | No |
| Statistics / xG / odds | No |
| Players | Scorer names only, plus lineups in `-full` files. No player IDs |
| Update frequency | README says the current season auto-updates daily at 05:00 UTC through GitHub Actions. **Observed:** the last commit was `2026-09-22` ("auto-update week 39"). The 2026-27 EPL file holds 45 of 380 played matches, the last on 2026-09-20. **The auto-update is currently stalled** |
| Other useful repos | `deutschland`, `italy`, `england`, `espana`, `europe`, `world`, `worldcup` (incl. 2026), `champions-league`, `club-worldcup`. All CC0. Football.TXT format (`spec` repo) |
| Missing | IDs, time zones (the `time` field is local and sometimes suffixed `UTC+0`), statuses, statistics |

**Use in AIDICT:** Bulk import 2010-11 → 2025-26 for model training and Elo history. The adapter supports only `getCompetitions`, `getSeasons`, `getFixtures`, `getResults` and `getFixtureById` (synthetic). Every other method returns `UNSUPPORTED`. Team-name normalisation is mandatory (for example "Manchester United FC" vs "Man United").

---

## 3. football-data.co.uk (recommended addition)

**Pages:** https://www.football-data.co.uk/data.php · https://www.football-data.co.uk/notes.txt

| Item | Finding |
|---|---|
| Free plan | Free CSV downloads. No key |
| Coverage | Up to 22 European divisions from 1993/94 (results). Match statistics and odds from 2000/01 for major leagues. 16 additional worldwide leagues from 2012/13 |
| Result columns | `FTHG, FTAG, FTR, HTHG, HTAG, HTR` |
| Stats columns | `HS, AS` (shots), `HST, AST` (on target), `HC, AC` (corners), `HF, AF` (fouls), `HY, AY, HR, AR` (cards), `HxG, AxG` (expected goals; season coverage **to verify per league**) |
| Odds columns | `B365H/D/A` (Bet365), `PSH/PSD/PSA` (Pinnacle), closing variants with a `C` suffix (`B365CH`, `PSCH`…), and market `Max*` / `Avg*`. Pinnacle closing odds from 2012/13. Since 2025-07-23, Pinnacle is excluded from market Max/Avg |
| Live / upcoming | Not live. A fixtures file with pre-match odds for upcoming matches is believed to exist (`fixtures.csv`): **UNVERIFIED** |
| Licence / terms | "intended for private individuals only, NOT commercial or data training products using automated bots/scrapers/AI." Data is provided "for the purposes of league match prediction". Acceptable for AIDICT's personal-use phase. **Must be revisited before any commercial or multi-user release** |
| Missing | IDs, lineups, players |

**Use in AIDICT:** Historical shots and SoT features, historical closing odds as a market benchmark (market-implied probabilities after removing the margin), and honest EV backtests. Downloads are manual or scheduled at low frequency (weekly), and the files are cached.

---

## 4. football-data.org (v4)

**Pages:** https://www.football-data.org/pricing · https://www.football-data.org/coverage · https://docs.football-data.org/general/v4/

| Item | Finding |
|---|---|
| Free plan | €0, "Free Forever" |
| Rate limit | **10 requests/minute** (authenticated). Unauthenticated: 100 per 24h, areas and competitions only |
| Authentication | Header `X-Auth-Token: <token>`. Base URL `https://api.football-data.org/v4/` |
| Free competitions (12) | `CL` Champions League, `PL` Premier League, `ELC` Championship, `BL1` Bundesliga, `SA` Serie A, `PD` La Liga, `FL1` Ligue 1, `DED` Eredivisie, `PPL` Primeira Liga, `BSA` Brasileirão Série A, `WC` World Cup, `EC` European Championship |
| Resources | Areas, Competitions, Matches, Teams, Persons, Standings, Scorers (competition, team and person match lists) |
| Head-to-head | Not stated on the pages read. Verify with a live call |
| Historical seasons (free) | **Not stated.** The "10 seasons of history" is listed only for the paid ML Pack Light (€29/mo) |
| Live scores | **Not free.** Free tier lists "Scores delayed" and "Schedules delayed". The delay length is not stated |
| Lineups / subs / cards / scorers / squads | Paid tiers only (from "Free w/ Livescores", €12/mo) |
| Statistics | Paid add-on (€15/mo) |
| Odds | Paid add-on (€15/mo, pre-match 1X2, only on top of a paid plan) |
| Rate-limit headers | `X-RequestsAvailable`, `X-RequestCounter-Reset`, `X-API-Version`, `X-Authenticated-Client` |
| Abuse policy | "Don't pull resources too often … you will get banned upon detection" |
| Licence / terms | Terms page returned 404. **Commercial and attribution terms are not stated.** Treat as personal use only until confirmed |

**Use in AIDICT:** Primary source for **current-season fixtures, (delayed) results and standings** for the 12 free competitions. Supported adapter methods: `getCompetitions`, `getSeasons` (current), `getFixtures`, `getFixtureById`, `getResults`, `getStandings`, `getTeams`. These return `UNSUPPORTED` on the free plan: `getMatchStatistics`, `getTeamStatistics`, `getLiveMatches`. The live view shows the delayed status honestly.

**Request budget:** One `/competitions/{code}/matches?dateFrom&dateTo` call per competition per sync, which is 12 calls (at most 10 per minute, so throttle). An hourly sync is ~288 calls/day, well within limits.

---

## 5. OpenLigaDB

**Pages:** https://www.openligadb.de/ · https://api.openligadb.de/swagger/v1/swagger.json · https://www.openligadb.de/lizenz

| Item | Finding |
|---|---|
| Free plan | Free. **No login, no API key** |
| Rate limit | **60 requests/minute per IP** (Swagger description). Polling `/getlastchangedate/…` before re-fetching is requested |
| Licence | **ODbL 1.0.** Commercial use allowed. **Attribution required** ("Daten von OpenLigaDB (www.openligadb.de), lizenziert unter ODbL 1.0"). Share-alike applies only when a modified database is distributed. Team logos and names are third-party and *not* covered |
| Leagues | `bl1`, `bl2`, `bl3`, `dfb` (many seasons; `bl1` back to 2002/03), plus `cl`, `el`, `PL`, `PD`, `SA`, Eredivisie, Swiss, Austrian, Turkish and other leagues. The list is uncurated and contains test/junk leagues (e.g. "Test", "Tippspiel"), so whitelist explicitly |
| Endpoints | `getmatchdata` (by league/season/matchday, by team, by id, head-to-head by two team IDs), `getbltable`, `getgrouptable`, `getavailableteams`, `getavailablegroups`, `getcurrentgroup`, `getlastchangedate`, `getgoalgetters`, `getnextmatchbyleagueshortcut`, `getmatchesbyteamid` … |
| Match fields | `matchID`, `matchDateTimeUTC`, `timeZoneID`, `team1/team2 {teamId, teamName, shortName, teamIconUrl}`, `matchIsFinished`, `matchResults[]` (HT and FT by `resultTypeID`), match-level `goals[]` (minute, scorer, penalty/own-goal flags), `location` (often null), `lastUpdateDateTime` |
| Live scores | Community-entered in near real time for German leagues. **No stated update guarantee** |
| Statistics / odds / lineups | No |
| Data quality | No editorial review. HT results are missing in some older seasons. Coverage varies |

**Use in AIDICT:** Supplementary source for German competitions, near-live German scores, goal minutes, and cross-validation of football-data.org results. Its reliability weight is lower than football-data.org for conflicting scores.

---

## 6. API-Football (api-sports.io, v3)

**Pages:** https://www.api-football.com/pricing · https://www.api-football.com/documentation-v3

> **Research limitation:** Both api-football.com and api-sports.io returned HTTP 403 behind a Cloudflare bot check, to the automated fetcher and to the built-in browser. Bot checks were not bypassed. The figures below come from search-result snippets of the official pages and are **UNVERIFIED**. **Action for you:** after creating a free account, confirm the limits in the API-Football dashboard. AIDICT will also read the quota headers on the first call.

| Item | Finding |
|---|---|
| Free plan | **100 requests/day** (official pricing snippet). Paid tiers: Pro 7,500/day, Ultra 75,000/day, Mega 150,000/day |
| Endpoint access | Vendor states "access to the entire API" on all plans |
| Season access on free plan | **UNVERIFIED.** The vendor's beginner guide implies the free plan covers only recent seasons |
| Per-minute limit | **UNVERIFIED** (third-party sources disagree: 10 vs 30/min) |
| Authentication | Header `x-apisports-key` on `https://v3.football.api-sports.io` (or the RapidAPI headers). **UNVERIFIED** against the current docs |
| Endpoints (expected) | fixtures, fixtures/statistics, fixtures/events, fixtures/lineups, fixtures/players, standings, teams/statistics, players, injuries, odds (pre-match), odds/live, predictions |
| Odds | Expected (pre-match odds with limited history). **UNVERIFIED** |
| Licence / terms | **UNVERIFIED** |

**Use in AIDICT:** Optional and budget-capped. A daily cap of 90 calls leaves 10 in reserve. Calls go only to featured or saved matches for statistics, lineups and injuries. AIDICT will **never** display API-Football's own "predictions" endpoint as its own model output. The adapter reads `x-ratelimit-*` / `x-ratelimit-requests-remaining` headers and stops before the quota runs out.

---

## 7. Feature availability matrix (free tiers)

| Feature | OpenFootball | football-data.co.uk | football-data.org | OpenLigaDB | API-Football |
|---|---|---|---|---|---|
| Historical results | ✅ 2010→ | ✅ 1993→ | ⚠️ depth not stated | ✅ (bl1 2002→) | ⚠️ unverified |
| Upcoming fixtures | ⚠️ stale since 09/2026 | ⚠️ unverified | ✅ | ✅ (German +) | ✅ |
| Live scores | ❌ | ❌ | ❌ (delayed) | ⚠️ community | ✅ (quota-limited) |
| Standings | ❌ (derivable) | ❌ (derivable) | ✅ | ✅ | ✅ |
| Shots / SoT / corners | ❌ | ✅ | ❌ (paid) | ❌ | ✅ |
| xG | ❌ | ⚠️ partial | ❌ | ❌ | ⚠️ |
| Lineups | ⚠️ some `-full` | ❌ | ❌ (paid) | ❌ | ✅ |
| Injuries | ❌ | ❌ | ❌ | ❌ | ✅ |
| Odds | ❌ | ✅ historical | ❌ (paid) | ❌ | ⚠️ |
| Stable IDs | ❌ | ❌ | ✅ | ✅ | ✅ |
| Team crests | ❌ | ❌ | ✅ `team.crest` (SVG/PNG; national teams get flags) | ⚠️ `teamIconUrl` (third-party, outside ODbL) | ⚠️ `team.logo` (media server returned a placeholder to automated checks) |
| Licence clarity | ✅ CC0 | ⚠️ personal only | ⚠️ not stated | ✅ ODbL | ⚠️ unverified |

---

## 7b. Data needed by the 24 Smart Markets
| Data type | Free sources | Coverage | Markets that need it |
|---|---|---|---|
| Final scores | All five providers | All competitions | O/U, Handicap, Asian Handicap, Double Chance, 6 combined (fully supported) |
| Corner counts | football-data.co.uk (HC/AC), API-Football statistics (budget) | 22 European divisions, not Champions League | Corners O/U, Corners 1X2 |
| Goal times / scoring order | OpenLigaDB (German leagues, goal minutes), OpenFootball "-full" files (EPL, Bundesliga, Austria; recent seasons), API-Football events (100 calls/day) | Bundesliga full; Premier League partial; others ✗ | 1st Goal, 5 consecutive-goal markets, 1UP, 2UP, Never Down, DC-1UP |
| Verified settlement rules | None (bookmaker rules) | — | 1UP, 2UP, Never Down, DC-1UP |
| Line-ups | API-Football (budgeted) | Featured matches only | Goalscorer, Player Not to Score |
| Player minutes, shots, penalty takers | **Not available free** | — | Goalscorer, Player Not to Score → **need an additional source** (API-Football paid tier, or another licensed player-data provider) |

## 8. Other sports (for later phases, not built now)

| Sport | Candidate free sources | Finding (2026-11-26) |
|---|---|---|
| Basketball | balldontlie (free: 5 req/min, 1 league, "free endpoints" only). API-Basketball (api-sports, free ~100/day, **unverified**) | balldontlie's free tier is too thin for NBA box-score modelling. Plan on API-Basketball or a paid tier when the module starts |
| Tennis | Jeff Sackmann `tennis_atp` / `tennis_wta` | **Both repos return 404 on the GitHub API today.** An archival mirror exists on Hugging Face (original licence CC BY-NC-SA 4.0, non-commercial). tennis-data.co.uk (results and odds) to evaluate. **Re-research at the start of the tennis phase** |
| Cricket | Cricsheet | ~23.5k matches ball-by-ball (Tests, ODIs, T20Is, IPL, BBL…). Registers under ODC Attribution. Match-data licence to confirm |
| Baseball | MLB Stats API (unofficial, restrictive terms), Retrosheet | To research |
| Ice hockey | NHL web API (undocumented) | To research |

Per the brief, these sports appear in the UI as **"Planned / In development"** and never as operational.

---

## 9. Risks and mitigations

| Risk | Mitigation |
|---|---|
| OpenFootball auto-update stalls (observed) | Use it for history only. Current season comes from football-data.org and OpenLigaDB |
| football-data.org free tier delays scores | Label the delay in the UI ("Delayed source · updated HH:MM"). Live tab shows source and freshness |
| Free API quota exhaustion | Per-provider budget manager, request logging (`provider_sync_logs`), circuit breaker, quota bars in Admin |
| Conflicting scores between providers | Reliability-weighted resolution, `data_conflicts` queue, no silent overwrite of a `FINAL` record |
| Licence change or commercial use | Licence register in `football_providers`. Mandatory review before any multi-user or commercial launch |
| Team-name mismatches | `team_aliases` table, deterministic normaliser and a manual-review queue in Admin |
