'use client'
import { useEffect, useSyncExternalStore, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Plus } from 'lucide-react'
import { addPick, removePick } from '@/lib/picks-actions'
import { cx } from '@/lib/format'
import { toast } from './ui/overlay'

type Props = {
  fixtureId: number
  market: string
  outcome: string
  /** Outcome currently in My Picks for this match + market, if any. */
  current: string | null
  disabled?: boolean
  variant?: 'chip' | 'score' | 'icon'
  children?: ReactNode
  className?: string
}

/* One shared selection per match + market, so every button of that market (e.g. all correct scores) updates at once. */
const selections = new Map<string, string | null>()
const listeners = new Set<() => void>()
const subscribe = (l: () => void) => (listeners.add(l), () => void listeners.delete(l))
function setSelection(key: string, value: string | null) {
  selections.set(key, value)
  listeners.forEach((l) => l())
}

/** Adds a prediction to My Picks (or removes it). One selection per market per match: picking another outcome changes it. */
export function PickButton({ fixtureId, market, outcome, current, disabled, variant = 'chip', children, className }: Props) {
  const router = useRouter()
  const key = `${fixtureId}|${market}`
  const picked = useSyncExternalStore(subscribe, () => (selections.has(key) ? (selections.get(key) ?? null) : current), () => current)
  useEffect(() => setSelection(key, current), [key, current]) // server truth after each refresh
  const [pending, start] = useTransition()
  const on = picked === outcome
  const click = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (disabled) return
    const before = picked
    start(async () => {
      setSelection(key, on ? null : outcome)
      const r = on ? await removePick({ fixtureId, market }) : await addPick({ fixtureId, market, outcome })
      if (!r.ok) {
        setSelection(key, before)
        toast({ title: 'My Picks not updated', body: r.error, tone: 'error' })
      }
      else toast({ title: r.action === 'removed' ? 'Removed from My Picks' : r.action === 'changed' ? 'Pick changed in My Picks' : 'Added to My Picks', tone: 'success' })
      router.refresh()
    })
  }
  const label = on ? 'Remove from My Picks' : current ? 'Change my pick to this' : 'Add to My Picks'
  if (variant === 'score')
    return (
      <button
        onClick={click}
        disabled={disabled || pending}
        aria-pressed={on}
        aria-label={label}
        className={cx(
          'relative flex h-14 flex-col items-center justify-center rounded-xl border text-[16px] font-bold transition-colors disabled:opacity-50',
          on ? 'border-brand bg-brand text-white shadow-[0_8px_24px_-12px_var(--brand-glow)]' : 'border-line bg-surface-2 text-fg hover:border-line-strong hover:bg-surface-3',
          className,
        )}
      >
        {children}
        {on && <Check className="absolute right-1.5 top-1.5 size-3.5" />}
      </button>
    )
  if (variant === 'icon')
    return (
      <button
        onClick={click}
        disabled={disabled || pending}
        aria-pressed={on}
        aria-label={label}
        title={label}
        className={cx('inline-flex size-8 shrink-0 items-center justify-center rounded-lg border transition-colors disabled:opacity-40', on ? 'border-brand bg-brand text-white' : 'border-line text-fg-3 hover:border-line-strong hover:text-fg', className)}
      >
        {on ? <Check className="size-4" /> : <Plus className="size-4" />}
      </button>
    )
  return (
    <button
      onClick={click}
      disabled={disabled || pending}
      aria-pressed={on}
      className={cx(
        'inline-flex h-7 items-center gap-1 rounded-lg border px-2 text-[11px] font-bold transition-colors disabled:opacity-40',
        on ? 'border-brand bg-brand text-white' : 'border-line text-fg-2 hover:border-line-strong hover:text-fg',
        className,
      )}
    >
      {on ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
      {on ? 'In My Picks' : 'My Picks'}
    </button>
  )
}
