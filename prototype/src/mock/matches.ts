/**
 * ⚠ DESIGN PROTOTYPE SAMPLE DATA — NOT REAL FIXTURES OR PREDICTIONS.
 * Fixtures, scores, odds and model outputs are illustrative. Probabilities are generated from sample
 * ratings through the same Dixon–Coles maths the real engine will use, so the numbers are coherent,
 * but they are NOT predictions of real events.
 */
import { asianHalf, btts, clamp, oneXTwo, overLine, rng, scoreMatrix, teamOver, topScores, type Matrix } from '../lib/probability'
import { compById, teamById, type Team } from './teams'

/** Prototype clock — every relative time in the prototype is computed from this instant. */
export const NOW = '2026-11-28T16:05:00Z'

export type MatchStatus = 'SCHEDULED' | 'LIVE' | 'HT' | 'FT'

export type Match = {
  id: string
  compId: string
  homeId: string
  awayId: string
  kickoff: string
  status: MatchStatus
  minute?: string
  score?: [number, number]
  ht?: [number, number]
  featured?: boolean
  lineups?: boolean
  odds?: { home: number; draw: number; away: number; over25: number; under25: number; bttsYes: number; bttsNo: number; source: string; capturedAt: string }
  completeness: number
  skip?: string
  conflict?: string
}

const m = (id: string, compId: string, homeId: string, awayId: string, kickoff: string, extra: Partial<Match> = {}): Match => ({
  id, compId, homeId, awayId, kickoff, status: 'SCHEDULED', completeness: 0.95, ...extra,
})

