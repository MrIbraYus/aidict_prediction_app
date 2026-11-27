'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient, getUser } from './supabase/server'
import { outcomeLabel } from './outcome-labels'

type Result = { ok: boolean; error?: string; action?: 'added' | 'changed' | 'removed' }
const Input = z.object({ fixtureId: z.number().int().positive(), market: z.string().min(1).max(40), outcome: z.string().min(1).max(40) })

/** Builds the stored label and the probability at the time of adding (none for correct score). Server-side, from the latest prediction. */
async function describe(fixtureId: number, market: string, outcome: string) {
  const sb = await createClient()
  const { data: f } = await sb
    .from('fixtures')
    .select('id,kickoff_at,status,home:teams!fixtures_home_team_id_fkey(name,short_name),away:teams!fixtures_away_team_id_fkey(name,short_name)')
    .eq('id', fixtureId)
    .maybeSingle()
  if (!f) return null
  const one = <T,>(v: T | T[]) => (Array.isArray(v) ? v[0] : v)
  const home = one(f.home as { name: string; short_name: string | null } | { name: string; short_name: string | null }[])
  const away = one(f.away as { name: string; short_name: string | null } | { name: string; short_name: string | null }[])
  const hs = home?.short_name || home?.name || 'Home'
  const as = away?.short_name || away?.name || 'Away'
  const { data: snap } = await sb.from('prediction_snapshots').select('id').eq('fixture_id', fixtureId).order('snapshot_at', { ascending: false }).limit(1).maybeSingle()
  let probability: number | null = null
  let label: string
  if (market === 'correct-score') {
    if (!/^\d{1,2}-\d{1,2}$/.test(outcome)) return null
    const [x, y] = outcome.split('-')
    label = `Correct score ${x}–${y}`
  } else {
    label = outcomeLabel(market, outcome, hs, as)
    if (snap) {
      const { data: p } = await sb.from('market_outcome_probabilities').select('probability').eq('snapshot_id', snap.id).eq('market_id', market).eq('outcome_key', outcome).maybeSingle()
      probability = p ? Number(p.probability) : null
    }
  }
  return { fixture: f, label, probability, snapshotId: snap?.id ?? null }
}

/** Add a prediction to My Picks. If the user already has a pick in the same market for this match, it is changed instead. */
export async function addPick(input: z.infer<typeof Input>): Promise<Result> {
  const p = Input.parse(input)
  const user = await getUser()
  if (!user) return { ok: false, error: 'Sign in to use My Picks.' }
  const d = await describe(p.fixtureId, p.market, p.outcome)
  if (!d) return { ok: false, error: 'This match or prediction is not available.' }
  if (new Date(d.fixture.kickoff_at).getTime() <= Date.now()) return { ok: false, error: 'This match has already kicked off.' }
  const sb = await createClient()
  const { data: existing } = await sb.from('user_picks').select('id').eq('fixture_id', p.fixtureId).eq('market_id', p.market).maybeSingle()
  const row = { outcome_key: p.outcome, label: d.label, probability: d.probability, snapshot_id: d.snapshotId, updated_at: new Date().toISOString() }
  const { error } = existing
    ? await sb.from('user_picks').update(row).eq('id', existing.id)
    : await sb.from('user_picks').insert({ ...row, user_id: user.id, fixture_id: p.fixtureId, market_id: p.market })
  if (error) return { ok: false, error: /row-level security/.test(error.message) ? 'Picks can only be added before kick-off while your access is active.' : error.message }
  revalidatePath('/my-picks')
  return { ok: true, action: existing ? 'changed' : 'added' }
}

/** Remove a pick (allowed at any time). Identified by id, or by match + market. */
export async function removePick(by: { id: string } | { fixtureId: number; market: string }): Promise<Result> {
  const user = await getUser()
  if (!user) return { ok: false, error: 'Sign in to use My Picks.' }
  const sb = await createClient()
  const q = sb.from('user_picks').delete()
  const { error } = 'id' in by ? await q.eq('id', z.uuid().parse(by.id)) : await q.eq('fixture_id', by.fixtureId).eq('market_id', by.market)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/my-picks')
  return { ok: true, action: 'removed' }
}
