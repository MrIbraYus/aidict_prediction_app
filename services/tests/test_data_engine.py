"""Data engine: normalisation, HTTP limits, every provider adapter (recorded payloads), merging and conflicts."""
import json
from datetime import datetime, timezone

import httpx
import pytest

from aidict_data.http import BudgetExceeded, DailyBudget, HttpClient, RateLimiter
from aidict_data.merge import merge
from aidict_data.normalise import canonical
from aidict_data.providers import ApiFootballAdapter, FootballDataOrgAdapter, FootballDataUkAdapter, OpenFootballAdapter, OpenLigaDbAdapter
from aidict_data.types import Failed, Fixture, Ok, Unsupported


def client(routes: dict[str, tuple[int, object]], base: str = "", **kw) -> HttpClient:
    def handler(req: httpx.Request):
        for frag, (status, body) in routes.items():
            if frag in str(req.url):
                content = body if isinstance(body, (bytes, str)) else json.dumps(body)
                return httpx.Response(status, content=content, headers={"X-RequestsAvailable": "9", "x-ratelimit-requests-remaining": "88"})
        return httpx.Response(404, content="not found")
    return HttpClient(base, transport=httpx.MockTransport(handler), retries=0, **kw)


# ───────────── Normalisation ─────────────
@pytest.mark.parametrize("a,b", [
    ("Manchester United FC", "Man United"), ("Wolverhampton Wanderers FC", "Wolves"), ("Brighton & Hove Albion FC", "Brighton"),
    ("AFC Bournemouth", "Bournemouth"), ("Nottingham Forest FC", "Nott'm Forest"), ("FC Bayern München", "Bayern Munich"),
    ("Bayer 04 Leverkusen", "Leverkusen"), ("Paris Saint-Germain FC", "Paris SG"), ("Athletic Club", "Ath Bilbao"),
    ("1. FC Heidenheim 1846", "Heidenheim"), ("1. FC Köln", "FC Koln"), ("SpVgg Greuther Fürth 1903", "Greuther Furth"),
    ("FC St. Pauli 1910", "St Pauli"), ("Hamburger SV", "Hamburg"), ("Hertha BSC", "Hertha"), ("VfL Bochum 1848", "Bochum"),
    ("1. FSV Mainz 05", "Mainz"), ("TSG 1899 Hoffenheim", "Hoffenheim"), ("FC Schalke 04", "Schalke 04"),
])
def test_team_names_match_across_providers(a, b):
    assert canonical(a) == canonical(b)


def test_unknown_names_are_cleaned_not_guessed():
    assert canonical("Real Oviedo") == "real oviedo"


# ───────────── HTTP limits ─────────────
def test_rate_limiter_waits_when_window_full():
    t = [0.0]
    slept = []
    lim = RateLimiter(2)
    now = lambda: t[0]
    def sleep(s):
        slept.append(s); t[0] += s
    lim.wait(now, sleep); lim.wait(now, sleep); lim.wait(now, sleep)
    assert slept and slept[0] == pytest.approx(60.05, abs=0.01)


def test_daily_budget_blocks_before_exceeding(tmp_path):
    b = DailyBudget("api-football", 2, tmp_path / "b.json")
    b.spend(); b.spend()
    with pytest.raises(BudgetExceeded):
        b.spend()


# ───────────── OpenFootball ─────────────
OF = {"name": "English Premier League 2025/26", "matches": [
    {"round": "Matchday 1", "date": "2025-08-15", "time": "20:00", "team1": "Liverpool FC", "team2": "AFC Bournemouth", "score": {"ht": [1, 0], "ft": [4, 2]}},
    {"round": "Matchday 1", "date": "2025-08-16", "time": "12:30 UTC+1", "team1": "Aston Villa FC", "team2": "Newcastle United FC", "score": {"ft": [0, 0]}},
    {"round": "Matchday 38", "date": "2026-05-24", "team1": "Arsenal FC", "team2": "Chelsea FC"},
    {"round": "Matchday 2", "date": "2025-08-17", "time": "14:00", "team1": "Chelsea FC", "team2": "Crystal Palace FC", "score": [0, 0]},
]}
OF_FULL = {"matches": [{"round": "1", "date": "2025-08-15", "time": "19:00 UTC+0", "team1": "Liverpool", "team2": "Bournemouth", "score": {"ft": [4, 2]},
                        "goals1": [{"name": "Ekitike", "minute": "37"}, {"name": "Salah", "minute": "90+4"}], "goals2": [{"name": "Semenyo", "minute": "64"}]}]}


