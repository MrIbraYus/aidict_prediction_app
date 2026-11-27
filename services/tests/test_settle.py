"""Settlement job: results from final scores, goal-order markets only with consistent goal minutes, voids, and waiting."""
from datetime import datetime, timedelta, timezone

from aidict_engine.jobs import settle as job


class FakeRepo:
    def __init__(self, picks, goals=None, goal_times=True, savers=()):
        self.picks, self.goals, self.goal_times, self.savers = picks, goals or {}, goal_times, savers
        self.outcomes, self.notes = [], []

    def all(self, sql, params=()):
        if "from smart_picks" in sql:
            return self.picks
        if "from goal_events" in sql:
            return [{"team_id": t} for t in self.goals.get(params[0], [])]
        if "from saved_matches" in sql:
            return [{"user_id": u} for u in self.savers]
        raise AssertionError(sql)

    def one(self, sql, params=()):
        assert "fixture_data_inventory" in sql
        return {"available": self.goal_times}

    def run(self, sql, params=()):
        (self.outcomes if "pick_outcomes" in sql else self.notes).append(params)


def pick(market, outcome, gh, ga, *, final=True, status="FT", days_ago=1, fid=1, pid="p1"):
    return {"id": pid, "market_id": market, "outcome_key": outcome, "label": outcome, "fixture_id": fid, "status": status,
            "kickoff_at": datetime.now(timezone.utc) - timedelta(days=days_ago), "home_team_id": 10, "ft_home": gh, "ft_away": ga,
            "is_final": final, "hs": "Home", "as_": "Away"}


def results(repo):
    return {pid: res for pid, res, _ in repo.outcomes}


def test_score_markets_settle_from_final_result():
    repo = FakeRepo([pick("1x2", "home", 2, 1, pid="a"), pick("ou", "over2.5", 1, 1, pid="b"), pick("btts", "yes", 1, 1, pid="c")], savers=["u1"])
    job.settle(repo, log=lambda *_: None)
    assert results(repo) == {"a": "won", "b": "lost", "c": "won"}
    assert len(repo.notes) == 3  # one notification per settled pick for the saving user


def test_not_final_waits_and_cancelled_voids():
    repo = FakeRepo([pick("1x2", "home", None, None, final=False, pid="a"), pick("1x2", "home", None, None, final=False, status="CANCELLED", pid="b")])
    counts = job.settle(repo, log=lambda *_: None)
    assert results(repo) == {"b": "void"} and counts["waiting"] == 1


def test_goal_order_uses_consistent_minutes_only():
    # Home scored first (team 10), then away twice: 1–2.
    ok = FakeRepo([pick("first-goal", "home", 1, 2)], goals={1: [10, 20, 20]})
    job.settle(ok, log=lambda *_: None)
    assert results(ok) == {"p1": "won"}
    # Minutes disagree with the final score → wait while fresh, void once the data window has passed. Never guessed.
    fresh = FakeRepo([pick("first-goal", "home", 1, 2)], goals={1: [10, 20]})
    assert job.settle(fresh, log=lambda *_: None)["waiting"] == 1 and not fresh.outcomes
    stale = FakeRepo([pick("first-goal", "home", 1, 2, days_ago=5)], goals={1: [10, 20]})
    job.settle(stale, log=lambda *_: None)
    assert results(stale) == {"p1": "void"}
