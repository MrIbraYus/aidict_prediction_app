"""Per-market walk-forward evaluation with an out-of-fold isotonic calibration layer.

Every market outcome is evaluated on its own: probability from the market's own derivation (score matrix or
goal-order model), settlement from the real result (and real goal ORDER for path markets), base rate from
seasons before the test season, and an isotonic calibrator fitted ONLY on earlier test seasons' out-of-sample
predictions (never on the season it is applied to). Calibration method is fixed in advance: Platt scaling
(logistic regression on logit p), which is stable on a few hundred matches where isotonic regression overfits.
The publication verdict uses the calibrated probabilities, because production applies the same layer.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

import numpy as np
import pandas as pd
from scipy.special import logit
from sklearn.linear_model import LogisticRegression

from . import corners, dixon_coles, goals
from .markets import asian, btts, combined, first_goal, handicap_3way, one_x_two, order_stats, over
from .metrics import binary_brier, binary_log_loss, bootstrap_diff, ece

Prob = Callable[[np.ndarray], float]
Settle = Callable[[int, int, str | None], float | None]  # 1 / 0, or None when it cannot be settled (missing data, push)


@dataclass(frozen=True)
class OutcomeSpec:
    market: str
    outcome: str
    label: str
    prob: Prob
    settle: Settle
    needs_order: bool = False
    binary_gate: float = 0.03
    weight: Callable[[int, int], float] | None = None

    def w(self, h: int, a: int) -> float:
        if self.weight is not None:
            return self.weight(h, a)
        v = self.settle(h, a, None)
        return 0.0 if v is None else float(v)


def _path(stat: str) -> Prob:
    def f(m: np.ndarray) -> float:
        sub = m[:8, :8]
        tot = sub.sum()
        return float(sum(sub[h, a] * order_stats(h, a)[stat] for h in range(8) for a in range(8)) / tot)
    return f


def _seq_stats(seq: str) -> dict[str, bool]:
    d = maxd = mind = 0
    run = last = mhr = mar = 0
    first = seq[0] if seq else ""
    for c in seq:
        if c == "H":
            d += 1; run = run + 1 if last == 1 else 1; last = 1; mhr = max(mhr, run)
        else:
            d -= 1; run = run + 1 if last == -1 else 1; last = -1; mar = max(mar, run)
        maxd, mind = max(maxd, d), min(mind, d)
    return {"home_lead1": maxd >= 1, "home_lead2": maxd >= 2, "home_never_trail": mind >= 0, "away_lead1": mind <= -1,
            "away_never_trail": maxd <= 0, "any_run2": max(mhr, mar) >= 2, "any_run3": max(mhr, mar) >= 3, "home_run2": mhr >= 2,
            "home_run3": mhr >= 3, "away_run2": mar >= 2, "first_home": first == "H", "first_away": first == "A"}


def _w(stat: str):
    return lambda h, a: order_stats(min(h, 7), min(a, 7))[stat]


def _order(stat: str) -> Settle:
    return lambda gh, ga, seq: None if seq is None else float(_seq_stats(seq)[stat])


def _dnb_prob(m):
    h, _, a = one_x_two(m)
    return h / (h + a)


SPECS: list[OutcomeSpec] = [
    OutcomeSpec("1x2", "home", "Home win", lambda m: one_x_two(m)[0], lambda gh, ga, s: float(gh > ga), binary_gate=0.04),
    OutcomeSpec("1x2", "draw", "Draw", lambda m: one_x_two(m)[1], lambda gh, ga, s: float(gh == ga), binary_gate=0.04),
    OutcomeSpec("1x2", "away", "Away win", lambda m: one_x_two(m)[2], lambda gh, ga, s: float(gh < ga), binary_gate=0.04),
    *[OutcomeSpec("ou", f"over{l}", f"Over {l} goals", (lambda l: lambda m: over(m, l))(l), (lambda l: lambda gh, ga, s: float(gh + ga > l))(l)) for l in (1.5, 2.5, 3.5)],
    OutcomeSpec("btts", "yes", "Both teams to score", btts, lambda gh, ga, s: float(gh > 0 and ga > 0)),
    OutcomeSpec("dc", "1X", "Home or draw", lambda m: sum(one_x_two(m)[:2]), lambda gh, ga, s: float(gh >= ga)),
    OutcomeSpec("dc", "X2", "Draw or away", lambda m: sum(one_x_two(m)[1:]), lambda gh, ga, s: float(ga >= gh)),
    OutcomeSpec("dc", "12", "Home or away", lambda m: one_x_two(m)[0] + one_x_two(m)[2], lambda gh, ga, s: float(gh != ga)),
    OutcomeSpec("handicap", "home-1", "Home −1 (wins by 2+)", lambda m: handicap_3way(m, -1)[0], lambda gh, ga, s: float(gh - ga >= 2)),
    OutcomeSpec("handicap", "away+1", "Away +1 (away wins or draws)", lambda m: handicap_3way(m, -1)[2], lambda gh, ga, s: float(gh - ga < 1)),
    OutcomeSpec("asian-handicap", "home0", "Home AH 0 (draw no bet; pushes excluded)", _dnb_prob, lambda gh, ga, s: None if gh == ga else float(gh > ga)),
    OutcomeSpec("asian-handicap", "home-0.25", "Home AH −0.25 (full win)", lambda m: asian(m, -0.25)["full_win"], lambda gh, ga, s: float(gh > ga)),
    OutcomeSpec("home-or-over25", "yes", "Home or Over 2.5", lambda m: combined(m, "H", "over"), lambda gh, ga, s: float(gh > ga or gh + ga > 2.5)),
    OutcomeSpec("home-or-under25", "yes", "Home or Under 2.5", lambda m: combined(m, "H", "under"), lambda gh, ga, s: float(gh > ga or gh + ga < 2.5)),
    OutcomeSpec("draw-or-over25", "yes", "Draw or Over 2.5", lambda m: combined(m, "D", "over"), lambda gh, ga, s: float(gh == ga or gh + ga > 2.5)),
    OutcomeSpec("draw-or-under25", "yes", "Draw or Under 2.5", lambda m: combined(m, "D", "under"), lambda gh, ga, s: float(gh == ga or gh + ga < 2.5)),
    OutcomeSpec("away-or-over25", "yes", "Away or Over 2.5", lambda m: combined(m, "A", "over"), lambda gh, ga, s: float(ga > gh or gh + ga > 2.5)),
    OutcomeSpec("away-or-under25", "yes", "Away or Under 2.5", lambda m: combined(m, "A", "under"), lambda gh, ga, s: float(ga > gh or gh + ga < 2.5)),
    # Goal-order markets: settled from the REAL scoring sequence (rows without a consistent sequence are excluded).
    OutcomeSpec("first-goal", "home", "Home scores first", lambda m: first_goal(m)["home"], _order("first_home"), needs_order=True, binary_gate=0.04, weight=lambda h, a: h / (h + a) if h + a else 0.0),
    OutcomeSpec("first-goal", "away", "Away scores first", lambda m: first_goal(m)["away"], _order("first_away"), needs_order=True, binary_gate=0.04, weight=lambda h, a: a / (h + a) if h + a else 0.0),
    OutcomeSpec("any-2-row", "yes", "Any team 2+ goals in a row", _path("any_run2"), _order("any_run2"), needs_order=True, weight=_w("any_run2")),
    OutcomeSpec("any-3-row", "yes", "Any team 3+ goals in a row", _path("any_run3"), _order("any_run3"), needs_order=True, weight=_w("any_run3")),
    OutcomeSpec("home-2-row", "yes", "Home 2+ goals in a row", _path("home_run2"), _order("home_run2"), needs_order=True, weight=_w("home_run2")),
    OutcomeSpec("home-3-row", "yes", "Home 3+ goals in a row", _path("home_run3"), _order("home_run3"), needs_order=True, weight=_w("home_run3")),
    OutcomeSpec("away-2-row", "yes", "Away 2+ goals in a row", _path("away_run2"), _order("away_run2"), needs_order=True, weight=_w("away_run2")),
    OutcomeSpec("1x2-1up", "home", "Home 1UP (ever leads by 1)", _path("home_lead1"), _order("home_lead1"), needs_order=True, weight=_w("home_lead1")),
    OutcomeSpec("1x2-2up", "home", "Home 2UP (leads by 2 or wins)", lambda m: _two_up(m), lambda gh, ga, s: None if s is None else float(gh > ga or _seq_stats(s)["home_lead2"]), needs_order=True,
                weight=lambda h, a: 1.0 if h > a else order_stats(min(h, 7), min(a, 7))["home_lead2"]),
    OutcomeSpec("1x2-never-down", "home", "Home never behind", _path("home_never_trail"), _order("home_never_trail"), needs_order=True, weight=_w("home_never_trail")),
]


def _two_up(m: np.ndarray) -> float:
    sub = m[:8, :8]
    tot = sub.sum()
    return float(sum(sub[h, a] * (1.0 if h > a else order_stats(h, a)["home_lead2"]) for h in range(8) for a in range(8)) / tot)


def _bin_ll(p, y):
    p = np.clip(np.asarray(p, float), 1e-6, 1 - 1e-6)
    y = np.asarray(y, float)
    return -(y * np.log(p) + (1 - y) * np.log(1 - p))


def _gate(n, ci, ece_v, max_ece):
    return {"pass": bool(n >= 1000 and ci[2] < 0 and ece_v <= max_ece), "sample": n >= 1000, "beats_base": ci[2] < 0, "calibration": ece_v <= max_ece}


def evaluate(bt: pd.DataFrame, history: pd.DataFrame) -> list[dict]:
    """`bt`: walk-forward rows (season, kickoff, gh, ga, lam_h, lam_a, rho, goal_seq). `history`: all matches incl. training seasons."""
    mats = [goals.row_matrix(r) for r in bt.itertuples()]
    seasons = sorted(bt.season.unique())
    season_start = {s: bt[bt.season == s].kickoff.min() for s in seasons}
    hist_seq = history.get("goal_seq")
    out = []
    for spec in SPECS:
        p = np.array([spec.prob(m) for m in mats])
        seqs = bt.goal_seq if "goal_seq" in bt else pd.Series([None] * len(bt))
        y = np.array([spec.settle(int(gh), int(ga), s if isinstance(s, str) else None) for gh, ga, s in zip(bt.gh, bt.ga, seqs)], dtype=object)
        valid = np.array([v is not None for v in y])
        if valid.sum() == 0:
            out.append({"market": spec.market, "outcome": spec.outcome, "label": spec.label, "n": 0, "note": "No settlement data (goal order unavailable)"})
            continue
        yv = y[valid].astype(float)
        pv = p[valid]
        sv = bt.season.values[valid]
        # Base rate per season: frequency in matches played before that season (same settlement rule, same data availability).
        hseq = hist_seq if hist_seq is not None else pd.Series([None] * len(history))
        hy = np.array([spec.settle(int(gh), int(ga), s if isinstance(s, str) else None) for gh, ga, s in zip(history.gh, history.ga, hseq)], dtype=object)
        hvalid = np.array([v is not None for v in hy])
        base = np.empty(len(pv))
        for s in seasons:
            mask_hist = hvalid & (history.kickoff < season_start[s]).to_numpy()  # tz-aware comparison
            rate = float(hy[mask_hist].astype(float).mean()) if mask_hist.any() else float(yv.mean())
            base[sv == s] = rate
        raw, calibrated = _assess(pv, yv, sv, base, spec.binary_gate, seasons)
        out.append({"market": spec.market, "outcome": spec.outcome, "label": spec.label, "needs_order": spec.needs_order, "raw": raw, "calibrated": calibrated})
    return out


def fit_calibrators(bt: pd.DataFrame) -> dict[tuple[str, str], tuple[float, float, int]]:
    """Platt parameters (a, b, n) per outcome fitted on every walk-forward out-of-sample prediction; p' = σ(a·logit p + b)."""
    mats = [goals.row_matrix(r) for r in bt.itertuples()]
    seqs = bt.goal_seq if "goal_seq" in bt else pd.Series([None] * len(bt))
    out = {}
    for spec in SPECS:
        p = np.array([spec.prob(m) for m in mats])
        y = [spec.settle(int(gh), int(ga), s if isinstance(s, str) else None) for gh, ga, s in zip(bt.gh, bt.ga, seqs)]
        mask = np.array([v is not None for v in y])
        if mask.sum() < 300:
            continue
        yv = np.array([v for v in y if v is not None], float)
        if not 0 < yv.mean() < 1:
            continue
        lp = logit(np.clip(p[mask], 1e-4, 1 - 1e-4)).reshape(-1, 1)
        lr = LogisticRegression(C=10.0).fit(lp, yv)
        out[(spec.market, spec.outcome)] = (float(lr.coef_[0][0]), float(lr.intercept_[0]), int(mask.sum()))
    return out


