export type FixtureStatus = 'SCHEDULED' | 'TIMED' | 'LIVE' | 'HT' | 'FT' | 'AET' | 'PEN' | 'POSTPONED' | 'SUSPENDED' | 'CANCELLED' | 'AWARDED'
export type MarketStatus = 'active' | 'validating' | 'disabled' | 'unavailable'

export type TeamVM = { id: number; name: string; short: string; tla: string | null; crest: string | null; kind: 'club-crest' | 'national-flag'; contrast: string | null }
export type CompetitionVM = { id: number; code: string; name: string; country: string | null; type: string }

export type X12 = { home: number; draw: number; away: number }

export type FixtureVM = {
  id: number
  kickoff: string
  status: FixtureStatus
  round: string | null
  venue: string | null
  season: string
  competition: CompetitionVM
  home: TeamVM
  away: TeamVM
  score: [number, number] | null
  ht: [number, number] | null
  final: boolean
  snapshot?: SnapshotVM
  picks?: PickVM[]
}

export type SnapshotVM = {
  id: string
  snapshotAt: string
  horizon: string
  lambdaHome: number
  lambdaAway: number
  matrix: number[][] // probabilities, 10×10
  inputHash: string
  modelVersion: string
  x12: X12 | null
  selection: { shortfall: string | null; exclusions: { label: string; market: string; p: number; reason: string }[]; picks: number } | null
  inputs: Record<string, unknown>
}

export type PickVM = {
  id: string
  rank: number
  market: string
  marketName: string
  category: string
  outcome: string
  label: string
  p: number
  reliability: number
  confidence: 'High' | 'Medium' | 'Low'
  lift: number
  score: number
  interval: [number, number] | null
  reasons: string[]
  result?: string | null
}

export type OutcomeVM = { market: string; outcome: string; label: string; p: number; base: number | null; reliability: number | null; completeness: number | null; status: MarketStatus; reason: string | null }

export type MarketDefVM = { id: string; name: string; category: string; requiredData: string[]; settlementVerified: boolean }
export type MarketStatusVM = { market: string; status: MarketStatus; reason: string | null; n: number | null; logLoss: number | null; ece: number | null }
export type GateVM = { market: string; outcome: string; label: string | null; competition: string; status: MarketStatus; reason: string | null; n: number; logLoss: number | null; baseLogLoss: number | null; ece: number | null; passesInRow: number }
