// Local Postgres for integration tests and dry runs (no Docker): PGlite + Supabase stubs + all migrations + seed,
// exposed over the Postgres wire protocol. Usage: node supabase/tests/local-postgres.mjs [port]
// Connection string: postgresql://postgres:postgres@127.0.0.1:<port>/postgres?sslmode=disable
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const port = Number(process.argv[2] ?? 5544)
const db = await PGlite.create()
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_app_meta_data jsonb default '{}'::jsonb);
  create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
`)
for (const f of readdirSync(join(root, 'migrations')).sort()) await db.exec(readFileSync(join(root, 'migrations', f), 'utf8'))
for (const f of readdirSync(join(root, 'seed')).sort()) await db.exec(readFileSync(join(root, 'seed', f), 'utf8'))
const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1' })
await server.start()
console.log(`READY postgresql://postgres:postgres@127.0.0.1:${port}/postgres?sslmode=disable`)
process.on('SIGINT', async () => { await server.stop(); await db.close(); process.exit(0) })
