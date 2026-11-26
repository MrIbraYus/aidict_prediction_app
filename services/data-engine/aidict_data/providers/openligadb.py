"""OpenLigaDB — German leagues, no key, 60 requests/minute. Community-entered; goal minutes give scoring order.
Attribution required: "Daten von OpenLigaDB (www.openligadb.de), lizenziert unter ODbL 1.0"."""
from __future__ import annotations

from datetime import datetime, timezone

from ..http import HttpClient, RateLimiter
from ..types import Failed, Fixture, GoalEvent, Ok, ProviderResult, StandingRow
from .base import ProviderAdapter

BASE = "https://api.openligadb.de"
SHORTCUTS = {"BL1": "bl1", "BL2": "bl2", "BL3": "bl3", "DFB": "dfb"}
ATTRIBUTION = "Daten von OpenLigaDB (www.openligadb.de), lizenziert unter ODbL 1.0"


def _utc(s: str) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00")).astimezone(timezone.utc)


def parse_goals(match: dict) -> list[GoalEvent]:
    """Goal side is derived from which running score increased (own goals are credited correctly that way)."""
    out: list[GoalEvent] = []
    prev = (0, 0)
    for g in sorted(match.get("goals") or [], key=lambda x: (x.get("matchMinute") or 0, x.get("goalID") or 0)):
        cur = (g.get("scoreTeam1") or 0, g.get("scoreTeam2") or 0)
        if cur[0] > prev[0]:
            side = "home"
        elif cur[1] > prev[1]:
            side = "away"
        else:
            continue  # inconsistent community entry — skip rather than guess
        minute = g.get("matchMinute")
        if minute is None:
            continue
        out.append(GoalEvent(minute=int(minute), side=side, scorer=g.get("goalGetterName"), own_goal=bool(g.get("isOwnGoal")),  # type: ignore[arg-type]
                             penalty=bool(g.get("isPenalty"))))
        prev = cur
    return out


class OpenLigaDbAdapter(ProviderAdapter):
    id = "openligadb"

    def __init__(self, http: HttpClient | None = None, now=lambda: datetime.now(timezone.utc)):
        self.http = http or HttpClient(BASE, limiter=RateLimiter(60))
        self.now = now

    def _get(self, path: str) -> ProviderResult:
        r = self.http.get(path)
        if r.status_code != 200:
            return Failed(f"HTTP {r.status_code}", r.status_code, retryable=r.status_code >= 500)
        return Ok(r.json())

    def parse_match(self, m: dict, competition: str) -> Fixture:
        results = {r.get("resultTypeID"): (r.get("pointsTeam1"), r.get("pointsTeam2")) for r in m.get("matchResults") or []}
        ko = _utc(m["matchDateTimeUTC"])
        finished = bool(m.get("matchIsFinished"))
        status = "FT" if finished else ("LIVE" if ko <= self.now() else "SCHEDULED")
        goals = parse_goals(m)
        ft = results.get(2)
        if not finished and goals:
            ft = (sum(g.side == "home" for g in goals), sum(g.side == "away" for g in goals))
        season_start = int(m.get("leagueSeason") or ko.year)
        return Fixture(provider=self.id, competition=competition, season=f"{season_start}-{str(season_start + 1)[2:]}", kickoff=ko,
                       home=m["team1"]["teamName"], away=m["team2"]["teamName"], status=status, provider_id=str(m["matchID"]),  # type: ignore[arg-type]
                       round=(m.get("group") or {}).get("groupName"), venue=(m.get("location") or {}).get("locationStadium"),
                       ft=ft, ht=results.get(1), goals=goals,
                       last_updated=datetime.fromisoformat(m["lastUpdateDateTime"]).replace(tzinfo=timezone.utc) if m.get("lastUpdateDateTime") else None)

    def get_fixtures(self, competition: str, season: str):
        sc = SHORTCUTS.get(competition)
        if not sc:
            return self._unsupported(f"competition {competition}")
        res = self._get(f"/getmatchdata/{sc}/{season[:4]}")
        if not isinstance(res, Ok):
            return res
        return Ok([self.parse_match(m, competition) for m in res.data], {"attribution": ATTRIBUTION})

    def get_standings(self, competition: str, season: str):
        sc = SHORTCUTS.get(competition)
        if not sc:
            return self._unsupported(f"competition {competition}")
        res = self._get(f"/getbltable/{sc}/{season[:4]}")
        if not isinstance(res, Ok):
            return res
        rows = [StandingRow(i + 1, t["teamName"], t["matches"], t["won"], t["draw"], t["lost"], t["goals"], t["opponentGoals"], t["points"]) for i, t in enumerate(res.data)]
        return Ok(rows, {"attribution": ATTRIBUTION})

    def last_change(self, competition: str, season: str, group: int) -> ProviderResult[str]:
        """Cheap poll: re-fetch a matchday only when this timestamp changes (requested by OpenLigaDB)."""
        res = self._get(f"/getlastchangedate/{SHORTCUTS[competition]}/{season[:4]}/{group}")
        return Ok(str(res.data)) if isinstance(res, Ok) else res

    def get_live_matches(self):
        live: list[Fixture] = []
        for comp, sc in SHORTCUTS.items():
            res = self._get(f"/getmatchdata/{sc}")
            if isinstance(res, Ok):
                live += [f for f in (self.parse_match(m, comp) for m in res.data) if f.status == "LIVE"]
        return Ok(live, {"attribution": ATTRIBUTION, "note": "Community-entered, near real time"})
