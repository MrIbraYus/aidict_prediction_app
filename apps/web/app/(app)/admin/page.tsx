import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
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
      <PageHeader eyebrow="Owner" title="Admin" description="Workspace controls. Every change is written to the audit log, which cannot be edited or deleted." />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Active outcomes" value={gates.filter((g) => g.status === 'active').length} sub={`of ${gates.length} evaluated`} />
        <Kpi label="Open data conflicts" value={o.openConflicts} sub={o.openConflicts ? 'review below' : 'none'} />
        <Kpi label="Sign-up" value={signup ? 'Open' : 'Closed'} sub="new accounts" />
        <Kpi label="Feature flags" value={o.flags.filter((f: { enabled: boolean }) => f.enabled).length} sub={`of ${o.flags.length} on`} />
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Access" icon={<ShieldCheck className="size-4 text-brand-fg" />} />
          <div className="space-y-4 p-5">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="text-[13px] font-bold">Allow new sign-ups</div>
                <div className="text-[12px] text-fg-3">Turn on briefly to let a tester create an account, then turn it off again. New accounts are members, not admins.</div>
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
