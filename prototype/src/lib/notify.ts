import { create } from 'zustand'
import { useApp } from './store'
import { NOTIFICATIONS } from '../mock/system'
import { NOW } from '../mock/matches'

/** Prototype clock: the fixed demo time plus real time elapsed since the page loaded. */
const LOADED_AT = Date.now()
export const protoNow = () => new Date(NOW).getTime() + (Date.now() - LOADED_AT)

/* ───────────────────────── Categories & defaults ───────────────────────── */

export type NotifCategory = 'prediction' | 'kickoff' | 'live' | 'goal' | 'finished' | 'settled' | 'system'

export type CategoryDef = {
  id: NotifCategory
  label: string
  description: string
  sound: string
  /** Higher wins when several events arrive together (only one sound plays per burst). */
  priority: number
  /** Minimum gap between two sounds of this category. */
  cooldownMs: number
  matchScoped: boolean
  android: { channelId: string; importance: 'HIGH' | 'DEFAULT' | 'LOW' }
}

export const CATEGORIES: CategoryDef[] = [
  { id: 'prediction', label: 'New prediction available', description: 'Snapshots published (T-24h / T-2h). Batched into one alert per run.', sound: 'new-prediction.wav', priority: 1, cooldownMs: 60_000, matchScoped: false, android: { channelId: 'aidict.predictions.v1', importance: 'LOW' } },
  { id: 'kickoff', label: 'Match starting soon', description: 'Reminder before kick-off for matches in your alert scope.', sound: 'kickoff-soon.wav', priority: 4, cooldownMs: 10_000, matchScoped: true, android: { channelId: 'aidict.kickoff.v1', importance: 'HIGH' } },
  { id: 'live', label: 'Match going live', description: 'Kick-off confirmed by the data provider.', sound: 'match-live.wav', priority: 3, cooldownMs: 10_000, matchScoped: true, android: { channelId: 'aidict.live.v1', importance: 'DEFAULT' } },
  { id: 'goal', label: 'Goal scored', description: 'Score change in a match you follow. Delay depends on the source.', sound: 'goal.wav', priority: 6, cooldownMs: 4_000, matchScoped: true, android: { channelId: 'aidict.goals.v1', importance: 'HIGH' } },
  { id: 'finished', label: 'Match finished', description: 'Final whistle. Combined with the settlement when both arrive together.', sound: 'match-finished.wav', priority: 4, cooldownMs: 10_000, matchScoped: true, android: { channelId: 'aidict.results.v1', importance: 'DEFAULT' } },
  { id: 'settled', label: 'Prediction result settled', description: 'A published prediction was marked correct, incorrect or void.', sound: 'prediction-settled.wav', priority: 5, cooldownMs: 10_000, matchScoped: false, android: { channelId: 'aidict.settlement.v1', importance: 'DEFAULT' } },
  { id: 'system', label: 'Important system notices', description: 'Provider outages, disabled markets, data conflicts that affect you.', sound: 'system-alert.wav', priority: 2, cooldownMs: 30_000, matchScoped: false, android: { channelId: 'aidict.system.v1', importance: 'DEFAULT' } },
]
export const catDef = (id: NotifCategory) => CATEGORIES.find((c) => c.id === id)!

export type CategoryPrefs = { inApp: boolean; sound: boolean; desktop: boolean }
export type NotifPrefs = {
  sound: boolean
  volume: number
  desktop: boolean
  scope: 'saved' | 'saved_fav' | 'all'
  kickoffLeadMin: 15 | 30 | 60 | 90
  quietHours: { enabled: boolean; from: string; to: string }
  categories: Record<NotifCategory, CategoryPrefs>
}