def test_openfootball_parses_local_times_to_utc_and_statuses():
    a = OpenFootballAdapter(client({"2025-26/en.1.json": (200, OF)}))
    r = a.get_fixtures("PL", "2025-26")
    assert isinstance(r, Ok) and len(r.data) == 4
    f = r.data[0]
    assert f.kickoff == datetime(2025, 8, 15, 19, 0, tzinfo=timezone.utc)  # 20:00 BST → 19:00 UTC
    assert r.data[1].kickoff.hour == 11  # explicit UTC+1
    assert f.ft == (4, 2) and f.ht == (1, 0) and f.status == "FT"
    assert r.data[2].status == "SCHEDULED" and r.meta["estimated_kickoffs"] == 1
    assert len(a.get_results("PL", "2025-26").data) == 3
    assert r.data[3].ft == (0, 0) and r.data[3].ht == (0, 0)  # compact goalless-draw format


def test_openfootball_full_files_give_goal_order():
    a = OpenFootballAdapter(client({"en.1-full.json": (200, OF_FULL)}))
    goals = a.get_fixtures("PL", "2025-26", full=True).data[0].goals
    assert [(g.minute, g.side) for g in goals] == [(37, "home"), (64, "away"), (90, "home")]
    assert goals[-1].stoppage == 4


def test_openfootball_unknown_competition_is_unsupported():
    assert isinstance(OpenFootballAdapter(client({})).get_fixtures("CL", "2025-26"), Unsupported)
    assert isinstance(OpenFootballAdapter(client({})).get_standings("PL", "2025-26"), Unsupported)


# ───────────── football-data.co.uk ─────────────
CSV = ("Div,Date,Time,HomeTeam,AwayTeam,FTHG,FTAG,FTR,HTHG,HTAG,HS,AS,HST,AST,HC,AC,PSCH,PSCD,PSCA,PC>2.5,PC<2.5\n"
       "E0,15/08/2025,20:00,Liverpool,Bournemouth,4,2,H,1,0,19,10,10,3,6,7,1.30,6.20,9.50,1.62,2.40\n"
       "E0,16/08/2025,12:30,Aston Villa,Newcastle,0,0,D,0,0,3,16,1,4,,8,2.60,3.40,2.75,2.05,1.85\n")


def test_football_data_uk_results_stats_and_closing_odds():
    a = FootballDataUkAdapter(client({"2526/E0.csv": (200, CSV)}))
    fx = a.get_fixtures("PL", "2025-26").data
    assert fx[0].ft == (4, 2) and fx[0].kickoff.hour == 19
    stats = a.get_match_statistics("PL", "2025-26").data
    corners = [s for s in stats if s.key == "corners"]
    assert len(corners) == 3  # Villa's missing corner count stays missing — never zero-filled
    odds = a.get_odds("PL", "2025-26").data
    assert {(o.market, o.selection) for o in odds if o.home == "Liverpool"} == {("1x2", "H"), ("1x2", "D"), ("1x2", "A"), ("ou25", "over"), ("ou25", "under")}
    assert all(o.closing and o.bookmaker == "pinnacle" for o in odds)


# ───────────── football-data.org ─────────────
FDO_MATCH = {"matches": [{"id": 538001, "utcDate": "2026-11-28T17:30:00Z", "status": "FINISHED", "matchday": 13, "season": {"startDate": "2026-08-15"},
                          "homeTeam": {"name": "Arsenal FC"}, "awayTeam": {"name": "Chelsea FC"}, "lastUpdated": "2026-11-28T19:40:00Z",
                          "score": {"fullTime": {"home": 2, "away": 1}, "halfTime": {"home": 1, "away": 0}}},
                         {"id": 538002, "utcDate": "2026-11-29T16:30:00Z", "status": "TIMED", "matchday": 13, "season": {"startDate": "2026-08-15"},
                          "homeTeam": {"name": "Liverpool FC"}, "awayTeam": {"name": "Manchester City FC"}, "score": {"fullTime": {"home": None, "away": None}, "halfTime": {}}}]}


def test_football_data_org_requires_token_and_maps_statuses():
    assert isinstance(FootballDataOrgAdapter(token="", http=client({}, base="https://api.football-data.org/v4")).get_fixtures("PL", "2026-27"), Failed)
    a = FootballDataOrgAdapter(token="t", http=client({"/competitions/PL/matches": (200, FDO_MATCH)}, base="https://api.football-data.org/v4"))
    r = a.get_fixtures("PL", "2026-27")
    assert isinstance(r, Ok) and r.meta["requests_available"] == "9"
    done, upcoming = r.data
    assert done.status == "FT" and done.ft == (2, 1) and done.season == "2026-27" and done.provider_id == "538001"
    assert upcoming.status == "TIMED" and upcoming.ft is None
    assert isinstance(a.get_fixtures("BL2", "2026-27"), Unsupported)  # not on the free plan


