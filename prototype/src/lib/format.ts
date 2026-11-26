import { useApp } from './store'

export const pct = (p: number, digits = 0) => `${(p * 100).toFixed(digits)}%`
export const fairOdds = (p: number) => (p > 0 ? (1 / p).toFixed(2) : '—')

export function useProb() {
  const fmt = useApp((s) => s.probabilityFormat)
  return (p: number, digits = 0) => (fmt === 'decimal' ? p.toFixed(digits + 2) : pct(p, digits))
}

export function useOdds() {
  const fmt = useApp((s) => s.oddsFormat)
  return (decimal: number) => {
    if (fmt === 'decimal') return decimal.toFixed(2)
    if (fmt === 'american') return decimal >= 2 ? `+${Math.round((decimal - 1) * 100)}` : `${Math.round(-100 / (decimal - 1))}`
    // fractional (approx.)
    const f = decimal - 1
    const den = [1, 2, 4, 5, 8, 10, 20].find((d) => Math.abs(f * d - Math.round(f * d)) < 0.06) ?? 100
    return `${Math.round(f * den)}/${den}`
  }
}

const DAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' })
const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const TIME = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
const LONG = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

export const fmtDay = (iso: string) => DAY.format(new Date(iso))
export const fmtDate = (iso: string) => DATE.format(new Date(iso))
export const fmtTime = (iso: string) => TIME.format(new Date(iso))
export const fmtLong = (iso: string) => LONG.format(new Date(iso))
export const dayKey = (iso: string) => iso.slice(0, 10)

export function relTime(iso: string, nowIso: string) {
  const diff = (new Date(nowIso).getTime() - new Date(iso).getTime()) / 60000
  if (diff < 1) return 'just now'
  if (diff < 60) return `${Math.round(diff)} min ago`
  if (diff < 60 * 24) return `${Math.round(diff / 60)} h ago`
  return `${Math.round(diff / 1440)} d ago`
}

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')
