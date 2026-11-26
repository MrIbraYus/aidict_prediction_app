import { useEffect, useState } from 'react'
import { AlertTriangle, Bell, BrainCircuit, CheckCheck, Database, KeyRound, Laptop, LogOut, Monitor, Moon, Settings2, Smartphone, Sun, Trophy, Volume2, VolumeX } from 'lucide-react'
import { Link, navigate, useRoute } from '../lib/router'
import { useApp, type Theme } from '../lib/store'
import { cx, relTime } from '../lib/format'
import { NOW } from '../mock/matches'
import { PROVIDERS, SYNC_JOBS } from '../mock/system'
import { useNotify, type NotifCategory } from '../lib/notify'
import { NotificationRow, NotificationSimulator, SoundSettings } from '../components/notify'
import { teamById } from '../mock/teams'
import { PageHeader } from '../components/layout/shell'
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Notice, Progress, Segmented, Select, StatusBadge, Switch, Table, Td, Th } from '../components/ui/primitives'
import { PageState } from '../components/ui/overlay'
import { Crest } from '../components/sports/identity'

type InboxFilter = 'all' | 'unread' | 'predictions' | 'match' | 'results' | 'system'
const FILTER_CATS: Record<Exclude<InboxFilter, 'all' | 'unread'>, NotifCategory[]> = { predictions: ['prediction'], match: ['kickoff', 'live', 'goal', 'finished'], results: ['settled'], system: ['system'] }

