import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getSavedIds, getTeam, viewer, viewerTimeZone } from '@/lib/data'
import { Card, CardHeader, PageHeader } from '@/components/ui/primitives'
import { isDone, MatchRow } from '@/components/sports/match'
import { Crest, FormPills } from '@/components/sports/identity'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const t = await getTeam(Number((await params).id)).catch(() => null)
  return { title: t?.team.name ?? 'Team' }
}

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id)
  if (!Number.isInteger(id) || id <= 0) notFound()
  const [data, tz, saved, { admin }] = await Promise.all([getTeam(id), viewerTimeZone(), getSavedIds(), viewer()])
  if (!data) notFound()
  const { team, badge, fixtures } = data
  const played = fixtures.filter((f) => isDone(f) && f.score)
  const upcoming = fixtures.filter((f) => !isDone(f)).reverse().slice(0, 6)
  const form = played.slice(0, 10).map((f) => {
    const [a, b] = f.home.id === id ? f.score! : [f.score![1], f.score![0]]
    return a > b ? 'W' : a < b ? 'L' : ('D' as 'W' | 'D' | 'L')
  })
  return (
    <>
      <PageHeader back={{ to: '/competitions', label: 'Competitions' }} title={team.name} eyebrow={team.kind === 'national-flag' ? 'National team' : 'Club'} />
      <Card className="mb-5 flex flex-col items-center gap-4 p-6 sm:flex-row">
        <Crest team={team} size={84} />
        <div className="text-center sm:text-left">
          <div className="text-[20px] font-extrabold">{team.name}</div>
          {form.length > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[12px] text-fg-3">Last {form.length}</span>
              <FormPills form={form} />
            </div>
          )}
          {admin && badge?.source_url && <div className="mt-2 text-[11px] text-fg-3">Badge source: {new URL(badge.source_url).hostname}</div>}
        </div>
      </Card>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Upcoming" />
          <div className="space-y-2 p-3">
            {upcoming.map((f) => (
              <MatchRow key={f.id} f={f} tz={tz} showComp saved={saved.has(f.id)} />
            ))}
            {upcoming.length === 0 && <p className="px-2 py-6 text-center text-[12px] text-fg-3">No upcoming fixtures stored.</p>}
          </div>
        </Card>
        <Card>
          <CardHeader title="Recent results" />
          <div className="space-y-2 p-3">
            {played.slice(0, 12).map((f) => (
              <MatchRow key={f.id} f={f} tz={tz} showComp saved={saved.has(f.id)} />
            ))}
            {played.length === 0 && <p className="px-2 py-6 text-center text-[12px] text-fg-3">No results stored.</p>}
          </div>
        </Card>
      </div>
    </>
  )
}
