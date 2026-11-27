import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, PageHeader } from '@/components/ui/primitives'

export const metadata: Metadata = { title: 'About' }

const SOURCES = [
  ['OpenFootball', 'Historical fixtures and results', 'CC0 / public domain'],
  ['football-data.co.uk', 'Historical match statistics and closing odds (benchmark only)', 'Free for non-commercial use'],
  ['football-data.org', 'Current fixtures, results and team crests', 'Free tier, attribution required'],
  ['OpenLigaDB', 'Bundesliga goal minutes (goal-order markets)', 'ODbL'],
]

export default function AboutPage() {
  return (
    <>
      <PageHeader eyebrow="AIDICT" title="About" description="Analyse the data. Calculate the probability. Explain the prediction. Track the results." />
      <div className="grid max-w-4xl gap-5">
        <Card className="space-y-3 p-6 text-[14px] leading-relaxed text-fg-2">
          <h2 className="text-[16px] font-bold text-fg">How it works</h2>
          <p>
            A Dixon–Coles goals model rates every team&apos;s attack and defence from three years of results, weighting recent matches more. It produces one score matrix per match; every market (result, totals, double chance, combinations, handicaps and, where goal minutes exist, goal-order markets) is summed from that matrix, so markets never contradict each other.
          </p>
          <p>
            Each outcome is tested in a walk-forward backtest: fitted on past seasons, judged on the next. An outcome is published only when it beats the base rate with statistical confidence, stays well calibrated after Platt scaling, has at least 1,000 test predictions, and passes two consecutive weekly runs. See <Link href="/performance" className="font-semibold text-brand-fg underline">Performance</Link> for the numbers.
          </p>
          <p>Predictions are stored as immutable snapshots before kick-off and settled against the official result. The full record, including misses, is in <Link href="/history" className="font-semibold text-brand-fg underline">Prediction history</Link>.</p>
        </Card>
        <Card className="p-6">
          <h2 className="mb-3 text-[16px] font-bold text-fg">Data sources and attribution</h2>
          <ul className="divide-y divide-line text-[13px]">
            {SOURCES.map(([name, use, licence]) => (
              <li key={name} className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:items-center sm:gap-4">
                <span className="w-44 font-bold text-fg">{name}</span>
                <span className="flex-1 text-fg-2">{use}</span>
                <span className="text-[12px] text-fg-3">{licence}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12px] text-fg-3">Football data provided by the Football-Data.org API. Team crests are shown as published by the data provider and remain the property of their owners.</p>
        </Card>
      </div>
    </>
  )
}
