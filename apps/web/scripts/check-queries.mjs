// Runs every PostgREST query shape used by lib/data.ts against the configured Supabase project, server-side with the
// secret key (bypasses RLS: this checks syntax, joins and column names, not permissions). Never prints key values.
// Usage (repo root): node apps/web/scripts/check-queries.mjs
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync(new URL('../../../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .map((l) => l.match(/^([A-Z_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim().replace(/^"|"$/g, '')]),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const TEAM_COLS = 'id,name,short_name,tla,badge:team_badges(source_url,override_url,kind,contrast_hint)'
const FIXTURE_COLS = `id,kickoff_at,status,round,venue,season:seasons!inner(label,competition:competitions!inner(id,code,name,country,type,is_active)),
  home:teams!fixtures_home_team_id_fkey(${TEAM_COLS}),away:teams!fixtures_away_team_id_fkey(${TEAM_COLS}),result:match_results(ft_home,ft_away,ht_home,ht_away,is_final)`
const now = new Date().toISOString()
const week = new Date(Date.now() + 7 * 86400000).toISOString()

const checks = {
  'fixtures window': () => sb.from('fixtures').select(FIXTURE_COLS).eq('season.competition.is_active', true).gte('kickoff_at', now).lt('kickoff_at', week).order('kickoff_at').limit(5),
  'fixtures by competition': () => sb.from('fixtures').select(FIXTURE_COLS).eq('season.competition.code', 'PL').gte('kickoff_at', now).limit(3),
  'team results (or)': () => sb.from('fixtures').select(FIXTURE_COLS).or('home_team_id.eq.1,away_team_id.eq.1').lt('kickoff_at', now).in('status', ['FT', 'AET', 'PEN', 'AWARDED']).limit(3),
  'head to head': () => sb.from('fixtures').select(FIXTURE_COLS).or('and(home_team_id.eq.1,away_team_id.eq.2),and(home_team_id.eq.2,away_team_id.eq.1)').limit(3),
  snapshots: () => sb.from('prediction_snapshots').select('id,fixture_id,snapshot_at,horizon,lambda_home,lambda_away,score_matrix,input_hash,inputs,model_version:model_versions(version)').limit(2),
  'market probabilities': () => sb.from('market_outcome_probabilities').select('snapshot_id,market_id,outcome_key,probability,base_rate,reliability,completeness,status,breakdown').limit(2),
  'market definitions': () => sb.from('market_definitions').select('id,name,category,required_data,settlement_verified').limit(2),
  'smart picks + outcome': () => sb.from('smart_picks').select('id,snapshot_id,rank,market_id,outcome_key,probability,reliability,confidence,lift,score,reasons,outcome:pick_outcomes(result)').limit(2),
  history: () => sb.from('smart_picks').select(`id,rank,market_id,outcome_key,probability,confidence,published_at,reasons,outcome:pick_outcomes(result,settled_at),fixture:fixtures(${FIXTURE_COLS})`).order('published_at', { ascending: false }).limit(2),
  inventory: () => sb.from('fixture_data_inventory').select('data_type,available,completeness,source,as_of').limit(2),
  'market status': () => sb.from('market_competition_status').select('market_id,status,reason,oos_n,log_loss,ece').limit(2),
  gates: () => sb.from('outcome_gates').select('market_id,outcome_key,label,status,reason,n,log_loss,base_log_loss,ece,passes_in_row,competition:competitions(code)').limit(2),
  'backtest runs': () => sb.from('backtest_runs').select('id,config,split,metrics,finished_at').limit(2),
  competitions: () => sb.from('competitions').select('id,code,name,country,type,is_active,seasons(id,label,is_current)').eq('is_active', true),
  team: () => sb.from('teams').select(`${TEAM_COLS},country,is_national`).limit(2),
  providers: () => sb.from('data_providers').select('id,name,kind,licence,attribution_text,reliability_weight,daily_budget,minute_budget,is_enabled'),
  jobs: () => sb.from('scheduled_sync_jobs').select('job,cron,runner,last_run_at,last_status,is_enabled'),
  'sync logs': () => sb.from('provider_sync_logs').select('provider_id,job,endpoint,status_code,rows_upserted,quota_remaining,error,started_at').limit(2),
  saved: () => sb.from('saved_matches').select('fixture_id,created_at').limit(1),
  preferences: () => sb.from('user_preferences').select('*').limit(1),
  notifications: () => sb.from('notifications').select('id,category,title,body,fixture_id,read_at,created_at').limit(1),
  'team search': () => sb.from('teams').select(TEAM_COLS).or('name.ilike.%arsen%,short_name.ilike.%arsen%,tla.ilike.arsen').limit(3),
  'competition search': () => sb.from('competitions').select('id,code,name,country,type').or('name.ilike.%liga%,code.ilike.liga').limit(3),
  flags: () => sb.from('feature_flags').select('key,enabled,description'),
  settings: () => sb.from('app_settings').select('key,value,updated_at'),
  audit: () => sb.from('audit_logs').select('id,actor,action,entity,entity_id,created_at').limit(2),
  conflicts: () => sb.from('data_conflicts').select('id,fixture_id,field,values,status,created_at').limit(2),
}

let failed = 0
for (const [name, run] of Object.entries(checks)) {
  const { data, error, count } = await run()
  if (error) {
    failed++
    console.log(`✗ ${name}: ${error.code ?? ''} ${error.message}`)
  } else console.log(`✓ ${name}: ${Array.isArray(data) ? data.length : data ? 1 : (count ?? 0)} rows`)
}
console.log(failed ? `\n${failed} failed` : '\nall query shapes valid')
process.exit(failed ? 1 : 0)
