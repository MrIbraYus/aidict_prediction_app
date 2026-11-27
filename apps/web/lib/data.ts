import 'server-only'
import { cookies } from 'next/headers'
import { createClient } from './supabase/server'
import type { CompetitionVM, FixtureVM, GateVM, MarketDefVM, MarketStatusVM, OutcomeVM, PickVM, SnapshotVM, TeamVM, X12 } from './types'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = any

export async function viewerTimeZone(): Promise<string> {
  const c = (await cookies()).get('aidict-tz')?.value
  try {
    if (c) new Intl.DateTimeFormat('en-GB', { timeZone: c })
    return c || 'UTC'
  } catch {
    return 'UTC'
  }
}

const TEAM_COLS = 'id,name,short_name,tla,badge:team_badges(source_url,override_url,kind,contrast_hint)'
const FIXTURE_COLS = `id,kickoff_at,status,round,venue,season:seasons!inner(label,competition:competitions!inner(id,code,name,country,type,is_active)),
  home:teams!fixtures_home_team_id_fkey(${TEAM_COLS}),away:teams!fixtures_away_team_id_fkey(${TEAM_COLS}),result:match_results(ft_home,ft_away,ht_home,ht_away,is_final)`

function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null)
}

export function team(r: Row): TeamVM {
  const b = one(r.badge) as Row
  return { id: r.id, name: r.name, short: r.short_name || r.name, tla: r.tla, crest: b?.override_url || b?.source_url || null, kind: b?.kind ?? 'club-crest', contrast: b?.contrast_hint ?? null }
}

function competition(r: Row): CompetitionVM {
  return { id: r.id, code: r.code, name: r.name, country: r.country, type: r.type }
}

function fixture(r: Row): FixtureVM {
  const res = one(r.result) as Row
  return {
    id: r.id, kickoff: r.kickoff_at, status: r.status, round: r.round, venue: r.venue, season: r.season.label,
    competition: competition(r.season.competition), home: team(r.home), away: team(r.away),
    score: res ? [res.ft_home, res.ft_away] : null, ht: res && res.ht_home != null ? [res.ht_home, res.ht_away] : null, final: !!res?.is_final,
  }
}

function matrix(bp: number[] | null): number[][] {
  const m: number[][] = []
  for (let h = 0; h < 10; h++) m.push(Array.from({ length: 10 }, (_, a) => (bp?.[h * 10 + a] ?? 0) / 10000))
  return m
}

/** Latest snapshot per fixture with 1X2 probabilities. */
async function snapshotsFor(ids: number[]): Promise<Map<number, SnapshotVM>> {
  const out = new Map<number, SnapshotVM>()
  if (!ids.length) return out
  const sb = await createClient()
  const { data: snaps } = await sb
    .from('prediction_snapshots')
    .select('id,fixture_id,snapshot_at,horizon,lambda_home,lambda_away,score_matrix,input_hash,inputs,model_version:model_versions(version)')
    .in('fixture_id', ids)
    .order('snapshot_at', { ascending: false })
  for (const s of snaps ?? []) {
    if (out.has(s.fixture_id)) continue
    const inputs = (s.inputs ?? {}) as Row
    out.set(s.fixture_id, {
      id: s.id, snapshotAt: s.snapshot_at, horizon: s.horizon, lambdaHome: Number(s.lambda_home), lambdaAway: Number(s.lambda_away),
      matrix: matrix(s.score_matrix), inputHash: s.input_hash, modelVersion: (one(s.model_version) as Row)?.version ?? '—', x12: null,
      selection: inputs.selection ?? null, inputs,
    })
  }
  const snapIds = [...out.values()].map((s) => s.id)
  if (snapIds.length) {
    const { data: probs } = await sb.from('market_outcome_probabilities').select('snapshot_id,outcome_key,probability').eq('market_id', '1x2').in('snapshot_id', snapIds)
    const bySnap = new Map<string, X12>()
    for (const p of probs ?? []) {
      const x = bySnap.get(p.snapshot_id) ?? { home: 0, draw: 0, away: 0 }
      x[p.outcome_key as keyof X12] = Number(p.probability)
      bySnap.set(p.snapshot_id, x)
    }
    for (const s of out.values()) s.x12 = bySnap.get(s.id) ?? null
  }
  return out
}

