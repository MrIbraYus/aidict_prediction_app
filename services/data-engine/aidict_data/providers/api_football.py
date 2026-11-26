"""API-Football v3 (free plan, budget-capped). Used only for featured/saved matches: statistics, line-ups, goal events.
Endpoint shapes follow the public v3 documentation; free-plan season limits are UNVERIFIED until a key is added
(the adapter records the quota headers of the first call)."""
from __future__ import annotations

import os
from datetime import datetime

from ..http import BudgetExceeded, DailyBudget, HttpClient
from ..types import Failed, Fixture, GoalEvent, Ok, ProviderResult
from .base import INTERNAL_STATUS, ProviderAdapter

BASE = "https://v3.football.api-sports.io"
LEAGUE_IDS = {"PL": 39, "ELC": 40, "PD": 140, "BL1": 78, "SA": 135, "FL1": 61, "DED": 88, "PPL": 94, "CL": 2}


class ApiFootballAdapter(ProviderAdapter):
    id = "api-football"

    def __init__(self, key: str | None = None, http: HttpClient | None = None, daily_budget: int | None = None):
        self.key = key or os.environ.get("API_FOOTBALL_KEY")
        budget = DailyBudget(self.id, daily_budget or int(os.environ.get("API_FOOTBALL_DAILY_BUDGET", "90")))
        self.http = http or HttpClient(BASE, headers={"x-apisports-key": self.key or ""}, budget=budget)

    def _get(self, path: str, params: dict) -> ProviderResult[dict]:
        if not self.key:
            return Failed("API_FOOTBALL_KEY is not configured")
        try:
            r = self.http.get(path, params=params)
        except BudgetExceeded as e:
            return Failed(str(e), retryable=False)
        meta = {"daily_remaining": r.headers.get("x-ratelimit-requests-remaining"), "minute_remaining": r.headers.get("X-RateLimit-Remaining")}
        if r.status_code != 200:
            return Failed(f"HTTP {r.status_code}", r.status_code, retryable=r.status_code >= 500)
        body = r.json()
        if body.get("errors"):
            return Failed(f"API error: {body['errors']}")
        return Ok(body, meta)

    def get_fixtures(self, competition: str, season: str, date: str | None = None):
        lid = LEAGUE_IDS.get(competition)
        if not lid:
            return self._unsupported(f"competition {competition}")
        params: dict = {"league": lid, "season": season[:4]}
        if date:
            params["date"] = date
        res = self._get("/fixtures", params)
        if not isinstance(res, Ok):
            return res
        out = []
        for item in res.data.get("response", []):
            f, t, g, s = item["fixture"], item["teams"], item["goals"], item.get("score") or {}
            status = INTERNAL_STATUS.get((f.get("status") or {}).get("short", ""), "SCHEDULED")
            ht = s.get("halftime") or {}
            out.append(Fixture(provider=self.id, competition=competition, season=season, kickoff=datetime.fromisoformat(f["date"]),
                               home=t["home"]["name"], away=t["away"]["name"], status=status, provider_id=str(f["id"]),  # type: ignore[arg-type]
                               round=(item.get("league") or {}).get("round"), venue=(f.get("venue") or {}).get("name"),
                               ft=(g["home"], g["away"]) if g.get("home") is not None else None,
                               ht=(ht["home"], ht["away"]) if ht.get("home") is not None else None,
                               minute=(f.get("status") or {}).get("elapsed")))
        return Ok(out, res.meta)

    def get_events(self, fixture_id: str, home_team_id: int) -> ProviderResult[list[GoalEvent]]:
        """Goal events for one fixture (1 call). `home_team_id` is the provider team id of the home side."""
        res = self._get("/fixtures/events", {"fixture": fixture_id, "type": "Goal"})
        if not isinstance(res, Ok):
            return res
        goals = []
        for e in res.data.get("response", []):
            if e.get("type") != "Goal" or e.get("detail") == "Missed Penalty":
                continue
            own = e.get("detail") == "Own Goal"
            scoring_team_home = (e["team"]["id"] == home_team_id) != own  # own goal credits the opponent
            goals.append(GoalEvent(minute=e["time"]["elapsed"], stoppage=e["time"].get("extra"), side="home" if scoring_team_home else "away",
                                   scorer=(e.get("player") or {}).get("name"), own_goal=own, penalty=e.get("detail") == "Penalty"))
        return Ok(goals, res.meta)

    def get_lineups(self, fixture_id: str) -> ProviderResult[list[dict]]:
        res = self._get("/fixtures/lineups", {"fixture": fixture_id})
        return Ok(res.data.get("response", []), res.meta) if isinstance(res, Ok) else res

    def get_fixture_statistics(self, fixture_id: str) -> ProviderResult[list[dict]]:
        res = self._get("/fixtures/statistics", {"fixture": fixture_id})
        return Ok(res.data.get("response", []), res.meta) if isinstance(res, Ok) else res
