# AIDICT — UI Prototype (Stage 2, awaiting final review)

**Date:** 2026-11-26 · **Location:** `prototype/` · **Status:** ⏳ revision 3 (Smart Market Predictions) ready for your review. Revision 2 added real team badges and the notification sound system

> Everything in the prototype (teams' ratings, scores, odds, probabilities, performance figures) is **sample data for design only**. It lives in `prototype/src/mock/`, every file there is labelled as sample data, and a ribbon on every screen says so. Production code at Stage 3 will not import it.

---

## 1. Run it locally
```powershell
cd prototype
npm install
npm run dev
```
Open http://localhost:5173. Useful extras:
- `npm run build`: production build check (passes).
- `npm run screenshots`: regenerates `documentation/prototype-screenshots/` (desktop 1440×900 and phone 390×844) using the Edge browser already on Windows. The script waits for every badge image to load and checks for console errors, broken images and horizontal overflow.
- `node scripts/check-notifications.mjs`: drives the notification rules end-to-end in Edge and prints the delivery log.
- `node scripts/generate-sounds.mjs`: regenerates the 7 original notification sounds in `public/sounds/`.
- `node scripts/check-markets.mjs`: prints every upcoming match's evaluated markets, selected picks and shortfall reasons, with sanity sums.

The prototype clock is fixed at **Sat 28 Nov 2026, 16:05 UTC**, so it shows finished, live and upcoming matches together.

---

## 2. Screen index
| # | Screen | Route | Screenshot (desktop / mobile) |
|---|---|---|---|
| 1 | Login / authentication (sign-in, error, loading, reset, email-sent) | `#/login` | `*-01-login.png` |
| 2 | Main dashboard | `#/` | `*-02-dashboard.png` |
| 3 | Sports selection | `#/sports` | `*-03-sports.png` |
| 4 | Competitions & leagues (+ standings, fixtures, national teams) | `#/competitions`, `#/competitions/pl`, `#/competitions/wc` | `*-04*.png` |
| 5 | Upcoming matches (date strip, filters) | `#/matches` | `*-05-upcoming-matches.png` |
| 6 | Live matches | `#/live` | `*-06-live.png` |
| 7 | Match details | `#/match/m-pl-ars-che` | `*-07-match-overview.png` |
| 8 | Match statistics | `#/match/…/stats` | `*-08-match-statistics.png` |
| 9 | Prediction details (markets, score matrix, models, snapshot) | `#/match/…/prediction` | `*-09-prediction-details.png` |
| 9b–d | Line-ups (pitch), head-to-head, data & model provenance | `/lineups`, `/h2h`, `/data` | `*-09b/c/d*.png` |
| **9e–f** | **Full market analysis: all 24 markets** (data inventory, strongest picks, filters, every market with outcomes, method, settlement, required data, backtest) | `#/match/m-pl-ars-che/markets`, `#/match/m-bl1-bay-sge/markets` | `*-09e*.png`, `*-09f*.png` |
| 10 | Smart Predictions (Picks · Leans · Skipped) | `#/smart` | `*-10-smart-predictions.png` |
| **10b** | **Smart Market Predictions**: strongest 4–5 per match across 24 markets, filters, selection rules, market coverage | `#/markets` | `*-10b-smart-market-predictions.png` |
| — | **Statistical explanation drawer** (per pick or per outcome) | Explain / Σ buttons | `*-33-pick-explanation.png` |
| 11 | Multi-Match Analysis | `#/multi` | `*-11-multi-match.png` |
| 12 | Team details (+ badge source card; national team example) | `#/team/ars`, `#/team/eng` | `*-12*.png` |
| 13 | Player details (limited-data state) | `#/player/saka` | `*-13-player.png` |
| 14 | Prediction history | `#/history` | `*-14-history.png` |
| 15 | Performance analytics (live, walk-forward backtest, **Markets (24)**: per-market evaluation, comparison across competitions, market over time) | `#/performance` | `*-15-performance.png`, `*-34-performance-markets.png` |
| 16 | Saved matches | `#/saved` | `*-16-saved.png` |
| 17 | Notifications (category filters, mute, event simulator, delivery log) | `#/notifications` | `*-17-notifications.png`, `*-32-notification-toasts.png` |
| 18 | User profile | `#/profile` | `*-18-profile.png` |
| 19 | Application settings (incl. **Notifications & sounds**) | `#/settings`, `#/settings?section=notifications` | `*-19-settings.png` |
| 20 | Data provider status | `#/providers` | `*-20-data-status.png` |
| 21 | Responsible use | `#/responsible` | `*-21-responsible-use.png` |
| 22 | About AIDICT | `#/about` | `*-22-about.png` |
| A | Admin: system health, providers, sync jobs, sports & competitions, team badges, **markets** (registry, coverage per competition, settlement-rule verification), models, data quality, feature flags, logs | `#/admin/…` | `*-23*.png` |
| — | Search results (teams, national teams, competitions, matches) | top bar / mobile search sheet | `*-30-search-results.png` |
| — | Bell menu (latest alerts, mute, mark all read) | top bar bell (desktop) | `desktop-31-bell-menu.png` |
| DS | Design system | `#/design` | `*-24-design-system.png` |

---

## 3. Design system (summary; live version at `#/design`)
**Direction:** taken from `UI.jpg`: warm charcoal surfaces, soft glass cards with a faint top highlight, crimson glow for the active state, neon green reserved for live play, gold for saved, large condensed score numerals, a floating pill bottom navigation on phones.

| Token group | Values |
|---|---|
| Brand | `--brand #B50F31`, sampled from the supplied logo. `--brand-fg #F2546F` for text and icons on dark (≈5.3:1 contrast) |
| Surfaces | `--bg #0F0D0D` → `--surface-1 #1A1717` → `--surface-2 #221E1E` → `--surface-3 #2B2626` |
| Semantic | live `#3EE46F`, win `#2FBF71`, draw `#8F8684`, loss `#E5484D`, gold `#F5B83D`, info `#6FA8FF`, warn `#F5A524`, danger `#F04452` |
| Outcome encoding | home = crimson, draw = neutral grey, away = blue. Used in every probability bar, chart and matrix |
| Type | **Manrope** (UI, 400–800) and **Barlow Semi Condensed** (scores and statistics, tabular figures) |
| Radius | 6 · 10 · 14 · 20 (cards) · 28 (sheets) |
| Elevation | `card` (inner highlight + soft drop), `pop` (menus, sheets), `glow` (active / featured) |
| Layout | Sidebar ≥1024 px (collapsible), floating bottom nav below 1024 px. 16 px gutters on mobile, 28 px on desktop. No horizontal page scroll at 390 px (verified on all 34 screens plus interaction states) |
| Motion | 150–260 ms fades and slides only. Respects `prefers-reduced-motion` |
| Light theme | Same tokens, re-valued. The supplied wordmark is white, so in light mode it sits on a dark plate. **Decision needed: keep it, or ship dark-only?** |

**Logo usage:** the supplied `aidict logo.png` (crimson "a" + white wordmark) is used in the sidebar, login and mobile header. `aidict icon.png` is used for the favicon, collapsed sidebar and About page. No alternative logo was created.

**Team badges (revision 2):** authentic crests exactly as published by football-data.org for all 42 clubs (39 SVG, 3 PNG), each verified for HTTP 200 and visually checked. National teams use the provider-supplied national flags, because no free provider supplies federation crests. Crests sit in a fixed square box with `object-contain`, so aspect ratio and transparency are preserved and there is no layout shift. Three dark crests (Tottenham, Juventus, Atalanta) get a thin light outline on the dark theme only. A neutral plain shield (no initials) appears only if a badge is missing or fails to load. Details, licensing and the production resolver: `TEAM_BADGES.md`.

**Notification sounds (revision 2):** seven original, short sounds, one per category, all at the same peak level. Calm defaults: new predictions and "going live" are silent, and match alerts cover saved matches only. Rules for de-duplication, merging, burst coalescing, throttling, quiet hours, autoplay and permissions are in `NOTIFICATIONS_PLAN.md`.

---

## 4. Interactions to try
1. **Date strip** (Dashboard, Matches): change the day. Competition chips filter the list.
2. **Star** on any match row saves or unsaves it (toast plus Saved page).
3. **Match page tabs:** Overview → Prediction (switch markets; Asian handicap, HT and HT/FT show their *validating / disabled* state) → Statistics → Head-to-head → Line-ups (pitch view; only Arsenal–Chelsea has line-ups, other matches show the honest "not available" state) → Data & model.
4. **Smart Predictions:** Picks / Leans / Skipped tabs, the "How ranking works" panel, the expand chevron for the signal breakdown, and "Add to multi".
5. **Multi-Match:** change each leg's market, remove legs, add matches. The distribution chart and combined figures recalculate (exact Poisson-binomial).
6. **History:** filters, pagination and expandable rows with snapshot details.
7. **Performance:** live tracking vs walk-forward backtest toggle.
8. **Prototype ribbon → Preview state:** forces **Loading / Empty / Error** on the current screen.
9. **Settings:** theme (dark / light / system), odds format and probability format apply across the app. "Hide value indicators" removes EV everywhere.
10. **Login:** a valid email with an 8-character password signs in. Include "wrong" in the password to see the error. "Forgot password?" shows the reset and email-sent states.
11. **Admin:** test a provider connection, run a sync job, resolve a data conflict, toggle feature flags, filter logs, and review the **Team badges** registry (coverage, source, provider ID, re-check, override).
12. **Search** (top bar, or 🔍 on mobile; Ctrl K on desktop): type "real", "eng" or "bundes". Results show authentic badges and flags. Arrow keys and Enter work.
13. **Notifications & sounds** (Settings, or bell → Settings): master sound switch, volume slider (plays a sample when released), ▶ Play preview per category, in-app/sound/desktop switches per category, alert scope, kick-off lead time, quiet hours, and "Allow desktop alerts" (asks the browser only when pressed).
14. **Simulate notification events** (Notifications page, prototype tool). Try:
    - **Goal**, then **Send same event again**: the repeat is suppressed.
    - **Full time**, then **Settled**: they merge into one alert.
    - **Goal · unsaved match**: filtered out by scope.
    - **Burst**: five events give one sound and three pop-ups.
    The delivery log explains each outcome. Sound plays after your first click on the page (browser autoplay rule).
15. **Bell menu** (desktop): latest alerts, quick mute, mark all read. The bell rings and shows an unread count when a new alert arrives.
16. **Smart Markets** (sidebar → Smart Markets, or the banner on Smart Predictions). Each match card shows its 4–5 strongest predictions with probability and range, confidence, reliability, data quality and status. Things to try:
    - **Explain** (Σ) opens the full statistical explanation: reasons, historical statistics, reliability breakdown, data used, method, settlement and why it was selected.
    - **Why not other markets?** lists the near-misses and the rule that excluded each (too obvious, no match-specific evidence, correlated with a selected pick, market validating or withheld).
    - **Filters**: day, competition, market category, probability, confidence.
    - **Selection rules** and **Market coverage** explain the algorithm and which markets the planned providers can support.
17. **Match → All markets** (24): the data inventory shows which inputs exist. Filter by category, probability and confidence, toggle unavailable markets, and expand any market for all outcomes, its calculation, settlement, required data and backtest. Notable examples:
    - **Bayern vs Frankfurt** (Bundesliga, goal-time data) shows the goal-order markets: 1UP, 2UP, Never Down and goals in a row.
    - **Arsenal vs Chelsea** shows the player markets as validating (line-ups available).
    - **Lyon vs Marseille** shows result markets withheld (model disagreement), so only 1 pick is published.
    - **Champions League** matches show no picks, with reasons.
18. **Performance → Markets (24)**: per-market Brier, log loss, ECE and sample size (small samples flagged); status of every market per competition; weekly predicted-vs-observed trend for any published market.

---

## 5. Honesty rules built into the UI
- Badges are never generated. A neutral shield appears only when no authentic badge exists.
- Goal and kick-off alerts state their data source, and the docs explain that free sources are delayed for most leagues.
- Markets that have not passed validation never show probabilities. They show *Validating* or *Disabled* with the reason.
- EV and "value" appear only when a named odds source and timestamp exist. Otherwise the UI says "No odds · not assessed". EV above +10% triggers a "probably a data or model error" warning.
- Smart Predictions ranks by signal (edge, calibration, completeness, agreement), not by raw probability. It has a first-class **Skipped** list with reasons.
- Missing inputs (xG, line-ups, injuries) are shown as *not used*, never estimated.
- Live view states that scores are delayed on the free tier and that pre-match predictions stay locked (no in-play model).
- Performance shows the base-rate **and** closing-odds benchmarks, including where AIDICT is behind the market.
- Multi-Match shows an explicit independence-assumption warning. Combined probabilities are never called guarantees.

---

## 6. Decisions for you
1. **Approval of the updated prototype** (including Smart Market Predictions), or revision notes.
1b. **Selection strictness:** with the sample data, of 15 upcoming matches 3 get 4 picks, 5 get 3, 3 get 1, and 4 (Champions League) get none. The evidence rule (+3 pp over a typical match) and correlation limit (φ 0.5) can be loosened to fill more cards, at the cost of more obvious picks.
1c. **1UP / 2UP / Never Down rules:** which bookmaker's settlement definitions should AIDICT model?
1d. **Player markets:** add a player-data source (likely paid), or leave Goalscorer / Player Not to Score as unavailable?
2. **National-team images:** keep the provider's national flags, or supply licensed federation crests (added through admin overrides)?
3. **Light theme:** keep it as an option, or dark-only for v1?
4. **Featured match:** dashboard hero shows one featured match. Auto-select by signal, or always your top saved match?
5. **Sound defaults:** happy with "New prediction" and "Match going live" silent by default?

## 7. Known prototype limitations (not defects of the design)
- The calendar picker and "Add team" are visual only. Search now works over the sample data.
- Crest images load from football-data.org's CDN at runtime, so you need an internet connection. Production serves mirrored, optimised copies.
- Desktop (OS) alerts appear only when the tab is in the background and you have allowed them.
- Sample data covers ~25 fixtures, so some tables (league standings) show only teams that appear in those fixtures.
- Bundle is ~270 KB gzipped (Recharts included). Production will code-split per route.
