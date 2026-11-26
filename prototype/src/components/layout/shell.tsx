import { useEffect, useState, type ReactNode } from 'react'
import {
  Activity, BarChart3, Bell, BookOpen, ChevronsLeft, CircleDot, Database, FlaskConical, History, Info, LayoutDashboard, Layers, ListOrdered, Menu,
  Palette, Search, Settings, ShieldCheck, Sparkles, Star, Trophy, User, Zap, LogOut, HeartHandshake, ListChecks,
} from 'lucide-react'
import { Link, isActive, navigate, useRoute } from '../../lib/router'
import { useApp, type ViewState } from '../../lib/store'
import { cx, relTime } from '../../lib/format'
import { MATCHES, NOW } from '../../mock/matches'
import { useResolvedTheme } from '../../lib/theme'
import { PROVIDERS } from '../../mock/system'
import { SPORTS } from '../../mock/teams'
import { Sheet, Toaster } from '../ui/overlay'
import { SearchBox } from './search'
import { BellMenu } from '../notify'
import { useNotify } from '../../lib/notify'
import { Badge, IconButton, Segmented } from '../ui/primitives'

const liveCount = MATCHES.filter((m) => m.status === 'LIVE' || m.status === 'HT').length

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; badge?: () => ReactNode }

const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: 'Analyse',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/matches', label: 'Matches', icon: ListOrdered },
      { to: '/live', label: 'Live', icon: CircleDot, badge: () => <span className="num rounded-md bg-live px-1.5 text-[11px] font-bold text-[#04140a]">{liveCount}</span> },
      { to: '/smart', label: 'Smart Predictions', icon: Sparkles },
      { to: '/markets', label: 'Smart Markets', icon: ListChecks, badge: () => <span className="rounded-md bg-brand-soft px-1.5 text-[10px] font-bold text-brand-fg">NEW</span> },
      { to: '/multi', label: 'Multi-Match', icon: Layers, badge: () => <LegCount /> },
    ],
  },
  {
    group: 'Explore',
    items: [
      { to: '/sports', label: 'Sports', icon: Trophy },
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
      { to: '/notifications', label: 'Notifications', icon: Bell, badge: () => <UnreadCount /> },
      { to: '/admin', label: 'Admin', icon: ShieldCheck },
    ],
  },
]

const FOOT: NavItem[] = [
  { to: '/responsible', label: 'Responsible Use', icon: HeartHandshake },
  { to: '/about', label: 'About AIDICT', icon: Info },
  { to: '/design', label: 'Design System', icon: Palette },
  { to: '/settings', label: 'Settings', icon: Settings },
]

function LegCount() {
  const n = useApp((s) => s.legs.length)
  return n ? <span className="num rounded-md bg-brand px-1.5 text-[11px] font-bold text-white">{n}</span> : null
}
function UnreadCount() {
  const n = useNotify((s) => s.inbox.filter((x) => !x.read).length)
  return n ? <span className="num rounded-md bg-surface-3 px-1.5 text-[11px] font-bold text-fg-2">{n}</span> : null
}

export function Logo({ compact, className }: { compact?: boolean; className?: string }) {
  return compact ? (
    <img src="./brand/aidict-icon.png" alt="AIDICT" className={cx('size-9 rounded-[10px]', className)} />
  ) : (
    <img src="./brand/aidict-logo.png" alt="AIDICT" className={cx('h-[30px] w-auto [[data-theme=light]_&]:hidden', className)} />
  )
}

/** Light theme: the supplied wordmark is white, so it is shown with the crimson mark on a dark plate. */
function LogoAdaptive({ compact }: { compact?: boolean }) {
  const theme = useResolvedTheme()
  if (compact) return <Logo compact />
  return theme === 'light' ? (
    <span className="inline-flex rounded-[10px] bg-[#141010] px-2.5 py-1.5">
      <img src="./brand/aidict-logo.png" alt="AIDICT" className="h-[22px] w-auto" />
    </span>
  ) : (
    <img src="./brand/aidict-logo.png" alt="AIDICT" className="h-[30px] w-auto" />
  )
}

export { useResolvedTheme }

function NavLink({ item, collapsed, onClick }: { item: NavItem; collapsed?: boolean; onClick?: () => void }) {
  const { path } = useRoute()
  const on = isActive(path, item.to) || (item.to === '/matches' && path.startsWith('/match/'))
  const Icon = item.icon
  return (
    <Link
      to={item.to}
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
      {!collapsed && item.badge?.()}
    </Link>
  )
}

