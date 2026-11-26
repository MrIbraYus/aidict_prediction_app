import { useState } from 'react'
import { AlertTriangle, BookOpenCheck, ChevronDown, Database, FlaskConical, Info, Layers, ListChecks, Lock, Scale, ShieldCheck, Sigma } from 'lucide-react'
import { Link } from '../lib/router'
import { cx, fairOdds, fmtDay, fmtTime, useProb } from '../lib/format'
import { categoryLabel, explain, smartPicks, SELECTION, type Confidence, type MarketEval, type MarketStatus, type Outcome, type Pick } from '../lib/markets'
import type { Match } from '../mock/matches'
import { compById, teamById } from '../mock/teams'
import { Crest, Flag } from './sports/identity'
import { Badge, Card, Notice } from './ui/primitives'
import { Sheet } from './ui/overlay'

/* ───────────── Small indicators ───────────── */
export function ConfidencePill({ c }: { c: Confidence }) {
  return <Badge tone={c === 'High' ? 'success' : c === 'Medium' ? 'gold' : 'neutral'}>{c}</Badge>
}

export function ReliabilityBar({ value, className }: { value: number; className?: string }) {
  const v = Math.round(value * 100)
  const color = value >= 0.8 ? 'var(--live)' : value >= 0.66 ? 'var(--gold)' : 'var(--text-3)'
  return (
    <div className={cx('flex items-center gap-2', className)} title={`Model reliability ${v}/100`}>
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-surface-3">
        <div className="h-full rounded-full" style={{ width: `${v}%`, background: color }} />
      </div>
      <span className="num text-[13px] font-bold text-fg-2">{v}</span>
    </div>
  )
}

export function DataQuality({ value }: { value: number }) {
  const v = Math.round(value * 100)
  const tone = value >= 0.93 ? 'text-success' : value >= 0.85 ? 'text-warn' : 'text-danger'
  return (
    <span className={cx('inline-flex items-center gap-1 text-[12px] font-bold', tone)} title="Completeness of the data this market needs">
      <Database className="size-3.5" /> {v}%
    </span>
  )
}

const STATUS: Record<MarketStatus, { label: string; tone: 'success' | 'warn' | 'danger' | 'neutral' }> = {
  active: { label: 'Available', tone: 'success' },
  validating: { label: 'Validating', tone: 'warn' },
  disabled: { label: 'Withheld', tone: 'danger' },
  unavailable: { label: 'Data unavailable', tone: 'neutral' },
}
export function MarketStatusBadge({ status }: { status: MarketStatus }) {
  return (
    <Badge tone={STATUS[status].tone} dot>
      {STATUS[status].label}
    </Badge>
  )
}

