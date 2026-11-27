/** Account access periods (migration 0012). Pure helpers, safe on server and client. */
export type AccessPlan = 'trial' | 'period' | 'unlimited'
export type Access = { plan: AccessPlan; until: string | null; active: boolean; msLeft: number | null }

const DAY = 86_400_000

export function accessFrom(row: { plan: AccessPlan; access_until: string | null } | null, admin: boolean, now = Date.now()): Access {
  if (admin) return { plan: 'unlimited', until: null, active: true, msLeft: null }
  if (!row) return { plan: 'trial', until: null, active: false, msLeft: 0 }
  if (row.plan === 'unlimited') return { plan: 'unlimited', until: null, active: true, msLeft: null }
  const ms = row.access_until ? new Date(row.access_until).getTime() - now : 0
  return { plan: row.plan, until: row.access_until, active: ms > 0, msLeft: Math.max(0, ms) }
}

/** "Unlimited", "27 days left", "5 hours left", "Ended". */
export function timeLeft(a: Access): string {
  if (a.plan === 'unlimited') return 'Unlimited'
  if (!a.active || a.msLeft == null) return 'Ended'
  if (a.msLeft < DAY) {
    const h = Math.max(1, Math.ceil(a.msLeft / 3_600_000))
    return `${h} hour${h === 1 ? '' : 's'} left`
  }
  const d = Math.ceil(a.msLeft / DAY)
  return `${d} day${d === 1 ? '' : 's'} left`
}

/** Badge text for the top bar: "Free trial · 2 days left". */
export function accessBadge(a: Access): string {
  if (a.plan === 'unlimited') return 'Unlimited access'
  return `${a.plan === 'trial' ? 'Free trial' : 'Access'} · ${timeLeft(a)}`
}

export const expiringSoon = (a: Access) => a.active && a.msLeft != null && a.msLeft < 3 * DAY
