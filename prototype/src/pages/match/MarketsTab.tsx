import { useState } from 'react'
import { Check, ChevronDown, Database, Minus, Sigma, X } from 'lucide-react'
import { cx, fairOdds, useProb } from '../../lib/format'
import { CATEGORIES, DATA_REQS, confidenceOf, evaluateMatch, inventory, smartPicks, type DataReq, type MarketCategory, type MarketEval } from '../../lib/markets'
import type { Match } from '../../mock/matches'
import { Badge, Card, CardHeader, Select, Switch } from '../../components/ui/primitives'
import { ConfidencePill, DataQuality, ExplainSheet, MarketPicksCard, MarketStatusBadge, ReliabilityBar, type ExplainTarget } from '../../components/markets'
import { FilterChip } from '../Dashboard'

export default function MarketsTab({ match }: { match: Match }) {
  const evals = evaluateMatch(match)
  const res = smartPicks(match)
  const inv = inventory(match)
  const [cat, setCat] = useState<'all' | MarketCategory>('all')
  const [minP, setMinP] = useState('0')
  const [minConf, setMinConf] = useState<'any' | 'Medium' | 'High'>('any')
  const [showUnavailable, setShowUnavailable] = useState(true)
  const [open, setOpen] = useState<string | null>(null)
  const [target, setTarget] = useState<ExplainTarget | null>(null)

  const confOk = (e: MarketEval) => minConf === 'any' || (minConf === 'Medium' ? confidenceOf(e.reliability) !== 'Low' : confidenceOf(e.reliability) === 'High')
  const visible = evals.filter((e) => (cat === 'all' || e.def.category === cat) && (showUnavailable || e.status !== 'unavailable') && confOk(e) && (e.outcomes.length === 0 || (e.best?.p ?? 0) >= Number(minP)))
  const counts = { active: evals.filter((e) => e.status === 'active').length, validating: evals.filter((e) => e.status === 'validating').length, disabled: evals.filter((e) => e.status === 'disabled').length, unavailable: evals.filter((e) => e.status === 'unavailable').length }
  const pickRank = (key: string) => res.picks.find((p) => p.outcome.key === key)?.rank

  return (
    <div className="space-y-5">
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="eyebrow">Data inventory for this match</div>
            <p className="mt-1 text-[12.5px] text-fg-3">A market is evaluated only when every input it needs exists. Missing data is never treated as zero.</p>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[12px] font-bold">
            <Badge tone="success">{counts.active} available</Badge>
            <Badge tone="warn">{counts.validating} validating</Badge>
            {counts.disabled > 0 && <Badge tone="danger">{counts.disabled} withheld</Badge>}
            <Badge>{counts.unavailable} no data</Badge>
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(DATA_REQS) as DataReq[]).map((k) => {
            const i = inv[k]
            return (
              <div key={k} className="card-inset flex items-start gap-2.5 p-3">
                <span className={cx('mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full', i.ok ? 'bg-success-soft text-success' : 'bg-surface-3 text-fg-3')}>{i.ok ? <Check className="size-3" /> : <X className="size-3" />}</span>
                <div className="min-w-0">
                  <div className="text-[12.5px] font-bold text-fg">{DATA_REQS[k].label}{i.ok && <span className="num ml-1.5 text-[12px] text-fg-3">{Math.round(i.quality * 100)}%</span>}</div>
                  <div className="text-[11.5px] text-fg-3">{i.note}</div>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <div>
        <h2 className="mb-2 flex items-center gap-2 text-[15px] font-bold">Strongest predictions <span className="text-[12px] font-semibold text-fg-3">selected from all 24 markets</span></h2>
        <MarketPicksCard match={match} showHeader={false} onExplain={(p) => setTarget({ match, market: p.market, outcome: p.outcome, pick: p })} />
      </div>

      <Card className="p-3 sm:p-4">
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <FilterChip on={cat === 'all'} onClick={() => setCat('all')}>All 24</FilterChip>
          {CATEGORIES.map((c) => (
            <FilterChip key={c.id} on={cat === c.id} onClick={() => setCat(c.id)}>
              {c.label} <span className="num text-[11px] opacity-60">{evals.filter((e) => e.def.category === c.id).length}</span>
            </FilterChip>
          ))}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3 sm:items-center">
          <Select label="Probability" value={minP} onChange={setMinP} options={[{ value: '0', label: 'Any' }, { value: '0.6', label: 'Best ≥ 60%' }, { value: '0.7', label: 'Best ≥ 70%' }, { value: '0.8', label: 'Best ≥ 80%' }]} />
          <Select label="Confidence" value={minConf} onChange={setMinConf} options={[{ value: 'any', label: 'Any' }, { value: 'Medium', label: 'Medium or high' }, { value: 'High', label: 'High only' }]} />
          <label className="flex items-center gap-2 text-[13px] font-semibold text-fg-2">
            <Switch checked={showUnavailable} onChange={setShowUnavailable} label="Show unavailable markets" /> Show unavailable markets
          </label>
        </div>
      </Card>

      {CATEGORIES.filter((c) => visible.some((e) => e.def.category === c.id)).map((c) => (
        <Card key={c.id}>
          <CardHeader title={c.label} eyebrow={(() => { const n = visible.filter((e) => e.def.category === c.id).length; return `${n} market${n === 1 ? "" : "s"}` })()} />
          <ul className="mt-2 divide-y divide-line">
            {visible
              .filter((e) => e.def.category === c.id)
              .map((e) => (
                <MarketRow key={e.def.id} e={e} open={open === e.def.id} onToggle={() => setOpen(open === e.def.id ? null : e.def.id)} pickRank={pickRank} minP={Number(minP)} onExplain={(o) => setTarget({ match, market: e, outcome: o, pick: res.picks.find((p) => p.outcome.key === o.key) })} />
              ))}
          </ul>
        </Card>
      ))}
      {visible.length === 0 && <Card className="p-8 text-center text-[13px] text-fg-3">No markets match these filters.</Card>}
      <ExplainSheet target={target} onClose={() => setTarget(null)} />
    </div>
  )
}

function MarketRow({ e, open, onToggle, pickRank, minP, onExplain }: { e: MarketEval; open: boolean; onToggle: () => void; pickRank: (k: string) => number | undefined; minP: number; onExplain: (o: MarketEval['outcomes'][number]) => void }) {
  const fmt = useProb()
  const inv = e.missing
  const picked = e.outcomes.map((o) => pickRank(o.key)).find(Boolean)
  const outcomes = e.outcomes.filter((o) => o.p >= Math.min(minP, e.best?.p ?? 0) || minP === 0)
  return (
    <li>
      <button onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2/50 sm:px-5">
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[13.5px] font-bold text-fg">{e.def.name}</span>
            {picked && <Badge tone="brand">Pick #{picked}</Badge>}
          </span>
          <span className="mt-0.5 block truncate text-[12px] text-fg-3">
            {e.status === 'unavailable' || !e.best ? e.reason : `Most likely: ${e.best.label}`}
          </span>
        </span>
        {e.best && e.status !== 'unavailable' && <span className="num text-[15px] font-bold text-fg sm:text-[18px]">{fmt(e.best.p)}</span>}
        <span className="hidden md:block"><ReliabilityBar value={e.reliability} /></span>
        <MarketStatusBadge status={e.status} />
        <ChevronDown className={cx('size-4 shrink-0 text-fg-3 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="animate-fade-up grid gap-5 border-t border-line bg-inset/50 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            {e.outcomes.length > 0 ? (
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-line">
                    <th className="eyebrow h-8 text-left font-bold">Outcome</th>
                    <th className="eyebrow h-8 text-right font-bold">Probability</th>
                    <th className="eyebrow hidden h-8 text-right font-bold sm:table-cell">Fair odds</th>
                    <th className="h-8" />
                  </tr>
                </thead>
                <tbody>
                  {outcomes.map((o) => (
                    <tr key={o.key} className="border-b border-line last:border-0">
                      <td className="py-2 pr-2">
                        <div className="flex items-center gap-2 font-semibold text-fg">
                          {o.label}
                          {pickRank(o.key) && <Badge tone="brand">#{pickRank(o.key)}</Badge>}
                        </div>
                        <div className="mt-1 h-1 w-full max-w-[160px] overflow-hidden rounded-full bg-surface-3">
                          <div className="h-full rounded-full bg-brand-fg" style={{ width: `${o.p * 100}%`, opacity: e.status === 'active' ? 1 : 0.45 }} />
                        </div>
                        {o.note && <div className="mt-1 text-[11px] text-fg-3">{o.note}</div>}
                      </td>
                      <td className="num py-2 text-right text-[15px] font-bold">{fmt(o.p)}</td>
                      <td className="num hidden py-2 text-right text-[13px] text-fg-3 sm:table-cell">{fairOdds(o.p)}</td>
                      <td className="py-2 pl-2 text-right">
                        <button onClick={() => onExplain(o)} aria-label={`Explain ${o.label}`} className="inline-flex size-7 items-center justify-center rounded-lg border border-line text-fg-3 hover:text-fg">
                          <Sigma className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="rounded-xl border border-dashed border-line-strong p-4 text-[13px] text-fg-3">
                <div className="font-bold text-fg-2">Not evaluated</div>
                {e.reason}
              </div>
            )}
            {e.status !== 'active' && e.outcomes.length > 0 && <p className="mt-2 text-[11.5px] text-warn">{e.reason} Shown for transparency — not eligible as a pick.</p>}
          </div>
          <div className="space-y-3 text-[12.5px]">
            <div>
              <div className="eyebrow mb-1">How it is calculated</div>
              <p className="text-fg-2">{e.def.method}</p>
            </div>
            <div>
              <div className="eyebrow mb-1">Settlement</div>
              <p className="text-fg-3">{e.def.settlement}</p>
            </div>
            <div>
              <div className="eyebrow mb-1.5">Required data</div>
              <div className="flex flex-wrap gap-1.5">
                {e.def.requires.map((r) => {
                  const missing = inv.includes(r) || r === 'settlement'
                  return (
                    <span key={r} className={cx('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold', missing ? 'bg-surface-3 text-fg-3' : 'bg-success-soft text-success')}>
                      {missing ? <Minus className="size-3" /> : <Check className="size-3" />} {DATA_REQS[r].label}
                    </span>
                  )
                })}
              </div>
            </div>
            <div className="grid grid-cols-4 gap-1.5 text-center">
              {[
                ['n', e.def.backtest.n ? e.def.backtest.n.toLocaleString() : '—'],
                ['Brier', e.def.backtest.n ? e.def.backtest.brier.toFixed(3) : '—'],
                ['ECE', e.def.backtest.n ? e.def.backtest.ece.toFixed(3) : '—'],
                ['Data', `${Math.round(e.completeness * 100)}%`],
              ].map(([k, v]) => (
                <div key={k} className="card-inset py-1.5">
                  <div className="num text-[13px] font-bold">{v}</div>
                  <div className="text-[10px] font-bold text-fg-3">{k}</div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 text-fg-3">
              <ConfidencePill c={confidenceOf(e.reliability)} />
              <DataQuality value={e.completeness} />
              <span className="inline-flex items-center gap-1"><Database className="size-3.5" /> walk-forward backtest</span>
            </div>
          </div>
        </div>
      )}
    </li>
  )
}