/** Sensible defaults: frequent categories are silent, match alerts only for saved matches, quiet hours available. */
export const DEFAULT_PREFS: NotifPrefs = {
  sound: true,
  volume: 0.6,
  desktop: false,
  scope: 'saved',
  kickoffLeadMin: 30,
  quietHours: { enabled: false, from: '23:00', to: '07:00' },
  categories: {
    prediction: { inApp: true, sound: false, desktop: false },
    kickoff: { inApp: true, sound: true, desktop: true },
    live: { inApp: true, sound: false, desktop: false },
    goal: { inApp: true, sound: true, desktop: true },
    finished: { inApp: true, sound: true, desktop: false },
    settled: { inApp: true, sound: true, desktop: false },
    system: { inApp: true, sound: true, desktop: true },
  },
}

/** Anti-spam limits applied to every non-preview sound. */
export const LIMITS = { minGapMs: 1500, maxPerMinute: 6, burstWindowMs: 600, mergeFinishSettleMs: 120_000, maxToastsPerBurst: 3 }

/* ───────────────────────── Persistence (per-viewer convenience) ───────────────────────── */

const KEY = 'aidict.notifications.v1'
function loadPrefs(): NotifPrefs {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_PREFS
    const p = JSON.parse(raw) as Partial<NotifPrefs>
    return { ...DEFAULT_PREFS, ...p, quietHours: { ...DEFAULT_PREFS.quietHours, ...p.quietHours }, categories: { ...DEFAULT_PREFS.categories, ...p.categories } }
  } catch {
    return DEFAULT_PREFS
  }
}
function savePrefs(p: NotifPrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    /* storage unavailable — settings still apply for this session */
  }
}

/* ───────────────────────── Sound engine ───────────────────────── */

export type SoundOutcome = 'played' | 'locked' | 'throttled' | 'unsupported' | 'error'

class SoundEngine {
  private ctx: AudioContext | null = null
  private buffers = new Map<string, Promise<AudioBuffer>>()
  private lastAt = 0
  private lastByCat = new Map<string, number>()
  private recent: number[] = []
  unlocked = false
  supported = typeof window !== 'undefined' && Boolean(window.AudioContext || (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext)

  /** Browsers block audio until the user interacts with the page; unlock on the first gesture. */
  init(onUnlock: () => void) {
    if (!this.supported) return
    const unlock = () => {
      void this.unlock().then(onUnlock)
      ;['pointerdown', 'keydown', 'touchstart'].forEach((e) => window.removeEventListener(e, unlock))
    }
    ;['pointerdown', 'keydown', 'touchstart'].forEach((e) => window.addEventListener(e, unlock, { passive: true }))
  }

  private async unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new AC()
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume()
    this.unlocked = this.ctx.state === 'running'
    if (this.unlocked) CATEGORIES.forEach((c) => void this.buffer(c.sound))
  }

  private buffer(file: string) {
    let b = this.buffers.get(file)
    if (!b) {
      b = fetch(`./sounds/${file}`)
        .then((r) => r.arrayBuffer())
        .then((a) => this.ctx!.decodeAudioData(a))
      this.buffers.set(file, b)
    }
    return b
  }

  async play(cat: NotifCategory, volume: number, preview = false): Promise<SoundOutcome> {
    if (!this.supported) return 'unsupported'
    if (!this.unlocked || !this.ctx) return 'locked'
    const now = Date.now()
    if (!preview) {
      this.recent = this.recent.filter((t) => now - t < 60_000)
      const lastCat = this.lastByCat.get(cat) ?? 0
      if (now - this.lastAt < LIMITS.minGapMs || now - lastCat < catDef(cat).cooldownMs || this.recent.length >= LIMITS.maxPerMinute) return 'throttled'
      this.lastAt = now
      this.lastByCat.set(cat, now)
      this.recent.push(now)
    }
    try {
      const buf = await this.buffer(catDef(cat).sound)
      const src = this.ctx.createBufferSource()
      const gain = this.ctx.createGain()
      gain.gain.value = Math.max(0, Math.min(1, volume))
      src.buffer = buf
      src.connect(gain).connect(this.ctx.destination)
      src.start()
      return 'played'
    } catch {
      return 'error'
    }
  }

  resetLimits() {
    this.lastAt = 0
    this.lastByCat.clear()
    this.recent = []
  }
}

export const soundEngine = new SoundEngine()

/* ───────────────────────── Notification centre ───────────────────────── */

