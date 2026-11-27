import type { Metadata } from 'next'
import Link from 'next/link'
import { getCompetitions, getFixtures, getSavedIds, viewerTimeZone } from '@/lib/data'
import { cx, dayKey, FLAG_BY_CODE } from '@/lib/format'
import { Card, PageHeader } from '@/components/ui/primitives'
import { CompHeader, DateStrip, dayRange, groupByCompetition, isDone, isLive, MatchRow } from '@/components/sports/match'
import { Flag } from '@/components/sports/identity'

export const metadata: Metadata = { title: 'Matches' }
export const dynamic = 'force-dynamic'

type SP = { d?: string; c?: string; f?: string; live?: string }

export default async function MatchesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const tz = await viewerTimeZone()
  const { today, days } = dayRange(tz, 7, 10)
  const day = sp.d && days.includes(sp.d) ? sp.d : today
  const liveOnly = sp.live === '1'
  const filter = sp.f === 'picks' || sp.f === 'none' || sp.f === 'upcoming' ? sp.f : 'all'
  const from = liveOnly ? new Date(Date.now() - 4 * 3600_000).toISOString() : new Date(new Date(day + 'T00:00:00Z').getTime() - 14 * 3600_000).toISOString()
  const to = liveOnly ? new Date(Date.now() + 3600_000).toISOString() : new Date(new Date(day + 'T00:00:00Z').getTime() + 38 * 3600_000).toISOString()
  const [raw, comps, saved] = await Promise.all([getFixtures({ from, to, competition: sp.c, withPicks: true }), getCompetitions(), getSavedIds()])
  const list = raw
    .filter((f) => (liveOnly ? isLive(f) : dayKey(f.kickoff, tz) === day))
    .filter((f) => (filter === 'picks' ? (f.picks?.length ?? 0) > 0 : filter === 'none' ? !f.snapshot : filter === 'upcoming' ? !isDone(f) : true))
  const groups = groupByCompetition(list)
  const q = (patch: Partial<SP>) => {
    const p = new URLSearchParams()
    const m = { d: day, c: sp.c, f: filter === 'all' ? undefined : filter, ...patch }
    for (const [k, v] of Object.entries(m)) if (v) p.set(k, v)
    return `/matches?${p.toString()}`
  }
  return (
    <>
      <PageHeader eyebrow="Football" title={liveOnly ? 'Live now' : 'Matches'} description="Fixtures with model probabilities (1 · X · 2). Select a match for the full analysis and every market." />
      <div className="mb-4">
        <DateStrip days={days} value={liveOnly ? '' : day} today={today} tz={tz} hrefFor={(d) => q({ d })} />
      </div>
      <Card className="mb-5 space-y-3 p-3 sm:p-4">
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          <Chip on={!sp.c} href={q({ c: undefined })}>
            All competitions
          </Chip>
          {comps
            .filter((c) => c.fixtures > 0)
            .map((c) => (
              <Chip key={c.code} on={sp.c === c.code} href={q({ c: c.code })}>
                <Flag code={FLAG_BY_CODE[c.code] ?? 'eur'} /> {c.name}
              </Chip>
            ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ['all', 'All'],
              ['upcoming', 'Not started'],
              ['picks', 'With picks'],
              ['none', 'No prediction yet'],
            ] as const
          ).map(([v, l]) => (
            <Chip key={v} small on={filter === v} href={q({ f: v === 'all' ? undefined : v })}>
              {l}
            </Chip>
          ))}
          <span className="ml-auto text-[12px] font-semibold text-fg-3">
            {list.length} fixtures · times in {tz.replace('_', ' ')}
          </span>
        </div>
      </Card>
      {groups.length === 0 ? (
        <Card>
          <div className="px-6 py-14 text-center text-[13px] text-fg-3">{liveOnly ? 'No matches are live right now.' : 'No fixtures match these filters on this date.'}</div>
        </Card>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g[0].competition.code}>
              <CompHeader f={g[0]} right={<span className="text-[12px] font-semibold text-fg-3">{g.length}</span>} />
              <div className="space-y-2">
                {g.map((f) => (
                  <MatchRow key={f.id} f={f} tz={tz} saved={saved.has(f.id)} showComp={false} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  )
}

function Chip({ on, href, children, small }: { on: boolean; href: string; children: React.ReactNode; small?: boolean }) {
  return (
    <Link href={href} scroll={false} className={cx('inline-flex shrink-0 items-center gap-2 rounded-full border font-semibold transition-colors', small ? 'h-8 px-3 text-[12px]' : 'h-9 px-3.5 text-[13px]', on ? 'border-transparent bg-fg text-fg-inverse' : 'border-line bg-surface-1 text-fg-2 hover:text-fg')}>
      {children}
    </Link>
  )
}
