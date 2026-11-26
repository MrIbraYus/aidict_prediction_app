import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Bell, BellRing, BrainCircuit, CheckCircle2, CircleDot, Clock, Flag, FlaskConical, Goal, Play, RotateCcw, Settings2, Volume2, VolumeX, X, Zap } from 'lucide-react'
import { Link, navigate, useRoute } from '../lib/router'
import { cx } from '../lib/format'
import { CATEGORIES, catDef, protoNow, useNotify, type InboxItem, type LogOutcome, type NotifCategory, type NotifyEvent } from '../lib/notify'
import { matchById } from '../mock/matches'
import { teamById } from '../mock/teams'
import { Crest } from './sports/identity'
import { Badge, Button, Card, CardHeader, Select, Switch } from './ui/primitives'

export const CAT_ICON: Record<NotifCategory, typeof Bell> = { prediction: BrainCircuit, kickoff: Clock, live: CircleDot, goal: Goal, finished: Flag, settled: CheckCircle2, system: AlertTriangle }
export const CAT_TONE: Record<NotifCategory, string> = {
  prediction: 'text-brand-fg bg-brand-soft',
  kickoff: 'text-info bg-info-soft',
  live: 'text-live bg-live-soft',
  goal: 'text-live bg-live-soft',
  finished: 'text-fg-2 bg-surface-3',
  settled: 'text-success bg-success-soft',
  system: 'text-warn bg-warn-soft',
}

