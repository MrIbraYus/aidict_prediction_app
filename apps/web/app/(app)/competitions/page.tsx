import type { Metadata } from 'next'
import Link from 'next/link'
import { getCompetitions, getGates } from '@/lib/data'
import { FLAG_BY_CODE } from '@/lib/format'
import { Badge, Card, EmptyState, PageHeader, Progress } from '@/components/ui/primitives'
import { Flag } from '@/components/sports/identity'

export const metadata: Metadata = { title: 'Competitions' }
export const dynamic = 'force-dynamic'

export default async function CompetitionsPage() {
  const [comps, gates] = await Promise.all([getCompetitions(), getGates()])
  const active = new Map<string, number>()
  for (const g of gates) if (g.status === 'active') active.set(g.competition, (active.get(g.competition) ?? 0) + 1)
  return (
    <>
      <PageHeader eyebrow="Football" title="Competitions" description="Competitions AIDICT tracks. Standings are computed from stored final results, so they match the data the model sees." />
      {comps.length === 0 ? (
        <Card>
          <EmptyState title="No competitions yet" body="Apply the database schema and seed, then run the sync job." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {comps.map((c) => (
            <Link key={c.code} href={`/competitions/${c.code}`} className="card block p-5 transition-transform hover:-translate-y-0.5">
              <div className="flex items-center gap-2.5">
                <Flag code={FLAG_BY_CODE[c.code] ?? 'eur'} />
                <span className="text-[15px] font-bold text-fg">{c.name}</span>
                <span className="ml-auto text-[11px] font-bold text-fg-3">{c.code}</span>
              </div>
              <div className="mt-1 text-[12px] text-fg-3">
                {c.country ?? 'International'} · {c.season ?? 'season not synced'}
              </div>
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-[11px] font-semibold text-fg-3">
                  <span>Season progress</span>
                  <span className="num">
                    {c.results}/{c.fixtures}
                  </span>
                </div>
                <Progress value={c.fixtures ? c.results / c.fixtures : 0} height={5} />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {active.get(c.code) ? <Badge tone="success">{active.get(c.code)} validated outcomes</Badge> : <Badge tone="warn">Model validating</Badge>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
