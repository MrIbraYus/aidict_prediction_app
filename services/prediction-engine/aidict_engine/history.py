"""Historical match data for training and backtesting: OpenFootball results (CC0) + football-data.co.uk closing odds
(private use) + OpenLigaDB goal order (Bundesliga). All merged on canonical team names and kick-off date (±1 day)."""
from __future__ import annotations

from datetime import timedelta

import pandas as pd

from aidict_data.normalise import canonical
from aidict_data.providers import FootballDataUkAdapter, OpenFootballAdapter, OpenLigaDbAdapter
from aidict_data.types import Ok

BACKTEST_LEAGUES = ["PL", "PD", "BL1", "SA", "FL1", "DED", "ELC", "PPL"]


def seasons_between(first: str, last: str) -> list[str]:
    a, b = int(first[:4]), int(last[:4])
    return [f"{y}-{str(y + 1)[2:]}" for y in range(a, b + 1)]


def _near(table: dict, h: str, a: str, d):
    for k in ((h, a, d), (h, a, d - timedelta(days=1)), (h, a, d + timedelta(days=1))):
        if k in table:
            return table[k]
    return None


def load(league: str, seasons: list[str], with_odds: bool = True, log=print, with_stats: bool = True) -> tuple[pd.DataFrame, dict]:
    of, uk = OpenFootballAdapter(), FootballDataUkAdapter()
    rows, unmatched = [], set()
    stats = {"openfootball_matches": 0, "with_odds": 0, "with_goal_order": 0, "with_match_stats": 0}
    seq_by_key: dict = {}
    if league == "BL1":
        oldb = OpenLigaDbAdapter()
        for s in seasons:
            r = oldb.get_fixtures("BL1", s)
            if isinstance(r, Ok):
                for f in r.data:
                    if f.ft and len(f.goals) == sum(f.ft):  # only sequences consistent with the final score
                        seq_by_key[(canonical(f.home), canonical(f.away), f.kickoff.date())] = "".join("H" if g.side == "home" else "A" for g in f.goals)
    for s in seasons:
        res = of.get_results(league, s)
        if not isinstance(res, Ok):
            log(f"  ! OpenFootball {league} {s}: {getattr(res, 'error', getattr(res, 'reason', res))}")
            continue
        odds_by_key: dict = {}
        if with_odds:
            q = uk.get_odds(league, s)
            if isinstance(q, Ok):
                for o in q.data:
                    odds_by_key.setdefault((canonical(o.home), canonical(o.away), o.kickoff.date()), {})[(o.market, o.selection)] = o.decimal_odds
        odds_teams = {k[0] for k in odds_by_key} | {k[1] for k in odds_by_key}
        # Match statistics (shots, shots on target, corners, cards) from football-data.co.uk; missing stays missing.
        stats_by_key: dict = {}
        if with_stats:
            q = uk.get_match_statistics(league, s)
            if isinstance(q, Ok):
                for st in q.data:
                    stats_by_key.setdefault((canonical(st.home), canonical(st.away), st.kickoff.date()), {})[f"{st.key}_{st.side}"] = st.value
        for f in res.data:
            stats["openfootball_matches"] += 1
            h, a = canonical(f.home), canonical(f.away)
            if odds_by_key:
                unmatched.update(n for n, c in ((f.home, h), (f.away, a)) if c not in odds_teams)
            od = _near(odds_by_key, h, a, f.kickoff.date()) or {}
            seq = _near(seq_by_key, h, a, f.kickoff.date())
            ms = _near(stats_by_key, h, a, f.kickoff.date()) or {}
            stats["with_match_stats"] += bool(ms)
            stats["with_odds"] += bool(od)
            stats["with_goal_order"] += seq is not None
            rows.append({"season": s, "kickoff": f.kickoff, "home": h, "away": a, "gh": f.ft[0], "ga": f.ft[1], "goal_seq": seq,
                         "mkt_h": od.get(("1x2", "H")), "mkt_d": od.get(("1x2", "D")), "mkt_a": od.get(("1x2", "A")),
                         "mkt_over": od.get(("ou25", "over")), "mkt_under": od.get(("ou25", "under")),
                         "sh_h": ms.get("shots_home"), "sh_a": ms.get("shots_away"), "sot_h": ms.get("shots_on_target_home"), "sot_a": ms.get("shots_on_target_away"),
                         "cor_h": ms.get("corners_home"), "cor_a": ms.get("corners_away"), "ylw_h": ms.get("yellow_home"), "ylw_a": ms.get("yellow_away")})
    df = pd.DataFrame(rows)
    if len(df):
        df["kickoff"] = pd.to_datetime(df.kickoff, utc=True)
    stats["unmatched_names"] = sorted(unmatched)
    return df, stats
