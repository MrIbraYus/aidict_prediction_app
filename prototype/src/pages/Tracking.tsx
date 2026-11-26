import { Fragment, useMemo, useState } from 'react'
import { CheckCircle2, ChevronDown, Download, Lock, MinusCircle, XCircle } from 'lucide-react'
import { CartesianGrid, ComposedChart, ErrorBar, Legend, Line, LineChart, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis, ZAxis } from 'recharts'
import { useApp } from '../lib/store'
import { cx, fmtDate, fmtTime, useProb } from '../lib/format'
import { BACKTEST, BRIER_TREND, BY_COMPETITION, BY_MARKET, CALIBRATION, HISTORY, KPIS } from '../mock/analytics'
import { compById, teamById } from '../mock/teams'
import { PageHeader } from '../components/layout/shell'
import { Badge, Button, Card, CardHeader, EmptyState, Kpi, Notice, Segmented, Select, StatusBadge, Table, Tabs, Td, Th } from '../components/ui/primitives'
import { PageState } from '../components/ui/overlay'
import { Crest, Flag } from '../components/sports/identity'
import { SPORTS } from '../mock/teams'
import MarketPerformance from './MarketPerformance'

const tooltipStyle = { background: 'var(--surface-2)', border: '1px solid var(--border-strong)', borderRadius: 12, fontSize: 12 }

