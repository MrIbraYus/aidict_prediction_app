# AIDICT — Walk-forward Backtest Results (real data)

**Generated:** 2026-11-26 20:32 UTC by `services/scripts/run_backtest.py`  
**Data:** OpenFootball results (CC0), seasons 2016-17 → 2025-26. Closing odds: football-data.co.uk (private use).  
**Method:** every matchweek from 2019-20 is predicted using only earlier matches (3-season window, time decay ξ = 0.0019/day), then the Dixon–Coles model is refitted. Elo's ordered logit and the base rates are refitted each season on prior seasons only.

> These are genuine out-of-sample results — not sample data. Lower Brier / log loss / RPS is better. ECE = calibration error.

## Premier League (PL)

Out-of-sample matches: **2,660** · seasons 2019-20, 2020-21, 2021-22, 2022-23, 2023-24, 2024-25, 2025-26 · odds matched for 3,734 of 3,800 matches

### Full-time result (1X2)

| Model | n | Brier | Log loss | RPS | ECE | Top-pick hit rate |
|---|---:|---:|---:|---:|---:|---:|
| Base rate | 2,660 | 0.649 | 1.071 | 0.234 | 0.015 | 43.4% |
| Elo (ordered logit) | 2,660 | 0.587 | 0.987 | 0.204 | 0.020 | 52.8% |
| Dixon–Coles | 2,660 | 0.585 | 0.984 | 0.203 | 0.012 | 52.8% |
| Closing odds (margin removed) | 2,594 | 0.572 | 0.964 | 0.197 | 0.012 | 54.6% |
| Dixon–Coles (same matches as odds) | 2,594 | 0.586 | 0.985 | 0.203 | 0.012 | 52.8% |

Dixon–Coles vs base rate, log-loss difference per match: **-0.0866** (95% CI -0.1020 to -0.0696) — better than the base rate.
Dixon–Coles vs closing odds: **+0.0209** (95% CI +0.0136 to +0.0279) — the market is better.

### Over/Under 2.5 goals

| Model | Brier | Log loss | ECE |
|---|---:|---:|---:|
| Base rate | 0.248 | 0.689 | 0.020 |
| Dixon–Coles | 0.245 | 0.683 | 0.041 |
| Closing odds (margin removed) | 0.240 | 0.673 | 0.009 |

### Both teams to score

| Model | Brier | Log loss | ECE |
|---|---:|---:|---:|
| Base rate | 0.249 | 0.692 | 0.030 |
| Dixon–Coles | 0.249 | 0.691 | 0.032 |

### Publication gates (raw model, before the calibration layer)

| Market | n ≥ 1,000 | Beats base rate (95% CI) | Calibration | Verdict |
|---|:---:|:---:|:---:|---|
| 1X2 | ✅ | ✅ | ✅ ECE 0.012 (≤ 0.04) | **Publishable** |
| Over/Under 2.5 | ✅ | ❌ | ❌ ECE 0.041 (≤ 0.03) | Not published — validating |
| Both teams to score | ✅ | ❌ | ❌ ECE 0.032 (≤ 0.03) | Not published — validating |

Over/Under 2.5 vs base rate, log-loss difference: -0.0055 (95% CI -0.0135 to +0.0020).

BTTS vs base rate, log-loss difference: -0.0010 (95% CI -0.0069 to +0.0049).

### Market-by-market gates (each outcome evaluated on its own)

Goal-order data: 0 matches with a real scoring sequence (OpenLigaDB). Production verdict = Platt-calibrated probabilities (fitted only on earlier test seasons), evaluated on seasons 2–7; raw model shown for reference.

