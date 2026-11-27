import Link from 'next/link'
import { ChevronLeft, ChevronRight, Home, Plane, ShieldAlert } from 'lucide-react'
import { cx, dayKey, fmtDate, fmtDay, fmtTime, FLAG_BY_CODE, pct } from '@/lib/format'
import type { FixtureVM, PickVM, X12 } from '@/lib/types'
import { Crest, Flag } from './identity'
import { Badge } from '../ui/primitives'
import { SaveButton } from './save-button'

const LIVE = new Set(['LIVE', 'HT'])
const DONE = new Set(['FT', 'AET', 'PEN', 'AWARDED'])

/* ───────────── Probability bar (H / D / A) ───────────── */
export function ProbBar({ p, labels = true, height = 8, className }: { p: X12; labels?: boolean; height?: number; className?: string }) {
  const max = Math.max(p.home, p.draw, p.away)
  return (
    <div className={className}>
      <div className="flex w-full gap-[3px] overflow-hidden rounded-full" style={{ height }}>
        <div style={{ width: `${p.home * 100}%`, background: 'var(--home)' }} className="rounded-l-full" />
        <div style={{ width: `${p.draw * 100}%`, background: 'var(--neutral)', opacity: 0.7 }} />
        <div style={{ width: `${p.away * 100}%`, background: 'var(--away)' }} className="rounded-r-full" />
      </div>
      {labels && (
        <div className="mt-1.5 flex justify-between text-[12px] font-semibold">
          <span className={cx('num text-[14px]', p.home === max ? 'text-home' : 'text-fg-3')}>{pct(p.home)}</span>
          <span className={cx('num text-[14px]', p.draw === max ? 'text-fg' : 'text-fg-3')}>{pct(p.draw)}</span>
          <span className={cx('num text-[14px]', p.away === max ? 'text-away' : 'text-fg-3')}>{pct(p.away)}</span>
        </div>
      )}
    </div>
  )
}

/* ───────────── Compact H/D/A triple ───────────── */
export function ProbTriple({ p }: { p: X12 | null }) {
  if (!p)
    return (
      <div className="flex w-[142px] items-center justify-center text-[11px] font-semibold text-fg-3" title="No published prediction for this match yet">
        No prediction yet
      </div>
    )
  const max = Math.max(p.home, p.draw, p.away)
  const cell = (v: number, k: string, color: string) => (
    <div className={cx('flex w-[46px] flex-col items-center rounded-lg py-1', v === max ? 'bg-surface-3' : '')}>
      <span className="text-[9px] font-bold tracking-wider text-fg-3">{k}</span>
      <span className="num text-[14px] font-bold" style={{ color: v === max ? color : 'var(--text-2)' }}>
        {pct(v)}
      </span>
    </div>
  )
  return (
    <div className="flex items-center gap-0.5" aria-label="Model probabilities home draw away">
      {cell(p.home, '1', 'var(--home)')}
      {cell(p.draw, 'X', 'var(--text)')}
      {cell(p.away, '2', 'var(--away)')}
    </div>
  )
}

/* ───────────── Status chip ───────────── */
export function StatusChip({ f, tz }: { f: FixtureVM; tz: string }) {
  if (f.status === 'LIVE')
    return (
      <span className="num flex items-center gap-1 text-[14px] font-bold text-live">
        <span className="animate-pulse-dot size-1.5 rounded-full bg-live" />
        LIVE
      </span>
    )
  if (f.status === 'HT') return <span className="num text-[14px] font-bold text-live">HT</span>
  if (DONE.has(f.status)) return <span className="num text-[14px] font-bold text-fg-3">{f.status === 'AWARDED' ? 'AWD' : f.status}</span>
  if (f.status === 'POSTPONED') return <span className="text-[11px] font-bold text-warn">PPD</span>
  if (f.status === 'CANCELLED') return <span className="text-[11px] font-bold text-fg-3">CANC</span>
  return <span className="num text-[15px] font-semibold text-fg-2">{fmtTime(f.kickoff, tz)}</span>
}