export function HistoryPage() {
  const [result, setResult] = useState<'all' | 'won' | 'lost' | 'void'>('all')
  const [comp, setComp] = useState('all')
  const [market, setMarket] = useState('all')
  const [open, setOpen] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const fmt = useProb()
  const toast = useApp((s) => s.toast)
  const rows = useMemo(
    () => HISTORY.filter((r) => (result === 'all' || r.result === result) && (comp === 'all' || r.compId === comp) && (market === 'all' || r.market === market)),
    [result, comp, market],
  )
  const pageSize = 15
  const pages = Math.max(1, Math.ceil(rows.length / pageSize))
  const view = rows.slice(page * pageSize, page * pageSize + pageSize)
  const settled = rows.filter((r) => r.result === 'won' || r.result === 'lost')
  const won = settled.filter((r) => r.result === 'won').length
  const brier = settled.reduce((s, r) => s + (r.brier ?? 0), 0) / (settled.length || 1)

  return (
    <>
      <PageHeader
        eyebrow="Immutable record"
        title="Prediction History"
        description="Every published prediction, recorded before kick-off and never altered. Results are settled automatically from confirmed final scores."
        actions={
          <Button size="sm" variant="outline" onClick={() => toast({ tone: 'success', title: 'Export prepared', body: 'CSV with snapshot hashes (prototype).' })}>
            <Download className="size-4" /> Export CSV
          </Button>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Total" value={KPIS.total.toLocaleString()} sub="published" />
        <Kpi label="Settled" value={KPIS.settled.toLocaleString()} sub={`${KPIS.pending} pending`} />
        <Kpi label="Correct (filtered)" value={`${won}/${settled.length}`} sub={settled.length ? fmt(won / settled.length, 1) : '—'} />
        <Kpi label="Mean Brier (filtered)" value={brier.toFixed(3)} sub="lower is better" />
        <Kpi label="Tracking since" value="15 Aug" sub="2026 · live only" className="col-span-2 lg:col-span-1" />
      </div>
      <Card className="mb-4 p-3 sm:p-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[auto_1fr_1fr] lg:items-center">
          <Segmented
            value={result}
            onChange={(v) => { setResult(v); setPage(0) }}
            items={[
              { value: 'all', label: 'All' },
              { value: 'won', label: 'Correct' },
              { value: 'lost', label: 'Incorrect' },
              { value: 'void', label: 'Void' },
            ]}
          />
          <Select value={comp} onChange={(v) => { setComp(v); setPage(0) }} label="Competition" options={[{ value: 'all', label: 'All' }, ...['pl', 'pd', 'bl1', 'sa', 'fl1'].map((c) => ({ value: c, label: compById(c).name }))]} />
          <Select value={market} onChange={(v) => { setMarket(v); setPage(0) }} label="Market" options={[{ value: 'all', label: 'All markets' }, ...[...new Set(HISTORY.map((h) => h.market))].map((m) => ({ value: m, label: m }))]} />
        </div>
      </Card>
      <PageState empty={<EmptyState title="No predictions recorded yet" body="Predictions appear here once the first snapshot is published (T-24h before kick-off)." />}>
        <Card>
          {view.length === 0 ? (
            <EmptyState title="No predictions match these filters" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Match</Th>
                  <Th>Market · selection</Th>
                  <Th align="right">Prob.</Th>
                  <Th align="center">Score</Th>
                  <Th>Result</Th>
                  <Th align="right">Brier</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {view.map((r) => (
                  <Fragment key={r.id}>
                    <tr className="cursor-pointer hover:bg-surface-2/60" onClick={() => setOpen(open === r.id ? null : r.id)}>
                      <Td className="whitespace-nowrap">{fmtDate(r.date)}<div className="text-[11px] text-fg-3">{fmtTime(r.date)}</div></Td>
                      <Td>
                        <div className="flex items-center gap-2 font-semibold text-fg"><Crest team={teamById(r.homeId)} size={16} />{teamById(r.homeId).short} v {teamById(r.awayId).short}</div>
                        <div className="flex items-center gap-1.5 text-[11px] text-fg-3"><Flag code={compById(r.compId).flag} className="!h-2.5 !w-3.5" /> {compById(r.compId).name}</div>
                      </Td>
                      <Td><div className="text-[11px] text-fg-3">{r.market}</div><div className="font-semibold text-fg">{r.selection}</div></Td>
                      <Td align="right"><span className="num text-[15px] font-bold text-fg">{fmt(r.p)}</span></Td>
                      <Td align="center"><span className="num text-[15px] font-bold">{r.score}</span></Td>
                      <Td>
                        {r.result === 'won' ? <span className="inline-flex items-center gap-1.5 font-bold text-success"><CheckCircle2 className="size-4" /> Correct</span> : r.result === 'lost' ? <span className="inline-flex items-center gap-1.5 font-bold text-danger"><XCircle className="size-4" /> Incorrect</span> : <span className="inline-flex items-center gap-1.5 font-bold text-fg-3"><MinusCircle className="size-4" /> Void</span>}
                      </Td>
                      <Td align="right"><span className="num text-[14px]">{r.brier?.toFixed(3) ?? '—'}</span></Td>
                      <Td><ChevronDown className={cx('size-4 text-fg-3 transition-transform', open === r.id && 'rotate-180')} /></Td>
                    </tr>
                    {open === r.id && (
                      <tr>
                        <td colSpan={8} className="border-b border-line bg-inset/60 px-4 py-4">
                          <div className="grid gap-3 text-[12px] sm:grid-cols-4">
                            <div><div className="eyebrow">Snapshot</div><div className="mt-1 font-semibold text-fg-2">{fmtDate(r.snapshotAt)} {fmtTime(r.snapshotAt)} UTC</div></div>
                            <div><div className="eyebrow">Model</div><div className="mt-1 font-semibold text-fg-2">{r.model}</div></div>
                            <div><div className="eyebrow">Prediction ID</div><div className="mt-1 font-mono text-fg-2">{r.id}</div></div>
                            <div><div className="eyebrow">Integrity</div><div className="mt-1 flex items-center gap-1.5 font-semibold text-fg-2"><Lock className="size-3.5" /> Locked at kick-off</div></div>
                          </div>
                          {r.result === 'void' && <p className="mt-3 text-[12px] text-fg-3">Voided: match abandoned at 34′ and replayed. Excluded from all metrics.</p>}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </Table>
          )}
          <div className="flex items-center justify-between px-5 py-3 text-[12px] font-semibold text-fg-3">
            <span>{rows.length} predictions · page {page + 1} of {pages}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button size="sm" variant="outline" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </Card>
      </PageState>
    </>
  )
}

export function PerformancePage() {
  const [tab, setTab] = useState<'live' | 'backtest' | 'markets'>('live')
  const fmt = useProb()
  return (
    <>
      <PageHeader
        eyebrow="Model evaluation"
        title="Performance Analytics"
        description="Measured on genuinely recorded predictions. Accuracy alone is misleading — calibration, Brier score and log loss show whether the probabilities can be trusted."
        actions={<Segmented value={tab} onChange={setTab} items={[{ value: 'live', label: 'Live tracking' }, { value: 'backtest', label: 'Walk-forward backtest' }, { value: 'markets', label: 'Markets (24)' }]} />}
      />
      <PageState>
        {tab === 'markets' ? (
          <MarketPerformance />
        ) : tab === 'live' ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Kpi label="Settled predictions" value={KPIS.settled.toLocaleString()} sub={`since ${fmtDate(KPIS.since + 'T00:00:00Z')}`} />
              <Kpi label="1X2 hit rate" value={fmt(KPIS.accuracy.value, 1)} sub={`95% CI ${fmt(KPIS.accuracy.ci[0], 1)}–${fmt(KPIS.accuracy.ci[1], 1)}`} />
              <Kpi label="Brier (1X2)" value={KPIS.brier.value.toFixed(3)} delta={`−${(KPIS.brier.baseline - KPIS.brier.value).toFixed(3)} vs base`} deltaGood />
              <Kpi label="Log loss" value={KPIS.logLoss.value.toFixed(3)} delta={`−${(KPIS.logLoss.baseline - KPIS.logLoss.value).toFixed(3)} vs base`} deltaGood />
              <Kpi label="Calibration (ECE)" value={KPIS.ece.value.toFixed(3)} sub="gate ≤ 0.030" className="col-span-2 lg:col-span-1" />
            </div>
            <Notice tone="neutral" title="Honest benchmark">
              AIDICT beats the base-rate benchmark but is still slightly behind bookmaker closing odds (Brier {KPIS.brier.market} vs {KPIS.brier.value}). Closing odds are the hardest benchmark in football and are reported here instead of being hidden.
            </Notice>
            <div className="grid gap-5 lg:grid-cols-2">
              <Card>
                <CardHeader title="Reliability diagram" eyebrow="1X2 · predicted vs observed frequency" />
                <div className="h-[300px] p-3">
                  <ResponsiveContainer>
                    <ComposedChart data={CALIBRATION} margin={{ top: 10, right: 16, left: -8, bottom: 8 }}>
                      <CartesianGrid stroke="var(--grid)" />
                      <XAxis type="number" dataKey="predicted" domain={[0, 1]} ticks={[0, 0.2, 0.4, 0.6, 0.8, 1]} tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} label={{ value: 'Predicted probability', position: 'insideBottom', offset: -4, fill: 'var(--text-3)', fontSize: 11 }} />
                      <YAxis type="number" dataKey="observed" domain={[0, 1]} ticks={[0, 0.2, 0.4, 0.6, 0.8, 1]} tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <ZAxis dataKey="n" range={[70, 420]} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown, k) => [typeof v === 'number' ? v.toFixed(3) : String(v), String(k)]} />
                      <Line data={[{ predicted: 0, observed: 0 }, { predicted: 1, observed: 1 }]} dataKey="observed" stroke="var(--text-3)" strokeDasharray="4 4" dot={false} isAnimationActive={false} legendType="none" />
                      <Scatter dataKey="observed" fill="var(--brand-fg)" name="Observed">
                        <ErrorBar dataKey="err" width={6} stroke="var(--brand-fg)" strokeOpacity={0.7} strokeWidth={1.5} direction="y" />
                      </Scatter>
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <p className="px-5 pb-4 text-[11px] text-fg-3">Dot size = number of predictions in the bin; bars = 95% intervals. Points on the dashed line mean the probabilities mean what they say.</p>
              </Card>
              <Card>
                <CardHeader title="Brier score by week" eyebrow="Lower is better" />
                <div className="h-[300px] p-3">
                  <ResponsiveContainer>
                    <LineChart data={BRIER_TREND} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
                      <CartesianGrid stroke="var(--grid)" vertical={false} />
                      <XAxis dataKey="week" tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0.53, 0.68]} tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="model" name="AIDICT" stroke="var(--brand-fg)" strokeWidth={2.2} dot={false} />
                      <Line type="monotone" dataKey="market" name="Closing odds" stroke="var(--info)" strokeWidth={1.6} dot={false} />
                      <Line type="monotone" dataKey="baseline" name="Base rate" stroke="var(--text-3)" strokeDasharray="4 4" strokeWidth={1.4} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
            <Card>
              <CardHeader title="By market" eyebrow="Markets publish only after passing validation gates" />
              <Table className="mt-2">
                <thead><tr><Th>Market</Th><Th align="right">n</Th><Th align="right">Hit rate</Th><Th align="right">Brier</Th><Th align="right">Log loss</Th><Th align="right">ECE</Th><Th>Status</Th></tr></thead>
                <tbody>
                  {BY_MARKET.map((r) => (
                    <tr key={r.market}>
                      <Td className="font-semibold text-fg">{r.market}</Td>
                      <Td align="right" className="num text-[14px]">{r.n ? r.n.toLocaleString() : '—'}</Td>
                      <Td align="right" className="num text-[14px]">{r.accuracy !== null ? fmt(r.accuracy, 1) : '—'}</Td>
                      <Td align="right" className="num text-[14px]">{r.brier?.toFixed(3) ?? '—'}</Td>
                      <Td align="right" className="num text-[14px]">{r.logLoss?.toFixed(3) ?? '—'}</Td>
                      <Td align="right" className={cx('num text-[14px]', r.ece !== null && r.ece > 0.04 && 'text-danger')}>{r.ece?.toFixed(3) ?? '—'}</Td>
                      <Td><StatusBadge status={r.status} /></Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
              <Card>
                <CardHeader title="By competition" eyebrow="1X2" />
                <Table className="mt-2">
                  <thead><tr><Th>Competition</Th><Th align="right">n</Th><Th align="right">Hit rate</Th><Th align="right">Brier</Th><Th align="right">ECE</Th><Th>Model</Th></tr></thead>
                  <tbody>
                    {BY_COMPETITION.map((r) => (
                      <tr key={r.comp.id}>
                        <Td className="font-semibold text-fg"><span className="flex items-center gap-2"><Flag code={r.comp.flag} />{r.comp.name}</span></Td>
                        <Td align="right" className="num text-[14px]">{r.n}</Td>
                        <Td align="right" className="num text-[14px]">{fmt(r.accuracy, 1)}</Td>
                        <Td align="right" className="num text-[14px]">{r.brier.toFixed(3)}</Td>
                        <Td align="right" className="num text-[14px]">{r.ece.toFixed(3)}</Td>
                        <Td><StatusBadge status={r.comp.modelStatus} /></Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                <p className="px-5 py-3 text-[11px] text-fg-3">Small samples (n &lt; 100) have wide uncertainty — differences between competitions under that size are not meaningful.</p>
              </Card>
              <Card className="p-5">
                <div className="eyebrow mb-3">By sport</div>
                <ul className="space-y-2">
                  {SPORTS.map((s) => (
                    <li key={s.id} className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2.5 text-[13px]">
                      <span className="font-semibold">{s.name}</span>
                      {s.status === 'active' ? <span className="num text-[15px] font-bold">{KPIS.settled.toLocaleString()}</span> : <span className="text-[12px] text-fg-3">No predictions yet</span>}
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <Notice tone="info" title={`Walk-forward backtest · ${BACKTEST.window}`}>
              Each matchweek is predicted using only data available before its first kick-off, then the models are refitted. n = {BACKTEST.n.toLocaleString()} matches. Backtests are kept separate from live tracking.
            </Notice>
            <Card>
              <Table>
                <thead><tr><Th>Model</Th><Th align="right">Brier</Th><Th align="right">Log loss</Th><Th align="right">RPS</Th><Th align="right">ECE</Th><Th>Verdict</Th></tr></thead>
                <tbody>
                  {BACKTEST.models.map((r) => (
                    <tr key={r.name} className={r.name === 'Dixon–Coles' ? 'bg-brand-soft/40' : ''}>
                      <Td className="font-semibold text-fg">{r.name}</Td>
                      <Td align="right" className="num text-[14px]">{r.brier.toFixed(3)}</Td>
                      <Td align="right" className="num text-[14px]">{r.logLoss.toFixed(3)}</Td>
                      <Td align="right" className="num text-[14px]">{r.rps.toFixed(3)}</Td>
                      <Td align="right" className="num text-[14px]">{r.ece.toFixed(3)}</Td>
                      <Td>
                        {r.name === 'Dixon–Coles' ? <Badge tone="brand">Production</Badge> : r.name.startsWith('Market') ? <Badge tone="info">Benchmark</Badge> : r.name === 'LightGBM' ? <Badge tone="warn">Worse calibration — not promoted</Badge> : r.name === 'Base rate' ? <Badge>Baseline</Badge> : <Badge tone="neutral">Challenger</Badge>}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          </div>
        )}
      </PageState>
    </>
  )
}

export { Tabs }
