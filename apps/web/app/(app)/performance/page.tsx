import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getBacktestRuns, getGates, viewer } from '@/lib/data'
import { summarizeRun, type Metric } from '@/lib/runs'
import { cx, FLAG_BY_CODE, pct, relTime } from '@/lib/format'
import { Card, CardHeader, EmptyState, Notice, PageHeader, StatusBadge, Table, Td, Th } from '@/components/ui/primitives'
import { Flag } from '@/components/sports/identity'

export const metadata: Metadata = { title: 'Model performance' }
export const dynamic = 'force-dynamic'

export default async function PerformancePage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  if (!(await viewer()).admin) notFound()
  const sp = await searchParams
  const [runs, gates] = await Promise.all([getBacktestRuns(), getGates()])
  const summaries = runs.map(summarizeRun).filter((r) => r.model && r.base)
  const comps = [...new Set(gates.map((g) => g.competition))]
  const comp = sp.c && comps.includes(sp.c) ? sp.c : comps[0]
  const compGates = gates.filter((g) => g.competition === comp).sort((a, b) => (a.status === b.status ? a.market.localeCompare(b.market) : a.status === 'active' ? -1 : 1))
  return (
    <>
      <PageHeader eyebrow="Owner · model quality" title="Model performance" description="Out-of-sample results from walk-forward backtests: the model only ever predicts seasons it was not fitted on. Lower log loss, Brier and RPS are better; ECE measures calibration." />
      <Notice tone="neutral" className="mb-5" title="Read this first">
        Beating the base rate shows the model has real signal. Closing bookmaker odds are still more accurate, which is why AIDICT never claims an edge over the market or guarantees outcomes.
      </Notice>
      <Card className="mb-5">
        <CardHeader title="Full-time result (1X2) by competition" eyebrow="Walk-forward backtest" />
        {summaries.length === 0 ? (
          <EmptyState title="No backtests stored yet" body="The weekly gates job writes one backtest per competition." />
        ) : (
          <Table className="mt-2">
            <thead>
              <tr>
                <Th>Competition</Th>
                <Th>Method</Th>
                <Th align="right">n</Th>
                <Th align="right">Log loss</Th>
                <Th align="right">Brier</Th>
                <Th align="right">RPS</Th>
                <Th align="right">ECE</Th>
                <Th align="right">Accuracy</Th>
              </tr>
            </thead>
            <tbody>
              {summaries.flatMap((r) =>
                (
                  [
                    ['AIDICT (Dixon–Coles)', r.model],
                    ['Elo (ordered logit)', r.elo],
                    ['Base rate', r.base],
                    ['Closing odds', r.odds],
                  ] as [string, Metric | undefined][]
                )
                  .filter(([, m]) => m)
                  .map(([name, m], i) => (
                    <tr key={r.id + name} className={cx(i === 0 && 'bg-surface-2/50')}>
                      <Td className="font-semibold text-fg">
                        {i === 0 && (
                          <span className="inline-flex items-center gap-2">
                            <Flag code={FLAG_BY_CODE[r.competition] ?? 'eur'} /> {r.competition}
                            <span className="text-[11px] font-medium text-fg-3">
                              {r.testFrom}–{r.testTo} · {relTime(r.finishedAt)}
                            </span>
                          </span>
                        )}
                      </Td>
                      <Td className={cx(i === 0 && 'font-bold text-fg')}>{name}</Td>
                      <Td align="right" className="num">{m!.n.toLocaleString()}</Td>
                      <Td align="right" className={cx('num font-bold', i === 0 && (m!.log_loss < r.base!.log_loss ? 'text-success' : 'text-danger'))}>{m!.log_loss.toFixed(3)}</Td>
                      <Td align="right" className="num">{m!.brier.toFixed(3)}</Td>
                      <Td align="right" className="num">{m!.rps.toFixed(3)}</Td>
                      <Td align="right" className="num">{m!.ece.toFixed(3)}</Td>
                      <Td align="right" className="num">{pct(m!.accuracy, 1)}</Td>
                    </tr>
                  )),
              )}
            </tbody>
          </Table>
        )}
      </Card>
      <Card>
        <CardHeader title="Market gates" eyebrow="Per outcome · out-of-sample, Platt-calibrated" />
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 pt-3">
          {comps.map((c) => (
            <Link key={c} href={`/performance?c=${c}`} scroll={false} className={cx('inline-flex h-8 shrink-0 items-center gap-2 rounded-full border px-3 text-[12px] font-semibold', c === comp ? 'border-transparent bg-fg text-fg-inverse' : 'border-line bg-surface-1 text-fg-2 hover:text-fg')}>
              <Flag code={FLAG_BY_CODE[c] ?? 'eur'} /> {c}
            </Link>
          ))}
        </div>
        {compGates.length === 0 ? (
          <EmptyState title="No gates evaluated yet" />
        ) : (
          <Table className="mt-3">
            <thead>
              <tr>
                <Th>Outcome</Th>
                <Th>Status</Th>
                <Th align="right">n</Th>
                <Th align="right">Log loss</Th>
                <Th align="right">vs base</Th>
                <Th align="right">ECE</Th>
                <Th>Reason</Th>
              </tr>
            </thead>
            <tbody>
              {compGates.map((g) => (
                <tr key={g.market + g.outcome}>
                  <Td className="font-semibold text-fg">{g.label ?? `${g.market} · ${g.outcome}`}</Td>
                  <Td>
                    <StatusBadge status={g.status} />
                  </Td>
                  <Td align="right" className="num">{g.n.toLocaleString()}</Td>
                  <Td align="right" className="num">{g.logLoss?.toFixed(4) ?? '—'}</Td>
                  <Td align="right" className={cx('num font-bold', g.logLoss != null && g.baseLogLoss != null && (g.logLoss < g.baseLogLoss ? 'text-success' : 'text-danger'))}>
                    {g.logLoss != null && g.baseLogLoss != null ? (g.logLoss - g.baseLogLoss).toFixed(4) : '—'}
                  </Td>
                  <Td align="right" className="num">{g.ece?.toFixed(3) ?? '—'}</Td>
                  <Td className="max-w-[340px] text-[12px] text-fg-3">{g.reason}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  )
}
