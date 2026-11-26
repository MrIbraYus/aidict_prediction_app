/**
 * Smart Market engine (prototype implementation of the production design in documentation/PREDICTION_ENGINE.md).
 *
 * Every market has its OWN calculation. They share inputs (the Dixon–Coles score matrix, a goal-order model,
 * a corners model, a player model) but not a formula:
 *  - score-matrix markets (O/U, handicaps, double chance, combined) sum exact joint events over the matrix;
 *  - path markets (1UP, 2UP, Never Down, DC-1UP, first goal, goals in a row) use the ORDER of goals, computed by
 *    exact enumeration of every scoring sequence for each final score;
 *  - corners use negative-binomial team corner distributions;
 *  - player markets use player scoring rates × expected minutes × start probability.
 * Combined markets are JOINT probabilities from the matrix — never products of separate markets.
 *
 * ⚠ All inputs below are DESIGN SAMPLE DATA. The maths is real; the numbers are not predictions.
 */
import { clamp, rng, scoreMatrix, type Matrix } from './probability'
import { getPrediction, teamSeasonStats, type Match } from '../mock/matches'
import { compById, teamById, type Team } from '../mock/teams'

/* ───────────────────────── Taxonomy ───────────────────────── */

export type MarketCategory = 'result' | 'goals' | 'handicap' | 'double' | 'first' | 'sequence' | 'player' | 'corners' | 'combined'
export const CATEGORIES: { id: MarketCategory; label: string }[] = [
  { id: 'result', label: 'Match result' },
  { id: 'goals', label: 'Goals' },
  { id: 'handicap', label: 'Handicap' },
  { id: 'double', label: 'Double chance' },
  { id: 'first', label: 'First goal' },
  { id: 'sequence', label: 'Consecutive goals' },
  { id: 'player', label: 'Player' },
  { id: 'corners', label: 'Corners' },
  { id: 'combined', label: 'Combined' },
]
export const categoryLabel = (c: MarketCategory) => CATEGORIES.find((x) => x.id === c)!.label

export type DataReq = 'results' | 'goalTimes' | 'corners' | 'lineups' | 'playerStats' | 'penalties' | 'settlement'
export const DATA_REQS: Record<DataReq, { label: string; providers: string; coverage: string; free: 'yes' | 'partial' | 'no' }> = {
  results: { label: 'Final scores', providers: 'OpenFootball · football-data.org · OpenLigaDB · football-data.co.uk', coverage: 'All competitions', free: 'yes' },
  goalTimes: { label: 'Goal times / scoring order', providers: 'OpenLigaDB (German leagues) · OpenFootball “-full” files · API-Football events (100 calls/day)', coverage: 'Bundesliga (full history) · Premier League (partial)', free: 'partial' },
  corners: { label: 'Corner counts', providers: 'football-data.co.uk (HC/AC) · API-Football statistics', coverage: '22 European divisions — not Champions League', free: 'yes' },
  lineups: { label: 'Confirmed line-ups', providers: 'API-Football (budgeted, ≈1 h before kick-off)', coverage: 'Featured & saved matches only', free: 'partial' },
  playerStats: { label: 'Player goals & minutes', providers: 'Goals: OpenFootball/OpenLigaDB · Minutes & shots: API-Football paid tier or another licensed source', coverage: 'Insufficient on free sources', free: 'no' },
  penalties: { label: 'Penalty takers', providers: 'Not supplied by current providers', coverage: '—', free: 'no' },
  settlement: { label: 'Verified settlement rules', providers: 'Bookmaker rules — no data API supplies them; must be confirmed manually', coverage: '—', free: 'no' },
}

const GOAL_TIME_COMPS: Record<string, number> = { bl1: 0.97, pl: 0.9 } // completeness of goal-order data
const CORNER_COMPS: Record<string, number> = { pl: 0.96, pd: 0.95, bl1: 0.96, sa: 0.95, fl1: 0.95, ded: 0.92, elc: 0.95, ppl: 0.9 }

/* ───────────────────────── Market definitions ───────────────────────── */

export type Gate = 'active' | 'validating' | 'disabled'
export type MarketDef = {
  id: string
  name: string
  category: MarketCategory
  requires: DataReq[]
  method: string
  settlement: string
  /** Walk-forward backtest summary (sample values). */
  backtest: { n: number; brier: number; logLoss: number; ece: number }
  /** Gate after validation; per-competition overrides where data depth differs. */
  gate: Gate
  gateReason?: string
  gateByComp?: Record<string, { gate: Gate; reason?: string }>
  resultDependent?: boolean
}

const BT = (n: number, brier: number, logLoss: number, ece: number) => ({ n, brier, logLoss, ece })
const SETTLE_UNVERIFIED = 'Settlement rules differ between bookmakers (early-payout timing, extra time, void rules). Withheld until the exact definition is confirmed.'

