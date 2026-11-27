export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

export const pct = (p: number | null | undefined, digits = 0) => (p == null ? '—' : `${(p * 100).toFixed(digits)}%`)
export const fairOdds = (p: number) => (p > 0 ? (1 / p).toFixed(2) : '—')

export function fmt(iso: string, tz: string, opts: Intl.DateTimeFormatOptions) {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone: tz, ...opts }).format(new Date(iso))
  } catch {
    return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...opts }).format(new Date(iso))
  }
}
export const fmtTime = (iso: string, tz: string) => fmt(iso, tz, { hour: '2-digit', minute: '2-digit' })
export const fmtDay = (iso: string, tz: string) => fmt(iso, tz, { weekday: 'short' })
export const fmtDate = (iso: string, tz: string) => fmt(iso, tz, { day: 'numeric', month: 'short' })
export const fmtLong = (iso: string, tz: string) => fmt(iso, tz, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
export const dayKey = (iso: string, tz: string) => {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))
  return p // YYYY-MM-DD in the viewer's time zone
}

export function relTime(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return 'never'
  const m = (now - new Date(iso).getTime()) / 60000
  if (m < 1) return 'just now'
  if (m < 60) return `${Math.round(m)} min ago`
  if (m < 1440) return `${Math.round(m / 60)} h ago`
  return `${Math.round(m / 1440)} d ago`
}

export const FLAG_BY_CODE: Record<string, string> = { PL: 'eng', ELC: 'eng', PD: 'esp', BL1: 'ger', SA: 'ita', FL1: 'fra', DED: 'ned', PPL: 'por', BSA: 'bra', CL: 'eur', EC: 'eur', WC: 'wld' }

export const HORIZON_LABEL: Record<string, string> = { 'T-7d': '7-day preview', 'T-24h': 'day-before prediction', 'T-2h': 'final pre-match update', manual: 'manual run' }
export const horizonLabel = (h: string) => HORIZON_LABEL[h] ?? h

/** Market families for browsing: which kind of question a market answers (not its database category). */
export type MarketFamily = 'goals' | 'corners' | 'combined' | 'order' | 'result'
export const FAMILY_LABEL: Record<MarketFamily, string> = { goals: 'Goals', corners: 'Corners', combined: 'Combinations', order: 'Goal order', result: 'Result & handicaps' }
export function marketFamily(market: string): MarketFamily {
  if (market === 'ou' || market === 'btts') return 'goals'
  if (market.startsWith('corners')) return 'corners'
  if (market.includes('-or-')) return 'combined'
  if (market === 'first-goal' || market.endsWith('-row')) return 'order'
  return 'result'
}
