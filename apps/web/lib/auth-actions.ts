'use server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { isUsernameLogin, loginEmail, USERNAME_RE } from './identity'
import { createClient, createServiceClient } from './supabase/server'

export type FormState = { error?: string; message?: string; unconfirmed?: boolean; email?: string } | undefined

const Email = z.email('Enter a valid email address').max(254)
const Identifier = z
  .string()
  .trim()
  .min(1, 'Enter your email or username')
  .max(254)
  .refine((v) => (v.includes('@') ? Email.safeParse(v).success : USERNAME_RE.test(v)), 'Use an email address or a username of 3–32 letters, numbers, dots, dashes or underscores')
const Password = z.string().min(8, 'Use at least 8 characters').max(128)

async function origin() {
  const h = await headers()
  const o = h.get('origin')
  if (o) return o
  const host = h.get('x-forwarded-host') ?? h.get('host')
  return `${h.get('x-forwarded-proto') ?? 'https'}://${host}`
}

const safeNext = (n: unknown) => (typeof n === 'string' && n.startsWith('/') && !n.startsWith('//') ? n : '/')

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const parsed = z.object({ id: Identifier, password: z.string().min(1, 'Enter your password') }).safeParse({ id: form.get('identifier'), password: form.get('password') })
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const email = loginEmail(parsed.data.id)
  const sb = await createClient()
  const { error } = await sb.auth.signInWithPassword({ email, password: parsed.data.password })
  if (error) {
    if (!isUsernameLogin(email) && (error.code === 'email_not_confirmed' || /not confirmed/i.test(error.message)))
      return { error: 'This email address has not been confirmed yet.', unconfirmed: true, email }
    return { error: error.message === 'Invalid login credentials' ? 'Username/email or password is incorrect.' : error.message }
  }
  redirect(safeNext(form.get('next')))
}

/** Sends the sign-up confirmation email again (same answer whether or not the address exists). */
export async function resendConfirmation(_: FormState, form: FormData): Promise<FormState> {
  const parsed = Email.safeParse(form.get('email'))
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const sb = await createClient()
  const { error } = await sb.auth.resend({ type: 'signup', email: parsed.data, options: { emailRedirectTo: `${await origin()}/auth/callback` } })
  if (error && /rate|seconds|too many/i.test(error.message)) return { error: 'Too many emails requested. Wait a minute and try again.', unconfirmed: true, email: parsed.data }
  return { message: `If ${parsed.data} is waiting for confirmation, a new link is on its way. Open it in this browser.`, email: parsed.data }
}

/**
 * Sign-up. Until a confirmed account exists the workspace is in bootstrap mode: the account signing up becomes the owner
 * (admin) and is confirmed immediately, so no email round trip is needed. Afterwards sign-up is closed unless the owner opens
 * it (app_settings.signup.open); email sign-ups then confirm by email, username sign-ups are created confirmed.
 * Everything runs server-side with the service key, which never reaches the browser.
 */
export async function signUp(_: FormState, form: FormData): Promise<FormState> {
  const parsed = z
    .object({ id: Identifier, password: Password, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { message: 'Passwords do not match', path: ['confirm'] })
    .safeParse({ id: form.get('identifier'), password: form.get('password'), confirm: form.get('confirm') })
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  if (form.get('ack') !== 'on') return { error: 'Please confirm you have read the responsible-use note.' }
  const email = loginEmail(parsed.data.id)
  const { password } = parsed.data
  const admin = createServiceClient()
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (listErr) return { error: 'Sign-up is unavailable right now (server configuration).' }
  const bootstrap = !list.users.some((u) => u.email_confirmed_at)
  if (!bootstrap) {
    const { data: s } = await admin.from('app_settings').select('value').eq('key', 'signup').maybeSingle()
    if (!(s?.value as { open?: boolean } | null)?.open) return { error: 'Sign-up is closed. Ask the owner of this AIDICT workspace for access.' }
  }
  const sb = await createClient()

  // Ordinary member signing up with a real email address: confirm by email.
  if (!bootstrap && !isUsernameLogin(email)) {
    const { error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: `${await origin()}/auth/callback` } })
    if (error) return { error: /rate|seconds|too many/i.test(error.message) ? 'Too many emails requested. Wait a minute and try again.' : error.message }
    return { message: `Check ${email} for a confirmation link and open it in this browser, then sign in.` }
  }

  // Owner bootstrap, or a username account: created already confirmed.
  if (list.users.some((u) => u.email?.toLowerCase() === email)) return { error: 'That name is already taken. Sign in instead.' }
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: bootstrap ? { role: 'admin' } : {} })
  if (error || !data.user) return { error: error?.message ?? 'Could not create the account.' }
  const id = data.user.id
  if (bootstrap) {
    // Exactly one owner: earlier unconfirmed attempts lose the role (nobody confirmed them).
    for (const u of list.users) if (u.app_metadata?.role === 'admin') await admin.auth.admin.updateUserById(u.id, { app_metadata: { role: null } })
    await admin.from('audit_logs').insert({ actor: id, action: 'bootstrap_owner', entity: 'user', entity_id: id })
  }
  // Upserts cover accounts created before the schema existed (the sign-up trigger could not run then).
  await admin.from('user_profiles').upsert({ user_id: id, display_name: email.split('@')[0], role: bootstrap ? 'admin' : 'user' })
  await admin.from('user_preferences').upsert({ user_id: id }, { ignoreDuplicates: true })
  const { error: signInErr } = await sb.auth.signInWithPassword({ email, password })
  if (signInErr) return { message: 'Account created. Sign in to continue.' }
  redirect('/')
}

export async function requestReset(_: FormState, form: FormData): Promise<FormState> {
  const parsed = Email.safeParse(form.get('email'))
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const sb = await createClient()
  await sb.auth.resetPasswordForEmail(parsed.data, { redirectTo: `${await origin()}/auth/callback?next=/reset-password` })
  // Same answer whether or not the address exists.
  return { message: 'If an account exists for that address, a reset link is on its way.' }
}

export async function updatePassword(_: FormState, form: FormData): Promise<FormState> {
  const parsed = z
    .object({ password: Password, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { message: 'Passwords do not match' })
    .safeParse({ password: form.get('password'), confirm: form.get('confirm') })
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const sb = await createClient()
  const { data } = await sb.auth.getUser()
  if (!data.user) return { error: 'The reset link has expired. Request a new one.' }
  const { error } = await sb.auth.updateUser({ password: parsed.data.password })
  if (error) return { error: error.message }
  redirect('/')
}
