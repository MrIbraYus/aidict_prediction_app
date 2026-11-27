import type { Metadata } from 'next'
import Link from 'next/link'
import { Bell, CheckCheck } from 'lucide-react'
import { getNotifications } from '@/lib/data'
import { markAllRead } from '@/lib/actions'
import { cx, relTime } from '@/lib/format'
import { Badge, Button, Card, EmptyState, PageHeader } from '@/components/ui/primitives'

export const metadata: Metadata = { title: 'Notifications' }
export const dynamic = 'force-dynamic'

const TONE: Record<string, 'brand' | 'live' | 'success' | 'info' | 'neutral' | 'warn'> = { prediction: 'brand', kickoff: 'info', live: 'live', goal: 'live', finished: 'neutral', settled: 'success', system: 'warn' }

export default async function NotificationsPage() {
  const list = await getNotifications()
  const unread = list.filter((n) => !n.read_at).length
  return (
    <>
      <PageHeader
        eyebrow="Inbox"
        title="Notifications"
        description="Alerts for saved matches and new predictions. Choose what you receive in Settings."
        actions={
          unread > 0 && (
            <form action={markAllRead}>
              <Button type="submit" variant="outline" size="sm">
                <CheckCheck className="size-4" /> Mark all read
              </Button>
            </form>
          )
        }
      />
      <Card>
        {list.length === 0 ? (
          <EmptyState icon={<Bell className="size-6" />} title="No notifications yet" body="Save a match to get kick-off and result alerts. New-prediction alerts arrive when snapshots publish." />
        ) : (
          <ul className="divide-y divide-line">
            {list.map((n) => (
              <li key={n.id} className={cx('flex items-start gap-3 px-5 py-4', !n.read_at && 'bg-surface-2/50')}>
                <span className={cx('mt-1.5 size-2 shrink-0 rounded-full', n.read_at ? 'bg-transparent' : 'bg-brand')} aria-label={n.read_at ? undefined : 'Unread'} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-bold text-fg">{n.title}</span>
                    <Badge tone={TONE[n.category] ?? 'neutral'}>{n.category}</Badge>
                  </div>
                  <p className="mt-0.5 text-[13px] text-fg-2">{n.body}</p>
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-fg-3">
                    <span>{relTime(n.created_at)}</span>
                    {n.fixture_id && (
                      <Link href={`/match/${n.fixture_id}`} className="font-bold text-brand-fg hover:underline">
                        Open match →
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}
