/**
 * ⚠ DESIGN PROTOTYPE SAMPLE DATA — NOT REAL PERFORMANCE.
 * The production app shows only genuinely recorded predictions and outcomes (no simulated performance).
 */
import { oneXTwo, rng, scoreMatrix } from '../lib/probability'
import { COMPETITIONS, TEAMS } from './teams'

export type HistoryRow = {
  id: string
  date: string
  compId: string
  homeId: string
  awayId: string
  market: string
  selection: string
  p: number
  result: 'won' | 'lost' | 'void' | 'pending'
  score?: string
  brier?: number
  model: string
  snapshotAt: string
}

const MARKET_LABEL: Record<string, string> = { '1x2': 'Full-time result', ou25: 'Over/Under 2.5', btts: 'BTTS', dc: 'Double Chance', corners: 'Corners – Over/Under', first: '1st Goal', combo: 'Home Team or Over 2.5', ou15: 'Over/Under 1.5' }

export const HISTORY: HistoryRow[] = (() => {
  const r = rng(77)
  const rows: HistoryRow[] = []
  const comps = ['pl', 'pd', 'bl1', 'sa', 'fl1']
  for (let i = 0; i < 64; i++) {
    const compId = comps[i % comps.length]
    const pool = TEAMS.filter((t) => t.compId === compId)
    const h = pool[Math.floor(r() * pool.length)]
    let a = pool[Math.floor(r() * pool.length)]
    if (a.id === h.id) a = pool[(pool.indexOf(h) + 1) % pool.length]
    const diff = h.elo - a.elo + 62
    const lh = 1.42 * Math.exp(diff / 560)
    const la = 1.14 * Math.exp(-diff / 560)
    const mtx = scoreMatrix(lh, la)
    const x = oneXTwo(mtx)
    // sample a score from the matrix
    let u = r()
    let gh = 0
    let ga = 0
    outer: for (let hh = 0; hh < mtx.length; hh++) for (let aa = 0; aa < mtx.length; aa++) {
      u -= mtx[hh][aa]
      if (u <= 0) { gh = hh; ga = aa; break outer }
    }
    const kind = i % 4 === 0 ? 'ou25' : i % 7 === 0 ? 'btts' : i % 5 === 0 ? 'dc' : i % 6 === 0 ? 'corners' : i % 9 === 0 ? 'first' : i % 11 === 0 ? 'combo' : i % 13 === 0 ? 'ou15' : '1x2'
    let selection = ''
    let p = 0
    let won = false
    if (kind === '1x2') {
      const sel = x.home >= x.away ? 'home' : 'away'
      selection = sel === 'home' ? `${h.short} win` : `${a.short} win`
      p = sel === 'home' ? x.home : x.away
      won = sel === 'home' ? gh > ga : ga > gh
    } else if (kind === 'ou25') {
      let o = 0
      for (let hh = 0; hh < mtx.length; hh++) for (let aa = 0; aa < mtx.length; aa++) if (hh + aa > 2.5) o += mtx[hh][aa]
      selection = o >= 0.5 ? 'Over 2.5' : 'Under 2.5'
      p = o >= 0.5 ? o : 1 - o
      won = o >= 0.5 ? gh + ga > 2 : gh + ga < 3
    } else if (kind === 'dc') {
      selection = x.home >= x.away ? `${h.short} or draw` : `Draw or ${a.short}`
      p = x.home >= x.away ? x.home + x.draw : x.away + x.draw
      won = x.home >= x.away ? gh >= ga : ga >= gh
    } else if (kind === 'corners') {
      const total = Math.round(9.6 + (r() - 0.5) * 9)
      selection = 'Over 8.5 corners'
      p = 0.62 + r() * 0.14
      won = total > 8.5
    } else if (kind === 'first') {
      selection = `${h.short} to score first`
      p = gh + ga === 0 ? 0.55 : 0.5 + (x.home - x.away) * 0.5
      won = gh + ga > 0 && r() < gh / (gh + ga)
    } else if (kind === 'combo') {
      let q = 0
      for (let hh = 0; hh < mtx.length; hh++) for (let aa = 0; aa < mtx.length; aa++) if (hh > aa || hh + aa > 2.5) q += mtx[hh][aa]
      selection = `${h.short} or Over 2.5`
      p = q
      won = gh > ga || gh + ga > 2
    } else if (kind === 'ou15') {
      let q = 0
      for (let hh = 0; hh < mtx.length; hh++) for (let aa = 0; aa < mtx.length; aa++) if (hh + aa > 1.5) q += mtx[hh][aa]
      selection = 'Over 1.5 goals'
      p = q
      won = gh + ga > 1
    } else {
      let b = 0
      for (let hh = 1; hh < mtx.length; hh++) for (let aa = 1; aa < mtx.length; aa++) b += mtx[hh][aa]
      selection = b >= 0.5 ? 'BTTS — Yes' : 'BTTS — No'
      p = b >= 0.5 ? b : 1 - b
      won = b >= 0.5 ? gh > 0 && ga > 0 : !(gh > 0 && ga > 0)
    }
    const day = 27 - Math.floor(i / 3)
    const date = new Date(Date.UTC(2026, 10, day, 15 + (i % 4) * 2, 0)).toISOString()
    rows.push({
      id: `pred-${1000 + i}`,
      date,
      compId,
      homeId: h.id,
      awayId: a.id,
      market: MARKET_LABEL[kind],
      selection,
      p,
      result: i === 5 ? 'void' : won ? 'won' : 'lost',
      score: `${gh}–${ga}`,
      brier: i === 5 ? undefined : +((won ? 1 - p : p) ** 2).toFixed(3),
      model: i > 40 ? 'football-dc 1.2.1' : 'football-dc 1.3.0',
      snapshotAt: new Date(new Date(date).getTime() - 24 * 3600e3).toISOString(),
    })
  }
  return rows
})()

