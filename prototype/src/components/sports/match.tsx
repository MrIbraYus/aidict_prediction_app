import { ChevronLeft, ChevronRight, CalendarDays, Star, Home, Plane, Layers, ShieldAlert } from 'lucide-react'
import { Link, navigate } from '../../lib/router'
import { cx, fmtDate, fmtDay, fmtTime, useProb } from '../../lib/format'
import { useApp } from '../../lib/store'
import { getPrediction, type Match, type Prediction } from '../../mock/matches'
import { compById, teamById } from '../../mock/teams'
import { Crest, Flag } from './identity'
import { Badge, LivePill } from '../ui/primitives'

/* ───────────── Probability bar (H / D / A) ───────────── */
export function ProbBar({ p, labels = true, height = 8, className }: { p: { home: number; draw: number; away: number }; labels?: boolean; height?: number; className?: string }) {
  const fmt = useProb()
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
          <span className={cx('num text-[14px]', p.home === max ? 'text-home' : 'text-fg-3')}>{fmt(p.home)}</span>
          <span className={cx('num text-[14px]', p.draw === max ? 'text-fg' : 'text-fg-3')}>{fmt(p.draw)}</span>
          <span className={cx('num text-[14px]', p.away === max ? 'text-away' : 'text-fg-3')}>{fmt(p.away)}</span>
        </div>
      )}
    </div>
  )
}

