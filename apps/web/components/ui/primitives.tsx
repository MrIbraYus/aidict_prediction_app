import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import Link from 'next/link'
import { Activity, Inbox, RefreshCw } from 'lucide-react'
import { cx } from '@/lib/format'

/* ───────────── Button ───────────── */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type Size = 'sm' | 'md' | 'lg'
const VARIANT: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-hover shadow-[0_8px_24px_-10px_var(--brand-glow)]',
  secondary: 'bg-surface-3 text-fg hover:bg-surface-2 border border-line',
  outline: 'bg-transparent text-fg border border-line-strong hover:bg-surface-2',
  ghost: 'bg-transparent text-fg-2 hover:text-fg hover:bg-surface-2',
  danger: 'bg-danger-soft text-danger hover:bg-danger hover:text-white',
}
const SIZE: Record<Size, string> = { sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-[10px]', md: 'h-10 px-4 text-sm gap-2 rounded-xl', lg: 'h-12 px-5 text-[15px] gap-2 rounded-[14px]' }

export function Button({ variant = 'secondary', size = 'md', loading, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button
      className={cx('inline-flex items-center justify-center font-semibold whitespace-nowrap transition-colors duration-150 disabled:opacity-45 select-none', VARIANT[variant], SIZE[size], className)}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading && <RefreshCw className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
}


/* ───────────── Card ───────────── */
export function Card({ className, children, as: As = 'section' }: { className?: string; children: ReactNode; as?: 'section' | 'div' | 'article' }) {
  return <As className={cx('card', className)}>{children}</As>
}

export function CardHeader({ title, eyebrow, action, className, icon }: { title: ReactNode; eyebrow?: ReactNode; action?: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <div className={cx('flex items-start justify-between gap-3 px-5 pt-5', className)}>
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
        <h2 className="flex items-center gap-2 text-[15px] font-bold text-fg">
          {icon}
          <span className="truncate">{title}</span>
        </h2>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

/* ───────────── Badge / status ───────────── */
type Tone = 'neutral' | 'brand' | 'live' | 'success' | 'warn' | 'danger' | 'info' | 'gold'
const TONE: Record<Tone, string> = {
  neutral: 'bg-surface-3 text-fg-2',
  brand: 'bg-brand-soft text-brand-fg',
  live: 'bg-live-soft text-live',
  success: 'bg-success-soft text-success',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
  gold: 'bg-[color-mix(in_srgb,var(--gold)_16%,transparent)] text-gold',
}
export function Badge({ tone = 'neutral', children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold leading-[18px] whitespace-nowrap', TONE[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  )
}

export const STATUS_TONE: Record<string, Tone> = {
  active: 'success', operational: 'success', success: 'success', won: 'success', resolved: 'success',
  validating: 'warn', degraded: 'warn', warning: 'warn', stale: 'warn', candidate: 'info', pending: 'neutral', open: 'danger',
  disabled: 'neutral', planned: 'neutral', retired: 'neutral', void: 'neutral', lost: 'danger', down: 'danger', error: 'danger', not_configured: 'neutral',
}
export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const text = label ?? status.replace('_', ' ')
  return (
    <Badge tone={STATUS_TONE[status] ?? 'neutral'} dot>
      <span className="capitalize">{text}</span>
    </Badge>
  )
}

export function LivePill({ children = 'LIVE', className }: { children?: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-md bg-live px-1.5 py-[1px] text-[10px] font-extrabold tracking-wider text-[#04140a] shadow-[0_0_14px_-2px_var(--live)]', className)}>
      {children}
    </span>
  )
}

/* ───────────── Input ───────────── */
export function Input({ className, icon, error, ...rest }: InputHTMLAttributes<HTMLInputElement> & { icon?: ReactNode; error?: boolean }) {
  return (
    <div className={cx('flex h-11 items-center gap-2 rounded-xl border bg-surface-2 px-3 transition-colors focus-within:border-brand-fg', error ? 'border-danger' : 'border-line', className)}>
      {icon && <span className="text-fg-3">{icon}</span>}
      <input className="h-full w-full min-w-0 bg-transparent text-[16px] font-medium text-fg outline-none placeholder:text-fg-3 sm:text-sm" {...rest} />
    </div>
  )
}

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: string; error?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-[13px] font-semibold text-fg-2">
        {label}
      </label>
      {children}
      {error ? <p className="text-[12px] font-semibold text-danger">{error}</p> : hint ? <p className="text-[12px] text-fg-3">{hint}</p> : null}
    </div>
  )
}

/* ───────────── Progress / meters ───────────── */
export function Progress({ value, tone = 'brand', className, height = 6 }: { value: number; tone?: 'brand' | 'live' | 'warn' | 'info' | 'neutral' | 'danger'; className?: string; height?: number }) {
  const color = { brand: 'var(--brand-fg)', live: 'var(--live)', warn: 'var(--warn)', info: 'var(--info)', neutral: 'var(--neutral)', danger: 'var(--danger)' }[tone]
  return (
    <div className={cx('w-full overflow-hidden rounded-full bg-surface-3', className)} style={{ height }} role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }} />
    </div>
  )
}

export function Ring({ value, size = 52, stroke = 5, label, tone }: { value: number; size?: number; stroke?: number; label?: ReactNode; tone?: string }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const color = tone ?? (value >= 0.68 ? 'var(--live)' : value >= 0.52 ? 'var(--gold)' : 'var(--text-3)')
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value)} style={{ transition: 'stroke-dashoffset .6s ease' }} />
      </svg>
      <span className="num absolute text-[15px] font-bold text-fg">{label ?? Math.round(value * 100)}</span>
    </div>
  )
}