function Sidebar() {
  const collapsed = useApp((s) => s.sidebarCollapsed)
  const set = useApp((s) => s.set)
  return (
    <aside className={cx('sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-bg-elev transition-[width] duration-200 lg:flex', collapsed ? 'w-[76px]' : 'w-[256px]')}>
      <div className={cx('flex h-[68px] items-center border-b border-line', collapsed ? 'justify-center' : 'justify-between px-5')}>
        <Link to="/" aria-label="AIDICT home">
          <LogoAdaptive compact={collapsed} />
        </Link>
        {!collapsed && (
          <button onClick={() => set({ sidebarCollapsed: true })} aria-label="Collapse sidebar" className="text-fg-3 hover:text-fg">
            <ChevronsLeft className="size-4" />
          </button>
        )}
      </div>
      <nav className="no-scrollbar flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Main">
        {collapsed && (
          <button onClick={() => set({ sidebarCollapsed: false })} aria-label="Expand sidebar" className="mx-auto flex size-10 items-center justify-center rounded-xl text-fg-3 hover:bg-surface-1 hover:text-fg">
            <Menu className="size-[18px]" />
          </button>
        )}
        {[...NAV, { group: 'More', items: FOOT }].map((g) => (
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
        <Link to="/profile" className={cx('flex items-center gap-3 rounded-xl p-2 hover:bg-surface-1', collapsed && 'justify-center')}>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand text-white"><User className="size-4" /></span>
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-bold text-fg">Personal account</span>
              <span className="block text-[11px] font-semibold text-fg-3">Admin</span>
            </span>
          )}
        </Link>
      </div>
    </aside>
  )
}

function DataFreshness() {
  const ok = PROVIDERS.filter((p) => p.status === 'operational').length
  const latest = PROVIDERS.map((p) => p.lastSync).sort().at(-1)!
  return (
    <Link to="/providers" className="hidden h-10 items-center gap-2 rounded-full border border-line bg-surface-1 px-3 text-[12px] font-semibold text-fg-2 hover:text-fg md:flex" title="Data freshness and provider status">
      <span className="relative flex size-2">
        <span className="absolute inset-0 animate-ping rounded-full bg-warn opacity-50" />
        <span className="relative size-2 rounded-full bg-warn" />
      </span>
      Updated {relTime(latest, NOW)}
      <span className="text-fg-3">· {ok}/{PROVIDERS.length} sources OK</span>
    </Link>
  )
}

function SportSwitcher() {
  const [sport, setSport] = useState('football')
  return (
    <div className="no-scrollbar hidden items-center gap-1 overflow-x-auto xl:flex" role="radiogroup" aria-label="Sport">
      {SPORTS.slice(0, 4).map((s) => (
        <button
          key={s.id}
          role="radio"
          aria-checked={sport === s.id}
          onClick={() => (s.status === 'active' ? setSport(s.id) : navigate('/sports'))}
          title={s.status === 'active' ? s.name : `${s.name} — ${s.status === 'validating' ? 'in development' : 'planned'}`}
          className={cx('h-8 rounded-full px-3 text-[12px] font-bold transition-colors', sport === s.id ? 'bg-fg text-fg-inverse' : 'text-fg-3 hover:text-fg-2', s.status !== 'active' && 'opacity-60')}
        >
          {s.name}
        </button>
      ))}
    </div>
  )
}

function Topbar({ onMenu }: { onMenu: () => void }) {
  const theme = useResolvedTheme()
  const [search, setSearch] = useState(false)
  const { path } = useRoute()
  useEffect(() => setSearch(false), [path])
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-[color-mix(in_srgb,var(--bg)_82%,transparent)] backdrop-blur-xl">
      <div className="flex h-[64px] items-center gap-3 px-4 lg:h-[68px] lg:px-7">
        <Link to="/" className="lg:hidden" aria-label="AIDICT home">
          {theme === 'light' ? <Logo compact /> : <img src="./brand/aidict-logo.png" alt="AIDICT" className="h-[26px] w-auto" />}
        </Link>
        <div className="ml-auto hidden w-full max-w-[380px] md:block lg:ml-0">
          <SearchBox />
        </div>
        <SportSwitcher />
        <div className="ml-auto flex items-center gap-2">
          <DataFreshness />
          <IconButton label="Search" className="md:hidden" onClick={() => setSearch(true)}>
            <Search className="size-[18px]" />
          </IconButton>
          <BellMenu />
          <IconButton label="Menu" className="lg:hidden" onClick={onMenu}>
            <Menu className="size-[18px]" />
          </IconButton>
          <Link to="/profile" className="hidden size-10 items-center justify-center rounded-full bg-brand text-white lg:flex" aria-label="Profile">
            <User className="size-[18px]" />
          </Link>
        </div>
      </div>
      <Sheet open={search} onClose={() => setSearch(false)} title="Search">
        <SearchBox variant="sheet" autoFocus onDone={() => setSearch(false)} />
      </Sheet>
    </header>
  )
}

