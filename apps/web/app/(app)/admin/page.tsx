import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BarChart3, BookOpenCheck, Database, ShieldCheck, Users } from 'lucide-react'
import { getAdminOverview, getGates } from '@/lib/data'
import { relTime } from '@/lib/format'
import { getUser, isAdmin } from '@/lib/supabase/server'
import { Badge, Card, CardHeader, EmptyState, Kpi, Notice, PageHeader, Table, Td, Th } from '@/components/ui/primitives'
import { FlagSwitch, SignupSwitch } from '@/components/admin-controls'

export const metadata: Metadata = { title: 'Admin' }
export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const user = await getUser()
  if (!isAdmin(user)) notFound()
  const [o, gates] = await Promise.all([getAdminOverview(), getGates()])
  const signup = (o.settings.find((s: { key: string }) => s.key === 'signup')?.value as { open?: boolean } | undefined)?.open ?? false
  const selection = o.settings.find((s: { key: string }) => s.key === 'selection')?.value as Record<string, number> | undefined
  return (
    <>
      <PageHeader eyebrow="Owner" title="Admin" description="Owner controls, visible only to admins. Every change is written to the audit log, which cannot be edited or deleted." />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Active outcomes" value={gates.filter((g) => g.status === 'active').length} sub={`of ${gates.length} evaluated`} />
        <Kpi label="Open data conflicts" value={o.openConflicts} sub={o.openConflicts ? 'review below' : 'none'} />
        <Kpi label="Sign-up" value={signup ? 'Open' : 'Closed'} sub="new accounts" />
        <Kpi label="Feature flags" value={o.flags.filter((f: { enabled: boolean }) => f.enabled).length} sub={`of ${o.flags.length} on`} />
      </div>
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { href: '/admin/users', icon: Users, title: 'Users', body: 'Deactivate, reactivate or delete accounts; admin rights' },
          { href: '/providers', icon: Database, title: 'Data status', body: 'Pipeline jobs, data sources and request logs' },
          { href: '/performance', icon: BarChart3, title: 'Model performance', body: 'Backtests, market gates and calibration' },
        ].map((x) => (
          <Link key={x.href} href={x.href} className="card flex items-start gap-3 p-4 transition-transform hover:-translate-y-0.5">
            <x.icon className="mt-0.5 size-5 text-brand-fg" />
            <span>
              <span className="block text-[14px] font-bold text-fg">{x.title}</span>
              <span className="block text-[12px] text-fg-3">{x.body}</span>
            </span>
          </Link>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Access" icon={<ShieldCheck className="size-4 text-brand-fg" />} />
          <div className="space-y-4 p-5">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="text-[13px] font-bold">Allow new sign-ups</div>
                <div className="text-[12px] text-fg-3">When on, anyone can create a free member account. New accounts are always members, never admins.</div>
              </div>
              <SignupSwitch open={signup} />
            </div>
            <Notice tone="neutral" title="Password and email settings live in Supabase">
              Supabase → Authentication → Providers / Email for confirmation emails, password rules and leaked-password protection.
            </Notice>
          </div>
        </Card>
        <Card>
          <CardHeader title="Feature flags" />
          <ul className="divide-y divide-line px-5 pb-2">
            {o.flags.map((f: { key: string; enabled: boolean; description: string }) => (
              <li key={f.key} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-fg">{f.description}</div>
                  <div className="text-[11px] text-fg-3">{f.key}</div>
                </div>
                <FlagSwitch flag={f.key} enabled={f.enabled} label={f.description} />
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Pick selection rules" eyebrow="app_settings.selection (read-only here)" />
          <div className="grid grid-cols-2 gap-2 p-5 text-[12px]">
            {selection ? (
              Object.entries(selection).map(([k, v]) => (
                <div key={k} className="card-inset flex justify-between px-3 py-2">
                  <span className="text-fg-3">{k.replace(/_/g, ' ')}</span>
                  <span className="num font-bold">{String(v)}</span>
                </div>
              ))
            ) : (
              <span className="text-fg-3">Not seeded.</span>
            )}
          </div>
          <p className="px-5 pb-4 text-[11px] text-fg-3">These thresholds are pre-registered. Changing them is a model change and goes through the backtest first.</p>
        </Card>
        <Card>
          <CardHeader title="Data conflicts" eyebrow="Sources disagreeing on a final result" />
          {o.conflicts.length === 0 ? (
            <EmptyState title="No conflicts" body="When two providers disagree on a locked result, it appears here instead of silently overwriting." />
          ) : (
            <Table className="mt-2">
              <thead>
                <tr>
                  <Th>Fixture</Th>
                  <Th>Field</Th>
                  <Th>Status</Th>
                  <Th>Raised</Th>
                </tr>
              </thead>
              <tbody>
                {o.conflicts.map((c: { id: number; fixture_id: number; field: string; status: string; created_at: string }) => (
                  <tr key={c.id}>
                    <Td>
                      <Link href={`/match/${c.fixture_id}?tab=data`} className="font-semibold text-brand-fg">
                        #{c.fixture_id}
                      </Link>
                    </Td>
                    <Td>{c.field}</Td>
                    <Td>
                      <Badge tone={c.status === 'open' ? 'danger' : 'success'}>{c.status}</Badge>
                    </Td>
                    <Td>{relTime(c.created_at)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader title="Methodology" icon={<BookOpenCheck className="size-4 text-brand-fg" />} eyebrow="Owner only · never shown to members" />
          <ol className="grid gap-3 p-5 text-[12.5px] text-fg-2 md:grid-cols-2">
            <li><b className="text-fg">Goals model (1.1.0).</b> Dixon–Coles attack/defence ratings (ξ = 0.0019/day, 3-year window, low-score correction) blended 50/50 in log space with shots-on-target ratings × goals per shot on target.</li>
            <li><b className="text-fg">Markets.</b> Every goal market is summed from one score matrix; goal-order markets enumerate every scoring sequence (Bundesliga goal minutes).</li>
            <li><b className="text-fg">Corners.</b> Team corner ratings (Poisson GLM with intercept and home advantage) with negative-binomial over-dispersion fitted per league.</li>
            <li><b className="text-fg">Calibration.</b> Platt scaling per league, fitted out-of-fold on walk-forward predictions only.</li>
            <li><b className="text-fg">Gates.</b> n ≥ 1,000 out-of-sample, bootstrap 95% CI of log loss vs base rate below zero, ECE ≤ 0.03 (0.04 three-way), two consecutive weekly passes.</li>
            <li><b className="text-fg">Selection.</b> p ≥ 0.60, reliability ≥ 0.62, lift ≥ 3 pts, base ≤ 85%, φ ≤ 0.5, one outcome per market, max 5. Score = 0.45p + 0.30 reliability + 0.25 lift/0.2.</li>
          </ol>
          <p className="px-5 pb-4 text-[11px] text-fg-3">Full evidence: documentation/MARKET_RESEARCH.md and BACKTEST_RESULTS.md in the repository.</p>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader title="Audit log" eyebrow="Latest 25" />
          {o.audit.length === 0 ? (
            <EmptyState title="No entries yet" />
          ) : (
            <Table className="mt-2">
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Action</Th>
                  <Th>Entity</Th>
                  <Th>Actor</Th>
                </tr>
              </thead>
              <tbody>
                {o.audit.map((a: { id: number; actor: string | null; action: string; entity: string; entity_id: string | null; created_at: string }) => (
                  <tr key={a.id}>
                    <Td>{relTime(a.created_at)}</Td>
                    <Td className="font-semibold text-fg">{a.action}</Td>
                    <Td>
                      {a.entity}
                      {a.entity_id && a.entity_id !== a.actor ? ` · ${a.entity_id}` : ''}
                    </Td>
                    <Td className="text-[12px]">{a.actor === user!.id ? 'you' : a.actor ? a.actor.slice(0, 8) : 'system'}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </>
  )
}