| Market · outcome | n (cal.) | Observed | Log loss cal. / raw / base | ECE raw → cal. (same matches) | Raw gate (all seasons) | **Verdict** |
|---|---:|---:|---|---|:---:|---|
| Over 1.5 goals | 2,280 | 78.9% | 0.517 / 0.519 / 0.518 | 0.040 → 0.023 | ❌ | Validating — no edge over base rate |
| Over 2.5 goals | 2,280 | 55.0% | 0.684 / 0.686 / 0.688 | 0.047 → 0.031 | ❌ | Validating — no edge over base rate, calibration |
| Over 3.5 goals | 2,280 | 32.3% | 0.632 / 0.633 / 0.635 | 0.039 → 0.031 | ❌ | Validating — no edge over base rate, calibration |
| Both teams to score | 2,280 | 53.8% | 0.688 / 0.690 / 0.691 | 0.036 → 0.023 | ❌ | Validating — no edge over base rate |
| Home or draw | 2,280 | 67.1% | 0.577 / 0.575 / 0.638 | 0.016 → 0.015 | ✅ | **Publishable** |
| Draw or away | 2,280 | 56.6% | 0.613 / 0.611 / 0.686 | 0.016 → 0.018 | ✅ | **Publishable** |
| Home or away | 2,280 | 76.4% | 0.544 / 0.542 / 0.546 | 0.011 → 0.016 | ✅ | Validating — no edge over base rate |
| Home −1 (wins by 2+) | 2,280 | 23.5% | 0.487 / 0.485 / 0.545 | 0.017 → 0.015 | ✅ | **Publishable** |
| Away +1 (away wins or draws) | 2,280 | 56.6% | 0.613 / 0.611 / 0.686 | 0.016 → 0.018 | ✅ | **Publishable** |
| Home AH 0 (draw no bet; pushes excluded) | 1,446 | 56.9% | 0.575 / 0.571 / 0.681 | 0.026 → 0.035 | ✅ | Validating — calibration |
| Home AH −0.25 (full win) | 2,280 | 43.4% | 0.613 / 0.611 / 0.686 | 0.016 → 0.018 | ✅ | **Publishable** |
| Home or Over 2.5 | 2,280 | 70.3% | 0.594 / 0.593 / 0.607 | 0.032 → 0.012 | ✅ | **Publishable** |
| Home or Under 2.5 | 2,280 | 73.1% | 0.559 / 0.559 / 0.589 | 0.023 → 0.014 | ✅ | **Publishable** |
| Draw or Over 2.5 | 2,280 | 71.9% | 0.591 / 0.593 / 0.593 | 0.020 → 0.015 | ❌ | Validating — no edge over base rate |
| Draw or Under 2.5 | 2,280 | 51.8% | 0.689 / 0.690 / 0.693 | 0.044 → 0.026 | ❌ | Validating — no edge over base rate |
| Away or Over 2.5 | 2,280 | 67.8% | 0.621 / 0.621 / 0.627 | 0.024 → 0.022 | ✅ | Validating — no edge over base rate |
| Away or Under 2.5 | 2,280 | 65.2% | 0.607 / 0.606 / 0.649 | 0.022 → 0.021 | ✅ | **Publishable** |
| Home scores first | 0 | — | — | — | — | — | No settlement data (goal order unavailable) |
| Away scores first | 0 | — | — | — | — | — | No settlement data (goal order unavailable) |
| Any team 2+ goals in a row | 0 | — | — | — | — | — | No settlement data (goal order unavailable) |
| Any team 3+ goals in a row | 0 | — | — | — | — | — | No settlement data (goal order unavailable) |
| Home 2+ goals in a row | 0 | — | — | — | — | — | No settlement data (goal order unavailable) |
| Home 3+ goals in a row | 0 | — | — | — | — | — | No settlement data (goal order unavailable) |
| Away 2+ goals in a row | 0 | — | — | — | — | — | No settlement data (goal order unavailable) |
| Home 1UP (ever leads by 1) | 0 | — | — | — | — | — | No settlement data (goal order unavailable) |
| Home 2UP (leads by 2 or wins) | 0 | — | — | — | — | — | No settlement data (goal order unavailable) |
| Home never behind | 0 | — | — | — | — | — | No settlement data (goal order unavailable) |

### Calibration — home win (Dixon–Coles)

| Predicted | Observed | n | 95% interval |
|---:|---:|---:|---|
| 7.5% | 11.5% | 61 | 3.5–19.5% |
| 15.6% | 16.7% | 240 | 12.0–21.4% |
| 25.5% | 27.0% | 426 | 22.8–31.2% |
| 35.1% | 35.9% | 485 | 31.6–40.1% |
| 44.9% | 42.1% | 513 | 37.8–46.4% |
| 54.6% | 55.4% | 370 | 50.3–60.5% |
| 64.8% | 65.3% | 320 | 60.1–70.5% |
| 74.8% | 73.1% | 156 | 66.1–80.0% |
| 83.7% | 84.0% | 75 | 75.7–92.3% |
| 92.2% | 85.7% | 14 | 67.4–100.0% |

### By season (1X2 log loss)

| Season | n | Dixon–Coles | Base rate |
|---|---:|---:|---:|
| 2019-20 | 380 | 0.979 | 1.066 |
| 2020-21 | 380 | 1.018 | 1.090 |
| 2021-22 | 380 | 0.954 | 1.070 |
| 2022-23 | 380 | 1.004 | 1.051 |
| 2023-24 | 380 | 0.926 | 1.053 |
| 2024-25 | 380 | 0.982 | 1.082 |
| 2025-26 | 380 | 1.027 | 1.085 |

Runtime: 52s · team names without a cross-provider match (alias review): none

## Bundesliga (BL1)

Out-of-sample matches: **2,142** · seasons 2019-20, 2020-21, 2021-22, 2022-23, 2023-24, 2024-25, 2025-26 · odds matched for 3,059 of 3,060 matches

### Full-time result (1X2)

