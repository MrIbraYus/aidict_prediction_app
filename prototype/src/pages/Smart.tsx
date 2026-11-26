import { useMemo, useState } from 'react'
import { ChevronDown, CircleSlash, Info, Sparkles, Trash2, Layers, AlertTriangle, Plus, ListChecks } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Link } from '../lib/router'
import { useApp } from '../lib/store'
import { cx, fmtDay, fmtTime, useProb } from '../lib/format'
import { poissonBinomial } from '../lib/probability'
import { MATCHES, getPrediction, matchById } from '../mock/matches'
import { compById, teamById } from '../mock/teams'
import { PageHeader } from '../components/layout/shell'
import { Badge, Button, Card, EmptyState, Notice, Progress, Ring, Select, Tabs } from '../components/ui/primitives'
import { PageState } from '../components/ui/overlay'
import { MultiAddButton, RecBadge } from '../components/sports/match'
import { Crest, Flag } from '../components/sports/identity'

export function SmartPredictions() {
  const [tab, setTab] = useState<'pick' | 'lean' | 'skip'>('pick')
  const [comp, setComp] = useState('all')
  const [open, setOpen] = useState<string | null>(null)
  const [method, setMethod] = useState(false)
  const fmt = useProb()
  const hideValue = useApp((s) => s.hideValue)
  const rows = useMemo(
    () =>
      MATCHES.filter((m) => m.status === 'SCHEDULED')
        .map((m) => ({ m, p: getPrediction(m) }))
        .filter((x) => comp === 'all' || x.m.compId === comp),
    [comp],
  )
  const counts = { pick: rows.filter((r) => r.p.recommendation === 'pick').length, lean: rows.filter((r) => r.p.recommendation === 'lean').length, skip: rows.filter((r) => r.p.recommendation === 'skip').length }
  const list = rows.filter((r) => r.p.recommendation === tab).sort((a, b) => b.p.signal - a.p.signal)

  return (
    <>
      <PageHeader
        eyebrow="Upcoming · next 5 days"
        title="Smart Predictions"
        description="Ranked by signal strength — edge over base rates, calibration, data completeness and model agreement — never by raw probability alone."
        actions={
          <Button variant="outline" size="sm" onClick={() => setMethod((v) => !v)}>
            <Info className="size-4" /> How ranking works
          </Button>
        }
      />
      <Link to="/markets" className="mb-5 flex items-center gap-4 rounded-2xl border border-brand/30 bg-brand-soft/60 p-4 transition-colors hover:border-brand/60">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand text-white"><ListChecks className="size-5" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-bold text-fg">New · Smart Market Predictions</span>
          <span className="block text-[12.5px] text-fg-2">The 4–5 strongest predictions per match, chosen from 24 markets with market-specific models.</span>
        </span>
        <span className="text-[12px] font-bold text-brand-fg">Open →</span>
      </Link>
      {method && (
        <Card className="animate-fade-up mb-5 p-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="text-[13px] leading-relaxed text-fg-2">
              <p><b className="text-fg">Signal score (0–100)</b> = 34% edge over the competition base rate + 20% calibration reliability (segment ECE) + 18% data completeness + 18% model agreement + 10% outcome certainty.</p>
              <p className="mt-2"><b className="text-fg">Pick</b> ≥ 68 · <b className="text-fg">Lean</b> 52–67 · <b className="text-fg">Skip</b> below 52, or automatically when models disagree by more than 10 pp, data has an open conflict, or the market is not validated for the competition.</p>
            </div>
            <div className="text-[13px] leading-relaxed text-fg-2">
              <p><b className="text-fg">Probability is not value.</b> A 75% outcome can be poor value if the market already prices it at 80%. When a real odds source is attached, AIDICT shows implied probability (1 ÷ odds) and expected value (p × odds − 1) with the source and timestamp. Without odds, value is not assessed.</p>
            </div>
          </div>
        </Card>
      )}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: 'pick', label: 'Picks', badge: <span className="num rounded-md bg-live-soft px-1.5 text-[12px] font-bold text-live">{counts.pick}</span> },
            { value: 'lean', label: 'Leans', badge: <span className="num rounded-md bg-surface-3 px-1.5 text-[12px] font-bold text-gold">{counts.lean}</span> },
            { value: 'skip', label: 'Skipped', badge: <span className="num rounded-md bg-surface-3 px-1.5 text-[12px] font-bold text-fg-3">{counts.skip}</span> },
          ]}
          className="flex-1"
        />
        <Select
          className="sm:w-64"
          value={comp}
          onChange={setComp}
          label="In"
          options={[{ value: 'all', label: 'All competitions' }, ...[...new Set(MATCHES.map((m) => m.compId))].map((c) => ({ value: c, label: compById(c).name }))]}
        />
      </div>
      <PageState empty={<EmptyState icon={<Sparkles className="size-6" />} title="No qualifying predictions" body="Nothing in this window clears the evidence threshold. Skipping is a valid outcome." />}>
        {list.length === 0 ? (
          <Card><EmptyState icon={<Sparkles className="size-6" />} title="Nothing in this group" body="No upcoming matches fall into this category for the selected competition." /></Card>
        ) : (
          <div className="space-y-3">
            {list.map(({ m, p }, i) => {
              const home = teamById(m.homeId)
              const away = teamById(m.awayId)
              const comp = compById(m.compId)
              const isOpen = open === m.id
              const oddsForPick = m.odds && p.pick.market === '1x2' ? (p.pick.selection === 'home' ? m.odds.home : m.odds.away) : m.odds && p.pick.market === 'ou25' ? (p.pick.selection === 'over' ? m.odds.over25 : m.odds.under25) : m.odds && p.pick.market === 'btts' ? (p.pick.selection === 'yes' ? m.odds.bttsYes : m.odds.bttsNo) : undefined
              return (
                <Card key={m.id} as="article" className="overflow-hidden">
                  <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
                    <div className="flex items-center gap-4">
                      <span className="num hidden w-6 text-[18px] font-bold text-fg-3 sm:block">{i + 1}</span>
                      {tab === 'skip' ? (
                        <div className="flex size-14 items-center justify-center rounded-full border border-line bg-surface-2 text-fg-3"><CircleSlash className="size-6" /></div>
                      ) : (
                        <Ring value={p.signal / 100} size={56} />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-[12px] font-semibold text-fg-3">
                          <Flag code={comp.flag} /> {comp.name} · {fmtDay(m.kickoff)} {fmtTime(m.kickoff)}
                        </div>
                        <Link to={`/match/${m.id}/prediction`} className="mt-1 flex items-center gap-2 text-[15px] font-bold hover:text-brand-fg">
                          <Crest team={home} size={18} /> {home.short} <span className="text-fg-3">v</span> {away.short} <Crest team={away} size={18} />
                        </Link>
                      </div>
                    </div>
                    <div className="flex flex-1 flex-wrap items-center gap-x-6 gap-y-3 sm:justify-end">
                      {tab === 'skip' ? (
                        <p className="max-w-md text-[13px] text-fg-2"><AlertTriangle className="mr-1.5 inline size-4 text-warn" />{p.skipReason}</p>
                      ) : (
                        <>
                          <div>
                            <div className="eyebrow">Selection</div>
                            <div className="text-[14px] font-bold">{p.pick.label}</div>
                          </div>
                          <div>
                            <div className="eyebrow">Probability</div>
                            <div className="num text-[22px] font-bold leading-tight">{fmt(p.pick.p)}</div>
                          </div>
                          <div>
                            <div className="eyebrow">Value</div>
                            {oddsForPick && !hideValue ? (
                              <div className={cx('num text-[16px] font-bold', p.pick.p * oddsForPick - 1 > 0 ? 'text-success' : 'text-danger')}>
                                {p.pick.p * oddsForPick - 1 >= 0 ? '+' : ''}{((p.pick.p * oddsForPick - 1) * 100).toFixed(1)}% EV
                              </div>
                            ) : (
                              <div className="text-[12px] font-semibold text-fg-3">No odds · not assessed</div>
                            )}
                          </div>
                        </>
                      )}
                      <div className="flex items-center gap-2">
                        {tab !== 'skip' && <MultiAddButton match={m} />}
                        <button onClick={() => setOpen(isOpen ? null : m.id)} aria-expanded={isOpen} aria-label="Show breakdown" className="flex size-8 items-center justify-center rounded-[10px] border border-line text-fg-3 hover:text-fg">
                          <ChevronDown className={cx('size-4 transition-transform', isOpen && 'rotate-180')} />
                        </button>
                      </div>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="animate-fade-up grid gap-5 border-t border-line bg-inset/60 p-5 md:grid-cols-[1fr_1fr]">
                      <div className="space-y-2.5">
                        {(
                          [
                            ['Edge vs base rate', p.components.edge],
                            ['Calibration reliability', p.components.calibration],
                            ['Data completeness', p.components.completeness],
                            ['Model agreement', p.components.agreement],
                            ['Outcome certainty', p.components.certainty],
                          ] as const
                        ).map(([k, v]) => (
                          <div key={k}>
                            <div className="mb-1 flex justify-between text-[12px] font-semibold"><span className="text-fg-3">{k}</span><span className="num text-fg">{Math.round(v * 100)}</span></div>
                            <Progress value={v} tone={v > 0.75 ? 'live' : v > 0.5 ? 'warn' : 'danger'} height={5} />
                          </div>
                        ))}
                      </div>
                      <div className="text-[12.5px] text-fg-2">
                        <div className="flex justify-between py-1"><span className="text-fg-3">95% interval</span><b className="num text-[14px]">{fmt(p.interval[0])} – {fmt(p.interval[1])}</b></div>
                        <div className="flex justify-between py-1"><span className="text-fg-3">Model spread (home win)</span><b className="num text-[14px]">{(p.spread * 100).toFixed(1)} pp</b></div>
                        <div className="flex justify-between py-1"><span className="text-fg-3">Segment ECE</span><b className="num text-[14px]">{p.ece.toFixed(3)}</b></div>
                        <div className="flex justify-between py-1"><span className="text-fg-3">Recommendation</span><RecBadge pred={p} /></div>
                        {m.odds && <div className="mt-2 text-[11px] text-fg-3">Odds source: {m.odds.source} · captured {fmtTime(m.odds.capturedAt)} UTC</div>}
                      </div>
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </PageState>
    </>
  )
}

/* ─────────────────────────── Multi-Match Analysis ─────────────────────────── */
const MARKET_OPTIONS = [
  { value: '1x2:home', label: 'Home win' },
  { value: '1x2:draw', label: 'Draw' },
  { value: '1x2:away', label: 'Away win' },
  { value: 'ou25:over', label: 'Over 2.5' },
  { value: 'ou25:under', label: 'Under 2.5' },
  { value: 'btts:yes', label: 'BTTS — Yes' },
  { value: 'btts:no', label: 'BTTS — No' },
]

function legProb(matchId: string, market: string, selection: string) {
  const p = getPrediction(matchById(matchId)!)
  if (market === '1x2') return selection === 'home' ? p.x12.home : selection === 'draw' ? p.x12.draw : p.x12.away
  if (market === 'ou25') return selection === 'over' ? p.over25 : 1 - p.over25
  return selection === 'yes' ? p.btts : 1 - p.btts
}

export function MultiMatch() {
  const legs = useApp((s) => s.legs)
  const update = useApp((s) => s.updateLeg)
  const remove = useApp((s) => s.removeLeg)
  const add = useApp((s) => s.addLeg)
  const fmt = useProb()
  const ps = legs.map((l) => legProb(l.matchId, l.market, l.selection))
  const dist = poissonBinomial(ps)
  const all = ps.reduce((a, b) => a * b, 1)
  const expected = ps.reduce((a, b) => a + b, 0)
  const chart = dist.map((v, k) => ({ k: `${k}`, p: +(v * 100).toFixed(2) }))
  const available = MATCHES.filter((m) => m.status === 'SCHEDULED' && !legs.some((l) => l.matchId === m.id)).slice(0, 8)
  const sameDayComp = legs.length > 1 && new Set(legs.map((l) => matchById(l.matchId)!.compId)).size < legs.length

  return (
    <>
      <PageHeader eyebrow="Analysis tool" title="Multi-Match Analysis" description="Analyse several selections together. AIDICT shows the full distribution of outcomes — not just the chance that everything wins." />
      <PageState empty={<EmptyState icon={<Layers className="size-6" />} title="No matches selected" body="Add matches from Smart Predictions, the match list or any match page using “Add to multi”." />}>
        {legs.length === 0 ? (
          <Card><EmptyState icon={<Layers className="size-6" />} title="No matches selected" body="Add matches from Smart Predictions, the match list or any match page using “Add to multi”." /></Card>
        ) : (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
            <div className="min-w-0 space-y-3">
              {legs.map((l, i) => {
                const m = matchById(l.matchId)!
                const p = getPrediction(m)
                const prob = ps[i]
                return (
                  <Card key={l.matchId} className="p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-bold text-fg-3">{compById(m.compId).name} · {fmtDay(m.kickoff)} {fmtTime(m.kickoff)}</div>
                        <Link to={`/match/${m.id}`} className="mt-1 flex items-center gap-2 text-[14px] font-bold hover:text-brand-fg">
                          <Crest team={teamById(m.homeId)} size={18} /> {teamById(m.homeId).short} <span className="text-fg-3">v</span> {teamById(m.awayId).short}
                        </Link>
                      </div>
                      <Select
                        className="sm:w-48"
                        value={`${l.market}:${l.selection}`}
                        onChange={(v) => {
                          const [market, selection] = v.split(':')
                          update(l.matchId, { market, selection })
                        }}
                        options={MARKET_OPTIONS}
                      />
                      <div className="flex items-center gap-4">
                        <div className="w-16 text-right">
                          <div className="num text-[22px] font-bold leading-none">{fmt(prob)}</div>
                          <div className="mt-1 text-[10px] font-bold text-fg-3">PROB.</div>
                        </div>
                        <div className="w-16 text-right">
                          <div className="num text-[16px] font-bold">{Math.round(m.completeness * 100)}%</div>
                          <div className="text-[10px] font-bold text-fg-3">DATA</div>
                        </div>
                        <RecBadge pred={p} />
                        <button onClick={() => remove(l.matchId)} aria-label="Remove" className="flex size-8 items-center justify-center rounded-[10px] text-fg-3 hover:bg-danger-soft hover:text-danger">
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                    <p className="mt-2 text-[12px] text-fg-3">{p.recommendation === 'skip' ? `⚠ Engine recommends skipping: ${p.skipReason}` : `Model view: ${p.pick.label} (${fmt(p.pick.p)}), signal ${p.signal}/100.`}</p>
                  </Card>
                )
              })}
              <Card className="p-4">
                <div className="eyebrow mb-3">Add a match</div>
                <div className="flex flex-wrap gap-2">
                  {available.map((m) => (
                    <button key={m.id} onClick={() => add({ matchId: m.id, market: '1x2', selection: 'home' })} className="inline-flex h-9 items-center gap-2 rounded-full border border-line px-3 text-[12.5px] font-bold text-fg-2 hover:border-line-strong hover:text-fg">
                      <Plus className="size-3.5" /> {teamById(m.homeId).short} v {teamById(m.awayId).short}
                    </button>
                  ))}
                </div>
              </Card>
            </div>
            <div className="space-y-5">
              <Card className="p-5">
                <div className="eyebrow">Combined analysis · {legs.length} selections</div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="card-inset p-3">
                    <div className="text-[11px] font-bold text-fg-3">All selections correct</div>
                    <div className="num mt-1 text-[30px] font-bold leading-none text-brand-fg">{fmt(all, 1)}</div>
                    <div className="mt-1 text-[11px] text-fg-3">≈ 1 in {Math.round(1 / all)}</div>
                  </div>
                  <div className="card-inset p-3">
                    <div className="text-[11px] font-bold text-fg-3">Expected correct</div>
                    <div className="num mt-1 text-[30px] font-bold leading-none">{expected.toFixed(2)}</div>
                    <div className="mt-1 text-[11px] text-fg-3">of {legs.length}</div>
                  </div>
                </div>
                <div className="mt-5 h-[210px]">
                  <ResponsiveContainer>
                    <BarChart data={chart} margin={{ top: 4, right: 4, left: -22, bottom: 16 }}>
                      <CartesianGrid stroke="var(--grid)" vertical={false} />
                      <XAxis dataKey="k" tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} label={{ value: "number of correct selections", position: "insideBottom", offset: -12, fill: "var(--text-3)", fontSize: 10 }} height={28} />
                      <YAxis tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
                      <Tooltip cursor={{ fill: 'var(--surface-2)' }} formatter={(v) => [`${v}%`, 'Probability']} contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border-strong)', borderRadius: 12, fontSize: 12 }} />
                      <Bar dataKey="p" radius={[6, 6, 0, 0]}>
                        {chart.map((c, i) => (
                          <Cell key={c.k} fill={i === chart.length - 1 ? 'var(--brand-fg)' : 'var(--surface-3)'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-1 text-[11px] text-fg-3">Exact Poisson-binomial distribution; matches the 10,000-run Monte Carlo check.</p>
              </Card>
              <Notice tone="warn" icon={<AlertTriangle className="size-4" />} title="Independence assumption">
                Combined figures assume the matches are independent. Matches in the same competition and round can be correlated (league-wide scoring conditions, linked table situations), so the true combined probability may differ. {sameDayComp && 'Your selection includes several matches from the same competition.'} Combined probabilities are never guarantees.
              </Notice>
            </div>
          </div>
        )}
      </PageState>
    </>
  )
}

export { Badge }
