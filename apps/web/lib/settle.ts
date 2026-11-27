/**
 * Settles a My Picks selection from official data, mirroring the engine's settlement rules
 * (services/prediction-engine/aidict_engine/market_eval.py and corners.py). Returns null while data is not available yet.
 */
export type PickResult = 'won' | 'lost' | 'void'
export type MatchFacts = { ft: [number, number] | null; corners: [number, number] | null; seq: string | null }

const b = (x: boolean): PickResult => (x ? 'won' : 'lost')

function seqStats(seq: string) {
  let d = 0, maxd = 0, mind = 0, run = 0, last = 0, mhr = 0, mar = 0
  for (const c of seq) {
    if (c === 'H') {
      d++
      run = last === 1 ? run + 1 : 1
      last = 1
      mhr = Math.max(mhr, run)
    } else {
      d--
      run = last === -1 ? run + 1 : 1
      last = -1
      mar = Math.max(mar, run)
    }
    maxd = Math.max(maxd, d)
    mind = Math.min(mind, d)
  }
  return { homeLead1: maxd >= 1, homeLead2: maxd >= 2, homeNeverTrail: mind >= 0, anyRun2: Math.max(mhr, mar) >= 2, anyRun3: Math.max(mhr, mar) >= 3, homeRun2: mhr >= 2, homeRun3: mhr >= 3, awayRun2: mar >= 2, first: seq[0] ?? '' }
}

export function settlePick(market: string, outcome: string, f: MatchFacts): PickResult | null {
  if (market.startsWith('corners')) {
    if (!f.corners) return null
    const [h, a] = f.corners
    if (market === 'corners-1x2') return b(outcome === 'home' ? h > a : outcome === 'away' ? a > h : h === a)
    const line = Number(outcome.replace(/^(over|under)/, ''))
    return b(outcome.startsWith('over') ? h + a > line : h + a < line)
  }
  if (!f.ft) return null
  const [h, a] = f.ft
  switch (market) {
    case '1x2':
      return b(outcome === 'home' ? h > a : outcome === 'away' ? a > h : h === a)
    case 'dc':
      return b(outcome === '1X' ? h >= a : outcome === 'X2' ? a >= h : h !== a)
    case 'ou': {
      const line = Number(outcome.replace(/^(over|under)/, ''))
      return b(outcome.startsWith('over') ? h + a > line : h + a < line)
    }
    case 'btts':
      return b(outcome === 'yes' ? h > 0 && a > 0 : h === 0 || a === 0)
    case 'handicap':
      return b(outcome === 'home-1' ? h - a >= 2 : h - a < 1)
    case 'asian-handicap':
      if (outcome === 'home0') return h === a ? 'void' : b(h > a)
      if (outcome === 'away0') return h === a ? 'void' : b(a > h)
      return b(h > a) // home −0.25 counted as a full win only
    case 'correct-score': {
      const [x, y] = outcome.split('-').map(Number)
      return b(h === x && a === y)
    }
  }
  const combo = market.match(/^(home|draw|away)-or-(over|under)25$/)
  if (combo) {
    const r = combo[1] === 'home' ? h > a : combo[1] === 'away' ? a > h : h === a
    return b(r || (combo[2] === 'over' ? h + a > 2.5 : h + a < 2.5))
  }
  // Goal-order markets need the real scoring sequence, consistent with the final score.
  if (!f.seq || f.seq.length !== h + a || [...f.seq].filter((c) => c === 'H').length !== h) return null
  const s = seqStats(f.seq)
  switch (market) {
    case 'first-goal':
      return b(outcome === 'home' ? s.first === 'H' : s.first === 'A')
    case 'any-2-row':
      return b(s.anyRun2)
    case 'any-3-row':
      return b(s.anyRun3)
    case 'home-2-row':
      return b(s.homeRun2)
    case 'home-3-row':
      return b(s.homeRun3)
    case 'away-2-row':
      return b(s.awayRun2)
    case '1x2-1up':
      return b(s.homeLead1)
    case '1x2-2up':
      return b(h > a || s.homeLead2)
    case '1x2-never-down':
      return b(s.homeNeverTrail)
  }
  return null
}