export const MARKET_DEFS: MarketDef[] = [
  { id: '1x2-1up', name: '1X2 – 1UP', category: 'result', requires: ['results', 'goalTimes', 'settlement'], resultDependent: true, method: 'Goal-order model: for every final score, all scoring sequences are enumerated and weighted; the selection wins if its team ever leads by one goal, otherwise the full-time result stands.', settlement: 'Win if the selected team goes 1 goal ahead at any point; otherwise settled on the 90-minute result (definition to verify).', backtest: BT(6420, 0.219, 0.628, 0.024), gate: 'validating', gateReason: SETTLE_UNVERIFIED },
  { id: '1x2-2up', name: '1X2 – 2UP', category: 'result', requires: ['results', 'goalTimes', 'settlement'], resultDependent: true, method: 'Goal-order model: P(team ever leads by 2) ∪ P(team wins at full time), computed per scoring sequence.', settlement: 'Win if the selected team goes 2 goals ahead at any point; otherwise settled on the 90-minute result (definition to verify).', backtest: BT(6420, 0.224, 0.641, 0.027), gate: 'validating', gateReason: SETTLE_UNVERIFIED },
  { id: '1x2-never-down', name: '1X2 – Never Down', category: 'result', requires: ['results', 'goalTimes', 'settlement'], resultDependent: true, method: 'Goal-order model: share of scoring sequences in which the team never trails (includes 0–0).', settlement: 'Win if the selected team is never behind at any point of the 90 minutes (definition to verify).', backtest: BT(6420, 0.228, 0.652, 0.029), gate: 'validating', gateReason: SETTLE_UNVERIFIED },
  { id: 'ou', name: 'Over/Under', category: 'goals', requires: ['results'], method: 'Dixon–Coles score matrix (time-decayed attack/defence, low-score correction ρ). Total-goals distribution summed exactly for each line.', settlement: 'Total goals in 90 minutes plus stoppage time.', backtest: BT(31482, 0.236, 0.664, 0.016), gate: 'active' },
  { id: 'handicap', name: 'Handicap', category: 'handicap', requires: ['results'], resultDependent: true, method: 'European (3-way) handicap from the score matrix: goal difference after the handicap → win / handicap draw / loss.', settlement: 'Handicap applied to the 90-minute score; three outcomes including the handicap draw.', backtest: BT(31482, 0.198, 0.583, 0.019), gate: 'active' },
  { id: 'asian-handicap', name: 'Asian Handicap', category: 'handicap', requires: ['results'], resultDependent: true, method: 'Score matrix with quarter-line splitting: full win, half win, push, half loss and full loss are each summed. Ranked by probability of profit (full + half win).', settlement: 'Quarter lines split the stake across the two neighbouring lines; whole lines can push.', backtest: BT(412, 0.247, 0.689, 0.041), gate: 'validating', gateReason: 'Calibration error 0.041 is above the 0.040 gate (n = 412 live; 1,000 required).' },
  { id: 'dc', name: 'Double Chance', category: 'double', requires: ['results'], resultDependent: true, method: 'Score matrix: P(home or draw), P(home or away), P(draw or away).', settlement: '90-minute result.', backtest: BT(31482, 0.168, 0.51, 0.015), gate: 'active' },
  { id: 'dc-1up', name: 'Double Chance – 1UP', category: 'double', requires: ['results', 'goalTimes', 'settlement'], resultDependent: true, method: 'Goal-order model: P(team ever leads by 1) ∪ P(double chance wins at full time).', settlement: 'Win if the team goes 1 up at any point, otherwise settled as double chance (definition to verify).', backtest: BT(6420, 0.171, 0.522, 0.022), gate: 'validating', gateReason: SETTLE_UNVERIFIED },
  { id: 'first-goal', name: '1st Goal', category: 'first', requires: ['results', 'goalTimes'], method: 'Scoring-intensity ratio from the goals model, conditioned on each final score; “no goal” from the 0–0 cell. Needs goal times to validate and to settle.', settlement: 'Team scoring the first goal of the match; “No goal” if 0–0. Own goals count for the benefiting team.', backtest: BT(6420, 0.212, 0.981, 0.018), gate: 'active' },
  { id: 'any-2-row', name: 'Any Team To Score 2 or More Goals in a Row', category: 'sequence', requires: ['results', 'goalTimes'], method: 'Goal-order model: share of sequences containing a run of ≥2 consecutive goals by the same team.', settlement: 'Yes if either team scores two consecutive goals without reply.', backtest: BT(6420, 0.214, 0.616, 0.024), gate: 'active', gateByComp: { pl: { gate: 'validating', reason: 'Premier League goal-order history is short (n = 512 < 1,000).' } } },
  { id: 'any-3-row', name: 'Any Team To Score 3 or More Goals in a Row', category: 'sequence', requires: ['results', 'goalTimes'], method: 'Goal-order model: sequences with a run of ≥3 consecutive goals by one team.', settlement: 'Yes if either team scores three consecutive goals without reply.', backtest: BT(6420, 0.171, 0.523, 0.038), gate: 'validating', gateReason: 'Rare outcome — calibration interval too wide (ECE 0.038, gate 0.030).' },
  { id: 'home-2-row', name: 'Home Team To Score 2 or More Goals in a Row', category: 'sequence', requires: ['results', 'goalTimes'], method: 'Goal-order model: sequences with ≥2 consecutive home goals.', settlement: 'Yes if the home team scores two consecutive goals.', backtest: BT(6420, 0.208, 0.601, 0.022), gate: 'active', gateByComp: { pl: { gate: 'validating', reason: 'Premier League goal-order history is short (n = 512 < 1,000).' } } },
  { id: 'home-3-row', name: 'Home Team To Score 3 or More Goals in a Row', category: 'sequence', requires: ['results', 'goalTimes'], method: 'Goal-order model: sequences with ≥3 consecutive home goals.', settlement: 'Yes if the home team scores three consecutive goals.', backtest: BT(6420, 0.142, 0.452, 0.036), gate: 'validating', gateReason: 'Rare outcome — calibration interval too wide (ECE 0.036, gate 0.030).' },
  { id: 'away-2-row', name: 'Away Team To Score 2 or More Goals in a Row', category: 'sequence', requires: ['results', 'goalTimes'], method: 'Goal-order model: sequences with ≥2 consecutive away goals.', settlement: 'Yes if the away team scores two consecutive goals.', backtest: BT(6420, 0.181, 0.548, 0.023), gate: 'active', gateByComp: { pl: { gate: 'validating', reason: 'Premier League goal-order history is short (n = 512 < 1,000).' } } },
  { id: 'goalscorer', name: 'Goalscorer', category: 'player', requires: ['results', 'lineups', 'playerStats', 'penalties'], method: 'Player model: team expected goals × player share of team goals × expected minutes ÷ 90 × start probability, with penalty duty added.', settlement: 'Player scores at any time (own goals excluded). Non-starters usually void — verify.', backtest: BT(0, 0, 0, 0), gate: 'validating', gateReason: 'No out-of-sample player predictions yet; minutes and penalty data are incomplete.' },
  { id: 'player-not-score', name: 'Player Not to Score', category: 'player', requires: ['results', 'lineups', 'playerStats', 'penalties'], method: 'Complement of the player scoring probability, only for confirmed starters.', settlement: 'Player plays and does not score (verify void rules).', backtest: BT(0, 0, 0, 0), gate: 'validating', gateReason: 'No out-of-sample player predictions yet; minutes and penalty data are incomplete.' },
  { id: 'corners-ou', name: 'Corners – Over/Under', category: 'corners', requires: ['corners'], method: 'Negative-binomial corner counts per team (corners won vs opponent corners conceded, home effect, over-dispersion r = 9); total distribution by convolution.', settlement: 'Total corners in 90 minutes (corners awarded but not taken usually excluded — verify).', backtest: BT(16240, 0.241, 0.676, 0.021), gate: 'active' },
  { id: 'corners-1x2', name: 'Corners – 1X2', category: 'corners', requires: ['corners'], method: 'Joint negative-binomial corner counts → P(home more corners), P(equal), P(away more).', settlement: 'Team with more corners in 90 minutes.', backtest: BT(16240, 0.588, 0.996, 0.046), gate: 'validating', gateReason: 'Calibration error 0.046 above the 0.040 gate — corner difference under-dispersed.' },
  { id: 'home-or-over25', name: 'Home Team or Over 2.5', category: 'combined', requires: ['results'], resultDependent: true, method: 'Joint event on the score matrix: home win OR 3+ goals (cells counted once).', settlement: 'Wins if the home team wins or the match has 3+ goals.', backtest: BT(31482, 0.203, 0.592, 0.017), gate: 'active' },
  { id: 'home-or-under25', name: 'Home Team or Under 2.5', category: 'combined', requires: ['results'], resultDependent: true, method: 'Joint event on the score matrix: home win OR 0–2 goals.', settlement: 'Wins if the home team wins or the match has 0–2 goals.', backtest: BT(31482, 0.187, 0.561, 0.018), gate: 'active' },
  { id: 'draw-or-over25', name: 'Draw or Over 2.5', category: 'combined', requires: ['results'], resultDependent: true, method: 'Joint event on the score matrix: draw OR 3+ goals.', settlement: 'Wins on a draw or 3+ goals.', backtest: BT(31482, 0.229, 0.651, 0.019), gate: 'active' },
  { id: 'draw-or-under25', name: 'Draw or Under 2.5', category: 'combined', requires: ['results'], resultDependent: true, method: 'Joint event on the score matrix: draw OR 0–2 goals.', settlement: 'Wins on a draw or 0–2 goals.', backtest: BT(31482, 0.231, 0.655, 0.02), gate: 'active' },
  { id: 'away-or-over25', name: 'Away or Over 2.5', category: 'combined', requires: ['results'], resultDependent: true, method: 'Joint event on the score matrix: away win OR 3+ goals.', settlement: 'Wins if the away team wins or the match has 3+ goals.', backtest: BT(31482, 0.217, 0.624, 0.018), gate: 'active' },
  { id: 'away-or-under25', name: 'Away or Under 2.5', category: 'combined', requires: ['results'], resultDependent: true, method: 'Joint event on the score matrix: away win OR 0–2 goals.', settlement: 'Wins if the away team wins or the match has 0–2 goals.', backtest: BT(31482, 0.226, 0.641, 0.019), gate: 'active' },
]

