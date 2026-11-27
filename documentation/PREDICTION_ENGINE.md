# AIDICT — Prediction Engine & Smart Market Predictions

**Date:** 2026-11-26 · **Status:** design. A working reference implementation is in the prototype (`prototype/src/lib/markets.ts`), running on sample inputs.

> Analyse the data → calculate the probability → explain the prediction → track the results.
> No language model produces probabilities. Every number comes from a documented statistical model with its own backtest.

---

## 1. Layers
```
Data inventory  →  Base models  →  Market models (24)  →  Reliability  →  Selection (4–5)  →  Snapshot & tracking
```
| Layer | What it does |
|---|---|
| **Data inventory** | Per fixture: which inputs exist, their source, timestamp and completeness (`fixture_data_inventory`). A market is evaluated only if all its inputs exist. Missing data is never treated as zero |
| **Base models** | Elo ratings · Dixon–Coles goals model (score matrix) · goal-order model · corners model · player model |
| **Market models** | One module per market. Each computes probabilities for its outcomes from the base models with **its own logic** and settles with **its own rules** |
| **Reliability** | Per market × competition: calibration, sample size, data completeness, settlement status |
| **Selection** | Ranks eligible outcomes, removes duplicates and correlated picks, keeps the strongest 4–5 |
| **Snapshot** | Immutable record (T-24h, T-2h) of every published probability, inputs hash and model versions. Settled automatically |

## 2. Base models
| Model | Purpose | Notes |
|---|---|---|
| Elo | Team strength over time | Home advantage, competition K-factor, season regression |
| **Dixon–Coles** | Joint distribution of final scores (score matrix, 0–10 × 0–10) | Time-decayed attack/defence (ξ), low-score correction (ρ). Isotonic calibration on walk-forward folds |
| **Goal-order model** | Probability of each **sequence** of goals | Prototype: home/away goals are independent Poisson processes, so given a final score every ordering of the goals is equally likely. All C(h+a, h) sequences for scores up to 7–7 are enumerated exactly. **Production:** time-varying intensity (goals are more likely late) plus score-state effects (trailing teams attack more), fitted on goal-minute data (Dixon–Robinson style), then simulated by Monte Carlo (50,000 paths per match) |
| **Corners model** | Corner counts per team | Negative binomial (over-dispersed), corners won vs opponent corners conceded, home effect, strength adjustment. Total and difference by convolution |
| **Player model** | Player scores at least once | λ_team × player share of team goals (shrunk to position priors) × expected minutes ÷ 90 × start probability, plus penalty duty. Requires line-ups |

## 3. The 24 markets: market-specific logic
| # | Market | Calculation | Data required | Supported with planned providers? |
|---|---|---|---|---|
| 1 | 1X2 – 1UP | Goal-order: P(team ever leads by 1); otherwise full-time result | Scores, goal times, **verified settlement rules** | ⚠️ Partial: goal times for Bundesliga (and partly PL). Settlement rules must be confirmed |
| 2 | 1X2 – 2UP | Goal-order: P(ever leads by 2) ∪ P(full-time win) | Same | ⚠️ Partial |
| 3 | 1X2 – Never Down | Goal-order: P(team never trails), 0–0 included | Same | ⚠️ Partial |
| 4 | Over/Under | Score matrix: exact total-goals distribution, lines 0.5–4.5 | Scores | ✅ All competitions |
| 5 | Handicap (3-way) | Score matrix: goal difference after handicap → win / handicap draw / loss | Scores | ✅ |
| 6 | Asian Handicap | Score matrix with quarter-line splitting: full win, half win, push, half loss, full loss. Ranked by probability of profit (full + half win) | Scores | ✅ data. Currently validating (calibration) |
| 7 | Double Chance | Score matrix: 1X, 12, X2 | Scores | ✅ |
| 8 | Double Chance – 1UP | Goal-order: P(ever leads by 1) ∪ P(double chance at full time) | Scores, goal times, settlement rules | ⚠️ Partial |
| 9 | 1st Goal | Scoring-intensity share conditioned on each final score; "no goal" from 0–0 cell. Production uses time-varying intensities | Scores, goal times (to validate and settle) | ⚠️ Partial: Bundesliga, Premier League |
| 10 | Any team 2+ in a row | Goal-order: run of ≥2 consecutive goals by one team | Scores, goal times | ⚠️ Partial |
| 11 | Any team 3+ in a row | Goal-order: run of ≥3 | Same | ⚠️ Partial (rare event, needs larger sample) |
| 12 | Home 2+ in a row | Goal-order: home run of ≥2 | Same | ⚠️ Partial |
| 13 | Home 3+ in a row | Goal-order: home run of ≥3 | Same | ⚠️ Partial |
| 14 | Away 2+ in a row | Goal-order: away run of ≥2 | Same | ⚠️ Partial |
| 15 | Goalscorer | Player model | Line-ups, player goals **and minutes**, penalty takers | ❌ **Needs an additional source** (API-Football paid tier or another licensed player-data provider) |
| 16 | Player Not to Score | Complement of player model, confirmed starters only | Same | ❌ Needs additional source |
| 17 | Corners – Over/Under | Corners model, lines 7.5–11.5 | Corner history | ✅ football-data.co.uk (22 European divisions, not Champions League) |
| 18 | Corners – 1X2 | Corners model: P(home more), P(equal), P(away more) | Corner history | ✅ data. Currently validating (calibration) |
| 19 | Home or Over 2.5 | **Joint** event on the score matrix (home win ∪ 3+ goals), cells counted once | Scores | ✅ |
| 20 | Home or Under 2.5 | Joint: home win ∪ 0–2 goals | Scores | ✅ |
| 21 | Draw or Over 2.5 | Joint: draw ∪ 3+ goals | Scores | ✅ |
| 22 | Draw or Under 2.5 | Joint: draw ∪ 0–2 goals | Scores | ✅ |
| 23 | Away or Over 2.5 | Joint: away win ∪ 3+ goals | Scores | ✅ |
| 24 | Away or Under 2.5 | Joint: away win ∪ 0–2 goals | Scores | ✅ |

