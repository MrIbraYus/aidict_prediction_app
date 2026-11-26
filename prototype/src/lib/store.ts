import { create } from 'zustand'

export type ViewState = 'default' | 'loading' | 'empty' | 'error'
export type Theme = 'dark' | 'light' | 'system'
export type Leg = { matchId: string; market: string; selection: string }
export type Toast = { id: number; tone: 'success' | 'info' | 'error'; title: string; body?: string }

type AppState = {
  authed: boolean
  theme: Theme
  oddsFormat: 'decimal' | 'fractional' | 'american'
  probabilityFormat: 'percent' | 'decimal'
  timeZone: string
  viewState: ViewState
  sidebarCollapsed: boolean
  saved: string[]
  legs: Leg[]
  readNotifications: string[]
  toasts: Toast[]
  hideValue: boolean
  set: (p: Partial<AppState>) => void
  toggleSaved: (id: string) => void
  addLeg: (leg: Leg) => void
  removeLeg: (matchId: string) => void
  updateLeg: (matchId: string, p: Partial<Leg>) => void
  toast: (t: Omit<Toast, 'id'>) => void
  dismissToast: (id: number) => void
}

let toastId = 0

export const useApp = create<AppState>((set, get) => ({
  authed: true,
  theme: 'dark',
  oddsFormat: 'decimal',
  probabilityFormat: 'percent',
  timeZone: 'UTC (GMT+0)',
  viewState: 'default',
  sidebarCollapsed: false,
  saved: ['m-pl-ars-che', 'm-bl1-b04-scf', 'm-pd-rma-ath', 'm-cl-bay-psg'],
  legs: [
    { matchId: 'm-pl-ars-che', market: '1x2', selection: 'home' },
    { matchId: 'm-bl1-bay-sge', market: '1x2', selection: 'home' },
    { matchId: 'm-sa-int-nap', market: 'ou25', selection: 'under' },
  ],
  readNotifications: [],
  toasts: [],
  hideValue: false,
  set: (p) => set(p),
  toggleSaved: (id) => {
    const on = get().saved.includes(id)
    set({ saved: on ? get().saved.filter((x) => x !== id) : [...get().saved, id] })
    get().toast({ tone: on ? 'info' : 'success', title: on ? 'Removed from saved' : 'Match saved', body: on ? undefined : 'You will be notified before kickoff.' })
  },
  addLeg: (leg) => {
    if (get().legs.some((l) => l.matchId === leg.matchId)) {
      get().toast({ tone: 'info', title: 'Already in analysis', body: 'One selection per match — legs from the same match are correlated.' })
      return
    }
    set({ legs: [...get().legs, leg] })
    get().toast({ tone: 'success', title: 'Added to Multi-Match Analysis' })
  },
  removeLeg: (matchId) => set({ legs: get().legs.filter((l) => l.matchId !== matchId) }),
  updateLeg: (matchId, p) => set({ legs: get().legs.map((l) => (l.matchId === matchId ? { ...l, ...p } : l)) }),
  toast: (t) => {
    const id = ++toastId
    set({ toasts: [...get().toasts, { ...t, id }] })
    setTimeout(() => get().dismissToast(id), 3800)
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}))