export type NotifyEvent = { category: NotifCategory; title: string; body: string; matchId?: string; dedupeKey: string; tone?: 'positive' | 'negative' }
export type InboxItem = NotifyEvent & { id: string; at: string; read: boolean; merged?: boolean }
export type LogOutcome = 'played' | 'throttled' | 'locked' | 'duplicate' | 'merged' | 'muted' | 'sound-off' | 'quiet-hours' | 'desktop' | 'out-of-scope' | 'category-off' | 'coalesced' | 'unsupported' | 'error'
export type LogEntry = { id: number; at: number; title: string; category: NotifCategory; outcome: LogOutcome }
export type NotifToast = { id: string; item: InboxItem; extra?: number }
export type Permission = NotificationPermission | 'unsupported'

const KIND_TO_CAT: Record<string, NotifCategory> = { prediction: 'prediction', kickoff: 'kickoff', provider: 'system', result: 'settled', model: 'system', conflict: 'system' }

type NotifyState = {
  prefs: NotifPrefs
  inbox: InboxItem[]
  log: LogEntry[]
  toasts: NotifToast[]
  unlocked: boolean
  permission: Permission
  ringAt: number
  setPrefs: (p: Partial<NotifPrefs>) => void
  setCategory: (c: NotifCategory, p: Partial<CategoryPrefs>) => void
  resetPrefs: () => void
  notify: (e: NotifyEvent) => void
  preview: (c: NotifCategory) => Promise<SoundOutcome>
  markRead: (id: string) => void
  markAllRead: () => void
  dismissToast: (id: string) => void
  requestPermission: () => Promise<void>
  resetDemo: () => void
}

