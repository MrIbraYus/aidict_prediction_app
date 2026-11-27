"""Database access for the jobs (service role / direct Postgres). Idempotent upserts with provider mappings,
canonical team matching and final-result protection (conflicts are recorded, never silently overwritten)."""
from __future__ import annotations

import hashlib
import json
import os
from collections import defaultdict
from contextlib import contextmanager
from datetime import datetime, timezone

import psycopg
from psycopg.rows import dict_row

from .normalise import canonical


CONFLICT_SQL = """insert into data_conflicts (fixture_id, field, values) select %s, 'ft', %s
                  where not exists (select 1 from data_conflicts where fixture_id = %s and field = 'ft' and status = 'open')"""
RESULT_SQL = """insert into match_results (fixture_id, ft_home, ft_away, ht_home, ht_away, is_final, confirmed_by)
                values (%s, %s, %s, %s, %s, %s, array[%s]::text[])
                on conflict (fixture_id) do update set ft_home = excluded.ft_home, ft_away = excluded.ft_away,
                ht_home = coalesce(excluded.ht_home, match_results.ht_home), ht_away = coalesce(excluded.ht_away, match_results.ht_away),
                is_final = excluded.is_final or match_results.is_final,
                confirmed_by = (select array_agg(distinct x) from unnest(match_results.confirmed_by || excluded.confirmed_by) x)"""
INVENTORY_SQL = """insert into fixture_data_inventory (fixture_id, data_type, available, completeness, source, as_of) values (%s, %s, %s, %s, %s, now())
                   on conflict (fixture_id, data_type) do update set available = excluded.available, completeness = excluded.completeness,
                   source = excluded.source, as_of = now()"""


def connect(url: str | None = None) -> psycopg.Connection:
    # prepare_threshold=None keeps it compatible with Supabase's poolers.
    return psycopg.connect(url or os.environ["SUPABASE_DB_URL"], row_factory=dict_row, prepare_threshold=None, autocommit=False)