**Summary with the planned free providers:** 12 markets are fully supported (all competitions with results, plus corners where football-data.co.uk covers the league). 10 are partially supported: they need goal times (free only for the Bundesliga and partly the Premier League) and/or verified settlement rules. 2 need an additional data source (player markets).

### Settlement definitions
1UP, 2UP, Never Down and DC-1UP are bookmaker products whose rules differ: when the early payout triggers, whether extra time counts, and void rules. AIDICT stores the exact rules in `market_definitions.settlement_rules`. These markets stay **validating** until the rules are confirmed against your bookmaker and the backtest is re-run under those rules.

## 4. Reliability (per market × competition)
`reliability = 0.40 × calibration + 0.25 × sample size + 0.25 × data completeness + 0.10 × settlement/coverage`

| Component | Definition |
|---|---|
| Calibration | 1 − ECE / 0.06 (expected calibration error from walk-forward out-of-sample predictions) |
| Sample size | log10(n) / log10(5000), capped at 1 (n = out-of-sample predictions for that market and competition group) |
| Data completeness | Minimum completeness across the market's required inputs for this fixture (×0.85 when an input conflict is open) |
| Settlement/coverage | 1 if standard settlement and validated; lower if rules are unverified |

Confidence shown to you: **High** ≥ 80 · **Medium** ≥ 66 · **Low** below that. The probability range shown is ±(2 + 12 × (1 − reliability)) pp.

## 5. Selecting the 4–5 strongest predictions
1. Evaluate every market whose required data exists.
2. Compute each outcome's probability with that market's model.
3. Compute reliability.
4. **Eligibility:**
   - market published (validated) for this competition;
   - probability ≥ 60%;
   - reliability ≥ 62;
   - **evidence**: at least +3 pp above the same outcome's probability in a typical match (league-average expected goals 1.48 / 1.17, corners 5.4 / 4.5);
   - **not obvious**: typical-match rate ≤ 85% (e.g. "Over 0.5 goals" is excluded).
5. **Score** = 45% probability + 30% reliability + 25% evidence (lift capped at +20 pp). Example: an 85% outcome with poor data (reliability 50) is ineligible, while a 78% outcome with reliability 90 is eligible and ranks highly.
6. **De-duplicate:**
   - one outcome per market;
   - an outcome is skipped if its φ correlation with any higher-ranked pick exceeds 0.5.
   - For goal-based markets φ is exact, from the joint score matrix and goal-order weights. Goals vs corners are treated as independent (the correlation is small and monitored in backtests).
7. Keep at most 5. **If fewer than 4 qualify, show fewer** and list the reasons (withheld markets, validating markets, missing data, no match-specific evidence, duplicates).
8. Each pick stores rank, score, lift, the excluded alternatives and why, so the explanation screen can show the full reasoning.

