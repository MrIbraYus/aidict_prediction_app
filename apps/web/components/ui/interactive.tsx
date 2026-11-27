'use client'
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { AlertTriangle, Check, ChevronDown, RefreshCw } from 'lucide-react'
import { cx } from '@/lib/format'
import { Button } from './primitives'

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
