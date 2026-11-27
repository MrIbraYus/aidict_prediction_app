'use client'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { Play, Volume2 } from 'lucide-react'
import { savePreferences } from '@/lib/actions'
import { Select, Switch } from './ui/interactive'
import { toast } from './ui/overlay'

const CATEGORIES = [
  { key: 'prediction', label: 'New prediction published', sound: 'new-prediction', hint: 'For saved matches: 7-day preview, day before, 2 h before' },
  { key: 'kickoff', label: 'Kick-off soon', sound: 'kickoff-soon', hint: '30 minutes before a saved match' },
  { key: 'live', label: 'Match started', sound: 'match-live', hint: '' },
  { key: 'goal', label: 'Goals', sound: 'goal', hint: 'Delayed source; not real-time' },
  { key: 'finished', label: 'Full time', sound: 'match-finished', hint: '' },
  { key: 'settled', label: 'Pick settled', sound: 'prediction-settled', hint: 'Won / lost after the result is confirmed' },
  { key: 'system', label: 'System alerts', sound: 'system-alert', hint: 'Data delays, model updates' },
] as const

type Prefs = Record<string, boolean>

function play(id: string, volume: number) {
  const a = new Audio(`/sounds/${id}.wav`)
  a.volume = volume
  void a.play().catch(() => toast({ title: 'Your browser blocked audio', body: 'Click anywhere on the page first, then try again.', tone: 'info' }))
}

export function TimeZoneSetting({ current }: { current: string }) {
  const [tz, setTz] = useState(current)
  const [pending, start] = useTransition()
  const zones = useMemo(() => {
    try {
      return Intl.supportedValuesOf('timeZone')
    } catch {
      return ['UTC', current]
    }
  }, [current])
  const [detected, setDetected] = useState<string | null>(null)
  useEffect(() => setDetected(Intl.DateTimeFormat().resolvedOptions().timeZone), [])
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Select
        className="sm:w-80"
        value={tz}
        onChange={(v) =>
          start(async () => {
            setTz(v)
            const r = await savePreferences({ time_zone: v })
            toast(r.ok ? { title: 'Time zone saved', body: v, tone: 'success' } : { title: 'Could not save', body: r.error, tone: 'error' })
          })
        }
        options={zones.map((z) => ({ value: z, label: z.replace(/_/g, ' ') }))}
      />
      {detected && detected !== tz && <span className="text-[12px] text-fg-3">Your device reports {detected}.</span>}
      {pending && <span className="text-[12px] text-fg-3">Saving…</span>}
    </div>
  )
}

export function NotificationSettings({ initial }: { initial: Prefs }) {
  const [prefs, setPrefs] = useState<Prefs>(() => Object.fromEntries(CATEGORIES.map((c) => [c.key, initial[c.key] ?? c.key !== 'goal'])))
  const [sound, setSound] = useState(true)
  const [volume, setVolume] = useState(0.7)
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem('aidict.sound') ?? '{}')
      if (typeof s.on === 'boolean') setSound(s.on)
      if (typeof s.volume === 'number') setVolume(s.volume)
    } catch {}
  }, [])
  const persistSound = (on: boolean, v: number) => {
    try {
      localStorage.setItem('aidict.sound', JSON.stringify({ on, volume: v }))
    } catch {}
  }
  const toggle = async (key: string, v: boolean) => {
    const next = { ...prefs, [key]: v }
    setPrefs(next)
    const r = await savePreferences({ notification_prefs: next })
    if (!r.ok) toast({ title: 'Could not save', body: r.error, tone: 'error' })
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface-2 px-4 py-3">
        <Volume2 className="size-5 text-fg-3" />
        <span className="text-[13px] font-semibold">Sounds</span>
        <Switch
          label="Notification sounds"
          checked={sound}
          onChange={(v) => {
            setSound(v)
            persistSound(v, volume)
          }}
        />
        <label className="ml-auto flex items-center gap-2 text-[12px] text-fg-3">
          Volume
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            disabled={!sound}
            onChange={(e) => {
              setVolume(Number(e.target.value))
              persistSound(sound, Number(e.target.value))
            }}
            className="w-28 accent-[var(--brand)]"
            aria-label="Notification volume"
          />
        </label>
      </div>
      <ul className="divide-y divide-line rounded-xl border border-line">
        {CATEGORIES.map((c) => (
          <li key={c.key} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-fg">{c.label}</div>
              {c.hint && <div className="text-[11px] text-fg-3">{c.hint}</div>}
            </div>
            <button type="button" onClick={() => play(c.sound, volume)} disabled={!sound} className="inline-flex size-8 items-center justify-center rounded-lg border border-line text-fg-3 hover:text-fg disabled:opacity-40" aria-label={`Preview ${c.label} sound`}>
              <Play className="size-3.5" />
            </button>
            <Switch label={c.label} checked={prefs[c.key]} onChange={(v) => void toggle(c.key, v)} />
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-fg-3">Alerts appear in the in-app inbox. Browser push needs VAPID keys, which are not configured yet. Sounds are original CC0 recordings made for AIDICT.</p>
    </div>
  )
}
