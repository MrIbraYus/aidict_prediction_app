"""Elo ratings with home advantage, goal-difference multiplier and between-season regression,
plus an ordered-logit mapping from rating difference to 1X2 probabilities (fitted on past data only)."""
from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np
from scipy.optimize import minimize
from scipy.special import expit


@dataclass
class Elo:
    k: float = 20.0
    home_adv: float = 65.0
    carry: float = 0.8  # share of distance from the mean kept between seasons
    promoted_rating: float = 1420.0
    mean: float = 1500.0
    ratings: dict[str, float] = field(default_factory=dict)
    season: str | None = None

    def rating(self, team: str) -> float:
        return self.ratings.get(team, self.promoted_rating)

    def diff(self, home: str, away: str) -> float:
        return self.rating(home) + self.home_adv - self.rating(away)

    def start_season(self, season: str, teams: set[str]) -> None:
        if self.season == season:
            return
        self.ratings = {t: self.mean + self.carry * (r - self.mean) for t, r in self.ratings.items()}
        for t in teams:
            self.ratings.setdefault(t, self.promoted_rating)
        self.season = season

    def update(self, home: str, away: str, gh: int, ga: int) -> None:
        d = self.diff(home, away)
        expected = 1 / (1 + 10 ** (-d / 400))
        score = 1.0 if gh > ga else 0.5 if gh == ga else 0.0
        gd = abs(gh - ga)
        mult = math.log(gd + 1) * (2.2 / ((d if score == 1 else -d) * 0.001 + 2.2)) if gd else 1.0
        delta = self.k * mult * (score - expected)
        self.ratings[home] = self.rating(home) + delta
        self.ratings[away] = self.rating(away) - delta


@dataclass
class OrderedLogit:
    """P(away) = σ(c1 − βx), P(away or draw) = σ(c2 − βx) with x = Elo difference / 100."""

    beta: float = 0.5
    c1: float = -0.4
    c2: float = 0.7

    def fit(self, x: np.ndarray, y: np.ndarray) -> "OrderedLogit":
        x = np.asarray(x, float) / 100
        y = np.asarray(y, int)  # 0 home, 1 draw, 2 away

        def nll(theta):
            b, c1, gap = theta
            P = self._probs(x, b, c1, c1 + abs(gap))
            return -np.sum(np.log(np.clip(P[np.arange(len(y)), y], 1e-12, 1)))

        r = minimize(nll, [self.beta, self.c1, self.c2 - self.c1], method="Nelder-Mead", options={"maxiter": 2000, "xatol": 1e-5, "fatol": 1e-6})
        self.beta, self.c1, self.c2 = r.x[0], r.x[1], r.x[1] + abs(r.x[2])
        return self

    @staticmethod
    def _probs(x, b, c1, c2):
        p_away = expit(c1 - b * x)
        p_away_draw = expit(c2 - b * x)
        return np.column_stack([1 - p_away_draw, p_away_draw - p_away, p_away])

    def predict(self, diff: np.ndarray) -> np.ndarray:
        return self._probs(np.asarray(diff, float) / 100, self.beta, self.c1, self.c2)
