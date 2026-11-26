"""football-data.co.uk CSVs — historical results, match statistics (shots, corners, cards) and closing odds.
Terms: private individuals only (AIDICT personal phase). Times in the files are UK local time."""
from __future__ import annotations

import csv
import io
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from ..http import HttpClient
from ..types import Failed, Fixture, MatchStat, OddsQuote, Ok, ProviderResult
from .base import ProviderAdapter

BASE = "https://www.football-data.co.uk/mmz4281"
DIVISIONS = {"PL": "E0", "ELC": "E1", "BL1": "D1", "BL2": "D2", "PD": "SP1", "SA": "I1", "FL1": "F1", "DED": "N1", "PPL": "P1"}
UK = ZoneInfo("Europe/London")
STAT_COLUMNS = {"shots": ("HS", "AS"), "shots_on_target": ("HST", "AST"), "corners": ("HC", "AC"), "fouls": ("HF", "AF"), "yellow": ("HY", "AY"), "red": ("HR", "AR")}
# Preferred closing 1X2 benchmark: Pinnacle closing → market average closing → Bet365 closing.
CLOSING_1X2 = [("PSCH", "PSCD", "PSCA", "pinnacle"), ("AvgCH", "AvgCD", "AvgCA", "market-average"), ("B365CH", "B365CD", "B365CA", "bet365")]
CLOSING_OU = [("PC>2.5", "PC<2.5", "pinnacle"), ("AvgC>2.5", "AvgC<2.5", "market-average"), ("B365C>2.5", "B365C<2.5", "bet365")]


def season_code(season: str) -> str:
    start = int(season[:4])
    return f"{start % 100:02d}{(start + 1) % 100:02d}"


def _num(row: dict, key: str) -> float | None:
    v = (row.get(key) or "").strip()
    try:
        return float(v) if v else None
    except ValueError:
        return None


def _kickoff(row: dict) -> datetime:
    date_s = row["Date"].strip()
    fmt = "%d/%m/%Y" if len(date_s.split("/")[-1]) == 4 else "%d/%m/%y"
    d = datetime.strptime(date_s, fmt)
    t = (row.get("Time") or "15:00").strip() or "15:00"
    hh, mm = (int(x) for x in t.split(":")[:2])
    return d.replace(hour=hh, minute=mm, tzinfo=UK).astimezone(timezone.utc)


class FootballDataUkAdapter(ProviderAdapter):
    id = "football-data-co-uk"

    def __init__(self, http: HttpClient | None = None):
        self.http = http or HttpClient(cache=True)
        self._rows: dict[tuple[str, str], list[dict]] = {}

    def _load(self, competition: str, season: str) -> ProviderResult[list[dict]]:
        key = (competition, season)
        if key in self._rows:
            return Ok(self._rows[key])
        div = DIVISIONS.get(competition)
        if not div:
            return self._unsupported(f"competition {competition}")
        r = self.http.get(f"{BASE}/{season_code(season)}/{div}.csv")
        if r.status_code != 200:
            return Failed(f"HTTP {r.status_code} for {competition} {season}", r.status_code, retryable=r.status_code >= 500)
        text = r.content.decode("utf-8-sig", errors="replace")
        rows = [row for row in csv.DictReader(io.StringIO(text)) if row.get("HomeTeam") and row.get("Date")]
        self._rows[key] = rows
        return Ok(rows)

    def get_fixtures(self, competition: str, season: str) -> ProviderResult[list[Fixture]]:
        res = self._load(competition, season)
        if not isinstance(res, Ok):
            return res
        out = []
        for row in res.data:
            fh, fa = _num(row, "FTHG"), _num(row, "FTAG")
            hh, ha = _num(row, "HTHG"), _num(row, "HTAG")
            out.append(Fixture(provider=self.id, competition=competition, season=season, kickoff=_kickoff(row), home=row["HomeTeam"].strip(),
                               away=row["AwayTeam"].strip(), status="FT" if fh is not None else "SCHEDULED",
                               ft=(int(fh), int(fa)) if fh is not None and fa is not None else None,
                               ht=(int(hh), int(ha)) if hh is not None and ha is not None else None))
        return Ok(out, {"rows": len(out)})

    def get_match_statistics(self, competition: str, season: str) -> ProviderResult[list[MatchStat]]:
        res = self._load(competition, season)
        if not isinstance(res, Ok):
            return res
        stats = []
        for row in res.data:
            ko = _kickoff(row)
            for key, (hk, ak) in STAT_COLUMNS.items():
                for side, col in (("home", hk), ("away", ak)):
                    v = _num(row, col)
                    if v is not None:  # missing stays missing — never zero-filled
                        stats.append(MatchStat(row["HomeTeam"].strip(), row["AwayTeam"].strip(), ko, side, key, v, self.id))  # type: ignore[arg-type]
        return Ok(stats)

    def get_odds(self, competition: str, season: str) -> ProviderResult[list[OddsQuote]]:
        res = self._load(competition, season)
        if not isinstance(res, Ok):
            return res
        quotes = []
        for row in res.data:
            ko, home, away = _kickoff(row), row["HomeTeam"].strip(), row["AwayTeam"].strip()
            for h, d, a, book in CLOSING_1X2:
                vals = [_num(row, h), _num(row, d), _num(row, a)]
                if all(v and v > 1 for v in vals):
                    quotes += [OddsQuote(home, away, ko, "1x2", sel, v, book, True) for sel, v in zip("HDA", vals)]  # type: ignore[misc]
                    break
            for o, u, book in CLOSING_OU:
                vo, vu = _num(row, o), _num(row, u)
                if vo and vu and vo > 1 and vu > 1:
                    quotes += [OddsQuote(home, away, ko, "ou25", "over", vo, book, True), OddsQuote(home, away, ko, "ou25", "under", vu, book, True)]
                    break
        return Ok(quotes)