export const MATCHES: Match[] = [
  // Fri 27 Nov
  m('m-bl1-m05-rbl', 'bl1', 'm05', 'rbl', '2026-11-27T19:30:00Z', { status: 'FT', score: [0, 2], ht: [0, 1], completeness: 0.96 }),
  // Sat 28 Nov — prototype "today"
  m('m-pl-new-avl', 'pl', 'new', 'avl', '2026-11-28T12:30:00Z', { status: 'FT', score: [2, 1], ht: [1, 0], completeness: 0.97 }),
  m('m-pd-get-val', 'pd', 'get', 'val', '2026-11-28T13:00:00Z', { status: 'FT', score: [0, 0], ht: [0, 0], completeness: 0.94 }),
  m('m-sa-ata-bol', 'sa', 'ata', 'bol', '2026-11-28T14:00:00Z', { status: 'FT', score: [1, 0], ht: [0, 0], completeness: 0.95 }),
  m('m-bl1-b04-scf', 'bl1', 'b04', 'scf', '2026-11-28T14:30:00Z', { status: 'LIVE', minute: '78', score: [2, 0], ht: [1, 0], completeness: 0.97 }),
  m('m-bl1-vfb-bvb', 'bl1', 'vfb', 'bvb', '2026-11-28T14:30:00Z', { status: 'LIVE', minute: '78', score: [1, 2], ht: [1, 1], completeness: 0.97 }),
  m('m-pl-bha-ful', 'pl', 'bha', 'ful', '2026-11-28T15:00:00Z', { status: 'LIVE', minute: '62', score: [1, 1], ht: [0, 1], completeness: 0.96 }),
  m('m-pl-bre-eve', 'pl', 'bre', 'eve', '2026-11-28T15:00:00Z', { status: 'LIVE', minute: '62', score: [0, 1], ht: [0, 0], completeness: 0.96 }),
  m('m-pl-wol-nfo', 'pl', 'wol', 'nfo', '2026-11-28T15:00:00Z', { status: 'LIVE', minute: '62', score: [0, 0], ht: [0, 0], completeness: 0.93 }),
  m('m-pd-sev-vil', 'pd', 'sev', 'vil', '2026-11-28T15:15:00Z', { status: 'HT', minute: 'HT', score: [0, 1], ht: [0, 1], completeness: 0.94 }),
  m('m-sa-int-nap', 'sa', 'int', 'nap', '2026-11-28T17:00:00Z', { completeness: 0.97, odds: { home: 2.05, draw: 3.4, away: 3.75, over25: 2.1, under25: 1.78, bttsYes: 1.95, bttsNo: 1.88, source: 'football-data.co.uk · fixtures', capturedAt: '2026-11-28T09:10:00Z' } }),
  m('m-pl-ars-che', 'pl', 'ars', 'che', '2026-11-28T17:30:00Z', { featured: true, lineups: true, completeness: 0.98, odds: { home: 1.72, draw: 3.9, away: 4.75, over25: 1.95, under25: 1.9, bttsYes: 1.95, bttsNo: 1.9, source: 'football-data.co.uk · fixtures', capturedAt: '2026-11-28T09:10:00Z' } }),
  m('m-bl1-bay-sge', 'bl1', 'bay', 'sge', '2026-11-28T17:30:00Z', { completeness: 0.97, odds: { home: 1.33, draw: 5.75, away: 8.5, over25: 1.36, under25: 3.2, bttsYes: 1.62, bttsNo: 2.3, source: 'football-data.co.uk · fixtures', capturedAt: '2026-11-28T09:10:00Z' } }),
  m('m-pd-rma-ath', 'pd', 'rma', 'ath', '2026-11-28T17:30:00Z', { completeness: 0.96 }),
  m('m-fl1-ol-om', 'fl1', 'ol', 'om', '2026-11-28T18:00:00Z', { completeness: 0.92, skip: 'Model disagreement: 15 pp spread between Dixon–Coles and LightGBM on the home win.' }),
  m('m-ded-psv-fey', 'ded', 'psv', 'fey', '2026-11-28T18:45:00Z', { completeness: 0.84, skip: 'Eredivisie markets still validating (184 of 300 out-of-sample predictions).' }),
  m('m-sa-juv-rom', 'sa', 'juv', 'rom', '2026-11-28T19:45:00Z', { completeness: 0.89, conflict: 'Roma’s previous result differs between football-data.org (2–1) and OpenFootball (2–2).', skip: 'Open data conflict on an input match — excluded until resolved.' }),
  m('m-pd-fcb-atm', 'pd', 'fcb', 'atm', '2026-11-28T20:00:00Z', { completeness: 0.96 }),
  m('m-fl1-psg-asm', 'fl1', 'psg', 'asm', '2026-11-28T20:05:00Z', { completeness: 0.95 }),
  // Sun 29 Nov
  m('m-pl-mun-tot', 'pl', 'mun', 'tot', '2026-11-29T14:00:00Z', { completeness: 0.96 }),
  m('m-pl-liv-mci', 'pl', 'liv', 'mci', '2026-11-29T16:30:00Z', { completeness: 0.98 }),
  // Tue 1 Dec / Wed 2 Dec — Champions League
  m('m-cl-bay-psg', 'cl', 'bay', 'psg', '2026-12-01T20:00:00Z', { completeness: 0.86 }),
  m('m-cl-rma-b04', 'cl', 'rma', 'b04', '2026-12-01T20:00:00Z', { completeness: 0.86 }),
  m('m-cl-liv-int', 'cl', 'liv', 'int', '2026-12-02T20:00:00Z', { completeness: 0.86 }),
  m('m-cl-fcb-new', 'cl', 'fcb', 'new', '2026-12-02T17:45:00Z', { completeness: 0.85 }),
]

export const matchById = (id: string) => MATCHES.find((x) => x.id === id)

// ───────────────────────── Prediction model (sample) ─────────────────────────

export type ModelRow = { key: string; name: string; home: number; draw: number; away: number; note: string }
export type Factor = { label: string; impact: number; detail: string; missing?: boolean }
export type MarketKey = '1x2' | 'dc' | 'dnb' | 'ou25' | 'btts' | 'cs' | 'ah' | 'ht' | 'htft' | 'tg'
export type MarketDef = { key: MarketKey; name: string; status: 'active' | 'validating' | 'disabled'; reason?: string }

