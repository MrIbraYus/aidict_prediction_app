"""Common adapter interface. Methods a provider cannot genuinely support return `Unsupported` — never fake data."""
from __future__ import annotations

from ..types import Competition, Fixture, MatchStat, OddsQuote, ProviderResult, StandingRow, Team, Unsupported

INTERNAL_STATUS = {
    # football-data.org
    "SCHEDULED": "SCHEDULED", "TIMED": "TIMED", "IN_PLAY": "LIVE", "PAUSED": "HT", "FINISHED": "FT",
    "POSTPONED": "POSTPONED", "SUSPENDED": "SUSPENDED", "CANCELLED": "CANCELLED", "AWARDED": "AWARDED",
    # API-Football short codes
    "TBD": "SCHEDULED", "NS": "SCHEDULED", "1H": "LIVE", "HT": "HT", "2H": "LIVE", "ET": "LIVE", "BT": "LIVE",
    "P": "LIVE", "LIVE": "LIVE", "FT": "FT", "AET": "AET", "PEN": "PEN", "PST": "POSTPONED", "SUSP": "SUSPENDED",
    "INT": "SUSPENDED", "CANC": "CANCELLED", "ABD": "CANCELLED", "AWD": "AWARDED", "WO": "AWARDED",
}


class ProviderAdapter:
    id: str = "base"

    def _unsupported(self, what: str) -> Unsupported:
        return Unsupported(f"{self.id} does not provide {what}")

    def get_competitions(self) -> ProviderResult[list[Competition]]:
        return self._unsupported("a competition list")

    def get_seasons(self, competition: str) -> ProviderResult[list[str]]:
        return self._unsupported("season lists")

    def get_fixtures(self, competition: str, season: str) -> ProviderResult[list[Fixture]]:
        return self._unsupported("fixtures")

    def get_fixture_by_id(self, provider_id: str) -> ProviderResult[Fixture]:
        return self._unsupported("single fixtures by id")

    def get_results(self, competition: str, season: str) -> ProviderResult[list[Fixture]]:
        r = self.get_fixtures(competition, season)
        if hasattr(r, "data"):
            r.data = [f for f in r.data if f.ft is not None and f.status in ("FT", "AET", "PEN", "AWARDED")]
        return r

    def get_standings(self, competition: str, season: str) -> ProviderResult[list[StandingRow]]:
        return self._unsupported("standings")

    def get_teams(self, competition: str, season: str) -> ProviderResult[list[Team]]:
        return self._unsupported("team lists")

    def get_team_statistics(self, competition: str, season: str) -> ProviderResult[list[MatchStat]]:
        return self._unsupported("team statistics")

    def get_match_statistics(self, competition: str, season: str) -> ProviderResult[list[MatchStat]]:
        return self._unsupported("match statistics")

    def get_live_matches(self) -> ProviderResult[list[Fixture]]:
        return self._unsupported("live scores")

    def get_odds(self, competition: str, season: str) -> ProviderResult[list[OddsQuote]]:
        return self._unsupported("odds")