/* ───────────────────────── Goal-order model ─────────────────────────
 * Under the base model, home and away goals are independent Poisson processes, so for a final score (h, a)
 * every ordering of the h home and a away goals is equally likely. We enumerate all C(h+a, h) sequences once
 * (h, a ≤ 7) and record path statistics. Production replaces this with time-varying, score-state-dependent
 * intensities (documented), but the market logic stays the same.
 */
type SeqStats = {
  homeLead1: number; homeLead2: number; homeNeverTrail: number
  awayLead1: number; awayLead2: number; awayNeverTrail: number
  anyRun2: number; anyRun3: number; homeRun2: number; homeRun3: number; awayRun2: number
}
const MAXG = 7
const SEQ: SeqStats[][] = (() => {
  const T: SeqStats[][] = []
  for (let h = 0; h <= MAXG; h++) {
    T[h] = []
    for (let a = 0; a <= MAXG; a++) {
      const acc: SeqStats = { homeLead1: 0, homeLead2: 0, homeNeverTrail: 0, awayLead1: 0, awayLead2: 0, awayNeverTrail: 0, anyRun2: 0, anyRun3: 0, homeRun2: 0, homeRun3: 0, awayRun2: 0 }
      let count = 0
      const walk = (hl: number, al: number, d: number, maxD: number, minD: number, last: number, run: number, maxHR: number, maxAR: number) => {
        if (hl === 0 && al === 0) {
          count++
          if (maxD >= 1) acc.homeLead1++
          if (maxD >= 2) acc.homeLead2++
          if (minD >= 0) acc.homeNeverTrail++
          if (minD <= -1) acc.awayLead1++
          if (minD <= -2) acc.awayLead2++
          if (maxD <= 0) acc.awayNeverTrail++
          if (Math.max(maxHR, maxAR) >= 2) acc.anyRun2++
          if (Math.max(maxHR, maxAR) >= 3) acc.anyRun3++
          if (maxHR >= 2) acc.homeRun2++
          if (maxHR >= 3) acc.homeRun3++
          if (maxAR >= 2) acc.awayRun2++
          return
        }
        if (hl > 0) {
          const r = last === 1 ? run + 1 : 1
          walk(hl - 1, al, d + 1, Math.max(maxD, d + 1), minD, 1, r, Math.max(maxHR, r), maxAR)
        }
        if (al > 0) {
          const r = last === -1 ? run + 1 : 1
          walk(hl, al - 1, d - 1, maxD, Math.min(minD, d - 1), -1, r, maxHR, Math.max(maxAR, r))
        }
      }
      walk(h, a, 0, 0, 0, 0, 0, 0, 0)
      for (const k of Object.keys(acc) as (keyof SeqStats)[]) acc[k] /= count
      T[h][a] = acc
    }
  }
  return T
})()

/* ───────────────────────── Context ───────────────────────── */

type W = (h: number, a: number) => number
type Ctx = { m: Matrix; mass: number; lh: number; la: number; homeName: string; awayName: string; corners: { mh: number; ma: number; total: number[]; diff: { home: number; draw: number; away: number } } }

const R_CORNERS = 9
function negbin(mu: number, r: number, max = 30) {
  const p = r / (r + mu)
  const out: number[] = []
  let v = Math.pow(p, r)
  for (let k = 0; k <= max; k++) {
    out.push(v)
    v = v * ((k + r) / (k + 1)) * (1 - p)
  }
  return out
}
function cornersModel(mh: number, ma: number) {
  const H = negbin(mh, R_CORNERS)
  const A = negbin(ma, R_CORNERS)
  const total = new Array(61).fill(0)
  const diff = { home: 0, draw: 0, away: 0 }
  H.forEach((ph, i) =>
    A.forEach((pa, j) => {
      total[i + j] += ph * pa
      if (i > j) diff.home += ph * pa
      else if (i === j) diff.draw += ph * pa
      else diff.away += ph * pa
    }),
  )
  return { mh, ma, total, diff }
}