export const MARKETS: MarketDef[] = [
  { key: '1x2', name: 'Full-time result', status: 'active' },
  { key: 'dc', name: 'Double chance', status: 'active' },
  { key: 'dnb', name: 'Draw no bet', status: 'active' },
  { key: 'ou25', name: 'Over / Under goals', status: 'active' },
  { key: 'btts', name: 'Both teams to score', status: 'active' },
  { key: 'cs', name: 'Correct score', status: 'active' },
  { key: 'tg', name: 'Team goals', status: 'active' },
  { key: 'ah', name: 'Asian handicap', status: 'validating', reason: 'Quarter-line settlement validated; calibration n=412 of 1,000 required.' },
  { key: 'ht', name: 'Half-time result', status: 'validating', reason: 'Separate half-time goal model in backtest. Not published yet.' },
  { key: 'htft', name: 'Half-time / Full-time', status: 'disabled', reason: 'Depends on the half-time model. Disabled until it passes validation.' },
]

export type Prediction = {
  matchId: string
  lh: number
  la: number
  matrix: Matrix
  x12: { home: number; draw: number; away: number }
  over25: number
  btts: number
  dnbHome: number
  dc: { homeDraw: number; homeAway: number; drawAway: number }
  ahHome: { line: number; p: number }
  homeOver15: number
  awayOver05: number
  scores: { h: number; a: number; p: number }[]
  models: ModelRow[]
  spread: number
  pick: { market: MarketKey; selection: string; label: string; p: number }
  signal: number
  components: { edge: number; calibration: number; completeness: number; agreement: number; certainty: number }
  recommendation: 'pick' | 'lean' | 'skip'
  skipReason?: string
  ece: number
  factors: Factor[]
  interval: [number, number]
  modelVersion: string
  snapshotAt: string
  inputHash: string
  baseline: { home: number; draw: number; away: number }
}

const HOME_ADV = 62
const BASELINE = { home: 0.452, draw: 0.257, away: 0.291 }
const cache = new Map<string, Prediction>()

function seedOf(id: string) {
  let h = 2166136261
  for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return h >>> 0
}

function jitter(p: { home: number; draw: number; away: number }, r: () => number, size: number) {
  const h = clamp(p.home + (r() - 0.5) * size, 0.03, 0.95)
  const a = clamp(p.away + (r() - 0.5) * size, 0.03, 0.95)
  const d = clamp(1 - h - a, 0.05, 0.6)
  const s = h + d + a
  return { home: h / s, draw: d / s, away: a / s }
}

