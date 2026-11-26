import { useMemo, useState } from 'react'
import { CircleDot, Filter, Info, SlidersHorizontal, WifiOff } from 'lucide-react'
import { dayKey, fmtTime, relTime } from '../lib/format'
import { MATCHES, NOW, getPrediction } from '../mock/matches'
import { COMPETITIONS, teamById } from '../mock/teams'
import { PROVIDERS } from '../mock/system'
import { PageHeader } from '../components/layout/shell'
import { Badge, Card, EmptyState, Notice, Segmented, Select, Switch } from '../components/ui/primitives'
import { PageState } from '../components/ui/overlay'
import { CompHeader, DateStrip, MatchRow, ProbBar } from '../components/sports/match'
import { Crest } from '../components/sports/identity'
import { Link } from '../lib/router'
import { DAYS } from './Dashboard'

export function Upcoming() {
  const [day, setDay] = useState('2026-11-28')
  const [comp, setComp] = useState('all')
  const [rec, setRec] = useState<'all' | 'pick' | 'lean' | 'skip'>('all')
  const [minData, setMinData] = useState('0')
  const [hideFinished, setHideFinished] = useState(false)
  const list = useMemo(
    () =>
      MATCHES.filter((m) => dayKey(m.kickoff) === day)
        .filter((m) => comp === 'all' || m.compId === comp)
        .filter((m) => rec === 'all' || getPrediction(m).recommendation === rec)
        .filter((m) => m.completeness >= Number(minData))
        .filter((m) => !hideFinished || m.status !== 'FT'),
    [day, comp, rec, minData, hideFinished],
  )
  const grouped = useMemo(() => {
    const g = new Map<string, typeof list>()
    list.forEach((m) => g.set(m.compId, [...(g.get(m.compId) ?? []), m]))
    return [...g.entries()]
  }, [list])
  const liveCount = MATCHES.filter((m) => m.status === 'LIVE' || m.status === 'HT').length

  return (
    <>
      <PageHeader eyebrow="Football" title="Matches" description="Fixtures with model probabilities. Select a match for the full analysis." />
      <div className="mb-4">
        <DateStrip days={DAYS} value={day} onChange={setDay} liveCount={liveCount} />
      </div>
      <Card className="mb-5 p-3 sm:p-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_auto] lg:items-center">
          <Select
            label="Competition"
            icon={<Filter className="size-4" />}
            value={comp}
            onChange={setComp}
            options={[{ value: 'all', label: 'All competitions' }, ...COMPETITIONS.map((c) => ({ value: c.id, label: c.name, hint: c.modelStatus !== 'active' ? `Model ${c.modelStatus}` : undefined }))]}
          />
          <Select
            label="Data quality"
            icon={<SlidersHorizontal className="size-4" />}
            value={minData}
            onChange={setMinData}
            options={[
              { value: '0', label: 'Any completeness' },
              { value: '0.9', label: '≥ 90% complete' },
              { value: '0.95', label: '≥ 95% complete' },
            ]}
          />
          <Segmented
            value={rec}
            onChange={setRec}
            items={[
              { value: 'all', label: 'All' },
              { value: 'pick', label: 'Picks' },
              { value: 'lean', label: 'Leans' },
              { value: 'skip', label: 'Skip' },
            ]}
            className="w-full justify-between sm:w-auto"
          />
          <label className="flex items-center gap-2 text-[13px] font-semibold text-fg-2">
            <Switch checked={hideFinished} onChange={setHideFinished} label="Hide finished" /> Hide finished
          </label>
        </div>
      </Card>
      <PageState empty={<EmptyState title="No matches for this filter" body="Try another date or widen the competition and data-quality filters." />}>
        {grouped.length === 0 ? (
          <Card>
            <EmptyState title="No matches for this filter" body="Try another date or widen the competition and data-quality filters." />
          </Card>
        ) : (
          <div className="space-y-6">
            {grouped.map(([cid, ms]) => (
              <section key={cid}>
                <CompHeader compId={cid} right={<span className="text-[12px] font-semibold text-fg-3">{ms.length} matches</span>} />
                <div className="space-y-2">
                  {ms.map((m) => (
                    <MatchRow key={m.id} match={m} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </PageState>
    </>
  )
}

export function Live() {
  const live = MATCHES.filter((m) => m.status === 'LIVE' || m.status === 'HT')
  const fdo = PROVIDERS.find((p) => p.id === 'football-data-org')!
  const oldb = PROVIDERS.find((p) => p.id === 'openligadb')!
  return (
    <>
      <PageHeader
        eyebrow={<span className="inline-flex items-center gap-1.5 text-live"><CircleDot className="size-3.5" /> {live.length} in play</span>}
        title="Live matches"
        description="Scores refresh on demand while this page is open (cached 60 s, within provider limits). Pre-match predictions stay locked — AIDICT has no validated in-play model yet."
      />
      <div className="mb-5 grid gap-3 md:grid-cols-2">
        <Notice tone="warn" icon={<Info className="size-4" />} title="Delayed source">
          football-data.org free tier delivers delayed scores. Last update {relTime(fdo.lastSync, NOW)}.
        </Notice>
        <Notice tone="neutral" icon={<WifiOff className="size-4" />} title="OpenLigaDB degraded">
          {oldb.incident}. Bundesliga minutes may lag.
        </Notice>
      </div>
      <PageState empty={<EmptyState icon={<CircleDot className="size-6" />} title="No live matches right now" body="Next kick-off: Inter vs Napoli at 17:00 UTC. Live scores appear here automatically." />}>
        <div className="grid gap-4 lg:grid-cols-2">
          {live.map((m) => {
            const p = getPrediction(m)
            const home = teamById(m.homeId)
            const away = teamById(m.awayId)
            return (
              <Link key={m.id} to={`/match/${m.id}`} className="card block p-5 transition-colors hover:border-line-strong">
                <div className="flex items-center justify-between">
                  <CompMini compId={m.compId} />
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-live-soft px-2.5 py-0.5 text-[12px] font-bold text-live">
                    <span className="animate-pulse-dot size-1.5 rounded-full bg-live" /> {m.status === 'HT' ? 'Half-time' : `${m.minute}′`}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <div className="flex items-center gap-3">
                    <Crest team={home} size={36} />
                    <span className="text-[15px] font-bold">{home.short}</span>
                  </div>
                  <div className="num text-[34px] font-bold">
                    {m.score?.[0]}<span className="px-1 text-fg-3">:</span>{m.score?.[1]}
                  </div>
                  <div className="flex items-center justify-end gap-3">
                    <span className="text-right text-[15px] font-bold">{away.short}</span>
                    <Crest team={away} size={36} />
                  </div>
                </div>
                <div className="mt-4 border-t border-line pt-3">
                  <div className="mb-2 flex items-center justify-between text-[11px] font-bold text-fg-3">
                    <span>PRE-MATCH PROBABILITIES · LOCKED {fmtTime(m.kickoff)}</span>
                    <Badge>In-play model not active</Badge>
                  </div>
                  <ProbBar p={p.x12} height={6} />
                </div>
              </Link>
            )
          })}
        </div>
      </PageState>
    </>
  )
}

function CompMini({ compId }: { compId: string }) {
  const c = COMPETITIONS.find((x) => x.id === compId)!
  return <span className="text-[12px] font-bold text-fg-3">{c.name} · {c.round}</span>
}
