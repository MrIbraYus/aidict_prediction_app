import type { Metadata } from 'next'
import { Database, KeyRound, Terminal } from 'lucide-react'
import { supabaseConfigured } from '@/lib/supabase/server'
import { Card, Notice } from '@/components/ui/primitives'

export const metadata: Metadata = { title: 'Setup' }
export const dynamic = 'force-dynamic'

/** Shown only when the deployment is missing its Supabase settings. Never displays any key values. */
export default async function SetupPage({ searchParams }: { searchParams: Promise<{ schema?: string }> }) {
  const ok = supabaseConfigured()
  const schemaMissing = (await searchParams).schema === 'missing'
  return (
    <main className="mx-auto max-w-2xl px-5 py-14">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/aidict-icon.png" alt="AIDICT" className="mb-6 size-14 rounded-2xl" />
      <h1 className="text-[28px] font-extrabold">Finish setting up AIDICT</h1>
      <p className="mt-2 text-[14px] text-fg-3">The app needs its Supabase project settings before anyone can sign in. Values are read from environment variables on the server and are never shown here.</p>
      {ok && schemaMissing ? (
        <Notice tone="warn" className="mt-6" title="Signed in, but the database has no AIDICT tables yet.">
          Apply the schema (step 2 below), then <a href="/" className="font-bold underline">reload</a>.
        </Notice>
      ) : ok ? (
        <Notice tone="success" className="mt-6" title="Supabase settings found.">
          <a href="/login" className="font-bold underline">
            Continue to sign in
          </a>
        </Notice>
      ) : (
        <Notice tone="warn" className="mt-6" title="Supabase URL or publishable key is missing." />
      )}
      <Card className="mt-6 space-y-5 p-5">
        <Step icon={<KeyRound className="size-4" />} title="1 · Environment variables">
          In <code>.env.local</code> (local) or Vercel → Project → Settings → Environment Variables: <code>NEXT_PUBLIC_SUPABASE_URL</code>, <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> and, server-only, <code>SUPABASE_SECRET_KEY</code>. The secret key must never be prefixed with <code>NEXT_PUBLIC_</code>.
        </Step>
        <Step icon={<Database className="size-4" />} title="2 · Database schema">
          Supabase → SQL Editor → paste <code>supabase/apply-all.sql</code> → Run. Or set <code>SUPABASE_DB_URL</code> (Session pooler string) and run <code>npm run db:apply</code>.
        </Step>
        <Step icon={<Terminal className="size-4" />} title="3 · First data">
          <code>python -m aidict_data.jobs.sync_current</code>, then <code>python -m aidict_engine.jobs.gates</code> and <code>python -m aidict_engine.jobs.predict</code>. After that the scheduled jobs keep it current.
        </Step>
      </Card>
    </main>
  )
}

function Step({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-fg-2">{icon}</span>
      <div>
        <div className="text-[14px] font-bold text-fg">{title}</div>
        <p className="mt-1 text-[13px] leading-relaxed text-fg-3 [&_code]:rounded [&_code]:bg-surface-3 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[12px] [&_code]:text-fg-2">{children}</p>
      </div>
    </div>
  )
}