export function getPrediction(match: Match): Prediction {
  const hit = cache.get(match.id)
  if (hit) return hit
  const r = rng(seedOf(match.id))
  const home = teamById(match.homeId)
  const away = teamById(match.awayId)
  const neutral = compById(match.compId).type === 'cup' ? 0.75 : 1
  const diff = home.elo - away.elo + HOME_ADV * neutral
  const lh = +(1.42 * Math.exp(diff / 560) * (0.95 + r() * 0.1)).toFixed(2)
  const la = +(1.14 * Math.exp(-diff / 560) * (0.95 + r() * 0.1)).toFixed(2)
  const matrix = scoreMatrix(lh, la)
  const x12 = oneXTwo(matrix)
  const eloOnly = (() => {
    const e = 1 / (1 + Math.pow(10, -diff / 400))
    const d = 0.27 - Math.abs(e - 0.5) * 0.22
    return { home: e * (1 - d), draw: d, away: (1 - e) * (1 - d) }
  })()
  const poisson = oneXTwo(scoreMatrix(lh, la, 0))
  const disagreeing = Boolean(match.skip?.startsWith('Model disagreement'))
  const logreg = jitter(x12, r, 0.06)
  const gbm = disagreeing ? { home: clamp(x12.home - 0.15, 0.05, 0.9), draw: x12.draw + 0.07, away: 0 } : jitter(x12, r, 0.08)
  if (disagreeing) gbm.away = 1 - gbm.home - gbm.draw
  const models: ModelRow[] = [
    { key: 'elo', name: 'Elo rating', ...eloOnly, note: 'Strength only' },
    { key: 'poisson', name: 'Poisson', ...poisson, note: 'Independent goals' },
    { key: 'dc', name: 'Dixon–Coles', ...x12, note: 'Primary · low-score corrected' },
    { key: 'logreg', name: 'Logistic regression', ...logreg, note: '14 features' },
    { key: 'gbm', name: 'LightGBM', ...gbm, note: 'Challenger · not promoted' },
  ]
  const homes = models.map((x) => x.home)
  const spread = Math.max(...homes) - Math.min(...homes)

  const ov = overLine(matrix, 2.5)
  const bt = btts(matrix)
  const dnbHome = x12.home / (x12.home + x12.away)
  const ahLine = x12.home > 0.62 ? -1.5 : x12.home > 0.5 ? -0.5 : x12.away > 0.5 ? 0.5 : -0.5
  // Choose the market whose probability most exceeds its base rate — not simply the highest probability.
  const candidates = [
    { market: '1x2' as const, selection: 'home', label: `${home.short} to win`, p: x12.home, base: BASELINE.home },
    { market: '1x2' as const, selection: 'away', label: `${away.short} to win`, p: x12.away, base: BASELINE.away },
    { market: 'ou25' as const, selection: ov > 0.5 ? 'over' : 'under', label: ov > 0.5 ? 'Over 2.5 goals' : 'Under 2.5 goals', p: ov > 0.5 ? ov : 1 - ov, base: 0.52 },
    { market: 'btts' as const, selection: bt > 0.5 ? 'yes' : 'no', label: bt > 0.5 ? 'Both teams to score' : 'Not both teams to score', p: bt > 0.5 ? bt : 1 - bt, base: 0.52 },
    { market: 'dc' as const, selection: x12.home >= x12.away ? 'homeDraw' : 'drawAway', label: x12.home >= x12.away ? `${home.short} or draw` : `${away.short} or draw`, p: x12.home >= x12.away ? x12.home + x12.draw : x12.away + x12.draw, base: 0.72 },
  ]
  const best = candidates.sort((a, b) => b.p - b.base - (a.p - a.base))[0]
  const comp = compById(match.compId)
  const ece = comp.modelStatus === 'active' ? 0.012 + r() * 0.014 : 0.035 + r() * 0.02
  const components = {
    edge: clamp((best.p - best.base) / 0.3, 0, 1),
    calibration: clamp(1 - ece / 0.05, 0, 1),
    completeness: match.completeness,
    agreement: clamp(1 - spread / 0.16, 0, 1),
    certainty: clamp(1 - Math.abs(0.5 - best.p) * 0 - (1 - best.p) * 0.6, 0, 1),
  }
  let signal = Math.round(100 * (0.34 * components.edge + 0.2 * components.calibration + 0.18 * components.completeness + 0.18 * components.agreement + 0.1 * components.certainty))
  let recommendation: Prediction['recommendation'] = signal >= 68 ? 'pick' : signal >= 52 ? 'lean' : 'skip'
  let skipReason: string | undefined
  if (match.skip) {
    recommendation = 'skip'
    skipReason = match.skip
    signal = Math.min(signal, 38)
  } else if (recommendation === 'skip') {
    skipReason = 'No statistical edge over base rates for any active market.'
  }
  const eloGap = Math.round(home.elo - away.elo)
  const formH = Math.round((r() - 0.4) * 60) / 10
  const factors: Factor[] = [
    { label: 'Team strength (Elo gap)', impact: +(eloGap / 28).toFixed(1), detail: `${home.short} ${home.elo} vs ${away.short} ${away.elo} (${eloGap >= 0 ? '+' : ''}${eloGap})` },
    { label: 'Home advantage', impact: +(HOME_ADV * neutral / 22).toFixed(1), detail: comp.type === 'cup' ? 'Reduced in European competition' : `League home edge ≈ ${HOME_ADV} Elo points` },
    { label: 'Recent form (last 6, opponent-adjusted)', impact: formH, detail: `Form difference ${formH >= 0 ? 'favours' : 'counts against'} ${home.short}` },
    { label: 'Attack quality (shots on target, last 10)', impact: +((r() - 0.45) * 5).toFixed(1), detail: `${(4 + r() * 2.5).toFixed(1)} vs ${(3.4 + r() * 2.2).toFixed(1)} SoT per game` },
    { label: 'Rest days', impact: +((r() - 0.5) * 2).toFixed(1), detail: `${3 + Math.floor(r() * 4)} vs ${3 + Math.floor(r() * 4)} days since last match` },
    { label: 'Line-ups / injuries', impact: 0, detail: match.lineups ? 'Confirmed line-ups used (API-Football)' : 'Not available from connected free sources — not assumed', missing: !match.lineups },
    { label: 'Expected goals (xG)', impact: 0, detail: 'No reliable xG source for this season — excluded, not estimated', missing: true },
  ]
  const halfWidth = 0.025 + (1 - match.completeness) * 0.12 + spread * 0.1
  const pred: Prediction = {
    matchId: match.id, lh, la, matrix, x12, over25: ov, btts: bt, dnbHome,
    dc: { homeDraw: x12.home + x12.draw, homeAway: x12.home + x12.away, drawAway: x12.draw + x12.away },
    ahHome: { line: ahLine, p: asianHalf(matrix, ahLine) },
    homeOver15: teamOver(matrix, 'home', 1.5), awayOver05: teamOver(matrix, 'away', 0.5),
    scores: topScores(matrix, 6), models, spread,
    pick: { market: best.market, selection: best.selection, label: best.label, p: best.p },
    signal, components, recommendation, skipReason, ece, factors,
    interval: [clamp(best.p - halfWidth, 0, 1), clamp(best.p + halfWidth, 0, 1)],
    modelVersion: 'football-dc 1.3.0',
    snapshotAt: new Date(new Date(match.kickoff).getTime() - 24 * 3600e3).toISOString(),
    inputHash: 'sha256:' + seedOf(match.id + 'h').toString(16).padStart(8, '0') + seedOf(match.id + 'x').toString(16).padStart(8, '0'),
    baseline: BASELINE,
  }
  cache.set(match.id, pred)
  return pred
}

