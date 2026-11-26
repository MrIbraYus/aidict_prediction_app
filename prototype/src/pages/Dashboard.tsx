import { useMemo, useState } from 'react'
import { ArrowUpRight, CheckCircle2, CircleDot, ListChecks, Sparkles, Star, XCircle, Target } from 'lucide-react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from 'recharts'
import { Link } from '../lib/router'
import { useApp } from '../lib/store'
import { cx, dayKey, fmtLong, fmtTime, useProb } from '../lib/format'
import { MATCHES, NOW, getPrediction } from '../mock/matches'
import { BRIER_TREND, HISTORY, KPIS } from '../mock/analytics'
import { COMPETITIONS, compById, teamById } from '../mock/teams'
import { PageHeader } from '../components/layout/shell'
import { smartPicks } from '../lib/markets'
import { Badge, Card, CardHeader, Ring } from '../components/ui/primitives'
import { PageState } from '../components/ui/overlay'
import { CompHeader, DateStrip, MatchHero, MatchRow, RecBadge } from '../components/sports/match'
import { Crest, Flag } from '../components/sports/identity'

export const DAYS = ['2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29', '2026-11-30', '2026-12-01', '2026-12-02']

export default function Dashboard() {
  const [day, setDay] = useState('2026-11-28')
  const [comp, setComp] = useState<string>('all')
  const fmt = useProb()
  const saved = useApp((s) => s.saved)
  const dayMatches = useMemo(() => MATCHES.filter((m) => dayKey(m.kickoff) === day && (comp === 'all' || m.compId === comp)), [day, comp])
  const grouped = useMemo(() => {
    const g = new Map<string, typeof dayMatches>()
    dayMatches.forEach((m) => g.set(m.compId, [...(g.get(m.compId) ?? []), m]))
    return [...g.entries()]
  }, [dayMatches])
  const featured = MATCHES.filter((m) => m.featured)
  const live = MATCHES.filter((m) => m.status === 'LIVE' || m.status === 'HT')
  const smart = MATCHES.filter((m) => m.status === 'SCHEDULED')
    .map((m) => ({ m, p: getPrediction(m) }))
    .filter((x) => x.p.recommendation !== 'skip')
    .sort((a, b) => b.p.signal - a.p.signal)
    .slice(0, 4)
  const recent = HISTORY.slice(0, 6)

  return (
    <>
      <PageHeader
        eyebrow={fmtLong(NOW)}
        title="Good afternoon"
        description="23 fixtures analysed this week across 7 competitions. Predictions lock at kick-off and are tracked against results."
        actions={
          <Link to="/smart" className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white shadow-[0_8px_24px_-10px_var(--brand-glow)] hover:bg-brand-hover">
            <Sparkles className="size-4" /> Smart Predictions
          </Link>
        }
      />
      <PageState>
        <div className="mb-5">
          <DateStrip days={DAYS} value={day} onChange={setDay} liveCount={live.length} />
        </div>

        <div className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
          <FilterChip on={comp === 'all'} onClick={() => setComp('all')}>
            All competitions
          </FilterChip>
          {COMPETITIONS.slice(0, 8).map((c) => (
            <FilterChip key={c.id} on={comp === c.id} onClick={() => setComp(c.id)}>
              <Flag code={c.flag} /> {c.name}
            </FilterChip>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-5">
            {featured.map((m) => (
              <MatchHero key={m.id} match={m} linkTo />
            ))}

            <Card className="p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[15px] font-bold">{day === '2026-11-28' ? "Today's matches" : 'Matches'}</h2>
                <span className="text-[12px] font-semibold text-fg-3">{dayMatches.length} fixtures · probabilities are 1 · X · 2</span>
              </div>
              {grouped.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center text-[13px] text-fg-3">No fixtures for this date in the selected competitions.</div>
              ) : (
                <div className="space-y-5">
                  {grouped.map(([cid, ms]) => (
                    <div key={cid}>
                      <CompHeader compId={cid} />
                      <div className="space-y-2">
                        {ms.map((m) => (
                          <MatchRow key={m.id} match={m} />
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
              <CardHeader title="Performance" eyebrow="Since 15 Aug 2026 · 1X2" action={<Link to="/performance" className="text-[12px] font-bold text-brand-fg">Analytics →</Link>} />
              <div className="grid grid-cols-3 gap-2 px-5 pt-4">
                <Metric label="Brier" value={KPIS.brier.value.toFixed(3)} hint={`base ${KPIS.brier.baseline}`} good />
                <Metric label="Log loss" value={KPIS.logLoss.value.toFixed(3)} hint={`base ${KPIS.logLoss.baseline}`} good />
                <Metric label="Hit rate" value={fmt(KPIS.accuracy.value, 1)} hint={`n=${KPIS.settled.toLocaleString()}`} />
              </div>
              <div className="h-[92px] px-2 pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={BRIER_TREND} margin={{ top: 6, right: 12, left: 12, bottom: 0 }}>
                    <defs>
                      <linearGradient id="brierFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--brand-fg)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--brand-fg)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <YAxis hide domain={[0.54, 0.68]} reversed />
                    <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border-strong)', borderRadius: 12, fontSize: 12 }} labelStyle={{ color: 'var(--text-3)' }} />
                    <Area type="monotone" dataKey="baseline" stroke="var(--text-3)" strokeDasharray="4 4" fill="none" strokeWidth={1.5} name="Base rate" />
                    <Area type="monotone" dataKey="model" stroke="var(--brand-fg)" fill="url(#brierFill)" strokeWidth={2} name="AIDICT" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className="px-5 pb-4 text-[11px] text-fg-3">Weekly Brier score (lower is better). Dashed: base-rate benchmark. Closing-odds market remains stronger (0.570).</p>
            </Card>

            <Card>
              <CardHeader title="Smart Picks" icon={<Sparkles className="size-4 text-brand-fg" />} eyebrow="Ranked by signal, not probability" action={<Link to="/smart" className="text-[12px] font-bold text-brand-fg">All →</Link>} />
              <div className="space-y-2 p-3 pt-3">
                {smart.map(({ m, p }) => (
                  <Link key={m.id} to={`/match/${m.id}/prediction`} className="flex items-center gap-3 rounded-2xl p-2.5 hover:bg-surface-2">
                    <Ring value={p.signal / 100} size={44} stroke={4} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-bold text-fg">{p.pick.label}</div>
                      <div className="truncate text-[12px] text-fg-3">
                        {teamById(m.homeId).short} v {teamById(m.awayId).short} · {fmtTime(m.kickoff)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="num text-[17px] font-bold text-fg">{fmt(p.pick.p)}</div>
                      <RecBadge pred={p} />
                    </div>
                  </Link>
                ))}
              </div>
            </Card>

            <FeaturedMarkets />

            <Card>
              <CardHeader title="Live now" icon={<CircleDot className="size-4 text-live" />} eyebrow="Delayed source · football-data.org free tier" action={<Link to="/live" className="text-[12px] font-bold text-brand-fg">All →</Link>} />
              <div className="space-y-1 p-3">
                {live.slice(0, 4).map((m) => (
                  <Link key={m.id} to={`/match/${m.id}`} className="flex items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-surface-2">
                    <span className="num w-9 text-[14px] font-bold text-live">{m.status === 'HT' ? 'HT' : `${m.minute}′`}</span>
                    <div className="min-w-0 flex-1 space-y-1">
                      {[m.homeId, m.awayId].map((id, i) => (
                        <div key={id} className="flex items-center gap-2 text-[13px] font-semibold">
                          <Crest team={teamById(id)} size={16} />
                          <span className="truncate">{teamById(id).short}</span>
                          <span className="num ml-auto text-[15px] font-bold">{m.score?.[i]}</span>
                        </div>
                      ))}
                    </div>
                  </Link>
                ))}
              </div>
            </Card>

            <Card>
              <CardHeader title="Recent results" icon={<Target className="size-4 text-fg-3" />} eyebrow="Settled predictions" action={<Link to="/history" className="text-[12px] font-bold text-brand-fg">History →</Link>} />
              <ul className="divide-y divide-line px-5 pb-3 pt-2">
                {recent.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 py-2.5">
                    {r.result === 'won' ? <CheckCircle2 className="size-4 shrink-0 text-success" /> : r.result === 'lost' ? <XCircle className="size-4 shrink-0 text-danger" /> : <span className="size-4 shrink-0 rounded-full border border-line-strong" />}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold">{r.selection}</div>
                      <div className="truncate text-[11px] text-fg-3">
                        {teamById(r.homeId).short} {r.score} {teamById(r.awayId).short} · {compById(r.compId).code}
                      </div>
                    </div>
                    <span className="num text-[14px] font-bold text-fg-2">{fmt(r.p)}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <CardHeader title="Saved matches" icon={<Star className="size-4 text-gold" />} action={<Link to="/saved" className="text-[12px] font-bold text-brand-fg">Manage →</Link>} />
              <div className="space-y-1 p-3">
                {saved.length === 0 && <p className="px-2 py-4 text-[13px] text-fg-3">Star a match to follow it here.</p>}
                {saved.slice(0, 3).map((id) => {
                  const m = MATCHES.find((x) => x.id === id)!
                  return (
                    <Link key={id} to={`/match/${id}`} className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-[13px] font-semibold hover:bg-surface-2">
                      <Crest team={teamById(m.homeId)} size={16} />
                      <span className="truncate">
                        {teamById(m.homeId).short} v {teamById(m.awayId).short}
                      </span>
                      <span className="ml-auto text-[12px] text-fg-3">{fmtTime(m.kickoff)}</span>
                      <ArrowUpRight className="size-3.5 text-fg-3" />
                    </Link>
                  )
                })}
              </div>
            </Card>
          </div>
        </div>
      </PageState>
    </>
  )
}

function Metric({ label, value, hint, good }: { label: string; value: string; hint: string; good?: boolean }) {
  return (
    <div className="card-inset p-3">
      <div className="eyebrow">{label}</div>
      <div className="num mt-1 text-[22px] font-bold leading-none">{value}</div>
      <div className={cx('mt-1 text-[11px] font-semibold', good ? 'text-success' : 'text-fg-3')}>{hint}</div>
    </div>
  )
}

function FeaturedMarkets() {
  const fmt = useProb()
  const m = MATCHES.find((x) => x.featured)!
  const res = smartPicks(m)
  return (
    <Card>
      <CardHeader title="Smart market picks" icon={<ListChecks className="size-4 text-brand-fg" />} eyebrow={`${teamById(m.homeId).short} v ${teamById(m.awayId).short} · strongest of 24 markets`} action={<Link to="/markets" className="text-[12px] font-bold text-brand-fg">All →</Link>} />
      <ul className="space-y-1 p-3">
        {res.picks.slice(0, 4).map((p) => (
          <li key={p.outcome.key}>
            <Link to={`/match/${m.id}/markets`} className="flex items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-surface-2">
              <span className="num w-4 text-[13px] font-bold text-fg-3">{p.rank}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-bold text-fg">{p.outcome.label}</span>
                <span className="block truncate text-[11.5px] text-fg-3">{p.market.def.name} · reliability {Math.round(p.market.reliability * 100)}</span>
              </span>
              <span className="num text-[16px] font-bold">{fmt(p.outcome.p)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  )
}

export function FilterChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={cx('inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[12.5px] font-bold transition-colors', on ? 'border-transparent bg-fg text-fg-inverse' : 'border-line bg-surface-1 text-fg-2 hover:text-fg hover:border-line-strong')}
    >
      {children}
    </button>
  )
}

export { Badge }
