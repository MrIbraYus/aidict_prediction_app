import type { Metadata } from 'next'
import Link from 'next/link'
import { History } from 'lucide-react'
import { getHistory, viewerTimeZone } from '@/lib/data'
import { cx, fmtDate, pct } from '@/lib/format'
import { Badge, Card, EmptyState, PageHeader, Table, Td, Th } from '@/components/ui/primitives'
import { Crest } from '@/components/sports/identity'

export const metadata: Metadata = { title: 'Prediction history' }
export const dynamic = 'force-dynamic'

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const sp = await searchParams
  const tz = await viewerTimeZone()
  const all = await getHistory(400)
  const settled = all.filter((h) => h.result === 'won' || h.result === 'lost')
  const won = settled.filter((h) => h.result === 'won').length
  const expected = settled.reduce((a, h) => a + h.p, 0)
  const filter = sp.r === 'won' || sp.r === 'lost' || sp.r === 'pending' ? sp.r : 'all'
  const rows = all.filter((h) => (filter === 'all' ? true : filter === 'pending' ? !h.result : h.result === filter))
  const byConf = (['High', 'Medium', 'Low'] as const).map((c) => {
    const s = settled.filter((h) => h.confidence === c)
    return { c, n: s.length, hit: s.filter((h) => h.result === 'won').length / (s.length || 1), exp: s.reduce((a, h) => a + h.p, 0) / (s.length || 1) }
  })
  return (
    <>
      <PageHeader eyebrow="Track record" title="Prediction history" description="Every published pick, frozen before kick-off and settled against the official result. Nothing is deleted or edited afterwards, so the record includes the misses." />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Published picks" value={all.length.toLocaleString()} />
        <Stat label="Settled" value={settled.length.toLocaleString()} sub={`${all.length - settled.length} pending or void`} />
        <Stat label="Hit rate" value={settled.length ? pct(won / settled.length, 1) : '—'} sub={settled.length ? `model expected ${pct(expected / settled.length, 1)}` : undefined} />
        <Stat label="Wins − expected" value={settled.length ? (won - expected >= 0 ? '+' : '') + (won - expected).toFixed(1) : '—'} sub="positive = better than its own probabilities" />
      </div>
      {settled.length > 0 && (
        <Card className="mb-5 p-5">
          <div className="eyebrow mb-3">Calibration by confidence</div>
          <div className="grid gap-3 sm:grid-cols-3">
            {byConf.map((b) => (
              <div key={b.c} className="card-inset p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-bold">{b.c}</span>
                  <span className="text-[11px] text-fg-3">n = {b.n}</span>
                </div>
                <div className="mt-2 text-[12px] text-fg-3">
                  hit <b className="num text-[16px] text-fg">{b.n ? pct(b.hit, 1) : '—'}</b> · expected <span className="num text-[14px]">{b.n ? pct(b.exp, 1) : '—'}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-fg-3">Small samples swing a lot. Judge calibration over hundreds of settled picks, not a single weekend.</p>
        </Card>
      )}
      <div className="mb-3 flex flex-wrap gap-2">
        {(
          [
            ['all', 'All'],
            ['won', 'Won'],
            ['lost', 'Lost'],
            ['pending', 'Pending'],
          ] as const
        ).map(([v, l]) => (
          <Link key={v} href={v === 'all' ? '/history' : `/history?r=${v}`} scroll={false} className={cx('inline-flex h-8 items-center rounded-full border px-3 text-[12px] font-semibold', filter === v ? 'border-transparent bg-fg text-fg-inverse' : 'border-line bg-surface-1 text-fg-2 hover:text-fg')}>
            {l}
          </Link>
        ))}
      </div>
      <Card>
        {rows.length === 0 ? (
          <EmptyState icon={<History className="size-6" />} title="No picks here yet" body="Picks appear here as soon as they are published, and are settled automatically after full time." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Match</Th>
                <Th>Pick</Th>
                <Th align="right">Prob.</Th>
                <Th>Confidence</Th>
                <Th align="center">Score</Th>
                <Th>Result</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((h) => (
                <tr key={h.id}>
                  <Td className="whitespace-nowrap">{fmtDate(h.fixture.kickoff, tz)}</Td>
                  <Td>
                    <Link href={`/match/${h.fixture.id}`} className="flex items-center gap-1.5 font-semibold text-fg hover:text-brand-fg">
                      <Crest team={h.fixture.home} size={16} /> {h.fixture.home.short} <span className="text-fg-3">v</span> {h.fixture.away.short} <Crest team={h.fixture.away} size={16} />
                    </Link>
                  </Td>
                  <Td>
                    <div className="font-semibold text-fg-2">{h.label}</div>
                    <div className="text-[11px] text-fg-3">{h.market}</div>
                  </Td>
                  <Td align="right" className="num font-bold text-fg">
                    {pct(h.p)}
                  </Td>
                  <Td>{h.confidence}</Td>
                  <Td align="center" className="num font-bold">
                    {h.fixture.score ? `${h.fixture.score[0]}–${h.fixture.score[1]}` : '–'}
                  </Td>
                  <Td>{h.result ? <Badge tone={h.result === 'won' ? 'success' : h.result === 'lost' ? 'danger' : 'neutral'} dot>{h.result}</Badge> : <Badge dot>pending</Badge>}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card-inset p-4">
      <div className="eyebrow">{label}</div>
      <div className="num mt-1.5 text-[26px] font-bold leading-none">{value}</div>
      {sub && <div className="mt-2 text-[11px] text-fg-3">{sub}</div>}
    </div>
  )
}
