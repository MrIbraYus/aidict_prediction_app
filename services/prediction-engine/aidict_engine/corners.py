"""Corners markets: team corner ratings (attack/defence on corner counts, ratings.fit_counts) with negative-binomial
over-dispersion. Validated in documentation/MARKET_RESEARCH.md §4; settled from official corner counts."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

import numpy as np
from scipy.stats import nbinom

LINES = [8.5, 9.5, 10.5, 11.5]


def probabilities(lh: float, la: float, k: float) -> dict[tuple[str, str], float]:
    x = np.arange(0, 31)
    joint = np.outer(nbinom.pmf(x, k, k / (k + lh)), nbinom.pmf(x, k, k / (k + la)))
    total = np.add.outer(x, x)
    out = {("corners-ou", f"over{l}"): float(joint[total > l].sum()) for l in LINES}
    out[("corners-1x2", "home")] = float(np.tril(joint, -1).sum())
    out[("corners-1x2", "draw")] = float(np.trace(joint))
    out[("corners-1x2", "away")] = float(np.triu(joint, 1).sum())
    return out


@dataclass(frozen=True)
class CornerSpec:
    market: str
    outcome: str
    label: str
    settle: Callable[[float, float], float]
    binary_gate: float = 0.03


SPECS = [CornerSpec("corners-ou", f"over{l}", f"Over {l} corners", (lambda l: lambda h, a: float(h + a > l))(l)) for l in LINES] + [
    CornerSpec("corners-1x2", "home", "Home more corners", lambda h, a: float(h > a), 0.04),
    CornerSpec("corners-1x2", "draw", "Equal corners", lambda h, a: float(h == a), 0.04),
    CornerSpec("corners-1x2", "away", "Away more corners", lambda h, a: float(h < a), 0.04),
]


def dispersion(model, rows) -> float:
    """Negative-binomial size k (var = mu + mu²/k) by method of moments on recent matches with corner counts."""
    mu, y = [], []
    for r in rows:
        h, a = model.rates(r.home, r.away)
        mu += [h, a]
        y += [r.cor_h, r.cor_a]
    mu, y = np.array(mu, float), np.array(y, float)
    excess = float(((y - mu) ** 2 - mu).sum())
    return float(np.clip((mu ** 2).sum() / excess, 2.0, 500.0)) if excess > 0 else 500.0