function makeCtx(lh: number, la: number, mh: number, ma: number, homeName: string, awayName: string, m?: Matrix): Ctx {
  const mat = m ?? scoreMatrix(lh, la)
  let mass = 0
  for (let h = 0; h <= MAXG; h++) for (let a = 0; a <= MAXG; a++) mass += mat[h][a]
  return { m: mat, mass, lh, la, homeName, awayName, corners: cornersModel(mh, ma) }
}
const sumW = (c: Ctx, w: W) => {
  let s = 0
  for (let h = 0; h <= MAXG; h++) for (let a = 0; a <= MAXG; a++) s += c.m[h][a] * w(h, a)
  return s / c.mass
}

/** League-average context, used for base rates (how often an outcome happens in a typical match). */
const AVG = makeCtx(1.48, 1.17, 5.4, 4.5, 'Home', 'Away')

function expectedCorners(home: Team, away: Team) {
  const sh = teamSeasonStats(home)
  const sa = teamSeasonStats(away)
  const mh = clamp(sh.corners * 1.05 + ((1760 - away.elo) / 400) * 0.6 + 0.2, 3, 9)
  const ma = clamp(sa.corners * 0.9 + ((1760 - home.elo) / 400) * 0.6, 2.5, 8)
  return { mh: +mh.toFixed(2), ma: +ma.toFixed(2) }
}

/* ───────────────────────── Outcomes per market ───────────────────────── */

export type Outcome = {
  key: string
  label: string
  p: number
  base: number
  /** Probability the outcome holds given final score (h, a); null for non-goal markets (corners, players). */
  w: W | null
  breakdown?: { label: string; p: number }[]
  note?: string
}

type Spec = { key: string; label: string; w?: W; corners?: (c: Ctx) => number; breakdown?: (c: Ctx) => { label: string; p: number }[] }

const HW: W = (h, a) => (h > a ? 1 : 0)
const DW: W = (h, a) => (h === a ? 1 : 0)
const AW: W = (h, a) => (h < a ? 1 : 0)
const over = (line: number): W => (h, a) => (h + a > line ? 1 : 0)
const under = (line: number): W => (h, a) => (h + a < line ? 1 : 0)
const or = (x: W, y: W): W => (h, a) => (x(h, a) || y(h, a) ? 1 : 0)
const S = (h: number, a: number) => SEQ[Math.min(h, MAXG)][Math.min(a, MAXG)]

/** Asian handicap for one side: returns per-score settlement fractions. */
function asianSplit(line: number, side: 'home' | 'away') {
  const lines = Number.isInteger(line * 2) ? [line] : [line - 0.25, line + 0.25]
  const settle = (h: number, a: number) => {
    let win = 0, push = 0, lose = 0
    for (const l of lines) {
      const d = (side === 'home' ? h - a : a - h) + l
      if (d > 0) win += 1 / lines.length
      else if (d === 0) push += 1 / lines.length
      else lose += 1 / lines.length
    }
    return { win, push, lose }
  }
  return settle
}
function asianSpec(line: number, side: 'home' | 'away', name: string): Spec {
  const s = asianSplit(line, side)
  const sign = line > 0 ? '+' : line < 0 ? '−' : ''
  return {
    key: `ah:${side}:${line}`,
    label: `${name} ${sign}${Math.abs(line)}`,
    // Event used for ranking and correlation: the bet returns a profit (full or half win).
    w: (h, a) => (s(h, a).win > 0 ? 1 : 0),
    breakdown: (c) => {
      let full = 0, half = 0, push = 0, halfL = 0, fullL = 0
      for (let h = 0; h <= MAXG; h++)
        for (let a = 0; a <= MAXG; a++) {
          const p = c.m[h][a] / c.mass
          const r = s(h, a)
          if (r.win === 1) full += p
          else if (r.win === 0.5 && r.push === 0.5) half += p
          else if (r.push === 1) push += p
          else if (r.lose === 0.5 && r.push === 0.5) halfL += p
          else fullL += p
        }
      return [
        { label: 'Full win', p: full },
        { label: 'Half win', p: half },
        { label: 'Push', p: push },
        { label: 'Half loss', p: halfL },
        { label: 'Full loss', p: fullL },
      ]
    },
  }
}
function handicapSpecs(line: number, home: string, away: string): Spec[] {
  // European 3-way handicap applied to the home side.
  const sign = line > 0 ? `+${line}` : `${line}`
  return [
    { key: `eh:${line}:home`, label: `${home} ${sign}`, w: (h, a) => (h + line > a ? 1 : 0) },
    { key: `eh:${line}:draw`, label: `Draw (${home} ${sign})`, w: (h, a) => (h + line === a ? 1 : 0) },
    { key: `eh:${line}:away`, label: `${away} ${line > 0 ? `−${line}` : `+${-line}`}`, w: (h, a) => (h + line < a ? 1 : 0) },
  ]
}

