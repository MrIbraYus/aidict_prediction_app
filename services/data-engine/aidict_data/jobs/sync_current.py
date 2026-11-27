"""Sync current-season fixtures, results and team crests from football-data.org (+ Bundesliga goal order from OpenLigaDB).

Usage:  python -m aidict_data.jobs.sync_current [--competitions PL BL1 ...] [--skip-teams]
Respects the free tier (10 requests/minute via the adapter's limiter). Idempotent: safe to run hourly.
"""
from __future__ import annotations

import argparse
import sys
import time
from datetime import datetime, timedelta

from .. import env
from ..db import Repo, connect
from ..normalise import canonical
from ..providers import FootballDataOrgAdapter, FootballDataUkAdapter, OpenLigaDbAdapter
from ..providers.base import INTERNAL_STATUS
from ..types import Ok

COMPETITIONS = ["PL", "PD", "BL1", "SA", "FL1", "DED", "CL", "ELC", "PPL", "BSA"]
FINAL = {"FT", "AET", "PEN", "AWARDED"}
CORNER_DATA = {"PL", "PD", "BL1", "SA", "FL1", "DED", "ELC", "PPL"}  # football-data.co.uk coverage (history)


def season_label(start: str, end: str) -> str:
    sy, ey = int(start[:4]), int(end[:4])
    return str(sy) if sy == ey else f"{sy}-{str(sy + 1)[2:]}"


def sync_competition(repo: Repo, fdo: FootballDataOrgAdapter, code: str, skip_teams: bool, log) -> dict:
    comp_id = repo.competition_id(code)
    if comp_id is None:
        log(f"  ! {code}: not in competitions table (seed missing?)")
        return {}
    t0 = time.time()
    meta = fdo._get(f"/competitions/{code}")
    repo.log_sync(fdo.id, "sync_current", f"/competitions/{code}", 200 if isinstance(meta, Ok) else getattr(meta, "status", None),
                  int((time.time() - t0) * 1000), 0, getattr(meta, "meta", {}).get("requests_available") if isinstance(meta, Ok) else None,
                  None if isinstance(meta, Ok) else getattr(meta, "error", "error"))
    if not isinstance(meta, Ok):
        log(f"  ! {code}: {meta.error}")
        return {}
    cs = meta.data["currentSeason"]
    label = season_label(cs["startDate"], cs["endDate"])
    season_id = repo.upsert_season(comp_id, label, cs["startDate"], cs["endDate"], True)
    year = cs["startDate"][:4]
    national = (meta.data.get("type") or "").upper() == "CUP" and code in ("WC", "EC")
    teams = 0
    if not skip_teams:
        tr = fdo._get(f"/competitions/{code}/teams", {"season": year})
        if isinstance(tr, Ok):
            for t in tr.data.get("teams", []):
                repo.ensure_team(fdo.id, t["name"], str(t["id"]), t.get("shortName"), t.get("tla"), t.get("crest"), national)
                teams += 1
    mr = fdo._get(f"/competitions/{code}/matches", {"season": year})
    if not isinstance(mr, Ok):
        log(f"  ! {code} matches: {mr.error}")
        return {"teams": teams}
    rows = []
    for m in mr.data.get("matches", []):
        ht_, at_ = m["homeTeam"], m["awayTeam"]
        if not ht_.get("name") or not at_.get("name"):
            continue  # knock-out placeholders without teams yet
        home = repo.ensure_team(fdo.id, ht_["name"], str(ht_["id"]), ht_.get("shortName"), ht_.get("tla"), ht_.get("crest"), national)
        away = repo.ensure_team(fdo.id, at_["name"], str(at_["id"]), at_.get("shortName"), at_.get("tla"), at_.get("crest"), national)
        score = m.get("score") or {}
        rows.append({"pid": str(m["id"]), "home": home, "away": away, "status": INTERNAL_STATUS.get(m.get("status", ""), "SCHEDULED"),
                     "kickoff": datetime.fromisoformat(m["utcDate"].replace("Z", "+00:00")), "venue": m.get("venue"),
                     "round": f"Matchday {m['matchday']}" if m.get("matchday") else (m.get("stage") or "").replace("_", " ").title() or None,
                     "ft": score.get("fullTime") or {}, "ht": score.get("halfTime") or {}})
    # One read of the season, then batched writes of only what changed (the database is a network hop away).
    fids = repo.bulk_upsert_fixtures(fdo.id, season_id, rows)
    items = [(fid, (r["ft"]["home"], r["ft"]["away"]), (r["ht"]["home"], r["ht"]["away"]) if r["ht"].get("home") is not None else None, r["status"] in FINAL)
             for fid, r in zip(fids, rows) if r["ft"].get("home") is not None and r["status"] in FINAL | {"LIVE", "HT"}]
    results, conflicts = repo.bulk_upsert_results(fdo.id, items)
    corners = code in CORNER_DATA
    inventory = []
    for fid in fids:
        inventory += [(fid, "results", True, 1.0, fdo.id), (fid, "corners", corners, 0.95 if corners else None, "football-data-co-uk" if corners else None),
                      (fid, "lineups", False, None, None), (fid, "player_stats", False, None, None), (fid, "penalties", False, None, None)]
        if code != "BL1":
            inventory.append((fid, "goal_times", False, None, None))
    repo.bulk_inventory(inventory)
    n = len(fids)
    repo.log_sync(fdo.id, "sync_current", f"/competitions/{code}/matches", 200, None, n, mr.meta.get("requests_available"))
    return {"season": label, "teams": teams, "fixtures": n, "results": results, "conflicts": conflicts}


