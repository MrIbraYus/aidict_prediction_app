/* eslint-disable @typescript-eslint/no-explicit-any */
export type Metric = { n: number; log_loss: number; brier: number; rps: number; ece: number; accuracy: number }
export type RunSummary = { id: string; competition: string; n: number; finishedAt: string; testFrom?: string; testTo?: string; model?: Metric; elo?: Metric; base?: Metric; odds?: Metric; modelOnOdds?: Metric }

/** Reads a backtest_runs row written by the gates job (metrics.x12 keyed by method name). */
export function summarizeRun(r: any): RunSummary {
  const x = r.metrics?.x12 ?? {}
  return {
    id: r.id, competition: r.config?.competition ?? '?', n: r.metrics?.n ?? 0, finishedAt: r.finished_at, testFrom: r.split?.test_from, testTo: r.split?.test_to,
    model: x['Dixon–Coles'], elo: x['Elo (ordered logit)'], base: x['Base rate'], odds: x['Closing odds (margin removed)'], modelOnOdds: x['Dixon–Coles (same matches as odds)'],
  }
}