function specsFor(id: string, home: string, away: string): Spec[] {
  switch (id) {
    case '1x2-1up':
      return [
        { key: '1up:home', label: `${home} 1UP`, w: (h, a) => S(h, a).homeLead1 },
        { key: '1up:draw', label: 'Draw', w: DW },
        { key: '1up:away', label: `${away} 1UP`, w: (h, a) => S(h, a).awayLead1 },
      ]
    case '1x2-2up':
      return [
        { key: '2up:home', label: `${home} 2UP`, w: (h, a) => (h > a ? 1 : S(h, a).homeLead2) },
        { key: '2up:draw', label: 'Draw', w: DW },
        { key: '2up:away', label: `${away} 2UP`, w: (h, a) => (a > h ? 1 : S(h, a).awayLead2) },
      ]
    case '1x2-never-down':
      return [
        { key: 'nd:home', label: `${home} never behind`, w: (h, a) => S(h, a).homeNeverTrail },
        { key: 'nd:away', label: `${away} never behind`, w: (h, a) => S(h, a).awayNeverTrail },
      ]
    case 'ou':
      return [0.5, 1.5, 2.5, 3.5, 4.5].flatMap((l) => [
        { key: `ou:o${l}`, label: `Over ${l} goals`, w: over(l) },
        { key: `ou:u${l}`, label: `Under ${l} goals`, w: under(l) },
      ])
    case 'handicap':
      return [...handicapSpecs(-1, home, away), ...handicapSpecs(1, home, away)]
    case 'asian-handicap':
      return [
        ...[-1.5, -1, -0.75, -0.5, -0.25, 0, 0.25, 0.5].map((l) => asianSpec(l, 'home', home)),
        ...[0.5, 0.25, 0].map((l) => asianSpec(l, 'away', away)),
      ]
    case 'dc':
      return [
        { key: 'dc:1x', label: `${home} or draw`, w: or(HW, DW) },
        { key: 'dc:12', label: `${home} or ${away}`, w: or(HW, AW) },
        { key: 'dc:x2', label: `Draw or ${away}`, w: or(DW, AW) },
      ]
    case 'dc-1up':
      return [
        { key: 'dc1up:1x', label: `${home} or draw – 1UP`, w: (h, a) => (h >= a ? 1 : S(h, a).homeLead1) },
        { key: 'dc1up:x2', label: `Draw or ${away} – 1UP`, w: (h, a) => (a >= h ? 1 : S(h, a).awayLead1) },
      ]
    case 'first-goal':
      return [
        { key: 'fg:home', label: `${home} to score first`, w: (h, a) => (h + a === 0 ? 0 : h / (h + a)) },
        { key: 'fg:none', label: 'No goal', w: (h, a) => (h + a === 0 ? 1 : 0) },
        { key: 'fg:away', label: `${away} to score first`, w: (h, a) => (h + a === 0 ? 0 : a / (h + a)) },
      ]
    case 'any-2-row':
      return yesNo('a2', (h, a) => S(h, a).anyRun2)
    case 'any-3-row':
      return yesNo('a3', (h, a) => S(h, a).anyRun3)
    case 'home-2-row':
      return yesNo('h2', (h, a) => S(h, a).homeRun2)
    case 'home-3-row':
      return yesNo('h3', (h, a) => S(h, a).homeRun3)
    case 'away-2-row':
      return yesNo('w2', (h, a) => S(h, a).awayRun2)
    case 'corners-ou':
      return [7.5, 8.5, 9.5, 10.5, 11.5].flatMap((l) => [
        { key: `co:o${l}`, label: `Over ${l} corners`, corners: (c: Ctx) => c.corners.total.reduce((s, p, k) => (k > l ? s + p : s), 0) },
        { key: `co:u${l}`, label: `Under ${l} corners`, corners: (c: Ctx) => c.corners.total.reduce((s, p, k) => (k < l ? s + p : s), 0) },
      ])
    case 'corners-1x2':
      return [
        { key: 'c1x2:home', label: `${home} more corners`, corners: (c) => c.corners.diff.home },
        { key: 'c1x2:draw', label: 'Equal corners', corners: (c) => c.corners.diff.draw },
        { key: 'c1x2:away', label: `${away} more corners`, corners: (c) => c.corners.diff.away },
      ]
    case 'home-or-over25':
      return [{ key: 'cmb:h-o', label: `${home} or Over 2.5`, w: or(HW, over(2.5)) }]
    case 'home-or-under25':
      return [{ key: 'cmb:h-u', label: `${home} or Under 2.5`, w: or(HW, under(2.5)) }]
    case 'draw-or-over25':
      return [{ key: 'cmb:d-o', label: 'Draw or Over 2.5', w: or(DW, over(2.5)) }]
    case 'draw-or-under25':
      return [{ key: 'cmb:d-u', label: 'Draw or Under 2.5', w: or(DW, under(2.5)) }]
    case 'away-or-over25':
      return [{ key: 'cmb:a-o', label: `${away} or Over 2.5`, w: or(AW, over(2.5)) }]
    case 'away-or-under25':
      return [{ key: 'cmb:a-u', label: `${away} or Under 2.5`, w: or(AW, under(2.5)) }]
    default:
      return []
  }
}
function yesNo(k: string, w: W): Spec[] {
  return [
    { key: `${k}:yes`, label: 'Yes', w },
    { key: `${k}:no`, label: 'No', w: (h, a) => 1 - w(h, a) },
  ]
}

function evalSpec(sp: Spec, c: Ctx) {
  if (sp.w) return sumW(c, sp.w)
  if (sp.corners) return sp.corners(c)
  return 0
}

/* ───────────────────────── Player model (featured match only) ───────────────────────── */

type PlayerRow = { name: string; side: 'home' | 'away'; share: number; start: number; minutes: number; pens: boolean; goals: number; apps: number }
const PLAYERS: Record<string, PlayerRow[]> = {
  'm-pl-ars-che': [
    { name: 'Havertz', side: 'home', share: 0.23, start: 0.95, minutes: 80, pens: false, goals: 6, apps: 12 },
    { name: 'Saka', side: 'home', share: 0.2, start: 0.97, minutes: 84, pens: true, goals: 5, apps: 12 },
    { name: 'Martinelli', side: 'home', share: 0.13, start: 0.9, minutes: 72, pens: false, goals: 3, apps: 11 },
    { name: 'Rice', side: 'home', share: 0.07, start: 0.98, minutes: 88, pens: false, goals: 2, apps: 12 },
    { name: 'Palmer', side: 'away', share: 0.31, start: 0.97, minutes: 86, pens: true, goals: 7, apps: 12 },
    { name: 'Pedro', side: 'away', share: 0.21, start: 0.9, minutes: 76, pens: false, goals: 4, apps: 11 },
    { name: 'Neto', side: 'away', share: 0.11, start: 0.85, minutes: 70, pens: false, goals: 2, apps: 12 },
  ],
}
function playerScoreP(pl: PlayerRow, lh: number, la: number) {
  const lam = (pl.side === 'home' ? lh : la) * pl.share * (pl.minutes / 90) * pl.start + (pl.pens ? 0.05 : 0)
  return 1 - Math.exp(-lam)
}

/* ───────────────────────── Evaluation ───────────────────────── */

export type MarketStatus = 'active' | 'validating' | 'disabled' | 'unavailable'
export type MarketEval = {
  def: MarketDef
  status: MarketStatus
  reason?: string
  missing: DataReq[]
  outcomes: Outcome[]
  reliability: number
  completeness: number
  best?: Outcome
}
export type Inventory = Record<DataReq, { ok: boolean; quality: number; note: string }>

