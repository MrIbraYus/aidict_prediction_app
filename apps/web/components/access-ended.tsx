import { Clock, LogOut } from 'lucide-react'
import { signOut } from '@/lib/actions'
import { Button } from './ui/primitives'

/** Shown instead of the app when a member's trial or access period has ended. The database blocks the data as well. */
export function AccessEnded({ name, plan, until }: { name: string; plan: string; until: string | null }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-5 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/aidict-icon.png" alt="AIDICT" className="mb-8 size-14 rounded-2xl" />
      <div className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-warn-soft text-warn">
        <Clock className="size-7" />
      </div>
      <h1 className="text-[24px] font-extrabold">Your {plan === 'trial' ? 'free trial' : 'access'} has ended</h1>
      <p className="mt-2 text-[14px] text-fg-3">
        Hi {name}. {until ? `Access ended on ${new Date(until).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}. ` : ''}
        Contact the AIDICT owner to continue using the app. Your saved matches and settings are kept.
      </p>
      <form action={signOut} className="mt-8">
        <Button type="submit" variant="outline">
          <LogOut className="size-4" /> Sign out
        </Button>
      </form>
    </main>
  )
}