| Model | n | Brier | Log loss | RPS | ECE | Top-pick hit rate |
|---|---:|---:|---:|---:|---:|---:|
| Base rate | 2,142 | 0.651 | 1.075 | 0.232 | 0.012 | 43.2% |
| Elo (ordered logit) | 2,142 | 0.595 | 0.997 | 0.205 | 0.020 | 51.3% |
| Dixon–Coles | 2,142 | 0.596 | 0.998 | 0.205 | 0.027 | 51.6% |
| Closing odds (margin removed) | 2,142 | 0.579 | 0.974 | 0.198 | 0.020 | 53.2% |
| Dixon–Coles (same matches as odds) | 2,142 | 0.596 | 0.998 | 0.205 | 0.027 | 51.6% |

Dixon–Coles vs base rate, log-loss difference per match: **-0.0765** (95% CI -0.0947 to -0.0589) — better than the base rate.
Dixon–Coles vs closing odds: **+0.0246** (95% CI +0.0165 to +0.0324) — the market is better.

### Over/Under 2.5 goals

| Model | Brier | Log loss | ECE |
|---|---:|---:|---:|
| Base rate | 0.238 | 0.670 | 0.027 |
| Dixon–Coles | 0.233 | 0.658 | 0.036 |
| Closing odds (margin removed) | 0.227 | 0.645 | 0.021 |

### Both teams to score

| Model | Brier | Log loss | ECE |
|---|---:|---:|---:|
| Base rate | 0.241 | 0.675 | 0.021 |
| Dixon–Coles | 0.239 | 0.671 | 0.025 |

### Publication gates (raw model, before the calibration layer)

| Market | n ≥ 1,000 | Beats base rate (95% CI) | Calibration | Verdict |
|---|:---:|:---:|:---:|---|
| 1X2 | ✅ | ✅ | ✅ ECE 0.027 (≤ 0.04) | **Publishable** |
| Over/Under 2.5 | ✅ | ✅ | ❌ ECE 0.036 (≤ 0.03) | Not published — validating |
| Both teams to score | ✅ | ❌ | ✅ ECE 0.025 (≤ 0.03) | Not published — validating |

Over/Under 2.5 vs base rate, log-loss difference: -0.0114 (95% CI -0.0210 to -0.0021).

BTTS vs base rate, log-loss difference: -0.0040 (95% CI -0.0108 to +0.0025).

### Market-by-market gates (each outcome evaluated on its own)

Goal-order data: 2,951 matches with a real scoring sequence (OpenLigaDB). Production verdict = Platt-calibrated probabilities (fitted only on earlier test seasons), evaluated on seasons 2–7; raw model shown for reference.

