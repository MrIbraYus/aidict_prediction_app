import type { Metadata } from 'next'
import Link from 'next/link'
import { LogOut } from 'lucide-react'
import { getPreferences, viewerTimeZone } from '@/lib/data'
import { signOut } from '@/lib/actions'
import { displayName } from '@/lib/identity'
import { getUser, isAdmin } from '@/lib/supabase/server'
import { Badge, Button, Card, CardHeader, PageHeader } from '@/components/ui/primitives'
import { ThemePicker } from '@/components/layout/theme-toggle'
import { NotificationSettings, TimeZoneSetting } from '@/components/settings-form'

export const metadata: Metadata = { title: 'Settings' }
export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const [user, prefs, tz] = await Promise.all([getUser(), getPreferences(), viewerTimeZone()])
  return (
    <>
      <PageHeader eyebrow="Preferences" title="Settings" />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Appearance" eyebrow="Saved on this device" />
          <div className="p-5">
            <ThemePicker />
            <p className="mt-3 text-[11px] text-fg-3">System follows your device setting and switches automatically when it changes.</p>
          </div>
        </Card>
        <Card>
          <CardHeader title="Time zone" eyebrow="Used for every date and kick-off time" />
          <div className="p-5">
            <TimeZoneSetting current={tz} />
          </div>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader title="Notifications" eyebrow="Per category" />
          <div className="p-5">
            <NotificationSettings initial={(prefs?.notification_prefs as Record<string, boolean>) ?? {}} />
          </div>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader title="Account" />
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-bold text-fg">{displayName(user?.email)}</div>
              <div className="mt-1 flex items-center gap-2 text-[12px] text-fg-3">
                {isAdmin(user) ? <Badge tone="brand">Owner · admin</Badge> : <Badge>Member</Badge>}
                <span>Joined {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-GB', { timeZone: tz }) : '—'}</span>
              </div>
            </div>
            <Link href="/reset-password" className="inline-flex h-10 items-center rounded-xl border border-line px-4 text-sm font-semibold text-fg hover:bg-surface-2">
              Change password
            </Link>
            <form action={signOut}>
              <Button type="submit" variant="danger">
                <LogOut className="size-4" /> Sign out
              </Button>
            </form>
          </div>
        </Card>
      </div>
    </>
  )
}
