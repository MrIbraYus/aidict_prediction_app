import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { cx } from '../lib/format'
import { CATEGORIES, MARKET_DEFS, categoryLabel, statusForCompetition, supportLevel } from '../lib/markets'
import { marketTrend } from '../mock/analytics'
import { COMPETITIONS } from '../mock/teams'
import { Badge, Card, CardHeader, Notice, Select, Table, Td, Th } from '../components/ui/primitives'
import { MarketStatusBadge } from '../components/markets'
import { Flag } from '../components/sports/identity'

const tooltipStyle = { background: 'var(--surface-2)', border: '1px solid var(--border-strong)', borderRadius: 12, fontSize: 12 }
const MIN_N = 1000

export default function MarketPerformance() {
  const [cat, setCat] = useState('all')
  const [comp, setComp] = useState('bl1')
  const [trendId, setTrendId] = useState('corners-ou')
  const defs = MARKET_DEFS.filter((d) => cat === 'all' || d.category === cat)
  const trend = marketTrend(trendId)
  const comps = COMPETITIONS.filter((c) => c.id !== 'wc')
  return (
    <div className="space-y-5">
      <Notice tone="info" title="Every market is evaluated on its own">
        Each market has its own walk-forward backtest (2016-17 → 2025-26), calibration and gate. A market is published only with ≥ {MIN_N.toLocaleString()} out-of-sample predictions, a log loss better than the base rate and calibration error within its gate. High accuracy on a small sample never counts as reliable.
      </Notice>
      <Card>
        <CardHeader title="Market-by-market evaluation" eyebrow="24 markets · walk-forward backtest" action={<Select className="w-52" value={cat} onChange={setCat} options={[{ value: 'all', label: 'All categories' }, ...CATEGORIES.map((c) => ({ value: c.id, label: c.label }))]} />} />
        <Table className="mt-3">
          <thead>
            <tr>
              <Th>Market</Th>
              <Th align="right">Out-of-sample n</Th>
              <Th align="right">Brier</Th>
              <Th align="right">Log loss</Th>
              <Th align="right">ECE</Th>
              <Th>Gate</Th>
              <Th>Data with planned providers</Th>
            </tr>
          </thead>
          <tbody>
            {defs.map((d) => {
              const s = supportLevel(d)
              const small = d.backtest.n > 0 && d.backtest.n < MIN_N
              return (
                <tr key={d.id}>
                  <Td className="font-semibold text-fg">
                    {d.name}
                    <div className="text-[11px] font-medium text-fg-3">{categoryLabel(d.category)}</div>
                  </Td>
                  <Td align="right" className={cx('num text-[14px]', small && 'text-warn')}>
                    {d.backtest.n ? d.backtest.n.toLocaleString() : '—'}
                    {small && <div className="font-sans text-[10.5px] font-bold">sample too small</div>}
                  </Td>
                  <Td align="right" className="num text-[14px]">{d.backtest.n ? d.backtest.brier.toFixed(3) : '—'}</Td>
                  <Td align="right" className="num text-[14px]">{d.backtest.n ? d.backtest.logLoss.toFixed(3) : '—'}</Td>
                  <Td align="right" className={cx('num text-[14px]', d.backtest.ece > 0.03 && 'text-danger')}>{d.backtest.n ? d.backtest.ece.toFixed(3) : '—'}</Td>
                  <Td><MarketStatusBadge status={d.gate} /></Td>
                  <Td>
                    <Badge tone={s.level === 'supported' ? 'success' : s.level === 'partial' ? 'warn' : 'danger'}>{s.level === 'supported' ? 'Supported' : s.level === 'partial' ? 'Partial' : 'Needs data'}</Badge>
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </Table>
        <p className="px-5 py-3 text-[11px] text-fg-3">Brier and log loss are for the market's main line or outcome set. Sample figures for the prototype.</p>
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Comparison across competitions" eyebrow="Status of every market per competition" action={<Select className="w-52" value={comp} onChange={setComp} options={comps.map((c) => ({ value: c.id, label: c.name }))} />} />
          <ul className="mt-3 divide-y divide-line">
            {MARKET_DEFS.map((d) => {
              const st = statusForCompetition(d, comp)
              return (
                <li key={d.id} className="flex items-center gap-3 px-5 py-2.5 text-[12.5px]">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-fg">{d.name}</span>
                    {st.reason && st.status !== 'active' && <span className="block truncate text-[11.5px] text-fg-3">{st.reason}</span>}
                  </span>
                  <MarketStatusBadge status={st.status} />
                </li>
              )
            })}
          </ul>
        </Card>
        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Market over time"
              eyebrow="Live tracking · predicted vs observed, weekly"
              action={<Select className="w-56" value={trendId} onChange={setTrendId} options={MARKET_DEFS.filter((d) => d.gate === 'active').map((d) => ({ value: d.id, label: d.name }))} />}
            />
            <div className="h-[260px] p-3">
              <ResponsiveContainer>
                <LineChart data={trend} margin={{ top: 10, right: 14, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke="var(--grid)" vertical={false} />
                  <XAxis dataKey="week" tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[30, 100]} unit="%" tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v, k) => [`${v}%`, k === 'predicted' ? 'Mean predicted' : 'Observed hit rate']} />
                  <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => (v === 'predicted' ? 'Mean predicted probability' : 'Observed hit rate')} />
                  <Line type="monotone" dataKey="predicted" stroke="var(--text-3)" strokeDasharray="4 4" strokeWidth={1.6} dot={false} />
                  <Line type="monotone" dataKey="observed" stroke="var(--brand-fg)" strokeWidth={2.2} dot={{ r: 2.5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="px-5 pb-4 text-[11px] text-fg-3">Weekly samples are small ({Math.min(...trend.map((t) => t.n))}–{Math.max(...trend.map((t) => t.n))} picks), so weekly swings are expected. Calibration is judged on the cumulative sample.</p>
          </Card>
          <Card className="p-5">
            <div className="eyebrow mb-3">Data depth by competition</div>
            <ul className="space-y-2 text-[12.5px]">
              {comps.slice(0, 8).map((c) => (
                <li key={c.id} className="flex items-center gap-2">
                  <Flag code={c.flag} />
                  <span className="w-36 truncate font-semibold">{c.name}</span>
                  <span className="flex flex-wrap gap-1">
                    <Badge tone="success">Scores</Badge>
                    {['bl1', 'pl'].includes(c.id) ? <Badge tone="success">Goal times</Badge> : <Badge>No goal times</Badge>}
                    {['pl', 'pd', 'bl1', 'sa', 'fl1', 'ded', 'elc', 'ppl'].includes(c.id) ? <Badge tone="success">Corners</Badge> : <Badge>No corners</Badge>}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 flex items-start gap-1.5 text-[11.5px] text-fg-3"><AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warn" /> Goal-time depth decides which competitions can use first-goal, consecutive-goal and 1UP-type markets.</p>
          </Card>
        </div>
      </div>
    </div>
  )
}