export function inventory(match: Match): Inventory {
  const gt = GOAL_TIME_COMPS[match.compId]
  const co = CORNER_COMPS[match.compId]
  const lineups = Boolean(match.lineups)
  return {
    results: { ok: true, quality: match.completeness, note: 'football-data.org + OpenFootball history' },
    goalTimes: { ok: Boolean(gt), quality: gt ?? 0, note: gt ? (match.compId === 'bl1' ? 'OpenLigaDB goal minutes since 2002-03' : 'OpenFootball “-full” + API-Football events') : 'No goal-time source for this competition on free providers' },
    corners: { ok: Boolean(co), quality: co ?? 0, note: co ? 'football-data.co.uk HC/AC, updated weekly' : 'football-data.co.uk does not cover this competition' },
    lineups: { ok: lineups, quality: lineups ? 0.98 : 0, note: lineups ? 'API-Football, confirmed 16:32 UTC' : 'Not fetched (budgeted for featured matches)' },
    playerStats: { ok: lineups && match.compId === 'pl', quality: lineups ? 0.7 : 0, note: lineups ? 'Goals & starts from OpenFootball; minutes partly missing' : 'Player minutes not available on free sources' },
    penalties: { ok: lineups && match.compId === 'pl', quality: lineups ? 0.6 : 0, note: lineups ? 'Penalty duty from last 12 matches (manual check)' : 'Not supplied by current providers' },
    settlement: { ok: false, quality: 0, note: 'Bookmaker settlement definition not yet verified' },
  }
}

const cache = new Map<string, MarketEval[]>()

export function evaluateMatch(match: Match): MarketEval[] {
  const hit = cache.get(match.id)
  if (hit) return hit
  const home = teamById(match.homeId)
  const away = teamById(match.awayId)
  const pred = getPrediction(match)
  const { mh, ma } = expectedCorners(home, away)
  const ctx = makeCtx(pred.lh, pred.la, mh, ma, home.short, away.short, pred.matrix)
  const inv = inventory(match)
  const comp = compById(match.compId)
  const disagreement = match.skip?.startsWith('Model disagreement')

  const evals = MARKET_DEFS.map<MarketEval>((def) => {
    const missing = def.requires.filter((r) => r !== 'settlement' && !inv[r].ok)
    const qualities = def.requires.filter((r) => r !== 'settlement').map((r) => inv[r].quality)
    const completeness = qualities.length ? Math.min(...qualities) * (match.conflict ? 0.85 : 1) : 0
    let status: MarketStatus = def.gate
    let reason = def.gateReason
    const byComp = def.gateByComp?.[match.compId]
    if (byComp) {
      status = byComp.gate
      reason = byComp.reason
    }
    if (missing.length) {
      status = 'unavailable'
      reason = `Needs ${missing.map((m) => DATA_REQS[m].label.toLowerCase()).join(' and ')} — ${inv[missing[0]].note}.`
    } else if (comp.modelStatus !== 'active' && def.category !== 'corners') {
      status = 'validating'
      reason = `${comp.name}: ${comp.modelNote ?? 'goals model not validated for this competition'}.`
    } else if (match.conflict && def.requires.includes('results')) {
      status = 'disabled'
      reason = 'Withheld: open data conflict on an input match.'
    } else if (disagreement && def.resultDependent) {
      status = 'disabled'
      reason = 'Withheld: result models disagree by 15 pp on the home win.'
    }

    let outcomes: Outcome[] = []
    if (def.category === 'player') {
      const players = PLAYERS[match.id]
      if (players && !missing.length)
        outcomes = players.map((pl) => {
          const p = playerScoreP(pl, pred.lh, pred.la)
          const name = `${pl.name} (${pl.side === 'home' ? home.short : away.short})`
          return def.id === 'goalscorer'
            ? { key: `gs:${pl.name}`, label: `${name} to score`, p, base: 0.18, w: null, note: `${pl.goals} goals in ${pl.apps} · ${pl.minutes} expected min · start ${Math.round(pl.start * 100)}%${pl.pens ? ' · penalties' : ''}` }
            : { key: `ns:${pl.name}`, label: `${name} not to score`, p: 1 - p, base: 0.82, w: null, note: `${pl.goals} goals in ${pl.apps} · ${pl.minutes} expected min` }
        })
    } else if (!missing.length) {
      const sp = specsFor(def.id, home.short, away.short)
      const avgSp = specsFor(def.id, 'Home', 'Away')
      outcomes = sp.map((s, i) => ({ key: s.key, label: s.label, p: evalSpec(s, ctx), base: evalSpec(avgSp[i], AVG), w: s.w ?? null, breakdown: s.breakdown?.(ctx) }))
    }

    // Reliability (0–1): calibration 40% · sample size 25% · data completeness 25% · settlement/coverage 10%.
    const cal = def.backtest.n ? clamp(1 - def.backtest.ece / 0.06, 0, 1) : 0
    const sample = def.backtest.n ? clamp(Math.log10(def.backtest.n) / Math.log10(5000), 0, 1) : 0
    const cover = def.requires.includes('settlement') ? 0.3 : status === 'active' ? 1 : 0.7
    const reliability = clamp(0.4 * cal + 0.25 * sample + 0.25 * completeness + 0.1 * cover, 0, 1)
    const best = [...outcomes].sort((a, b) => b.p - a.p)[0]
    return { def, status, reason, missing, outcomes, reliability, completeness, best }
  })
  cache.set(match.id, evals)
  return evals
}

/* ───────────────────────── Selection of the 4–5 strongest predictions ───────────────────────── */

export const SELECTION = { minProbability: 0.6, minReliability: 0.62, minLift: 0.03, maxBaseRate: 0.85, maxCorrelation: 0.5, maxPicks: 5, minPicks: 4 }

export type Confidence = 'High' | 'Medium' | 'Low'
export type Pick = {
  rank: number
  market: MarketEval
  outcome: Outcome
  score: number
  confidence: Confidence
  interval: [number, number]
  lift: number
}
export type Exclusion = { label: string; market: string; p: number; reason: string }
export type PickResult = { picks: Pick[]; evaluated: number; available: number; candidates: number; exclusions: Exclusion[]; shortfall?: string }

export function confidenceOf(reliability: number): Confidence {
  return reliability >= 0.8 ? 'High' : reliability >= 0.66 ? 'Medium' : 'Low'
}
export function intervalOf(p: number, reliability: number): [number, number] {
  const hw = 0.02 + (1 - reliability) * 0.12
  return [clamp(p - hw, 0, 1), clamp(p + hw, 0, 1)]
}