/* ───────────── Compact H/D/A triple ───────────── */
export function ProbTriple({ p }: { p: { home: number; draw: number; away: number } }) {
  const fmt = useProb()
  const max = Math.max(p.home, p.draw, p.away)
  const cell = (v: number, k: string, color: string) => (
    <div className={cx('flex w-[46px] flex-col items-center rounded-lg py-1', v === max ? 'bg-surface-3' : '')}>
      <span className="text-[9px] font-bold tracking-wider text-fg-3">{k}</span>
      <span className="num text-[14px] font-bold" style={{ color: v === max ? color : 'var(--text-2)' }}>
        {fmt(v)}
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

/* ───────────── Status chip (left edge of rows, like reference) ───────────── */
export function StatusChip({ match }: { match: Match }) {
  if (match.status === 'LIVE')
    return (
      <span className="num flex items-center gap-1 text-[15px] font-bold text-live">
        <span className="animate-pulse-dot size-1.5 rounded-full bg-live" />
        {match.minute}′
      </span>
    )
  if (match.status === 'HT') return <span className="num text-[14px] font-bold text-live">HT</span>
  if (match.status === 'FT') return <span className="num text-[14px] font-bold text-fg-3">FT</span>
  return <span className="num text-[15px] font-semibold text-fg-2">{fmtTime(match.kickoff)}</span>
}

export function RecBadge({ pred }: { pred: Prediction }) {
  if (pred.recommendation === 'pick') return <Badge tone="live">Pick</Badge>
  if (pred.recommendation === 'lean') return <Badge tone="gold">Lean</Badge>
  return <Badge tone="neutral">Skip</Badge>
}

/* ───────────── Match row ───────────── */
export function MatchRow({ match, showComp, dense }: { match: Match; showComp?: boolean; dense?: boolean }) {
  const home = teamById(match.homeId)
  const away = teamById(match.awayId)
  const pred = getPrediction(match)
  const saved = useApp((s) => s.saved.includes(match.id))
  const toggleSaved = useApp((s) => s.toggleSaved)
  const comp = compById(match.compId)
  const live = match.status === 'LIVE' || match.status === 'HT'
  const done = match.status === 'FT'
  return (
    <div
      className={cx(
        'group relative flex items-stretch overflow-hidden rounded-2xl border bg-surface-2/60 transition-colors hover:bg-surface-2',
        live ? 'border-live/25' : 'border-line',
      )}
    >
      {live && <span className="absolute inset-y-0 left-0 w-[3px] bg-live shadow-[0_0_12px_var(--live)]" aria-hidden />}
      <Link to={`/match/${match.id}`} className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-3 pr-2 sm:gap-4 sm:pl-4" aria-label={`${home.name} vs ${away.name}`}>
        <div className="flex w-12 shrink-0 flex-col items-center justify-center border-r border-line pr-3 sm:w-14">
          <StatusChip match={match} />
          {showComp && <span className="mt-0.5 text-[10px] font-bold text-fg-3">{comp.code}</span>}
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          {[home, away].map((t, i) => (
            <div key={t.id} className="flex items-center gap-2.5">
              <Crest team={t} size={dense ? 18 : 20} />
              <span className={cx('truncate text-[14px]', done && match.score && match.score[i] < match.score[1 - i] ? 'font-medium text-fg-3' : 'font-semibold text-fg')}>{t.name}</span>
              <span className={cx('num ml-auto pr-1 text-[16px] font-bold', live ? 'text-fg' : 'text-fg-2')}>{match.score ? match.score[i] : ''}</span>
            </div>
          ))}
        </div>
      </Link>
      <div className="hidden items-center gap-3 border-l border-line px-3 md:flex">
        <ProbTriple p={pred.x12} />
        <div className="hidden w-[150px] xl:block">
          <div className="truncate text-[12px] font-semibold text-fg-2">{pred.recommendation === 'skip' ? 'No published pick' : pred.pick.label}</div>
          <div className="mt-1 flex items-center gap-1.5">
            <RecBadge pred={pred} />
            {match.completeness < 0.9 && (
              <span title={`Data completeness ${(match.completeness * 100).toFixed(0)}%`}>
                <ShieldAlert className="size-3.5 text-warn" />
              </span>
            )}
          </div>
        </div>
      </div>
      <button
        onClick={() => toggleSaved(match.id)}
        aria-label={saved ? 'Remove from saved' : 'Save match'}
        aria-pressed={saved}
        className="flex w-12 shrink-0 items-center justify-center border-l border-line text-fg-3 transition-colors hover:text-gold"
      >
        <Star className={cx('size-[18px]', saved && 'fill-gold text-gold')} />
      </button>
    </div>
  )
}

/* ───────────── Competition group header ───────────── */
export function CompHeader({ compId, right }: { compId: string; right?: React.ReactNode }) {
  const c = compById(compId)
  return (
    <div className="mb-2 mt-1 flex items-center gap-2.5 px-1">
      <Flag code={c.flag} />
      <Link to={`/competitions/${c.id}`} className="text-[14px] font-bold text-fg hover:text-brand-fg">
        {c.name}
      </Link>
      <span className="text-[12px] font-medium text-fg-3">{c.round}</span>
      {c.modelStatus !== 'active' && <Badge tone={c.modelStatus === 'validating' ? 'warn' : 'neutral'}>{c.modelStatus === 'validating' ? 'Model validating' : 'No model'}</Badge>}
      <div className="ml-auto">{right ?? <ChevronRight className="size-4 text-fg-3" />}</div>
    </div>
  )
}

/* ───────────── Hero match card (reference: centre screen) ───────────── */
export function MatchHero({ match, compact, linkTo }: { match: Match; compact?: boolean; linkTo?: boolean }) {
  const home = teamById(match.homeId)
  const away = teamById(match.awayId)
  const comp = compById(match.compId)
  const pred = getPrediction(match)
  const live = match.status === 'LIVE' || match.status === 'HT'
  const fmt = useProb()
  const body = (
    <div className={cx('hero-stage card overflow-hidden', compact ? 'p-5' : 'p-5 sm:p-7')}>
      <div className="flex items-center justify-between text-[12px] font-semibold text-fg-3">
        <span className="flex items-center gap-1.5">
          <Flag code={comp.flag} /> {comp.name}
        </span>
        <span className="hidden sm:inline">{comp.round}</span>
      </div>
      <div className="mt-1 text-center">
        <div className="text-[15px] font-bold text-fg sm:text-[17px]">{home.venue}</div>
        <div className="text-[12px] text-fg-3">{fmtDay(match.kickoff)} {fmtDate(match.kickoff)} · {fmtTime(match.kickoff)} UTC</div>
      </div>
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-6">
        <div className="flex flex-col items-center text-center">
          <Crest team={home} size={compact ? 52 : 68} />
          <div className="mt-3 text-[14px] font-bold text-fg sm:text-[16px]">{home.name}</div>
          <div className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-fg-3">
            <Home className="size-3" /> Home
          </div>
        </div>
        <div className="flex flex-col items-center">
          {match.score ? (
            <div className="num text-[44px] font-bold leading-none text-fg sm:text-[56px]">
              {match.score[0]}
              <span className="px-1 text-fg-3">:</span>
              {match.score[1]}
            </div>
          ) : (
            <div className="num text-[40px] font-bold leading-none text-fg sm:text-[52px]">{fmtTime(match.kickoff)}</div>
          )}
          <div className="mt-2">
            {live ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-live-soft px-2.5 py-0.5 text-[12px] font-bold text-live">
                <span className="animate-pulse-dot size-1.5 rounded-full bg-live" /> {match.status === 'HT' ? 'Half-time' : `${match.minute}′`}
              </span>
            ) : match.status === 'FT' ? (
              <Badge>Full time</Badge>
            ) : (
              <Badge tone="brand">Kick-off</Badge>
            )}
          </div>
        </div>
        <div className="flex flex-col items-center text-center">
          <Crest team={away} size={compact ? 52 : 68} />
          <div className="mt-3 text-[14px] font-bold text-fg sm:text-[16px]">{away.name}</div>
          <div className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-fg-3">
            <Plane className="size-3" /> Away
          </div>
        </div>
      </div>
      <div className="mx-auto mt-6 max-w-xl">
        <div className="mb-2 flex justify-between text-[11px] font-bold tracking-wider text-fg-3">
          <span>HOME</span>
          <span>DRAW</span>
          <span>AWAY</span>
        </div>
        <ProbBar p={pred.x12} height={10} />
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[12px]">
          <RecBadge pred={pred} />
          <span className="font-semibold text-fg-2">{pred.recommendation === 'skip' ? pred.skipReason : `${pred.pick.label} · ${fmt(pred.pick.p)}`}</span>
          <span className="text-fg-3">· signal {pred.signal}/100 · data {Math.round(match.completeness * 100)}%</span>
        </div>
      </div>
    </div>
  )
  return linkTo ? (
    <Link to={`/match/${match.id}`} className="block transition-transform duration-200 hover:-translate-y-0.5">
      {body}
    </Link>
  ) : (
    body
  )
}

/* ───────────── Date strip (reference: top of centre screen) ───────────── */
export function DateStrip({ days, value, onChange, liveCount }: { days: string[]; value: string; onChange: (d: string) => void; liveCount?: number }) {
  const idx = days.indexOf(value)
  return (
    <div className="flex items-center gap-2">
      {liveCount !== undefined && (
        <button onClick={() => navigate('/live')} className="flex h-12 shrink-0 items-center gap-2 rounded-2xl border border-live/30 bg-live-soft px-3" aria-label={`${liveCount} live matches`}>
          <LivePill />
          <span className="num text-[15px] font-bold text-live">{liveCount}</span>
        </button>
      )}
      <div className="card flex min-w-0 flex-1 items-center rounded-2xl p-1">
        <button aria-label="Previous day" disabled={idx <= 0} onClick={() => onChange(days[idx - 1])} className="flex size-10 shrink-0 items-center justify-center rounded-xl text-fg-3 hover:text-fg disabled:opacity-30">
          <ChevronLeft className="size-4" />
        </button>
        <div className="no-scrollbar flex min-w-0 flex-1 overflow-x-auto">
          {days.map((d) => {
            const on = d === value
            const today = d === '2026-11-28'
            return (
              <button key={d} onClick={() => onChange(d)} className={cx('relative flex min-w-[76px] flex-1 flex-col items-center rounded-xl py-1.5 transition-colors', on ? 'bg-surface-3' : 'hover:bg-surface-2')}>
                <span className={cx('text-[12px] font-semibold', on ? 'text-fg' : 'text-fg-3')}>{today ? 'Today' : fmtDay(d + 'T12:00:00Z')}</span>
                <span className={cx('text-[13px] font-bold', on ? 'text-fg' : 'text-fg-2')}>{fmtDate(d + 'T12:00:00Z')}</span>
                {on && <span className="glow-bar" aria-hidden />}
              </button>
            )
          })}
        </div>
        <button aria-label="Next day" disabled={idx >= days.length - 1} onClick={() => onChange(days[idx + 1])} className="flex size-10 shrink-0 items-center justify-center rounded-xl text-fg-3 hover:text-fg disabled:opacity-30">
          <ChevronRight className="size-4" />
        </button>
      </div>
      <button className="hidden h-12 shrink-0 items-center gap-2 rounded-2xl border border-line bg-surface-1 px-3 text-fg-2 hover:text-fg sm:flex" aria-label="Pick a date">
        <CalendarDays className="size-5" />
      </button>
    </div>
  )
}

/* ───────────── Score matrix heatmap ───────────── */
export function ScoreMatrix({ pred, max = 5 }: { pred: Prediction; max?: number }) {
  const fmt = useProb()
  const peak = Math.max(...pred.matrix.slice(0, max + 1).flatMap((r) => r.slice(0, max + 1)))
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
                const p = pred.matrix[h][a]
                const t = p / peak
                return (
                  <td
                    key={a}
                    className="num h-10 w-12 rounded-lg text-[12px] font-bold"
                    style={{ background: `color-mix(in srgb, var(--brand) ${Math.round(t * 85)}%, var(--surface-2))`, color: t > 0.45 ? '#fff' : 'var(--text-2)' }}
                    title={`${h}–${a}: ${fmt(p, 1)}`}
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
export function StatCompare({ label, home, away, format = (v: number) => String(v), lowerIsBetter, unavailable }: { label: string; home: number; away: number; format?: (v: number) => string; lowerIsBetter?: boolean; unavailable?: string }) {
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
        <span className={cx('num text-[15px] font-bold', homeBetter ? 'text-fg' : 'text-fg-3')}>{format(home)}</span>
        <span className="text-[12px] font-semibold text-fg-3">{label}</span>
        <span className={cx('num text-[15px] font-bold', !homeBetter && home !== away ? 'text-fg' : 'text-fg-3')}>{format(away)}</span>
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

export function MarketStatusDot({ status }: { status: 'active' | 'validating' | 'disabled' }) {
  const c = status === 'active' ? 'bg-live' : status === 'validating' ? 'bg-warn' : 'bg-fg-3'
  return <span className={cx('inline-block size-1.5 rounded-full', c)} aria-label={status} />
}

export function MultiAddButton({ match }: { match: Match }) {
  const add = useApp((s) => s.addLeg)
  const pred = getPrediction(match)
  const inList = useApp((s) => s.legs.some((l) => l.matchId === match.id))
  return (
    <button
      onClick={() => add({ matchId: match.id, market: pred.pick.market === '1x2' || pred.pick.market === 'ou25' || pred.pick.market === 'btts' ? pred.pick.market : '1x2', selection: pred.pick.selection === 'homeDraw' ? 'home' : pred.pick.selection === 'drawAway' ? 'away' : pred.pick.selection })}
      className={cx('inline-flex h-8 items-center gap-1.5 rounded-[10px] border px-2.5 text-[12px] font-bold transition-colors', inList ? 'border-brand/40 bg-brand-soft text-brand-fg' : 'border-line text-fg-2 hover:text-fg hover:border-line-strong')}
    >
      <Layers className="size-3.5" /> {inList ? 'In analysis' : 'Add to multi'}
    </button>
  )
}
