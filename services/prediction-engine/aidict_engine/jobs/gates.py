"""Weekly: walk-forward backtest per competition → per-outcome gates (with persistence), Platt calibration and
market status per competition. Usage: python -m aidict_engine.jobs.gates [--competitions PL BL1 ...]"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone

from aidict_data import env
from aidict_data.db import Repo, connect

from ..backtest import Config, run, summarize
from ..history import BACKTEST_LEAGUES, load, seasons_between
from ..market_eval import SPECS, evaluate, fit_calibrators

UNVERIFIED_SETTLEMENT = {"1x2-1up", "1x2-2up", "1x2-never-down", "dc-1up"}
GOAL_ORDER_COMPS = {"BL1"}


def _reason(gate: dict | None, n: int) -> str:
    if not gate:
        return "Not enough seasons to calibrate"
    fails = [lab for k, lab in (("sample", f"sample {n} < 1,000"), ("beats_base", "no significant edge over the base rate"), ("calibration", "calibration above threshold")) if not gate[k]]
    return "Passed all gates" if not fails else "Fails: " + ", ".join(fails)


def evaluate_competition(code: str, log=print):
    seasons = seasons_between("2016-17", "2025-26")
    df, stats = load(code, seasons, log=log)
    if len(df) < 1500:
        log(f"  ! {code}: only {len(df)} historical matches — skipped")
        return None
    bt = run(df, Config(test_from="2019-20"))
    last = bt.season.max()
    current = evaluate(bt, df)
    previous = evaluate(bt[bt.season < last].reset_index(drop=True), df[df.season < last].reset_index(drop=True))
    calib = fit_calibrators(bt)
    return {"df": df, "bt": bt, "stats": stats, "summary": summarize(bt), "current": current, "previous": previous, "calib": calib}


def write(repo: Repo, code: str, res: dict, log=print) -> dict:
    comp_id = repo.competition_id(code)
    mv = repo.one("select id from model_versions where model_id = 'football-dc' and status = 'active'")
    run_id = repo.one("""insert into backtest_runs (model_version_id, config, split, metrics, finished_at) values (%s, %s, %s, %s, now()) returning id""",
                      (mv["id"] if mv else None, json.dumps({"competition": code, "xi": 0.0019, "window_days": 1095, "calibration": "platt"}),
                       json.dumps({"train_from": "2016-17", "test_from": "2019-20", "test_to": res["bt"].season.max()}),
                       json.dumps({"n": res["summary"]["n"], "x12": res["summary"]["x12"]}, default=float)))["id"]
    prev_by_key = {(r["market"], r["outcome"]): r for r in res["previous"]}
    counts = {"active": 0, "validating": 0}
    by_market: dict[str, list] = {}
    for r in res["current"]:
        key = (r["market"], r["outcome"])
        # A re-run within the same week replaces that week's evaluation; it must not count as a second consecutive pass.
        existing = repo.one("""select passes_in_row, fails_in_row from outcome_gates where market_id = %s and outcome_key = %s and competition_id = %s
                               and evaluated_at < now() - interval '6 days'""", (*key, comp_id))
        cal = r.get("calibrated")
        passed = bool(cal and cal["gate"]["pass"])
        if existing:
            passes = existing["passes_in_row"] + 1 if passed else 0
            fails = 0 if passed else existing["fails_in_row"] + 1
        else:  # bootstrap: the backtest ending one season earlier counts as the previous weekly run
            pc = (prev_by_key.get(key) or {}).get("calibrated")
            prev_pass = bool(pc and pc["gate"]["pass"])
            passes = (2 if prev_pass else 1) if passed else 0
            fails = 0 if passed else (2 if not prev_pass else 1)
        if r["market"] in UNVERIFIED_SETTLEMENT:
            status, reason = "validating", "Settlement rules not verified with a bookmaker" + (" (statistics pass)" if passed else "")
        elif not r.get("raw"):
            status, reason = "unavailable", r.get("note", "No settlement data")
        elif passes >= 2:
            status, reason = "active", "Passed in two consecutive backtests"
        else:
            status, reason = "validating", _reason(cal["gate"] if cal else None, cal["n"] if cal else 0) + (" · needs a second consecutive pass" if passed else "")
        counts["active" if status == "active" else "validating"] += 1
        g = cal or {}
        repo.run("""insert into outcome_gates (market_id, outcome_key, competition_id, status, reason, n, log_loss, base_log_loss, ece, ci_high, passes_in_row, fails_in_row, label, evaluated_at)
                    values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now())
                    on conflict (market_id, outcome_key, competition_id) do update set status = excluded.status, reason = excluded.reason, n = excluded.n,
                    log_loss = excluded.log_loss, base_log_loss = excluded.base_log_loss, ece = excluded.ece, ci_high = excluded.ci_high,
                    passes_in_row = excluded.passes_in_row, fails_in_row = excluded.fails_in_row, label = excluded.label, evaluated_at = now()""",
                 (*key, comp_id, status, reason, g.get("n", 0), g.get("log_loss"), g.get("base_log_loss"), g.get("ece"), (g.get("ci") or [None, None, None])[2],
                  passes, fails, r["label"]))
        if key in res["calib"]:
            a, b, n = res["calib"][key]
            repo.run("""insert into outcome_calibration (market_id, outcome_key, competition_id, a, b, n, fitted_at) values (%s, %s, %s, %s, %s, %s, now())
                        on conflict (market_id, outcome_key, competition_id) do update set a = excluded.a, b = excluded.b, n = excluded.n, fitted_at = now()""",
                     (*key, comp_id, a, b, n))
        by_market.setdefault(r["market"], []).append((status, r, g))
    for market, rows in by_market.items():
        best = max(rows, key=lambda t: t[2].get("n", 0))
        agg = "active" if any(s == "active" for s, _, _ in rows) else "validating" if any(s == "validating" for s, _, _ in rows) else "unavailable"
        active_labels = [r["label"] for s, r, _ in rows if s == "active"]
        reason = ("Published outcomes: " + ", ".join(active_labels)) if active_labels else best[0] == "unavailable" and best[1].get("note") or (rows[0][1] and "No outcome passed its gate yet")
        g = best[2]
        repo.run("""insert into market_competition_status (market_id, competition_id, status, reason, oos_n, log_loss, ece, evaluated_at) values (%s, %s, %s, %s, %s, %s, %s, now())
                    on conflict (market_id, competition_id) do update set status = excluded.status, reason = excluded.reason, oos_n = excluded.oos_n,
                    log_loss = excluded.log_loss, ece = excluded.ece, evaluated_at = now()""",
                 (market, comp_id, agg, reason, g.get("n"), g.get("log_loss"), g.get("ece")))
        repo.run("""insert into market_backtests (backtest_run_id, market_id, competition_id, n, log_loss, ece, reliability_bins) values (%s, %s, %s, %s, %s, %s, %s)
                    on conflict do nothing""", (run_id, market, comp_id, g.get("n", 0), g.get("log_loss"), g.get("ece"),
                                                json.dumps([{"outcome": r["outcome"], "label": r["label"], "status": s, "n": gg.get("n"), "log_loss": gg.get("log_loss"), "ece": gg.get("ece")} for s, r, gg in rows], default=float)))
    return counts


def mark_unmodelled(repo: Repo, log=print) -> None:
    """Honest statuses for markets/competitions that have no backtested model."""
    comps = repo.all("select id, code from competitions where is_active")
    defs = repo.all("select id, category, required_data from market_definitions")
    for c in comps:
        for d in defs:
            exists = repo.one("select 1 from market_competition_status where market_id = %s and competition_id = %s", (d["id"], c["id"]))
            if exists:
                continue
            if d["category"] == "player":
                st, why = "unavailable", "Needs confirmed line-ups, player minutes and penalty takers — not available on free sources"
            elif d["category"] == "corners":
                st, why = "validating", "Corners model not built yet (football-data.co.uk history available)"
            elif "goal_times" in (d["required_data"] or []) and c["code"] not in GOAL_ORDER_COMPS:
                st, why = "unavailable", "No goal-order data for this competition on free sources"
            elif c["code"] in ("CL", "BSA", "WC"):
                st, why = "validating", "No historical data source for backtesting this competition"
            else:
                st, why = "validating", "Not backtested yet"
            repo.run("insert into market_competition_status (market_id, competition_id, status, reason, evaluated_at) values (%s, %s, %s, %s, now())", (d["id"], c["id"], st, why))


MODEL_VERSION = "1.0.1"  # 1.0.1: snapshot schedule T-7d preview → T-24h → T-2h (model maths unchanged from 1.0.0)


def ensure_model(repo: Repo) -> None:
    """Registers MODEL_VERSION as the single active football-dc version; older versions are retired, never deleted."""
    repo.run("update model_versions set status = 'retired' where model_id = 'football-dc' and version <> %s and status = 'active'", (MODEL_VERSION,))
    repo.run("""insert into model_versions (model_id, version, trained_at, params, status) values ('football-dc', %s, now(), %s, 'active')
                on conflict (model_id, version) do update set status = 'active'""",
             (MODEL_VERSION, json.dumps({"xi": 0.0019, "window_days": 1095, "l2": 1.0, "promoted_prior": [-0.25, 0.2], "calibration": "platt",
                                         "horizons": ["T-7d", "T-24h", "T-2h"]})))


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--competitions", nargs="+", default=BACKTEST_LEAGUES)
    args = ap.parse_args(argv)
    env.require("SUPABASE_DB_URL")
    sys.stdout.reconfigure(encoding="utf-8")
    repo = Repo(connect())
    with repo.tx():
        ensure_model(repo)
    for code in args.competitions:
        print(f"Backtesting {code} …")
        res = evaluate_competition(code)
        if not res:
            continue
        with repo.tx():
            counts = write(repo, code, res)
        print(f"✓ {code}: {counts['active']} outcomes published, {counts['validating']} validating · 1X2 log loss {res['summary']['x12']['Dixon–Coles']['log_loss']:.3f}")
    with repo.tx():
        mark_unmodelled(repo)
        repo.job_finished("retrain_and_backtest", "success")
    print(f"Done {datetime.now(timezone.utc):%Y-%m-%d %H:%M} UTC")


if __name__ == "__main__":
    main()
