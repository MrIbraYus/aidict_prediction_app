'use server'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient, createServiceClient, getUser, isAdmin } from './supabase/server'

export async function toggleSaved(fixtureId: number, save: boolean): Promise<{ ok: boolean; error?: string }> {
  const id = z.number().int().positive().parse(fixtureId)
  const sb = await createClient()
  const user = await getUser()
  if (!user) return { ok: false, error: 'Sign in to save matches.' }
  const { error } = save
    ? await sb.from('saved_matches').upsert({ user_id: user.id, fixture_id: id })
    : await sb.from('saved_matches').delete().eq('user_id', user.id).eq('fixture_id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/saved')
  return { ok: true }
}

const Prefs = z.object({
  theme: z.enum(['dark', 'light', 'system']).optional(),
  time_zone: z.string().max(64).optional(),
  odds_format: z.enum(['decimal', 'fractional', 'american']).optional(),
  probability_format: z.enum(['percent', 'decimal']).optional(),
  reality_check_minutes: z.number().int().min(0).max(600).optional(),
  notification_prefs: z.record(z.string(), z.unknown()).optional(),
})

export async function savePreferences(patch: z.infer<typeof Prefs>): Promise<{ ok: boolean; error?: string }> {
  const p = Prefs.parse(patch)
  if (p.time_zone) {
    try {
      new Intl.DateTimeFormat('en-GB', { timeZone: p.time_zone })
    } catch {
      return { ok: false, error: 'Unknown time zone' }
    }
    ;(await cookies()).set('aidict-tz', p.time_zone, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
  }
  const user = await getUser()
  if (!user) return { ok: false, error: 'Not signed in' }
  const sb = await createClient()
  const { error } = await sb.from('user_preferences').upsert({ user_id: user.id, ...p, updated_at: new Date().toISOString() })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/', 'layout')
  return { ok: true }
}

/** First visit: remember the browser's time zone so server-rendered times match the viewer. */
export async function rememberTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: tz })
  } catch {
    return
  }
  const jar = await cookies()
  if (jar.get('aidict-tz')?.value === tz) return
  jar.set('aidict-tz', tz, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
  revalidatePath('/', 'layout')
}

export async function markAllRead() {
  const user = await getUser()
  if (!user) return
  const sb = await createClient()
  await sb.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', user.id).is('read_at', null)
  revalidatePath('/notifications')
}

export async function signOut() {
  const sb = await createClient()
  await sb.auth.signOut()
  redirect('/login')
}

/** Admin: toggle a feature flag or market status. RLS also enforces admin on the database side. */
export async function setFlag(key: string, enabled: boolean): Promise<{ ok: boolean; error?: string }> {
  const user = await getUser()
  if (!isAdmin(user)) return { ok: false, error: 'Admins only' }
  const sb = await createClient()
  const { error, count } = await sb.from('feature_flags').update({ enabled }, { count: 'exact' }).eq('key', z.string().max(64).parse(key))
  if (error || !count) return { ok: false, error: error?.message ?? 'Not allowed' }
  await createServiceClient().from('audit_logs').insert({ actor: user!.id, action: enabled ? 'enable' : 'disable', entity: 'feature_flag', entity_id: key })
  revalidatePath('/admin')
  return { ok: true }
}

/** Admin: allow or stop new sign-ups after the owner account exists. */
export async function setSignupOpen(open: boolean): Promise<{ ok: boolean; error?: string }> {
  const user = await getUser()
  if (!isAdmin(user)) return { ok: false, error: 'Admins only' }
  const sb = await createClient()
  const { error, count } = await sb.from('app_settings').update({ value: { open: !!open }, updated_at: new Date().toISOString(), updated_by: user!.id }, { count: 'exact' }).eq('key', 'signup')
  if (error || !count) return { ok: false, error: error?.message ?? 'Setting missing: re-run the seed' }
  await createServiceClient().from('audit_logs').insert({ actor: user!.id, action: open ? 'open' : 'close', entity: 'signup', entity_id: 'signup' })
  revalidatePath('/admin')
  return { ok: true }
}