export type FormResult = { r: 'W' | 'D' | 'L'; opp: string; score: string; home: boolean; date: string }

export function teamForm(team: Team, n = 6): FormResult[] {
  const r = rng(seedOf(team.id + 'form'))
  const out: FormResult[] = []
  for (let i = 0; i < n; i++) {
    const strength = (team.elo - 1700) / 400
    const x = r()
    const res: FormResult['r'] = x < 0.28 + strength * 0.35 ? 'W' : x < 0.55 + strength * 0.2 ? 'D' : 'L'
    const g1 = res === 'L' ? Math.floor(r() * 2) : 1 + Math.floor(r() * 3)
    const g2 = res === 'W' ? Math.max(0, g1 - 1 - Math.floor(r() * 2)) : res === 'D' ? g1 : g1 + 1 + Math.floor(r() * 2)
    const d = new Date(Date.UTC(2026, 10, 22 - i * 7))
    out.push({ r: res, opp: '', score: `${g1}–${g2}`, home: i % 2 === 0, date: d.toISOString() })
  }
  return out
}

export function teamSeasonStats(team: Team) {
  const r = rng(seedOf(team.id + 'stats'))
  const s = (team.elo - 1700) / 300
  return {
    played: 12 + Math.floor(r() * 2),
    goalsFor: +(1.0 + s * 0.9 + r() * 0.2).toFixed(2),
    goalsAgainst: +(1.75 - s * 0.7 + r() * 0.2).toFixed(2),
    shots: +(10 + s * 6 + r() * 2).toFixed(1),
    shotsOnTarget: +(3.4 + s * 2.4 + r() * 0.8).toFixed(1),
    corners: +(4.2 + s * 2 + r()).toFixed(1),
    cleanSheets: clamp(0.15 + s * 0.25 + r() * 0.1, 0.05, 0.6),
    bttsRate: clamp(0.62 - s * 0.12 + r() * 0.1, 0.3, 0.8),
    over25Rate: clamp(0.48 + s * 0.1 + r() * 0.12, 0.3, 0.8),
    goalsByPeriod: [0, 1, 2, 3, 4, 5].map(() => +(0.1 + r() * 0.28 + s * 0.04).toFixed(2)),
    concededByPeriod: [0, 1, 2, 3, 4, 5].map(() => +(0.08 + r() * 0.22 - s * 0.02).toFixed(2)),
    homeRecord: { w: 4 + Math.floor(s * 2), d: 1 + Math.floor(r() * 2), l: Math.max(0, 1 - Math.floor(s)) },
    awayRecord: { w: 2 + Math.floor(s * 2), d: 1 + Math.floor(r() * 2), l: Math.max(0, 3 - Math.floor(s * 2)) },
    position: 0,
  }
}