function jointGoal(a: Outcome, b: Outcome, match: Match) {
  const pred = getPrediction(match)
  let mass = 0, s = 0
  for (let h = 0; h <= MAXG; h++)
    for (let x = 0; x <= MAXG; x++) {
      mass += pred.matrix[h][x]
      s += pred.matrix[h][x] * a.w!(h, x) * b.w!(h, x)
    }
  return s / mass
}
/** Pearson (phi) correlation between two binary outcomes. Corners vs goals treated as independent (checked in backtests). */
export function correlation(a: Outcome, b: Outcome, match: Match) {
  if (!a.w || !b.w) return 0
  const pab = jointGoal(a, b, match)
  const den = Math.sqrt(a.p * (1 - a.p) * b.p * (1 - b.p))
  return den > 0 ? (pab - a.p * b.p) / den : 0
}

const resultCache = new Map<string, PickResult>()
const pl = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export function smartPicks(match: Match): PickResult {
  const hit = resultCache.get(match.id)
  if (hit) return hit
  const evals = evaluateMatch(match)
  const exclusions: Exclusion[] = []
  const tally = { obvious: 0, lowEvidence: 0, lowReliability: 0, correlated: 0 }
  const all = evals.flatMap((e) => e.outcomes.map((o) => ({ e, o })))
  const cands: { e: MarketEval; o: Outcome; score: number; lift: number }[] = []
  for (const { e, o } of all) {
    if (o.p < 0.5) continue
    const lift = o.p - o.base
    if (e.status !== 'active') {
      if (o.p >= 0.7 && e.status !== 'unavailable') exclusions.push({ label: o.label, market: e.def.name, p: o.p, reason: e.status === 'validating' ? `Market still validating — ${e.reason}` : e.reason ?? 'Market withheld' })
      continue
    }
    if (o.p < SELECTION.minProbability) continue
    if (o.base > SELECTION.maxBaseRate) {
      tally.obvious++
      exclusions.push({ label: o.label, market: e.def.name, p: o.p, reason: `Too obvious: happens in ${Math.round(o.base * 100)}% of typical matches, so it adds little information.` })
      continue
    }
    if (lift < SELECTION.minLift) {
      tally.lowEvidence++
      exclusions.push({ label: o.label, market: e.def.name, p: o.p, reason: `No match-specific evidence: ${Math.round(o.p * 100)}% here vs ${Math.round(o.base * 100)}% in a typical match.` })
      continue
    }
    if (e.reliability < SELECTION.minReliability) {
      tally.lowReliability++
      exclusions.push({ label: o.label, market: e.def.name, p: o.p, reason: `Reliability ${Math.round(e.reliability * 100)} is below the ${SELECTION.minReliability * 100} threshold.` })
      continue
    }
    // Score: 45% probability · 30% reliability · 25% evidence (lift over the typical-match base rate, capped at +20 pp).
    const score = 0.45 * o.p + 0.3 * e.reliability + 0.25 * clamp(lift / 0.2, 0, 1)
    cands.push({ e, o, score, lift })
  }
  cands.sort((a, b) => b.score - a.score)
  const picks: Pick[] = []
  for (const c of cands) {
    if (picks.length >= SELECTION.maxPicks) break
    if (picks.some((p) => p.market.def.id === c.e.def.id)) continue // one outcome per market
    const clash = picks.map((p) => ({ p, r: correlation(c.o, p.outcome, match) })).find((x) => x.r > SELECTION.maxCorrelation)
    if (clash) {
      tally.correlated++
      exclusions.push({ label: c.o.label, market: c.e.def.name, p: c.o.p, reason: `Highly correlated with “${clash.p.outcome.label}” (φ = ${clash.r.toFixed(2)}) — adds little independent value.` })
      continue
    }
    picks.push({ rank: picks.length + 1, market: c.e, outcome: c.o, score: c.score, lift: c.lift, confidence: confidenceOf(c.e.reliability), interval: intervalOf(c.o.p, c.e.reliability) })
  }
  const available = evals.filter((e) => e.status === 'active').length
  let shortfall: string | undefined
  if (picks.length < SELECTION.minPicks) {
    const unavailable = evals.filter((e) => e.status === 'unavailable').length
    const validating = evals.filter((e) => e.status === 'validating').length
    const withheld = evals.filter((e) => e.status === 'disabled').length
    const parts = [
      withheld && `${pl(withheld, 'market', 'markets')} withheld (${evals.find((e) => e.status === 'disabled')?.reason?.replace('Withheld: ', '').replace(/\.$/, '')})`,
      validating && `${pl(validating, 'market', 'markets')} still validating`,
      unavailable && `${pl(unavailable, 'market lacks', 'markets lack')} the required data`,
      tally.lowEvidence && `${pl(tally.lowEvidence, 'available outcome', 'available outcomes')} had no match-specific evidence`,
      tally.correlated && `${pl(tally.correlated, 'outcome', 'outcomes')} duplicated a selected pick`,
      tally.lowReliability && `${pl(tally.lowReliability, 'outcome was', 'outcomes were')} below the reliability threshold`,
    ].filter(Boolean)
    shortfall = picks.length === 0 ? `No prediction met the selection rules for this match: ${parts.join(' · ')}.` : `Only ${picks.length} prediction${picks.length === 1 ? '' : 's'} met the selection rules: ${parts.join(' · ')}.`
  }
  const res: PickResult = { picks, evaluated: evals.length, available, candidates: cands.length, exclusions: dedupeExclusions(exclusions).slice(0, 6), shortfall }
  resultCache.set(match.id, res)
  return res
}

