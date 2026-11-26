"""Walk-forward backtest on REAL historical data.

Results: OpenFootball (CC0). Closing odds benchmark: football-data.co.uk (private use), merged by canonical team names.
Usage:  python scripts/run_backtest.py --leagues PL BL1 --first 2016-17 --last 2025-26 --test-from 2019-20
Writes: documentation/BACKTEST_RESULTS.md and services/.cache/backtest-<league>.csv
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

sys.stdout.reconfigure(encoding="utf-8")  # Windows consoles default to cp1252
ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT / "services" / "data-engine"), str(ROOT / "services" / "prediction-engine")]

from aidict_data.normalise import canonical  # noqa: E402
from aidict_data.providers import FootballDataUkAdapter, OpenFootballAdapter  # noqa: E402
from aidict_data.types import Ok  # noqa: E402
from aidict_engine.backtest import Config, run, summarize  # noqa: E402

LEAGUE_NAMES = {"PL": "Premier League", "BL1": "Bundesliga", "PD": "LaLiga", "SA": "Serie A", "FL1": "Ligue 1", "ELC": "Championship"}


def seasons_between(first: str, last: str) -> list[str]:
    a, b = int(first[:4]), int(last[:4])
    return [f"{y}-{str(y + 1)[2:]}" for y in range(a, b + 1)]


def load(league: str, seasons: list[str]) -> tuple[pd.DataFrame, dict]:
    of, uk = OpenFootballAdapter(), FootballDataUkAdapter()
    rows, unmatched, missing_odds = [], set(), 0
    stats = {"openfootball_matches": 0, "with_odds": 0}
    for s in seasons:
        res = of.get_results(league, s)
        if not isinstance(res, Ok):
            print(f"  ! OpenFootball {league} {s}: {getattr(res, 'error', getattr(res, 'reason', res))}")
            continue
        odds_by_key: dict = {}
        q = uk.get_odds(league, s)
        if isinstance(q, Ok):
            for o in q.data:
                key = (canonical(o.home), canonical(o.away), o.kickoff.date())
                odds_by_key.setdefault(key, {})[(o.market, o.selection)] = o.decimal_odds
        for f in res.data:
            stats["openfootball_matches"] += 1
            h, a = canonical(f.home), canonical(f.away)
            odds_teams = {k[0] for k in odds_by_key} | {k[1] for k in odds_by_key}
            if odds_by_key:
                unmatched.update(n for n, c in ((f.home, h), (f.away, a)) if c not in odds_teams)
            od = odds_by_key.get((h, a, f.kickoff.date())) or odds_by_key.get((h, a, (f.kickoff.astimezone(timezone.utc)).date()))
            if od is None:
                # kickoff dates can differ by a day across sources (time zones / late listings)
                from datetime import timedelta
                od = odds_by_key.get((h, a, f.kickoff.date() - timedelta(days=1))) or odds_by_key.get((h, a, f.kickoff.date() + timedelta(days=1)))
            if od:
                stats["with_odds"] += 1
            else:
                missing_odds += 1
            rows.append({"season": s, "kickoff": f.kickoff, "home": h, "away": a, "gh": f.ft[0], "ga": f.ft[1],
                         "mkt_h": (od or {}).get(("1x2", "H")), "mkt_d": (od or {}).get(("1x2", "D")), "mkt_a": (od or {}).get(("1x2", "A")),
                         "mkt_over": (od or {}).get(("ou25", "over")), "mkt_under": (od or {}).get(("ou25", "under"))})
    df = pd.DataFrame(rows)
    df["kickoff"] = pd.to_datetime(df.kickoff, utc=True)
    stats["missing_odds"] = missing_odds
    stats["unmatched_names"] = sorted(unmatched)
    return df, stats


def fmt(x, d=3):
    return "—" if x is None or x != x else f"{x:.{d}f}"


def write_report(results: dict, args) -> Path:
    out = ROOT / "documentation" / "BACKTEST_RESULTS.md"
    lines = [
        "# AIDICT — Walk-forward Backtest Results (real data)",
        "",
        f"**Generated:** {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')} by `services/scripts/run_backtest.py`  ",
        f"**Data:** OpenFootball results (CC0), seasons {args.first} → {args.last}. Closing odds: football-data.co.uk (private use).  ",
        f"**Method:** every matchweek from {args.test_from} is predicted using only earlier matches (3-season window, time decay ξ = {args.xi}/day), then the Dixon–Coles model is refitted. Elo's ordered logit and the base rates are refitted each season on prior seasons only.",
        "",
        "> These are genuine out-of-sample results — not sample data. Lower Brier / log loss / RPS is better. ECE = calibration error.",
        "",
    ]
    for league, r in results.items():
        s = r["summary"]
        lines += [f"## {LEAGUE_NAMES.get(league, league)} ({league})", "",
                  f"Out-of-sample matches: **{s['n']:,}** · seasons {', '.join(s['seasons'])} · odds matched for {r['stats']['with_odds']:,} of {r['stats']['openfootball_matches']:,} matches", "",
                  "### Full-time result (1X2)", "", "| Model | n | Brier | Log loss | RPS | ECE | Top-pick hit rate |", "|---|---:|---:|---:|---:|---:|---:|"]
        for name, m in s["x12"].items():
            lines.append(f"| {name} | {m['n']:,} | {fmt(m['brier'])} | {fmt(m['log_loss'])} | {fmt(m['rps'])} | {fmt(m['ece'])} | {m['accuracy'] * 100:.1f}% |")
        d, lo, hi = s["dc_vs_base_logloss"]
        lines += ["", f"Dixon–Coles vs base rate, log-loss difference per match: **{d:+.4f}** (95% CI {lo:+.4f} to {hi:+.4f}) — {'better' if hi < 0 else 'not significantly better'} than the base rate."]
        if "dc_vs_market_logloss" in s:
            d, lo, hi = s["dc_vs_market_logloss"]
            lines += [f"Dixon–Coles vs closing odds: **{d:+.4f}** (95% CI {lo:+.4f} to {hi:+.4f}) — {'the market is better' if lo > 0 else 'no significant difference' if hi > 0 else 'model better'}."]
        lines += ["", "### Over/Under 2.5 goals", "", "| Model | Brier | Log loss | ECE |", "|---|---:|---:|---:|"]
        for name, m in s["ou25"].items():
            lines.append(f"| {name} | {fmt(m['brier'])} | {fmt(m['log_loss'])} | {fmt(m['ece'])} |")
        lines += ["", "### Both teams to score", "", "| Model | Brier | Log loss | ECE |", "|---|---:|---:|---:|"]
        for name, m in s["btts"].items():
            lines.append(f"| {name} | {fmt(m['brier'])} | {fmt(m['log_loss'])} | {fmt(m['ece'])} |")
        lines += ["", "### Publication gates (raw model, before the calibration layer)", "", "| Market | n ≥ 1,000 | Beats base rate (95% CI) | Calibration | Verdict |", "|---|:---:|:---:|:---:|---|"]
        for mk, g in s["gates"].items():
            yes = lambda b: "✅" if b else "❌"
            lines.append(f"| {mk} | {yes(g['sample'])} | {yes(g['beats_base'])} | {yes(g['calibration'])} ECE {g['ece']:.3f} (≤ {g['max_ece']}) | {'**Publishable**' if g['pass'] else 'Not published — validating'} |")
        for label, key in (("Over/Under 2.5", "dc_vs_base_ou25"), ("BTTS", "dc_vs_base_btts")):
            d, lo, hi = s[key]
            lines += ["", f"{label} vs base rate, log-loss difference: {d:+.4f} (95% CI {lo:+.4f} to {hi:+.4f})."]
        lines += ["", "### Calibration — home win (Dixon–Coles)", "", "| Predicted | Observed | n | 95% interval |", "|---:|---:|---:|---|"]
        for b in s["reliability_home"]:
            lines.append(f"| {b['predicted'] * 100:.1f}% | {b['observed'] * 100:.1f}% | {b['n']} | {b['lo'] * 100:.1f}–{b['hi'] * 100:.1f}% |")
        lines += ["", "### By season (1X2 log loss)", "", "| Season | n | Dixon–Coles | Base rate |", "|---|---:|---:|---:|"]
        for season, v in s["by_season"].items():
            lines.append(f"| {season} | {v['n']} | {fmt(v['dc_log_loss'])} | {fmt(v['base_log_loss'])} |")
        lines += ["", f"Runtime: {r['seconds']:.0f}s · team names without a cross-provider match (alias review): {', '.join(sorted(r['unmatched'])) or 'none'}", ""]
    lines += ["## Reading these results", "",
              "- Beating the base rate shows the model has real information. Matching or approaching closing odds is the hardest benchmark in football; the gap is reported, not hidden.",
              "- Markets are only published when they pass their gate (n ≥ 1,000 out-of-sample, log loss better than base rate with the 95% CI excluding zero, ECE ≤ 0.04 multi-outcome / ≤ 0.03 binary).",
              "- Gates above are for the RAW model. Production adds an isotonic calibration layer fitted on walk-forward out-of-fold predictions; markets failing only on calibration are re-tested after it.",
              "- Re-run after any model change; results are versioned with the model in `model_evaluations`.", ""]
    out.write_text("\n".join(lines), encoding="utf-8")
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--leagues", nargs="+", default=["PL"])
    ap.add_argument("--first", default="2016-17")
    ap.add_argument("--last", default="2025-26")
    ap.add_argument("--test-from", default="2019-20")
    ap.add_argument("--xi", type=float, default=0.0019)
    args = ap.parse_args()
    results = {}
    for league in args.leagues:
        t0 = time.time()
        print(f"Loading {league} {args.first} → {args.last}")
        df, stats = load(league, seasons_between(args.first, args.last))
        print(f"  {len(df):,} matches · odds matched {stats['with_odds']:,}")
        bt = run(df, Config(test_from=args.test_from, xi=args.xi))
        cache = ROOT / "services" / ".cache"
        cache.mkdir(parents=True, exist_ok=True)
        bt.to_csv(cache / f"backtest-{league}.csv", index=False)
        summary = summarize(bt)
        results[league] = {"summary": summary, "stats": stats, "seconds": time.time() - t0, "unmatched": stats["unmatched_names"]}
        print(json.dumps({k: {m: round(v["log_loss"], 4) for m, v in summary["x12"].items()} for k in ["x12"]}, indent=1))
    print(f"Report: {write_report(results, args)}")


if __name__ == "__main__":
    main()
