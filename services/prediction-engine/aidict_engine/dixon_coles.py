"""Dixon–Coles (1997) goals model with exponential time decay, low-score correction ρ and shrinkage priors.

log λ_home = home + attack[h] + defence[a]
log λ_away =        attack[a] + defence[h]
Fitted by weighted maximum likelihood with an ANALYTIC gradient (fast enough to refit every matchweek).
Teams with little recent data are shrunk towards a prior (promoted sides start below average).
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy.optimize import minimize
from scipy.special import gammaln

PROMOTED_PRIOR = (-0.25, 0.2)  # (attack, defence) for teams absent from last season's division


@dataclass
class DixonColesModel:
    teams: list[str]
    attack: np.ndarray
    defence: np.ndarray
    home: float
    rho: float
    n_matches: int

    def index(self, team: str) -> int | None:
        try:
            return self.teams.index(team)
        except ValueError:
            return None

    def rates(self, home: str, away: str) -> tuple[float, float]:
        ih, ia = self.index(home), self.index(away)
        ah, dh = (self.attack[ih], self.defence[ih]) if ih is not None else PROMOTED_PRIOR
        aa, da = (self.attack[ia], self.defence[ia]) if ia is not None else PROMOTED_PRIOR
        return float(np.exp(self.home + ah + da)), float(np.exp(aa + dh))

    def matrix(self, home: str, away: str, max_goals: int = 10) -> np.ndarray:
        lh, la = self.rates(home, away)
        return score_matrix(lh, la, self.rho, max_goals)


def _poisson_pmf(k: np.ndarray, lam: float) -> np.ndarray:
    return np.exp(k * np.log(lam) - lam - gammaln(k + 1))


def score_matrix(lh: float, la: float, rho: float, max_goals: int = 10) -> np.ndarray:
    k = np.arange(max_goals + 1)
    m = np.outer(_poisson_pmf(k, lh), _poisson_pmf(k, la))
    m[0, 0] *= 1 - lh * la * rho
    m[0, 1] *= 1 + lh * rho
    m[1, 0] *= 1 + la * rho
    m[1, 1] *= 1 - rho
    return m / m.sum()


def fit(home: list[str], away: list[str], gh: np.ndarray, ga: np.ndarray, age_days: np.ndarray, xi: float = 0.0019,
        l2: float = 1.0, prior: dict[str, tuple[float, float]] | None = None) -> DixonColesModel:
    teams = sorted(set(home) | set(away))
    n = len(teams)
    ix = {t: i for i, t in enumerate(teams)}
    hi = np.array([ix[t] for t in home])
    ai = np.array([ix[t] for t in away])
    x = np.asarray(gh, float)
    y = np.asarray(ga, float)
    w = np.exp(-xi * np.asarray(age_days, float))
    pa = np.array([(prior or {}).get(t, (0.0, 0.0))[0] for t in teams])
    pd = np.array([(prior or {}).get(t, (0.0, 0.0))[1] for t in teams])
    m00, m01, m10, m11 = (x == 0) & (y == 0), (x == 0) & (y == 1), (x == 1) & (y == 0), (x == 1) & (y == 1)
    const = gammaln(x + 1) + gammaln(y + 1)

    def unpack(th):
        return th[:n], th[n:2 * n], th[2 * n], th[2 * n + 1]

    def f_and_grad(th):
        att, dfn, hm, rho = unpack(th)
        llam = hm + att[hi] + dfn[ai]
        lmu = att[ai] + dfn[hi]
        lam, mu = np.exp(llam), np.exp(lmu)
        tau = np.ones_like(lam)
        tau[m00] = 1 - lam[m00] * mu[m00] * rho
        tau[m01] = 1 + lam[m01] * rho
        tau[m10] = 1 + mu[m10] * rho
        tau[m11] = 1 - rho
        tau = np.maximum(tau, 1e-10)
        ll = w * (np.log(tau) + x * llam - lam + y * lmu - mu - const)
        # gradients wrt log λ, log μ, ρ
        dtl = np.zeros_like(lam); dtm = np.zeros_like(lam); dtr = np.zeros_like(lam)
        dtl[m00] = -lam[m00] * mu[m00] * rho / tau[m00]; dtm[m00] = dtl[m00]; dtr[m00] = -lam[m00] * mu[m00] / tau[m00]
        dtl[m01] = lam[m01] * rho / tau[m01]; dtr[m01] = lam[m01] / tau[m01]
        dtm[m10] = mu[m10] * rho / tau[m10]; dtr[m10] = mu[m10] / tau[m10]
        dtr[m11] = -1 / tau[m11]
        gl = w * (x - lam + dtl)
        gm = w * (y - mu + dtm)
        g_att = np.zeros(n); g_def = np.zeros(n)
        np.add.at(g_att, hi, gl); np.add.at(g_def, ai, gl)
        np.add.at(g_att, ai, gm); np.add.at(g_def, hi, gm)
        g_home = gl.sum()
        g_rho = (w * dtr).sum()
        # objective: −loglik + shrinkage towards priors (identifies the model, stabilises small samples)
        obj = -ll.sum() + l2 * (np.sum((att - pa) ** 2) + np.sum((dfn - pd) ** 2))
        grad = -np.concatenate([g_att, g_def, [g_home, g_rho]])
        grad[:n] += 2 * l2 * (att - pa)
        grad[n:2 * n] += 2 * l2 * (dfn - pd)
        return obj, grad

    th0 = np.concatenate([pa, pd, [0.25, -0.05]])
    bounds = [(None, None)] * (2 * n) + [(-1, 1), (-0.2, 0.2)]
    r = minimize(f_and_grad, th0, jac=True, method="L-BFGS-B", bounds=bounds, options={"maxiter": 500})
    att, dfn, hm, rho = unpack(r.x)
    return DixonColesModel(teams, att, dfn, float(hm), float(rho), len(home))
