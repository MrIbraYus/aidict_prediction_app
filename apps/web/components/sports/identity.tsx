'use client'
import { useState } from 'react'
import { Shield } from 'lucide-react'
import type { TeamVM } from '@/lib/types'
import { cx } from '@/lib/format'

/**
 * Authentic team badge from the badge registry (team_badges), fixed square box, object-contain.
 * Never generates a logo; neutral shield only when no authentic badge exists or the image fails to load.
 */
export function Crest({ team, size = 32, className }: { team: Pick<TeamVM, 'name' | 'crest' | 'kind' | 'contrast'>; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false)
  if (!team.crest || failed) return <NeutralBadge size={size} label={team.name} className={className} />
  if (team.kind === 'national-flag') {
    const h = Math.round(size * 0.67)
    return (
      <span className={cx('inline-flex shrink-0 items-center justify-center', className)} style={{ width: size, height: size }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={team.crest} alt={team.name + " national team"} width={size} height={h} loading="lazy" decoding="async" draggable={false} referrerPolicy="no-referrer" onError={() => setFailed(true)} className="w-full rounded-[3px] object-cover ring-1 ring-black/25" style={{ height: h }} />
      </span>
    )
  }
  return (
    <span className={cx('inline-flex shrink-0 items-center justify-center', team.contrast === 'dark' && 'crest-outline', className)} style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={team.crest} alt={team.name + " crest"} width={size} height={size} loading="lazy" decoding="async" draggable={false} referrerPolicy="no-referrer" onError={() => setFailed(true)} className="size-full object-contain" />
    </span>
  )
}

/** Neutral placeholder used only when no authentic badge can be obtained. Deliberately contains no initials or club colours. */
export function NeutralBadge({ size = 32, label, className }: { size?: number; label?: string; className?: string }) {
  return (
    <span className={cx('inline-flex shrink-0 items-center justify-center text-fg-3', className)} style={{ width: size, height: size }} role="img" aria-label={label ? label + " — badge unavailable" : "Badge unavailable"} title="Authentic badge unavailable">
      <Shield style={{ width: size * 0.82, height: size * 0.82 }} strokeWidth={1.6} />
    </span>
  )
}

/** Small vector flags (emoji flags do not render on Windows). */
export function Flag({ code, className }: { code: string; className?: string }) {
  const common = { width: 18, height: 13, viewBox: '0 0 18 13', className: cx('shrink-0 rounded-[3px] ring-1 ring-black/20', className), 'aria-hidden': true }
  switch (code) {
    case 'eng':
      return (
        <svg {...common}>
          <rect width="18" height="13" fill="#fff" />
          <rect x="7.5" width="3" height="13" fill="#CE1124" />
          <rect y="5" width="18" height="3" fill="#CE1124" />
        </svg>
      )
    case 'esp':
      return (
        <svg {...common}>
          <rect width="18" height="13" fill="#AA151B" />
          <rect y="3.25" width="18" height="6.5" fill="#F1BF00" />
        </svg>
      )
    case 'ger':
      return (
        <svg {...common}>
          <rect width="18" height="4.34" fill="#000" />
          <rect y="4.33" width="18" height="4.34" fill="#DD0000" />
          <rect y="8.66" width="18" height="4.34" fill="#FFCE00" />
        </svg>
      )
    case 'ita':
      return (
        <svg {...common}>
          <rect width="6" height="13" fill="#009246" />
          <rect x="6" width="6" height="13" fill="#fff" />
          <rect x="12" width="6" height="13" fill="#CE2B37" />
        </svg>
      )
    case 'fra':
      return (
        <svg {...common}>
          <rect width="6" height="13" fill="#0055A4" />
          <rect x="6" width="6" height="13" fill="#fff" />
          <rect x="12" width="6" height="13" fill="#EF4135" />
        </svg>
      )
    case 'ned':
      return (
        <svg {...common}>
          <rect width="18" height="4.34" fill="#AE1C28" />
          <rect y="4.33" width="18" height="4.34" fill="#fff" />
          <rect y="8.66" width="18" height="4.34" fill="#21468B" />
        </svg>
      )
    case 'por':
      return (
        <svg {...common}>
          <rect width="18" height="13" fill="#FF0000" />
          <rect width="7" height="13" fill="#006600" />
          <circle cx="7" cy="6.5" r="2.2" fill="#FFCC00" />
        </svg>
      )
    case 'bra':
      return (
        <svg {...common}>
          <rect width="18" height="13" fill="#009C3B" />
          <path d="M9 1.6 L16.2 6.5 L9 11.4 L1.8 6.5 Z" fill="#FFDF00" />
          <circle cx="9" cy="6.5" r="2.4" fill="#002776" />
        </svg>
      )
    case 'wld':
      return (
        <svg {...common}>
          <rect width="18" height="13" fill="#1F4E8C" />
          <circle cx="9" cy="6.5" r="4.2" fill="none" stroke="#fff" strokeWidth=".9" />
          <ellipse cx="9" cy="6.5" rx="1.9" ry="4.2" fill="none" stroke="#fff" strokeWidth=".7" />
          <line x1="4.8" y1="6.5" x2="13.2" y2="6.5" stroke="#fff" strokeWidth=".7" />
        </svg>
      )
    case 'eur':
    default:
      return (
        <svg {...common}>
          <rect width="18" height="13" fill="#0B2A6F" />
          {Array.from({ length: 8 }).map((_, i) => {
            const a = (i / 8) * Math.PI * 2
            return <circle key={i} cx={9 + Math.cos(a) * 3.6} cy={6.5 + Math.sin(a) * 3.6} r=".75" fill="#FFCC00" />
          })}
        </svg>
      )
  }
}

/** W / D / L pills (green / grey / red — from the UI reference). */
export function FormPills({ form, size = 'md' }: { form: ('W' | 'D' | 'L')[]; size?: 'sm' | 'md' }) {
  const cls = { W: 'bg-win text-white', D: 'bg-draw text-white', L: 'bg-loss text-white' }
  return (
    <div className="flex items-center gap-1" aria-label={`Form: ${form.join(' ')}`}>
      {form.map((r, i) => (
        <span key={i} className={cx('inline-flex items-center justify-center rounded-full font-extrabold', size === 'sm' ? 'size-[18px] text-[9px]' : 'size-[22px] text-[10px]', cls[r])}>
          {r}
        </span>
      ))}
    </div>
  )
}
