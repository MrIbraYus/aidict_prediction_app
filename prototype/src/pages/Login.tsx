import { useState, type FormEvent } from 'react'
import { ArrowLeft, Eye, EyeOff, Lock, Mail, MailCheck, ShieldCheck } from 'lucide-react'
import { navigate } from '../lib/router'
import { useApp } from '../lib/store'
import { Button, Field, Input, Notice } from '../components/ui/primitives'

type Mode = 'signin' | 'forgot' | 'sent'

export default function Login() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErr, setFieldErr] = useState<{ email?: string; password?: string }>({})
  const set = useApp((s) => s.set)
  const toast = useApp((s) => s.toast)

  const validate = () => {
    const e: typeof fieldErr = {}
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) e.email = 'Enter a valid email address.'
    if (mode === 'signin' && password.length < 8) e.password = 'Password must be at least 8 characters.'
    setFieldErr(e)
    return Object.keys(e).length === 0
  }

  const submit = (ev: FormEvent) => {
    ev.preventDefault()
    setError(null)
    if (!validate()) return
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      if (mode === 'forgot') return setMode('sent')
      // Prototype: "wrong" password demonstrates the error state.
      if (password.toLowerCase().includes('wrong')) return setError('Email or password is incorrect.')
      set({ authed: true })
      toast({ tone: 'success', title: 'Signed in', body: 'Welcome back to AIDICT.' })
      navigate('/')
    }, 900)
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden border-r border-line bg-[#0c0a0a] lg:flex lg:flex-col lg:justify-between lg:p-12">
        <PitchArt />
        <img src="./brand/aidict-logo.png" alt="AIDICT" className="relative h-10 w-auto self-start" />
        <div className="relative">
          <h1 className="max-w-lg text-[40px] font-extrabold leading-[1.08] tracking-[-0.02em] text-white">
            Analyse the data.<br />Calculate the probability.<br />
            <span className="text-[#f2546f]">Explain</span> the prediction.<br />Track the results.
          </h1>
          <p className="mt-5 max-w-md text-[14px] text-[#bcb3b1]">Statistical football intelligence with calibrated probabilities, transparent methodology and an immutable prediction record.</p>
        </div>
        <div className="relative flex items-center gap-6 text-[12px] font-semibold text-[#857c7a]">
          <span>Dixon–Coles · Elo · Monte Carlo</span>
          <span>No guarantees. No betting.</span>
        </div>
      </aside>
      <main className="flex flex-col items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-[400px]">
          <img src="./brand/aidict-icon.png" alt="AIDICT" className="mb-8 size-14 rounded-2xl shadow-glow lg:hidden" />
          {mode === 'sent' ? (
            <div className="animate-fade-up">
              <div className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-success-soft text-success"><MailCheck className="size-7" /></div>
              <h2 className="text-[26px] font-extrabold">Check your email</h2>
              <p className="mt-2 text-[14px] text-fg-3">If an account exists for <b className="text-fg">{email}</b>, a password-reset link is on its way. The link expires in 1 hour.</p>
              <Button className="mt-8 w-full" size="lg" variant="outline" onClick={() => setMode('signin')}><ArrowLeft className="size-4" /> Back to sign in</Button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="animate-fade-up" key={mode}>
              {mode === 'forgot' && (
                <button type="button" onClick={() => setMode('signin')} className="mb-6 inline-flex items-center gap-1.5 text-[13px] font-bold text-fg-3 hover:text-fg"><ArrowLeft className="size-4" /> Back</button>
              )}
              <h2 className="text-[28px] font-extrabold tracking-[-0.01em]">{mode === 'signin' ? 'Sign in' : 'Reset password'}</h2>
              <p className="mt-1.5 text-[14px] text-fg-3">{mode === 'signin' ? 'Private workspace — access is by invitation.' : 'Enter your email and we will send a reset link.'}</p>
              {error && <Notice tone="danger" className="mt-6" title={error}>Check your details and try again. After 5 failed attempts sign-in is paused for 15 minutes.</Notice>}
              <div className="mt-7 space-y-4">
                <Field label="Email" htmlFor="email" error={fieldErr.email}>
                  <Input id="email" type="email" autoComplete="email" icon={<Mail className="size-4" />} placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} error={!!fieldErr.email} />
                </Field>
                {mode === 'signin' && (
                  <Field label="Password" htmlFor="password" error={fieldErr.password}>
                    <div className="relative">
                      <Input id="password" type={show ? 'text' : 'password'} autoComplete="current-password" icon={<Lock className="size-4" />} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} error={!!fieldErr.password} className="pr-11" />
                      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-3 hover:text-fg">
                        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </Field>
                )}
              </div>
              {mode === 'signin' && (
                <div className="mt-4 flex items-center justify-between text-[13px]">
                  <label className="flex items-center gap-2 font-semibold text-fg-2"><input type="checkbox" defaultChecked className="size-4 accent-[var(--brand)]" /> Keep me signed in</label>
                  <button type="button" onClick={() => setMode('forgot')} className="font-bold text-brand-fg hover:underline">Forgot password?</button>
                </div>
              )}
              <Button type="submit" variant="primary" size="lg" className="mt-7 w-full" loading={loading}>
                {loading ? (mode === 'signin' ? 'Signing in…' : 'Sending…') : mode === 'signin' ? 'Sign in' : 'Send reset link'}
              </Button>
              <p className="mt-6 flex items-center justify-center gap-1.5 text-[12px] text-fg-3"><ShieldCheck className="size-3.5" /> Secured by Supabase Auth · sessions encrypted</p>
              <p className="mt-2 text-center text-[11px] text-fg-3">Prototype: any valid email + 8-character password signs in. Include “wrong” in the password to see the error state.</p>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}

function PitchArt() {
  return (
    <svg viewBox="0 0 600 800" className="absolute -right-24 top-1/2 h-[120%] -translate-y-1/2 opacity-[0.22]" aria-hidden>
      <defs>
        <radialGradient id="pg" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#B50F31" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#B50F31" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="300" cy="400" r="320" fill="url(#pg)" />
      <g fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="1.5">
        <rect x="60" y="40" width="480" height="720" rx="6" />
        <line x1="60" y1="400" x2="540" y2="400" />
        <circle cx="300" cy="400" r="70" />
        <rect x="170" y="40" width="260" height="110" />
        <rect x="235" y="40" width="130" height="40" />
        <rect x="170" y="650" width="260" height="110" />
        <rect x="235" y="720" width="130" height="40" />
      </g>
    </svg>
  )
}
