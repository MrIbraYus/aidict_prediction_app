import { useState } from 'react'
import { CircleDot, Goal, HockeyStick, MapPin, Shirt, Star, Bell, type LucideProps } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Link, navigate, useRoute } from '../lib/router'
import { useApp } from '../lib/store'
import { cx, fmtDate, fmtDay, fmtTime } from '../lib/format'
import { MATCHES, eloHistory, standings, teamForm, teamSeasonStats } from '../mock/matches'
import { ALL_TEAMS, COMPETITIONS, NATIONAL_TEAMS, SPORTS, compById, teamById } from '../mock/teams'
import { badgeFor } from '../mock/badges'
import { PageHeader } from '../components/layout/shell'
import { Badge, Button, Card, CardHeader, EmptyState, Notice, StatusBadge, Switch, Table, Tabs, Td, Th } from '../components/ui/primitives'
import { PageState } from '../components/ui/overlay'
import { MatchRow } from '../components/sports/match'
import { Crest, Flag, FormPills } from '../components/sports/identity'

/** Lucide has no basketball / tennis / cricket / baseball glyphs, so these are drawn in the same 24px, 2px-stroke style. */
const svgBase = (props: LucideProps) => ({ width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, className: props.className, 'aria-hidden': true })
const Basketball = (p: LucideProps) => (<svg {...svgBase(p)}><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2v20M5 5c3 3 3 11 0 14M19 5c-3 3-3 11 0 14" /></svg>)
const Tennis = (p: LucideProps) => (<svg {...svgBase(p)}><circle cx="12" cy="12" r="10" /><path d="M6 4.5c3.5 3.5 3.5 11.5 0 15M18 4.5c-3.5 3.5-3.5 11.5 0 15" /></svg>)
const Cricket = (p: LucideProps) => (<svg {...svgBase(p)}><path d="M14.5 3.5l6 6-9.5 9.5-6-6zM5 13l-2.5 2.5a1.5 1.5 0 0 0 0 2l4 4a1.5 1.5 0 0 0 2 0L11 19" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>)
const Baseball = (p: LucideProps) => (<svg {...svgBase(p)}><circle cx="12" cy="12" r="10" /><path d="M5 5.5c2.5 3.5 2.5 9.5 0 13M19 5.5c-2.5 3.5-2.5 9.5 0 13M6.5 8h1.5M6.5 16h1.5M16 8h1.5M16 16h1.5" /></svg>)
const SPORT_ICON: Record<string, (p: LucideProps) => React.ReactNode> = { football: Goal, basketball: Basketball, tennis: Tennis, cricket: Cricket, baseball: Baseball, hockey: HockeyStick }

export function SportsPage() {
  return (
    <>
      <PageHeader eyebrow="Multi-sport" title="Sports" description="A sport becomes active only when its data sources and model validation gates are satisfied. Nothing below is shown as operational before then." />
      <PageState>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {SPORTS.map((s) => {
            const Icon = SPORT_ICON[s.id]
            const active = s.status === 'active'
            return (
              <Card key={s.id} as="article" className={cx('p-5', active && 'shadow-glow')}>
                <div className="flex items-start justify-between">
                  <div className={cx('flex size-12 items-center justify-center rounded-2xl', active ? 'bg-brand text-white' : 'bg-surface-3 text-fg-3')}>
                    <Icon className="size-6" />
                  </div>
                  <StatusBadge status={s.status} label={s.status === 'active' ? 'Active' : s.status === 'validating' ? 'In development' : 'Planned'} />
                </div>
                <h2 className="mt-4 text-[18px] font-bold">{s.name}</h2>
                <p className="mt-1 text-[13px] text-fg-3">{s.note}</p>
                <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                  <div className="card-inset py-2"><div className="num text-[20px] font-bold">{s.competitions}</div><div className="text-[10px] font-bold text-fg-3">COMPETITIONS</div></div>
                  <div className="card-inset py-2"><div className="num text-[20px] font-bold">{s.sources}</div><div className="text-[10px] font-bold text-fg-3">DATA SOURCES</div></div>
                </div>
                <div className="mt-4">
                  {active ? (
                    <Button variant="primary" className="w-full" onClick={() => navigate('/matches')}>Open football</Button>
                  ) : (
                    <Button variant="outline" className="w-full" disabled>
                      {s.status === 'validating' ? 'Predictions not yet published' : 'Not available yet'}
                    </Button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      </PageState>
    </>
  )
}

export function CompetitionsPage() {
  const { parts } = useRoute()
  if (parts[1]) return <CompetitionDetail id={parts[1]} />
  return (
    <>
      <PageHeader eyebrow="Football" title="Competitions & leagues" description="Coverage depends on what each free data source provides. Model status is shown per competition." />
      <PageState>
        <Card>
          <Table>
            <thead><tr><Th>Competition</Th><Th>Season</Th><Th>Coverage</Th><Th>Live</Th><Th align="right">OOS sample</Th><Th>Model</Th></tr></thead>
            <tbody>
              {COMPETITIONS.map((c) => (
                <tr key={c.id} className="cursor-pointer hover:bg-surface-2/60" onClick={() => navigate(`/competitions/${c.id}`)}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Flag code={c.flag} />
                      <div>
                        <div className="font-bold text-fg">{c.name}</div>
                        <div className="text-[11px] text-fg-3">{c.country} · {c.type === 'cup' ? 'Cup' : `Tier ${c.tier}`}</div>
                      </div>
                    </div>
                  </Td>
                  <Td>{c.season}<div className="text-[11px] text-fg-3">{c.round}</div></Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {c.coverage.fixtures && <Badge>Fixtures</Badge>}
                      {c.coverage.standings && <Badge>Tables</Badge>}
                      <Badge tone={c.coverage.stats === 'full' ? 'success' : c.coverage.stats === 'partial' ? 'warn' : 'neutral'}>Stats {c.coverage.stats}</Badge>
                      {c.coverage.odds === 'historical' && <Badge tone="info">Hist. odds</Badge>}
                    </div>
                  </Td>
                  <Td className="capitalize">{c.coverage.live}</Td>
                  <Td align="right" className="num text-[14px]">{c.oosSample.toLocaleString()}</Td>
                  <Td><StatusBadge status={c.modelStatus} />{c.modelNote && <div className="mt-1 max-w-[220px] text-[11px] text-fg-3">{c.modelNote}</div>}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        <NationalTeamsCard />
      </PageState>
    </>
  )
}

function NationalTeamsCard() {
  return (
    <Card className="mt-5">
      <CardHeader title="National teams" eyebrow="International · team images supplied by football-data.org" />
      <div className="grid grid-cols-2 gap-2 p-5 sm:grid-cols-3 lg:grid-cols-5">
        {NATIONAL_TEAMS.map((t) => (
          <Link key={t.id} to={`/team/${t.id}`} className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/60 px-3 py-2.5 text-[13px] font-semibold hover:border-line-strong hover:bg-surface-2">
            <Crest team={t} size={26} /> {t.name}
          </Link>
        ))}
      </div>
      <p className="px-5 pb-4 text-[11px] text-fg-3">The free data providers publish national flags, not federation crests, as national-team images. A licensed federation crest can be added per team with an admin override.</p>
    </Card>
  )
}

function CompetitionDetail({ id }: { id: string }) {
  const c = compById(id)
  if (id === 'wc')
    return (
      <>
        <PageHeader back={{ to: '/competitions', label: 'Competitions' }} eyebrow={<span className="inline-flex items-center gap-1.5"><Flag code={c.flag} /> {c.country}</span>} title={c.name} description={`${c.round} · sources: ${c.sources.join(', ')}`} actions={<StatusBadge status={c.modelStatus} label="No model" />} />
        <Notice tone="neutral" className="mb-5">{c.modelNote}. National teams are listed for browsing; AIDICT publishes no international predictions.</Notice>
        <NationalTeamsCard />
      </>
    )
  const [tab, setTab] = useState<'table' | 'fixtures'>('table')
  const table = standings(id)
  const fixtures = MATCHES.filter((m) => m.compId === id)
  return (
    <>
      <PageHeader back={{ to: '/competitions', label: 'Competitions' }} eyebrow={<span className="inline-flex items-center gap-1.5"><Flag code={c.flag} /> {c.country}</span>} title={c.name} description={`${c.season} · ${c.round} · sources: ${c.sources.join(', ')}`} actions={<StatusBadge status={c.modelStatus} label={`Model ${c.modelStatus}`} />} />
      <Tabs value={tab} onChange={setTab} items={[{ value: 'table', label: 'Standings' }, { value: 'fixtures', label: 'Fixtures' }]} className="mb-5" />
      <PageState>
        {tab === 'table' ? (
          <Card>
            {table.length < 4 && <div className="px-5 pt-4"><Notice tone="neutral">Prototype shows only teams that appear in the sample fixtures.</Notice></div>}
            <Table className="mt-2">
              <thead><tr><Th>#</Th><Th>Team</Th><Th align="right">P</Th><Th align="right">W</Th><Th align="right">D</Th><Th align="right">L</Th><Th align="right">GD</Th><Th align="right">Pts</Th><Th>Form</Th></tr></thead>
              <tbody>
                {table.map((r, i) => (
                  <tr key={r.team.id} className="hover:bg-surface-2/60">
                    <Td><span className={cx('num text-[14px] font-bold', i < 4 ? 'text-info' : 'text-fg-3')}>{i + 1}</span></Td>
                    <Td><Link to={`/team/${r.team.id}`} className="flex items-center gap-2.5 font-semibold text-fg hover:text-brand-fg"><Crest team={r.team} size={20} />{r.team.name}</Link></Td>
                    <Td align="right" className="num text-[14px]">{r.p}</Td>
                    <Td align="right" className="num text-[14px]">{r.w}</Td>
                    <Td align="right" className="num text-[14px]">{r.d}</Td>
                    <Td align="right" className="num text-[14px]">{r.l}</Td>
                    <Td align="right" className="num text-[14px]">{r.gf - r.ga > 0 ? '+' : ''}{r.gf - r.ga}</Td>
                    <Td align="right"><span className="num text-[16px] font-bold text-fg">{r.pts}</span></Td>
                    <Td><FormPills form={r.form} size="sm" /></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <p className="px-5 py-3 text-[11px] text-fg-3">Standings: football-data.org · cross-checked against results.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {fixtures.map((m) => (
              <MatchRow key={m.id} match={m} />
            ))}
          </div>
        )}
      </PageState>
    </>
  )
}

export function TeamPage() {
  const { parts } = useRoute()
  const team = ALL_TEAMS.find((t) => t.id === parts[1])
  if (!team) return <Card><EmptyState title="Team not found" /></Card>
  const comp = compById(team.compId)
  const s = teamSeasonStats(team)
  const elo = eloHistory(team)
  const form = teamForm(team)
  const fixtures = MATCHES.filter((m) => m.homeId === team.id || m.awayId === team.id)
  return (
    <>
      <PageHeader back={{ to: `/competitions/${comp.id}`, label: comp.name }} title={<span className="flex items-center gap-3"><Crest team={team} size={40} /> {team.name}</span>} description={<span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5" /> {team.venue}, {team.city}</span>} />
      <PageState>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-5">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                ['Elo rating', team.elo],
                ['Goals for / game', s.goalsFor.toFixed(2)],
                ['Goals against / game', s.goalsAgainst.toFixed(2)],
                ['Clean sheets', `${Math.round(s.cleanSheets * 100)}%`],
              ].map(([k, v]) => (
                <div key={k as string} className="card p-4"><div className="eyebrow">{k}</div><div className="num mt-1 text-[26px] font-bold">{v}</div></div>
              ))}
            </div>
            <Card>
              <CardHeader title="Elo rating over time" eyebrow="Updated after every result" />
              <div className="h-[260px] p-3">
                <ResponsiveContainer>
                  <AreaChart data={elo} margin={{ top: 10, right: 12, left: -6, bottom: 0 }}>
                    <defs>
                      <linearGradient id="eloFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--brand-fg)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="var(--brand-fg)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--grid)" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} interval={5} />
                    <YAxis domain={['dataMin - 15', 'dataMax + 15']} tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border-strong)', borderRadius: 12, fontSize: 12 }} />
                    <Area type="monotone" dataKey="elo" stroke="var(--brand-fg)" strokeWidth={2} fill="url(#eloFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4 sm:p-5">
              <h2 className="mb-3 text-[15px] font-bold">Fixtures</h2>
              {fixtures.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-line-strong px-4 py-8 text-center text-[13px] text-fg-3">No fixtures in the current 7-day window.</p>
              ) : (
                <div className="space-y-2">
                  {fixtures.map((m) => <MatchRow key={m.id} match={m} showComp />)}
                </div>
              )}
            </Card>
          </div>
          <div className="space-y-5">
            <Card className="p-5">
              <div className="eyebrow mb-3">Recent form</div>
              <FormPills form={form.map((f) => f.r)} />
              <ul className="mt-4 space-y-2 text-[13px]">
                {form.map((f, i) => (
                  <li key={i} className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2">
                    <span className="text-fg-3">{fmtDate(f.date)} · {f.home ? 'H' : 'A'}</span>
                    <span className="num text-[15px] font-bold">{f.score}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="p-5">
              <div className="eyebrow mb-3">Home vs away</div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="card-inset py-3"><div className="text-[11px] font-bold text-fg-3">HOME</div><div className="num mt-1 text-[18px] font-bold">{s.homeRecord.w}-{s.homeRecord.d}-{s.homeRecord.l}</div></div>
                <div className="card-inset py-3"><div className="text-[11px] font-bold text-fg-3">AWAY</div><div className="num mt-1 text-[18px] font-bold">{s.awayRecord.w}-{s.awayRecord.d}-{s.awayRecord.l}</div></div>
              </div>
            </Card>
            <BadgeSourceCard teamId={team.id} />
            <Card className="p-5">
              <div className="eyebrow mb-3 flex items-center gap-1.5"><Shirt className="size-3.5" /> Squad</div>
              {team.id === 'ars' ? (
                <ul className="space-y-1 text-[13px]">
                  {['Saka', 'Ødegaard', 'Rice', 'Havertz', 'Saliba'].map((p) => (
                    <li key={p}><Link to={`/player/${p.toLowerCase().replace('ø', 'o')}`} className="flex items-center justify-between rounded-lg px-2 py-1.5 font-semibold hover:bg-surface-2">{p} <span className="text-[11px] text-fg-3">limited data</span></Link></li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-fg-3">Squad lists require API-Football calls and are fetched only for featured teams to stay within the free daily quota.</p>
              )}
            </Card>
          </div>
        </div>
      </PageState>
    </>
  )
}

function BadgeSourceCard({ teamId }: { teamId: string }) {
  const b = badgeFor(teamId)
  return (
    <Card className="p-5">
      <div className="eyebrow mb-3">Badge source</div>
      {b ? (
        <dl className="space-y-1.5 text-[12.5px]">
          <div className="flex justify-between gap-3"><dt className="text-fg-3">Provider</dt><dd className="font-semibold">{b.source}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-fg-3">Type</dt><dd className="font-semibold">{b.kind === 'club-crest' ? 'Club crest' : 'National flag'} · {b.format.toUpperCase()}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-fg-3">Provider team ID</dt><dd className="font-mono font-semibold">{b.providerTeamId}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-fg-3">Verified</dt><dd className="font-semibold">{b.verifiedAt}</dd></div>
        </dl>
      ) : (
        <p className="text-[13px] text-fg-3">No authentic badge found — neutral placeholder shown.</p>
      )}
      <p className="mt-3 text-[11px] text-fg-3">Crests are trademarks of their owners, shown unmodified for identification only.</p>
    </Card>
  )
}

export function PlayerPage() {
  const { parts } = useRoute()
  const name = (parts[1] ?? 'saka').replace(/^\w/, (c) => c.toUpperCase())
  const team = teamById('ars')
  return (
    <>
      <PageHeader back={{ to: `/team/${team.id}`, label: team.name }} eyebrow="Player" title={name === 'Odegaard' ? 'Ødegaard' : name} description={<span className="inline-flex items-center gap-2"><Crest team={team} size={16} /> {team.name}</span>} />
      <Notice tone="warn" className="mb-5" title="Limited player data">
        Free sources provide goal scorers (OpenFootball, OpenLigaDB) and line-ups only for budgeted API-Football calls. Minutes, assists and per-90 metrics are not shown because they are not reliably available.
      </Notice>
      <PageState>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ['Appearances (line-ups seen)', '9', 'of 12 league matches with line-up data'],
            ['Goals', '5', 'OpenFootball goal records'],
            ['Starts', '9', 'from confirmed line-ups'],
          ].map(([k, v, h]) => (
            <Card key={k} className="p-5"><div className="eyebrow">{k}</div><div className="num mt-1 text-[32px] font-bold">{v}</div><div className="mt-1 text-[12px] text-fg-3">{h}</div></Card>
          ))}
        </div>
        <Card className="mt-5">
          <CardHeader title="Goal log" />
          <Table className="mt-2">
            <thead><tr><Th>Date</Th><Th>Match</Th><Th align="right">Minute</Th><Th>Source</Th></tr></thead>
            <tbody>
              {[['2026-11-21', 'Arsenal 2–0 Brentford', "37'"], ['2026-11-07', 'Everton 1–2 Arsenal', "71'"], ['2026-10-24', 'Arsenal 3–1 Fulham', "12'"], ['2026-10-24', 'Arsenal 3–1 Fulham', "88'"], ['2026-09-19', 'Arsenal 1–1 Man United', "54'"]].map((r, i) => (
                <tr key={i}><Td>{r[0]}</Td><Td className="font-semibold text-fg">{r[1]}</Td><Td align="right" className="num text-[14px]">{r[2]}</Td><Td>OpenFootball</Td></tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </PageState>
    </>
  )
}

export function SavedPage() {
  const saved = useApp((s) => s.saved)
  const [alerts, setAlerts] = useState<Record<string, boolean>>({})
  const list = MATCHES.filter((m) => saved.includes(m.id))
  return (
    <>
      <PageHeader eyebrow="Your list" title="Saved matches" description="Follow matches and get notified before kick-off and when the prediction is settled." />
      <PageState empty={<EmptyState icon={<Star className="size-6" />} title="No saved matches" body="Tap the star on any match to follow it here." action={<Button variant="primary" onClick={() => navigate('/matches')}>Browse matches</Button>} />}>
        {list.length === 0 ? (
          <Card><EmptyState icon={<Star className="size-6" />} title="No saved matches" body="Tap the star on any match to follow it here." action={<Button variant="primary" onClick={() => navigate('/matches')}>Browse matches</Button>} /></Card>
        ) : (
          <div className="space-y-3">
            {list.map((m) => (
              <Card key={m.id} className="p-3 sm:p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
                  <span className="text-[12px] font-bold text-fg-3">{compById(m.compId).name} · {fmtDay(m.kickoff)} {fmtDate(m.kickoff)} · {fmtTime(m.kickoff)} UTC</span>
                  <label className="flex items-center gap-2 text-[12px] font-semibold text-fg-2"><Bell className="size-3.5" /> Kick-off alert <Switch checked={alerts[m.id] ?? true} onChange={(v) => setAlerts({ ...alerts, [m.id]: v })} label="Kick-off alert" /></label>
                </div>
                <MatchRow match={m} />
              </Card>
            ))}
          </div>
        )}
      </PageState>
    </>
  )
}

export { CircleDot }
