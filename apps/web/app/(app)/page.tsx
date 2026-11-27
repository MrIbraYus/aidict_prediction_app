import Link from 'next/link'
import { ListChecks, Sparkles } from 'lucide-react'
import { getBacktestRuns, getCompetitions, getFixtures, getSavedIds, viewerTimeZone } from '@/lib/data'
import { summarizeRun } from '@/lib/runs'
import { cx, dayKey, fmtLong, fmtTime, FLAG_BY_CODE, pct } from '@/lib/format'
import type { FixtureVM, PickVM } from '@/lib/types'
import { Card, CardHeader, EmptyState, PageHeader, Ring } from '@/components/ui/primitives'
import { CompHeader, ConfidenceBadge, DateStrip, dayRange, groupByCompetition, isLive, MatchHero, MatchRow } from '@/components/sports/match'
import { Flag } from '@/components/sports/identity'

export const dynamic = 'force-dynamic'

function greeting(tz: string) {
  const h = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: tz }).format(new Date()))
  return h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ d?: string; c?: string }> }) {
  const sp = await searchParams
  const tz = await viewerTimeZone()
  const { today, days } = dayRange(tz, 3, 7)
  const day = sp.d && days.includes(sp.d) ? sp.d : today
  const comp = sp.c
  const from = new Date(new Date(day + 'T00:00:00Z').getTime() - 14 * 3600_000).toISOString()
  const to = new Date(new Date(day + 'T00:00:00Z').getTime() + 38 * 3600_000).toISOString()
  const soon = new Date(Date.now() + 4 * 86400000).toISOString()
  const [raw, upcoming, comps, runs, saved] = await Promise.all([
    getFixtures({ from, to, competition: comp, withPicks: true }),
    getFixtures({ from: new Date().toISOString(), to: soon, withPicks: true, limit: 200 }),
    getCompetitions(),
    getBacktestRuns(),
    getSavedIds(),
  ])
  const list = raw.filter((f) => dayKey(f.kickoff, tz) === day)
  const groups = groupByCompetition(list)
  const live = upcoming.filter(isLive).length
  const featured = upcoming.find((f) => (f.picks?.length ?? 0) > 0 && f.snapshot)
  const topPicks: { f: FixtureVM; p: PickVM }[] = upcoming
    .flatMap((f) => (f.picks ?? []).map((p) => ({ f, p })))
    .sort((a, b) => b.p.score - a.p.score)
    .slice(0, 5)
  const predicted = upcoming.filter((f) => f.snapshot).length
  const href = (d: string) => `/?d=${d}${comp ? `&c=${comp}` : ''}`

  return (
    <>
      <PageHeader
        eyebrow={fmtLong(new Date().toISOString(), tz)}
        title={greeting(tz)}
        description={`${upcoming.length} fixtures in the next 4 days, ${predicted} with a published prediction. Predictions are frozen before kick-off and tracked against the result.`}
        actions={
          <Link href="/markets" className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white shadow-[0_8px_24px_-10px_var(--brand-glow)] hover:bg-brand-hover">
            <Sparkles className="size-4" /> Smart Picks
          </Link>
        }
      />
      <div className="mb-5">
        <DateStrip days={days} value={day} today={today} tz={tz} hrefFor={href} liveCount={live} />
      </div>
      <div className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        <Chip on={!comp} href={`/?d=${day}`}>
          All competitions
        </Chip>
        {comps
          .filter((c) => c.fixtures > 0)
          .map((c) => (
            <Chip key={c.code} on={comp === c.code} href={`/?d=${day}&c=${c.code}`}>
              <Flag code={FLAG_BY_CODE[c.code] ?? 'eur'} /> {c.name}
            </Chip>
          ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-5">
          {featured && day === today && !comp && <MatchHero f={featured} tz={tz} linkTo />}
          <Card className="p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[15px] font-bold">{day === today ? "Today's matches" : 'Matches'}</h2>
              <span className="text-[12px] font-semibold text-fg-3">{list.length} fixtures · probabilities are 1 · X · 2</span>
            </div>
            {groups.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center text-[13px] text-fg-3">No fixtures on this date{comp ? ' in this competition' : ''}.</div>
            ) : (
              <div className="space-y-5">
                {groups.map((g) => (
                  <div key={g[0].competition.code}>
                    <CompHeader f={g[0]} />
                    <div className="space-y-2">
                      {g.map((f) => (
                        <MatchRow key={f.id} f={f} tz={tz} saved={saved.has(f.id)} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader title="Smart Picks" icon={<ListChecks className="size-4 text-brand-fg" />} eyebrow="Next 4 days · ranked by score" action={<Link href="/markets" className="text-[12px] font-bold text-brand-fg">All →</Link>} />
            {topPicks.length === 0 ? (
              <EmptyState title="No picks yet" body="Picks appear up to 7 days before kick-off, and only for outcomes that passed backtesting and calibration checks." />
            ) : (
              <div className="space-y-1 p-3">
                {topPicks.map(({ f, p }) => (
                  <Link key={p.id} href={`/match/${f.id}?tab=markets`} className="flex items-center gap-3 rounded-2xl p-2.5 hover:bg-surface-2">
                    <Ring value={p.reliability} size={44} stroke={4} label={Math.round(p.reliability * 100)} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-bold text-fg">{p.label}</div>
                      <div className="truncate text-[12px] text-fg-3">
                        {f.home.short} v {f.away.short} · {fmtTime(f.kickoff, tz)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="num text-[17px] font-bold text-fg">{pct(p.p)}</div>
                      <ConfidenceBadge c={p.confidence} />
                    </div>
                  </Link>
                ))}
                <p className="px-2.5 pt-1 text-[11px] text-fg-3">Ring = reliability score (calibration, sample size, data completeness, coverage).</p>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Model vs benchmarks" eyebrow="Walk-forward backtest · 1X2 log loss (lower is better)" action={<Link href="/performance" className="text-[12px] font-bold text-brand-fg">Details →</Link>} />
            {runs.length === 0 ? (
              <EmptyState title="No backtest stored yet" body="Run the weekly backtest job to publish model-quality numbers here." />
            ) : (
              <div className="space-y-2 p-4">
                {runs.slice(0, 6).map((raw) => {
                  const r = summarizeRun(raw)
                  if (!r.model || !r.base) return null
                  return (
                    <div key={r.id} className="card-inset flex items-center gap-3 px-3 py-2.5">
                      <Flag code={FLAG_BY_CODE[r.competition] ?? 'eur'} />
                      <span className="w-10 text-[12px] font-bold text-fg">{r.competition}</span>
                      <span className="flex-1 text-[12px] text-fg-3">
                        model <b className={cx('num text-[14px]', r.model.log_loss < r.base.log_loss ? 'text-success' : 'text-danger')}>{r.model.log_loss.toFixed(3)}</b> · base <span className="num text-[13px]">{r.base.log_loss.toFixed(3)}</span>
                        {r.odds && (
                          <>
                            {' '}
                            · odds <span className="num text-[13px]">{r.odds.log_loss.toFixed(3)}</span>
                          </>
                        )}
                      </span>
                      <span className="num text-[11px] text-fg-3">n={r.n.toLocaleString()}</span>
                    </div>
                  )
                })}
                <p className="pt-1 text-[11px] text-fg-3">Closing bookmaker odds remain the stronger benchmark; AIDICT reports that openly.</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}

function Chip({ on, href, children }: { on: boolean; href: string; children: React.ReactNode }) {
  return (
    <Link href={href} scroll={false} className={cx('inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold transition-colors', on ? 'border-transparent bg-fg text-fg-inverse' : 'border-line bg-surface-1 text-fg-2 hover:text-fg')}>
      {children}
    </Link>
  )
}
