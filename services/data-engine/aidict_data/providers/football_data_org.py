"""football-data.org v4 (free tier): current fixtures, delayed results, standings, team crests for 12 competitions.
10 requests/minute. No line-ups, statistics or odds on the free plan."""
from __future__ import annotations

import os
from datetime import datetime

from ..http import HttpClient, RateLimiter
from ..types import Competition, Failed, Fixture, Ok, ProviderResult, StandingRow, Team
from .base import INTERNAL_STATUS, ProviderAdapter

BASE = "https://api.football-data.org/v4"
FREE_COMPETITIONS = ["CL", "PL", "ELC", "BL1", "SA", "PD", "FL1", "DED", "PPL", "BSA", "WC", "EC"]


def _season_year(season: str) -> str:
    return season[:4]


def _season_label(start_date: str | None) -> str:
    if not start_date:
        return ""
    y = int(start_date[:4])
    return f"{y}-{str(y + 1)[2:]}"


class FootballDataOrgAdapter(ProviderAdapter):
    id = "football-data-org"

    def __init__(self, token: str | None = None, http: HttpClient | None = None):
        self.token = token or os.environ.get("FOOTBALL_DATA_ORG_TOKEN")
        self.http = http or HttpClient(BASE, headers={"X-Auth-Token": self.token or ""}, limiter=RateLimiter(10))

    def _get(self, path: str, params: dict | None = None) -> ProviderResult[dict]:
        if not self.token:
            return Failed("FOOTBALL_DATA_ORG_TOKEN is not configured")
        r = self.http.get(path, params=params)
        meta = {"requests_available": r.headers.get("X-RequestsAvailable"), "reset_seconds": r.headers.get("X-RequestCounter-Reset")}
        if r.status_code == 403:
            return Failed("Not available on the free plan (403)", 403)
        if r.status_code != 200:
            return Failed(f"HTTP {r.status_code}: {r.text[:120]}", r.status_code, retryable=r.status_code >= 500 or r.status_code == 429)
        return Ok(r.json(), meta)

    def get_competitions(self):
        res = self._get("/competitions")
        if not isinstance(res, Ok):
            return res
        comps = [Competition(self.id, str(c["id"]), c["name"], c.get("code"), (c.get("area") or {}).get("name"), (c.get("type") or "league").lower())
                 for c in res.data.get("competitions", []) if c.get("code") in FREE_COMPETITIONS]
        return Ok(comps, res.meta)

    @staticmethod
    def parse_match(m: dict, competition: str) -> Fixture:
        score = m.get("score") or {}
        ft = score.get("fullTime") or {}
        ht = score.get("halfTime") or {}
        status = INTERNAL_STATUS.get(m.get("status", ""), "SCHEDULED")
        return Fixture(
            provider="football-data-org", competition=competition, season=_season_label((m.get("season") or {}).get("startDate")),
            kickoff=datetime.fromisoformat(m["utcDate"].replace("Z", "+00:00")), home=m["homeTeam"]["name"], away=m["awayTeam"]["name"],
            status=status, provider_id=str(m["id"]), round=f"Matchday {m['matchday']}" if m.get("matchday") else m.get("stage"),
            ft=(ft["home"], ft["away"]) if ft.get("home") is not None and status in ("FT", "AET", "PEN", "LIVE", "HT") else None,
            ht=(ht["home"], ht["away"]) if ht.get("home") is not None else None,
            last_updated=datetime.fromisoformat(m["lastUpdated"].replace("Z", "+00:00")) if m.get("lastUpdated") else None,
        )

    def get_fixtures(self, competition: str, season: str, date_from: str | None = None, date_to: str | None = None):
        if competition not in FREE_COMPETITIONS:
            return self._unsupported(f"{competition} on the free plan")
        params = {"season": _season_year(season)}
        if date_from and date_to:
            params = {"dateFrom": date_from, "dateTo": date_to}
        res = self._get(f"/competitions/{competition}/matches", params)
        if not isinstance(res, Ok):
            return res
        return Ok([self.parse_match(m, competition) for m in res.data.get("matches", [])], res.meta)

    def get_standings(self, competition: str, season: str):
        res = self._get(f"/competitions/{competition}/standings", {"season": _season_year(season)})
        if not isinstance(res, Ok):
            return res
        total = next((s for s in res.data.get("standings", []) if s.get("type") == "TOTAL"), None)
        rows = [StandingRow(r["position"], r["team"]["name"], r["playedGames"], r["won"], r["draw"], r["lost"], r["goalsFor"], r["goalsAgainst"], r["points"])
                for r in (total or {}).get("table", [])]
        return Ok(rows, res.meta)

    def get_teams(self, competition: str, season: str):
        res = self._get(f"/competitions/{competition}/teams", {"season": _season_year(season)})
        if not isinstance(res, Ok):
            return res
        teams = [Team(self.id, t["name"], str(t["id"]), t.get("shortName"), t.get("tla"), t.get("crest")) for t in res.data.get("teams", [])]
        return Ok(teams, res.meta)

    def get_live_matches(self):
        res = self._get("/matches", {"status": "LIVE"})
        if not isinstance(res, Ok):
            return res
        out = [self.parse_match(m, (m.get("competition") or {}).get("code", "")) for m in res.data.get("matches", [])]
        return Ok(out, {**res.meta, "note": "Free tier scores are delayed"})
