'use client'
import { useState, useTransition } from 'react'
import { setUserAccess, type AccessCommand } from '@/lib/admin-actions'
import { Button } from './ui/primitives'
import { toast } from './ui/overlay'

const OPTIONS: { value: string; label: string; cmd?: AccessCommand }[] = [
  { value: 'set7', label: '7 days from now', cmd: { type: 'set', days: 7 } },
  { value: 'set30', label: '30 days from now', cmd: { type: 'set', days: 30 } },
  { value: 'set90', label: '90 days from now', cmd: { type: 'set', days: 90 } },
  { value: 'set365', label: '1 year from now', cmd: { type: 'set', days: 365 } },
  { value: 'add7', label: 'Add 7 days', cmd: { type: 'add', days: 7 } },
  { value: 'add30', label: 'Add 30 days', cmd: { type: 'add', days: 30 } },
  { value: 'until', label: 'Custom end date…' },
  { value: 'unlimited', label: 'Free · unlimited', cmd: { type: 'unlimited' } },
  { value: 'end', label: 'End access now', cmd: { type: 'end' } },
]

/** Owner/admin control for one member's access period. Applies immediately, also during the free trial. */
export function AccessControl({ id, name }: { id: string; name: string }) {
  const [choice, setChoice] = useState('set30')
  const [date, setDate] = useState('')
  const [pending, start] = useTransition()
  const apply = () => {
    const opt = OPTIONS.find((o) => o.value === choice)!
    const cmd: AccessCommand | null = choice === 'until' ? (date ? { type: 'until', until: new Date(date + 'T23:59:00').toISOString() } : null) : opt.cmd!
    if (!cmd) return toast({ title: 'Pick an end date first', tone: 'info' })
    start(async () => {
      const r = await setUserAccess(id, cmd)
      toast(r.ok ? { title: `Access updated for ${name}`, body: opt.label, tone: 'success' } : { title: 'Not changed', body: r.error, tone: 'error' })
    })
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <select value={choice} onChange={(e) => setChoice(e.target.value)} aria-label={`Access for ${name}`} className="h-8 rounded-[10px] border border-line bg-surface-2 px-2 text-[12px] font-semibold">
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {choice === 'until' && (
        <input type="date" value={date} min={new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} aria-label="Access end date" className="h-8 rounded-[10px] border border-line bg-surface-2 px-2 text-[12px]" />
      )}
      <Button size="sm" variant="primary" loading={pending} onClick={apply}>
        Apply
      </Button>
    </div>
  )
}