| Market · outcome | n (cal.) | Observed | Log loss cal. / raw / base | ECE raw → cal. (same matches) | Raw gate (all seasons) | **Verdict** |
|---|---:|---:|---|---|:---:|---|
| Over 1.5 goals | 1,836 | 83.6% | 0.448 / 0.449 / 0.452 | 0.021 → 0.013 | ❌ | Validating — no edge over base rate |
| Over 2.5 goals | 1,836 | 61.3% | 0.659 / 0.659 / 0.671 | 0.032 → 0.014 | ❌ | **Publishable** |
| Over 3.5 goals | 1,836 | 40.3% | 0.658 / 0.660 / 0.676 | 0.033 → 0.011 | ❌ | **Publishable** |
| Both teams to score | 1,836 | 59.8% | 0.672 / 0.667 / 0.674 | 0.023 → 0.032 | ❌ | Validating — no edge over base rate, calibration |
| Home or draw | 1,836 | 68.0% | 0.566 / 0.561 / 0.620 | 0.031 → 0.030 | ✅ | **Publishable** |
| Draw or away | 1,836 | 56.8% | 0.626 / 0.626 / 0.686 | 0.037 → 0.029 | ❌ | **Publishable** |
| Home or away | 1,836 | 75.3% | 0.563 / 0.563 / 0.564 | 0.020 → 0.021 | ❌ | Validating — no edge over base rate |
| Home −1 (wins by 2+) | 1,836 | 25.8% | 0.518 / 0.517 / 0.574 | 0.021 → 0.016 | ✅ | **Publishable** |
| Away +1 (away wins or draws) | 1,836 | 56.8% | 0.626 / 0.626 / 0.686 | 0.037 → 0.029 | ❌ | **Publishable** |
| Home AH 0 (draw no bet; pushes excluded) | 1,149 | 57.4% | 0.581 / 0.580 / 0.679 | 0.041 → 0.031 | ❌ | Validating — calibration |
| Home AH −0.25 (full win) | 1,836 | 43.2% | 0.626 / 0.626 / 0.686 | 0.037 → 0.029 | ❌ | **Publishable** |
| Home or Over 2.5 | 1,836 | 73.3% | 0.572 / 0.572 / 0.585 | 0.018 → 0.009 | ✅ | **Publishable** |
| Home or Under 2.5 | 1,836 | 69.9% | 0.566 / 0.563 / 0.604 | 0.018 → 0.018 | ✅ | **Publishable** |
| Draw or Over 2.5 | 1,836 | 78.2% | 0.523 / 0.522 / 0.528 | 0.015 → 0.006 | ❌ | **Publishable** |
| Draw or Under 2.5 | 1,836 | 46.6% | 0.683 / 0.683 / 0.692 | 0.032 → 0.022 | ❌ | **Publishable** |
| Away or Over 2.5 | 1,836 | 71.0% | 0.599 / 0.599 / 0.608 | 0.037 → 0.026 | ❌ | **Publishable** |
| Away or Under 2.5 | 1,836 | 61.0% | 0.636 / 0.637 / 0.671 | 0.033 → 0.027 | ✅ | **Publishable** |
| Home scores first | 1,735 | 51.9% | 0.656 / 0.655 / 0.694 | 0.030 → 0.030 | ✅ | **Publishable** |
| Away scores first | 1,735 | 43.1% | 0.645 / 0.644 / 0.684 | 0.029 → 0.033 | ✅ | **Publishable** |
| Any team 2+ goals in a row | 1,735 | 64.8% | 0.642 / 0.643 / 0.651 | 0.027 → 0.012 | ✅ | **Publishable** |
| Any team 3+ goals in a row | 1,735 | 29.5% | 0.583 / 0.583 / 0.602 | 0.012 → 0.020 | ✅ | **Publishable** |
| Home 2+ goals in a row | 1,735 | 41.4% | 0.636 / 0.635 / 0.681 | 0.027 → 0.029 | ✅ | **Publishable** |
| Home 3+ goals in a row | 1,735 | 17.8% | 0.430 / 0.429 / 0.473 | 0.021 → 0.020 | ✅ | **Publishable** |
| Away 2+ goals in a row | 1,735 | 31.6% | 0.586 / 0.585 / 0.621 | 0.024 → 0.011 | ✅ | **Publishable** |
| Home 1UP (ever leads by 1) | 1,735 | 60.9% | 0.618 / 0.615 / 0.666 | 0.030 → 0.019 | ✅ | **Publishable** |
| Home 2UP (leads by 2 or wins) | 1,735 | 45.5% | 0.629 / 0.628 / 0.690 | 0.034 → 0.034 | ❌ | Validating — calibration |
| Home never behind | 1,735 | 49.2% | 0.645 / 0.643 / 0.696 | 0.026 → 0.023 | ✅ | **Publishable** |

### Calibration — home win (Dixon–Coles)

| Predicted | Observed | n | 95% interval |
|---:|---:|---:|---|
| 7.6% | 10.9% | 46 | 1.9–19.9% |
| 15.9% | 20.6% | 170 | 14.5–26.7% |
| 25.2% | 28.1% | 313 | 23.1–33.1% |
| 34.8% | 33.7% | 401 | 29.0–38.3% |
| 45.1% | 39.3% | 425 | 34.7–43.9% |
| 54.8% | 53.0% | 317 | 47.5–58.5% |
| 64.6% | 67.6% | 241 | 61.7–73.5% |
| 74.5% | 70.1% | 144 | 62.7–77.6% |
| 84.2% | 75.0% | 72 | 65.0–85.0% |
| 92.4% | 76.9% | 13 | 54.0–99.8% |

### By season (1X2 log loss)

| Season | n | Dixon–Coles | Base rate |
|---|---:|---:|---:|
| 2019-20 | 306 | 0.998 | 1.088 |
| 2020-21 | 306 | 1.007 | 1.081 |
| 2021-22 | 306 | 1.000 | 1.058 |
| 2022-23 | 306 | 1.004 | 1.057 |
| 2023-24 | 306 | 0.978 | 1.075 |
| 2024-25 | 306 | 1.024 | 1.093 |
| 2025-26 | 306 | 0.976 | 1.071 |

Runtime: 62s · team names without a cross-provider match (alias review): none

## Reading these results

- Beating the base rate shows the model has real information. Matching or approaching closing odds is the hardest benchmark in football; the gap is reported, not hidden.
- Markets are only published when they pass their gate (n ≥ 1,000 out-of-sample, log loss better than base rate with the 95% CI excluding zero, ECE ≤ 0.04 multi-outcome / ≤ 0.03 binary).
- The 1X2/O-U/BTTS gate tables use the RAW model. The market-by-market verdicts use Platt-calibrated probabilities (method fixed in advance, fitted only on earlier seasons) because production applies the same layer.
- Re-run after any model change; results are versioned with the model in `model_evaluations`.