# ───────────── OpenLigaDB ─────────────
OLDB = [{"matchID": 72214, "matchDateTimeUTC": "2024-08-23T18:30:00Z", "leagueSeason": 2024, "matchIsFinished": True, "lastUpdateDateTime": "2024-08-24T11:29:10.647",
         "team1": {"teamName": "Borussia Mönchengladbach"}, "team2": {"teamName": "Bayer 04 Leverkusen"}, "group": {"groupName": "1. Spieltag"},
         "matchResults": [{"resultTypeID": 1, "pointsTeam1": 0, "pointsTeam2": 2}, {"resultTypeID": 2, "pointsTeam1": 2, "pointsTeam2": 3}],
         "goals": [{"goalID": 1, "scoreTeam1": 0, "scoreTeam2": 1, "matchMinute": 12}, {"goalID": 2, "scoreTeam1": 0, "scoreTeam2": 2, "matchMinute": 37},
                   {"goalID": 3, "scoreTeam1": 1, "scoreTeam2": 2, "matchMinute": 85, "isOwnGoal": True}, {"goalID": 4, "scoreTeam1": 2, "scoreTeam2": 2, "matchMinute": 88},
                   {"goalID": 5, "scoreTeam1": 2, "scoreTeam2": 3, "matchMinute": 90, "isPenalty": True}]}]


def test_openligadb_goal_order_from_running_score():
    a = OpenLigaDbAdapter(client({"/getmatchdata/bl1/2024": (200, OLDB)}, base="https://api.openligadb.de"))
    f = a.get_fixtures("BL1", "2024-25").data[0]
    assert f.ft == (2, 3) and f.ht == (0, 2) and f.status == "FT"
    assert [g.side for g in f.goals] == ["away", "away", "home", "home", "away"]
    assert f.goals[2].own_goal and f.goals[4].penalty
    assert isinstance(a.get_fixtures("PL", "2024-25"), Unsupported)


# ───────────── API-Football ─────────────
def test_api_football_budget_and_events():
    events = {"errors": [], "response": [
        {"time": {"elapsed": 23, "extra": None}, "team": {"id": 42}, "player": {"name": "Saka"}, "type": "Goal", "detail": "Normal Goal"},
        {"time": {"elapsed": 51, "extra": None}, "team": {"id": 42}, "player": {"name": "Gabriel"}, "type": "Goal", "detail": "Own Goal"},
        {"time": {"elapsed": 70, "extra": None}, "team": {"id": 49}, "player": {"name": "Palmer"}, "type": "Goal", "detail": "Missed Penalty"}]}
    a = ApiFootballAdapter(key="k", http=client({"/fixtures/events": (200, events)}, base="https://v3.football.api-sports.io"))
    r = a.get_events("1", home_team_id=42)
    assert isinstance(r, Ok) and r.meta["daily_remaining"] == "88"
    assert [(g.minute, g.side, g.own_goal) for g in r.data] == [(23, "home", False), (51, "away", True)]
    assert isinstance(ApiFootballAdapter(key="", http=client({}, base="https://v3.football.api-sports.io")).get_fixtures("PL", "2026-27"), Failed)


# ───────────── Merging & conflicts ─────────────
def _fx(provider, home, away, ft, hour=17, status="FT"):
    return Fixture(provider=provider, competition="PL", season="2026-27", kickoff=datetime(2026, 11, 28, hour, 30, tzinfo=timezone.utc),
                   home=home, away=away, status=status, ft=ft)


def test_merge_deduplicates_across_providers_and_flags_conflicts():
    merged, conflicts = merge({
        "football-data-org": [_fx("football-data-org", "Arsenal FC", "Chelsea FC", (2, 1)), _fx("football-data-org", "AS Roma", "Lecce", (2, 1))],
        "openfootball": [_fx("openfootball", "Arsenal", "Chelsea", (2, 1), hour=18), _fx("openfootball", "Roma", "Lecce", (2, 2))],
    })
    arsenal = next(m for m in merged if canonical(m.primary.home) == "arsenal")
    assert len(merged) == 2  # "AS Roma" and "Roma" are the same club
    assert set(arsenal.sources) == {"football-data-org", "openfootball"} and arsenal.confirmed_by == ["football-data-org", "openfootball"]
    assert arsenal.primary.provider == "football-data-org"  # higher reliability wins
    assert len(conflicts) == 1 and conflicts[0].values == {"football-data-org": [2, 1], "openfootball": [2, 2]}


def test_merge_conflicting_scores_are_reported_not_overwritten():
    merged, conflicts = merge({
        "football-data-org": [_fx("football-data-org", "Arsenal", "Chelsea", (2, 1))],
        "openfootball": [_fx("openfootball", "Arsenal FC", "Chelsea FC", (2, 2))],
    })
    assert len(merged) == 1 and len(conflicts) == 1
    assert conflicts[0].values == {"football-data-org": [2, 1], "openfootball": [2, 2]}


@pytest.mark.live
def test_live_openfootball_and_openligadb():
    r = OpenFootballAdapter().get_results("PL", "2024-25")
    assert isinstance(r, Ok) and len(r.data) == 480
    o = OpenLigaDbAdapter().get_fixtures("BL1", "2024-25")
    assert isinstance(o, Ok) and len(o.data) == 306 and sum(len(f.goals) for f in o.data) > 800