## 6. Validation and tracking (every market independently)
- Chronological splits and **walk-forward** refits by matchweek (2016-17 → 2025-26 for results; per-market start dates depend on data depth).
- Only data timestamped before the prediction time is used (feature views take `as_of`).
- Metrics per market and per competition: Brier, log loss, ECE with reliability diagram, hit rate, n with 95% intervals, compared with the base rate (and market odds where they exist).
- **Gates:** n ≥ 1,000 out-of-sample, log loss better than the base rate (95% CI), ECE ≤ 0.03 (binary) / ≤ 0.04 (multi-outcome and handicap). Accuracy on small samples never qualifies.
- **Gates apply per outcome and line × competition**, not per market name. Real data shows the same market can pass on one line and fail on another (e.g. Asian Handicap −0.25 passes while AH 0 fails calibration).
- **Calibration layer (fixed in advance):** Platt scaling (logistic regression on logit p), fitted only on earlier out-of-sample seasons. Isotonic regression was tried first and rejected: it overfits a few hundred matches per season and made calibration worse.
- **Persistence rule:** with ~26 outcomes × several competitions tested weekly, some passes will happen by chance. An outcome is published only after passing in **two consecutive weekly backtests**, and is withdrawn after failing twice in a row.
- Live tracking: every published pick is an immutable snapshot, settled automatically. Performance → Markets shows each market over time, by competition.

### First real verdicts (2026-11-26, `BACKTEST_RESULTS.md`)
Walk-forward 2019-20 → 2025-26, Platt-calibrated, verdict on seasons 2–7 (n ≈ 2,280 PL / 1,836 BL1).

| Group | Premier League | Bundesliga |
|---|---|---|
| 1X2 | ✅ (beats base rate, 0.021 behind closing odds) | ✅ (0.025 behind closing odds) |
| Double Chance 1X / X2 | ✅ / ✅ | ✅ / ✅ |
| Double Chance 12 | ❌ no edge | ❌ no edge |
| Handicap −1 / +1 | ✅ / ✅ | ✅ / ✅ |
| Asian Handicap −0.25 / 0 | ✅ / ❌ calibration | ✅ / ❌ calibration |
| Over/Under 1.5 / 2.5 / 3.5 | ❌ / ❌ / ❌ | ❌ / ✅ / ✅ |
| BTTS | ❌ | ❌ |
| Combined with a result leg (Home or O/U, Away or U2.5) | ✅ (Away or Over ❌) | ✅ all |
| Draw or Over / Under 2.5 | ❌ / ❌ | ✅ / ✅ |
| 1st Goal (home / away) | no goal-order data | ✅ / ✅ |
| Goals in a row (5 markets) | no goal-order data | ✅ all 5 |
| 1UP / Never Down / 2UP | no goal-order data | ✅ / ✅ / ❌ calibration (still blocked until settlement rules are verified) |
| Corners, player markets | not yet backtested (corners model next; player data unavailable) | same |

**Takeaway:** markets driven by the result are publishable. Pure goal-total markets (Over/Under, BTTS) carry little signal beyond base rates in the Premier League with results-only inputs. The next modelling step is shots-on-target features from football-data.co.uk, re-tested under the same rules. The prototype's market statuses were design samples; production statuses come from these backtests (`market_competition_status`).

## 7. Extensibility
Each market is a module:
```python
class MarketModel(Protocol):
    id: str; category: str; requires: set[DataReq]
    def outcomes(self, fixture) -> list[OutcomeSpec]: ...
    def probabilities(self, ctx: MarketContext) -> dict[str, float]: ...
    def settle(self, result: MatchResult, events: list[GoalEvent], stats: MatchStats) -> dict[str, Settlement]: ...
    def base_rate(self, league_ctx) -> dict[str, float]: ...
```
Modules live in `ml/football/markets/` and register a row in `market_definitions`. New markets start as **validating** and are published automatically once their own gate passes. The selection engine and UI read the registry, so they need no change.

## 8. Prototype vs production
| Area | Prototype | Production |
|---|---|---|
| Inputs | Sample ratings, corners, players | Real provider data via the data engine |
| Goal order | Exact enumeration, time-homogeneous | Time-varying, score-state-dependent intensities, Monte Carlo |
| Backtest figures | Illustrative | Computed by `backtest_runs`, per market and competition |
| Odds / value | Not shown for these markets | Only if a licensed odds source for the market is added |