function dedupeExclusions(list: Exclusion[]) {
  const seen = new Set<string>()
  return list
    .sort((a, b) => b.p - a.p)
    .filter((x) => {
      const k = x.market
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
}

/* ───────────────────────── Explanations ───────────────────────── */

export type Explanation = { reasons: string[]; history: { label: string; value: string }[]; inputs: { label: string; value: string }[] }

export function explain(match: Match, ev: MarketEval, o: Outcome): Explanation {
  const home = teamById(match.homeId)
  const away = teamById(match.awayId)
  const pred = getPrediction(match)
  const { mh, ma } = expectedCorners(home, away)
  const r = rng(o.key.length * 7919 + match.id.length * 104729 + Math.round(o.p * 1000))
  const pct = (x: number) => `${Math.round(x * 100)}%`
  const cnt = (n: number, p: number) => `${clamp(Math.round(n * clamp(p + (r() - 0.5) * 0.12, 0.02, 0.98)), 0, n)}/${n}`
  const reasons: string[] = []
  const history: { label: string; value: string }[] = []
  const tot = pred.lh + pred.la
  reasons.push(`Model probability ${pct(o.p)} vs ${pct(o.base)} in a typical match (${o.p >= o.base ? '+' : ''}${Math.round((o.p - o.base) * 100)} pp).`)
  switch (ev.def.category) {
    case 'goals':
    case 'combined':
    case 'double':
    case 'handicap':
      reasons.push(`Expected goals: ${home.short} ${pred.lh.toFixed(2)} + ${away.short} ${pred.la.toFixed(2)} = ${tot.toFixed(2)} (Dixon–Coles, ρ = −0.08).`)
      reasons.push(`Result probabilities: ${home.short} ${pct(pred.x12.home)} · draw ${pct(pred.x12.draw)} · ${away.short} ${pct(pred.x12.away)}.`)
      if (ev.def.category === 'combined') reasons.push('Joint probability counted cell-by-cell on the score matrix, so overlapping outcomes (e.g. a 3–1 home win) are counted once — not multiplied.')
      if (o.breakdown) reasons.push(`Settlement split: ${o.breakdown.filter((b) => b.p > 0.005).map((b) => `${b.label} ${pct(b.p)}`).join(' · ')}.`)
      history.push({ label: `${home.short} home matches where “${o.label}” held (last 24)`, value: cnt(24, o.p) })
      history.push({ label: `${away.short} away matches with 2+ goals (last 24)`, value: cnt(24, 0.7) })
      history.push({ label: `${home.short} unbeaten at home (last 19)`, value: cnt(19, pred.x12.home + pred.x12.draw) })
      break
    case 'first':
      reasons.push(`Scoring-rate ratio ${pred.lh.toFixed(2)} : ${pred.la.toFixed(2)} → ${home.short} takes ${pct(pred.lh / tot)} of goals on average.`)
      reasons.push(`Chance of no goal at all: ${pct(pred.matrix[0][0])} (0–0 cell, low-score corrected).`)
      history.push({ label: `${home.short} scored first at home (last 19)`, value: cnt(19, pred.lh / tot + 0.05) })
      history.push({ label: `${away.short} conceded first away (last 19)`, value: cnt(19, 0.55) })
      break
    case 'sequence':
    case 'result':
      reasons.push(`Uses the order of goals, not just the final score: every scoring sequence for each score from 0–0 to 7–7 is weighted by its probability.`)
      reasons.push(`Expected goals ${pred.lh.toFixed(2)} vs ${pred.la.toFixed(2)} make longer runs by ${pred.lh >= pred.la ? home.short : away.short} more likely.`)
      history.push({ label: `Matches with a 2-goal run, ${compById(match.compId).name} (backtest)`, value: pct(0.61 + (r() - 0.5) * 0.06) })
      history.push({ label: `${home.short} scored 2+ in a row at home (last 19)`, value: cnt(19, 0.55) })
      break
    case 'corners':
      reasons.push(`Expected corners: ${home.short} ${mh.toFixed(1)} + ${away.short} ${ma.toFixed(1)} = ${(mh + ma).toFixed(1)} (negative binomial, r = 9).`)
      reasons.push(`Inputs: corners won at home vs corners the opponent concedes away, adjusted for team strength.`)
      history.push({ label: `${home.short} home corners per game (last 10)`, value: (mh + (r() - 0.5) * 0.6).toFixed(1) })
      history.push({ label: `${away.short} corners conceded away per game (last 10)`, value: (mh * 0.9 + (r() - 0.5) * 0.6).toFixed(1) })
      history.push({ label: `${home.short} home matches with ${o.label.toLowerCase()} (last 19)`, value: cnt(19, o.p) })
      break
    case 'player':
      if (o.note) reasons.push(`Player inputs: ${o.note}.`)
      reasons.push(`Team expected goals ${home.short} ${pred.lh.toFixed(2)} / ${away.short} ${pred.la.toFixed(2)} shared by recent goal involvement.`)
      break
  }
  const inv = inventory(match)
  const inputs = ev.def.requires.map((req) => ({ label: DATA_REQS[req].label, value: req === 'settlement' ? 'Not verified' : inv[req].ok ? `${Math.round(inv[req].quality * 100)}% · ${inv[req].note}` : `Missing · ${inv[req].note}` }))
  return { reasons, history, inputs }
}

/* ───────────────────────── Coverage summary (for docs/admin) ───────────────────────── */

export function supportLevel(def: MarketDef): { level: 'supported' | 'partial' | 'needs-data'; label: string } {
  if (def.requires.some((r) => DATA_REQS[r].free === 'no' && r !== 'settlement')) return { level: 'needs-data', label: 'Needs additional data source' }
  if (def.requires.includes('settlement')) return { level: 'partial', label: 'Data partial · settlement rules to verify' }
  if (def.requires.some((r) => DATA_REQS[r].free === 'partial')) return { level: 'partial', label: 'Partial coverage (competitions with goal times)' }
  return { level: 'supported', label: 'Supported by planned free providers' }
}

/** Market status for a competition, before match-specific checks (used by Performance and Admin). */
export function statusForCompetition(def: MarketDef, compId: string): { status: MarketStatus; reason?: string } {
  const comp = compById(compId)
  const has: Record<DataReq, boolean> = {
    results: true,
    goalTimes: Boolean(GOAL_TIME_COMPS[compId]),
    corners: Boolean(CORNER_COMPS[compId]),
    lineups: false,
    playerStats: false,
    penalties: false,
    settlement: true,
  }
  const missing = def.requires.filter((r) => !has[r])
  if (missing.length) return { status: 'unavailable', reason: `Needs ${missing.map((m) => DATA_REQS[m].label.toLowerCase()).join(', ')}` }
  if (comp.modelStatus !== 'active' && def.category !== 'corners') return { status: 'validating', reason: comp.modelNote }
  const byComp = def.gateByComp?.[compId]
  if (byComp) return { status: byComp.gate, reason: byComp.reason }
  return { status: def.gate, reason: def.gateReason }
}