let marketNames: Map<string, MarketDefVM> | null = null
export async function marketDefinitions(): Promise<Map<string, MarketDefVM>> {
  if (marketNames) return marketNames
  const sb = await createClient()
  const { data } = await sb.from('market_definitions').select('id,name,category,required_data,settlement_verified')
  marketNames = new Map((data ?? []).map((d: Row) => [d.id, { id: d.id, name: d.name, category: d.category, requiredData: d.required_data ?? [], settlementVerified: d.settlement_verified }]))
  return marketNames
}

async function picksFor(snapIds: string[]): Promise<Map<string, PickVM[]>> {
  const out = new Map<string, PickVM[]>()
  if (!snapIds.length) return out
  const sb = await createClient()
  const defs = await marketDefinitions()
  const { data } = await sb.from('smart_picks').select('id,snapshot_id,rank,market_id,outcome_key,probability,reliability,confidence,lift,score,reasons,outcome:pick_outcomes(result)').in('snapshot_id', snapIds).order('rank')
  for (const p of data ?? []) {
    const r = (p.reasons ?? {}) as Row
    const def = defs.get(p.market_id)
    const list = out.get(p.snapshot_id) ?? []
    list.push({
      id: p.id, rank: p.rank, market: p.market_id, marketName: def?.name ?? p.market_id, category: def?.category ?? 'other', outcome: p.outcome_key,
      label: r.label ?? p.outcome_key, p: Number(p.probability), reliability: Number(p.reliability), confidence: p.confidence, lift: Number(p.lift),
      score: Number(p.score), interval: (r.interval ?? [p.probability, p.probability]).map(Number) as [number, number], reasons: r.reasons ?? [],
      result: (one(p.outcome) as Row)?.result ?? null,
    })
    out.set(p.snapshot_id, list)
  }
  return out
}

export async function getFixtures(opts: { from: string; to: string; competition?: string; withPicks?: boolean; limit?: number }): Promise<FixtureVM[]> {
  const sb = await createClient()
  let q = sb.from('fixtures').select(FIXTURE_COLS).gte('kickoff_at', opts.from).lt('kickoff_at', opts.to).order('kickoff_at').limit(opts.limit ?? 400)
  q = opts.competition ? q.eq('season.competition.code', opts.competition) : q.eq('season.competition.is_active', true)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  const fx = (data ?? []).map(fixture)
  const snaps = await snapshotsFor(fx.map((f) => f.id))
  fx.forEach((f) => (f.snapshot = snaps.get(f.id)))
  if (opts.withPicks) {
    const picks = await picksFor([...snaps.values()].map((s) => s.id))
    fx.forEach((f) => (f.picks = f.snapshot ? (picks.get(f.snapshot.id) ?? []) : []))
  }
  return fx
}

export async function getFixture(id: number): Promise<(FixtureVM & { outcomes: OutcomeVM[]; inventory: Row[] }) | null> {
  const sb = await createClient()
  const { data } = await sb.from('fixtures').select(FIXTURE_COLS).eq('id', id).maybeSingle()
  if (!data) return null
  const f = fixture(data)
  const snaps = await snapshotsFor([id])
  f.snapshot = snaps.get(id)
  let outcomes: OutcomeVM[] = []
  if (f.snapshot) {
    f.picks = (await picksFor([f.snapshot.id])).get(f.snapshot.id) ?? []
    const { data: probs } = await sb.from('market_outcome_probabilities').select('market_id,outcome_key,probability,base_rate,reliability,completeness,status,breakdown').eq('snapshot_id', f.snapshot.id)
    outcomes = (probs ?? []).map((p: Row) => ({
      market: p.market_id, outcome: p.outcome_key, label: p.breakdown?.label ?? p.outcome_key, p: Number(p.probability), base: p.base_rate != null ? Number(p.base_rate) : null,
      reliability: p.reliability, completeness: p.completeness, status: p.status, reason: p.breakdown?.reason ?? null,
    }))
  }
  const { data: inventory } = await sb.from('fixture_data_inventory').select('data_type,available,completeness,source,as_of').eq('fixture_id', id)
  return { ...f, outcomes, inventory: inventory ?? [] }
}

