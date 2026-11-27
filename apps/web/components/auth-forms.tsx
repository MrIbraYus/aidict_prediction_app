'use client'
import { useActionState, useState } from 'react'
import Link from 'next/link'
import { Eye, EyeOff, Lock, Mail, MailCheck, User } from 'lucide-react'
import { requestReset, resendConfirmation, signIn, signUp, updatePassword, type FormState } from '@/lib/auth-actions'
import { Button, Field, Input, Notice } from './ui/primitives'

function PasswordInput({ id, name, autoComplete, minLength = 8 }: { id: string; name: string; autoComplete: string; minLength?: number }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input id={id} name={name} type={show ? 'text' : 'password'} autoComplete={autoComplete} icon={<Lock className="size-4" />} placeholder="••••••••" required minLength={minLength} className="pr-11" />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-3 hover:text-fg">
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}

function Sent({ text }: { text: string }) {
  return (
    <div className="animate-fade-up">
      <div className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-success-soft text-success">
        <MailCheck className="size-7" />
      </div>
      <h2 className="text-[26px] font-extrabold">Check your email</h2>
      <p className="mt-2 text-[14px] text-fg-3">{text}</p>
      <Link href="/login" className="mt-8 inline-flex h-12 w-full items-center justify-center rounded-[14px] border border-line-strong text-[15px] font-semibold text-fg hover:bg-surface-2">
        Back to sign in
      </Link>
    </div>
  )
}

function ResendConfirmation({ email }: { email: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(resendConfirmation, undefined)
  if (state?.message) return <Notice tone="success" className="mt-3" title="Confirmation email sent">{state.message}</Notice>
  return (
    <form action={action} className="mt-3">
      <input type="hidden" name="email" value={email} />
      {state?.error && <p className="mb-2 text-[12px] font-semibold text-danger">{state.error}</p>}
      <Button type="submit" variant="outline" size="sm" loading={pending}>
        Resend confirmation email
      </Button>
    </form>
  )
}

export function SignInForm({ next, linkError }: { next?: string; linkError?: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, undefined)
  return (
    <div className="animate-fade-up">
    <form action={action}>
      <h2 className="text-[28px] font-extrabold tracking-[-0.01em]">Sign in</h2>
      <p className="mt-1.5 text-[14px] text-fg-3">Private workspace — access is by invitation.</p>
      {linkError && !state?.error && (
        <Notice tone="warn" className="mt-6" title="That link could not finish signing you in.">
          If you were confirming your email, it is most likely confirmed already: sign in below. Links only finish sign-in in the browser where you signed up, and they expire after an hour.
        </Notice>
      )}
      {state?.error && <Notice tone="danger" className="mt-6" title={state.error}>{state.unconfirmed ? 'Open the link in the confirmation email, or send a new one.' : undefined}</Notice>}
      <input type="hidden" name="next" value={next ?? '/'} />
      <div className="mt-7 space-y-4">
        <Field label="Email or username" htmlFor="identifier">
          <Input id="identifier" name="identifier" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} icon={<User className="size-4" />} placeholder="admin or you@example.com" required />
        </Field>
        <Field label="Password" htmlFor="password">
          <PasswordInput id="password" name="password" autoComplete="current-password" minLength={1} />
        </Field>
      </div>
      <div className="mt-3 flex justify-end">
        <Link href="/forgot" className="text-[13px] font-bold text-brand-fg hover:underline">
          Forgot password?
        </Link>
      </div>
      <Button type="submit" variant="primary" size="lg" className="mt-6 w-full" loading={pending}>
        Sign in
      </Button>
      <p className="mt-6 text-center text-[13px] text-fg-3">
        New workspace?{' '}
        <Link href="/signup" className="font-bold text-fg hover:underline">
          Create the owner account
        </Link>
      </p>
    </form>
    {state?.unconfirmed && state.email && <ResendConfirmation email={state.email} />}
    </div>
  )
}

export function SignUpForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(signUp, undefined)
  if (state?.message) return <Sent text={state.message} />
  return (
    <form action={action} className="animate-fade-up">
      <h2 className="text-[28px] font-extrabold tracking-[-0.01em]">Create account</h2>
      <p className="mt-1.5 text-[14px] text-fg-3">The first account becomes the workspace owner and is ready immediately. After that, sign-up stays closed unless the owner opens it.</p>
      {state?.error && <Notice tone="danger" className="mt-6" title={state.error} />}
      <div className="mt-7 space-y-4">
        <Field label="Email or username" htmlFor="identifier">
          <Input id="identifier" name="identifier" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} icon={<User className="size-4" />} placeholder="admin or you@example.com" required />
        </Field>
        <Field label="Password" htmlFor="password" hint="At least 8 characters. Use a password you do not use anywhere else.">
          <PasswordInput id="password" name="password" autoComplete="new-password" />
        </Field>
        <Field label="Confirm password" htmlFor="confirm">
          <PasswordInput id="confirm" name="confirm" autoComplete="new-password" />
        </Field>
        <label className="flex items-start gap-2.5 text-[13px] text-fg-2">
          <input type="checkbox" name="ack" className="mt-0.5 size-4 accent-[var(--brand)]" required />
          <span>
            I understand AIDICT shows statistical probabilities, not guarantees, and is not a betting service.{' '}
            <Link href="/responsible" className="font-bold text-fg underline">
              Responsible use
            </Link>
          </span>
        </label>
      </div>
      <Button type="submit" variant="primary" size="lg" className="mt-6 w-full" loading={pending}>
        Create account
      </Button>
      <p className="mt-6 text-center text-[13px] text-fg-3">
        Already have an account?{' '}
        <Link href="/login" className="font-bold text-fg hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  )
}

export function ForgotForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(requestReset, undefined)
  if (state?.message) return <Sent text={state.message + ' The link expires in 1 hour.'} />
  return (
    <form action={action} className="animate-fade-up">
      <Link href="/login" className="mb-6 inline-flex items-center gap-1.5 text-[13px] font-bold text-fg-3 hover:text-fg">
        ← Back
      </Link>
      <h2 className="text-[28px] font-extrabold tracking-[-0.01em]">Reset password</h2>
      <p className="mt-1.5 text-[14px] text-fg-3">Enter your email and we will send a reset link. Username accounts have no mailbox: change the password in Settings while signed in.</p>
      {state?.error && <Notice tone="danger" className="mt-6" title={state.error} />}
      <div className="mt-7">
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" icon={<Mail className="size-4" />} placeholder="you@example.com" required />
        </Field>
      </div>
      <Button type="submit" variant="primary" size="lg" className="mt-6 w-full" loading={pending}>
        Send reset link
      </Button>
    </form>
  )
}

export function ResetForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(updatePassword, undefined)
  return (
    <form action={action} className="animate-fade-up">
      <h2 className="text-[28px] font-extrabold tracking-[-0.01em]">Choose a new password</h2>
      <p className="mt-1.5 text-[14px] text-fg-3">Set a new password for your account.</p>
      {state?.error && <Notice tone="danger" className="mt-6" title={state.error} />}
      <div className="mt-7 space-y-4">
        <Field label="New password" htmlFor="password" hint="At least 8 characters.">
          <PasswordInput id="password" name="password" autoComplete="new-password" />
        </Field>
        <Field label="Confirm password" htmlFor="confirm">
          <PasswordInput id="confirm" name="confirm" autoComplete="new-password" />
        </Field>
      </div>
      <Button type="submit" variant="primary" size="lg" className="mt-6 w-full" loading={pending}>
        Save password
      </Button>
    </form>
  )
}
