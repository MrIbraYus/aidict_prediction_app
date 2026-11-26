"""Cross-provider fixture merging: one real-world match → one record, conflicts surfaced, nothing silently overwritten."""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import timedelta

from .normalise import canonical
from .types import Fixture

RELIABILITY = {"football-data-org": 0.95, "api-football": 0.9, "openligadb": 0.85, "football-data-co-uk": 0.85, "openfootball": 0.8}
TOLERANCE = timedelta(hours=36)
FINAL = {"FT", "AET", "PEN", "AWARDED"}


@dataclass
class MergedFixture:
    primary: Fixture
    sources: dict[str, Fixture] = field(default_factory=dict)

    @property
    def confirmed_by(self) -> list[str]:
        if not self.primary.ft:
            return []
        return sorted(p for p, f in self.sources.items() if f.ft == self.primary.ft and f.status in FINAL)


@dataclass
class Conflict:
    home: str
    away: str
    kickoff: str
    field: str
    values: dict[str, object]


def _pick_primary(cands: dict[str, Fixture]) -> Fixture:
    # Prefer final records, then provider reliability, then most recently updated.
    return max(cands.values(), key=lambda f: (f.status in FINAL, RELIABILITY.get(f.provider, 0.5), f.last_updated.timestamp() if f.last_updated else 0))


def merge(sources: dict[str, list[Fixture]]) -> tuple[list[MergedFixture], list[Conflict]]:
    buckets: dict[tuple[str, str, str], list[list[Fixture]]] = defaultdict(list)
    for provider_fixtures in sources.values():
        for f in provider_fixtures:
            key = (f.competition, canonical(f.home), canonical(f.away))
            for group in buckets[key]:
                if abs(group[0].kickoff - f.kickoff) <= TOLERANCE and all(g.provider != f.provider for g in group):
                    group.append(f)
                    break
            else:
                buckets[key].append([f])
    merged: list[MergedFixture] = []
    conflicts: list[Conflict] = []
    for groups in buckets.values():
        for group in groups:
            by_provider = {f.provider: f for f in group}
            primary = _pick_primary(by_provider)
            merged.append(MergedFixture(primary, by_provider))
            finals = {p: f.ft for p, f in by_provider.items() if f.status in FINAL and f.ft}
            if len(set(finals.values())) > 1:
                conflicts.append(Conflict(primary.home, primary.away, primary.kickoff.isoformat(), "ft", {p: list(v) for p, v in finals.items()}))  # type: ignore[arg-type]
    merged.sort(key=lambda m: m.primary.kickoff)
    return merged, conflicts