/* ───────────── KPI tile ───────────── */
export function Kpi({ label, value, sub, delta, deltaGood, className, help }: { label: string; value: ReactNode; sub?: ReactNode; delta?: string; deltaGood?: boolean; className?: string; help?: string }) {
  return (
    <div className={cx('card-inset p-4', className)} title={help}>
      <div className="eyebrow">{label}</div>
      <div className="num mt-1.5 text-[28px] font-bold leading-none text-fg">{value}</div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-fg-3">
        {delta && <span className={cx('font-bold', deltaGood ? 'text-success' : 'text-danger')}>{delta}</span>}
        {sub}
      </div>
    </div>
  )
}

/* ───────────── Skeleton & states ───────────── */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('skeleton', className)} aria-hidden />
}

export function SkeletonCard({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cx('card space-y-3 p-5', className)} aria-busy="true" aria-label="Loading">
      <Skeleton className="h-4 w-40" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-full" />
          <Skeleton className="h-3.5 flex-1" />
          <Skeleton className="h-3.5 w-16" />
        </div>
      ))}
    </div>
  )
}

export function EmptyState({ title, body, action, icon }: { title: string; body?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl border border-line bg-surface-2 text-fg-3">{icon ?? <Inbox className="size-6" />}</div>
      <h3 className="text-[15px] font-bold text-fg">{title}</h3>
      {body && <p className="mt-1.5 max-w-sm text-[13px] text-fg-3">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}


/* ───────────── Notice / callout ───────────── */
export function Notice({ tone = 'info', title, children, icon, className }: { tone?: 'info' | 'warn' | 'danger' | 'success' | 'neutral'; title?: ReactNode; children?: ReactNode; icon?: ReactNode; className?: string }) {
  const map = { info: 'border-info/25 bg-info-soft text-info', warn: 'border-warn/25 bg-warn-soft text-warn', danger: 'border-danger/25 bg-danger-soft text-danger', success: 'border-success/25 bg-success-soft text-success', neutral: 'border-line bg-surface-2 text-fg-2' }
  return (
    <div className={cx('flex gap-3 rounded-xl border px-3.5 py-3 text-[13px]', map[tone], className)}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0">
        {title && <div className="font-bold">{title}</div>}
        {children && <div className="text-fg-2">{children}</div>}
      </div>
    </div>
  )
}

/* ───────────── Table shell ───────────── */
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('scroll-x', className)}>
      <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">{children}</table>
    </div>
  )
}
export const Th = ({ children, className, align }: { children?: ReactNode; className?: string; align?: 'right' | 'center' }) => (
  <th className={cx('eyebrow h-10 border-b border-line px-4 font-bold whitespace-nowrap', align === 'right' && 'text-right', align === 'center' && 'text-center', className)}>{children}</th>
)
export const Td = ({ children, className, align }: { children?: ReactNode; className?: string; align?: 'right' | 'center' }) => (
  <td className={cx('h-12 border-b border-line px-4 text-fg-2', align === 'right' && 'text-right', align === 'center' && 'text-center', className)}>{children}</td>
)

/* ───────────── Link tabs (server-rendered, URL is the state) ───────────── */
export function LinkTabs({ items, value, className }: { items: { value: string; label: ReactNode; href: string; badge?: ReactNode }[]; value: string; className?: string }) {
  return (
    <nav className={cx('no-scrollbar flex items-stretch gap-1 overflow-x-auto border-b border-line', className)}>
      {items.map((it) => {
        const on = it.value === value
        return (
          <Link
            key={it.value}
            href={it.href}
            scroll={false}
            aria-current={on ? 'page' : undefined}
            className={cx('relative flex h-11 shrink-0 items-center gap-2 px-3.5 text-sm font-semibold transition-colors', on ? 'text-fg' : 'text-fg-3 hover:text-fg-2')}
          >
            {it.label}
            {it.badge}
            {on && <span className="glow-bar" aria-hidden />}
          </Link>
        )
      })}
    </nav>
  )
}

export function PageHeader({ title, eyebrow, description, actions, back }: { title: ReactNode; eyebrow?: ReactNode; description?: ReactNode; actions?: ReactNode; back?: { to: string; label: string } }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link href={back.to} className="mb-2 inline-flex items-center gap-1 text-[12px] font-bold text-fg-3 hover:text-fg">
            ← {back.label}
          </Link>
        )}
        {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
        <h1 className="text-[24px] font-extrabold tracking-[-0.01em] text-fg sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[13.5px] text-fg-3">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function SourceNote({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-fg-3">
      <Activity className="size-3" /> {children}
    </p>
  )
}
