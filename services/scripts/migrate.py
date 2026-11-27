"""Apply pending supabase/migrations/*.sql to SUPABASE_DB_URL, each in its own transaction, recorded in
aidict_private.migrations (a schema the Supabase API does not expose). A database created from apply-all.sql is
baselined to the migrations that existed when it was created. Never prints the connection string.
Usage: python services/scripts/migrate.py [--baseline-through 20261126000009]"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "services" / "data-engine"))

import psycopg  # noqa: E402

from aidict_data import env  # noqa: E402

LEDGER = """create schema if not exists aidict_private;
revoke all on schema aidict_private from public;
create table if not exists aidict_private.migrations (version text primary key, name text not null, applied_at timestamptz not null default now());"""


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--baseline-through", default="20261126000009", help="treat migrations up to this version as applied on an existing schema")
    args = ap.parse_args(argv)
    sys.stdout.reconfigure(encoding="utf-8")
    url = env.require("SUPABASE_DB_URL")["SUPABASE_DB_URL"]
    files = sorted((ROOT / "supabase" / "migrations").glob("*.sql"))
    with psycopg.connect(url, connect_timeout=15, prepare_threshold=None) as conn:
        conn.execute(LEDGER)
        if not conn.execute("select to_regclass('public.sports') is not null").fetchone()[0]:
            print("✗ No AIDICT schema yet: run apply_schema.py first.")
            return 1
        done = {r[0] for r in conn.execute("select version from aidict_private.migrations").fetchall()}
        if not done:  # existing database created from apply-all.sql before the ledger existed
            for f in files:
                v = f.name.split("_", 1)[0]
                if v <= args.baseline_through:
                    conn.execute("insert into aidict_private.migrations (version, name) values (%s, %s)", (v, f.name))
                    done.add(v)
        conn.commit()
        pending = [f for f in files if f.name.split("_", 1)[0] not in done]
        for f in pending:
            v = f.name.split("_", 1)[0]
            with conn.transaction():
                conn.execute(f.read_text(encoding="utf-8"))
                conn.execute("insert into aidict_private.migrations (version, name) values (%s, %s)", (v, f.name))
            print(f"✓ applied {f.name}")
    print("✓ up to date" if not pending else f"✓ {len(pending)} migration(s) applied")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
