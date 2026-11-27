'use client'
import { useOptimistic, useTransition } from 'react'
import { setFlag, setSignupOpen } from '@/lib/actions'
import { Switch } from './ui/interactive'
import { toast } from './ui/overlay'

export function FlagSwitch({ flag, enabled, label }: { flag: string; enabled: boolean; label: string }) {
  const [on, setOn] = useOptimistic(enabled)
  const [, start] = useTransition()
  return (
    <Switch
      label={label}
      checked={on}
      onChange={(v) =>
        start(async () => {
          setOn(v)
          const r = await setFlag(flag, v)
          toast(r.ok ? { title: `${label} ${v ? 'enabled' : 'disabled'}`, tone: 'success' } : { title: 'Not saved', body: r.error, tone: 'error' })
        })
      }
    />
  )
}

export function SignupSwitch({ open }: { open: boolean }) {
  const [on, setOn] = useOptimistic(open)
  const [, start] = useTransition()
  return (
    <Switch
      label="Allow new sign-ups"
      checked={on}
      onChange={(v) =>
        start(async () => {
          setOn(v)
          const r = await setSignupOpen(v)
          toast(r.ok ? { title: v ? 'Sign-up opened' : 'Sign-up closed', tone: 'success' } : { title: 'Not saved', body: r.error, tone: 'error' })
        })
      }
    />
  )
}
