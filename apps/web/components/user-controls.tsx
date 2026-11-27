'use client'
import { useState, useTransition } from 'react'
import { KeyRound, ShieldCheck, ShieldOff, Trash2, UserCheck, UserX } from 'lucide-react'
import { deleteUserAccount, setTemporaryPassword, setUserActive, setUserAdmin } from '@/lib/admin-actions'
import { Button } from './ui/primitives'
import { toast } from './ui/overlay'

type Props = { id: string; name: string; active: boolean; isAdminUser: boolean; canManageAdmins: boolean; locked: boolean }

export function UserControls({ id, name, active, isAdminUser, canManageAdmins, locked }: Props) {
  const [pending, start] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const [typed, setTyped] = useState('')
  const [pwOpen, setPwOpen] = useState(false)
  const [pw, setPw] = useState('')
  if (locked) return <span className="text-[12px] text-fg-3">—</span>
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, done: string) =>
    start(async () => {
      const r = await fn()
      toast(r.ok ? { title: done, tone: 'success' } : { title: 'Not changed', body: r.error, tone: 'error' })
      if (r.ok) setConfirming(false)
    })
  if (pwOpen)
    return (
      <div className="flex min-w-[260px] flex-col gap-2 rounded-xl border border-line-strong bg-surface-2 p-2.5">
        <span className="text-[12px] font-semibold text-fg-2">
          Temporary password for <b>{name}</b>. Give it to them privately; they change it in Settings after signing in.
        </span>
        <input type="text" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="off" spellCheck={false} placeholder="At least 8 characters" aria-label="Temporary password" className="h-9 rounded-lg border border-line bg-surface-1 px-2.5 text-[16px] sm:text-[13px]" />
        <div className="flex gap-2">
          <Button size="sm" variant="primary" loading={pending} disabled={pw.length < 8} onClick={() => run(async () => { const r = await setTemporaryPassword(id, pw); if (r.ok) { setPw(''); setPwOpen(false) } return r }, `Temporary password set for ${name}`)}>
            Set password
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setPw(''); setPwOpen(false) }}>
            Cancel
          </Button>
        </div>
      </div>
    )
  if (confirming)
    return (
      <div className="flex min-w-[260px] flex-col gap-2 rounded-xl border border-danger/30 bg-danger-soft p-2.5">
        <span className="text-[12px] font-semibold text-danger">
          Delete <b>{name}</b> permanently? This removes the account, saved matches, settings and notifications and cannot be undone. Type the name to confirm.
        </span>
        <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={name} aria-label="Type the account name to confirm" className="h-9 rounded-lg border border-line bg-surface-1 px-2.5 text-[16px] sm:text-[13px]" />
        <div className="flex gap-2">
          <Button size="sm" variant="danger" loading={pending} disabled={typed.trim().toLowerCase() !== name.toLowerCase()} onClick={() => run(() => deleteUserAccount(id, typed), `${name} deleted`)}>
            Delete permanently
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </div>
      </div>
    )
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button size="sm" variant="outline" loading={pending} onClick={() => run(() => setUserActive(id, !active), active ? `${name} deactivated` : `${name} reactivated`)}>
        {active ? <UserX className="size-3.5" /> : <UserCheck className="size-3.5" />} {active ? 'Deactivate' : 'Reactivate'}
      </Button>
      {canManageAdmins && (
        <Button size="sm" variant="ghost" loading={pending} onClick={() => run(() => setUserAdmin(id, !isAdminUser), isAdminUser ? `${name} is now a member` : `${name} is now an admin`)}>
          {isAdminUser ? <ShieldOff className="size-3.5" /> : <ShieldCheck className="size-3.5" />} {isAdminUser ? 'Remove admin' : 'Make admin'}
        </Button>
      )}
      <Button size="sm" variant="ghost" onClick={() => setPwOpen(true)}>
        <KeyRound className="size-3.5" /> Set password
      </Button>
      <Button size="sm" variant="danger" onClick={() => setConfirming(true)}>
        <Trash2 className="size-3.5" /> Delete
      </Button>
    </div>
  )
}