/** Floating pill bottom navigation for phones (from the UI reference). */
function MobileNav({ onMore }: { onMore: () => void }) {
  const { path } = useRoute()
  const items = [
    { to: '/matches', label: 'Matches', icon: ListOrdered },
    { to: '/smart', label: 'Smart', icon: Sparkles },
    { to: '/', label: 'Home', icon: Zap, center: true },
    { to: '/history', label: 'History', icon: History },
  ]
  return (
    <nav className="fixed inset-x-3 bottom-3 z-40 lg:hidden" aria-label="Primary">
      <div className="mx-auto flex max-w-md items-center justify-between rounded-[26px] border border-line-strong bg-[color-mix(in_srgb,var(--surface-1)_88%,transparent)] px-2 py-1.5 shadow-pop backdrop-blur-xl">
        {items.map((it) => {
          const on = it.to === '/' ? path === '/' : isActive(path, it.to) || (it.to === '/matches' && path.startsWith('/match/'))
          const Icon = it.icon
          return (
            <Link key={it.to} to={it.to} className="relative flex w-16 flex-col items-center gap-0.5 py-1.5" aria-current={on ? 'page' : undefined}>
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

function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Menu">
      <div className="space-y-5">
        {NAV.map((g) => (
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
          {[...FOOT, { to: '/profile', label: 'Profile', icon: User }, { to: '/login', label: 'Sign out', icon: LogOut }].map((it) => (
            <NavLink key={it.to} item={it} onClick={onClose} />
          ))}
        </div>
      </div>
    </Sheet>
  )
}

/** Slim prototype ribbon: makes the sample-data status explicit and exposes state previews. */
function PrototypeBar() {
  const viewState = useApp((s) => s.viewState)
  const theme = useApp((s) => s.theme)
  const set = useApp((s) => s.set)
  return (
    <div className="relative z-40 flex items-center gap-3 border-b border-warn/20 bg-[color-mix(in_srgb,var(--warn)_10%,var(--bg))] px-4 py-1.5 text-[11px] font-semibold text-warn lg:px-7">
      <FlaskConical className="size-3.5 shrink-0" />
      <span className="truncate">
        <span className="font-extrabold">DESIGN PROTOTYPE</span>
        <span className="hidden sm:inline"> · All teams, scores, odds and probabilities are sample data — not real predictions. Clock fixed at Sat 28 Nov 2026, 16:05 UTC.</span>
        <span className="sm:hidden"> · sample data only</span>
      </span>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <span className="hidden text-fg-3 md:inline">Preview state</span>
        <Segmented<ViewState>
          size="sm"
          value={viewState}
          onChange={(v) => set({ viewState: v })}
          items={[
            { value: 'default', label: 'Live' },
            { value: 'loading', label: 'Loading' },
            { value: 'empty', label: 'Empty' },
            { value: 'error', label: 'Error' },
          ]}
          className="!p-0.5"
        />
        <button
          onClick={() => set({ theme: theme === 'light' ? 'dark' : 'light' })}
          className="hidden h-7 items-center gap-1 rounded-lg border border-line px-2 text-fg-2 hover:text-fg sm:flex"
          aria-label="Toggle theme"
        >
          <Palette className="size-3.5" /> {theme === 'light' ? 'Light' : 'Dark'}
        </button>
      </div>
    </div>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const [menu, setMenu] = useState(false)
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <PrototypeBar />
        <Topbar onMenu={() => setMenu(true)} />
        <main className="mx-auto w-full max-w-[1480px] flex-1 px-4 pb-32 pt-5 sm:pt-6 lg:px-7 lg:pb-12" id="main">
          {children}
        </main>
      </div>
      <MobileNav onMore={() => setMenu(true)} />
      <MobileMenu open={menu} onClose={() => setMenu(false)} />
      <Toaster />
    </div>
  )
}

export function PageHeader({ title, eyebrow, description, actions, back }: { title: ReactNode; eyebrow?: ReactNode; description?: ReactNode; actions?: ReactNode; back?: { to: string; label: string } }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link to={back.to} className="mb-2 inline-flex items-center gap-1 text-[12px] font-bold text-fg-3 hover:text-fg">
            ← {back.label}
          </Link>
        )}
        {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
        <h1 className="text-[24px] font-extrabold tracking-[-0.01em] text-fg sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[13.5px] text-fg-3">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function SourceNote({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-fg-3">
      <Activity className="size-3" /> {children}
    </p>
  )
}

export { Badge }