const seen = new Set<string>()
let pending: InboxItem[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null
let logId = 0

function inQuietHours(q: NotifPrefs['quietHours'], d = new Date()) {
  if (!q.enabled) return false
  const m = d.getHours() * 60 + d.getMinutes()
  const [fh, fm] = q.from.split(':').map(Number)
  const [th, tm] = q.to.split(':').map(Number)
  const from = fh * 60 + fm
  const to = th * 60 + tm
  return from <= to ? m >= from && m < to : m >= from || m < to
}

const initialPermission = (): Permission => (typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported')

export const useNotify = create<NotifyState>((set, get) => {
  const log = (title: string, category: NotifCategory, outcome: LogOutcome) => set({ log: [{ id: ++logId, at: Date.now(), title, category, outcome }, ...get().log].slice(0, 40) })

  const flush = async () => {
    flushTimer = null
    const batch = pending
    pending = []
    if (!batch.length) return
    const { prefs, permission } = get()
    const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden'

    // Desktop (OS) notifications only when the page is hidden; the OS plays its own sound, so AIDICT stays silent.
    if (hidden && prefs.desktop && permission === 'granted') {
      batch.filter((i) => prefs.categories[i.category].desktop).slice(0, LIMITS.maxToastsPerBurst).forEach((i) => {
        try {
          new Notification(i.title, { body: i.body, tag: i.dedupeKey, icon: './brand/aidict-icon.png' })
          log(i.title, i.category, 'desktop')
        } catch {
          log(i.title, i.category, 'error')
        }
      })
      return
    }

    // In-app toasts: at most 3 per burst, the rest summarised.
    const shown = batch.slice(0, LIMITS.maxToastsPerBurst)
    const extra = batch.length - shown.length
    set({ toasts: [...get().toasts, ...shown.map((item, i) => ({ id: item.id, item, extra: i === shown.length - 1 && extra > 0 ? extra : undefined }))].slice(-4) })
    shown.forEach((i) => setTimeout(() => get().dismissToast(i.id), 6500))

    // One sound per burst: the highest-priority category that has sound enabled.
    const candidates = batch.filter((i) => prefs.categories[i.category].sound).sort((a, b) => catDef(b.category).priority - catDef(a.category).priority)
    batch.forEach((i) => {
      if (!prefs.categories[i.category].sound) log(i.title, i.category, 'sound-off')
      else if (candidates[0] && i !== candidates[0]) log(i.title, i.category, 'coalesced')
    })
    const top = candidates[0]
    if (!top) return
    if (!prefs.sound || prefs.volume === 0) return log(top.title, top.category, 'muted')
    if (inQuietHours(prefs.quietHours)) return log(top.title, top.category, 'quiet-hours')
    const outcome = await soundEngine.play(top.category, prefs.volume)
    log(top.title, top.category, outcome)
  }

  return {
    prefs: loadPrefs(),
    inbox: NOTIFICATIONS.map((n) => ({ id: n.id, category: KIND_TO_CAT[n.kind], title: n.title, body: n.body, matchId: n.matchId, dedupeKey: `seed:${n.id}`, at: n.at, read: false })),
    log: [],
    toasts: [],
    unlocked: false,
    permission: initialPermission(),
    ringAt: 0,

    setPrefs: (p) => {
      const prefs = { ...get().prefs, ...p }
      set({ prefs })
      savePrefs(prefs)
    },
    setCategory: (c, p) => {
      const prefs = { ...get().prefs, categories: { ...get().prefs.categories, [c]: { ...get().prefs.categories[c], ...p } } }
      set({ prefs })
      savePrefs(prefs)
    },
    resetPrefs: () => {
      set({ prefs: DEFAULT_PREFS })
      savePrefs(DEFAULT_PREFS)
    },

    notify: (e) => {
      const { prefs } = get()
      const def = catDef(e.category)
      // 1 · Never alert twice for the same real-world event.
      if (seen.has(e.dedupeKey)) return log(e.title, e.category, 'duplicate')
      seen.add(e.dedupeKey)
      // 2 · Match alerts only for matches in the user's scope (saved by default).
      if (def.matchScoped && e.matchId && prefs.scope !== 'all' && !useApp.getState().saved.includes(e.matchId)) return log(e.title, e.category, 'out-of-scope')
      // 3 · Category switched off for in-app.
      if (!prefs.categories[e.category].inApp) return log(e.title, e.category, 'category-off')
      // 4 · Full-time + settlement for the same match → one combined notification, no second sound.
      if (e.category === 'settled' && e.matchId) {
        const ft = get().inbox.find((i) => i.category === 'finished' && i.matchId === e.matchId && protoNow() - new Date(i.at).getTime() < LIMITS.mergeFinishSettleMs)
        if (ft) {
          set({ inbox: get().inbox.map((i) => (i.id === ft.id ? { ...i, title: `${i.title} · prediction settled`, body: `${i.body} ${e.body}`, merged: true, read: false, tone: e.tone } : i)) })
          return log(e.title, e.category, 'merged')
        }
      }
      const item: InboxItem = { ...e, id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, at: new Date(protoNow()).toISOString(), read: false }
      set({ inbox: [item, ...get().inbox], ringAt: Date.now() })
      // 5 · Coalesce bursts: events within 600 ms produce one sound and at most 3 toasts.
      pending.push(item)
      if (!flushTimer) flushTimer = setTimeout(() => void flush(), LIMITS.burstWindowMs)
    },

    preview: async (c) => {
      const outcome = await soundEngine.play(c, get().prefs.volume || 0.6, true)
      if (outcome === 'locked') set({ unlocked: false })
      return outcome
    },
    markRead: (id) => set({ inbox: get().inbox.map((i) => (i.id === id ? { ...i, read: true } : i)) }),
    markAllRead: () => set({ inbox: get().inbox.map((i) => ({ ...i, read: true })) }),
    dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
    requestPermission: async () => {
      if (!('Notification' in window)) return set({ permission: 'unsupported' })
      // Only ever called from an explicit button press — never on page load.
      const p = await Notification.requestPermission()
      set({ permission: p })
      if (p === 'granted') get().setPrefs({ desktop: true })
    },
    resetDemo: () => {
      seen.clear()
      soundEngine.resetLimits()
      set({ log: [] })
    },
  }
})

soundEngine.init(() => useNotify.setState({ unlocked: soundEngine.unlocked }))
