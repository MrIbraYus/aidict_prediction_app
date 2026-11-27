"""Apply supabase/apply-all.sql to the database in SUPABASE_DB_URL, once, in a single transaction.
Refuses to run if AIDICT tables already exist (use migrations for later changes). Never prints the connection string.
Usage: python services/scripts/apply_schema.py"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "services" / "data-engine"))

import psycopg  # noqa: E402

from aidict_data import env  # noqa: E402


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    url = env.require("SUPABASE_DB_URL")["SUPABASE_DB_URL"]
    sql = (ROOT / "supabase" / "apply-all.sql").read_text(encoding="utf-8")
    try:
        conn = psycopg.connect(url, connect_timeout=15, prepare_threshold=None)
    except Exception as e:  # message may include the host but never the password
        print(f"✗ Could not connect: {type(e).__name__}: {str(e).splitlines()[0][:200]}")
        return 1
    with conn:
        exists = conn.execute("select to_regclass('public.sports') is not null").fetchone()[0]
        if exists:
            print("✓ Schema already present: nothing to do.")
            return 0
        conn.execute(sql)
        from migrate import LEDGER  # record every bundled migration as applied
        conn.execute(LEDGER)
        for f in sorted((ROOT / "supabase" / "migrations").glob("*.sql")):
            conn.execute("insert into aidict_private.migrations (version, name) values (%s, %s) on conflict do nothing", (f.name.split("_", 1)[0], f.name))
    with psycopg.connect(url, connect_timeout=15) as c:
        n = c.execute("select count(*) from information_schema.tables where table_schema = 'public'").fetchone()[0]
        m = c.execute("select count(*) from public.market_definitions").fetchone()[0]
    print(f"✓ Schema applied: {n} tables, {m} market definitions seeded.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
