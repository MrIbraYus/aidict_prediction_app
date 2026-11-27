import type { Metadata } from 'next'
import Link from 'next/link'
import { Star } from 'lucide-react'
import { getSavedFixtures, viewerTimeZone } from '@/lib/data'
import { Card, CardHeader, EmptyState, PageHeader } from '@/components/ui/primitives'
import { isDone, MatchRow } from '@/components/sports/match'

export const metadata: Metadata = { title: 'Saved' }
export const dynamic = 'force-dynamic'

export default async function SavedPage() {
  const [list, tz] = await Promise.all([getSavedFixtures(), viewerTimeZone()])
  const upcoming = list.filter((f) => !isDone(f))
  const finished = list.filter(isDone).reverse()
  return (
    <>
      <PageHeader eyebrow="Your list" title="Saved matches" description="Matches you starred. Saved matches are private to your account." />
      {list.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Star className="size-6" />}
            title="Nothing saved yet"
            body="Tap the star on any match to keep it here."
            action={
              <Link href="/matches" className="inline-flex h-10 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-hover">
                Browse matches
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <Card>
            <CardHeader title="Upcoming" eyebrow={`${upcoming.length} matches`} />
            <div className="space-y-2 p-3">
              {upcoming.map((f) => (
                <MatchRow key={f.id} f={f} tz={tz} showComp saved />
              ))}
              {upcoming.length === 0 && <p className="px-2 py-6 text-center text-[12px] text-fg-3">No upcoming saved matches.</p>}
            </div>
          </Card>
          <Card>
            <CardHeader title="Finished" eyebrow={`${finished.length} matches`} />
            <div className="space-y-2 p-3">
              {finished.map((f) => (
                <MatchRow key={f.id} f={f} tz={tz} showComp saved />
              ))}
              {finished.length === 0 && <p className="px-2 py-6 text-center text-[12px] text-fg-3">No finished saved matches.</p>}
            </div>
          </Card>
        </div>
      )}
    </>
  )
}
