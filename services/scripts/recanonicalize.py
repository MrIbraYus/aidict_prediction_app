"""Recompute each team's canonical alias after the alias table (aidict_data/normalise.py) changes.
Dry run by default; --apply writes. Refuses to apply if two teams would share one canonical key (that would merge clubs).
Usage: python services/scripts/recanonicalize.py [--apply]"""
from __future__ import annotations

import argparse
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "services" / "data-engine"))

from aidict_data import env  # noqa: E402
from aidict_data.db import Repo, connect  # noqa: E402
from aidict_data.normalise import canonical  # noqa: E402


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args(argv)
    sys.stdout.reconfigure(encoding="utf-8")
    env.require("SUPABASE_DB_URL")
    repo = Repo(connect())
    rows = repo.all("""select t.id, t.name, ta.alias from teams t left join team_aliases ta on ta.team_id = t.id and ta.source = 'canonical' order by t.id""")
    new = {r["id"]: canonical(r["name"]) for r in rows}
    owners: dict[str, list] = defaultdict(list)
    for tid, key in new.items():
        owners[key].append(tid)
    clashes = {k: v for k, v in owners.items() if len(v) > 1}
    changes = [(r["id"], r["name"], r["alias"], new[r["id"]]) for r in rows if r["alias"] != new[r["id"]]]
    for tid, name, old, key in changes:
        print(f"  {name!r}: {old!r} -> {key!r}")
    print(f"{len(changes)} change(s), {len(clashes)} clash(es)")
    for k, ids in clashes.items():
        print(f"  ✗ clash on {k!r}: teams {ids}")
    if clashes or not args.apply or not changes:
        return 1 if clashes else 0
    with repo.tx():
        repo.many("delete from team_aliases where team_id = %s and source = 'canonical'", [(tid,) for tid, *_ in changes])
        repo.many("insert into team_aliases (team_id, alias, source) values (%s, %s, 'canonical')", [(tid, key) for tid, _, _, key in changes])
    print("✓ applied")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
