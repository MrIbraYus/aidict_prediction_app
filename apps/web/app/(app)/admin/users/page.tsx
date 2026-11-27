import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { viewer, viewerTimeZone } from '@/lib/data'
import { displayName, isUsernameLogin } from '@/lib/identity'
import { fmtDate, relTime } from '@/lib/format'
import { createServiceClient } from '@/lib/supabase/server'
import { Badge, Card, CardHeader, EmptyState, Kpi, PageHeader, Table, Td, Th } from '@/components/ui/primitives'
import { UserControls } from '@/components/user-controls'
import { AccessControl } from '@/components/access-control'
import { accessFrom, expiringSoon, timeLeft, type AccessPlan } from '@/lib/access'

export const metadata: Metadata = { title: 'Users' }
export const dynamic = 'force-dynamic'

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; s?: string; a?: string }> }) {
  const me = await viewer()
  if (!me.admin) notFound()
  const sp = await searchParams
  const tz = await viewerTimeZone()
  const db = createServiceClient()
  const [{ data, error }, { data: accessRows }] = await Promise.all([db.auth.admin.listUsers({ page: 1, perPage: 1000 }), db.from('user_access').select('user_id,plan,access_until')])
  const accessBy = new Map((accessRows ?? []).map((r) => [r.user_id as string, r as { plan: AccessPlan; access_until: string | null }]))
  const now = Date.now()
  const all = (data?.users ?? [])
    .map((u) => {
      const banned = !!u.banned_until && new Date(u.banned_until).getTime() > now
      return {
        id: u.id, name: displayName(u.email), login: isUsernameLogin(u.email) ? 'username' : 'email', email: isUsernameLogin(u.email) ? null : u.email,
        owner: u.app_metadata?.owner === true, admin: u.app_metadata?.role === 'admin', created: u.created_at, lastSignIn: u.last_sign_in_at ?? null,
        status: banned ? 'deactivated' : u.email_confirmed_at ? 'active' : 'unconfirmed', me: u.id === me.user?.id,
        access: accessFrom(accessBy.get(u.id) ?? null, u.app_metadata?.role === 'admin'),
      }
    })
    .sort((a, b) => Number(b.owner) - Number(a.owner) || b.created.localeCompare(a.created))
  const q = (sp.q ?? '').trim().toLowerCase()
  const accessMatch = (u: (typeof all)[number]) =>
    !sp.a || (sp.a === 'trial' ? u.access.plan === 'trial' && u.access.active : sp.a === 'expiring' ? expiringSoon(u.access) : sp.a === 'expired' ? !u.access.active : u.access.plan === 'unlimited')
  const users = all.filter((u) => (!q || u.name.toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q)) && (!sp.s || u.status === sp.s) && accessMatch(u))
  const count = (s: string) => all.filter((u) => u.status === s).length
  return (
    <>
      <PageHeader back={{ to: '/admin', label: 'Admin' }} eyebrow="Owner" title="Users" description="Everyone with an AIDICT account. Deactivated accounts cannot sign in; their data is kept until you delete them." />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Accounts" value={all.length} />
        <Kpi label="Active" value={count('active')} />
        <Kpi label="Access ended" value={all.filter((u) => !u.access.active).length} sub={`${all.filter((u) => expiringSoon(u.access)).length} ending within 3 days`} />
        <Kpi label="Admins" value={all.filter((u) => u.admin).length} sub={`incl. you (${me.owner ? 'owner' : 'admin'})`} />
      </div>
      <Card>
        <CardHeader title="Accounts" eyebrow={`${users.length} shown`} />
        <form className="flex flex-wrap gap-2 px-5 pt-3" action="/admin/users">
          <input name="q" defaultValue={sp.q} placeholder="Search name or email" aria-label="Search accounts" className="h-9 w-full max-w-xs rounded-xl border border-line bg-surface-2 px-3 text-[16px] sm:text-[13px]" />
          <select name="s" defaultValue={sp.s ?? ''} aria-label="Status" className="h-9 rounded-xl border border-line bg-surface-2 px-2 text-[13px]">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="deactivated">Deactivated</option>
            <option value="unconfirmed">Unconfirmed</option>
          </select>
          <select name="a" defaultValue={sp.a ?? ''} aria-label="Access" className="h-9 rounded-xl border border-line bg-surface-2 px-2 text-[13px]">
            <option value="">All access</option>
            <option value="trial">Free trial</option>
            <option value="expiring">Ending within 3 days</option>
            <option value="expired">Access ended</option>
            <option value="unlimited">Unlimited</option>
          </select>
          <button className="h-9 rounded-xl border border-line px-3 text-[13px] font-semibold hover:bg-surface-2">Filter</button>
        </form>
        {error ? (
          <EmptyState title="Could not load accounts" body={error.message} />
        ) : users.length === 0 ? (
          <EmptyState title="No accounts match" />
        ) : (
          <Table className="mt-3">
            <thead>
              <tr>
                <Th>Account</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th>Access</Th>
                <Th>Joined</Th>
                <Th>Last sign-in</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <Td className="font-semibold text-fg">
                    {u.name} {u.me && <span className="text-[11px] font-medium text-fg-3">(you)</span>}
                    <div className="text-[11px] font-medium text-fg-3">{u.email ?? 'username sign-in'}</div>
                  </Td>
                  <Td>{u.owner ? <Badge tone="brand">Owner</Badge> : u.admin ? <Badge tone="info">Admin</Badge> : <Badge>Member</Badge>}</Td>
                  <Td>
                    <Badge tone={u.status === 'active' ? 'success' : u.status === 'deactivated' ? 'danger' : 'warn'} dot>
                      {u.status}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="space-y-1.5">
                      <Badge tone={u.access.plan === 'unlimited' ? 'brand' : !u.access.active ? 'danger' : expiringSoon(u.access) ? 'warn' : 'success'}>
                        {u.access.plan === 'unlimited' ? 'Unlimited' : `${u.access.plan === 'trial' ? 'Trial' : 'Period'} · ${timeLeft(u.access)}`}
                      </Badge>
                      {u.access.until && <div className="text-[11px] text-fg-3">{u.access.active ? 'until' : 'ended'} {fmtDate(u.access.until, tz)}</div>}
                      {!(u.me || u.owner || u.admin) && <AccessControl id={u.id} name={u.name} />}
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap">{fmtDate(u.created, tz)}</Td>
                  <Td className="whitespace-nowrap">{u.lastSignIn ? relTime(u.lastSignIn) : 'never'}</Td>
                  <Td>
                    <UserControls id={u.id} name={u.name} active={u.status !== 'deactivated'} isAdminUser={u.admin} canManageAdmins={me.owner} locked={u.me || u.owner || (u.admin && !me.owner)} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  )
}
