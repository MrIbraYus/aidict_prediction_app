"""Market research: can shots-on-target ratings, league-pooled calibration and a corners model make more markets pass
the publication gates? Everything is walk-forward and out-of-sample; choices are made on tuning seasons only.

Usage:
  python scripts/research_markets.py build  [--leagues PL BL1 ...]   # slow: walk-forward backtests → .cache/bt-*.csv
  python scripts/research_markets.py report                           # fast: comparisons → documentation/MARKET_RESEARCH.md

Pre-registered protocol (fixed before looking at test results):
  * Tuning seasons 2019-20 and 2020-21 choose ONE global shots blend weight w ∈ {1, .75, .5, .25, 0} by mean log loss
    over every score-matrix outcome, pooled over all leagues. w = 1 is the current goals-only model.
  * Test seasons 2021-22 … 2025-26 judge it. Calibration is out-of-fold: season s is calibrated on seasons < s only.
  * Gate = n ≥ 1,000, bootstrap 95% CI of (calibrated − base-rate) log loss entirely below 0, ECE ≤ 0.03 (0.04 for
    three-way 1X2-type outcomes) — identical to production.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.special import logit
from scipy.stats import nbinom
from sklearn.linear_model import LogisticRegression

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT / "services" / "data-engine"), str(ROOT / "services" / "prediction-engine")]

from aidict_engine import dixon_coles  # noqa: E402
from aidict_engine.backtest import Config, run  # noqa: E402
from aidict_engine.history import BACKTEST_LEAGUES, load, seasons_between  # noqa: E402
from aidict_engine.market_eval import SPECS  # noqa: E402
from aidict_engine.metrics import bootstrap_diff, ece  # noqa: E402

CACHE = ROOT / "services" / ".cache"
TUNING = ["2019-20", "2020-21"]
WEIGHTS = [1.0, 0.75, 0.5, 0.25, 0.0]
MATRIX_SPECS = [s for s in SPECS if not s.needs_order]


# ───────────── build ─────────────
def build(leagues: list[str]) -> None:
    CACHE.mkdir(exist_ok=True)
    for code in leagues:
        print(f"{code}: loading …", flush=True)
        df, stats = load(code, seasons_between("2016-17", "2025-26"), log=lambda *_: None)
        print(f"  {len(df)} matches, {stats['with_match_stats']} with stats; walk-forward …", flush=True)
        bt = run(df, Config(test_from="2019-20"))
        bt.to_csv(CACHE / f"bt-{code}.csv", index=False)
        df[["season", "kickoff", "home", "away", "gh", "ga", "cor_h", "cor_a"]].to_csv(CACHE / f"hist-{code}.csv", index=False)
        print(f"  saved {len(bt)} out-of-sample rows", flush=True)


# ───────────── helpers ─────────────
def _ll(p, y):
    p = np.clip(np.asarray(p, float), 1e-6, 1 - 1e-6)
    return -(y * np.log(p) + (1 - y) * np.log(1 - p))


def _matrices(bt: pd.DataFrame, w: float) -> list[np.ndarray]:
    out = []
    for r in bt.itertuples():
        lh, la = r.lam_h, r.lam_a
        if w < 1 and not np.isnan(getattr(r, "lam_sh", np.nan)):
            lh = float(np.exp(w * np.log(r.lam_h) + (1 - w) * np.log(r.lam_sh)))
            la = float(np.exp(w * np.log(r.lam_a) + (1 - w) * np.log(r.lam_sa)))
        out.append(dixon_coles.score_matrix(lh, la, r.rho))
    return out


def _base(hist: pd.DataFrame, bt: pd.DataFrame, settle) -> np.ndarray:
    """Per-season base rate: frequency in matches played before that season (same settlement rule)."""
    hy = np.array([settle(r) for r in hist.itertuples()], dtype=object)
    ok = np.array([v is not None for v in hy])
    out = np.empty(len(bt))
    for s in bt.season.unique():
        start = bt[bt.season == s].kickoff.min()
        m = ok & (hist.kickoff < start).to_numpy()
        out[(bt.season == s).to_numpy()] = float(hy[m].astype(float).mean()) if m.any() else np.nan
    return out


def _oof_platt(p, y, seasons, groups=None) -> np.ndarray:
    """Out-of-fold Platt scaling: rows of season s use a calibrator fitted on seasons < s (pooled over `groups` if given)."""
    cal = np.full(len(p), np.nan)
    lp = logit(np.clip(p, 1e-4, 1 - 1e-4)).reshape(-1, 1)
    for s in sorted(set(seasons)):
        prior = seasons < s
        if prior.sum() >= 300 and 0 < y[prior].mean() < 1:
            cal[seasons == s] = LogisticRegression(C=10.0).fit(lp[prior], y[prior]).predict_proba(lp[seasons == s])[:, 1]
    return cal


def _gate(p, y, base, max_ece):
    ci = bootstrap_diff(_ll(p, y), _ll(base, y))
    e = ece(p, y)
    return {"n": len(y), "ll": float(_ll(p, y).mean()), "base": float(_ll(base, y).mean()), "ci_hi": float(ci[2]), "ece": e,
            "pass": bool(len(y) >= 1000 and ci[2] < 0 and e <= max_ece)}


# ───────────── corners ─────────────
CORNER_LINES = [8.5, 9.5, 10.5, 11.5]


def _corner_probs(lh: float, la: float, k: float) -> dict:
    x = np.arange(0, 31)
    ph = nbinom.pmf(x, k, k / (k + lh))
    pa = nbinom.pmf(x, k, k / (k + la))
    joint = np.outer(ph, pa)
    tot = np.add.outer(x, x)
    out = {f"over{l}": float(joint[tot > l].sum()) for l in CORNER_LINES}
    out["home"] = float(np.tril(joint, -1).sum())
    out["draw"] = float(np.trace(joint))
    out["away"] = float(np.triu(joint, 1).sum())
    return out


CORNER_SPECS = [(f"over{l}", f"Corners over {l}", lambda h, a, l=l: float(h + a > l), 0.03) for l in CORNER_LINES] + [
    ("home", "Home more corners", lambda h, a: float(h > a), 0.04), ("draw", "Equal corners", lambda h, a: float(h == a), 0.04),
    ("away", "Away more corners", lambda h, a: float(h < a), 0.04)]


# ───────────── report ─────────────
def report() -> None:
    bts, hists = {}, {}
    for code in BACKTEST_LEAGUES:
        f = CACHE / f"bt-{code}.csv"
        if f.exists():
            bts[code] = pd.read_csv(f, parse_dates=["kickoff"])
            hists[code] = pd.read_csv(CACHE / f"hist-{code}.csv", parse_dates=["kickoff"])
    print("leagues:", list(bts))
    lines = ["# Market research: shots model, pooled calibration, corners", "",
             "Generated by `services/scripts/research_markets.py`. Walk-forward, out-of-sample; protocol in the script header.", ""]

    # 1 ── choose the blend weight on tuning seasons only
    probs: dict = {}  # (code, w) -> {spec_key: p array}
    ys: dict = {}
    for code, bt in bts.items():
        ys[code] = {(s.market, s.outcome): np.array([s.settle(int(h), int(a), None) for h, a in zip(bt.gh, bt.ga)], dtype=object) for s in MATRIX_SPECS}
        for w in WEIGHTS:
            mats = _matrices(bt, w)
            probs[(code, w)] = {(s.market, s.outcome): np.array([s.prob(m) for m in mats]) for s in MATRIX_SPECS}
        print(f"  {code}: matrices done", flush=True)
    tune_ll = {}
    for w in WEIGHTS:
        tot = cnt = 0.0
        for code, bt in bts.items():
            tm = bt.season.isin(TUNING).to_numpy()
            for key, y in ys[code].items():
                ok = tm & np.array([v is not None for v in y])
                tot += _ll(probs[(code, w)][key][ok], y[ok].astype(float)).sum()
                cnt += ok.sum()
        tune_ll[w] = tot / cnt
    w_best = min(tune_ll, key=tune_ll.get)
    lines += ["## 1. Shots blend weight (chosen on 2019-20 and 2020-21 only)", "", "| w (1 = goals only, 0 = shots only) | mean log loss, all outcomes, all leagues |", "|---|---|"]
    lines += [f"| {w:.2f}{' **← chosen**' if w == w_best else ''} | {v:.5f} |" for w, v in tune_ll.items()]
    lines += [""]

    # 2 ── test seasons: goals-only vs blend, per-league vs pooled calibration
    configs = {"current (goals only, per-league calibration)": (1.0, False), "shots blend, per-league calibration": (w_best, False),
               "goals only, pooled calibration": (1.0, True), f"shots blend (w={w_best}), pooled calibration": (w_best, True)}
    results = {c: {} for c in configs}
    base_cache: dict = {}
    for cname, (w, pooled) in configs.items():
        for spec in MATRIX_SPECS:
            key = (spec.market, spec.outcome)
            # pooled calibrators need every league's rows together
            P, Y, S, G = [], [], [], []
            for code, bt in bts.items():
                y = ys[code][key]
                ok = np.array([v is not None for v in y])
                P.append(probs[(code, w)][key][ok]); Y.append(y[ok].astype(float)); S.append(bt.season.to_numpy()[ok]); G.append(np.array([code] * ok.sum()))
            P, Y, S, G = map(np.concatenate, (P, Y, S, G))
            if pooled:
                cal = _oof_platt(P, Y, S)
            else:
                cal = np.full(len(P), np.nan)
                for code in bts:
                    m = G == code
                    cal[m] = _oof_platt(P[m], Y[m], S[m])
            for code, bt in bts.items():
                m = (G == code) & (S >= "2021-22") & ~np.isnan(cal)
                y = ys[code][key]
                ok = np.array([v is not None for v in y])
                if (code, key) not in base_cache:
                    base_cache[(code, key)] = _base(hists[code], bt, lambda r, sp=spec: sp.settle(int(r.gh), int(r.ga), None))
                base_all = base_cache[(code, key)][ok]
                bm = m[G == code]
                results[cname][(code, key)] = _gate(cal[m], Y[m], base_all[bm], spec.binary_gate)
    lines += ["## 2. Score-matrix markets on test seasons 2021-22 to 2025-26", "",
              "Each cell: number of leagues (of 8) where the outcome passes the gate.", "",
              "| Outcome | " + " | ".join(configs) + " |", "|---|" + "---|" * len(configs)]
    for spec in MATRIX_SPECS:
        key = (spec.market, spec.outcome)
        cells = [str(sum(results[c][(code, key)]["pass"] for code in bts)) for c in configs]
        lines.append(f"| {spec.label} | " + " | ".join(cells) + " |")
    lines.append("| **Total league × outcome passes** | " + " | ".join(str(sum(v["pass"] for v in results[c].values())) for c in configs) + " |")
    lines += [""]

    # 3 ── bookmaker benchmark for Over 2.5 on the same test rows
    lines += ["## 3. Over 2.5 goals vs closing odds (same matches)", "", "| League | n | base | goals only | shots blend | closing odds | share of bookmaker edge: goals only → blend |", "|---|---|---|---|---|---|---|"]
    for code, bt in bts.items():
        m = (bt.season >= "2021-22").to_numpy() & bt.imp_over25.notna().to_numpy()
        if m.sum() < 200:
            continue
        y = ((bt.gh + bt.ga) > 2.5).astype(float).to_numpy()[m]
        base = _base(hists[code], bt, lambda r: float(r.gh + r.ga > 2.5))[m]
        p1 = probs[(code, 1.0)][("ou", "over2.5")][m]
        pb = probs[(code, w_best)][("ou", "over2.5")][m]
        mk = bt.imp_over25.to_numpy()[m]
        lb, l1, lbl, lm = (_ll(x, y).mean() for x in (base, p1, pb, mk))
        lines.append(f"| {code} | {m.sum()} | {lb:.4f} | {l1:.4f} | {lbl:.4f} | {lm:.4f} | {(lb - l1) / (lb - lm) * 100:.0f}% → {(lb - lbl) / (lb - lm) * 100:.0f}% |")
    lines += [""]

    # 4 ── corners
    lines += ["## 4. Corners (negative binomial on team corner ratings)", "", "| League | " + " | ".join(lbl for _, lbl, _, _ in CORNER_SPECS) + " |", "|---|" + "---|" * len(CORNER_SPECS)]
    corner_pass = 0
    for code, bt in bts.items():
        if "lc_h" not in bt or bt.lc_h.isna().all():
            continue
        rows = bt[bt.lc_h.notna() & bt.cor_h.notna() & bt.cor_k.notna()].reset_index(drop=True)
        cp = [_corner_probs(r.lc_h, r.lc_a, r.cor_k) for r in rows.itertuples()]
        cells = []
        for key, label, settle, gate in CORNER_SPECS:
            p = np.array([c[key] for c in cp])
            y = np.array([settle(h, a) for h, a in zip(rows.cor_h, rows.cor_a)], float)
            s = rows.season.to_numpy()
            cal = _oof_platt(p, y, s)
            hist = hists[code]
            base = _base(hist, rows, lambda r, f=settle: None if np.isnan(r.cor_h) or np.isnan(r.cor_a) else f(r.cor_h, r.cor_a))
            m = (s >= "2021-22") & ~np.isnan(cal) & ~np.isnan(base)
            g = _gate(cal[m], y[m], base[m], gate)
            corner_pass += g["pass"]
            cells.append(f"{'✅' if g['pass'] else '—'} {g['base'] - g['ll']:+.4f} / ece {g['ece']:.3f}")
        lines.append(f"| {code} | " + " | ".join(cells) + " |")
    lines += ["", "Cells: ✅ = passes the gate; then log-loss improvement over the base rate (positive = better) and calibration error.", "",
              f"Corner outcomes passing: **{corner_pass}**.", ""]
    out = ROOT / "documentation" / "MARKET_RESEARCH.md"
    out.write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines))
    print(f"\nwritten {out}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["build", "report"])
    ap.add_argument("--leagues", nargs="+", default=BACKTEST_LEAGUES)
    a = ap.parse_args()
    build(a.leagues) if a.cmd == "build" else report()
