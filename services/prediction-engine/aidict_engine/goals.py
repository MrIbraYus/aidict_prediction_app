"""Production goals model: Dixon–Coles goal ratings blended with shots-on-target ratings.

log λ = W_SHOTS_GOALS · log λ_goals + (1 − W_SHOTS_GOALS) · log λ_shots, where λ_shots = expected shots on target ×
goals per shot on target. The weight was pre-registered and chosen on the 2019-20 and 2020-21 tuning seasons only
(documentation/MARKET_RESEARCH.md); on the 2021-22 … 2025-26 test seasons it lowered calibrated log loss for result,
goals and combined markets alike."""
from __future__ import annotations

import math

import numpy as np

from . import dixon_coles

W_SHOTS_GOALS = 0.5


def blend(lh: float, la: float, lsh: float | None, lsa: float | None, w: float = W_SHOTS_GOALS) -> tuple[float, float]:
    ok = lsh is not None and lsa is not None and all(math.isfinite(x) and x > 0 for x in (lsh, lsa))
    if not ok or w >= 1:
        return lh, la
    return float(math.exp(w * math.log(lh) + (1 - w) * math.log(lsh))), float(math.exp(w * math.log(la) + (1 - w) * math.log(lsa)))


def row_matrix(r) -> np.ndarray:
    """Score matrix for a walk-forward backtest row (lam_h/lam_a goals model, lam_sh/lam_sa shots model when present)."""
    lh, la = blend(r.lam_h, r.lam_a, getattr(r, "lam_sh", None), getattr(r, "lam_sa", None))
    return dixon_coles.score_matrix(lh, la, r.rho)
