import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Search, X } from 'lucide-react'
import { navigate, useRoute } from '../../lib/router'
import { cx, fmtDay, fmtTime } from '../../lib/format'
import { MATCHES } from '../../mock/matches'
import { ALL_TEAMS, COMPETITIONS, compById, teamById } from '../../mock/teams'
import { Crest, Flag } from '../sports/identity'

type Result = { key: string; group: 'Teams' | 'Competitions' | 'Matches'; to: string; icon: ReactNode; title: string; sub: string }

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function useResults(q: string): Result[] {
  return useMemo(() => {
    const n = norm(q.trim())
    if (!n) return []
    const teams = ALL_TEAMS.filter((t) => [t.name, t.short, t.tla, t.city].some((x) => norm(x).includes(n)))
      .slice(0, 6)
      .map<Result>((t) => ({ key: 't' + t.id, group: 'Teams', to: `/team/${t.id}`, icon: <Crest team={t} size={22} />, title: t.name, sub: t.compId === 'wc' ? 'National team' : compById(t.compId).name }))
    const comps = COMPETITIONS.filter((c) => [c.name, c.code, c.country].some((x) => norm(x).includes(n)))
      .slice(0, 4)
      .map<Result>((c) => ({ key: 'c' + c.id, group: 'Competitions', to: `/competitions/${c.id}`, icon: <Flag code={c.flag} />, title: c.name, sub: `${c.country} · ${c.season}` }))
    const matches = MATCHES.filter((m) => [teamById(m.homeId), teamById(m.awayId)].some((t) => norm(t.name).includes(n) || norm(t.short).includes(n)))
      .slice(0, 5)
      .map<Result>((m) => ({
        key: 'm' + m.id,
        group: 'Matches',
        to: `/match/${m.id}`,
        icon: (
          <span className="flex -space-x-1.5">
            <Crest team={teamById(m.homeId)} size={20} />
            <Crest team={teamById(m.awayId)} size={20} />
          </span>
        ),
        title: `${teamById(m.homeId).short} v ${teamById(m.awayId).short}`,
        sub: `${compById(m.compId).name} · ${fmtDay(m.kickoff)} ${fmtTime(m.kickoff)}`,
      }))
    return [...teams, ...comps, ...matches]
  }, [q])
}

export function SearchBox({ autoFocus, onDone, variant = 'bar' }: { autoFocus?: boolean; onDone?: () => void; variant?: 'bar' | 'sheet' }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const results = useResults(q)
  const { path } = useRoute()
  useEffect(() => {
    setOpen(false)
    setQ('')
  }, [path])

  useEffect(() => {
    if (variant !== 'bar') return
    const k = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        input.current?.focus()
        setOpen(true)
      }
    }
    const out = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    window.addEventListener('keydown', k)
    document.addEventListener('mousedown', out)
    return () => {
      window.removeEventListener('keydown', k)
      document.removeEventListener('mousedown', out)
    }
  }, [variant])

  const go = (r: Result) => {
    navigate(r.to)
    setQ('')
    setOpen(false)
    onDone?.()
  }

  const list = (
    <div role="listbox" aria-label="Search results" className={cx(variant === 'bar' ? 'absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-[70vh] overflow-auto rounded-2xl border border-line-strong bg-surface-2 p-1.5 shadow-pop animate-fade-up' : 'mt-3')}>
      {results.length === 0 ? (
        <div className="px-3 py-6 text-center text-[13px] text-fg-3">No teams, competitions or matches match “{q}”.</div>
      ) : (
        (['Teams', 'Competitions', 'Matches'] as const).map((g) => {
          const items = results.filter((r) => r.group === g)
          if (!items.length) return null
          return (
            <div key={g} className="py-1">
              <div className="eyebrow px-3 pb-1 pt-1.5">{g}</div>
              {items.map((r) => {
                const idx = results.indexOf(r)
                return (
                  <button
                    key={r.key}
                    role="option"
                    aria-selected={idx === active}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => go(r)}
                    className={cx('flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors', idx === active ? 'bg-surface-3' : 'hover:bg-surface-3')}
                  >
                    <span className="flex w-[34px] shrink-0 justify-center">{r.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold text-fg">{r.title}</span>
                      <span className="block truncate text-[11.5px] text-fg-3">{r.sub}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          )
        })
      )}
    </div>
  )

  return (
    <div ref={ref} className={cx('relative w-full', variant === 'bar' && 'max-w-[380px]')}>
      <label className={cx('flex h-10 w-full items-center gap-2 rounded-full border border-line bg-surface-1 px-4 text-fg-3 focus-within:border-brand-fg', variant === 'sheet' && 'h-12')}>
        <Search className="size-4 shrink-0" />
        <input
          ref={input}
          autoFocus={autoFocus}
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setActive(0)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(results.length - 1, a + 1)) }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)) }
            if (e.key === 'Enter' && results[active]) go(results[active])
            if (e.key === 'Escape') { setOpen(false); input.current?.blur() }
          }}
          className="w-full bg-transparent text-[16px] font-medium text-fg outline-none placeholder:text-fg-3 md:text-[13px]"
          placeholder="Search teams, competitions, matches"
          aria-label="Search"
          role="combobox"
          aria-expanded={open && q.length > 0}
        />
        {q ? (
          <button aria-label="Clear search" onClick={() => setQ('')} className="text-fg-3 hover:text-fg">
            <X className="size-4" />
          </button>
        ) : (
          variant === 'bar' && <kbd className="whitespace-nowrap rounded-md border border-line px-1.5 text-[10px] font-bold">Ctrl K</kbd>
        )}
      </label>
      {q.length > 0 && (variant === 'sheet' || open) && list}
    </div>
  )
}