export const KPIS = {
  total: 1418,
  settled: 1284,
  pending: 134,
  accuracy: { value: 0.524, ci: [0.496, 0.551] as [number, number], label: '1X2 top-outcome hit rate' },
  brier: { value: 0.583, baseline: 0.655, market: 0.57 },
  logLoss: { value: 0.987, baseline: 1.071, market: 0.968 },
  rps: { value: 0.199, baseline: 0.224, market: 0.195 },
  ece: { value: 0.019 },
  since: '2026-08-15',
}

export const BRIER_TREND = Array.from({ length: 15 }, (_, i) => {
  const r = rng(300 + i)
  return {
    week: `W${i + 1}`,
    model: +(0.6 - i * 0.0012 + (r() - 0.5) * 0.03).toFixed(3),
    baseline: +(0.655 + (r() - 0.5) * 0.012).toFixed(3),
    market: +(0.572 + (r() - 0.5) * 0.02).toFixed(3),
  }
})

export const CALIBRATION = [0.05, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85].map((p, i) => {
  const r = rng(900 + i)
  const n = Math.round(80 + Math.sin(i / 2.6) * 170 + 140)
  const observed = Math.min(0.98, Math.max(0.02, p + (r() - 0.5) * 0.05))
  const se = Math.sqrt((observed * (1 - observed)) / n)
  const lo = +(observed - 1.96 * se).toFixed(3)
  const hi = +(observed + 1.96 * se).toFixed(3)
  return { predicted: p, observed: +observed.toFixed(3), n, lo, hi, err: [+(observed - lo).toFixed(3), +(hi - observed).toFixed(3)] as [number, number] }
})

export const BY_MARKET = [
  { market: 'Full-time result (1X2)', n: 1284, accuracy: 0.524, brier: 0.583, logLoss: 0.987, ece: 0.019, status: 'active' as const },
  { market: 'Over / Under 2.5', n: 1284, accuracy: 0.561, brier: 0.241, logLoss: 0.676, ece: 0.017, status: 'active' as const },
  { market: 'Both teams to score', n: 1284, accuracy: 0.548, brier: 0.246, logLoss: 0.685, ece: 0.022, status: 'active' as const },
  { market: 'Double chance', n: 1284, accuracy: 0.771, brier: 0.168, logLoss: 0.51, ece: 0.018, status: 'active' as const },
  { market: 'Draw no bet', n: 948, accuracy: 0.664, brier: 0.214, logLoss: 0.617, ece: 0.021, status: 'active' as const },
  { market: 'Correct score', n: 1284, accuracy: 0.118, brier: null, logLoss: 2.86, ece: 0.006, status: 'active' as const },
  { market: 'Asian handicap', n: 412, accuracy: 0.533, brier: 0.247, logLoss: 0.689, ece: 0.041, status: 'validating' as const },
  { market: 'Half-time result', n: 0, accuracy: null, brier: null, logLoss: null, ece: null, status: 'validating' as const },
  { market: 'HT / FT', n: 0, accuracy: null, brier: null, logLoss: null, ece: null, status: 'disabled' as const },
]

export const BY_COMPETITION = COMPETITIONS.filter((c) => c.modelStatus !== 'disabled').map((c, i) => {
  const r = rng(500 + i)
  const n = c.modelStatus === 'active' ? 160 + Math.floor(r() * 140) : Math.floor(30 + r() * 40)
  return { comp: c, n, accuracy: +(0.49 + r() * 0.07).toFixed(3), brier: +(0.57 + r() * 0.03).toFixed(3), logLoss: +(0.96 + r() * 0.06).toFixed(3), ece: +(0.012 + r() * (c.modelStatus === 'active' ? 0.018 : 0.04)).toFixed(3) }
})

export const BACKTEST = {
  window: '2016-17 → 2025-26 · walk-forward by matchweek',
  n: 31482,
  models: [
    { name: 'Base rate', brier: 0.655, logLoss: 1.071, rps: 0.224, ece: 0.003 },
    { name: 'Elo', brier: 0.598, logLoss: 1.006, rps: 0.205, ece: 0.024 },
    { name: 'Poisson', brier: 0.591, logLoss: 0.997, rps: 0.203, ece: 0.021 },
    { name: 'Dixon–Coles', brier: 0.586, logLoss: 0.991, rps: 0.201, ece: 0.014 },
    { name: 'Logistic regression', brier: 0.588, logLoss: 0.994, rps: 0.202, ece: 0.017 },
    { name: 'LightGBM', brier: 0.592, logLoss: 1.002, rps: 0.203, ece: 0.031 },
    { name: 'Market (closing, margin removed)', brier: 0.572, logLoss: 0.97, rps: 0.196, ece: 0.012 },
  ],
}

/** Weekly live tracking for one market (sample): mean predicted probability vs observed hit rate. */
export function marketTrend(marketId: string) {
  const seed = [...marketId].reduce((a, c) => a + c.charCodeAt(0), 0)
  return Array.from({ length: 15 }, (_, i) => {
    const r = rng(seed * 31 + i)
    const n = 18 + Math.floor(r() * 22)
    const predicted = 0.66 + (r() - 0.5) * 0.08
    const observed = Math.min(0.98, Math.max(0.3, predicted + (r() - 0.5) * (1.6 / Math.sqrt(n))))
    return { week: `W${i + 1}`, predicted: +(predicted * 100).toFixed(1), observed: +(observed * 100).toFixed(1), n }
  })
}
