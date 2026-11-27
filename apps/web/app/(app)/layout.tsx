import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/shell'
import { getMyAccess, getShellInfo, schemaReady, viewerTimeZone } from '@/lib/data'
import { accessBadge, expiringSoon } from '@/lib/access'
import { AccessEnded } from '@/components/access-ended'
import { displayName } from '@/lib/identity'
import { getUser, isAdmin, supabaseConfigured } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: ReactNode }) {
  if (!supabaseConfigured()) redirect('/setup')
  const user = await getUser()
  // Only the public info pages (/responsible, /about) reach here signed out; the proxy redirects every other route.
  if (!user)
    return (
      <main className="mx-auto w-full max-w-[1100px] px-4 py-8 lg:px-7">
        <a href="/login" className="mb-6 inline-flex text-[13px] font-bold text-fg-3 hover:text-fg">← Sign in</a>
        {children}
      </main>
    )
  if (!(await schemaReady())) redirect('/setup?schema=missing')
  const admin = isAdmin(user)
  const [info, tz, access] = await Promise.all([getShellInfo(), viewerTimeZone(), getMyAccess()])
  if (!admin && !access.active) return <AccessEnded name={displayName(user.email)} plan={access.plan} until={access.until} />
  const accessInfo = admin ? null : { label: accessBadge(access), warn: expiringSoon(access) }
  return (
    <AppShell info={{ ...info, email: displayName(user.email), admin, tz, access: accessInfo }}>
      {children}
    </AppShell>
  )
}