STAT_KEYS = ("shots", "shots_on_target", "corners", "yellow", "red")


def sync_match_stats(repo: Repo, code: str, season_id: int, label: str, log) -> int:
    """Official shots, corners and cards for this season's finished matches (football-data.co.uk, updated a few times a week).
    Used to settle corner picks and to train the shots and corners ratings. Only changed values are written."""
    if code not in CORNER_DATA:
        return 0
    res = FootballDataUkAdapter().get_match_statistics(code, label)
    if not isinstance(res, Ok):
        log(f"  ! {code} statistics: {getattr(res, 'error', res)}")
        return 0
    fixtures = repo.all("""select f.id, f.kickoff_at, f.home_team_id, f.away_team_id, ah.alias as hc, aa.alias as ac from fixtures f
                           join team_aliases ah on ah.team_id = f.home_team_id and ah.source = 'canonical'
                           join team_aliases aa on aa.team_id = f.away_team_id and aa.source = 'canonical'
                           where f.season_id = %s and f.status in ('FT', 'AET', 'PEN')""", (season_id,))
    index = {(f["hc"], f["ac"], f["kickoff_at"].date()): f for f in fixtures}
    found: dict[int, dict] = {}
    for st in res.data:
        if st.key not in STAT_KEYS:
            continue
        h, a, d = canonical(st.home), canonical(st.away), st.kickoff.date()
        f = next((index[k] for k in ((h, a, d), (h, a, d - timedelta(days=1)), (h, a, d + timedelta(days=1))) if k in index), None)
        if f:
            team = f["home_team_id"] if st.side == "home" else f["away_team_id"]
            found.setdefault(f["id"], {})[(team, st.key)] = st.value
    if not found:
        return 0
    stored = {(r["fixture_id"], r["team_id"], r["stat_key"]): float(r["value"]) for r in repo.all(
        "select fixture_id, team_id, stat_key, value from match_statistics where definition_source = 'football-data-co-uk' and fixture_id = any(%s)",
        (list(found),))}
    rows = [(fid, team, key, v, "football-data-co-uk", "football-data-co-uk") for fid, vals in found.items() for (team, key), v in vals.items()
            if stored.get((fid, team, key)) != float(v)]
    repo.many("""insert into match_statistics (fixture_id, team_id, stat_key, value, definition_source, provider) values (%s, %s, %s, %s, %s, %s)
                 on conflict (fixture_id, team_id, stat_key, definition_source) do update set value = excluded.value""", rows)
    repo.log_sync("football-data-co-uk", "sync_current", f"/{code}/{label}", 200, None, len(rows))
    return len(found)


