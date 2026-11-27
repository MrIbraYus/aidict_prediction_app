'use client'
import { useOptimistic, useTransition } from 'react'
import { Star } from 'lucide-react'
import { cx } from '@/lib/format'
import { toggleSaved } from '@/lib/actions'
import { toast } from '../ui/overlay'

export function SaveButton({ fixtureId, saved, variant = 'row' }: { fixtureId: number; saved: boolean; variant?: 'row' | 'button' }) {
  const [on, setOn] = useOptimistic(saved)
  const [pending, start] = useTransition()
  const click = () =>
    start(async () => {
      setOn(!on)
      const r = await toggleSaved(fixtureId, !on)
      if (!r.ok) toast({ title: 'Could not update saved matches', body: r.error, tone: 'error' })
      else toast({ title: on ? 'Removed from saved' : 'Saved', body: on ? undefined : 'You will find it under Saved.', tone: 'success' })
    })
  if (variant === 'button')
    return (
      <button onClick={click} disabled={pending} aria-pressed={on} className={cx('inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-colors', on ? 'border-gold/40 bg-[color-mix(in_srgb,var(--gold)_14%,transparent)] text-gold' : 'border-line bg-surface-3 text-fg hover:bg-surface-2')}>
        <Star className={cx('size-4', on && 'fill-gold')} /> {on ? 'Saved' : 'Save match'}
      </button>
    )
  return (
    <button onClick={click} disabled={pending} aria-label={on ? 'Remove from saved' : 'Save match'} aria-pressed={on} className="flex w-12 shrink-0 items-center justify-center border-l border-line text-fg-3 transition-colors hover:text-gold">
      <Star className={cx('size-[18px]', on && 'fill-gold text-gold')} />
    </button>
  )
}
