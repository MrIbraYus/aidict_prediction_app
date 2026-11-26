"""Probability-quality metrics. Accuracy alone is never used to select a model."""
from __future__ import annotations

import numpy as np

EPS = 1e-12


def brier(P: np.ndarray, y: np.ndarray) -> float:
    """Multi-class Brier score (sum over classes, mean over matches). For 1X2 the base rate is ≈ 0.65."""
    P = np.asarray(P, float)
    Y = np.eye(P.shape[1])[np.asarray(y, int)]
    return float(np.mean(np.sum((P - Y) ** 2, axis=1)))


def binary_brier(p: np.ndarray, y: np.ndarray) -> float:
    p, y = np.asarray(p, float), np.asarray(y, float)
    return float(np.mean((p - y) ** 2))


def log_loss(P: np.ndarray, y: np.ndarray) -> float:
    P = np.clip(np.asarray(P, float), EPS, 1)
    return float(-np.mean(np.log(P[np.arange(len(P)), np.asarray(y, int)])))


def binary_log_loss(p: np.ndarray, y: np.ndarray) -> float:
    p = np.clip(np.asarray(p, float), EPS, 1 - EPS)
    y = np.asarray(y, float)
    return float(-np.mean(y * np.log(p) + (1 - y) * np.log(1 - p)))


def rps(P: np.ndarray, y: np.ndarray) -> float:
    """Ranked probability score for ordered outcomes (home win < draw < away win)."""
    P = np.asarray(P, float)
    Y = np.eye(P.shape[1])[np.asarray(y, int)]
    cp, cy = np.cumsum(P, axis=1)[:, :-1], np.cumsum(Y, axis=1)[:, :-1]
    return float(np.mean(np.sum((cp - cy) ** 2, axis=1) / (P.shape[1] - 1)))


def reliability(p: np.ndarray, y: np.ndarray, bins: int = 10) -> list[dict]:
    p, y = np.asarray(p, float), np.asarray(y, float)
    edges = np.linspace(0, 1, bins + 1)
    idx = np.clip(np.digitize(p, edges) - 1, 0, bins - 1)
    out = []
    for b in range(bins):
        m = idx == b
        n = int(m.sum())
        if n:
            obs = float(y[m].mean())
            se = np.sqrt(max(obs * (1 - obs), 1e-9) / n)
            out.append({"bin": b, "predicted": float(p[m].mean()), "observed": obs, "n": n, "lo": max(0.0, obs - 1.96 * se), "hi": min(1.0, obs + 1.96 * se)})
    return out


def ece(p: np.ndarray, y: np.ndarray, bins: int = 10) -> float:
    """Expected calibration error (weighted mean |predicted − observed| across bins)."""
    rows = reliability(p, y, bins)
    n = sum(r["n"] for r in rows)
    return float(sum(r["n"] * abs(r["predicted"] - r["observed"]) for r in rows) / n) if n else float("nan")


def ece_multiclass(P: np.ndarray, y: np.ndarray, bins: int = 10) -> float:
    """Class-wise ECE averaged over classes (each outcome's probabilities vs its occurrence)."""
    P = np.asarray(P, float)
    Y = np.eye(P.shape[1])[np.asarray(y, int)]
    return float(np.mean([ece(P[:, k], Y[:, k], bins) for k in range(P.shape[1])]))


def bootstrap_diff(a: np.ndarray, b: np.ndarray, n: int = 2000, seed: int = 7) -> tuple[float, float, float]:
    """95% bootstrap interval of mean(a − b) for per-match losses (e.g. log loss model vs baseline)."""
    rng = np.random.default_rng(seed)
    d = np.asarray(a, float) - np.asarray(b, float)
    means = rng.choice(d, size=(n, len(d)), replace=True).mean(axis=1)
    return float(d.mean()), float(np.quantile(means, 0.025)), float(np.quantile(means, 0.975))


def per_match_log_loss(P: np.ndarray, y: np.ndarray) -> np.ndarray:
    P = np.clip(np.asarray(P, float), EPS, 1)
    return -np.log(P[np.arange(len(P)), np.asarray(y, int)])
