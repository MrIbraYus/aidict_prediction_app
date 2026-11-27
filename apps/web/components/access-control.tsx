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
  { value: 'setN', label: 'Days from now…' },
  { value: 'add7', label: 'Add 7 days', cmd: { type: 'add', days: 7 } },
  { value: 'add30', label: 'Add 30 days', cmd: { type: 'add', days: 30 } },
  { value: 'addN', label: 'Add days…' },
  { value: 'until', label: 'Custom end date…' },
  { value: 'unlimited', label: 'Free · unlimited', cmd: { type: 'unlimited' } },
  { value: 'end', label: 'End access now', cmd: { type: 'end' } },
]

/** Owner/admin control for one member's access period. Applies immediately, also during the free trial. */
export function AccessControl({ id, name }: { id: string; name: string }) {
  const [choice, setChoice] = useState('set30')
  const [date, setDate] = useState('')
  const [days, setDays] = useState('')
  const [pending, start] = useTransition()
  const typed = choice === 'setN' || choice === 'addN'
  const apply = () => {
    const opt = OPTIONS.find((o) => o.value === choice)!
    let cmd: AccessCommand | null = opt.cmd ?? null
    let summary = opt.label
    if (choice === 'until') {
      if (!date) return toast({ title: 'Pick an end date first', tone: 'info' })
      cmd = { type: 'until', until: new Date(date + 'T23:59:00').toISOString() }
    }
    if (typed) {
      const n = Number(days)
      if (!Number.isInteger(n) || n < 1 || n > 3650) return toast({ title: 'Enter a whole number of days from 1 to 3650', tone: 'info' })
      cmd = { type: choice === 'setN' ? 'set' : 'add', days: n }
      summary = choice === 'setN' ? `${n} day${n === 1 ? '' : 's'} from now` : `Added ${n} day${n === 1 ? '' : 's'}`
    }
    if (!cmd) return
    const finalCmd = cmd
    start(async () => {
      const r = await setUserAccess(id, finalCmd)
      toast(r.ok ? { title: `Access updated for ${name}`, body: summary, tone: 'success' } : { title: 'Not changed', body: r.error, tone: 'error' })
      if (r.ok) setDays('')
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
      {typed && (
        <label className="flex items-center gap-1.5 text-[12px] text-fg-3">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={3650}
            step={1}
            value={days}
            onChange={(e) => setDays(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && apply()}
            placeholder="20"
            aria-label={choice === 'setN' ? 'Number of days from now' : 'Number of days to add'}
            className="h-8 w-20 rounded-[10px] border border-line bg-surface-2 px-2 text-[16px] font-semibold text-fg sm:text-[12px]"
          />
          days
        </label>
      )}
      {choice === 'until' && (
        <input type="date" value={date} min={new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} aria-label="Access end date" className="h-8 rounded-[10px] border border-line bg-surface-2 px-2 text-[12px]" />
      )}
      <Button size="sm" variant="primary" loading={pending} onClick={apply}>
        Apply
      </Button>
    </div>
  )
}
