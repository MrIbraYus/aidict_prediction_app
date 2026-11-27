"""Settle published smart picks against official final results (append-only pick_outcomes) and notify users who saved the match.
Usage: python -m aidict_engine.jobs.settle
Goal-order markets settle only when stored goal minutes are complete and consistent with the final score; otherwise they wait
up to three days for the data and are then voided (never guessed)."""
from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone

from aidict_data import env
from aidict_data.db import Repo, connect

from .. import corners
from ..market_eval import SPECS

SPEC = {(s.market, s.outcome): s for s in SPECS}
CORNER_SPEC = {(s.market, s.outcome): s for s in corners.SPECS}
STATS_WAIT = timedelta(days=7)  # football-data.co.uk publishes statistics a few days after the match
ORDER_WAIT = timedelta(days=3)


def goal_sequence(repo: Repo, fixture_id: int, home_id: int, gh: int, ga: int) -> str | None:
    inv = repo.one("select available from fixture_data_inventory where fixture_id = %s and data_type = 'goal_times'", (fixture_id,))
    if not inv or not inv["available"]:
        return None
    goals = repo.all("select team_id from goal_events where fixture_id = %s order by minute, coalesce(stoppage, 0), id", (fixture_id,))
    seq = "".join("H" if g["team_id"] == home_id else "A" for g in goals)
    return seq if seq.count("H") == gh and seq.count("A") == ga else None


def settle(repo: Repo, log=print) -> dict:
    now = datetime.now(timezone.utc)
    rows = repo.all("""select sp.id, sp.market_id, sp.outcome_key, sp.reasons->>'label' label, f.id fixture_id, f.status, f.kickoff_at, f.home_team_id, f.away_team_id,
                              r.ft_home, r.ft_away, r.is_final, th.short_name hs, ta.short_name as_
                       from smart_picks sp join fixtures f on f.id = sp.fixture_id
                       join teams th on th.id = f.home_team_id join teams ta on ta.id = f.away_team_id
                       left join match_results r on r.fixture_id = f.id
                       left join pick_outcomes po on po.smart_pick_id = sp.id
                       where po.id is null and f.kickoff_at < now() - interval '2 hours'""")
    counts = {"won": 0, "lost": 0, "void": 0, "waiting": 0}
    seq_cache: dict[int, str | None] = {}
    for r in rows:
        spec = SPEC.get((r["market_id"], r["outcome_key"]))
        result, source = None, "match_results"
        if r["status"] in ("CANCELLED", "AWARDED"):
            result, source = "void", f"fixture {r['status'].lower()}"
        elif not r["is_final"]:
            counts["waiting"] += 1
            continue
        elif (r["market_id"], r["outcome_key"]) in CORNER_SPEC:
            cs = CORNER_SPEC[(r["market_id"], r["outcome_key"])]
            got = {x["team_id"]: float(x["value"]) for x in repo.all(
                "select team_id, value from match_statistics where fixture_id = %s and stat_key = 'corners'", (r["fixture_id"],))}
            ch, ca = got.get(r["home_team_id"]), got.get(r["away_team_id"])
            if ch is None or ca is None:
                if now - r["kickoff_at"] < STATS_WAIT:
                    counts["waiting"] += 1
                    continue
                result, source = "void", "corner counts never published"
            else:
                result, source = ("won" if cs.settle(ch, ca) >= 1 else "lost"), "match_statistics (football-data.co.uk)"
        elif spec is None:
            result, source = "void", "unknown market"
        else:
            seq = None
            if spec.needs_order:
                if r["fixture_id"] not in seq_cache:
                    seq_cache[r["fixture_id"]] = goal_sequence(repo, r["fixture_id"], r["home_team_id"], r["ft_home"], r["ft_away"])
                seq = seq_cache[r["fixture_id"]]
                source = "match_results+goal_events"
                if seq is None and now - r["kickoff_at"] < ORDER_WAIT:
                    counts["waiting"] += 1
                    continue
            v = spec.settle(r["ft_home"], r["ft_away"], seq)
            result = "void" if v is None else ("won" if v >= 1 else "lost")
        repo.run("insert into pick_outcomes (smart_pick_id, result, result_source) values (%s, %s, %s) on conflict (smart_pick_id) do nothing", (r["id"], result, source))
        counts[result] += 1
        users = repo.all("select user_id from saved_matches where fixture_id = %s and alert_result", (r["fixture_id"],))
        for u in users:
            score = f" ({r['ft_home']}–{r['ft_away']})" if r["ft_home"] is not None else ""
            repo.run("""insert into notifications (user_id, category, title, body, fixture_id) values (%s, 'settled', %s, %s, %s)""",
                     (u["user_id"], f"Pick {result}: {r['label'] or r['outcome_key']}", f"{r['hs']} v {r['as_']}{score}", r["fixture_id"]))
    log(f"settled {sum(v for k, v in counts.items() if k != 'waiting')} picks: {counts}")
    return counts


def main(argv=None):
    env.require("SUPABASE_DB_URL")
    sys.stdout.reconfigure(encoding="utf-8")
    repo = Repo(connect())
    with repo.tx():
        settle(repo)
        repo.job_finished("settle_results", "success")


if __name__ == "__main__":
    main()
