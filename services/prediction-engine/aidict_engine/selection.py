"""Smart Market selection: the strongest 4–5 predictions per match (documentation/PREDICTION_ENGINE.md §5).

Eligibility → score (45% probability, 30% reliability, 25% evidence over a typical match) → one outcome per market →
drop outcomes correlated φ > 0.5 with a higher-ranked pick (exact joint probability from the score matrix) → max 5.
If fewer than 4 qualify, the shortfall is explained instead of padding with weak picks."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable

import numpy as np

RULES = {"min_probability": 0.6, "min_reliability": 0.62, "min_lift": 0.03, "max_base_rate": 0.85, "max_correlation": 0.5, "max_picks": 5, "min_picks": 4}


@dataclass
class Candidate:
    market: str
    outcome: str
    label: str
    p: float
    base: float
    reliability: float
    status: str  # active | validating | disabled | unavailable
    reason: str | None = None
    weight: Callable[[int, int], float] | None = None

    @property
    def lift(self) -> float:
        return self.p - self.base


@dataclass
class Pick:
    rank: int
    c: Candidate
    score: float
    confidence: str
    interval: tuple[float, float]


@dataclass
class Selection:
    picks: list[Pick]
    exclusions: list[dict] = field(default_factory=list)
    shortfall: str | None = None


def confidence(rel: float) -> str:
    return "High" if rel >= 0.8 else "Medium" if rel >= 0.66 else "Low"


def interval(p: float, rel: float) -> tuple[float, float]:
    hw = 0.02 + (1 - rel) * 0.12
    return max(0.0, p - hw), min(1.0, p + hw)


def correlation(a: Candidate, b: Candidate, m: np.ndarray) -> float:
    if a.weight is None or b.weight is None:
        return 0.0
    n = min(m.shape[0], 8)
    sub = m[:n, :n] / m[:n, :n].sum()
    pab = sum(sub[h, x] * a.weight(h, x) * b.weight(h, x) for h in range(n) for x in range(n))
    den = np.sqrt(a.p * (1 - a.p) * b.p * (1 - b.p))
    return float((pab - a.p * b.p) / den) if den > 0 else 0.0


def _plural(n: int, one: str, many: str) -> str:
    return f"{n} {one if n == 1 else many}"


def select(cands: list[Candidate], matrix: np.ndarray, rules: dict = RULES) -> Selection:
    excl: list[dict] = []
    tally = {"evidence": 0, "corr": 0, "rel": 0}
    eligible = []
    for c in cands:
        if c.p < 0.5:
            continue
        if c.status != "active":
            if c.p >= 0.7 and c.status != "unavailable":
                excl.append({"label": c.label, "market": c.market, "p": round(c.p, 4), "reason": c.reason or f"Market {c.status}"})
            continue
        if c.p < rules["min_probability"]:
            continue
        if c.base > rules["max_base_rate"]:
            excl.append({"label": c.label, "market": c.market, "p": round(c.p, 4), "reason": f"Too obvious: happens in {round(c.base * 100)}% of typical matches."})
            continue
        if c.lift < rules["min_lift"]:
            tally["evidence"] += 1
            excl.append({"label": c.label, "market": c.market, "p": round(c.p, 4), "reason": f"No match-specific evidence: {round(c.p * 100)}% here vs {round(c.base * 100)}% in a typical match."})
            continue
        if c.reliability < rules["min_reliability"]:
            tally["rel"] += 1
            excl.append({"label": c.label, "market": c.market, "p": round(c.p, 4), "reason": f"Reliability {round(c.reliability * 100)} below {round(rules['min_reliability'] * 100)}."})
            continue
        score = 0.45 * c.p + 0.3 * c.reliability + 0.25 * min(1.0, max(0.0, c.lift / 0.2))
        eligible.append((score, c))
    eligible.sort(key=lambda t: -t[0])
    picks: list[Pick] = []
    for score, c in eligible:
        if len(picks) >= rules["max_picks"]:
            break
        if any(p.c.market == c.market for p in picks):
            continue
        clash = next(((p, r) for p in picks if (r := correlation(c, p.c, matrix)) > rules["max_correlation"]), None)
        if clash:
            tally["corr"] += 1
            excl.append({"label": c.label, "market": c.market, "p": round(c.p, 4), "reason": f"Highly correlated with “{clash[0].c.label}” (φ = {clash[1]:.2f})."})
            continue
        picks.append(Pick(len(picks) + 1, c, round(score, 4), confidence(c.reliability), interval(c.p, c.reliability)))
    shortfall = None
    if len(picks) < rules["min_picks"]:
        statuses = [c.status for c in cands]
        parts = [p for p in [
            statuses.count("validating") and _plural(len({c.market for c in cands if c.status == 'validating'}), "market", "markets") + " still validating",
            statuses.count("unavailable") and _plural(len({c.market for c in cands if c.status == 'unavailable'}), "market lacks", "markets lack") + " the required data",
            tally["evidence"] and _plural(tally["evidence"], "outcome", "outcomes") + " had no match-specific evidence",
            tally["corr"] and _plural(tally["corr"], "outcome", "outcomes") + " duplicated a selected pick",
            tally["rel"] and _plural(tally["rel"], "outcome was", "outcomes were") + " below the reliability threshold",
        ] if p]
        lead = "No prediction met the selection rules" if not picks else f"Only {_plural(len(picks), 'prediction', 'predictions')} met the selection rules"
        shortfall = f"{lead}: {' · '.join(parts)}." if parts else f"{lead}."
    seen = set()
    excl_sorted = []
    for e in sorted(excl, key=lambda e: -e["p"]):
        if e["market"] not in seen:
            seen.add(e["market"])
            excl_sorted.append(e)
    return Selection(picks, excl_sorted[:6], shortfall)