/* ───────────── Pick table (desktop) / list (mobile) ───────────── */
export function PickTable({ picks, onExplain }: { picks: Pick[]; onExplain: (p: Pick) => void }) {
  const fmt = useProb()
  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-line">
              <th className="eyebrow h-9 w-8 font-bold">#</th>
              <th className="eyebrow h-9 font-bold">Market</th>
              <th className="eyebrow h-9 font-bold">Prediction</th>
              <th className="eyebrow h-9 text-right font-bold">Probability</th>
              <th className="eyebrow h-9 pl-5 font-bold">Confidence</th>
              <th className="eyebrow h-9 font-bold">Reliability</th>
              <th className="eyebrow h-9 font-bold">Data</th>
              <th className="eyebrow h-9 font-bold">Status</th>
              <th className="h-9" />
            </tr>
          </thead>
          <tbody>
            {picks.map((p) => (
              <tr key={p.outcome.key} className="border-b border-line last:border-0">
                <td className="num py-3 text-[15px] font-bold text-fg-3">{p.rank}</td>
                <td className="py-3 pr-3">
                  <div className="font-semibold text-fg">{p.market.def.name}</div>
                  <div className="text-[11px] text-fg-3">{categoryLabel(p.market.def.category)}</div>
                </td>
                <td className="py-3 pr-3 font-bold text-fg">{p.outcome.label}</td>
                <td className="py-3 text-right">
                  <div className="num text-[20px] font-bold leading-none text-fg">{fmt(p.outcome.p)}</div>
                  <div className="mt-0.5 text-[10.5px] font-semibold text-fg-3">
                    {fmt(p.interval[0])}–{fmt(p.interval[1])}
                  </div>
                </td>
                <td className="py-3 pl-5"><ConfidencePill c={p.confidence} /></td>
                <td className="py-3"><ReliabilityBar value={p.market.reliability} /></td>
                <td className="py-3"><DataQuality value={p.market.completeness} /></td>
                <td className="py-3"><MarketStatusBadge status={p.market.status} /></td>
                <td className="py-3 text-right">
                  <button onClick={() => onExplain(p)} className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-line px-2.5 text-[12px] font-bold text-fg-2 hover:border-line-strong hover:text-fg">
                    <Sigma className="size-3.5" /> Explain
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Mobile list */}
      <ul className="space-y-2 md:hidden">
        {picks.map((p) => (
          <li key={p.outcome.key}>
            <button onClick={() => onExplain(p)} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface-2/60 p-3 text-left">
              <span className="num w-5 text-[15px] font-bold text-fg-3">{p.rank}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-semibold text-fg-3">{p.market.def.name}</span>
                <span className="block truncate text-[14px] font-bold text-fg">{p.outcome.label}</span>
                <span className="mt-1 flex items-center gap-2">
                  <ConfidencePill c={p.confidence} />
                  <DataQuality value={p.market.completeness} />
                </span>
              </span>
              <span className="text-right">
                <span className="num block text-[22px] font-bold leading-none">{fmt(p.outcome.p)}</span>
                <span className="mt-1 block text-[10.5px] font-semibold text-fg-3">rel. {Math.round(p.market.reliability * 100)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}

/* ───────────── Match card with the strongest 4–5 predictions ───────────── */
export function MarketPicksCard({ match, onExplain, showHeader = true, filter }: { match: Match; onExplain: (p: Pick) => void; showHeader?: boolean; filter?: (p: Pick) => boolean }) {
  const res = smartPicks(match)
  const [why, setWhy] = useState(false)
  const home = teamById(match.homeId)
  const away = teamById(match.awayId)
  const comp = compById(match.compId)
  const picks = filter ? res.picks.filter(filter) : res.picks
  return (
    <Card as="article" className="overflow-hidden">
      {showHeader && (
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3.5 sm:px-5">
          <div className="flex items-center gap-2">
            <Crest team={home} size={26} />
            <Crest team={away} size={26} />
          </div>
          <div className="min-w-0 flex-1">
            <Link to={`/match/${match.id}/markets`} className="block truncate text-[15px] font-bold hover:text-brand-fg">
              {home.name} vs {away.name}
            </Link>
            <div className="flex items-center gap-1.5 text-[12px] font-semibold text-fg-3">
              <Flag code={comp.flag} /> {comp.name} · {fmtDay(match.kickoff)} {fmtTime(match.kickoff)} UTC
            </div>
          </div>
          <span className="text-[12px] font-semibold text-fg-3">
            {res.picks.length} of {res.evaluated} markets selected · {res.available} available
          </span>
        </div>
      )}
      <div className="p-3 sm:px-5 sm:py-3">
        {picks.length > 0 ? (
          <PickTable picks={picks} onExplain={onExplain} />
        ) : (
          <div className="rounded-2xl border border-dashed border-line-strong px-4 py-6 text-center text-[13px] text-fg-3">{res.picks.length ? 'No picks match the current filters.' : 'No prediction is strong and reliable enough for this match.'}</div>
        )}
        {res.shortfall && (
          <Notice className="mt-3" tone={res.picks.length ? 'neutral' : 'warn'} icon={<Info className="size-4" />} title={res.picks.length ? `Showing ${res.picks.length} instead of 4–5` : 'Skip this match'}>
            {res.shortfall}
          </Notice>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2.5 sm:px-5">
        <button onClick={() => setWhy((w) => !w)} aria-expanded={why} className="inline-flex items-center gap-1.5 text-[12px] font-bold text-fg-3 hover:text-fg">
          <ChevronDown className={cx('size-3.5 transition-transform', why && 'rotate-180')} /> Why not other markets? ({res.exclusions.length})
        </button>
        <Link to={`/match/${match.id}/markets`} className="text-[12px] font-bold text-brand-fg">
          All 24 markets →
        </Link>
      </div>
      {why && (
        <ul className="animate-fade-up space-y-1.5 border-t border-line bg-inset/60 px-4 py-3 sm:px-5">
          {res.exclusions.map((x) => (
            <li key={x.market + x.label} className="flex items-start gap-3 text-[12.5px]">
              <span className="num w-10 shrink-0 text-right text-[14px] font-bold text-fg-3">{Math.round(x.p * 100)}%</span>
              <span>
                <b className="text-fg-2">{x.label}</b> <span className="text-fg-3">· {x.market}</span>
                <span className="block text-fg-3">{x.reason}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

/* ───────────── Full statistical explanation ───────────── */
export type ExplainTarget = { match: Match; market: MarketEval; outcome: Outcome; pick?: Pick }

export function ExplainSheet({ target, onClose }: { target: ExplainTarget | null; onClose: () => void }) {
  const fmt = useProb()
  if (!target) return null
  const { match, market, outcome, pick } = target
  const ex = explain(match, market, outcome)
  const res = smartPicks(match)
  const bt = market.def.backtest
  const reliability = market.reliability
  const conf: Confidence = reliability >= 0.8 ? 'High' : reliability >= 0.66 ? 'Medium' : 'Low'
  const hw = 0.02 + (1 - reliability) * 0.12
  return (
    <Sheet open onClose={onClose} title="Statistical explanation" side="right">
      <div className="space-y-5">
        <div>
          <div className="text-[12px] font-semibold text-fg-3">
            {teamById(match.homeId).name} vs {teamById(match.awayId).name} · {market.def.name}
          </div>
          <div className="mt-1 text-[20px] font-extrabold">{outcome.label}</div>
          <div className="mt-3 flex items-end gap-4">
            <div className="num text-[44px] font-bold leading-none text-brand-fg">{fmt(outcome.p)}</div>
            <div className="pb-1 text-[12px] text-fg-3">
              range {fmt(Math.max(0, outcome.p - hw))}–{fmt(Math.min(1, outcome.p + hw))} · fair odds {fairOdds(outcome.p)}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <MarketStatusBadge status={market.status} />
            <ConfidencePill c={conf} />
            <Badge>{categoryLabel(market.def.category)}</Badge>
            {pick && <Badge tone="brand">Ranked #{pick.rank} for this match</Badge>}
          </div>
          {market.status !== 'active' && market.reason && (
            <Notice className="mt-3" tone={market.status === 'unavailable' ? 'neutral' : 'warn'} icon={<AlertTriangle className="size-4" />} title="Not published as a pick">
              {market.reason}
            </Notice>
          )}
        </div>

        <section>
          <h3 className="eyebrow mb-2 flex items-center gap-1.5"><ListChecks className="size-3.5" /> Main statistical reasons</h3>
          <ul className="space-y-2 text-[13px] text-fg-2">
            {ex.reasons.map((r) => (
              <li key={r} className="flex gap-2"><span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-brand-fg" />{r}</li>
            ))}
          </ul>
        </section>

        {outcome.breakdown && (
          <section>
            <h3 className="eyebrow mb-2 flex items-center gap-1.5"><Scale className="size-3.5" /> Settlement outcomes</h3>
            <div className="grid grid-cols-5 gap-1.5 text-center">
              {outcome.breakdown.map((b) => (
                <div key={b.label} className="card-inset px-1 py-2">
                  <div className="num text-[15px] font-bold">{fmt(b.p)}</div>
                  <div className="text-[10px] font-bold text-fg-3">{b.label}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {ex.history.length > 0 && (
          <section>
            <h3 className="eyebrow mb-2">Relevant historical statistics</h3>
            <dl className="divide-y divide-line rounded-xl border border-line">
              {ex.history.map((h) => (
                <div key={h.label} className="flex items-center justify-between gap-3 px-3 py-2 text-[12.5px]">
                  <dt className="text-fg-3">{h.label}</dt>
                  <dd className="num text-[14px] font-bold text-fg">{h.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <section>
          <h3 className="eyebrow mb-2 flex items-center gap-1.5"><ShieldCheck className="size-3.5" /> Model reliability · {Math.round(reliability * 100)}/100</h3>
          <div className="grid grid-cols-2 gap-2 text-[12.5px]">
            {[
              ['Out-of-sample predictions', bt.n ? bt.n.toLocaleString() : 'none yet'],
              ['Calibration error (ECE)', bt.n ? bt.ece.toFixed(3) : '—'],
              ['Brier score', bt.n ? bt.brier.toFixed(3) : '—'],
              ['Log loss', bt.n ? bt.logLoss.toFixed(3) : '—'],
              ['Data completeness', `${Math.round(market.completeness * 100)}%`],
              ['Settlement rules', market.def.requires.includes('settlement') ? 'Not verified' : 'Standard'],
            ].map(([k, v]) => (
              <div key={k} className="card-inset px-3 py-2">
                <div className="text-[11px] text-fg-3">{k}</div>
                <div className="num text-[15px] font-bold">{v}</div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-fg-3">Reliability = 40% calibration + 25% sample size + 25% data completeness + 10% settlement/coverage. Small samples are never treated as reliable, however accurate they look.</p>
        </section>

        <section>
          <h3 className="eyebrow mb-2 flex items-center gap-1.5"><Database className="size-3.5" /> Data used</h3>
          <ul className="space-y-1.5 text-[12.5px]">
            {ex.inputs.map((i) => (
              <li key={i.label} className="flex justify-between gap-3 rounded-lg bg-surface-2/70 px-3 py-2">
                <span className="font-semibold text-fg-2">{i.label}</span>
                <span className="text-right text-fg-3">{i.value}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="eyebrow mb-2 flex items-center gap-1.5"><BookOpenCheck className="size-3.5" /> Method</h3>
          <p className="text-[13px] text-fg-2">{market.def.method}</p>
          <p className="mt-2 text-[12px] text-fg-3"><b className="text-fg-2">Settlement:</b> {market.def.settlement}</p>
        </section>

        {pick && (
          <section>
            <h3 className="eyebrow mb-2 flex items-center gap-1.5"><Layers className="size-3.5" /> Why it was selected</h3>
            <p className="text-[13px] text-fg-2">
              Selection score {pick.score.toFixed(2)} = 45% probability + 30% reliability + 25% evidence (+{Math.round(pick.lift * 100)} pp over a typical match). It passed every rule: probability ≥ {SELECTION.minProbability * 100}%, reliability ≥ {SELECTION.minReliability * 100}, evidence ≥ +{SELECTION.minLift * 100} pp, not obvious (typical-match rate ≤ {SELECTION.maxBaseRate * 100}%), and correlation with higher-ranked picks ≤ {SELECTION.maxCorrelation}.
            </p>
            {res.exclusions.length > 0 && (
              <p className="mt-2 text-[12px] text-fg-3">Not selected: {res.exclusions.slice(0, 3).map((x) => `${x.label} (${Math.round(x.p * 100)}%)`).join(', ')} — see “Why not other markets?”.</p>
            )}
          </section>
        )}

        <div className="flex items-start gap-2 rounded-xl border border-line bg-surface-2/60 p-3 text-[12px] text-fg-3">
          <Lock className="mt-0.5 size-3.5 shrink-0" />
          A {fmt(outcome.p)} probability means this outcome is expected to fail about {Math.max(1, Math.round((1 - outcome.p) * 10))} times in 10 similar matches. Nothing here is guaranteed. Locked at kick-off and tracked in Prediction History.
        </div>
        <p className="flex items-center gap-1.5 text-[11px] text-warn"><FlaskConical className="size-3.5" /> Prototype: inputs and historical figures are sample data.</p>
      </div>
    </Sheet>
  )
}