export function NotificationsPage() {
  const inbox = useNotify((s) => s.inbox)
  const markAllRead = useNotify((s) => s.markAllRead)
  const prefs = useNotify((s) => s.prefs)
  const setPrefs = useNotify((s) => s.setPrefs)
  const [filter, setFilter] = useState<InboxFilter>('all')
  const list = inbox.filter((n) => (filter === 'all' ? true : filter === 'unread' ? !n.read : FILTER_CATS[filter].includes(n.category)))
  const chips: [InboxFilter, string][] = [['all', 'All'], ['unread', `Unread · ${inbox.filter((i) => !i.read).length}`], ['predictions', 'Predictions'], ['match', 'Match alerts'], ['results', 'Results'], ['system', 'System']]
  return (
    <>
      <PageHeader
        eyebrow="Inbox"
        title="Notifications"
        actions={
          <>
            <Button size="sm" variant={prefs.sound ? 'outline' : 'secondary'} onClick={() => setPrefs({ sound: !prefs.sound })} aria-pressed={!prefs.sound}>
              {prefs.sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4 text-warn" />} {prefs.sound ? 'Sound on' : 'Muted'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate('/settings?section=notifications')}><Settings2 className="size-4" /> Sound settings</Button>
            <Button size="sm" variant="outline" onClick={markAllRead}><CheckCheck className="size-4" /> Mark all read</Button>
          </>
        }
      />
      <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        {chips.map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)} aria-pressed={filter === k} className={cx('h-9 shrink-0 rounded-full border px-3.5 text-[12.5px] font-bold transition-colors', filter === k ? 'border-transparent bg-fg text-fg-inverse' : 'border-line bg-surface-1 text-fg-2 hover:text-fg')}>
            {label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <PageState empty={<EmptyState icon={<Bell className="size-6" />} title="You're all caught up" body="Kick-off alerts, goals in saved matches, settled predictions and data issues will appear here." />}>
          <Card className="min-w-0 self-start">
            {list.length === 0 ? (
              <EmptyState icon={<Bell className="size-6" />} title="Nothing in this view" body="Kick-off alerts, goals in saved matches, settled predictions and data issues will appear here." />
            ) : (
              <ul className="divide-y divide-line">
                {list.map((n) => (
                  <li key={n.id}><NotificationRow item={n} /></li>
                ))}
              </ul>
            )}
          </Card>
        </PageState>
        <div className="space-y-5">
          <NotificationSimulator />
          <Notice tone="neutral" title="How fast are match alerts?">
            Goal and kick-off alerts are only as fast as the data source: OpenLigaDB is near real time for German leagues, football-data.org's free tier is delayed, and API-Football is limited to 100 calls a day. AIDICT shows the source in every alert.
          </Notice>
        </div>
      </div>
    </>
  )
}

export function ProfilePage() {
  const toast = useApp((s) => s.toast)
  const [name, setName] = useState('Personal account')
  return (
    <>
      <PageHeader eyebrow="Account" title="Profile" />
      <PageState>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
          <Card className="p-6 text-center">
            <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-brand text-[26px] font-extrabold text-white shadow-glow">PA</div>
            <div className="mt-4 text-[18px] font-bold">{name}</div>
            <div className="text-[13px] text-fg-3">owner@example.com</div>
            <div className="mt-3 flex justify-center gap-2"><Badge tone="brand">Admin</Badge><Badge>Personal use</Badge></div>
            <div className="mt-6 grid grid-cols-3 gap-2">
              {[['Saved', 3], ['Alerts', 2], ['Since', 'Aug 26']].map(([k, v]) => (
                <div key={k as string} className="card-inset py-2"><div className="num text-[18px] font-bold">{v}</div><div className="text-[10px] font-bold text-fg-3">{(k as string).toUpperCase()}</div></div>
              ))}
            </div>
          </Card>
          <div className="space-y-5">
            <Card className="p-5">
              <h2 className="mb-4 text-[15px] font-bold">Details</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Display name" htmlFor="dn"><Input id="dn" value={name} onChange={(e) => setName(e.target.value)} /></Field>
                <Field label="Email" hint="Managed by Supabase Auth" htmlFor="em"><Input id="em" value="owner@example.com" disabled /></Field>
              </div>
              <div className="mt-5 flex justify-end"><Button variant="primary" onClick={() => toast({ tone: 'success', title: 'Profile updated' })}>Save changes</Button></div>
            </Card>
            <Card className="p-5">
              <h2 className="mb-4 text-[15px] font-bold">Favourite teams</h2>
              <div className="flex flex-wrap gap-2">
                {['ars', 'rma', 'bay', 'int'].map((id) => (
                  <Link key={id} to={`/team/${id}`} className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface-2 pl-1.5 pr-3.5 text-[13px] font-semibold hover:border-line-strong"><Crest team={teamById(id)} size={22} />{teamById(id).short}</Link>
                ))}
                <button className="h-10 rounded-full border border-dashed border-line-strong px-4 text-[13px] font-semibold text-fg-3 hover:text-fg">+ Add team</button>
              </div>
            </Card>
            <Card className="p-5">
              <h2 className="mb-4 text-[15px] font-bold">Security</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl bg-surface-2 p-3.5">
                  <span className="flex items-center gap-3 text-[13px] font-semibold"><KeyRound className="size-4 text-fg-3" /> Password · changed 3 months ago</span>
                  <Button size="sm" variant="outline" onClick={() => toast({ tone: 'info', title: 'Reset email sent', body: 'Check your inbox to set a new password.' })}>Change</Button>
                </div>
                {[{ icon: Laptop, label: 'Windows · Edge — this device', when: 'Active now' }, { icon: Smartphone, label: 'Android · Chrome', when: '2 days ago' }].map((s) => (
                  <div key={s.label} className="flex items-center justify-between rounded-xl bg-surface-2 p-3.5">
                    <span className="flex items-center gap-3 text-[13px] font-semibold"><s.icon className="size-4 text-fg-3" /> {s.label}</span>
                    <span className="text-[12px] text-fg-3">{s.when}</span>
                  </div>
                ))}
                <Button variant="danger" onClick={() => navigate('/login')}><LogOut className="size-4" /> Sign out of all sessions</Button>
              </div>
            </Card>
          </div>
        </div>
      </PageState>
    </>
  )
}

export function SettingsPage() {
  const s = useApp()
  const [reality, setReality] = useState('60')
  const { query } = useRoute()
  useEffect(() => {
    if (query.get('section') === 'notifications') setTimeout(() => document.getElementById('notifications')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 450)
  }, [query])
  return (
    <>
      <PageHeader eyebrow="Preferences" title="Settings" actions={<Button variant="primary" onClick={() => s.toast({ tone: 'success', title: 'Settings saved' })}>Save settings</Button>} />
      <PageState>
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="text-[15px] font-bold">Appearance</h2>
            <p className="mb-4 text-[13px] text-fg-3">Dark is the primary design. Light uses the same tokens.</p>
            <Segmented<Theme>
              value={s.theme}
              onChange={(v) => s.set({ theme: v })}
              items={[
                { value: 'dark', label: <span className="flex items-center gap-1.5"><Moon className="size-3.5" /> Dark</span> },
                { value: 'light', label: <span className="flex items-center gap-1.5"><Sun className="size-3.5" /> Light</span> },
                { value: 'system', label: <span className="flex items-center gap-1.5"><Monitor className="size-3.5" /> System</span> },
              ]}
            />
          </Card>
          <Card className="p-5">
            <h2 className="mb-4 text-[15px] font-bold">Regional & display</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Time zone"><Select value={s.timeZone} onChange={(v) => s.set({ timeZone: v })} options={['UTC (GMT+0)', 'Europe/London', 'Africa/Accra', 'Africa/Lagos', 'Europe/Berlin', 'America/New_York'].map((x) => ({ value: x, label: x }))} /></Field>
              <Field label="Odds format"><Select value={s.oddsFormat} onChange={(v) => s.set({ oddsFormat: v })} options={[{ value: 'decimal', label: 'Decimal (1.95)' }, { value: 'fractional', label: 'Fractional (19/20)' }, { value: 'american', label: 'American (−105)' }]} /></Field>
              <Field label="Probability format"><Select value={s.probabilityFormat} onChange={(v) => s.set({ probabilityFormat: v })} options={[{ value: 'percent', label: 'Percent (54%)' }, { value: 'decimal', label: 'Decimal (0.54)' }]} /></Field>
              <Field label="Default sport"><Select value="football" onChange={() => {}} options={[{ value: 'football', label: 'Football' }, { value: 'basketball', label: 'Basketball (in development)', disabled: true }]} /></Field>
            </div>
          </Card>
          <SoundSettings />
          <Card className="p-5">
            <h2 className="mb-1 text-[15px] font-bold">Responsible use</h2>
            <p className="mb-4 text-[13px] text-fg-3">Tools to keep analysis in perspective. <Link to="/responsible" className="font-semibold text-brand-fg">Learn more</Link></p>
            <div className="space-y-4">
              <Field label="Reality-check reminder" hint="Shows how long you have been using AIDICT in this session.">
                <Select value={reality} onChange={setReality} options={[{ value: '0', label: 'Off' }, { value: '30', label: 'Every 30 minutes' }, { value: '60', label: 'Every 60 minutes' }, { value: '120', label: 'Every 2 hours' }]} />
              </Field>
              <label className="flex items-center justify-between gap-4 rounded-xl px-2 py-2.5 hover:bg-surface-2">
                <span><span className="block text-[13.5px] font-semibold">Hide value / EV indicators</span><span className="block text-[12px] text-fg-3">Show probabilities only, without odds comparisons</span></span>
                <Switch checked={s.hideValue} onChange={(v) => s.set({ hideValue: v })} label="Hide value indicators" />
              </label>
            </div>
          </Card>
          <Card className="p-5">
            <h2 className="mb-4 text-[15px] font-bold">Data & privacy</h2>
            <div className="flex flex-col gap-3">
              <Button variant="outline" onClick={() => s.toast({ tone: 'success', title: 'Local cache cleared' })}>Clear local cache</Button>
              <Button variant="outline" onClick={() => s.toast({ tone: 'info', title: 'Export requested', body: 'Your saved matches and settings as JSON.' })}>Export my data</Button>
              <Button variant="danger" onClick={() => s.toast({ tone: 'error', title: 'Confirmation required', body: 'Account deletion asks for your password first.' })}>Delete account</Button>
            </div>
          </Card>
        </div>
      </PageState>
    </>
  )
}

export function ProvidersPage() {
  return (
    <>
      <PageHeader eyebrow="Transparency" title="Data provider status" description="Where every number comes from, how fresh it is, and how much of each free quota is used." />
      <PageState>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {PROVIDERS.map((p) => (
            <Card key={p.id} as="article" className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-[16px] font-bold">{p.name}</h2>
                  <p className="text-[12px] text-fg-3">{p.role}</p>
                </div>
                <StatusBadge status={p.status} />
              </div>
              {p.incident && <Notice tone="warn" className="mt-4" icon={<AlertTriangle className="size-4" />}>{p.incident}</Notice>}
              <dl className="mt-4 space-y-2 text-[12.5px]">
                <div className="flex justify-between"><dt className="text-fg-3">Last sync</dt><dd className="font-semibold">{relTime(p.lastSync, NOW)}</dd></div>
                <div className="flex justify-between"><dt className="text-fg-3">Freshness</dt><dd className="text-right font-semibold">{p.freshness}</dd></div>
                <div className="flex justify-between"><dt className="text-fg-3">Coverage</dt><dd className="font-semibold">{p.coverage}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-fg-3">Licence</dt><dd className="text-right font-semibold">{p.licence}</dd></div>
              </dl>
              {p.quota && (
                <div className="mt-4">
                  <div className="mb-1.5 flex justify-between text-[12px] font-semibold"><span className="text-fg-3">Quota ({p.quota.unit})</span><span className="num text-[14px]">{p.quota.used} / {p.quota.limit}</span></div>
                  <Progress value={p.quota.used / p.quota.limit} tone={p.quota.used / p.quota.limit > 0.8 ? 'danger' : p.quota.used / p.quota.limit > 0.6 ? 'warn' : 'live'} />
                </div>
              )}
            </Card>
          ))}
        </div>
        <Card className="mt-5">
          <CardHeader title="Scheduled jobs" eyebrow="No permanent background processes" />
          <Table className="mt-2">
            <thead><tr><Th>Job</Th><Th>Runner</Th><Th>Schedule</Th><Th>Last run</Th><Th>Duration</Th><Th>Status</Th></tr></thead>
            <tbody>
              {SYNC_JOBS.map((j) => (
                <tr key={j.job}>
                  <Td className="font-mono text-[12.5px] font-semibold text-fg">{j.job}{j.note && <div className="font-sans text-[11px] font-medium text-fg-3">{j.note}</div>}</Td>
                  <Td>{j.runner}</Td>
                  <Td className="font-mono text-[12px]">{j.cron}</Td>
                  <Td>{relTime(j.last, NOW)}</Td>
                  <Td>{j.duration}</Td>
                  <Td><StatusBadge status={j.status} /></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        <p className="mt-4 text-[11px] text-fg-3">Attribution: Daten von OpenLigaDB (www.openligadb.de), lizenziert unter ODbL 1.0 · OpenFootball data is public domain (CC0) · football-data.org · football-data.co.uk · API-Football.</p>
      </PageState>
    </>
  )
}

export function ResponsiblePage() {
  return (
    <>
      <PageHeader eyebrow="Please read" title="Responsible use" description="AIDICT is a statistical analysis tool. It is not a tipping service and does not place bets." />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          {[
            ['Probabilities are not promises', 'A 70% prediction is expected to be wrong about 3 times in 10. Even a perfectly calibrated model loses often. Nothing on AIDICT is guaranteed, fixed or risk-free.'],
            ['Past performance does not guarantee future results', 'Performance figures describe how past predictions turned out. Football changes — injuries, transfers, managers — and models can degrade.'],
            ['“Skip” is a valid answer', 'When data is incomplete, models disagree or a market is not validated, AIDICT recommends skipping instead of forcing a prediction.'],
            ['Value is not certainty', 'A positive expected value only describes an average over many repetitions, and only if the model is well calibrated. Short-term results vary widely.'],
            ['Keep it in proportion', 'Set time reminders in Settings. If analysis stops being enjoyable or you feel pressure to recover losses, take a break and talk to someone.'],
          ].map(([t, b]) => (
            <Card key={t} className="p-5">
              <h2 className="text-[16px] font-bold">{t}</h2>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-fg-2">{b}</p>
            </Card>
          ))}
        </div>
        <div className="space-y-5">
          <Card className="p-5">
            <div className="eyebrow mb-3">Free, confidential support</div>
            <ul className="space-y-3 text-[13px]">
              {[
                ['BeGambleAware (UK)', 'begambleaware.org · 0808 8020 133'],
                ['GamCare (UK)', 'gamcare.org.uk'],
                ['Gamblers Anonymous', 'gamblersanonymous.org'],
                ['National Council on Problem Gambling (US)', 'ncpgambling.org · 1-800-GAMBLER'],
                ['Gambling Therapy (worldwide, multilingual)', 'gamblingtherapy.org'],
              ].map(([n, d]) => (
                <li key={n} className="rounded-xl bg-surface-2 p-3"><div className="font-bold">{n}</div><div className="text-fg-3">{d}</div></li>
              ))}
            </ul>
          </Card>
          <Notice tone="neutral" title="No betting features">AIDICT has no payments, deposits, bookmaker accounts or bet placement — by design.</Notice>
        </div>
      </div>
    </>
  )
}

export function AboutPage() {
  return (
    <>
      <PageHeader eyebrow="AIDICT" title="About AIDICT" />
      <Card className="hero-stage mb-5 overflow-hidden p-6 sm:p-8">
        <img src="./brand/aidict-icon.png" alt="" className="size-16 rounded-2xl shadow-glow" />
        <h2 className="mt-5 text-[24px] font-extrabold sm:text-[30px]">Analyse the data. Calculate the probability. Explain the prediction. Track the results.</h2>
        <p className="mt-3 max-w-2xl text-[14px] text-fg-2">AIDICT is a personal multi-sport intelligence platform. It turns historical results and match statistics into calibrated probabilities, explains them, and keeps an immutable record of how every prediction performed.</p>
      </Card>
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="p-5">
          <div className="eyebrow mb-3 flex items-center gap-1.5"><BrainCircuit className="size-3.5" /> Methodology</div>
          <ul className="space-y-2 text-[13px] text-fg-2">
            <li>Elo ratings with home advantage</li>
            <li>Poisson and Dixon–Coles goal models</li>
            <li>Logistic regression and gradient-boosting challengers</li>
            <li>Monte Carlo for multi-match analysis</li>
            <li>Walk-forward validation, Brier, log loss, RPS, calibration</li>
            <li>No language model generates probabilities</li>
          </ul>
        </Card>
        <Card className="p-5">
          <div className="eyebrow mb-3 flex items-center gap-1.5"><Database className="size-3.5" /> Data sources & attribution</div>
          <ul className="space-y-2 text-[13px] text-fg-2">
            <li><b className="text-fg">OpenFootball</b> — public domain (CC0)</li>
            <li><b className="text-fg">OpenLigaDB</b> — Daten von OpenLigaDB (www.openligadb.de), lizenziert unter ODbL 1.0</li>
            <li><b className="text-fg">football-data.org</b> — fixtures, results, standings</li>
            <li><b className="text-fg">football-data.co.uk</b> — historical statistics and odds (private use)</li>
            <li><b className="text-fg">API-Football</b> — statistics and line-ups (budgeted)</li>
          </ul>
        </Card>
        <Card className="p-5">
          <div className="eyebrow mb-3 flex items-center gap-1.5"><Trophy className="size-3.5" /> Version</div>
          <dl className="space-y-2 text-[13px]">
            {[['App', '1.0 · prototype'], ['Football model', 'football-dc 1.3.0'], ['Sports active', 'Football'], ['Hosting', 'Vercel · Supabase · GitHub Actions']].map(([k, v]) => (
              <div key={k} className="flex justify-between"><dt className="text-fg-3">{k}</dt><dd className="font-semibold">{v}</dd></div>
            ))}
          </dl>
          <p className="mt-4 text-[12px] text-fg-3">Club names are used for identification only. Crests shown are generated monograms, not official badges.</p>
        </Card>
      </div>
    </>
  )
}
