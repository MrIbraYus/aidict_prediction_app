"""Publish predictions for upcoming fixtures: immutable snapshot + every market outcome + the strongest 4–5 smart picks.
Usage: python -m aidict_engine.jobs.predict [--competitions PL BL1 ...] [--days 8]
Snapshots are append-only (T-24h / T-2h); re-running for the same horizon is a no-op."""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from datetime import datetime, timedelta, timezone

import numpy as np
import pandas as pd

from aidict_data import env
from aidict_data.db import Repo, connect

from .. import dixon_coles
from ..history import BACKTEST_LEAGUES, load
from ..market_eval import SPECS, apply_calibration
from ..markets import one_x_two
from ..selection import Candidate, select
from .gates import ensure_model

UNVERIFIED = {"1x2-1up", "1x2-2up", "1x2-never-down", "dc-1up"}
XI, WINDOW_DAYS = 0.0019, 1095


def previous_seasons(label: str, n: int = 3) -> list[str]:
    y = int(label[:4])
    return [f"{s}-{str(s + 1)[2:]}" for s in range(y - n, y)]


def reliability(gate: dict | None, completeness: float, market: str) -> float:
    if not gate or not gate.get("n"):
        return 0.0
    cal = max(0.0, min(1.0, 1 - float(gate["ece"] or 0.06) / 0.06))
    sample = max(0.0, min(1.0, math.log10(max(gate["n"], 1)) / math.log10(5000)))
    cover = 0.3 if market in UNVERIFIED else 1.0 if gate["status"] == "active" else 0.7
    return round(0.4 * cal + 0.25 * sample + 0.25 * completeness + 0.1 * cover, 4)


def team_label(label: str, home: str, away: str) -> str:
    return label.replace("Home", home).replace("Away", away)


def reasons_for(spec, p, base, lh, la, x12, home, away, gate, calib) -> list[str]:
    out = [f"Model probability {p:.0%} vs {base:.0%} in a typical match ({(p - base) * 100:+.0f} pp)."]
    out.append(f"Expected goals (Dixon–Coles): {home} {lh:.2f} + {away} {la:.2f} = {lh + la:.2f}.")
    if spec.market not in ("ou", "btts"):
        out.append(f"Result probabilities: {home} {x12[0]:.0%} · draw {x12[1]:.0%} · {away} {x12[2]:.0%}.")
    if spec.market.endswith("25") and "-or-" in spec.market:
        out.append("Joint probability counted cell-by-cell on the score matrix — overlapping outcomes are counted once, not multiplied.")
    if spec.needs_order:
        out.append("Uses the order of goals: every scoring sequence for each final score is weighted by its probability; validated on real Bundesliga goal minutes.")
    if calib:
        out.append(f"Platt-calibrated on {calib[2]:,} out-of-sample matches.")
    if gate and gate.get("n"):
        out.append(f"Backtest: n = {gate['n']:,}, log loss {float(gate['log_loss']):.3f} vs base {float(gate['base_log_loss']):.3f}, calibration error {float(gate['ece']):.3f}.")
    return out


def training_frame(repo: Repo, code: str, comp_id: int, season_id: int, label: str) -> pd.DataFrame:
    hist, _ = load(code, previous_seasons(label), with_odds=False, log=lambda *_: None)
    cur = repo.all("""select f.kickoff_at, ah.alias home, aa.alias away, r.ft_home gh, r.ft_away ga from fixtures f
                      join match_results r on r.fixture_id = f.id and r.is_final
                      join team_aliases ah on ah.team_id = f.home_team_id and ah.source = 'canonical'
                      join team_aliases aa on aa.team_id = f.away_team_id and aa.source = 'canonical'
                      where f.season_id = %s""", (season_id,))
    cur_df = pd.DataFrame(cur)
    frames = [hist[["kickoff", "home", "away", "gh", "ga", "season"]]] if len(hist) else []
    if len(cur_df):
        cur_df = cur_df.rename(columns={"kickoff_at": "kickoff"})
        cur_df["kickoff"] = pd.to_datetime(cur_df.kickoff, utc=True)
        cur_df["season"] = label
        frames.append(cur_df[["kickoff", "home", "away", "gh", "ga", "season"]])
    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()