function ago(iso: string) {
  const m = Math.max(0, (protoNow() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${Math.round(m)} min ago`
  if (m < 1440) return `${Math.round(m / 60)} h ago`
  return `${Math.round(m / 1440)} d ago`
}

export function CategoryIcon({ category, size = 'md' }: { category: NotifCategory; size?: 'sm' | 'md' }) {
  const Icon = CAT_ICON[category]
  return (
    <span className={cx('flex shrink-0 items-center justify-center rounded-xl', CAT_TONE[category], size === 'sm' ? 'size-8' : 'size-10')}>
      <Icon className={size === 'sm' ? 'size-4' : 'size-[18px]'} />
    </span>
  )
}

function MatchCrests({ matchId, size = 18 }: { matchId?: string; size?: number }) {
  const m = matchId ? matchById(matchId) : undefined
  if (!m) return null
  return (
    <span className="flex items-center -space-x-1">
      <Crest team={teamById(m.homeId)} size={size} />
      <Crest team={teamById(m.awayId)} size={size} />
    </span>
  )
}

/* ───────────── Inbox row ───────────── */
export function NotificationRow({ item, compact, onOpen }: { item: InboxItem; compact?: boolean; onOpen?: () => void }) {
  const markRead = useNotify((s) => s.markRead)
  return (
    <button
      onClick={() => {
        markRead(item.id)
        onOpen?.()
        if (item.matchId) navigate(`/match/${item.matchId}`)
      }}
      className={cx('flex w-full items-start gap-3.5 text-left transition-colors hover:bg-surface-2/60', compact ? 'rounded-xl px-3 py-2.5' : 'px-5 py-4')}
    >
      <CategoryIcon category={item.category} size={compact ? 'sm' : 'md'} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className={cx('truncate', compact ? 'text-[13px]' : 'text-[14px]', item.read ? 'font-semibold text-fg-2' : 'font-bold text-fg')}>{item.title}</span>
          {item.merged && <Badge tone="info">Combined</Badge>}
        </span>
        <span className={cx('mt-0.5 block text-fg-3', compact ? 'line-clamp-1 text-[12px]' : 'text-[13px]')}>{item.body}</span>
        {!compact && (
          <span className="mt-1.5 flex items-center gap-2 text-[11px] font-semibold text-fg-3">
            {catDef(item.category).label}
            <MatchCrests matchId={item.matchId} size={16} />
          </span>
        )}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-2">
        <span className="text-[11px] font-semibold text-fg-3">{ago(item.at)}</span>
        {!item.read && <span className="size-2 rounded-full bg-brand-fg" aria-label="Unread" />}
      </span>
    </button>
  )
}

/* ───────────── Toasts ───────────── */
export function NotificationToasts() {
  const toasts = useNotify((s) => s.toasts)
  const dismiss = useNotify((s) => s.dismissToast)
  const markRead = useNotify((s) => s.markRead)
  return (
    <>
      {toasts.map(({ id, item, extra }) => (
        <div key={id} role="status" className={cx('animate-slide-in pointer-events-auto w-full max-w-sm overflow-hidden rounded-2xl border bg-surface-2 shadow-pop', item.category === 'goal' ? 'border-live/40' : 'border-line-strong')}>
          {item.category === 'goal' && <div className="h-[3px] bg-live shadow-[0_0_12px_var(--live)]" />}
          <div className="flex items-start gap-3 p-3.5">
            <CategoryIcon category={item.category} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-[13px] font-bold text-fg">{item.title}</span>
              </div>
              <div className="mt-0.5 line-clamp-2 text-[12px] text-fg-3">{item.body}</div>
              <div className="mt-2 flex items-center gap-2">
                <MatchCrests matchId={item.matchId} size={18} />
                {item.matchId && (
                  <button
                    onClick={() => {
                      markRead(item.id)
                      dismiss(id)
                      navigate(`/match/${item.matchId}`)
                    }}
                    className="ml-auto rounded-lg px-2 py-1 text-[12px] font-bold text-brand-fg hover:bg-surface-3"
                  >
                    View match
                  </button>
                )}
              </div>
              {extra ? (
                <Link to="/notifications" className="mt-2 block text-[11.5px] font-bold text-fg-2 hover:text-fg" onClick={() => dismiss(id)}>
                  +{extra} more in Notifications →
                </Link>
              ) : null}
            </div>
            <button aria-label="Dismiss" onClick={() => dismiss(id)} className="text-fg-3 hover:text-fg">
              <X className="size-4" />
            </button>
          </div>
        </div>
      ))}
    </>
  )
}

/* ───────────── Bell with popover ───────────── */
export function BellMenu() {
  const inbox = useNotify((s) => s.inbox)
  const ringAt = useNotify((s) => s.ringAt)
  const prefs = useNotify((s) => s.prefs)
  const setPrefs = useNotify((s) => s.setPrefs)
  const markAllRead = useNotify((s) => s.markAllRead)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { path } = useRoute()
  const unread = inbox.filter((i) => !i.read).length
  useEffect(() => setOpen(false), [path])
  useEffect(() => {
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <div ref={ref} className="relative">
      <button
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
        onClick={() => (window.innerWidth < 768 ? navigate('/notifications') : setOpen((o) => !o))}
        className="relative inline-flex size-10 items-center justify-center rounded-full border border-line bg-surface-2 text-fg-2 transition-colors hover:border-line-strong hover:text-fg"
      >
        <span key={ringAt} className={ringAt ? 'animate-bell' : ''}>
          {ringAt && Date.now() - ringAt < 2500 ? <BellRing className="size-[18px] text-brand-fg" /> : <Bell className="size-[18px]" />}
        </span>
        {unread > 0 && <span className="num absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white ring-2 ring-bg">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="animate-fade-up absolute right-0 top-[calc(100%+8px)] z-50 w-[380px] overflow-hidden rounded-2xl border border-line-strong bg-surface-1 shadow-pop">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-[14px] font-bold">Notifications</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPrefs({ sound: !prefs.sound })}
                aria-pressed={!prefs.sound}
                title={prefs.sound ? 'Mute notification sounds' : 'Unmute notification sounds'}
                className={cx('flex h-8 items-center gap-1.5 rounded-lg px-2 text-[12px] font-bold transition-colors', prefs.sound ? 'text-fg-2 hover:bg-surface-2' : 'bg-surface-2 text-warn')}
              >
                {prefs.sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />} {prefs.sound ? 'Sound on' : 'Muted'}
              </button>
              <button onClick={markAllRead} className="h-8 rounded-lg px-2 text-[12px] font-bold text-fg-3 hover:bg-surface-2 hover:text-fg">
                Mark all read
              </button>
            </div>
          </div>
          <div className="max-h-[380px] overflow-auto p-1.5">
            {inbox.slice(0, 6).map((i) => (
              <NotificationRow key={i.id} item={i} compact onOpen={() => setOpen(false)} />
            ))}
          </div>
          <div className="flex border-t border-line">
            <Link to="/notifications" onClick={() => setOpen(false)} className="flex-1 py-2.5 text-center text-[12.5px] font-bold text-brand-fg hover:bg-surface-2">
              View all
            </Link>
            <Link to="/settings?section=notifications" onClick={() => setOpen(false)} className="flex flex-1 items-center justify-center gap-1.5 border-l border-line py-2.5 text-[12.5px] font-bold text-fg-2 hover:bg-surface-2">
              <Settings2 className="size-3.5" /> Settings
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

/* ───────────── Prototype event simulator ───────────── */
let run = 0
const EVENTS: { label: string; make: () => NotifyEvent }[] = [
  { label: 'New predictions', make: () => ({ category: 'prediction', title: 'Predictions published for Sunday', body: '8 matches analysed · 2 picks · 3 skipped for insufficient evidence.', dedupeKey: 'pred:2026-11-29:T-24h' }) },
  { label: 'Starting soon', make: () => ({ category: 'kickoff', title: 'Arsenal vs Chelsea kicks off in 30 minutes', body: 'Confirmed line-ups are included in the analysis.', matchId: 'm-pl-ars-che', dedupeKey: 'kickoff:m-pl-ars-che:30' }) },
  { label: 'Going live', make: () => ({ category: 'live', title: 'Arsenal vs Chelsea is live', body: 'Pre-match prediction locked: Arsenal to win (60%).', matchId: 'm-pl-ars-che', dedupeKey: 'live:m-pl-ars-che' }) },
  { label: 'Goal', make: () => ({ category: 'goal', title: 'Goal! Leverkusen 3–0 Freiburg', body: '81′ · Bayer 04 Leverkusen · source OpenLigaDB (near real time).', matchId: 'm-bl1-b04-scf', dedupeKey: 'goal:m-bl1-b04-scf:3-0' }) },
  { label: 'Full time', make: () => ({ category: 'finished', title: 'Full time: Leverkusen 3–0 Freiburg', body: 'Bundesliga · Spieltag 12.', matchId: 'm-bl1-b04-scf', dedupeKey: 'ft:m-bl1-b04-scf' }) },
  { label: 'Settled', make: () => ({ category: 'settled', title: 'Prediction correct: Leverkusen to win', body: 'Leverkusen to win (69%) — correct.', matchId: 'm-bl1-b04-scf', dedupeKey: 'settle:m-bl1-b04-scf:1x2', tone: 'positive' }) },
  { label: 'Goal · unsaved match', make: () => ({ category: 'goal', title: 'Goal! Brighton 2–1 Fulham', body: '71′ · Brighton & Hove Albion.', matchId: 'm-pl-bha-ful', dedupeKey: 'goal:m-pl-bha-ful:2-1' }) },
  { label: 'System notice', make: () => ({ category: 'system', title: 'OpenLigaDB degraded', body: 'Bundesliga live updates may lag by a few minutes.', dedupeKey: 'sys:openligadb:degraded:2026-11-28T16' }) },
]

const OUTCOME_LABEL: Record<LogOutcome, [string, 'success' | 'warn' | 'neutral' | 'info' | 'danger']> = {
  played: ['Sound played', 'success'],
  throttled: ['Throttled', 'warn'],
  locked: ['Blocked until first click', 'warn'],
  duplicate: ['Duplicate suppressed', 'info'],
  merged: ['Merged with full time', 'info'],
  muted: ['Sounds muted', 'neutral'],
  'sound-off': ['Category silent', 'neutral'],
  'quiet-hours': ['Quiet hours', 'neutral'],
  desktop: ['Desktop alert', 'success'],
  'out-of-scope': ['Not in alert scope', 'neutral'],
  'category-off': ['Category off', 'neutral'],
  coalesced: ['Merged into burst', 'info'],
  unsupported: ['Audio unsupported', 'danger'],
  error: ['Error', 'danger'],
}

export function NotificationSimulator() {
  const notify = useNotify((s) => s.notify)
  const log = useNotify((s) => s.log)
  const resetDemo = useNotify((s) => s.resetDemo)
  const [last, setLast] = useState<NotifyEvent | null>(null)
  const fire = (e: NotifyEvent) => {
    setLast(e)
    notify(e)
  }
  const burst = () => {
    run++
    ;[
      { category: 'goal', title: `Goal! Leverkusen 4–0 Freiburg`, body: '86′ · Bayer 04 Leverkusen.', matchId: 'm-bl1-b04-scf', dedupeKey: `burst${run}:goal` },
      { category: 'kickoff', title: 'Real Madrid vs Athletic kicks off in 30 minutes', body: 'Saved match reminder.', matchId: 'm-pd-rma-ath', dedupeKey: `burst${run}:kick` },
      { category: 'prediction', title: 'Predictions published for Monday', body: '3 matches analysed.', dedupeKey: `burst${run}:pred` },
      { category: 'system', title: 'Sync delayed', body: 'GitHub Actions queue is slow; next sync may run late.', dedupeKey: `burst${run}:sys` },
      { category: 'live', title: 'Arsenal vs Chelsea is live', body: 'Saved match · kick-off confirmed.', matchId: 'm-pl-ars-che', dedupeKey: `burst${run}:live` },
    ].forEach((e) => notify(e as NotifyEvent))
  }
  return (
    <Card className="border-dashed !border-warn/30">
      <CardHeader title="Simulate notification events" eyebrow={<span className="inline-flex items-center gap-1.5 text-warn"><FlaskConical className="size-3.5" /> Prototype tool</span>} action={<Button size="sm" variant="ghost" onClick={resetDemo}><RotateCcw className="size-3.5" /> Reset</Button>} />
      <div className="p-5 pt-3">
        <p className="mb-3 text-[12.5px] text-fg-3">Fires realistic events through the real notification rules (scope, de-duplication, merging, throttling, sound per category). In the app these come from the data sync.</p>
        <div className="flex flex-wrap gap-2">
          {EVENTS.map((e) => {
            const ev = e.make()
            return (
              <Button key={e.label} size="sm" variant="outline" onClick={() => fire(ev)}>
                {(() => {
                  const Icon = CAT_ICON[ev.category]
                  return <Icon className="size-3.5" />
                })()}
                {e.label}
              </Button>
            )
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" disabled={!last} onClick={() => last && notify(last)}>
            <RotateCcw className="size-3.5" /> Send same event again
          </Button>
          <Button size="sm" variant="secondary" onClick={burst}>
            <Zap className="size-3.5" /> Burst: 5 events in 1 s
          </Button>
        </div>
        <div className="mt-4">
          <div className="eyebrow mb-2">Delivery log</div>
          {log.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line-strong px-3 py-4 text-center text-[12px] text-fg-3">No events yet.</p>
          ) : (
            <ul className="max-h-56 space-y-1 overflow-auto">
              {log.map((l) => {
                const [label, tone] = OUTCOME_LABEL[l.outcome]
                return (
                  <li key={l.id} className="flex items-center gap-2 rounded-lg bg-surface-2/70 px-2.5 py-1.5 text-[12px]">
                    <CategoryIcon category={l.category} size="sm" />
                    <span className="min-w-0 flex-1 truncate font-semibold text-fg-2">{l.title}</span>
                    <Badge tone={tone}>{label}</Badge>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </Card>
  )
}

/* ───────────── Settings section ───────────── */
export function SoundSettings() {
  const s = useNotify()
  const [playing, setPlaying] = useState<NotifCategory | null>(null)
  const preview = async (c: NotifCategory) => {
    setPlaying(c)
    await s.preview(c)
    setTimeout(() => setPlaying(null), 900)
  }
  const permissionText = {
    granted: ['Allowed', 'success'],
    denied: ['Blocked in browser', 'danger'],
    default: ['Not requested', 'neutral'],
    unsupported: ['Not supported here', 'neutral'],
  } as const
  const [pLabel, pTone] = permissionText[s.permission]
  return (
    <Card className="p-5 lg:col-span-2" as="section">
      <div id="notifications" className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-[15px] font-bold">Notifications & sounds</h2>
          <p className="text-[13px] text-fg-3">Short, original AIDICT sounds. Frequent categories are silent by default.</p>
        </div>
        <Button size="sm" variant="ghost" onClick={s.resetPrefs}>
          <RotateCcw className="size-3.5" /> Restore defaults
        </Button>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="card-inset p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-[13.5px] font-bold">{s.prefs.sound ? <Volume2 className="size-4 text-brand-fg" /> : <VolumeX className="size-4 text-fg-3" />} Notification sounds</span>
            <Switch checked={s.prefs.sound} onChange={(v) => s.setPrefs({ sound: v })} label="Notification sounds" />
          </div>
          <label className="mt-4 block text-[12px] font-semibold text-fg-3" htmlFor="vol">
            Volume <span className="num ml-1 text-[13px] text-fg">{Math.round(s.prefs.volume * 100)}%</span>
          </label>
          <input
            id="vol"
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(s.prefs.volume * 100)}
            disabled={!s.prefs.sound}
            onChange={(e) => s.setPrefs({ volume: Number(e.target.value) / 100 })}
            onPointerUp={() => void s.preview('settled')}
            className="mt-2 w-full accent-[var(--brand)] disabled:opacity-40"
          />
          <p className="mt-2 text-[11.5px] text-fg-3">{s.unlocked ? 'Audio ready.' : 'Browsers allow sound only after you click or press a key on the page — AIDICT waits for that, then plays normally.'}</p>
        </div>

        <div className="card-inset p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13.5px] font-bold">Desktop alerts</span>
            <Badge tone={pTone} dot>{pLabel}</Badge>
          </div>
          <p className="mt-2 text-[12px] text-fg-3">Shown by your operating system when AIDICT is in a background tab. The OS plays its own sound, so AIDICT stays silent to avoid a double alert.</p>
          {s.permission === 'default' && (
            <Button size="sm" variant="outline" className="mt-3" onClick={() => void s.requestPermission()}>
              <BellRing className="size-3.5" /> Allow desktop alerts
            </Button>
          )}
          {s.permission === 'granted' && (
            <div className="mt-3 flex items-center justify-between text-[13px] font-semibold">
              Use desktop alerts <Switch checked={s.prefs.desktop} onChange={(v) => s.setPrefs({ desktop: v })} label="Use desktop alerts" />
            </div>
          )}
          {s.permission === 'denied' && <p className="mt-3 text-[12px] text-danger">Blocked. Re-enable notifications for this site in your browser's site settings.</p>}
          {s.permission === 'unsupported' && <p className="mt-3 text-[12px] text-fg-3">This browser does not support system notifications. In-app alerts still work.</p>}
        </div>

        <div className="card-inset space-y-3 p-4">
          <div>
            <div className="mb-1 text-[12px] font-semibold text-fg-3">Match alerts for</div>
            <Select
              value={s.prefs.scope}
              onChange={(v) => s.setPrefs({ scope: v })}
              options={[
                { value: 'saved', label: 'Saved matches', hint: 'Recommended' },
                { value: 'saved_fav', label: 'Saved + favourite teams' },
                { value: 'all', label: 'All matches', hint: 'Many alerts on busy days' },
              ]}
            />
          </div>
          <div>
            <div className="mb-1 text-[12px] font-semibold text-fg-3">Kick-off reminder</div>
            <Select
              value={String(s.prefs.kickoffLeadMin)}
              onChange={(v) => s.setPrefs({ kickoffLeadMin: Number(v) as 15 | 30 | 60 | 90 })}
              options={[15, 30, 60, 90].map((m) => ({ value: String(m), label: `${m} minutes before` }))}
            />
          </div>
          <div className="flex items-center justify-between gap-3 text-[13px] font-semibold">
            <span>Quiet hours {s.prefs.quietHours.from}–{s.prefs.quietHours.to}</span>
            <Switch checked={s.prefs.quietHours.enabled} onChange={(v) => s.setPrefs({ quietHours: { ...s.prefs.quietHours, enabled: v } })} label="Quiet hours" />
          </div>
        </div>
      </div>

      <div className="scroll-x mt-5">
        <table className="w-full min-w-[620px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-line">
              <th className="eyebrow h-10 pr-3 font-bold">Category</th>
              <th className="eyebrow h-10 w-20 text-center font-bold">In-app</th>
              <th className="eyebrow h-10 w-20 text-center font-bold">Sound</th>
              <th className="eyebrow h-10 w-20 text-center font-bold">Desktop</th>
              <th className="eyebrow h-10 w-24 text-center font-bold">Preview</th>
            </tr>
          </thead>
          <tbody>
            {CATEGORIES.map((c) => {
              const p = s.prefs.categories[c.id]
              return (
                <tr key={c.id} className="border-b border-line last:border-0">
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-3">
                      <CategoryIcon category={c.id} size="sm" />
                      <div>
                        <div className="font-bold text-fg">{c.label}</div>
                        <div className="text-[12px] text-fg-3">{c.description}</div>
                      </div>
                    </div>
                  </td>
                  <td className="text-center"><Switch checked={p.inApp} onChange={(v) => s.setCategory(c.id, { inApp: v })} label={`${c.label} in-app`} /></td>
                  <td className="text-center"><Switch checked={p.sound && p.inApp} disabled={!p.inApp || !s.prefs.sound} onChange={(v) => s.setCategory(c.id, { sound: v })} label={`${c.label} sound`} /></td>
                  <td className="text-center"><Switch checked={p.desktop} disabled={s.permission !== 'granted'} onChange={(v) => s.setCategory(c.id, { desktop: v })} label={`${c.label} desktop`} /></td>
                  <td className="text-center">
                    <button
                      onClick={() => void preview(c.id)}
                      aria-label={`Preview ${c.label} sound`}
                      className={cx('inline-flex h-8 items-center gap-1.5 rounded-[10px] border px-2.5 text-[12px] font-bold transition-colors', playing === c.id ? 'border-brand/50 bg-brand-soft text-brand-fg' : 'border-line text-fg-2 hover:border-line-strong hover:text-fg')}
                    >
                      <Play className={cx('size-3.5', playing === c.id && 'fill-current')} /> Play
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 rounded-xl border border-line bg-surface-2/60 p-3.5 text-[12px] text-fg-3">
        <b className="text-fg-2">Never noisy:</b> the same event never alerts twice · events arriving together play one sound (highest priority) and show at most 3 pop-ups · at most one sound every 1.5 s and 6 per minute · full time and the prediction result for the same match are combined · quiet hours silence sounds but keep the inbox.{' '}
        <Link to="/notifications" className="font-bold text-brand-fg">Try it in Notifications →</Link>
      </div>
    </Card>
  )
}