class Repo:
    def __init__(self, conn: psycopg.Connection):
        self.c = conn

    @contextmanager
    def tx(self):
        try:
            yield self
            self.c.commit()
        except Exception:
            self.c.rollback()
            self.__dict__.pop("_team_cache", None)  # ids created in the rolled-back transaction no longer exist
            raise

    def one(self, sql: str, params=()):
        with self.c.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchone()

    def all(self, sql: str, params=()):
        with self.c.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchall()

    def run(self, sql: str, params=()):
        with self.c.cursor() as cur:
            cur.execute(sql, params)
            return cur.rowcount

    def many(self, sql: str, rows: list[tuple]) -> None:
        """Send many parameter sets as one pipelined batch: one network round trip instead of one per row."""
        if rows:
            with self.c.cursor() as cur:
                cur.executemany(sql, rows)

    def many_returning(self, sql: str, rows: list[tuple]) -> list:
        out: list = []
        if not rows:
            return out
        with self.c.cursor() as cur:
            cur.executemany(sql, rows, returning=True)
            while True:
                out.append(cur.fetchone())
                if not cur.nextset():
                    break
        return out

    # ───────────── reference ─────────────
    def competition_id(self, code: str) -> int | None:
        r = self.one("select id from competitions where code = %s", (code,))
        return r["id"] if r else None

    def upsert_season(self, competition_id: int, label: str, start: str | None, end: str | None, current: bool) -> int:
        if current:
            self.run("update seasons set is_current = false where competition_id = %s and label <> %s and is_current", (competition_id, label))
        r = self.one(
            """insert into seasons (competition_id, label, start_date, end_date, is_current) values (%s, %s, %s, %s, %s)
               on conflict (competition_id, label) do update set start_date = coalesce(excluded.start_date, seasons.start_date),
               end_date = coalesce(excluded.end_date, seasons.end_date), is_current = excluded.is_current returning id""",
            (competition_id, label, start, end, current))
        return r["id"]

    # ───────────── teams ─────────────
    def team_by_mapping(self, provider: str, provider_id: str) -> int | None:
        r = self.one("select entity_id from provider_mappings where provider_id = %s and entity_type = 'team' and provider_entity_id = %s", (provider, provider_id))
        return r["entity_id"] if r else None

    def team_by_canonical(self, name: str) -> int | None:
        r = self.one("select team_id from team_aliases where lower(alias) = %s and source = 'canonical'", (canonical(name),))
        return r["team_id"] if r else None

    def ensure_team(self, provider: str, name: str, provider_id: str | None = None, short: str | None = None, tla: str | None = None,
                    crest: str | None = None, national: bool = False) -> int:
        cache = self.__dict__.setdefault("_team_cache", {})  # one lookup per team per run, not per fixture
        key = (provider, provider_id or canonical(name))
        if key in cache:
            return cache[key]
        tid = (self.team_by_mapping(provider, provider_id) if provider_id else None) or self.team_by_canonical(name)
        if tid is None:
            tid = self.one("insert into teams (sport_id, name, short_name, tla, is_national) values (1, %s, %s, %s, %s) returning id", (name, short, tla, national))["id"]
            self.run("insert into team_aliases (team_id, alias, source) values (%s, %s, 'canonical') on conflict do nothing", (tid, canonical(name)))
        elif provider == "football-data-org":
            self.run("update teams set name = %s, short_name = coalesce(%s, short_name), tla = coalesce(%s, tla) where id = %s", (name, short, tla, tid))
        self.run("insert into team_aliases (team_id, alias, source) values (%s, %s, %s) on conflict do nothing", (tid, name, provider))
        if provider_id:
            self.run("""insert into provider_mappings (entity_type, entity_id, provider_id, provider_entity_id) values ('team', %s, %s, %s)
                        on conflict do nothing""", (tid, provider, provider_id))
        if crest:
            fmt = "svg" if crest.lower().endswith(".svg") else "png"
            self.run("""insert into team_badges (team_id, source, provider_team_id, source_url, format, kind, status, verified_at, last_checked_at)
                        values (%s, %s, %s, %s, %s, %s, 'active', now(), now())
                        on conflict (team_id) do update set source_url = excluded.source_url, format = excluded.format, last_checked_at = now(),
                        history = case when team_badges.source_url is distinct from excluded.source_url
                                       then team_badges.history || jsonb_build_array(jsonb_build_object('url', team_badges.source_url, 'replaced_at', now()))
                                       else team_badges.history end""",
                     (tid, provider, provider_id, crest, fmt, "national-flag" if national else "club-crest"))
        cache[key] = tid
        return tid

    # ───────────── bulk sync (one read per season, batched writes; same rules as the single-row methods) ─────────────
    def bulk_upsert_fixtures(self, provider: str, season_id: int, rows: list[dict]) -> list[int]:
        """rows: {pid, home, away, kickoff, status, round, venue}. Returns fixture ids aligned with rows.
        Match order: provider mapping → same pairing within 36 h → insert. Only the primary source moves kick-off/status."""
        mapped = {r["provider_entity_id"]: r["entity_id"] for r in self.all(
            "select provider_entity_id, entity_id from provider_mappings where provider_id = %s and entity_type = 'fixture'", (provider,))}
        existing = {r["id"]: r for r in self.all(
            """select id, home_team_id, away_team_id, kickoff_at, status::text as status, round, venue, primary_source
               from fixtures where season_id = %s""", (season_id,))}
        by_pair: dict[tuple, list] = defaultdict(list)
        for e in existing.values():
            by_pair[(e["home_team_id"], e["away_team_id"])].append(e)
        fids: list = [None] * len(rows)
        new_idx, updates, maps = [], [], []
        for i, r in enumerate(rows):
            fid = mapped.get(r["pid"])
            if fid is None:
                near = [e for e in by_pair.get((r["home"], r["away"]), []) if abs((e["kickoff_at"] - r["kickoff"]).total_seconds()) <= 36 * 3600]
                if near:
                    fid = min(near, key=lambda e: abs((e["kickoff_at"] - r["kickoff"]).total_seconds()))["id"]
                    maps.append((fid, provider, r["pid"]))
            if fid is None:
                new_idx.append(i)
                continue
            fids[i] = fid
            e = existing.get(fid)
            moved = e is None or (e["primary_source"] == provider and (e["kickoff_at"] != r["kickoff"] or e["status"] != r["status"]))
            if moved or (e["round"] is None and r["round"]) or (e["venue"] is None and r["venue"]):
                updates.append((provider, r["kickoff"], provider, r["status"], r["round"], r["venue"], fid))
        ids = self.many_returning(
            """insert into fixtures (season_id, home_team_id, away_team_id, kickoff_at, status, round, venue, primary_source)
               values (%s, %s, %s, %s, %s, %s, %s, %s) returning id""",
            [(season_id, rows[i]["home"], rows[i]["away"], rows[i]["kickoff"], rows[i]["status"], rows[i]["round"], rows[i]["venue"], provider) for i in new_idx])
        for i, rec in zip(new_idx, ids):
            fids[i] = rec["id"]
            maps.append((rec["id"], provider, rows[i]["pid"]))
        self.many("""update fixtures set kickoff_at = case when primary_source = %s then %s else kickoff_at end,
                     status = case when primary_source = %s then %s::fixture_status else status end,
                     round = coalesce(round, %s), venue = coalesce(venue, %s), last_synced_at = now() where id = %s""", updates)
        self.many("""insert into provider_mappings (entity_type, entity_id, provider_id, provider_entity_id) values ('fixture', %s, %s, %s)
                     on conflict do nothing""", maps)
        return fids

    def bulk_upsert_results(self, provider: str, items: list[tuple]) -> tuple[int, int]:
        """items: (fixture_id, (ft_h, ft_a), (ht_h, ht_a) | None, final). A locked final score that disagrees becomes a data conflict."""
        if not items:
            return 0, 0
        stored = {r["fixture_id"]: r for r in self.all(
            "select fixture_id, ft_home, ft_away, ht_home, ht_away, is_final, confirmed_by from match_results where fixture_id = any(%s)",
            ([i[0] for i in items],))}
        ups, conflicts = [], []
        for fid, ft, ht, final in items:
            c = stored.get(fid)
            if c and c["is_final"] and (c["ft_home"], c["ft_away"]) != tuple(ft):
                conflicts.append((fid, json.dumps({"stored": [c["ft_home"], c["ft_away"]], provider: list(ft)}), fid))
                continue
            same = c and (c["ft_home"], c["ft_away"]) == tuple(ft) and (ht is None or (c["ht_home"], c["ht_away"]) == tuple(ht)) \
                and (c["is_final"] or not final) and provider in (c["confirmed_by"] or [])
            if not same:
                ups.append((fid, ft[0], ft[1], ht[0] if ht else None, ht[1] if ht else None, final, provider))
        self.many(CONFLICT_SQL, conflicts)
        self.many(RESULT_SQL, ups)
        return len(items) - len(conflicts), len(conflicts)

    def bulk_inventory(self, rows: list[tuple]) -> None:
        """rows: (fixture_id, data_type, available, completeness, source). Writes only rows that changed."""
        if not rows:
            return
        stored = {(r["fixture_id"], r["data_type"]): r for r in self.all(
            "select fixture_id, data_type, available, completeness, source from fixture_data_inventory where fixture_id = any(%s)",
            (list({r[0] for r in rows}),))}
        r4 = lambda v: None if v is None else round(float(v), 4)  # noqa: E731 (real column → float rounding)
        changed = [r for r in rows if (e := stored.get((r[0], r[1]))) is None
                   or (e["available"], r4(e["completeness"]), e["source"]) != (r[2], r4(r[3]), r[4])]
        self.many(INVENTORY_SQL, changed)

    # ───────────── fixtures & results ─────────────
    def upsert_fixture(self, provider: str, provider_id: str | None, season_id: int, home_id: int, away_id: int, kickoff: datetime,
                       status: str, round_: str | None, venue: str | None = None) -> int:
        fid = None
        if provider_id:
            r = self.one("select entity_id from provider_mappings where provider_id = %s and entity_type = 'fixture' and provider_entity_id = %s", (provider, provider_id))
            fid = r["entity_id"] if r else None
        if fid is None:
            r = self.one("""select id from fixtures where season_id = %s and home_team_id = %s and away_team_id = %s
                            and abs(extract(epoch from (kickoff_at - %s)) ) <= 36*3600 order by abs(extract(epoch from (kickoff_at - %s))) limit 1""",
                         (season_id, home_id, away_id, kickoff, kickoff))
            fid = r["id"] if r else None
        if fid is None:
            fid = self.one("""insert into fixtures (season_id, home_team_id, away_team_id, kickoff_at, status, round, venue, primary_source)
                              values (%s, %s, %s, %s, %s, %s, %s, %s) returning id""", (season_id, home_id, away_id, kickoff, status, round_, venue, provider))["id"]
        else:
            # Only the primary (most reliable current) source may move kick-off times and statuses.
            self.run("""update fixtures set kickoff_at = case when primary_source = %s then %s else kickoff_at end,
                        status = case when primary_source = %s then %s::fixture_status else status end,
                        round = coalesce(round, %s), venue = coalesce(venue, %s), last_synced_at = now() where id = %s""",
                     (provider, kickoff, provider, status, round_, venue, fid))
        if provider_id:
            self.run("""insert into provider_mappings (entity_type, entity_id, provider_id, provider_entity_id) values ('fixture', %s, %s, %s)
                        on conflict do nothing""", (fid, provider, provider_id))
        return fid

    def upsert_result(self, fixture_id: int, ft: tuple[int, int], ht: tuple[int, int] | None, final: bool, provider: str) -> str:
        cur = self.one("select ft_home, ft_away, is_final, confirmed_by from match_results where fixture_id = %s", (fixture_id,))
        if cur and cur["is_final"] and (cur["ft_home"], cur["ft_away"]) != tuple(ft):
            self.run(CONFLICT_SQL, (fixture_id, json.dumps({"stored": [cur["ft_home"], cur["ft_away"]], provider: list(ft)}), fixture_id))
            return "conflict"
        self.run(RESULT_SQL, (fixture_id, ft[0], ft[1], ht[0] if ht else None, ht[1] if ht else None, final, provider))
        return "ok"

    def set_inventory(self, fixture_id: int, data_type: str, available: bool, completeness: float | None, source: str | None) -> None:
        self.run(INVENTORY_SQL, (fixture_id, data_type, available, completeness, source))

    # ───────────── logging ─────────────
    def log_sync(self, provider: str, job: str, endpoint: str, status: int | None, latency_ms: int | None, rows: int, quota: str | None = None,
                 error: str | None = None, payload: object | None = None) -> None:
        h = hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode()).hexdigest()[:16] if payload is not None else None
        self.run("""insert into provider_sync_logs (provider_id, job, endpoint, status_code, latency_ms, quota_remaining, rows_upserted, payload_hash, error)
                    values (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                 (provider, job, endpoint, status, latency_ms, int(quota) if quota and str(quota).isdigit() else None, rows, h, error))

    def job_finished(self, job: str, status: str) -> None:
        self.run("update scheduled_sync_jobs set last_run_at = now(), last_status = %s where job = %s", (status, job))


def utcnow() -> datetime:
    return datetime.now(timezone.utc)
