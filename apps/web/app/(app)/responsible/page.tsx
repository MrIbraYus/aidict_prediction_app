import type { Metadata } from 'next'
import { HeartHandshake } from 'lucide-react'
import { Card, Notice, PageHeader } from '@/components/ui/primitives'

export const metadata: Metadata = { title: 'Responsible use' }

export default function ResponsiblePage() {
  return (
    <>
      <PageHeader eyebrow="Please read" title="Responsible use" />
      <div className="grid max-w-3xl gap-5">
        <Notice tone="warn" icon={<HeartHandshake className="size-4" />} title="AIDICT is an analysis tool, not a betting service.">
          It never places bets, takes payments or links to bookmakers. A probability is not a promise: a 70% outcome still fails roughly three times in ten.
        </Notice>
        <Card className="space-y-4 p-6 text-[14px] leading-relaxed text-fg-2">
          <h2 className="text-[16px] font-bold text-fg">What the numbers mean</h2>
          <p>Every probability comes from a statistical model fitted on past results and checked on seasons it never saw. Calibrated means that, across many predictions, outcomes given 60% happen about 60% of the time. It says nothing certain about a single match.</p>
          <p>Closing bookmaker odds are, on average, more accurate than AIDICT&apos;s model. The app does not claim to beat the market.</p>
          <h2 className="pt-2 text-[16px] font-bold text-fg">If you gamble</h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Only stake money you can afford to lose, and set a limit before you start.</li>
            <li>Never chase losses, and never treat gambling as income.</li>
            <li>Take breaks. If it stops being fun, stop.</li>
          </ul>
          <h2 className="pt-2 text-[16px] font-bold text-fg">Free, confidential help</h2>
          <ul className="space-y-1.5">
            <li>
              UK: <a className="font-semibold text-brand-fg underline" href="https://www.gamcare.org.uk" target="_blank" rel="noreferrer">GamCare</a> · National Gambling Helpline 0808 8020 133
            </li>
            <li>
              International: <a className="font-semibold text-brand-fg underline" href="https://www.gamblingtherapy.org" target="_blank" rel="noreferrer">Gambling Therapy</a>
            </li>
            <li>
              Self-exclusion (UK): <a className="font-semibold text-brand-fg underline" href="https://www.gamstop.co.uk" target="_blank" rel="noreferrer">GAMSTOP</a>
            </li>
          </ul>
          <p className="text-[12px] text-fg-3">You must be of legal age in your country to gamble. AIDICT is for analysis and education.</p>
        </Card>
      </div>
    </>
  )
}
