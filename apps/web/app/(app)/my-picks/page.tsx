import type { Metadata } from 'next'
import Link from 'next/link'
import { Bookmark } from 'lucide-react'
import { getMyPicks, viewerTimeZone, type MyPick } from '@/lib/data'
import { cx, fmtDate, fmtDay, fmtTime, FLAG_BY_CODE, pct } from '@/lib/format'
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui/primitives'
import { Crest, Flag } from '@/components/sports/identity'
import { MyPickControls } from '@/components/my-pick-controls'

export const metadata: Metadata = { title: 'My Picks' }
export const dynamic = 'force-dynamic'

export default async function MyPicksPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [picks, tz] = await Promise.all([getMyPicks(), viewerTimeZone()])
  const tab = (await searchParams).tab === 'ended' ? 'ended' : 'open'
  const open = picks.filter((p) => !p.ended).sort((a, b) => a.fixture.kickoff.localeCompare(b.fixture.kickoff))
  const ended = picks.filter((p) => p.ended).sort((a, b) => b.fixture.kickoff.localeCompare(a.fixture.kickoff))
  const list = tab === 'open' ? open : ended
  return (
    <>
      <PageHeader eyebrow="Your reference list" title="My Picks" description="Predictions you chose, with the time you added them. Open picks can be changed or removed until kick-off; after full time they move to Ended with the result." />
      <div className="mb-5 grid grid-cols-2 gap-3">
        <Stat label="Open" value={open.length} />
        <Stat label="Ended" value={ended.length} />
      </div>
      <div className="mb-4 flex gap-2" role="tablist">
        {(
          [
            ['open', `Open (${open.length})`],
            ['ended', `Ended (${ended.length})`],
          ] as const
        ).map(([v, l]) => (
          <Link key={v} href={v === 'open' ? '/my-picks' : '/my-picks?tab=ended'} scroll={false} role="tab" aria-selected={tab === v} className={cx('inline-flex h-9 items-center rounded-full border px-4 text-[13px] font-semibold', tab === v ? 'border-transparent bg-fg text-fg-inverse' : 'border-line bg-surface-1 text-fg-2 hover:text-fg')}>
            {l}
          </Link>
        ))}
      </div>
      {list.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Bookmark className="size-6" />}
            title={tab === 'open' ? 'No open picks' : 'No ended picks yet'}
            body={tab === 'open' ? 'Open a match and tap + My Picks on any prediction or correct score to keep it here.' : 'Picks move here after full time, with the result.'}
            action={
              tab === 'open' ? (
                <Link href="/matches" className="inline-flex h-10 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-hover">
                  Browse matches
                </Link>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map((p) => (
            <PickCard key={p.id} p={p} tz={tz} />
          ))}
        </div>
      )}
    </>
  )
}

function PickCard({ p, tz }: { p: MyPick; tz: string }) {
  const f = p.fixture
  const started = new Date(f.kickoff).getTime() <= Date.now() || !(f.status === 'SCHEDULED' || f.status === 'TIMED')
  const tone = p.result === 'won' ? 'success' : p.result === 'lost' ? 'danger' : 'neutral'
  return (
    <Card className={cx('overflow-hidden', p.result === 'won' && 'ring-1 ring-success/30', p.result === 'lost' && 'opacity-90')}>
      <Link href={`/match/${f.id}`} className="flex items-center gap-3 border-b border-line px-4 py-3 hover:bg-surface-2">
        <div className="w-16 shrink-0 text-center">
          <div className="text-[11px] font-bold text-fg-3">
            {fmtDay(f.kickoff, tz)} {fmtDate(f.kickoff, tz)}
          </div>
          <div className="num text-[15px] font-bold">{f.score ? `${f.score[0]}–${f.score[1]}` : fmtTime(f.kickoff, tz)}</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[14px] font-bold">
            <Crest team={f.home} size={18} /> <span className="truncate">{f.home.short}</span> <span className="text-fg-3">v</span> <Crest team={f.away} size={18} /> <span className="truncate">{f.away.short}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-fg-3">
            <Flag code={FLAG_BY_CODE[f.competition.code] ?? 'eur'} /> {f.competition.name}
            {!p.ended && started && <Badge tone="live">In play</Badge>}
          </div>
        </div>
      </Link>
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-bold text-fg">{p.label}</div>
          <div className="mt-0.5 text-[12px] text-fg-3">
            {/* Market name only when it adds information (single-outcome markets already read like their label). */}
            {[
              p.market === 'correct-score' ? 'Correct score' : p.marketName.toLowerCase() === p.label.toLowerCase() ? null : p.marketName,
              p.probability != null ? `${pct(p.probability)} when added` : null,
              `added ${fmtDate(p.addedAt, tz)}, ${fmtTime(p.addedAt, tz)}`,
            ]
              .filter(Boolean)
              .join(' · ')}
            {p.updatedAt && new Date(p.updatedAt).getTime() - new Date(p.addedAt).getTime() > 60_000 && <> · changed {fmtDate(p.updatedAt, tz)}, {fmtTime(p.updatedAt, tz)}</>}
          </div>
        </div>
        {p.ended ? (
          <Badge tone={tone} dot>
            {p.result ?? 'awaiting result'}
          </Badge>
        ) : (
          <MyPickControls id={p.id} fixtureId={f.id} market={p.market} outcome={p.outcome} options={p.options} canChange={!started} />
        )}
      </div>
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card-inset p-4">
      <div className="eyebrow">{label}</div>
      <div className="num mt-1.5 text-[24px] font-bold leading-none">{value}</div>
    </div>
  )
}
