"""Prediction engine: metrics, Dixon–Coles recovery, market maths (incl. joint events and goal order), no-leakage backtest."""
from datetime import datetime, timedelta, timezone

import numpy as np
import pandas as pd
import pytest

from aidict_engine import dixon_coles
from aidict_engine.backtest import Config, run
from aidict_engine.elo import Elo, OrderedLogit
from aidict_engine.markets import asian, btts, combined, double_chance, first_goal, handicap_3way, one_x_two, order_stats, over, path_market
from aidict_engine.metrics import brier, ece, log_loss, rps


# ───────────── Metrics ─────────────
def test_metric_reference_values():
    P = np.array([[1.0, 0, 0], [0.5, 0.3, 0.2]])
    y = np.array([0, 2])
    assert brier(P, y) == pytest.approx((0 + (0.25 + 0.09 + 0.64)) / 2)
    assert log_loss(P, y) == pytest.approx(-np.log(0.2) / 2, rel=1e-6)
    assert rps(np.array([[1 / 3] * 3]), np.array([1])) == pytest.approx(((1 / 3) ** 2 + (1 / 3) ** 2) / 2)


def test_ece_is_zero_for_perfect_calibration():
    rng = np.random.default_rng(1)
    p = rng.uniform(0.05, 0.95, 200_000)
    y = rng.uniform(size=p.size) < p
    assert ece(p, y) < 0.01


# ───────────── Score matrix & markets ─────────────
M = dixon_coles.score_matrix(1.8, 0.9, -0.08)


def test_matrix_normalised_and_markets_consistent():
    assert M.sum() == pytest.approx(1)
    h, d, a = one_x_two(M)
    assert h + d + a == pytest.approx(1)
    assert double_chance(M)["1X"] == pytest.approx(h + d)
    assert over(M, 2.5) + (1 - over(M, 2.5)) == pytest.approx(1)
    assert 0 < btts(M) < 1


def test_combined_markets_are_joint_not_products():
    h, d, a = one_x_two(M)
    o = over(M, 2.5)
    joint = combined(M, "H", "over")
    i, j = np.indices(M.shape)
    both = M[(i > j) & (i + j > 2.5)].sum()
    assert joint == pytest.approx(h + o - both)  # inclusion–exclusion on the same matrix
    assert abs(joint - (1 - (1 - h) * (1 - o))) > 0.01  # independence would be wrong


def test_handicap_and_asian_settlement_sum_to_one():
    assert sum(handicap_3way(M, -1)) == pytest.approx(1)
    for line in (-1.5, -1, -0.75, -0.25, 0, 0.5):
        b = asian(M, line)
        assert sum(b.values()) == pytest.approx(1)
    zero = asian(M, 0)
    assert zero["push"] == pytest.approx(one_x_two(M)[1])  # AH 0 pushes exactly on a draw
    q = asian(M, -0.25)
    assert q["half_loss"] == pytest.approx(one_x_two(M)[1])  # −0.25 loses half on a draw


def test_goal_order_statistics():
    assert order_stats(1, 0)["home_lead1"] == 1
    s11 = order_stats(1, 1)
    assert s11["home_lead1"] == pytest.approx(0.5) and s11["any_run2"] == 0
    assert order_stats(2, 0)["home_run2"] == 1
    s21 = order_stats(2, 1)  # sequences HHA, HAH, AHH
    assert s21["home_lead2"] == pytest.approx(1 / 3) and s21["home_never_trail"] == pytest.approx(2 / 3)
    fg = first_goal(M)
    assert sum(fg.values()) == pytest.approx(1) and fg["home"] > fg["away"]
    assert path_market(M, "home_lead1") >= one_x_two(M)[0]  # leading at some point ⊇ winning


# ───────────── Dixon–Coles fitting ─────────────
def test_dixon_coles_recovers_known_strengths():
    rng = np.random.default_rng(42)
    teams = [f"T{i}" for i in range(12)]
    att = np.linspace(-0.4, 0.4, 12)
    dfn = -att * 0.8
    home, away, gh, ga = [], [], [], []
    for _ in range(4):
        for i in range(12):
            for j in range(12):
                if i != j:
                    lh, la = np.exp(0.25 + att[i] + dfn[j]), np.exp(att[j] + dfn[i])
                    home.append(teams[i]); away.append(teams[j]); gh.append(rng.poisson(lh)); ga.append(rng.poisson(la))
    m = dixon_coles.fit(home, away, np.array(gh), np.array(ga), np.zeros(len(gh)), xi=0, l2=0.1)
    order = [m.teams.index(t) for t in teams]
    assert np.corrcoef(m.attack[order], att)[0, 1] > 0.9
    assert m.home == pytest.approx(0.25, abs=0.08)


def test_elo_and_ordered_logit():
    e = Elo()
    e.start_season("2025-26", {"A", "B"})
    e.update("A", "B", 3, 0)
    assert e.rating("A") > e.rating("B")
    ol = OrderedLogit().fit(np.array([-200, -100, 0, 100, 200] * 40), np.array([2, 2, 1, 0, 0] * 40))
    p = ol.predict(np.array([150]))[0]
    assert p.sum() == pytest.approx(1) and p[0] > p[2]


# ───────────── Backtest: no information from the future ─────────────
def _league(seed: int, alter_future: bool = False) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    teams = [f"T{i}" for i in range(8)]
    rows = []
    start = datetime(2019, 8, 1, 15, tzinfo=timezone.utc)
    for s, year in enumerate(range(2019, 2023)):
        season = f"{year}-{str(year + 1)[2:]}"
        d = start.replace(year=year)
        for rnd in range(14):
            perm = rng.permutation(teams)
            for k in range(0, 8, 2):
                gh, ga = int(rng.poisson(1.5)), int(rng.poisson(1.1))
                rows.append({"season": season, "kickoff": d + timedelta(days=7 * rnd), "home": perm[k], "away": perm[k + 1], "gh": gh, "ga": ga})
    df = pd.DataFrame(rows)
    if alter_future:
        late = df.kickoff > datetime(2022, 9, 1, tzinfo=timezone.utc)
        df.loc[late, "gh"] = 9  # absurd future results must not affect earlier predictions
    return df


def test_backtest_uses_only_past_matches():
    a = run(_league(3), Config(test_from="2021-22"))
    b = run(_league(3, alter_future=True), Config(test_from="2021-22"))
    early = a.kickoff <= datetime(2022, 9, 1, tzinfo=timezone.utc)
    assert early.sum() > 50
    np.testing.assert_allclose(a.loc[early, ["dc_h", "dc_d", "dc_a"]].values, b.loc[early, ["dc_h", "dc_d", "dc_a"]].values)
    late_first = ~early
    assert not np.allclose(a.loc[late_first, "dc_h"].values[-5:], b.loc[late_first, "dc_h"].values[-5:])
