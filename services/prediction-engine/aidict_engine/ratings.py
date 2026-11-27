"""Attack/defence ratings for per-team match counts (shots on target, corners).

log E[home count] = const + home + attack[home] + defence[away]
log E[away count] = const + attack[away] + defence[home]

Poisson likelihood with exponential time decay (same xi as the goals model) and an L2 penalty that pulls each team toward
its prior (0 for established teams, the promoted-team prior otherwise). Unlike the goals model this has an explicit
intercept, because these counts average ~4–6 per team rather than ~1.4.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy.optimize import minimize

from .dixon_coles import PROMOTED_PRIOR


@dataclass
class CountRatings:
    teams: list[str]
    attack: np.ndarray
    defence: np.ndarray
    home: float
    const: float
    n_matches: int

    def _ix(self, team: str) -> int | None:
        try:
            return self.teams.index(team)
        except ValueError:
            return None

    def rates(self, home: str, away: str) -> tuple[float, float]:
        ih, ia = self._ix(home), self._ix(away)
        ah, dh = (self.attack[ih], self.defence[ih]) if ih is not None else PROMOTED_PRIOR
        aa, da = (self.attack[ia], self.defence[ia]) if ia is not None else PROMOTED_PRIOR
        return float(np.exp(self.const + self.home + ah + da)), float(np.exp(self.const + aa + dh))


def fit_counts(home: list[str], away: list[str], yh: np.ndarray, ya: np.ndarray, age_days: np.ndarray, xi: float = 0.0019,
               l2: float = 1.0, prior: dict[str, tuple[float, float]] | None = None) -> CountRatings:
    teams = sorted(set(home) | set(away))
    n = len(teams)
    ix = {t: i for i, t in enumerate(teams)}
    hi = np.array([ix[t] for t in home])
    ai = np.array([ix[t] for t in away])
    yh = np.asarray(yh, float)
    ya = np.asarray(ya, float)
    w = np.exp(-xi * np.asarray(age_days, float))
    pa = np.array([(prior or {}).get(t, (0.0, 0.0))[0] for t in teams])
    pdf = np.array([(prior or {}).get(t, (0.0, 0.0))[1] for t in teams])

    def f(th):
        att, de, hm, c = th[:n], th[n:2 * n], th[2 * n], th[2 * n + 1]
        lh = c + hm + att[hi] + de[ai]
        la = c + att[ai] + de[hi]
        mh, ma = np.exp(lh), np.exp(la)
        nll = -float((w * (yh * lh - mh + ya * la - ma)).sum()) + l2 * float(((att - pa) ** 2).sum() + ((de - pdf) ** 2).sum())
        rh, ra = w * (yh - mh), w * (ya - ma)  # d(loglik)/d(linear predictor)
        g_att = -(np.bincount(hi, rh, n) + np.bincount(ai, ra, n)) + 2 * l2 * (att - pa)
        g_def = -(np.bincount(ai, rh, n) + np.bincount(hi, ra, n)) + 2 * l2 * (de - pdf)
        return nll, np.concatenate([g_att, g_def, [-rh.sum(), -(rh.sum() + ra.sum())]])

    c0 = float(np.log(max((w * (yh + ya)).sum() / (2 * w.sum()), 1e-6)))
    h0 = float(np.log(max((w * yh).sum(), 1e-6) / max((w * ya).sum(), 1e-6)))
    x0 = np.concatenate([pa, pdf, [h0, c0]])
    res = minimize(f, x0, jac=True, method="L-BFGS-B")
    th = res.x
    return CountRatings(teams, th[:n], th[n:2 * n], float(th[2 * n]), float(th[2 * n + 1]), len(home))
