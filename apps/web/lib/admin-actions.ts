'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { displayName } from './identity'
import { createServiceClient, getUser, isAdmin } from './supabase/server'

type Result = { ok: boolean; error?: string }
const Id = z.uuid()
const FOREVER = '876000h' // ~100 years: Supabase's way to keep an account switched off until an admin reactivates it

/** Loads the acting admin and the target account, and enforces who may act on whom. */
async function authorize(targetId: string, needOwner = false) {
  const me = await getUser()
  if (!isAdmin(me)) return { error: 'Admins only' } as const
  const iAmOwner = me!.app_metadata?.owner === true
  if (needOwner && !iAmOwner) return { error: 'Only the owner can change admin rights' } as const
  const id = Id.parse(targetId)
  if (id === me!.id) return { error: 'You cannot change your own account here' } as const
  const db = createServiceClient()
  const { data, error } = await db.auth.admin.getUserById(id)
  if (error || !data.user) return { error: 'Account not found' } as const
  const target = data.user
  if (target.app_metadata?.owner === true) return { error: 'The owner account cannot be changed' } as const
  if (target.app_metadata?.role === 'admin' && !iAmOwner) return { error: 'Only the owner can change another admin' } as const
  return { me: me!, target, db } as const
}

async function audit(db: ReturnType<typeof createServiceClient>, actor: string, action: string, targetId: string) {
  await db.from('audit_logs').insert({ actor, action, entity: 'user', entity_id: targetId })
}

/** Deactivate (sign-in blocked, signed out on their next page) or reactivate an account. Their data is kept. */
export async function setUserActive(targetId: string, active: boolean): Promise<Result> {
  const a = await authorize(targetId)
  if ('error' in a) return { ok: false, error: a.error }
  const { error } = await a.db.auth.admin.updateUserById(a.target.id, { ban_duration: active ? 'none' : FOREVER })
  if (error) return { ok: false, error: error.message }
  await audit(a.db, a.me.id, active ? 'reactivate_user' : 'deactivate_user', a.target.id)
  revalidatePath('/admin/users')
  return { ok: true }
}

/** Permanently delete an account and everything it owns (saved matches, settings, notifications). */
export async function deleteUserAccount(targetId: string, typedName: string): Promise<Result> {
  const a = await authorize(targetId)
  if ('error' in a) return { ok: false, error: a.error }
  if (typedName.trim().toLowerCase() !== displayName(a.target.email).toLowerCase()) return { ok: false, error: 'The name you typed does not match this account' }
  const { error } = await a.db.auth.admin.deleteUser(a.target.id)
  if (error) return { ok: false, error: error.message }
  await audit(a.db, a.me.id, 'delete_user', a.target.id)
  revalidatePath('/admin/users')
  return { ok: true }
}

/** Owner only: grant or remove admin rights. */
export async function setUserAdmin(targetId: string, makeAdmin: boolean): Promise<Result> {
  const a = await authorize(targetId, true)
  if ('error' in a) return { ok: false, error: a.error }
  const { error } = await a.db.auth.admin.updateUserById(a.target.id, { app_metadata: { ...a.target.app_metadata, role: makeAdmin ? 'admin' : null } })
  if (error) return { ok: false, error: error.message }
  await a.db.from('user_profiles').update({ role: makeAdmin ? 'admin' : 'user' }).eq('user_id', a.target.id)
  await audit(a.db, a.me.id, makeAdmin ? 'grant_admin' : 'revoke_admin', a.target.id)
  revalidatePath('/admin/users')
  return { ok: true }
}

const AccessCmd = z.discriminatedUnion('type', [
  z.object({ type: z.literal('unlimited') }),
  z.object({ type: z.literal('end') }),
  z.object({ type: z.literal('set'), days: z.number().int().min(1).max(3650) }), // N days from now, replacing what is left
  z.object({ type: z.literal('add'), days: z.number().int().min(1).max(3650) }), // N days on top of the current end date
  z.object({ type: z.literal('until'), until: z.string().min(8).max(40) }), // exact end date
])
export type AccessCommand = z.infer<typeof AccessCmd>

/** Set, extend or end a member's access at any time (also during the free trial). Notifies the member. */
export async function setUserAccess(targetId: string, command: AccessCommand): Promise<Result> {
  const a = await authorize(targetId)
  if ('error' in a) return { ok: false, error: a.error }
  const c = AccessCmd.parse(command)
  const now = Date.now()
  const { data: cur } = await a.db.from('user_access').select('plan,access_until').eq('user_id', a.target.id).maybeSingle()
  let row: { plan: 'trial' | 'period' | 'unlimited'; access_until: string | null }
  if (c.type === 'unlimited') row = { plan: 'unlimited', access_until: null }
  else if (c.type === 'end') row = { plan: cur?.plan === 'trial' ? 'trial' : 'period', access_until: new Date(now).toISOString() }
  else if (c.type === 'set') row = { plan: 'period', access_until: new Date(now + c.days * 86_400_000).toISOString() }
  else if (c.type === 'add') {
    const base = cur?.access_until && cur.plan !== 'unlimited' ? Math.max(now, new Date(cur.access_until).getTime()) : now
    row = { plan: 'period', access_until: new Date(base + c.days * 86_400_000).toISOString() }
  } else {
    const t = new Date(c.until).getTime()
    if (!Number.isFinite(t) || t <= now) return { ok: false, error: 'Choose a date in the future' }
    row = { plan: 'period', access_until: new Date(t).toISOString() }
  }
  const { error } = await a.db.from('user_access').upsert({ user_id: a.target.id, ...row, reminded_at: null, updated_by: a.me.id, updated_at: new Date(now).toISOString() })
  if (error) return { ok: false, error: error.message }
  const until = row.access_until ? new Date(row.access_until).toUTCString().replace(' GMT', ' UTC') : null
  await a.db.from('notifications').insert({
    user_id: a.target.id, category: 'system', title: 'Your access was updated',
    body: row.plan === 'unlimited' ? 'You now have unlimited access to AIDICT.' : c.type === 'end' ? 'Your access has ended. Contact the AIDICT owner to continue.' : `Your access now runs until ${until}.`,
  })
  await audit(a.db, a.me.id, `access_${c.type}`, a.target.id)
  revalidatePath('/admin/users')
  return { ok: true }
}
