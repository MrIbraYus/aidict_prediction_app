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
  .refine((v) => (v.includes('@') ? Email.safeParse(v).success : USERNAME_RE.test(v)), 'Use an email address, or a username of 3–32 letters or numbers (dots, dashes and underscores are allowed, spaces are not).')
const Password = z.string().min(8, 'Your password needs at least 8 characters.').max(128, 'Your password is too long (128 characters at most).')

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
    if (error.code === 'user_banned' || /banned/i.test(error.message)) return { error: 'This account has been deactivated. Contact the AIDICT owner if you think this is a mistake.' }
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
 * Sign-up. Every account is created already confirmed (no confirmation email: Supabase's built-in mailer only delivers to
 * the project's team, so real users never received the link). The very first account becomes the owner (admin); after that
 * sign-up follows app_settings.signup.open. On success the person is sent to the sign-in page with a success message.
 * Everything runs server-side with the service key, which never reaches the browser.
 */
export async function signUp(_: FormState, form: FormData): Promise<FormState> {
  const parsed = z
    .object({ id: Identifier, password: Password, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { message: 'The two passwords do not match.', path: ['confirm'] })
    .safeParse({ id: form.get('identifier'), password: form.get('password'), confirm: form.get('confirm') })
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  if (form.get('ack') !== 'on') return { error: 'Please tick the box to confirm you have read the responsible-use note.' }
  const email = loginEmail(parsed.data.id)
  const { password } = parsed.data
  const admin = createServiceClient()
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (listErr) return { error: 'Sign-up is unavailable right now. Please try again in a few minutes.' }
  const bootstrap = !list.users.some((u) => u.email_confirmed_at)
  if (!bootstrap) {
    const { data: s } = await admin.from('app_settings').select('value').eq('key', 'signup').maybeSingle()
    if (!(s?.value as { open?: boolean } | null)?.open) return { error: 'New sign-ups are paused at the moment. Please try again later.' }
  }
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: bootstrap ? { role: 'admin', owner: true } : {} })
  if (error || !data.user) {
    const m = error?.message ?? ''
    if (/already (been )?registered|already exists|duplicate/i.test(m))
      return { error: isUsernameLogin(email) ? 'That username is already taken. Choose another, or sign in.' : 'That email is already registered. Sign in instead.' }
    if (/password/i.test(m)) return { error: `Please choose a stronger password: ${m}` }
    if (/email/i.test(m)) return { error: 'That email address does not look valid. Check it, or use a username instead.' }
    return { error: 'The account could not be created. Please try again.' }
  }
  const id = data.user.id
  if (bootstrap) await admin.from('audit_logs').insert({ actor: id, action: 'bootstrap_owner', entity: 'user', entity_id: id })
  // Upserts also cover the rare case where the sign-up trigger could not run.
  await admin.from('user_profiles').upsert({ user_id: id, display_name: email.split('@')[0], role: bootstrap ? 'admin' : 'user' })
  await admin.from('user_preferences').upsert({ user_id: id }, { ignoreDuplicates: true })
  redirect('/login?created=1')
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
