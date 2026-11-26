"""OpenFootball (football.json) — CC0 historical results. Current-season files are stale (see research doc), so this
adapter is used for HISTORY ONLY. No IDs, no statistics, no odds; '-full' files add goal minutes and line-ups."""
from __future__ import annotations

import re
from datetime import datetime, time, timezone
from zoneinfo import ZoneInfo

from ..http import HttpClient
from ..types import Fixture, Failed, GoalEvent, Ok, ProviderResult
from .base import ProviderAdapter

BASE = "https://raw.githubusercontent.com/openfootball/football.json/master"
LEAGUE_FILES = {"PL": "en.1", "ELC": "en.2", "BL1": "de.1", "BL2": "de.2", "PD": "es.1", "SA": "it.1", "FL1": "fr.1", "DED": "nl.1", "PPL": "pt.1"}
LOCAL_TZ = {"PL": "Europe/London", "ELC": "Europe/London", "BL1": "Europe/Berlin", "BL2": "Europe/Berlin", "PD": "Europe/Madrid",
            "SA": "Europe/Rome", "FL1": "Europe/Paris", "DED": "Europe/Amsterdam", "PPL": "Europe/Lisbon"}
SEASONS = [f"{y}-{str(y + 1)[2:]}" for y in range(2010, 2027)]
_TIME = re.compile(r"^(\d{1,2}):(\d{2})(?:\s*UTC([+-]\d{1,2}))?")
_MINUTE = re.compile(r"^(\d+)(?:\+(\d+))?")


def parse_kickoff(date_s: str, time_s: str | None, competition: str) -> tuple[datetime, bool]:
    """Returns (UTC kickoff, estimated). Times are local unless an explicit UTC offset is given."""
    d = datetime.strptime(date_s, "%Y-%m-%d").date()
    m = _TIME.match(time_s or "")
    if not m:
        # No kick-off time published: mark as estimated (15:00 local) — never used for time-sensitive logic.
        local = datetime.combine(d, time(15, 0), ZoneInfo(LOCAL_TZ.get(competition, "UTC")))
        return local.astimezone(timezone.utc), True
    hh, mm, off = int(m.group(1)), int(m.group(2)), m.group(3)
    if off is not None:
        from datetime import timedelta
        return datetime.combine(d, time(hh, mm), timezone(timedelta(hours=int(off)))).astimezone(timezone.utc), False
    return datetime.combine(d, time(hh, mm), ZoneInfo(LOCAL_TZ.get(competition, "UTC"))).astimezone(timezone.utc), False


def parse_goals(raw: list | None, side: str) -> list[GoalEvent]:
    out = []
    for g in raw or []:
        m = _MINUTE.match(str(g.get("minute", "")))
        if not m:
            continue
        out.append(GoalEvent(minute=int(m.group(1)), stoppage=int(m.group(2)) if m.group(2) else None, side=side,  # type: ignore[arg-type]
                             scorer=g.get("name"), own_goal=bool(g.get("owngoal")), penalty=bool(g.get("penalty"))))
    return out


class OpenFootballAdapter(ProviderAdapter):
    id = "openfootball"

    def __init__(self, http: HttpClient | None = None):
        self.http = http or HttpClient(BASE, cache=True)

    def get_seasons(self, competition: str):
        return Ok(SEASONS, {"note": "Static list of published folders; current season is stale upstream"})

    def get_fixtures(self, competition: str, season: str, full: bool = False) -> ProviderResult[list[Fixture]]:
        code = LEAGUE_FILES.get(competition)
        if not code:
            return self._unsupported(f"competition {competition}")
        r = self.http.get(f"{BASE}/{season}/{code}{'-full' if full else ''}.json")
        if r.status_code == 404:
            return Failed(f"No OpenFootball file for {competition} {season}{' (full)' if full else ''}", 404)
        if r.status_code != 200:
            return Failed(f"HTTP {r.status_code}", r.status_code, retryable=r.status_code >= 500)
        payload = r.json()
        out: list[Fixture] = []
        estimated = 0
        for m in payload.get("matches", []):
            ko, est = parse_kickoff(m["date"], m.get("time"), competition)
            estimated += est
            score = m.get("score") or {}
            if isinstance(score, list):  # compact form used for goalless draws, e.g. "score": [0, 0]
                score = {"ft": score, "ht": [0, 0] if list(score) == [0, 0] else None}
            ft = tuple(score["ft"]) if score.get("ft") else None
            ht = tuple(score["ht"]) if score.get("ht") else None
            goals = parse_goals(m.get("goals1"), "home") + parse_goals(m.get("goals2"), "away")
            goals.sort(key=lambda g: (g.minute, g.stoppage or 0))
            out.append(Fixture(provider=self.id, competition=competition, season=season, kickoff=ko, home=m["team1"], away=m["team2"],
                               status="FT" if ft else "SCHEDULED", round=m.get("round"), venue=m.get("ground"),
                               ft=ft, ht=ht, goals=goals))  # type: ignore[arg-type]
        return Ok(out, {"source": f"{season}/{code}{'-full' if full else ''}.json", "estimated_kickoffs": estimated, "cache": r.headers.get("x-aidict-cache", "miss")})
