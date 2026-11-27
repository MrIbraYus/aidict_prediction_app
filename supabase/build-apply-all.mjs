// Regenerates supabase/apply-all.sql from the migrations and seed, in order. Run: npm run db:bundle
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const parts = [
  ...readdirSync(join(root, 'migrations')).filter((f) => f.endsWith('.sql')).sort().map((f) => `migrations/${f}`),
  ...readdirSync(join(root, 'seed')).filter((f) => f.endsWith('.sql')).sort().map((f) => `seed/${f}`),
]
let out = '-- AIDICT: complete schema + reference seed (generated from supabase/migrations and supabase/seed).\n'
out += '-- Run once in Supabase Dashboard -> SQL Editor -> New query -> paste -> Run. Safe on an empty project.\n'
for (const p of parts) out += `\n-- ===== supabase/${p} =====\n` + readFileSync(join(root, p), 'utf8').trimEnd() + '\n'
writeFileSync(join(root, 'apply-all.sql'), out)
console.log(`apply-all.sql: ${parts.length} files, ${out.length.toLocaleString()} chars`)
