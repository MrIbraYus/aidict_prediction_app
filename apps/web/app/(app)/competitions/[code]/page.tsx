import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getSavedIds, getStandings, viewerTimeZone } from '@/lib/data'
import { cx, fmtDate } from '@/lib/format'
import { Card, CardHeader, EmptyState, PageHeader, Table, Td, Th } from '@/components/ui/primitives'
import { MatchRow } from '@/components/sports/match'
import { Crest, FormPills } from '@/components/sports/identity'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  return { title: (await params).code.toUpperCase() }
}

export default async function CompetitionPage({ params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase()
  if (!/^[A-Z0-9]{2,5}$/.test(code)) notFound()
  const [{ competition, season, rows, upcoming }, tz, saved] = await Promise.all([getStandings(code), viewerTimeZone(), getSavedIds()])
  if (!competition) notFound()
  const isLeague = competition.type === 'LEAGUE'
  return (
    <>
      <PageHeader back={{ to: '/competitions', label: 'Competitions' }} eyebrow={`${competition.country ?? 'International'} · ${season ?? 'no current season'}`} title={competition.name} />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader title={isLeague ? 'Table' : 'Team records'} eyebrow="Computed from stored final results" />
          {rows.length === 0 ? (
            <EmptyState title="No results yet" body="The table fills in as the sync job stores final results." />
          ) : (
            <Table className="mt-2">
              <thead>
                <tr>
                  <Th>#</Th>
                  <Th>Team</Th>
                  <Th align="right">P</Th>
                  <Th align="right">W</Th>
                  <Th align="right">D</Th>
                  <Th align="right">L</Th>
                  <Th align="right">GD</Th>
                  <Th align="right">Pts</Th>
                  <Th>Form</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.team.id}>
                    <Td className={cx('num font-bold', i < 4 ? 'text-fg' : 'text-fg-3')}>{i + 1}</Td>
                    <Td>
                      <Link href={`/team/${r.team.id}`} className="flex items-center gap-2 font-semibold text-fg hover:text-brand-fg">
                        <Crest team={r.team} size={18} /> {r.team.name}
                      </Link>
                    </Td>
                    <Td align="right" className="num">{r.p}</Td>
                    <Td align="right" className="num">{r.w}</Td>
                    <Td align="right" className="num">{r.d}</Td>
                    <Td align="right" className="num">{r.l}</Td>
                    <Td align="right" className="num">{r.gf - r.ga > 0 ? '+' : ''}{r.gf - r.ga}</Td>
                    <Td align="right" className="num text-[15px] font-bold text-fg">{r.pts}</Td>
                    <Td>
                      <FormPills form={r.form} size="sm" />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          {!isLeague && rows.length > 0 && <p className="px-5 pb-4 text-[11px] text-fg-3">Cup and group competitions: records are combined across rounds, not an official group table.</p>}
        </Card>
        <Card>
          <CardHeader title="Next fixtures" eyebrow={upcoming.length ? `From ${fmtDate(upcoming[0].kickoff, tz)}` : 'None scheduled'} />
          <div className="space-y-2 p-3">
            {upcoming.map((f) => (
              <MatchRow key={f.id} f={f} tz={tz} saved={saved.has(f.id)} />
            ))}
            {upcoming.length === 0 && <p className="px-2 py-6 text-center text-[12px] text-fg-3">No upcoming fixtures stored.</p>}
          </div>
        </Card>
      </div>
    </>
  )
}
