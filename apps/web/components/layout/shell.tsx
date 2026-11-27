'use client'
import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3, Bell, BookOpen, ChevronsLeft, Database, HeartHandshake, History, Info, LayoutDashboard, ListChecks, ListOrdered, LogOut, Menu, Search,
  Settings, ShieldCheck, Star, User, Zap,
} from 'lucide-react'
import { cx, relTime } from '@/lib/format'
import { rememberTimeZone, signOut } from '@/lib/actions'
import { Sheet, Toaster } from '../ui/overlay'
import { ThemeToggle } from './theme-toggle'

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; badge?: ReactNode; admin?: boolean }
export type ShellInfo = { email: string; admin: boolean; unread: number; live: number; lastSync: string | null; sourcesOk: number; sourcesTotal: number; tz: string }

function nav(info: ShellInfo): { group: string; items: NavItem[] }[] {
  return [
    {
      group: 'Analyse',
      items: [
        { to: '/', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/matches', label: 'Matches', icon: ListOrdered, badge: info.live ? <span className="num rounded-md bg-live px-1.5 text-[11px] font-bold text-[#04140a]">{info.live}</span> : undefined },
        { to: '/markets', label: 'Smart Picks', icon: ListChecks },
      ],
    },
    {
      group: 'Explore',
      items: [
        { to: '/competitions', label: 'Competitions', icon: BookOpen },
        { to: '/saved', label: 'Saved', icon: Star },
      ],
    },
    {
      group: 'Track',
      items: [
        { to: '/history', label: 'Prediction History', icon: History },
        { to: '/performance', label: 'Performance', icon: BarChart3 },
      ],
    },
    {
      group: 'System',
      items: [
        { to: '/providers', label: 'Data Status', icon: Database },
        { to: '/notifications', label: 'Notifications', icon: Bell, badge: info.unread ? <span className="num rounded-md bg-surface-3 px-1.5 text-[11px] font-bold text-fg-2">{info.unread}</span> : undefined },
        ...(info.admin ? [{ to: '/admin', label: 'Admin', icon: ShieldCheck }] : []),
      ],
    },
  ]
}

const FOOT: NavItem[] = [
  { to: '/responsible', label: 'Responsible Use', icon: HeartHandshake },
  { to: '/about', label: 'About AIDICT', icon: Info },
  { to: '/settings', label: 'Settings', icon: Settings },
]

const active = (path: string, to: string) => (to === '/' ? path === '/' : path === to || path.startsWith(to + '/') || (to === '/matches' && path.startsWith('/match/')))

/** The supplied wordmark is white; in light theme it sits on a dark plate. Pure CSS swap, no flash. */
function Wordmark({ height = 30 }: { height?: number }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/aidict-logo.png" alt="AIDICT" className="dark-only w-auto" style={{ height }} />
      <span className="light-only inline-flex rounded-[10px] bg-[#141010] px-2.5 py-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/aidict-logo.png" alt="AIDICT" className="w-auto" style={{ height: height - 8 }} />
      </span>
    </>
  )
}