export function eloHistory(team: Team) {
  const r = rng(seedOf(team.id + 'elo'))
  const pts: { date: string; elo: number }[] = []
  let e = team.elo - 30 + r() * 20
  for (let i = 30; i >= 0; i--) {
    const d = new Date(Date.UTC(2026, 10, 28) - i * 6 * 86400e3)
    e += (r() - 0.48) * 14
    pts.push({ date: d.toISOString().slice(0, 10), elo: Math.round(i === 0 ? team.elo : e) })
  }
  return pts
}

export function headToHead(home: Team, away: Team) {
  const r = rng(seedOf(home.id + away.id + 'h2h'))
  const out: { date: string; homeId: string; awayId: string; score: [number, number]; comp: string }[] = []
  for (let i = 0; i < 8; i++) {
    const flip = i % 2 === 1
    const h = flip ? away : home
    const a = flip ? home : away
    const lam = 1.3 * Math.exp((h.elo - a.elo + 60) / 560)
    const lam2 = 1.1 * Math.exp(-(h.elo - a.elo + 60) / 560)
    const g1 = Math.min(5, Math.floor(-Math.log(1 - r()) * lam))
    const g2 = Math.min(5, Math.floor(-Math.log(1 - r()) * lam2))
    const year = 2026 - Math.floor(i / 2)
    out.push({ date: `${year}-${flip ? '03' : '10'}-${10 + i}`, homeId: h.id, awayId: a.id, score: [g1, g2], comp: compById(home.compId).name })
  }
  return out
}

/** Sample standings for the league tables. */
export function standings(compId: string) {
  const teams = [...new Set(MATCHES.filter((x) => x.compId === compId).flatMap((x) => [x.homeId, x.awayId]))]
    .map((id) => teamById(id))
    .filter((t) => t.compId === compId)
  const r = rng(seedOf(compId + 'table'))
  return teams
    .map((t) => {
      const p = 12 + (compId === 'bl1' ? -1 : 0)
      const s = (t.elo - 1700) / 300
      const w = clamp(Math.round(p * (0.22 + s * 0.38) + r() * 2), 0, p)
      const d = clamp(Math.round((p - w) * (0.3 + r() * 0.3)), 0, p - w)
      const l = p - w - d
      const gf = Math.round(w * 2 + d + r() * 4)
      const ga = Math.round(l * 1.8 + d + r() * 4)
      return { team: t, p, w, d, l, gf, ga, pts: w * 3 + d, form: teamForm(t, 5).map((f) => f.r) }
    })
    .sort((a, b) => b.pts - a.pts || b.gf - b.ga - (a.gf - a.ga))
}

export const LINEUPS = {
  'm-pl-ars-che': {
    source: 'API-Football · confirmed 16:32 UTC',
    home: { formation: '4-3-3', players: ['Raya', 'White', 'Saliba', 'Gabriel', 'Calafiori', 'Ødegaard', 'Rice', 'Merino', 'Saka', 'Havertz', 'Martinelli'] },
    away: { formation: '4-2-3-1', players: ['Sánchez', 'Gusto', 'Fofana', 'Colwill', 'Cucurella', 'Caicedo', 'Fernández', 'Palmer', 'Neto', 'Madueke', 'Pedro'] },
  },
} as Record<string, { source: string; home: { formation: string; players: string[] }; away: { formation: string; players: string[] } }>
