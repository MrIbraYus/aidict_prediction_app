'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2, X } from 'lucide-react'
import { addPick, removePick } from '@/lib/picks-actions'
import type { MyPickOption } from '@/lib/data'
import { Button } from './ui/primitives'
import { toast } from './ui/overlay'

const pctText = (p: number | null) => (p == null ? '' : ` · ${Math.round(p * 100)}%`)

/** Change (same match and market, before kick-off) or remove a pick from My Picks. */
export function MyPickControls({ id, fixtureId, market, outcome, options, canChange }: { id: string; fixtureId: number; market: string; outcome: string; options: MyPickOption[]; canChange: boolean }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [choice, setChoice] = useState(outcome)
  const [pending, start] = useTransition()
  const done = (ok: boolean, error: string | undefined, title: string) => {
    toast(ok ? { title, tone: 'success' } : { title: 'Not updated', body: error, tone: 'error' })
    if (ok) {
      setEditing(false)
      router.refresh()
    }
  }
  if (editing)
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <select value={choice} onChange={(e) => setChoice(e.target.value)} aria-label="Change my pick" className="h-8 max-w-[230px] rounded-[10px] border border-line bg-surface-2 px-2 text-[12px] font-semibold">
          {options.map((o) => (
            <option key={o.outcome} value={o.outcome}>
              {o.label}
              {pctText(o.p)}
            </option>
          ))}
        </select>
        <Button size="sm" variant="primary" loading={pending} disabled={choice === outcome} onClick={() => start(async () => { const r = await addPick({ fixtureId, market, outcome: choice }); done(r.ok, r.error, 'Pick changed') })}>
          Save
        </Button>
        <button aria-label="Cancel" onClick={() => setEditing(false)} className="inline-flex size-8 items-center justify-center rounded-lg text-fg-3 hover:text-fg">
          <X className="size-4" />
        </button>
      </div>
    )
  return (
    <div className="flex items-center gap-1.5">
      {canChange && options.length > 1 && (
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
          <Pencil className="size-3.5" /> Change
        </Button>
      )}
      <Button size="sm" variant="ghost" loading={pending} onClick={() => start(async () => { const r = await removePick({ id }); done(r.ok, r.error, 'Removed from My Picks') })}>
        <Trash2 className="size-3.5" /> Remove
      </Button>
    </div>
  )
}
