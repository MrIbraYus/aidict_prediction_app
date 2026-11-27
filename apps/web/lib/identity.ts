/**
 * Sign-in names. Supabase Auth needs an email-format login, so a plain username ("admin") is stored as
 * <username>@users.aidict.local — a reserved, non-deliverable address that never receives mail.
 */
export const USERNAME_DOMAIN = 'users.aidict.local'
export const USERNAME_RE = /^[a-z0-9._-]{3,32}$/i

export const isUsernameLogin = (email: string | null | undefined) => !!email && email.toLowerCase().endsWith('@' + USERNAME_DOMAIN)
export const loginEmail = (identifier: string) => {
  const id = identifier.trim().toLowerCase()
  return id.includes('@') ? id : `${id}@${USERNAME_DOMAIN}`
}
/** What to show for an account: the username for username accounts, otherwise the email address. */
export const displayName = (email: string | null | undefined) => (!email ? 'Account' : isUsernameLogin(email) ? email.split('@')[0] : email)
