"""Provider-neutral records. Every adapter maps its payloads into these types."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Generic, Literal, TypeVar, Union

T = TypeVar("T")

FixtureStatus = Literal["SCHEDULED", "TIMED", "LIVE", "HT", "FT", "AET", "PEN", "POSTPONED", "SUSPENDED", "CANCELLED", "AWARDED"]


@dataclass(frozen=True)
class Competition:
    provider: str
    provider_id: str
    name: str
    code: str | None = None
    country: str | None = None
    type: str = "league"


@dataclass(frozen=True)
class Team:
    provider: str
    name: str
    provider_id: str | None = None
    short_name: str | None = None
    tla: str | None = None
    crest_url: str | None = None


@dataclass(frozen=True)
class GoalEvent:
    minute: int
    side: Literal["home", "away"]  # team credited with the goal (own goals count for the opponent)
    stoppage: int | None = None
    scorer: str | None = None
    own_goal: bool = False
    penalty: bool = False


@dataclass
class Fixture:
    provider: str
    competition: str  # internal competition code, e.g. 'PL'
    season: str  # '2025-26' or '2026'
    kickoff: datetime  # timezone-aware, UTC
    home: str
    away: str
    status: FixtureStatus
    provider_id: str | None = None
    round: str | None = None
    venue: str | None = None
    ft: tuple[int, int] | None = None
    ht: tuple[int, int] | None = None
    goals: list[GoalEvent] = field(default_factory=list)
    minute: int | None = None
    last_updated: datetime | None = None

    @property
    def outcome(self) -> Literal["H", "D", "A"] | None:
        if not self.ft:
            return None
        h, a = self.ft
        return "H" if h > a else "A" if a > h else "D"


@dataclass(frozen=True)
class StandingRow:
    position: int
    team: str
    played: int
    won: int
    drawn: int
    lost: int
    goals_for: int
    goals_against: int
    points: int


@dataclass(frozen=True)
class MatchStat:
    """One statistic for one team in one match. `definition_source` prevents mixing incompatible definitions."""

    home: str
    away: str
    kickoff: datetime
    side: Literal["home", "away"]
    key: str  # shots, shots_on_target, corners, fouls, yellow, red
    value: float
    definition_source: str


@dataclass(frozen=True)
class OddsQuote:
    home: str
    away: str
    kickoff: datetime
    market: str  # '1x2', 'ou25'
    selection: str  # 'H','D','A','over','under'
    decimal_odds: float
    bookmaker: str
    closing: bool


# ───────────── Result types: every adapter method returns exactly one of these ─────────────
@dataclass
class Ok(Generic[T]):
    data: T
    meta: dict = field(default_factory=dict)


@dataclass
class Unsupported:
    reason: str


@dataclass
class Failed:
    error: str
    status: int | None = None
    retryable: bool = False


ProviderResult = Union[Ok[T], Unsupported, Failed]
