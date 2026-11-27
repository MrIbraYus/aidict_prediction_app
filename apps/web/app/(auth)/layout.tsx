import type { ReactNode } from 'react'

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

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden border-r border-line bg-[#0c0a0a] lg:flex lg:flex-col lg:justify-between lg:p-12">
        <PitchArt />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/aidict-logo.png" alt="AIDICT" className="relative h-10 w-auto self-start" />
        <div className="relative">
          <h1 className="max-w-lg text-[40px] font-extrabold leading-[1.08] tracking-[-0.02em] text-white">
            Analyse the data.
            <br />
            Calculate the probability.
            <br />
            <span className="text-[#f2546f]">Explain</span> the prediction.
            <br />
            Track the results.
          </h1>
          <p className="mt-5 max-w-md text-[14px] text-[#bcb3b1]">Statistical football intelligence with calibrated probabilities, transparent methodology and an immutable prediction record.</p>
        </div>
        <div className="relative flex items-center gap-6 text-[12px] font-semibold text-[#857c7a]">
          <span>Dixon–Coles · Platt calibration · walk-forward backtests</span>
          <span>No guarantees. No betting.</span>
        </div>
      </aside>
      <main className="flex flex-col items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-[400px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/aidict-icon.png" alt="AIDICT" className="mb-8 size-14 rounded-2xl shadow-glow lg:hidden" />
          {children}
        </div>
      </main>
    </div>
  )
}