def predict_competition(repo: Repo, code: str, days: int, log=print) -> dict:
    comp = repo.one("select id from competitions where code = %s", (code,))
    season = repo.one("select id, label from seasons where competition_id = %s and is_current", (comp["id"],)) if comp else None
    if not season:
        return {"skipped": "no current season (run sync_current first)"}
    upcoming = repo.all("""select f.id, f.kickoff_at, th.short_name hs, th.name hn, ta.short_name as_, ta.name an, ah.alias hc, aa.alias ac
                           from fixtures f join teams th on th.id = f.home_team_id join teams ta on ta.id = f.away_team_id
                           join team_aliases ah on ah.team_id = f.home_team_id and ah.source = 'canonical'
                           join team_aliases aa on aa.team_id = f.away_team_id and aa.source = 'canonical'
                           where f.season_id = %s and f.status in ('SCHEDULED', 'TIMED')
                           and f.kickoff_at > now() + interval '10 minutes' and f.kickoff_at < now() + %s * interval '1 day'
                           order by f.kickoff_at""", (season["id"], days))
    if not upcoming:
        return {"fixtures": 0}
    train = training_frame(repo, code, comp["id"], season["id"], season["label"])
    now = datetime.now(timezone.utc)
    train = train[train.kickoff >= pd.Timestamp(now - timedelta(days=WINDOW_DAYS))]
    last_label = previous_seasons(season["label"], 1)[0]
    teams_now = {u["hc"] for u in upcoming} | {u["ac"] for u in upcoming} | set(train[train.season == season["label"]].home)
    teams_last = set(train[train.season == last_label].home)
    prior = {t: dixon_coles.PROMOTED_PRIOR for t in teams_now - teams_last}
    age = (pd.Timestamp(now) - train.kickoff).dt.total_seconds() / 86400
    model = dixon_coles.fit(list(train.home), list(train.away), train.gh.values, train.ga.values, age.values, XI, 1.0, prior)
    recent = train[train.kickoff >= pd.Timestamp(now - timedelta(days=730))]
    base_m = dixon_coles.score_matrix(float(recent.gh.mean()), float(recent.ga.mean()), model.rho)
    gates = {(g["market_id"], g["outcome_key"]): g for g in repo.all("select * from outcome_gates where competition_id = %s", (comp["id"],))}
    calib = {(c["market_id"], c["outcome_key"]): (c["a"], c["b"], c["n"]) for c in repo.all("select * from outcome_calibration where competition_id = %s", (comp["id"],))}
    ensure_model(repo)
    mv = repo.one("select id, version from model_versions where model_id = 'football-dc' and status = 'active'")
    written = picks_n = 0
    for u in upcoming:
        hours = (u["kickoff_at"] - now).total_seconds() / 3600
        # One immutable snapshot per horizon: a 7-day preview, the day-before prediction, and the final pre-match update.
        horizon = "T-2h" if hours <= 3 else "T-24h" if hours <= 30 else "T-7d"
        if repo.one("select 1 from prediction_snapshots where fixture_id = %s and model_version_id = %s and horizon = %s", (u["id"], mv["id"], horizon)):
            continue
        m = model.matrix(u["hc"], u["ac"])
        lh, la = model.rates(u["hc"], u["ac"])
        x12 = one_x_two(m)
        inv = {r["data_type"]: r for r in repo.all("select data_type, available, completeness from fixture_data_inventory where fixture_id = %s", (u["id"],))}
        has_order = code == "BL1"
        home, away = u["hs"] or u["hn"], u["as_"] or u["an"]
        rows, cands = [], []
        for spec in SPECS:
            raw = spec.prob(m)
            cp = calib.get((spec.market, spec.outcome))
            p = apply_calibration(raw, cp)
            base = apply_calibration(spec.prob(base_m), cp)
            gate = gates.get((spec.market, spec.outcome))
            if spec.needs_order and not has_order:
                status, why = "unavailable", "No goal-order data for this competition"
            elif gate:
                status, why = gate["status"], gate["reason"]
            else:
                status, why = "validating", "Not backtested for this competition yet"
            completeness = 0.97 if spec.needs_order else float((inv.get("results") or {}).get("completeness") or 1.0)
            rel = reliability(gate, completeness, spec.market)
            label = team_label(spec.label, home, away)
            rows.append((spec, p, base, rel, completeness, status, why, label, gate, cp))
            cands.append(Candidate(spec.market, spec.outcome, label, p, base, rel, status, why, spec.w))
        sel = select(cands, m)
        inputs = {"lambda_home": round(lh, 4), "lambda_away": round(la, 4), "rho": round(model.rho, 4), "train_matches": int(len(train)),
                  "window_days": WINDOW_DAYS, "xi": XI, "promoted": sorted(prior), "sources": ["openfootball", "football-data-org"], "model": mv["version"]}
        input_hash = "sha256:" + hashlib.sha256(json.dumps(inputs, sort_keys=True).encode()).hexdigest()[:32]
        # Selection summary is stored with the snapshot (not hashed) so matches with 0 picks still explain why.
        inputs["selection"] = {"shortfall": sel.shortfall, "exclusions": sel.exclusions, "picks": len(sel.picks)}
        bp = (np.clip(m[:10, :10], 0, 1) * 10000).round().astype(int).ravel().tolist()
        snap = repo.one("""insert into prediction_snapshots (fixture_id, model_version_id, horizon, lambda_home, lambda_away, score_matrix, inputs, input_hash, data_completeness)
                           values (%s, %s, %s, %s, %s, %s, %s, %s, %s) returning id""",
                        (u["id"], mv["id"], horizon, round(lh, 4), round(la, 4), bp, json.dumps(inputs), input_hash, 1.0))["id"]
        with repo.c.cursor() as cur:
            cur.executemany("""insert into market_outcome_probabilities (snapshot_id, market_id, outcome_key, probability, base_rate, reliability, completeness, status, breakdown)
                               values (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                            [(snap, s.market, s.outcome, round(p, 5), round(b, 5), rel, comp_, st, json.dumps({"label": lab, "reason": why}))
                             for s, p, b, rel, comp_, st, why, lab, _, _ in rows])
        by_key = {(r[0].market, r[0].outcome): r for r in rows}
        for pk in sel.picks:
            spec, p, base, rel, _, _, _, label, gate, cp = by_key[(pk.c.market, pk.c.outcome)]
            repo.run("""insert into smart_picks (snapshot_id, fixture_id, rank, market_id, outcome_key, probability, reliability, confidence, lift, score, reasons, excluded)
                        values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                     (snap, u["id"], pk.rank, spec.market, spec.outcome, round(p, 5), rel, pk.confidence, round(p - base, 4), pk.score,
                      json.dumps({"label": label, "interval": [round(x, 4) for x in pk.interval], "reasons": reasons_for(spec, p, base, lh, la, x12, home, away, gate, cp),
                                  "shortfall": sel.shortfall}),
                      json.dumps(sel.exclusions)))
            picks_n += 1
        written += 1
    return {"fixtures": len(upcoming), "snapshots": written, "picks": picks_n, "train_matches": int(len(train))}


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--competitions", nargs="+", default=BACKTEST_LEAGUES)
    ap.add_argument("--days", type=int, default=8)
    args = ap.parse_args(argv)
    env.require("SUPABASE_DB_URL")
    sys.stdout.reconfigure(encoding="utf-8")
    repo = Repo(connect())
    for code in args.competitions:
        try:
            with repo.tx():
                r = predict_competition(repo, code, args.days)
            print(f"✓ {code}: {r}")
        except Exception as e:
            print(f"✗ {code}: {e}")
    with repo.tx():
        repo.job_finished("predict_upcoming", "success")


if __name__ == "__main__":
    main()
