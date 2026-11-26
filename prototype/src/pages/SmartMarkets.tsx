import { useMemo, useState } from 'react'
import { CheckCircle2, CircleSlash, Filter, Info, Layers, ListChecks, SlidersHorizontal } from 'lucide-react'
import { dayKey, fmtDay } from '../lib/format'
import { CATEGORIES, DATA_REQS, MARKET_DEFS, SELECTION, smartPicks, supportLevel, type MarketCategory, type Pick } from '../lib/markets'
import { MATCHES } from '../mock/matches'
import { compById, teamById } from '../mock/teams'
import { Link } from '../lib/router'
import { PageHeader } from '../components/layout/shell'
import { Badge, Button, Card, CardHeader, EmptyState, Kpi, Notice, Select } from '../components/ui/primitives'
import { PageState, Sheet } from '../components/ui/overlay'
import { ExplainSheet, MarketPicksCard, type ExplainTarget } from '../components/markets'
import { FilterChip } from './Dashboard'

export default function SmartMarkets() {
  const [day, setDay] = useState<string>('all')
  const [comp, setComp] = useState('all')
  const [minP, setMinP] = useState('0')
  const [minConf, setMinConf] = useState<'any' | 'Medium' | 'High'>('any')
  const [cat, setCat] = useState<'all' | MarketCategory>('all')
  const [rules, setRules] = useState(false)
  const [coverage, setCoverage] = useState(false)
  const [target, setTarget] = useState<ExplainTarget | null>(null)

  const upcoming = MATCHES.filter((m) => m.status === 'SCHEDULED').sort((a, b) => a.kickoff.localeCompare(b.kickoff))
  const days = [...new Set(upcoming.map((m) => dayKey(m.kickoff)))]
  const list = upcoming.filter((m) => (day === 'all' || dayKey(m.kickoff) === day) && (comp === 'all' || m.compId === comp))
  const pickFilter = (p: Pick) =>
    p.outcome.p >= Number(minP) && (minConf === 'any' || (minConf === 'Medium' ? p.confidence !== 'Low' : p.confidence === 'High')) && (cat === 'all' || p.market.def.category === cat)
  const withPicks = list.filter((m) => smartPicks(m).picks.some(pickFilter))
  const without = list.filter((m) => !smartPicks(m).picks.some(pickFilter))
  const stats = useMemo(() => {
    const all = upcoming.map((m) => smartPicks(m))
    const picks = all.reduce((s, r) => s + r.picks.length, 0)
    return { matches: upcoming.length, picks, full: all.filter((r) => r.picks.length >= 4).length, skipped: all.filter((r) => r.picks.length === 0).length }
  }, [upcoming])

  return (
    <>
      <PageHeader
        eyebrow="24 markets · market-specific models"
        title="Smart Market Predictions"
        description="For every match AIDICT evaluates all 24 supported markets with their own models, then keeps only the 4–5 strongest predictions: probable, reliable, backed by match-specific evidence and not duplicates of each other."
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => setRules((r) => !r)}>
              <ListChecks className="size-4" /> Selection rules
            </Button>
            <Button size="sm" variant="outline" onClick={() => setCoverage(true)}>
              <Layers className="size-4" /> Market coverage
            </Button>
          </>
        }
      />
      {rules && (
        <Card className="animate-fade-up mb-5 p-5">
          <div className="grid gap-5 md:grid-cols-2">
            <ol className="space-y-2 text-[13px] text-fg-2">
              <li><b className="text-fg">1 · Evaluate</b> every market whose required data exists (24 per match).</li>
              <li><b className="text-fg">2 · Probability</b> of each outcome from that market's own model.</li>
              <li><b className="text-fg">3 · Reliability</b> (0–100): calibration 40% · sample size 25% · data completeness 25% · settlement/coverage 10%.</li>
              <li><b className="text-fg">4 · Eligibility</b>: market validated for this competition · probability ≥ {SELECTION.minProbability * 100}% · reliability ≥ {SELECTION.minReliability * 100} · at least +{SELECTION.minLift * 100} pp above a typical match · not obvious (typical rate ≤ {SELECTION.maxBaseRate * 100}%).</li>
              <li><b className="text-fg">5 · Rank</b> by score = 45% probability + 30% reliability + 25% evidence.</li>
              <li><b className="text-fg">6 · De-duplicate</b>: one outcome per market; skip any outcome correlated φ &gt; {SELECTION.maxCorrelation} with a higher-ranked pick (joint probability from the score matrix).</li>
              <li><b className="text-fg">7 · Keep 4–5</b>; if fewer qualify, show fewer and say why.</li>
            </ol>
            <div className="space-y-3 text-[13px] text-fg-2">
              <Notice tone="neutral" title="Why not just the five highest percentages?">
                “Over 0.5 goals” at 93% happens in 92% of all matches — it tells you nothing about this match. An 85% outcome from a poorly calibrated or data-starved market can be less trustworthy than a well-supported 78% one.
              </Notice>
              <Notice tone="warn" title="Probability is not value">
                No free provider supplies odds for most of these markets, so AIDICT does not claim value here. Picks are probabilities, never guarantees.
              </Notice>
            </div>
          </div>
        </Card>
      )}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Matches analysed" value={stats.matches} sub="next 5 days" />
        <Kpi label="Predictions selected" value={stats.picks} sub={`from ${stats.matches * MARKET_DEFS.length} market evaluations`} />
        <Kpi label="Full 4–5 pick cards" value={stats.full} sub="others show fewer, with reasons" />
        <Kpi label="Matches to skip" value={stats.skipped} sub="nothing met the rules" />
      </div>
      <Card className="mb-4 p-3 sm:p-4">
        <div className="no-scrollbar -mx-1 mb-3 flex gap-2 overflow-x-auto px-1">
          <FilterChip on={day === 'all'} onClick={() => setDay('all')}>All days</FilterChip>
          {days.map((d) => (
            <FilterChip key={d} on={day === d} onClick={() => setDay(d)}>
              {d === '2026-11-28' ? 'Today' : fmtDay(d + 'T12:00:00Z')} {Number(d.slice(8))}
            </FilterChip>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Select icon={<Filter className="size-4" />} label="In" value={comp} onChange={setComp} options={[{ value: 'all', label: 'All competitions' }, ...[...new Set(upcoming.map((m) => m.compId))].map((c) => ({ value: c, label: compById(c).name }))]} />
          <Select icon={<Layers className="size-4" />} label="Market" value={cat} onChange={setCat} options={[{ value: 'all', label: 'All categories' }, ...CATEGORIES.map((c) => ({ value: c.id, label: c.label }))]} />
          <Select icon={<SlidersHorizontal className="size-4" />} label="Probability" value={minP} onChange={setMinP} options={[{ value: '0', label: 'Any' }, { value: '0.7', label: '≥ 70%' }, { value: '0.8', label: '≥ 80%' }]} />
          <Select icon={<CheckCircle2 className="size-4" />} label="Confidence" value={minConf} onChange={setMinConf} options={[{ value: 'any', label: 'Any' }, { value: 'Medium', label: 'Medium or high' }, { value: 'High', label: 'High only' }]} />
        </div>
      </Card>
      <PageState empty={<EmptyState icon={<ListChecks className="size-6" />} title="No market predictions yet" body="Predictions are published 24 hours before kick-off once the data sync has run." />}>
        {withPicks.length === 0 ? (
          <Card><EmptyState icon={<ListChecks className="size-6" />} title="No predictions match these filters" body="Try a lower probability or confidence filter, or another market category." /></Card>
        ) : (
          <div className="space-y-4">
            {withPicks.map((m) => (
              <MarketPicksCard key={m.id} match={m} filter={pickFilter} onExplain={(p) => setTarget({ match: m, market: p.market, outcome: p.outcome, pick: p })} />
            ))}
          </div>
        )}
        {without.length > 0 && (
          <Card className="mt-5">
            <CardHeader title="No qualifying predictions" icon={<CircleSlash className="size-4 text-fg-3" />} eyebrow={`${without.length} matches · skipping is a valid outcome`} />
            <ul className="divide-y divide-line px-5 pb-2 pt-2">
              {without.map((m) => {
                const r = smartPicks(m)
                return (
                  <li key={m.id} className="py-3 text-[13px]">
                    <Link to={`/match/${m.id}/markets`} className="font-bold text-fg hover:text-brand-fg">{teamById(m.homeId).name} vs {teamById(m.awayId).name}</Link>
                    <span className="ml-2 text-[12px] text-fg-3">{compById(m.compId).name}</span>
                    <p className="mt-0.5 text-fg-3">{r.shortfall ?? 'Picks exist but none match the current filters.'}</p>
                  </li>
                )
              })}
            </ul>
          </Card>
        )}
      </PageState>
      <ExplainSheet target={target} onClose={() => setTarget(null)} />
      <CoverageSheet open={coverage} onClose={() => setCoverage(false)} />
    </>
  )
}

export function CoverageSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Market coverage with planned data providers" side="right">
      <p className="mb-4 text-[13px] text-fg-3">Which of the 24 markets the planned free providers can support, and what is missing.</p>
      <div className="mb-4 grid grid-cols-3 gap-2 text-center">
        {(['supported', 'partial', 'needs-data'] as const).map((lvl) => (
          <div key={lvl} className="card-inset py-2.5">
            <div className="num text-[22px] font-bold">{MARKET_DEFS.filter((d) => supportLevel(d).level === lvl).length}</div>
            <div className="text-[10.5px] font-bold text-fg-3">{lvl === 'supported' ? 'SUPPORTED' : lvl === 'partial' ? 'PARTIAL' : 'NEED MORE DATA'}</div>
          </div>
        ))}
      </div>
      <ul className="space-y-2">
        {MARKET_DEFS.map((d) => {
          const s = supportLevel(d)
          return (
            <li key={d.id} className="rounded-xl border border-line bg-surface-2/50 p-3">
              <div className="flex items-start justify-between gap-3">
                <span className="text-[13px] font-bold">{d.name}</span>
                <Badge tone={s.level === 'supported' ? 'success' : s.level === 'partial' ? 'warn' : 'danger'}>{s.level === 'supported' ? 'Supported' : s.level === 'partial' ? 'Partial' : 'Needs data'}</Badge>
              </div>
              <div className="mt-1 text-[12px] text-fg-3">{s.label}</div>
              <div className="mt-2 flex flex-wrap gap-1">
                {d.requires.map((r) => (
                  <span key={r} className={`rounded-md px-1.5 py-0.5 text-[10.5px] font-bold ${DATA_REQS[r].free === 'yes' ? 'bg-success-soft text-success' : DATA_REQS[r].free === 'partial' ? 'bg-warn-soft text-warn' : 'bg-danger-soft text-danger'}`}>
                    {DATA_REQS[r].label}
                  </span>
                ))}
              </div>
            </li>
          )
        })}
      </ul>
      <Notice className="mt-4" tone="neutral" icon={<Info className="size-4" />} title="To unlock more markets">
        Player markets need minutes, line-ups and penalty data (API-Football paid tier or another licensed source). 1UP / 2UP / Never Down need your bookmaker's exact settlement rules. Consecutive-goal and first-goal markets need goal times, which free sources provide only for some leagues.
      </Notice>
    </Sheet>
  )
}