def sync_bundesliga_goals(repo: Repo, season_label_: str, log) -> int:
    """Real goal order for the Bundesliga (first-goal, goals-in-a-row, 1UP-type markets)."""
    comp_id = repo.competition_id("BL1")
    season = repo.one("select id from seasons where competition_id = %s and label = %s", (comp_id, season_label_))
    if not season:
        return 0
    res = OpenLigaDbAdapter().get_fixtures("BL1", season_label_)
    if not isinstance(res, Ok):
        log(f"  ! OpenLigaDB: {res.error}")
        return 0
    fixtures = repo.all("""select f.id, f.kickoff_at, f.home_team_id, f.away_team_id, ah.alias as home_c, aa.alias as away_c
                           from fixtures f join team_aliases ah on ah.team_id = f.home_team_id and ah.source = 'canonical'
                           join team_aliases aa on aa.team_id = f.away_team_id and aa.source = 'canonical' where f.season_id = %s""", (season["id"],))
    index = {}
    for f in fixtures:
        index[(f["home_c"], f["away_c"], f["kickoff_at"].date())] = f
    stored: dict[int, list] = {}
    for g in repo.all("""select fixture_id, minute, coalesce(stoppage, 0) as stoppage, team_id from goal_events
                         where source = 'openligadb' and fixture_id = any(%s) order by fixture_id, minute, coalesce(stoppage, 0), id""",
                      ([f["id"] for f in fixtures],)):
        stored.setdefault(g["fixture_id"], []).append((g["minute"], g["stoppage"], g["team_id"]))
    inventory, replace, inserts, maps = [], [], [], []
    for m in res.data:
        key = (canonical(m.home), canonical(m.away))
        f = next((index.get((*key, m.kickoff.date() + timedelta(days=d))) for d in (0, -1, 1) if index.get((*key, m.kickoff.date() + timedelta(days=d)))), None)
        if not f:
            continue
        consistent = m.ft is not None and len(m.goals) == sum(m.ft)
        inventory.append((f["id"], "goal_times", consistent, 1.0 if consistent else 0.0, "openligadb"))
        if not consistent:
            continue
        goals = [(g.minute, g.stoppage or 0, f["home_team_id"] if g.side == "home" else f["away_team_id"], g) for g in m.goals]
        if stored.get(f["id"]) != sorted((x[0], x[1], x[2]) for x in goals):
            replace.append((f["id"],))
            inserts += [(f["id"], g.minute, g.stoppage, team, g.own_goal, g.penalty) for _, _, team, g in goals]
        maps.append((f["id"], m.provider_id))
    repo.bulk_inventory(inventory)
    repo.many("delete from goal_events where fixture_id = %s and source = 'openligadb'", replace)
    repo.many("""insert into goal_events (fixture_id, minute, stoppage, team_id, own_goal, penalty, source) values (%s, %s, %s, %s, %s, %s, 'openligadb')""", inserts)
    repo.many("""insert into provider_mappings (entity_type, entity_id, provider_id, provider_entity_id) values ('fixture', %s, 'openligadb', %s)
                 on conflict do nothing""", maps)
    written = len(replace)
    repo.log_sync("openligadb", "sync_current", f"/getmatchdata/bl1/{season_label_[:4]}", 200, None, written)
    return written


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--competitions", nargs="+", default=COMPETITIONS)
    ap.add_argument("--skip-teams", action="store_true")
    args = ap.parse_args(argv)
    env.require("SUPABASE_DB_URL", "FOOTBALL_DATA_ORG_TOKEN")
    sys.stdout.reconfigure(encoding="utf-8")
    fdo = FootballDataOrgAdapter()
    repo = Repo(connect())
    status = "success"
    for code in args.competitions:
        try:
            with repo.tx():
                r = sync_competition(repo, fdo, code, args.skip_teams, print)
                if code == "BL1" and r.get("season"):
                    r["goal_sequences"] = sync_bundesliga_goals(repo, r["season"], print)
                if r.get("season"):
                    sid = repo.one("select s.id from seasons s join competitions c on c.id = s.competition_id where c.code = %s and s.label = %s", (code, r["season"]))
                    r["matches_with_stats"] = sync_match_stats(repo, code, sid["id"], r["season"], print) if sid else 0
            print(f"✓ {code}: {r}")
        except Exception as e:  # keep other competitions syncing; record the failure
            status = "warning"
            print(f"✗ {code}: {e}")
            with repo.tx():
                repo.log_sync(fdo.id, "sync_current", code, None, None, 0, error=str(e)[:500])
    with repo.tx():
        repo.job_finished("sync_current", status)


if __name__ == "__main__":
    main()