export function ConfidenceBadge({ c }: { c: PickVM['confidence'] }) {
  return <Badge tone={c === 'High' ? 'live' : c === 'Medium' ? 'gold' : 'neutral'}>{c}</Badge>
}

/* ───────────── Match row ───────────── */
export function MatchRow({ f, tz, showComp, saved, signedIn = true }: { f: FixtureVM; tz: string; showComp?: boolean; saved?: boolean; signedIn?: boolean }) {
  const live = LIVE.has(f.status)
  const done = DONE.has(f.status)
  const top = f.picks?.[0]
  const completeness = Number((f.snapshot?.inputs as { completeness?: number } | undefined)?.completeness ?? 1)
  return (
    <div className={cx('group relative flex items-stretch overflow-hidden rounded-2xl border bg-surface-2/60 transition-colors hover:bg-surface-2', live ? 'border-live/25' : 'border-line')}>
      {live && <span className="absolute inset-y-0 left-0 w-[3px] bg-live shadow-[0_0_12px_var(--live)]" aria-hidden />}
      <Link href={`/match/${f.id}`} className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-3 pr-2 sm:gap-4 sm:pl-4" aria-label={`${f.home.name} vs ${f.away.name}`}>
        <div className="flex w-12 shrink-0 flex-col items-center justify-center border-r border-line pr-3 sm:w-14">
          <StatusChip f={f} tz={tz} />
          {showComp && <span className="mt-0.5 text-[10px] font-bold text-fg-3">{f.competition.code}</span>}
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          {[f.home, f.away].map((t, i) => (
            <div key={t.id} className="flex items-center gap-2.5">
              <Crest team={t} size={20} />
              <span className={cx('truncate text-[14px]', done && f.score && f.score[i] < f.score[1 - i] ? 'font-medium text-fg-3' : 'font-semibold text-fg')}>{t.short || t.name}</span>
              <span className={cx('num ml-auto pr-1 text-[16px] font-bold', live ? 'text-fg' : 'text-fg-2')}>{f.score ? f.score[i] : ''}</span>
            </div>
          ))}
        </div>
      </Link>
      <div className="hidden items-center gap-3 border-l border-line px-3 md:flex">
        <ProbTriple p={f.snapshot?.x12 ?? null} />
        <div className="hidden w-[170px] xl:block">
          {f.snapshot ? (
            <>
              <div className="truncate text-[12px] font-semibold text-fg-2" title={top ? top.label : (f.snapshot.selection?.shortfall ?? '')}>
                {top ? top.label : 'No pick for this match'}
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                {top ? <ConfidenceBadge c={top.confidence} /> : <Badge>No pick</Badge>}
                {(f.picks?.length ?? 0) > 1 && <span className="text-[11px] font-semibold text-fg-3">+{(f.picks?.length ?? 1) - 1} more</span>}
                {completeness < 0.9 && (
                  <span title={`Data completeness ${(completeness * 100).toFixed(0)}%`}>
                    <ShieldAlert className="size-3.5 text-warn" />
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className="text-[12px] font-semibold text-fg-3">{done ? 'Not predicted' : 'Preview 7 days before kick-off'}</div>
          )}
        </div>
      </div>
      {signedIn && <SaveButton fixtureId={f.id} saved={!!saved} />}
    </div>
  )
}

/* ───────────── Competition group header ───────────── */
export function CompHeader({ f, right }: { f: FixtureVM; right?: React.ReactNode }) {
  const c = f.competition
  return (
    <div className="mb-2 mt-1 flex items-center gap-2.5 px-1">
      <Flag code={FLAG_BY_CODE[c.code] ?? 'eur'} />
      <Link href={`/competitions/${c.code}`} className="text-[14px] font-bold text-fg hover:text-brand-fg">
        {c.name}
      </Link>
      {f.round && <span className="text-[12px] font-medium text-fg-3">{f.round}</span>}
      <div className="ml-auto">{right ?? <ChevronRight className="size-4 text-fg-3" />}</div>
    </div>
  )
}

/* ───────────── Hero match card ───────────── */
export function MatchHero({ f, tz, compact, linkTo }: { f: FixtureVM; tz: string; compact?: boolean; linkTo?: boolean }) {
  const live = LIVE.has(f.status)
  const top = f.picks?.[0]
  const x12 = f.snapshot?.x12
  const body = (
    <div className={cx('hero-stage card overflow-hidden', compact ? 'p-5' : 'p-5 sm:p-7')}>
      <div className="flex items-center justify-between text-[12px] font-semibold text-fg-3">
        <span className="flex items-center gap-1.5">
          <Flag code={FLAG_BY_CODE[f.competition.code] ?? 'eur'} /> {f.competition.name}
        </span>
        <span className="hidden sm:inline">{f.round ?? f.season}</span>
      </div>
      <div className="mt-1 text-center">
        {f.venue && <div className="text-[15px] font-bold text-fg sm:text-[17px]">{f.venue}</div>}
        <div className="text-[12px] text-fg-3">
          {fmtDay(f.kickoff, tz)} {fmtDate(f.kickoff, tz)} · {fmtTime(f.kickoff, tz)} <span className="text-fg-3/80">({tz.replace('_', ' ')})</span>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-6">
        {[f.home, f.away].map((t, i) => (
          <div key={t.id} className={cx('flex flex-col items-center text-center', i === 1 && 'order-3')}>
            <Crest team={t} size={compact ? 52 : 68} />
            <div className="mt-3 text-[14px] font-bold text-fg sm:text-[16px]">{t.name}</div>
            <div className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-fg-3">
              {i === 0 ? <Home className="size-3" /> : <Plane className="size-3" />} {i === 0 ? 'Home' : 'Away'}
            </div>
          </div>
        ))}
        <div className="order-2 flex flex-col items-center">
          {f.score ? (
            <div className="num text-[44px] font-bold leading-none text-fg sm:text-[56px]">
              {f.score[0]}
              <span className="px-1 text-fg-3">:</span>
              {f.score[1]}
            </div>
          ) : (
            <div className="num text-[40px] font-bold leading-none text-fg sm:text-[52px]">{fmtTime(f.kickoff, tz)}</div>
          )}
          <div className="mt-2">
            {live ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-live-soft px-2.5 py-0.5 text-[12px] font-bold text-live">
                <span className="animate-pulse-dot size-1.5 rounded-full bg-live" /> {f.status === 'HT' ? 'Half-time' : 'Live'}
              </span>
            ) : DONE.has(f.status) ? (
              <Badge>Full time{f.ht ? ` · HT ${f.ht[0]}–${f.ht[1]}` : ''}</Badge>
            ) : f.status === 'POSTPONED' ? (
              <Badge tone="warn">Postponed</Badge>
            ) : (
              <Badge tone="brand">Kick-off</Badge>
            )}
          </div>
        </div>
      </div>
      <div className="mx-auto mt-6 max-w-xl">
        {x12 ? (
          <>
            <div className="mb-2 flex justify-between text-[11px] font-bold tracking-wider text-fg-3">
              <span>HOME</span>
              <span>DRAW</span>
              <span>AWAY</span>
            </div>
            <ProbBar p={x12} height={10} />
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[12px]">
              {top ? (
                <>
                  <ConfidenceBadge c={top.confidence} />
                  <span className="font-semibold text-fg-2">
                    {top.label} · {pct(top.p)}
                  </span>
                </>
              ) : (
                <>
                  <Badge>No pick</Badge>
                  <span className="font-semibold text-fg-2">{f.snapshot?.selection?.shortfall ?? 'No outcome was strong enough to publish as a pick.'}</span>
                </>
              )}
              {f.snapshot?.modelVersion ? <span className="text-fg-3">· model {f.snapshot.modelVersion}</span> : null}
            </div>
          </>
        ) : (
          <p className="text-center text-[12px] font-semibold text-fg-3">
            {DONE.has(f.status) ? 'No prediction was published for this match.' : 'A preview is published up to 7 days before kick-off and refreshed the day before, once the data checks pass.'}
          </p>
        )}
      </div>
    </div>
  )
  return linkTo ? (
    <Link href={`/match/${f.id}`} className="block transition-transform duration-200 hover:-translate-y-0.5">
      {body}
    </Link>
  ) : (
    body
  )
}

/* ───────────── Date strip (links; the URL holds the selected day) ───────────── */
export function DateStrip({ days, value, today, tz, hrefFor, liveCount }: { days: string[]; value: string; today: string; tz: string; hrefFor: (d: string) => string; liveCount?: number }) {
  const idx = days.indexOf(value)
  const label = (d: string) => fmtDay(d + 'T12:00:00Z', 'UTC')
  return (
    <div className="flex items-center gap-2">
      {liveCount ? (
        <Link href="/matches?live=1" className="flex h-12 shrink-0 items-center gap-2 rounded-2xl border border-live/30 bg-live-soft px-3" aria-label={`${liveCount} live matches`}>
          <span className="rounded-md bg-live px-1.5 py-[1px] text-[10px] font-extrabold tracking-wider text-[#04140a]">LIVE</span>
          <span className="num text-[15px] font-bold text-live">{liveCount}</span>
        </Link>
      ) : null}
      <div className="card flex min-w-0 flex-1 items-center rounded-2xl p-1">
        <Link aria-label="Previous day" href={hrefFor(days[Math.max(0, idx - 1)])} className={cx('flex size-10 shrink-0 items-center justify-center rounded-xl text-fg-3 hover:text-fg', idx <= 0 && 'pointer-events-none opacity-30')}>
          <ChevronLeft className="size-4" />
        </Link>
        <div className="no-scrollbar flex min-w-0 flex-1 overflow-x-auto">
          {days.map((d) => {
            const on = d === value
            return (
              <Link key={d} href={hrefFor(d)} scroll={false} className={cx('relative flex min-w-[76px] flex-1 flex-col items-center rounded-xl py-1.5 transition-colors', on ? 'bg-surface-3' : 'hover:bg-surface-2')} aria-current={on ? 'date' : undefined}>
                <span className={cx('text-[12px] font-semibold', on ? 'text-fg' : 'text-fg-3')}>{d === today ? 'Today' : label(d)}</span>
                <span className={cx('text-[13px] font-bold', on ? 'text-fg' : 'text-fg-2')}>{fmtDate(d + 'T12:00:00Z', 'UTC')}</span>
                {on && <span className="glow-bar" aria-hidden />}
              </Link>
            )
          })}
        </div>
        <Link aria-label="Next day" href={hrefFor(days[Math.min(days.length - 1, idx + 1)])} className={cx('flex size-10 shrink-0 items-center justify-center rounded-xl text-fg-3 hover:text-fg', idx >= days.length - 1 && 'pointer-events-none opacity-30')}>
          <ChevronRight className="size-4" />
        </Link>
      </div>
      <span className="sr-only">Times shown in {tz}</span>
    </div>
  )
}

/** Days around today in the viewer's time zone, as YYYY-MM-DD. */
export function dayRange(tz: string, before: number, after: number): { today: string; days: string[] } {
  const today = dayKey(new Date().toISOString(), tz)
  const base = new Date(today + 'T12:00:00Z').getTime()
  const days = []
  for (let i = -before; i <= after; i++) days.push(new Date(base + i * 86400000).toISOString().slice(0, 10))
  return { today, days }
}

/* ───────────── Score matrix heatmap ───────────── */
export function ScoreMatrix({ matrix, max = 5 }: { matrix: number[][]; max?: number }) {
  const peak = Math.max(...matrix.slice(0, max + 1).flatMap((r) => r.slice(0, max + 1)), 1e-9)
  return (
    <div className="scroll-x">
      <table className="mx-auto border-separate border-spacing-1 text-center" aria-label="Correct score probability matrix">
        <thead>
          <tr>
            <th className="text-[10px] font-bold text-fg-3">
              <span className="text-home">H</span>\<span className="text-away">A</span>
            </th>
            {Array.from({ length: max + 1 }).map((_, a) => (
              <th key={a} className="num w-12 text-[13px] font-bold text-away">
                {a}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: max + 1 }).map((_, h) => (
            <tr key={h}>
              <th className="num pr-1 text-[13px] font-bold text-home">{h}</th>
              {Array.from({ length: max + 1 }).map((_, a) => {
                const p = matrix[h]?.[a] ?? 0
                const t = p / peak
                return (
                  <td
                    key={a}
                    className="num h-10 w-12 rounded-lg text-[12px] font-bold"
                    style={{ background: `color-mix(in srgb, var(--brand) ${Math.round(t * 85)}%, var(--surface-2))`, color: t > 0.45 ? '#fff' : 'var(--text-2)' }}
                    title={`${h}–${a}: ${pct(p, 1)}`}
                  >
                    {(p * 100).toFixed(1)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-center text-[11px] text-fg-3">Values in %. Rows = home goals, columns = away goals.</p>
    </div>
  )
}

/* ───────────── Stat comparison bar ───────────── */
export function StatCompare({ label, home, away, digits = 0, lowerIsBetter, unavailable }: { label: string; home: number; away: number; digits?: number; lowerIsBetter?: boolean; unavailable?: string }) {
  if (unavailable)
    return (
      <div className="py-2.5">
        <div className="mb-1.5 text-center text-[12px] font-semibold text-fg-3">{label}</div>
        <div className="rounded-lg border border-dashed border-line-strong py-1.5 text-center text-[11px] font-semibold text-fg-3">{unavailable}</div>
      </div>
    )
  const total = home + away || 1
  const homeBetter = lowerIsBetter ? home < away : home > away
  return (
    <div className="py-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className={cx('num text-[15px] font-bold', homeBetter ? 'text-fg' : 'text-fg-3')}>{home.toFixed(digits)}</span>
        <span className="text-[12px] font-semibold text-fg-3">{label}</span>
        <span className={cx('num text-[15px] font-bold', !homeBetter && home !== away ? 'text-fg' : 'text-fg-3')}>{away.toFixed(digits)}</span>
      </div>
      <div className="flex h-1.5 gap-1">
        <div className="flex flex-1 justify-end overflow-hidden rounded-full bg-surface-3">
          <div className="h-full rounded-full" style={{ width: `${(home / total) * 100}%`, background: 'var(--home)', opacity: homeBetter ? 1 : 0.45 }} />
        </div>
        <div className="flex-1 overflow-hidden rounded-full bg-surface-3">
          <div className="h-full rounded-full" style={{ width: `${(away / total) * 100}%`, background: 'var(--away)', opacity: !homeBetter ? 1 : 0.45 }} />
        </div>
      </div>
    </div>
  )
}

export function MarketStatusDot({ status }: { status: string }) {
  const c = status === 'active' ? 'bg-live' : status === 'validating' ? 'bg-warn' : 'bg-fg-3'
  return <span className={cx('inline-block size-1.5 rounded-full', c)} aria-label={status} />
}

export const isLive = (f: FixtureVM) => LIVE.has(f.status)
export const isDone = (f: FixtureVM) => DONE.has(f.status)

export function groupByCompetition(list: FixtureVM[]) {
  const g = new Map<string, FixtureVM[]>()
  for (const f of list) g.set(f.competition.code, [...(g.get(f.competition.code) ?? []), f])
  return [...g.values()]
}