function NavLink({ item, collapsed, onClick }: { item: NavItem; collapsed?: boolean; onClick?: () => void }) {
  const path = usePathname()
  const on = active(path, item.to)
  const Icon = item.icon
  return (
    <Link
      href={item.to}
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={cx(
        'group relative flex h-9 items-center gap-3 rounded-xl px-3 text-[13.5px] font-semibold transition-colors',
        on ? 'bg-surface-2 text-fg' : 'text-fg-3 hover:bg-surface-1 hover:text-fg-2',
        collapsed && 'justify-center px-0',
      )}
      aria-current={on ? 'page' : undefined}
    >
      {on && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-fg shadow-[0_0_10px_var(--brand-glow)]" aria-hidden />}
      <Icon className={cx('size-[18px] shrink-0', on && 'text-brand-fg')} />
      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
      {!collapsed && item.badge}
    </Link>
  )
}

function Sidebar({ info }: { info: ShellInfo }) {
  const [collapsed, setCollapsed] = useState(false)
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem('aidict.sidebar') === 'collapsed')
    } catch {}
  }, [])
  const toggle = (v: boolean) => {
    setCollapsed(v)
    try {
      localStorage.setItem('aidict.sidebar', v ? 'collapsed' : 'open')
    } catch {}
  }
  return (
    <aside className={cx('sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-bg-elev transition-[width] duration-200 lg:flex', collapsed ? 'w-[76px]' : 'w-[256px]')}>
      <div className={cx('flex h-[68px] items-center border-b border-line', collapsed ? 'justify-center' : 'justify-between px-5')}>
        <Link href="/" aria-label="AIDICT home">
          {collapsed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/brand/aidict-icon.png" alt="AIDICT" className="size-9 rounded-[10px]" />
          ) : (
            <Wordmark />
          )}
        </Link>
        {!collapsed && (
          <button onClick={() => toggle(true)} aria-label="Collapse sidebar" className="text-fg-3 hover:text-fg">
            <ChevronsLeft className="size-4" />
          </button>
        )}
      </div>
      <nav className="no-scrollbar flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Main">
        {collapsed && (
          <button onClick={() => toggle(false)} aria-label="Expand sidebar" className="mx-auto flex size-10 items-center justify-center rounded-xl text-fg-3 hover:bg-surface-1 hover:text-fg">
            <Menu className="size-[18px]" />
          </button>
        )}
        {[...nav(info), { group: 'More', items: FOOT }].map((g) => (
          <div key={g.group}>
            {!collapsed && <div className="eyebrow mb-1.5 px-3">{g.group}</div>}
            <div className="space-y-0.5">
              {g.items.map((it) => (
                <NavLink key={it.to} item={it} collapsed={collapsed} />
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-line px-3 py-3">
        <Link href="/settings" className={cx('flex items-center gap-3 rounded-xl p-2 hover:bg-surface-1', collapsed && 'justify-center')}>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand text-white">
            <User className="size-4" />
          </span>
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-bold text-fg">{info.email}</span>
              <span className="block text-[11px] font-semibold text-fg-3">{info.admin ? 'Admin' : 'Member'}</span>
            </span>
          )}
        </Link>
      </div>
    </aside>
  )
}

function DataFreshness({ info }: { info: ShellInfo }) {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(t)
  }, [])
  const stale = !info.lastSync || (now != null && now - new Date(info.lastSync).getTime() > 3 * 3600_000)
  const healthy = !stale && info.sourcesOk === info.sourcesTotal
  return (
    <Link href="/providers" className="hidden h-10 items-center gap-2 rounded-full border border-line bg-surface-1 px-3 text-[12px] font-semibold text-fg-2 hover:text-fg md:flex" title="Data freshness and provider status">
      <span className={cx('relative size-2 rounded-full', healthy ? 'bg-live' : 'bg-warn')} />
      {info.lastSync ? <>Updated {now == null ? '…' : relTime(info.lastSync, now)}</> : 'No sync yet'}
      <span className="text-fg-3">
        · {info.sourcesOk}/{info.sourcesTotal} jobs OK
      </span>
    </Link>
  )
}

function SearchForm({ autoFocus, onDone }: { autoFocus?: boolean; onDone?: () => void }) {
  return (
    <form action="/search" onSubmit={() => onDone?.()} className="flex h-10 w-full items-center gap-2 rounded-full border border-line bg-surface-1 px-3.5 focus-within:border-brand-fg" role="search">
      <Search className="size-4 shrink-0 text-fg-3" />
      <input name="q" autoFocus={autoFocus} placeholder="Search teams or competitions" aria-label="Search teams or competitions" className="h-full w-full min-w-0 bg-transparent text-[16px] font-medium text-fg outline-none placeholder:text-fg-3 sm:text-[13px]" />
    </form>
  )
}