def apply_calibration(p: float, params: tuple[float, float, int] | None) -> float:
    if not params:
        return p
    a, b, _ = params
    z = a * float(logit(np.clip(p, 1e-4, 1 - 1e-4))) + b
    return float(1 / (1 + np.exp(-z)))


def _assess(pv: np.ndarray, yv: np.ndarray, sv: np.ndarray, base: np.ndarray, max_ece: float, seasons: list) -> tuple[dict, dict | None]:
    """Raw metrics, out-of-fold Platt calibration and the publication gate for one binary outcome."""
    # Out-of-fold Platt calibration: season k is calibrated with a model fitted on test seasons < k only.
    cal = np.full(len(pv), np.nan)
    lp = logit(np.clip(pv, 1e-4, 1 - 1e-4)).reshape(-1, 1)
    for i, s in enumerate(seasons):
        prior = np.isin(sv, seasons[:i])
        if prior.sum() >= 300 and 0 < yv[prior].mean() < 1:
            lr = LogisticRegression(C=10.0).fit(lp[prior], yv[prior])
            cal[sv == s] = lr.predict_proba(lp[sv == s])[:, 1]
    raw_ci = bootstrap_diff(_bin_ll(pv, yv), _bin_ll(base, yv))
    raw = {"n": len(yv), "mean_p": float(pv.mean()), "observed": float(yv.mean()), "brier": binary_brier(pv, yv), "log_loss": binary_log_loss(np.clip(pv, 1e-6, 1 - 1e-6), yv),
           "base_log_loss": float(_bin_ll(base, yv).mean()), "ece": ece(pv, yv), "ci": raw_ci, "gate": _gate(len(yv), raw_ci, ece(pv, yv), max_ece)}
    cm = ~np.isnan(cal)
    calibrated = None
    if cm.sum() >= 200:
        c_ci = bootstrap_diff(_bin_ll(cal[cm], yv[cm]), _bin_ll(base[cm], yv[cm]))
        c_ece = ece(cal[cm], yv[cm])
        calibrated = {"n": int(cm.sum()), "log_loss": binary_log_loss(cal[cm], yv[cm]), "raw_log_loss_same_rows": binary_log_loss(np.clip(pv[cm], 1e-6, 1 - 1e-6), yv[cm]),
                      "base_log_loss": float(_bin_ll(base[cm], yv[cm]).mean()), "ece": c_ece, "raw_ece_same_rows": ece(pv[cm], yv[cm]), "ci": c_ci,
                      "gate": _gate(int(cm.sum()), c_ci, c_ece, max_ece)}
    return raw, calibrated


