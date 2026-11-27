// Applies every migration + seed to a real Postgres engine (PGlite, in-process) and verifies the security
// and integrity guarantees AIDICT depends on. Run: npm run db:test
// Supabase-provided pieces (auth schema, roles) are stubbed exactly as Supabase exposes them.
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
process.on('unhandledRejection', (e) => { console.error(`
✗ Unexpected error: ${e.message}${e.where ? `
  where: ${e.where}` : ''}${e.query ? `
  query: ${String(e.query).slice(0, 200)}` : ''}`); process.exit(1) })
const db = new PGlite()
let passed = 0
let failed = 0
const ok = (cond, name) => {
  if (cond) { passed++; console.log(`  ✓ ${name}`) } else { failed++; console.log(`  ✗ ${name}`) }
}
const expectError = async (sql, re, name) => {
  try { await db.exec(sql); ok(false, `${name} (no error raised)`) }
  catch (e) { ok(re.test(e.message), `${name} → ${e.message.split('\n')[0].slice(0, 90)}`) }
}
const asUser = async (claims, fn) => {
  await db.exec(`set role authenticated; select set_config('request.jwt.claims', '${JSON.stringify(claims)}', false);`)
  try { return await fn() } finally { await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`) }
}

// ── Supabase stubs ──
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_app_meta_data jsonb default '{}'::jsonb);
  create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
  grant usage on schema auth to anon, authenticated; grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`)

console.log('Applying migrations')
for (const f of readdirSync(join(root, 'migrations')).sort()) {
  await db.exec(readFileSync(join(root, 'migrations', f), 'utf8'))
  console.log(`  · ${f}`)
}
for (const f of readdirSync(join(root, 'seed')).sort()) {
  await db.exec(readFileSync(join(root, 'seed', f), 'utf8'))
  console.log(`  · seed/${f}`)
}

console.log('\nSchema')
const tables = (await db.query(`select count(*)::int n from information_schema.tables where table_schema = 'public'`)).rows[0].n
const rlsOff = (await db.query(`select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`)).rows
const policies = (await db.query(`select count(*)::int n from pg_policies where schemaname = 'public'`)).rows[0].n
const markets = (await db.query(`select count(*)::int n from market_definitions where category <> 'other'`)).rows[0].n
const predictions = (await db.query(`select (select count(*) from prediction_snapshots) + (select count(*) from smart_picks) + (select count(*) from predictions) as n`)).rows[0].n
ok(tables >= 45, `${tables} tables created`)
ok(rlsOff.length === 0, `RLS enabled on every table${rlsOff.length ? ' — missing: ' + rlsOff.map((r) => r.relname).join(', ') : ''}`)
ok(policies >= 50, `${policies} RLS policies`)
ok(markets === 24, `${markets} Smart Markets registered`)
ok(Number(predictions) === 0, 'seed contains no predictions')

console.log('\nIntegrity')
await db.exec(`
  insert into seasons (competition_id, label, is_current) select id, '2026-27', true from competitions where code = 'PL';
  insert into teams (sport_id, name) values (1, 'Arsenal'), (1, 'Chelsea');
  insert into fixtures (season_id, home_team_id, away_team_id, kickoff_at, primary_source)
    select s.id, (select id from teams where name='Arsenal'), (select id from teams where name='Chelsea'), '2026-11-28 17:30+00', 'football-data-org' from seasons s;
  insert into model_versions (model_id, version, trained_at, status) values ('football-dc', '1.0.0', now(), 'active');
`)
const kickoffDate = (await db.query(`select kickoff_date::text d from fixtures`)).rows[0].d
ok(kickoffDate === '2026-11-28', `kickoff_date maintained by trigger (${kickoffDate})`)
await expectError(`insert into fixtures (season_id, home_team_id, away_team_id, kickoff_at, primary_source) select season_id, home_team_id, away_team_id, kickoff_at + interval '2 hours', 'openligadb' from fixtures limit 1`, /duplicate key|fixtures_no_duplicates/, 'duplicate fixture from a second provider rejected')
const snap = `insert into prediction_snapshots (fixture_id, model_version_id, snapshot_at, horizon, lambda_home, lambda_away, score_matrix, inputs, input_hash, data_completeness)
  select f.id, (select id from model_versions limit 1), %AT%, '%H%', 1.81, 0.83, '{1,2,3}', '{}', 'sha256:test', 0.98 from fixtures f`
await db.exec(snap.replace('%AT%', `'2026-11-27 17:30+00'`).replace('%H%', 'T-24h'))
ok(true, 'snapshot before kick-off accepted')
await expectError(snap.replace('%AT%', `'2026-11-28 17:31+00'`).replace('%H%', 'T-2h'), /before kick-off/, 'snapshot after kick-off rejected')
await expectError(`update prediction_snapshots set lambda_home = 2.5`, /append-only/, 'published snapshot cannot be edited')
await expectError(`delete from prediction_snapshots`, /append-only/, 'published snapshot cannot be deleted')
await db.exec(`insert into smart_picks (snapshot_id, fixture_id, rank, market_id, outcome_key, probability, reliability, confidence, lift, score, reasons, published_at)
  select s.id, s.fixture_id, 1, 'corners-ou', 'co:o8.5', 0.78, 0.85, 'High', 0.17, 0.71, '["test"]', '2026-11-27 17:31+00' from prediction_snapshots s`)
ok(true, 'smart pick before kick-off accepted')
await expectError(`update smart_picks set probability = 0.9`, /append-only/, 'smart pick cannot be edited')
await db.exec(`insert into match_results (fixture_id, ft_home, ft_away, is_final) select id, 2, 1, true from fixtures`)
await expectError(`update match_results set ft_away = 2`, /locked/, 'final score locked outside conflict resolution')
await db.exec(`begin; select set_config('aidict.conflict_resolution', 'on', true); update match_results set ft_away = 2; rollback;`)
ok(true, 'final score editable inside conflict resolution')

console.log('\nRow Level Security')
const alice = '11111111-1111-1111-1111-111111111111'
const bob = '22222222-2222-2222-2222-222222222222'
await db.exec(`insert into auth.users (id, email) values ('${alice}', 'alice@example.com'), ('${bob}', 'bob@example.com')`)
ok((await db.query(`select count(*)::int n from user_profiles`)).rows[0].n === 2, 'sign-up trigger created profiles + preferences')
await db.exec(`insert into provider_payloads (provider_id, endpoint, request_hash, payload) values ('openligadb', '/x', 'h', '{}')`)

await db.exec(`set role anon`)
await expectError(`select * from fixtures`, /permission denied/, 'anonymous visitors cannot read fixtures')
await db.exec(`reset role`)

await asUser({ sub: alice, role: 'authenticated', app_metadata: { role: 'user' } }, async () => {
  ok((await db.query(`select count(*)::int n from fixtures`)).rows[0].n === 1, 'signed-in user reads fixtures')
  ok((await db.query(`select count(*)::int n from smart_picks`)).rows[0].n === 1, 'signed-in user reads smart picks')
  ok((await db.query(`select count(*)::int n from provider_payloads`)).rows[0].n === 0, 'non-admin sees no raw provider payloads')
  ok((await db.query(`select count(*)::int n from user_profiles`)).rows[0].n === 1, 'user sees only own profile')
  await db.exec(`insert into saved_matches (user_id, fixture_id) select '${alice}', id from fixtures`)
  ok(true, 'user saves a match for self')
})
await asUser({ sub: alice, role: 'authenticated' }, async () => {
  await expectError(`insert into saved_matches (user_id, fixture_id) select '${bob}', id from fixtures`, /row-level security/, 'user cannot save matches for someone else')
})
await asUser({ sub: alice, role: 'authenticated' }, async () => {
  await expectError(`update user_profiles set role = 'admin'`, /permission denied/, 'user cannot promote themself to admin')
})
await asUser({ sub: alice, role: 'authenticated' }, async () => {
  await expectError(`insert into fixtures (season_id, home_team_id, away_team_id, kickoff_at, primary_source) select season_id, away_team_id, home_team_id, kickoff_at, 'x' from fixtures`, /permission denied/, 'clients cannot write sports data')
})
await asUser({ sub: alice, role: 'authenticated' }, async () => {
  const r = await db.query(`update feature_flags set enabled = false where key = 'smart_markets'`)
  ok(r.affectedRows === 0, `non-admin update of a feature flag affects 0 rows (RLS filters it)`)
})
ok((await db.query(`select enabled from feature_flags where key = 'smart_markets'`)).rows[0].enabled === true, 'feature flag unchanged after non-admin attempt')
await asUser({ sub: bob, role: 'authenticated' }, async () => {
  ok((await db.query(`select count(*)::int n from saved_matches`)).rows[0].n === 0, "user cannot see another user's saved matches")
})
await asUser({ sub: bob, role: 'authenticated', app_metadata: { role: 'admin' } }, async () => {
  ok((await db.query(`select count(*)::int n from provider_payloads`)).rows[0].n === 1, 'admin reads provider payloads')
  await db.exec(`update feature_flags set enabled = false where key = 'in_play_model'`)
  ok(true, 'admin can toggle a feature flag')
})

console.log('\nAccess periods')
const carol = '33333333-3333-3333-3333-333333333333'
await db.exec(`update auth.users set raw_app_meta_data = '{"role":"admin"}' where id = '${bob}'`)
await db.exec(`insert into auth.users (id, email) values ('${carol}', 'carol@example.com')`)
const trial = (await db.query(`select plan, (access_until - now()) > interval '71 hours' as about3d from user_access where user_id = '${carol}'`)).rows[0]
ok(trial?.plan === 'trial' && trial.about3d, 'new account starts a 3-day trial')
ok((await db.query(`select count(*)::int n from notifications where user_id = '${bob}' and title = 'New account: carol'`)).rows[0].n === 1, 'every admin is notified of the sign-up')
ok((await db.query(`select count(*)::int n from notifications where user_id = '${alice}' and title like 'New account%'`)).rows[0].n === 0, 'members are not notified of sign-ups')
await asUser({ sub: carol, role: 'authenticated' }, async () => {
  ok((await db.query(`select count(*)::int n from fixtures`)).rows[0].n === 1, 'member in trial reads fixtures')
  await expectError(`update user_access set access_until = now() + interval '1 year'`, /permission denied/, 'member cannot extend their own access')
})
await db.exec(`update user_access set access_until = now() - interval '1 hour' where user_id = '${carol}'`)
await asUser({ sub: carol, role: 'authenticated' }, async () => {
  ok((await db.query(`select count(*)::int n from fixtures`)).rows[0].n === 0, 'expired member reads no fixtures')
  ok((await db.query(`select count(*)::int n from smart_picks`)).rows[0].n === 0, 'expired member reads no picks')
  ok((await db.query(`select count(*)::int n from user_access`)).rows[0].n === 1, 'expired member still sees their own access status')
})
await db.exec(`update user_access set plan = 'unlimited', access_until = null where user_id = '${carol}'`)
await asUser({ sub: carol, role: 'authenticated' }, async () => {
  ok((await db.query(`select count(*)::int n from fixtures`)).rows[0].n === 1, 'unlimited member reads fixtures again')
})
await asUser({ sub: bob, role: 'authenticated', app_metadata: { role: 'admin' } }, async () => {
  ok((await db.query(`select count(*)::int n from user_access`)).rows[0].n === 3, 'admin sees every account access row')
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
