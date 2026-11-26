import { useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'
import { AlertTriangle, Check, ChevronDown, Inbox, RefreshCw } from 'lucide-react'
import { cx } from '../../lib/format'

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

export function IconButton({ label, className, children, active, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cx(
        'relative inline-flex size-10 items-center justify-center rounded-full border border-line bg-surface-2 text-fg-2 transition-colors hover:text-fg hover:border-line-strong',
        active && 'text-fg border-line-strong',
        className,
      )}
      {...rest}
    >
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

/* ───────────── Tabs (underline glow, from reference) ───────────── */
export function Tabs<T extends string>({ items, value, onChange, className, size = 'md' }: { items: { value: T; label: ReactNode; badge?: ReactNode }[]; value: T; onChange: (v: T) => void; className?: string; size?: 'sm' | 'md' }) {
  return (
    <div role="tablist" className={cx('no-scrollbar flex items-stretch gap-1 overflow-x-auto border-b border-line', className)}>
      {items.map((it) => {
        const on = it.value === value
        return (
          <button
            key={it.value}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(it.value)}
            className={cx(
              'relative flex shrink-0 items-center gap-2 px-3.5 font-semibold transition-colors',
              size === 'sm' ? 'h-9 text-[13px]' : 'h-11 text-sm',
              on ? 'text-fg' : 'text-fg-3 hover:text-fg-2',
            )}
          >
            {it.label}
            {it.badge}
            {on && <span className="glow-bar" aria-hidden />}
          </button>
        )
      })}
    </div>
  )
}

/* ───────────── Segmented control ───────────── */
export function Segmented<T extends string>({ items, value, onChange, className, size = 'md' }: { items: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; className?: string; size?: 'sm' | 'md' }) {
  return (
    <div className={cx('inline-flex rounded-xl border border-line bg-inset p-1', className)} role="radiogroup">
      {items.map((it) => {
        const on = it.value === value
        return (
          <button
            key={it.value}
            role="radio"
            aria-checked={on}
            onClick={() => onChange(it.value)}
            className={cx(
              'rounded-[9px] px-3 font-semibold transition-all whitespace-nowrap',
              size === 'sm' ? 'h-7 text-[12px]' : 'h-8 text-[13px]',
              on ? 'bg-surface-3 text-fg shadow-[0_1px_0_0_var(--highlight)_inset,0_4px_12px_-6px_rgba(0,0,0,.6)]' : 'text-fg-3 hover:text-fg-2',
            )}
          >
            {it.label}
          </button>
        )
      })}
    </div>
  )
}

/* ───────────── Select (custom dropdown) ───────────── */
export function Select<T extends string>({ value, onChange, options, label, className, icon }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; hint?: string; disabled?: boolean }[]; label?: string; className?: string; icon?: ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  const current = options.find((o) => o.value === value)
  return (
    <div ref={ref} className={cx('relative', className)}>
      <button
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-full items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 text-left text-sm font-semibold text-fg transition-colors hover:border-line-strong"
      >
        {icon && <span className="text-fg-3">{icon}</span>}
        <span className="min-w-0 flex-1 truncate">
          {label && <span className="mr-1 font-medium text-fg-3">{label}</span>}
          {current?.label}
        </span>
        <ChevronDown className={cx('size-4 text-fg-3 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <ul role="listbox" className="animate-fade-up absolute left-0 right-0 z-40 mt-1.5 max-h-72 min-w-[200px] overflow-auto rounded-xl border border-line-strong bg-surface-2 p-1 shadow-pop">
          {options.map((o) => (
            <li key={o.value}>
              <button
                role="option"
                aria-selected={o.value === value}
                disabled={o.disabled}
                onClick={() => {
                  onChange(o.value)
                  setOpen(false)
                }}
                className={cx('flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-semibold transition-colors disabled:opacity-40', o.value === value ? 'bg-surface-3 text-fg' : 'text-fg-2 hover:bg-surface-3 hover:text-fg')}
              >
                <span className="flex-1">
                  {o.label}
                  {o.hint && <span className="block text-[11px] font-medium text-fg-3">{o.hint}</span>}
                </span>
                {o.value === value && <Check className="size-4 text-brand-fg" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ───────────── Switch ───────────── */
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx('relative h-6 w-11 shrink-0 rounded-full border transition-colors disabled:opacity-40', checked ? 'border-transparent bg-brand' : 'border-line-strong bg-surface-3')}
    >
      <span className={cx('absolute top-1/2 size-[18px] -translate-y-1/2 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-[2px]')} />
    </button>
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

export function ErrorState({ title = 'Something went wrong', body, onRetry }: { title?: string; body?: ReactNode; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center" role="alert">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl border border-danger/30 bg-danger-soft text-danger">
        <AlertTriangle className="size-6" />
      </div>
      <h3 className="text-[15px] font-bold text-fg">{title}</h3>
      <p className="mt-1.5 max-w-md text-[13px] text-fg-3">{body ?? 'The data service did not respond. Cached data is shown where available. Nothing was lost.'}</p>
      {onRetry && (
        <Button className="mt-5" variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="size-4" /> Try again
        </Button>
      )}
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