def evaluate_corners(bt: pd.DataFrame, history: pd.DataFrame) -> list[dict]:
    """Corner outcomes, judged exactly like score-matrix outcomes (same base rate rule, calibration and gate)."""
    if "lc_h" not in bt:
        return [{"market": s.market, "outcome": s.outcome, "label": s.label, "n": 0, "note": "No corner data"} for s in corners.SPECS]
    rows = bt[bt.lc_h.notna() & bt.cor_k.notna() & bt.cor_h.notna() & bt.cor_a.notna()].reset_index(drop=True)
    probs = [corners.probabilities(r.lc_h, r.lc_a, r.cor_k) for r in rows.itertuples()]
    seasons = sorted(rows.season.unique())
    hist = history[history.cor_h.notna() & history.cor_a.notna()] if "cor_h" in history else history.iloc[:0]
    out = []
    for spec in corners.SPECS:
        if len(rows) < 300:
            out.append({"market": spec.market, "outcome": spec.outcome, "label": spec.label, "n": len(rows), "note": "Too few matches with corner data"})
            continue
        pv = np.array([pr[(spec.market, spec.outcome)] for pr in probs])
        yv = np.array([spec.settle(h, a) for h, a in zip(rows.cor_h, rows.cor_a)], float)
        sv = rows.season.values
        hy = np.array([spec.settle(h, a) for h, a in zip(hist.cor_h, hist.cor_a)], float)
        base = np.empty(len(pv))
        for s_ in seasons:
            start = rows[rows.season == s_].kickoff.min()
            m = (hist.kickoff < start).to_numpy()
            base[sv == s_] = float(hy[m].mean()) if m.any() else float(yv.mean())
        raw, calibrated = _assess(pv, yv, sv, base, spec.binary_gate, seasons)
        out.append({"market": spec.market, "outcome": spec.outcome, "label": spec.label, "needs_order": False, "raw": raw, "calibrated": calibrated})
    return out


def fit_corner_calibrators(bt: pd.DataFrame) -> dict[tuple[str, str], tuple[float, float, int]]:
    if "lc_h" not in bt:
        return {}
    rows = bt[bt.lc_h.notna() & bt.cor_k.notna() & bt.cor_h.notna() & bt.cor_a.notna()]
    probs = [corners.probabilities(r.lc_h, r.lc_a, r.cor_k) for r in rows.itertuples()]
    out = {}
    for spec in corners.SPECS:
        yv = np.array([spec.settle(h, a) for h, a in zip(rows.cor_h, rows.cor_a)], float)
        if len(yv) < 300 or not 0 < yv.mean() < 1:
            continue
        lp = logit(np.clip(np.array([pr[(spec.market, spec.outcome)] for pr in probs]), 1e-4, 1 - 1e-4)).reshape(-1, 1)
        lr = LogisticRegression(C=10.0).fit(lp, yv)
        out[(spec.market, spec.outcome)] = (float(lr.coef_[0][0]), float(lr.intercept_[0]), len(yv))
    return out
