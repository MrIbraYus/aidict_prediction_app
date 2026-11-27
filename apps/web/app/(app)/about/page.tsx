import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, PageHeader } from '@/components/ui/primitives'

export const metadata: Metadata = { title: 'About' }

export default function AboutPage() {
  return (
    <>
      <PageHeader eyebrow="AIDICT" title="About" description="Football predictions you can check." />
      <div className="grid max-w-3xl gap-5">
        <Card className="space-y-3 p-6 text-[14px] leading-relaxed text-fg-2">
          <h2 className="text-[16px] font-bold text-fg">What AIDICT does</h2>
          <p>AIDICT studies thousands of past matches and turns them into probabilities for upcoming games: who wins, how many goals, corners, and more. Each match gets up to five Smart Picks: the outcomes where the evidence is strongest.</p>
          <p>Only markets with a proven track record are offered as picks. The rest are shown for information.</p>
          <h2 className="pt-2 text-[16px] font-bold text-fg">An honest record</h2>
          <p>
            Every prediction is published before kick-off and never edited afterwards. After the final whistle it is marked won or lost, and the full record, including the misses, is in <Link href="/history" className="font-semibold text-brand-fg underline">Prediction history</Link>.
          </p>
          <h2 className="pt-2 text-[16px] font-bold text-fg">What it is not</h2>
          <p>
            AIDICT is not a betting service. It never takes bets or payments, and a probability is never a guarantee. Please read <Link href="/responsible" className="font-semibold text-brand-fg underline">Responsible use</Link>.
          </p>
        </Card>
        <p className="text-[12px] text-fg-3">Team crests are shown as published by their data provider and remain the property of their owners.</p>
      </div>
    </>
  )
}
