"""Walk-forward backtest: every matchweek is predicted using ONLY matches played before it, then models refit.
Benchmarks: base rate, Elo (ordered logit), and closing bookmaker odds (margin removed) where available."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import timedelta

import numpy as np
import pandas as pd

from . import dixon_coles
from .elo import Elo, OrderedLogit
from .markets import btts, one_x_two, over
from .metrics import (binary_brier, binary_log_loss, bootstrap_diff, brier, ece, ece_multiclass, log_loss, per_match_log_loss, reliability, rps)


@dataclass
class Config:
    test_from: str = "2019-20"
    xi: float = 0.0019  # time-decay per day (half-life ≈ 1 year)
    window_days: int = 3 * 365
    l2: float = 1.0
    seasons: list[str] = field(default_factory=list)


def _outcome(gh: int, ga: int) -> int:
    return 0 if gh > ga else 1 if gh == ga else 2


def run(matches: pd.DataFrame, cfg: Config) -> pd.DataFrame:
    """`matches` columns: season, kickoff (UTC), home, away, gh, ga, [mkt_h, mkt_d, mkt_a, mkt_over, mkt_under]."""
    df = matches.sort_values("kickoff").reset_index(drop=True).copy()
    df["y"] = [_outcome(h, a) for h, a in zip(df.gh, df.ga)]
    seasons = sorted(df.season.unique())

    # Elo, processed strictly in time order; record the PRE-match rating difference.
    elo = Elo()
    diffs = np.zeros(len(df))
    for s in seasons:
        idx = df.index[df.season == s]
        elo.start_season(s, set(df.loc[idx, "home"]) | set(df.loc[idx, "away"]))
        for i in idx:
            r = df.loc[i]
            diffs[i] = elo.diff(r.home, r.away)
            elo.update(r.home, r.away, int(r.gh), int(r.ga))
    df["elo_diff"] = diffs

    rows = []
    test = df[df.season >= cfg.test_from]
    teams_by_season = {s: set(df[df.season == s].home) | set(df[df.season == s].away) for s in seasons}
    for season in sorted(test.season.unique()):
        season_start = df[df.season == season].kickoff.min()
        hist = df[df.kickoff < season_start]
        ol = OrderedLogit().fit(hist.elo_diff.values, hist.y.values)
        base = np.bincount(hist.y.values, minlength=3) / len(hist)
        base_over = float((hist.gh + hist.ga > 2.5).mean())
        base_btts = float(((hist.gh > 0) & (hist.ga > 0)).mean())
        prev = seasons[seasons.index(season) - 1] if seasons.index(season) > 0 else None
        promoted = teams_by_season[season] - (teams_by_season.get(prev, set()) if prev else set())
        prior = {t: dixon_coles.PROMOTED_PRIOR for t in promoted}
        season_df = df[df.season == season]
        weeks = season_df.groupby(season_df.kickoff.dt.isocalendar().week.astype(int) + 100 * season_df.kickoff.dt.isocalendar().year.astype(int))
        for _, wk in sorted(weeks, key=lambda g: g[1].kickoff.min()):
            cutoff = wk.kickoff.min()
            train = df[(df.kickoff < cutoff) & (df.kickoff >= cutoff - timedelta(days=cfg.window_days))]
            age = (cutoff - train.kickoff).dt.total_seconds() / 86400
            model = dixon_coles.fit(list(train.home), list(train.away), train.gh.values, train.ga.values, age.values, cfg.xi, cfg.l2, prior)
            for _, r in wk.iterrows():
                m = model.matrix(r.home, r.away)
                ph, pd_, pa = one_x_two(m)
                lh, la = model.rates(r.home, r.away)
                eh, ed, ea = ol.predict(np.array([r.elo_diff]))[0]
                row = {"season": season, "kickoff": r.kickoff, "home": r.home, "away": r.away, "gh": r.gh, "ga": r.ga, "y": r.y,
                       "dc_h": ph, "dc_d": pd_, "dc_a": pa, "dc_over25": over(m, 2.5), "dc_btts": btts(m), "lam_h": lh, "lam_a": la, "rho": model.rho,
                       "elo_h": eh, "elo_d": ed, "elo_a": ea, "base_h": base[0], "base_d": base[1], "base_a": base[2], "base_over25": base_over, "base_btts": base_btts}
                for k in ("mkt_h", "mkt_d", "mkt_a", "mkt_over", "mkt_under"):
                    row[k] = r.get(k, np.nan)
                rows.append(row)
    out = pd.DataFrame(rows)
    # Market-implied probabilities with the bookmaker margin removed proportionally.
    inv = 1 / out[["mkt_h", "mkt_d", "mkt_a"]]
    s = inv.sum(axis=1)
    out[["imp_h", "imp_d", "imp_a"]] = inv.div(s, axis=0).values
    io, iu = 1 / out.mkt_over, 1 / out.mkt_under
    out["imp_over25"] = io / (io + iu)
    return out


def summarize(bt: pd.DataFrame) -> dict:
    y = bt.y.values
    over_y = ((bt.gh + bt.ga) > 2.5).astype(int).values
    btts_y = ((bt.gh > 0) & (bt.ga > 0)).astype(int).values
    res: dict = {"n": int(len(bt)), "seasons": sorted(bt.season.unique().tolist()), "x12": {}, "ou25": {}, "btts": {}}
    models = {"Base rate": "base", "Elo (ordered logit)": "elo", "Dixon–Coles": "dc"}
    mkt_mask = bt[["imp_h", "imp_d", "imp_a"]].notna().all(axis=1).values
    for name, p in models.items():
        P = bt[[f"{p}_h", f"{p}_d", f"{p}_a"]].values
        res["x12"][name] = {"brier": brier(P, y), "log_loss": log_loss(P, y), "rps": rps(P, y), "ece": ece_multiclass(P, y),
                            "accuracy": float((P.argmax(1) == y).mean()), "n": int(len(y))}
    if mkt_mask.any():
        Pm = bt.loc[mkt_mask, ["imp_h", "imp_d", "imp_a"]].values
        ym = y[mkt_mask]
        res["x12"]["Closing odds (margin removed)"] = {"brier": brier(Pm, ym), "log_loss": log_loss(Pm, ym), "rps": rps(Pm, ym), "ece": ece_multiclass(Pm, ym),
                                                       "accuracy": float((Pm.argmax(1) == ym).mean()), "n": int(mkt_mask.sum())}
        Pd = bt.loc[mkt_mask, ["dc_h", "dc_d", "dc_a"]].values
        res["x12"]["Dixon–Coles (same matches as odds)"] = {"brier": brier(Pd, ym), "log_loss": log_loss(Pd, ym), "rps": rps(Pd, ym), "ece": ece_multiclass(Pd, ym),
                                                            "accuracy": float((Pd.argmax(1) == ym).mean()), "n": int(mkt_mask.sum())}
        res["dc_vs_market_logloss"] = bootstrap_diff(per_match_log_loss(Pd, ym), per_match_log_loss(Pm, ym))
    Pdc = bt[["dc_h", "dc_d", "dc_a"]].values
    Pb = bt[["base_h", "base_d", "base_a"]].values
    res["dc_vs_base_logloss"] = bootstrap_diff(per_match_log_loss(Pdc, y), per_match_log_loss(Pb, y))
    for name, col in {"Base rate": "base_over25", "Dixon–Coles": "dc_over25"}.items():
        res["ou25"][name] = {"brier": binary_brier(bt[col], over_y), "log_loss": binary_log_loss(bt[col], over_y), "ece": ece(bt[col].values, over_y)}
    om = bt.imp_over25.notna().values
    if om.any():
        res["ou25"]["Closing odds (margin removed)"] = {"brier": binary_brier(bt.imp_over25[om], over_y[om]), "log_loss": binary_log_loss(bt.imp_over25[om], over_y[om]), "ece": ece(bt.imp_over25[om].values, over_y[om]), "n": int(om.sum())}
    for name, col in {"Base rate": "base_btts", "Dixon–Coles": "dc_btts"}.items():
        res["btts"][name] = {"brier": binary_brier(bt[col], btts_y), "log_loss": binary_log_loss(bt[col], btts_y), "ece": ece(bt[col].values, btts_y)}

    def _pm_binary(p, yy):
        p = np.clip(np.asarray(p, float), 1e-12, 1 - 1e-12)
        return -(yy * np.log(p) + (1 - yy) * np.log(1 - p))

    res["dc_vs_base_ou25"] = bootstrap_diff(_pm_binary(bt.dc_over25, over_y), _pm_binary(bt.base_over25, over_y))
    res["dc_vs_base_btts"] = bootstrap_diff(_pm_binary(bt.dc_btts, btts_y), _pm_binary(bt.base_btts, btts_y))

    # Publication gate (documentation/PREDICTION_ENGINE.md §6): n ≥ 1,000 out-of-sample, log loss better than the base rate
    # with the 95% CI excluding zero, and ECE ≤ 0.04 (multi-outcome) / ≤ 0.03 (binary).
    def gate(n, ci, ece_v, max_ece):
        checks = {"sample": n >= 1000, "beats_base": ci[2] < 0, "calibration": ece_v <= max_ece}
        return {"pass": all(checks.values()), **checks, "ece": ece_v, "max_ece": max_ece}

    res["gates"] = {
        "1X2": gate(len(bt), res["dc_vs_base_logloss"], res["x12"]["Dixon–Coles"]["ece"], 0.04),
        "Over/Under 2.5": gate(len(bt), res["dc_vs_base_ou25"], res["ou25"]["Dixon–Coles"]["ece"], 0.03),
        "Both teams to score": gate(len(bt), res["dc_vs_base_btts"], res["btts"]["Dixon–Coles"]["ece"], 0.03),
    }
    res["reliability_home"] = reliability(bt.dc_h.values, (y == 0).astype(int))
    res["by_season"] = {s: {"n": int(len(g)), "dc_log_loss": log_loss(g[["dc_h", "dc_d", "dc_a"]].values, g.y.values),
                            "base_log_loss": log_loss(g[["base_h", "base_d", "base_a"]].values, g.y.values)} for s, g in bt.groupby("season")}
    return res