function Topbar({ info, onMenu }: { info: ShellInfo; onMenu: () => void }) {
  const [search, setSearch] = useState(false)
  const path = usePathname()
  useEffect(() => setSearch(false), [path])
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-[color-mix(in_srgb,var(--bg)_82%,transparent)] backdrop-blur-xl">
      <div className="flex h-[64px] items-center gap-3 px-4 lg:h-[68px] lg:px-7">
        <Link href="/" className="lg:hidden" aria-label="AIDICT home">
          <Wordmark height={26} />
        </Link>
        <div className="ml-auto hidden w-full max-w-[380px] md:block lg:ml-0">
          <SearchForm />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <DataFreshness info={info} />
          <button aria-label="Search" onClick={() => setSearch(true)} className="inline-flex size-10 items-center justify-center rounded-full border border-line bg-surface-2 text-fg-2 hover:text-fg md:hidden">
            <Search className="size-[18px]" />
          </button>
          <ThemeToggle />
          <Link href="/notifications" aria-label={`Notifications${info.unread ? `, ${info.unread} unread` : ''}`} className="relative inline-flex size-10 items-center justify-center rounded-full border border-line bg-surface-2 text-fg-2 hover:text-fg">
            <Bell className="size-[18px]" />
            {info.unread > 0 && <span className="absolute right-2 top-2 size-2 rounded-full bg-brand ring-2 ring-[var(--bg)]" aria-hidden />}
          </Link>
          <button aria-label="Menu" onClick={onMenu} className="inline-flex size-10 items-center justify-center rounded-full border border-line bg-surface-2 text-fg-2 hover:text-fg lg:hidden">
            <Menu className="size-[18px]" />
          </button>
        </div>
      </div>
      <Sheet open={search} onClose={() => setSearch(false)} title="Search">
        <SearchForm autoFocus onDone={() => setSearch(false)} />
      </Sheet>
    </header>
  )
}

/** Floating pill bottom navigation for phones. */
function MobileNav({ onMore }: { onMore: () => void }) {
  const path = usePathname()
  const items = [
    { to: '/matches', label: 'Matches', icon: ListOrdered },
    { to: '/markets', label: 'Picks', icon: ListChecks },
    { to: '/', label: 'Home', icon: Zap },
    { to: '/history', label: 'History', icon: History },
  ]
  return (
    <nav className="fixed inset-x-3 bottom-3 z-40 pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Primary">
      <div className="mx-auto flex max-w-md items-center justify-between rounded-[26px] border border-line-strong bg-[color-mix(in_srgb,var(--surface-1)_88%,transparent)] px-2 py-1.5 shadow-pop backdrop-blur-xl">
        {items.map((it) => {
          const on = active(path, it.to)
          const Icon = it.icon
          return (
            <Link key={it.to} href={it.to} className="relative flex w-16 flex-col items-center gap-0.5 py-1.5" aria-current={on ? 'page' : undefined}>
              <Icon className={cx('size-5', on ? 'text-fg' : 'text-fg-3')} />
              <span className={cx('text-[10px] font-bold', on ? 'text-fg' : 'text-fg-3')}>{it.label}</span>
              {on && <span className="glow-bar !bottom-[-6px]" aria-hidden />}
            </Link>
          )
        })}
        <button onClick={onMore} className="flex w-16 flex-col items-center gap-0.5 py-1.5 text-fg-3">
          <Menu className="size-5" />
          <span className="text-[10px] font-bold">More</span>
        </button>
      </div>
    </nav>
  )
}

function MobileMenu({ info, open, onClose }: { info: ShellInfo; open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Menu">
      <div className="space-y-5">
        {nav(info).map((g) => (
          <div key={g.group}>
            <div className="eyebrow mb-1.5 px-1">{g.group}</div>
            <div className="grid grid-cols-1 gap-0.5">
              {g.items.map((it) => (
                <NavLink key={it.to} item={it} onClick={onClose} />
              ))}
            </div>
          </div>
        ))}
        <div>
          <div className="eyebrow mb-1.5 px-1">More</div>
          {FOOT.map((it) => (
            <NavLink key={it.to} item={it} onClick={onClose} />
          ))}
          <form action={signOut}>
            <button className="flex h-9 w-full items-center gap-3 rounded-xl px-3 text-[13.5px] font-semibold text-fg-3 hover:bg-surface-1 hover:text-fg-2">
              <LogOut className="size-[18px]" /> Sign out
            </button>
          </form>
        </div>
      </div>
    </Sheet>
  )
}

export function AppShell({ info, children }: { info: ShellInfo; children: ReactNode }) {
  const [menu, setMenu] = useState(false)
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (tz && tz !== info.tz) void rememberTimeZone(tz)
  }, [info.tz])
  return (
    <div className="flex min-h-dvh">
      <Sidebar info={info} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar info={info} onMenu={() => setMenu(true)} />
        <main className="mx-auto w-full max-w-[1480px] flex-1 px-4 pb-32 pt-5 sm:pt-6 lg:px-7 lg:pb-12" id="main">
          {children}
        </main>
      </div>
      <MobileNav onMore={() => setMenu(true)} />
      <MobileMenu info={info} open={menu} onClose={() => setMenu(false)} />
      <Toaster />
    </div>
  )
}