export async function getTeamResults(teamId: number, before: string, limit = 6): Promise<FixtureVM[]> {
  const sb = await createClient()
  const { data } = await sb.from('fixtures').select(FIXTURE_COLS).or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`).lt('kickoff_at', before).in('status', ['FT', 'AET', 'PEN', 'AWARDED']).order('kickoff_at', { ascending: false }).limit(limit)
  return (data ?? []).map(fixture)
}

export async function getHeadToHead(a: number, b: number, limit = 8): Promise<FixtureVM[]> {
  const sb = await createClient()
  const { data } = await sb.from('fixtures').select(FIXTURE_COLS)
    .or(`and(home_team_id.eq.${a},away_team_id.eq.${b}),and(home_team_id.eq.${b},away_team_id.eq.${a})`)
    .in('status', ['FT', 'AET', 'PEN', 'AWARDED']).order('kickoff_at', { ascending: false }).limit(limit)
  return (data ?? []).map(fixture)
}

export async function getMarketStatuses(competitionId: number): Promise<Map<string, MarketStatusVM>> {
  const sb = await createClient()
  const { data } = await sb.from('market_competition_status').select('market_id,status,reason,oos_n,log_loss,ece').eq('competition_id', competitionId)
  return new Map((data ?? []).map((r: Row) => [r.market_id, { market: r.market_id, status: r.status, reason: r.reason, n: r.oos_n, logLoss: r.log_loss, ece: r.ece }]))
}

export async function getGates(): Promise<GateVM[]> {
  const sb = await createClient()
  const { data } = await sb.from('outcome_gates').select('market_id,outcome_key,label,status,reason,n,log_loss,base_log_loss,ece,passes_in_row,competition:competitions(code)').order('market_id')
  return (data ?? []).map((g: Row) => ({
    market: g.market_id, outcome: g.outcome_key, label: g.label, competition: (one(g.competition) as Row)?.code ?? '', status: g.status, reason: g.reason, n: g.n,
    logLoss: g.log_loss != null ? Number(g.log_loss) : null, baseLogLoss: g.base_log_loss != null ? Number(g.base_log_loss) : null, ece: g.ece != null ? Number(g.ece) : null, passesInRow: g.passes_in_row,
  }))
}

export async function getBacktestRuns(): Promise<Row[]> {
  const sb = await createClient()
  const { data } = await sb.from('backtest_runs').select('id,config,split,metrics,finished_at').order('finished_at', { ascending: false }).limit(20)
  const seen = new Set<string>()
  return (data ?? []).filter((r: Row) => {
    const c = r.config?.competition
    if (!c || seen.has(c)) return false
    seen.add(c)
    return true
  })
}

export async function getCompetitions(): Promise<(CompetitionVM & { season: string | null; fixtures: number; results: number })[]> {
  const sb = await createClient()
  const { data } = await sb.from('competitions').select('id,code,name,country,type,is_active,seasons(id,label,is_current)').eq('is_active', true).order('id')
  const out = []
  for (const c of data ?? []) {
    const cur = (c.seasons ?? []).find((s: Row) => s.is_current)
    let fixtures = 0, results = 0
    if (cur) {
      const { count } = await sb.from('fixtures').select('id', { count: 'exact', head: true }).eq('season_id', cur.id)
      const { count: rc } = await sb.from('fixtures').select('id', { count: 'exact', head: true }).eq('season_id', cur.id).in('status', ['FT', 'AET', 'PEN'])
      fixtures = count ?? 0
      results = rc ?? 0
    }
    out.push({ ...competition(c), season: cur?.label ?? null, fixtures, results })
  }
  return out
}

export type StandingRow = { team: TeamVM; p: number; w: number; d: number; l: number; gf: number; ga: number; pts: number; form: ('W' | 'D' | 'L')[] }

/** Standings computed from stored final results (never fabricated). */
export async function getStandings(code: string): Promise<{ competition: CompetitionVM | null; season: string | null; rows: StandingRow[]; upcoming: FixtureVM[] }> {
  const sb = await createClient()
  const { data: comp } = await sb.from('competitions').select('id,code,name,country,type,seasons(id,label,is_current)').eq('code', code).maybeSingle()
  if (!comp) return { competition: null, season: null, rows: [], upcoming: [] }
  const cur = (comp.seasons ?? []).find((s: Row) => s.is_current)
  if (!cur) return { competition: competition(comp), season: null, rows: [], upcoming: [] }
  const { data } = await sb.from('fixtures').select(FIXTURE_COLS).eq('season_id', cur.id).order('kickoff_at').limit(1000)
  const fx = (data ?? []).map(fixture)
  const table = new Map<number, StandingRow>()
  const row = (t: TeamVM) => table.get(t.id) ?? (table.set(t.id, { team: t, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: [] }), table.get(t.id)!)
  for (const f of fx) {
    row(f.home); row(f.away)
    if (!f.final || !f.score) continue
    const [h, a] = f.score
    const H = row(f.home), A = row(f.away)
    H.p++; A.p++; H.gf += h; H.ga += a; A.gf += a; A.ga += h
    if (h > a) { H.w++; A.l++; H.pts += 3; H.form.push('W'); A.form.push('L') }
    else if (h < a) { A.w++; H.l++; A.pts += 3; H.form.push('L'); A.form.push('W') }
    else { H.d++; A.d++; H.pts++; A.pts++; H.form.push('D'); A.form.push('D') }
  }
  const rows = [...table.values()].map((r) => ({ ...r, form: r.form.slice(-5) })).sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf)
  const now = new Date().toISOString()
  return { competition: competition(comp), season: cur.label, rows, upcoming: fx.filter((f) => f.kickoff >= now).slice(0, 12) }
}

export async function getTeam(id: number) {
  const sb = await createClient()
  const { data } = await sb.from('teams').select(`${TEAM_COLS},country,is_national`).eq('id', id).maybeSingle()
  if (!data) return null
  const { data: fx } = await sb.from('fixtures').select(FIXTURE_COLS).or(`home_team_id.eq.${id},away_team_id.eq.${id}`).order('kickoff_at', { ascending: false }).limit(60)
  const fixtures = (fx ?? []).map(fixture)
  const badge = one(data.badge) as Row
  return { team: team(data), badge, fixtures }
}

export async function getProvidersStatus() {
  const sb = await createClient()
  const [{ data: providers }, { data: jobs }] = await Promise.all([
    sb.from('data_providers').select('id,name,kind,licence,attribution_text,reliability_weight,daily_budget,minute_budget,is_enabled').order('reliability_weight', { ascending: false }),
    sb.from('scheduled_sync_jobs').select('job,cron,runner,last_run_at,last_status,is_enabled').order('job'),
  ])
  const { data: logs } = await sb.from('provider_sync_logs').select('provider_id,job,endpoint,status_code,rows_upserted,quota_remaining,error,started_at').order('started_at', { ascending: false }).limit(40)
  return { providers: providers ?? [], jobs: jobs ?? [], logs: logs ?? [] }
}

/** Track record: only each match's official picks, i.e. those from its latest snapshot (earlier previews are superseded, not counted). */
export async function getHistory(limit = 200) {
  const sb = await createClient()
  const defs = await marketDefinitions()
  const { data } = await sb.from('smart_picks')
    .select(`id,snapshot_id,rank,market_id,outcome_key,probability,confidence,published_at,reasons,outcome:pick_outcomes(result,settled_at),fixture:fixtures(${FIXTURE_COLS})`)
    .order('published_at', { ascending: false }).limit(limit * 3)
  const rows = data ?? []
  const fixtureIds = [...new Set(rows.map((p: Row) => p.fixture?.id).filter(Boolean))]
  const latest = new Map<number, string>()
  if (fixtureIds.length) {
    const { data: snaps } = await sb.from('prediction_snapshots').select('id,fixture_id,snapshot_at').in('fixture_id', fixtureIds).order('snapshot_at', { ascending: false })
    for (const s of snaps ?? []) if (!latest.has(s.fixture_id)) latest.set(s.fixture_id, s.id)
  }
  return rows
    .filter((p: Row) => latest.get(p.fixture?.id) === p.snapshot_id)
    .slice(0, limit)
    .map((p: Row) => ({
      id: p.id, rank: p.rank, market: defs.get(p.market_id)?.name ?? p.market_id, label: p.reasons?.label ?? p.outcome_key, p: Number(p.probability), confidence: p.confidence,
      publishedAt: p.published_at, result: (one(p.outcome) as Row)?.result ?? null, fixture: fixture(p.fixture),
    }))
}

export async function getSavedIds(): Promise<Set<number>> {
  const sb = await createClient()
  const { data } = await sb.from('saved_matches').select('fixture_id')
  return new Set((data ?? []).map((r: Row) => r.fixture_id))
}

export async function getPreferences() {
  const sb = await createClient()
  const { data } = await sb.from('user_preferences').select('*').maybeSingle()
  return data as Row | null
}

/** Sidebar / top bar summary: unread count, live matches, pipeline freshness (scheduled_sync_jobs is readable by members). */
export async function getShellInfo() {
  const sb = await createClient()
  const [{ count: unread }, { count: live }, { data: jobs }] = await Promise.all([
    sb.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null),
    sb.from('fixtures').select('id', { count: 'exact', head: true }).in('status', ['LIVE', 'HT']),
    sb.from('scheduled_sync_jobs').select('job,last_run_at,last_status,is_enabled').eq('is_enabled', true),
  ])
  const ran = (jobs ?? []).filter((j: Row) => j.last_run_at)
  const lastSync = (jobs ?? []).find((j: Row) => j.job === 'sync_current')?.last_run_at ?? null
  return { unread: unread ?? 0, live: live ?? 0, lastSync, sourcesOk: ran.filter((j: Row) => j.last_status === 'success').length, sourcesTotal: ran.length }
}

export async function getSavedFixtures(): Promise<FixtureVM[]> {
  const sb = await createClient()
  const { data: saved } = await sb.from('saved_matches').select('fixture_id,created_at').order('created_at', { ascending: false }).limit(200)
  const ids = (saved ?? []).map((r: Row) => r.fixture_id)
  if (!ids.length) return []
  const { data } = await sb.from('fixtures').select(FIXTURE_COLS).in('id', ids).order('kickoff_at')
  const fx = (data ?? []).map(fixture)
  const snaps = await snapshotsFor(fx.map((f) => f.id))
  const picks = await picksFor([...snaps.values()].map((s) => s.id))
  fx.forEach((f) => {
    f.snapshot = snaps.get(f.id)
    f.picks = f.snapshot ? (picks.get(f.snapshot.id) ?? []) : []
  })
  return fx
}

export async function getNotifications(limit = 100) {
  const sb = await createClient()
  const { data } = await sb.from('notifications').select('id,category,title,body,fixture_id,read_at,created_at').order('created_at', { ascending: false }).limit(limit)
  return (data ?? []) as { id: number; category: string; title: string; body: string; fixture_id: number | null; read_at: string | null; created_at: string }[]
}

export async function searchAll(q: string) {
  const sb = await createClient()
  const term = q.replace(/[%_,()]/g, ' ').trim().slice(0, 60)
  if (term.length < 2) return { teams: [] as TeamVM[], competitions: [] as CompetitionVM[] }
  const [{ data: teams }, { data: comps }] = await Promise.all([
    sb.from('teams').select(TEAM_COLS).or(`name.ilike.%${term}%,short_name.ilike.%${term}%,tla.ilike.${term}`).order('name').limit(30),
    sb.from('competitions').select('id,code,name,country,type').or(`name.ilike.%${term}%,code.ilike.${term}`).limit(10),
  ])
  return { teams: (teams ?? []).map(team), competitions: (comps ?? []).map(competition) }
}

/** Admin overview (RLS limits these reads to admins). */
export async function getAdminOverview() {
  const sb = await createClient()
  const [{ data: flags }, { data: settings }, { data: audit }, { count: conflicts }, { data: quality }] = await Promise.all([
    sb.from('feature_flags').select('key,enabled,description').order('key'),
    sb.from('app_settings').select('key,value,updated_at'),
    sb.from('audit_logs').select('id,actor,action,entity,entity_id,created_at').order('created_at', { ascending: false }).limit(25),
    sb.from('data_conflicts').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    sb.from('data_conflicts').select('id,fixture_id,field,values,status,created_at').order('created_at', { ascending: false }).limit(15),
  ])
  return { flags: flags ?? [], settings: settings ?? [], audit: audit ?? [], openConflicts: conflicts ?? 0, conflicts: quality ?? [] }
}

/** False when the Supabase project has no AIDICT tables yet (schema not applied). */
export async function schemaReady(): Promise<boolean> {
  const sb = await createClient()
  const { error } = await sb.from('sports').select('id').limit(1)
  return !error || (error.code !== 'PGRST205' && error.code !== '42P01')
}
