import type { Metadata } from 'next'
import Link from 'next/link'
import { ListChecks } from 'lucide-react'
import { getFixtures, getGates, viewerTimeZone } from '@/lib/data'
import { cx, fmtDate, fmtDay, fmtTime, FLAG_BY_CODE, pct } from '@/lib/format'
import type { FixtureVM, PickVM } from '@/lib/types'
import { Badge, Card, CardHeader, EmptyState, Notice, PageHeader, Table, Td, Th } from '@/components/ui/primitives'
import { ConfidenceBadge } from '@/components/sports/match'
import { Crest, Flag } from '@/components/sports/identity'

export const metadata: Metadata = { title: 'Smart Picks' }
export const dynamic = 'force-dynamic'

export default async function SmartPicksPage({ searchParams }: { searchParams: Promise<{ conf?: string; c?: string }> }) {
  const sp = await searchParams
  const tz = await viewerTimeZone()
  const [fixtures, gates] = await Promise.all([getFixtures({ from: new Date().toISOString(), to: new Date(Date.now() + 8 * 86400000).toISOString(), withPicks: true, competition: sp.c }), getGates()])
  const conf = sp.conf === 'High' || sp.conf === 'Medium' ? sp.conf : undefined
  const rows: { f: FixtureVM; p: PickVM }[] = fixtures
    .flatMap((f) => (f.picks ?? []).map((p) => ({ f, p })))
    .filter((x) => !conf || x.p.confidence === conf || (conf === 'Medium' && x.p.confidence === 'High'))
    .sort((a, b) => a.f.kickoff.localeCompare(b.f.kickoff) || a.p.rank - b.p.rank)
  const predicted = fixtures.filter((f) => f.snapshot)
  const noPick = predicted.filter((f) => !(f.picks?.length ?? 0)).length
  const byComp = new Map<string, { active: number; total: number }>()
  for (const g of gates) {
    const v = byComp.get(g.competition) ?? { active: 0, total: 0 }
    v.total++
    if (g.status === 'active') v.active++
    byComp.set(g.competition, v)
  }
  const byMatch = new Map<number, { f: FixtureVM; picks: PickVM[] }>()
  for (const r of rows) byMatch.set(r.f.id, { f: r.f, picks: [...(byMatch.get(r.f.id)?.picks ?? []), r.p] })
  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries({ conf, c: sp.c, ...patch })) if (v) p.set(k, v)
    return `/markets?${p}`
  }
  return (
    <>
      <PageHeader
        eyebrow="Next 8 days"
        title="Smart Picks"
        description="Up to five outcomes per match, chosen only from markets that passed walk-forward backtests and calibration checks, then de-duplicated so the picks are not near-copies of each other. Fewer than five means the evidence was not strong enough."
      />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Matches predicted', predicted.length],
          ['Published picks', rows.length],
          ['Matches without a pick', noPick],
          ['Active outcomes (all comps)', gates.filter((g) => g.status === 'active').length],
        ].map(([k, v]) => (
          <div key={k as string} className="card-inset p-4">
            <div className="eyebrow">{k}</div>
            <div className="num mt-1.5 text-[26px] font-bold leading-none">{v}</div>
          </div>
        ))}
      </div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {[
          [undefined, 'All confidence'],
          ['Medium', 'Medium and high'],
          ['High', 'High only'],
        ].map(([v, l]) => (
          <Link key={l} href={href({ conf: v })} scroll={false} className={cx('inline-flex h-8 items-center rounded-full border px-3 text-[12px] font-semibold', conf === v ? 'border-transparent bg-fg text-fg-inverse' : 'border-line bg-surface-1 text-fg-2 hover:text-fg')}>
            {l}
          </Link>
        ))}
        {sp.c && (
          <Link href={href({ c: undefined })} className="inline-flex h-8 items-center rounded-full border border-line px-3 text-[12px] font-semibold text-fg-2">
            {sp.c} ✕
          </Link>
        )}
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-3">
          {byMatch.size === 0 ? (
            <Card>
              <EmptyState icon={<ListChecks className="size-6" />} title="No picks in the next 8 days" body={predicted.length ? 'Predictions exist, but no outcome cleared every filter. That is the system working as intended.' : 'Previews are published up to 7 days before kick-off.'} />
            </Card>
          ) : (
            [...byMatch.values()].map(({ f, picks }) => (
              <Card key={f.id} className="overflow-hidden">
                <Link href={`/match/${f.id}`} className="flex items-center gap-3 border-b border-line px-4 py-3 hover:bg-surface-2">
                  <div className="w-14 shrink-0 text-center">
                    <div className="text-[11px] font-bold text-fg-3">
                      {fmtDay(f.kickoff, tz)} {fmtDate(f.kickoff, tz)}
                    </div>
                    <div className="num text-[15px] font-bold">{fmtTime(f.kickoff, tz)}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[14px] font-bold">
                      <Crest team={f.home} size={18} /> <span className="truncate">{f.home.short}</span> <span className="text-fg-3">v</span> <Crest team={f.away} size={18} /> <span className="truncate">{f.away.short}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-fg-3">
                      <Flag code={FLAG_BY_CODE[f.competition.code] ?? 'eur'} /> {f.competition.name}
                    </div>
                  </div>
                  <Badge>{picks.length}/5</Badge>
                </Link>
                <div className="divide-y divide-line">
                  {picks.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="num w-5 text-[13px] font-bold text-fg-3">{p.rank}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-bold text-fg">{p.label}</div>
                        <div className="truncate text-[11px] text-fg-3">
                          {p.marketName} · base {pct(p.p - p.lift)} · reliability {Math.round(p.reliability * 100)}
                        </div>
                      </div>
                      <span className="num text-[16px] font-bold">{pct(p.p)}</span>
                      <ConfidenceBadge c={p.confidence} />
                    </div>
                  ))}
                </div>
              </Card>
            ))
          )}
        </div>
        <div className="space-y-5">
          <Card>
            <CardHeader title="Validated outcomes by competition" eyebrow="Active = passed two consecutive backtests" />
            {byComp.size === 0 ? (
              <EmptyState title="No gates evaluated yet" body="Run the weekly gates job to evaluate every market per competition." />
            ) : (
              <Table className="mt-2 [&_table]:min-w-0">
                <thead>
                  <tr>
                    <Th>Competition</Th>
                    <Th align="right">Active</Th>
                    <Th align="right">Evaluated</Th>
                  </tr>
                </thead>
                <tbody>
                  {[...byComp.entries()].map(([c, v]) => (
                    <tr key={c}>
                      <Td className="font-semibold text-fg">
                        <Link href={href({ c })} className="inline-flex items-center gap-2 hover:text-brand-fg">
                          <Flag code={FLAG_BY_CODE[c] ?? 'eur'} /> {c}
                        </Link>
                      </Td>
                      <Td align="right" className="num font-bold text-success">
                        {v.active}
                      </Td>
                      <Td align="right" className="num">
                        {v.total}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
          <Notice tone="neutral" title="How a pick is chosen">
            Probability ≥ 60%, reliability ≥ 0.62, at least 3 points above the base rate, base rate ≤ 85%, correlation with stronger picks ≤ 0.5, and an active gate for this competition. Confidence reflects reliability, not certainty.
          </Notice>
        </div>
      </div>
    </>
  )
}
