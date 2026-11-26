"""Market derivations from the score matrix and the goal-order model (Python reference of the 24-market design).
Each function is market-specific; combined markets are JOINT events on the matrix, never products."""
from __future__ import annotations

from functools import lru_cache
from itertools import combinations

import numpy as np

M = np.ndarray


def _grid(m: M):
    h, a = np.indices(m.shape)
    return h, a


def one_x_two(m: M) -> tuple[float, float, float]:
    h, a = _grid(m)
    return float(m[h > a].sum()), float(m[h == a].sum()), float(m[h < a].sum())


def over(m: M, line: float) -> float:
    h, a = _grid(m)
    return float(m[h + a > line].sum())


def btts(m: M) -> float:
    return float(m[1:, 1:].sum())


def double_chance(m: M) -> dict[str, float]:
    p1, px, p2 = one_x_two(m)
    return {"1X": p1 + px, "12": p1 + p2, "X2": px + p2}


def combined(m: M, result: str, side: str, line: float = 2.5) -> float:
    """Joint P(result ∪ goals side of line); result in {'H','D','A'}, side in {'over','under'}."""
    h, a = _grid(m)
    res = {"H": h > a, "D": h == a, "A": h < a}[result]
    goals = (h + a > line) if side == "over" else (h + a < line)
    return float(m[res | goals].sum())


def handicap_3way(m: M, line: int) -> tuple[float, float, float]:
    """European handicap applied to the home side: (home wins, handicap draw, away wins)."""
    h, a = _grid(m)
    d = h + line - a
    return float(m[d > 0].sum()), float(m[d == 0].sum()), float(m[d < 0].sum())


def asian(m: M, line: float, side: str = "home") -> dict[str, float]:
    """Full win / half win / push / half loss / full loss for an Asian handicap line (quarter lines split)."""
    h, a = _grid(m)
    diff = (h - a) if side == "home" else (a - h)
    parts = [line] if (float(line) * 2).is_integer() else [line - 0.25, line + 0.25]
    out = dict.fromkeys(["full_win", "half_win", "push", "half_loss", "full_loss"], 0.0)
    win = sum(((diff + p) > 0).astype(float) for p in parts) / len(parts)
    push = sum(((diff + p) == 0).astype(float) for p in parts) / len(parts)
    lose = 1 - win - push
    for prob, w, pu, lo in zip(m.ravel(), win.ravel(), push.ravel(), lose.ravel()):
        if w == 1: out["full_win"] += prob
        elif w == 0.5 and pu == 0.5: out["half_win"] += prob
        elif pu == 1: out["push"] += prob
        elif lo == 0.5 and pu == 0.5: out["half_loss"] += prob
        else: out["full_loss"] += prob
    return out


# ───────────── Goal-order model (base: uniform ordering given the final score) ─────────────
@lru_cache(maxsize=None)
def order_stats(h: int, a: int) -> dict[str, float]:
    """Exact path statistics over all C(h+a, h) scoring sequences for a final score (h, a)."""
    n = h + a
    keys = ["home_lead1", "home_lead2", "home_never_trail", "away_lead1", "away_lead2", "away_never_trail", "any_run2", "any_run3", "home_run2", "home_run3", "away_run2"]
    acc = dict.fromkeys(keys, 0.0)
    count = 0
    for home_pos in combinations(range(n), h):
        hp = set(home_pos)
        d = maxd = mind = 0
        run = last = mhr = mar = 0
        for i in range(n):
            if i in hp:
                d += 1; run = run + 1 if last == 1 else 1; last = 1; mhr = max(mhr, run)
            else:
                d -= 1; run = run + 1 if last == -1 else 1; last = -1; mar = max(mar, run)
            maxd, mind = max(maxd, d), min(mind, d)
        count += 1
        acc["home_lead1"] += maxd >= 1; acc["home_lead2"] += maxd >= 2; acc["home_never_trail"] += mind >= 0
        acc["away_lead1"] += mind <= -1; acc["away_lead2"] += mind <= -2; acc["away_never_trail"] += maxd <= 0
        acc["any_run2"] += max(mhr, mar) >= 2; acc["any_run3"] += max(mhr, mar) >= 3
        acc["home_run2"] += mhr >= 2; acc["home_run3"] += mhr >= 3; acc["away_run2"] += mar >= 2
    return {k: v / count for k, v in acc.items()}


def path_market(m: M, stat: str, max_goals: int = 7) -> float:
    sub = m[: max_goals + 1, : max_goals + 1]
    total = sub.sum()
    return float(sum(sub[h, a] * order_stats(h, a)[stat] for h in range(sub.shape[0]) for a in range(sub.shape[1])) / total)


def first_goal(m: M) -> dict[str, float]:
    p_none = float(m[0, 0])
    h, a = _grid(m)
    n = h + a
    with np.errstate(invalid="ignore", divide="ignore"):
        share = np.where(n > 0, h / n, 0.0)
    home = float((m * share).sum())
    return {"home": home, "none": p_none, "away": 1 - home - p_none}
