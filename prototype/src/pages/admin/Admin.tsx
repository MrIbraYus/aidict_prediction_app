import { useState } from 'react'
import { Activity, AlertTriangle, CheckCircle2, Cpu, Database, Flag as FlagIcon, GitBranch, HardDrive, KeyRound, Play, PlugZap, RotateCcw, ScrollText, ShieldCheck, Trophy } from 'lucide-react'
import { navigate, useRoute } from '../../lib/router'
import { useApp } from '../../lib/store'
import { cx, relTime } from '../../lib/format'
import { NOW, MARKETS } from '../../mock/matches'
import { CONFLICTS, FEATURE_FLAGS, LOGS, MODEL_VERSIONS, PROVIDERS, SYNC_JOBS } from '../../mock/system'
import { ALL_TEAMS, COMPETITIONS, SPORTS, compById } from '../../mock/teams'
import { BADGES, BADGE_RESOLUTION_ORDER } from '../../mock/badges'
import { DATA_REQS, MARKET_DEFS, statusForCompetition, supportLevel } from '../../lib/markets'
import { Crest } from '../../components/sports/identity'
import { PageHeader } from '../../components/layout/shell'
import { Badge, Button, Card, CardHeader, Kpi, Notice, Progress, Segmented, StatusBadge, Switch, Table, Tabs, Td, Th } from '../../components/ui/primitives'
import { PageState } from '../../components/ui/overlay'
import { Flag } from '../../components/sports/identity'

type Section = 'overview' | 'providers' | 'sync' | 'competitions' | 'badges' | 'markets' | 'models' | 'quality' | 'flags' | 'logs'

export default function Admin() {
  const { parts } = useRoute()
  const section = (parts[1] as Section) ?? 'overview'
  return (
    <>
      <PageHeader
        eyebrow={<span className="inline-flex items-center gap-1.5 text-brand-fg"><ShieldCheck className="size-3.5" /> Admin · role verified server-side</span>}
        title="Administration"
        description="Manage data providers, synchronisation, competitions, prediction models and system health. Every action is written to the audit log."
      />
      <Tabs<Section>
        className="mb-5"
        value={section}
        onChange={(s) => navigate(s === 'overview' ? '/admin' : `/admin/${s}`)}
        items={[
          { value: 'overview', label: 'System health' },
          { value: 'providers', label: 'Providers' },
          { value: 'sync', label: 'Sync jobs' },
          { value: 'competitions', label: 'Sports & competitions' },
          { value: 'badges', label: 'Team badges' },
          { value: 'markets', label: 'Markets' },
          { value: 'models', label: 'Models' },
          { value: 'quality', label: 'Data quality', badge: <span className="num rounded-md bg-danger-soft px-1.5 text-[11px] font-bold text-danger">1</span> },
          { value: 'flags', label: 'Feature flags' },
          { value: 'logs', label: 'Logs' },
        ]}
      />
      <PageState>
        <div className="animate-fade-up" key={section}>
          {section === 'overview' && <Overview />}
          {section === 'providers' && <Providers />}
          {section === 'sync' && <Sync />}
          {section === 'competitions' && <Competitions />}
          {section === 'badges' && <Badges />}
          {section === 'markets' && <MarketsAdmin />}
          {section === 'models' && <Models />}
          {section === 'quality' && <Quality />}
          {section === 'flags' && <Flags />}
          {section === 'logs' && <Logs />}
        </div>
      </PageState>
    </>
  )
}

function Overview() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Database" value="212 MB" sub="of 500 MB free tier" />
        <Kpi label="Actions minutes" value="1,041" sub="of ~2,000 / month" />
        <Kpi label="Vercel invocations" value="38.2k" sub="of 1M / month" />
        <Kpi label="Open conflicts" value="1" sub="blocks 1 fixture" />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <div className="eyebrow mb-4">Free-tier usage</div>
          {[
            { icon: HardDrive, label: 'Supabase database', v: 212 / 500, t: '212 / 500 MB' },
            { icon: Database, label: 'Supabase egress', v: 0.9 / 5, t: '0.9 / 5 GB' },
            { icon: Cpu, label: 'GitHub Actions compute', v: 1041 / 2000, t: '$6.25 / $12' },
            { icon: Activity, label: 'Vercel active CPU', v: 0.6 / 4, t: '0.6 / 4 h' },
            { icon: PlugZap, label: 'API-Football today', v: 63 / 100, t: '63 / 100 calls' },
          ].map((r) => (
            <div key={r.label} className="mb-4 last:mb-0">
              <div className="mb-1.5 flex items-center justify-between text-[13px]"><span className="flex items-center gap-2 font-semibold"><r.icon className="size-4 text-fg-3" />{r.label}</span><span className="num text-[14px] font-bold">{r.t}</span></div>
              <Progress value={r.v} tone={r.v > 0.8 ? 'danger' : r.v > 0.6 ? 'warn' : 'live'} />
            </div>
          ))}
        </Card>
        <Card className="p-5">
          <div className="eyebrow mb-4">Health checks</div>
          <ul className="space-y-2">
            {[
              ['Supabase reachable', 'ok', '38 ms'],
              ['Supabase inactivity pause', 'ok', 'Last write 48 min ago'],
              ['Scheduled sync on time', 'ok', 'sync_current 15:17 UTC'],
              ['Predictions for next matchday', 'ok', '46 / 46 fixtures'],
              ['OpenLigaDB latency', 'warn', 'p95 1,840 ms'],
              ['OpenFootball upstream freshness', 'warn', 'Stalled since 22 Sep'],
              ['Weekly database backup', 'ok', 'pg_dump 23 Nov · 41 MB'],
            ].map(([k, s, d]) => (
              <li key={k} className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2.5 text-[13px]">
                <span className="flex items-center gap-2 font-semibold">{s === 'ok' ? <CheckCircle2 className="size-4 text-success" /> : <AlertTriangle className="size-4 text-warn" />}{k}</span>
                <span className="text-[12px] text-fg-3">{d}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}

function Providers() {
  const toast = useApp((s) => s.toast)
  const [enabled, setEnabled] = useState<Record<string, boolean>>(Object.fromEntries(PROVIDERS.map((p) => [p.id, true])))
  const [testing, setTesting] = useState<string | null>(null)
  return (
    <Card>
      <Table>
        <thead><tr><Th>Provider</Th><Th>API key</Th><Th>Quota</Th><Th>Latency</Th><Th>Status</Th><Th>Enabled</Th><Th /></tr></thead>
        <tbody>
          {PROVIDERS.map((p) => (
            <tr key={p.id}>
              <Td className="font-bold text-fg">{p.name}<div className="text-[11px] font-medium text-fg-3">{p.role}</div></Td>
              <Td><span className="inline-flex items-center gap-1.5 font-mono text-[12px]"><KeyRound className="size-3.5 text-fg-3" />{p.key}</span></Td>
              <Td className="num text-[14px]">{p.quota ? `${p.quota.used}/${p.quota.limit} ${p.quota.unit.replace('per ', '/')}` : '—'}</Td>
              <Td className="num text-[14px]">{p.latency ? `${p.latency} ms` : '—'}</Td>
              <Td><StatusBadge status={p.status} /></Td>
              <Td><Switch checked={enabled[p.id]} onChange={(v) => { setEnabled({ ...enabled, [p.id]: v }); toast({ tone: 'info', title: `${p.name} ${v ? 'enabled' : 'disabled'}`, body: 'Recorded in audit log.' }) }} label={`Enable ${p.name}`} /></Td>
              <Td>
                <Button size="sm" variant="outline" loading={testing === p.id} onClick={() => { setTesting(p.id); setTimeout(() => { setTesting(null); toast({ tone: p.status === 'degraded' ? 'error' : 'success', title: p.status === 'degraded' ? 'Slow response (1,840 ms)' : 'Connection OK', body: `${p.name} responded.` }) }, 900) }}>Test</Button>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <p className="px-5 py-3 text-[11px] text-fg-3">Keys are stored as server-side environment variables (Vercel / GitHub Secrets) and never sent to the browser. Only the last 4 characters are displayed.</p>
    </Card>
  )
}

function Sync() {
  const toast = useApp((s) => s.toast)
  const [running, setRunning] = useState<string | null>(null)
  return (
    <Card>
      <Table>
        <thead><tr><Th>Job</Th><Th>Runner</Th><Th>Schedule</Th><Th>Last run</Th><Th>Rows</Th><Th>Status</Th><Th /></tr></thead>
        <tbody>
          {SYNC_JOBS.map((j) => (
            <tr key={j.job}>
              <Td className="font-mono text-[12.5px] font-semibold text-fg">{j.job}</Td>
              <Td>{j.runner}</Td>
              <Td className="font-mono text-[12px]">{j.cron}</Td>
              <Td>{relTime(j.last, NOW)}<div className="text-[11px] text-fg-3">{j.duration}</div></Td>
              <Td className="num text-[14px]">{j.rows}</Td>
              <Td><StatusBadge status={j.status} /></Td>
              <Td>
                <Button size="sm" variant="outline" loading={running === j.job} disabled={j.runner.startsWith('Next')} onClick={() => { setRunning(j.job); setTimeout(() => { setRunning(null); toast({ tone: 'success', title: `${j.job} dispatched`, body: 'GitHub Actions workflow_dispatch queued.' }) }, 1000) }}>
                  <Play className="size-3.5" /> Run now
                </Button>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  )
}

function Competitions() {
  const toast = useApp((s) => s.toast)
  const [active, setActive] = useState<Record<string, boolean>>(Object.fromEntries(COMPETITIONS.map((c) => [c.id, c.modelStatus !== 'disabled'])))
  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="eyebrow mb-4 flex items-center gap-1.5"><Trophy className="size-3.5" /> Sport activation gates</div>
        <div className="grid gap-3 md:grid-cols-3">
          {SPORTS.map((s) => (
            <div key={s.id} className="card-inset p-4">
              <div className="flex items-center justify-between"><span className="font-bold">{s.name}</span><StatusBadge status={s.status} /></div>
              <ul className="mt-3 space-y-1.5 text-[12px]">
                {[['Historical data source', s.status !== 'planned'], ['Validated model', s.status === 'active'], ['Calibration gate', s.status === 'active']].map(([k, ok]) => (
                  <li key={k as string} className="flex items-center gap-2 text-fg-2">{ok ? <CheckCircle2 className="size-3.5 text-success" /> : <span className="size-3.5 rounded-full border border-line-strong" />}{k as string}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <Table>
          <thead><tr><Th>Competition</Th><Th>Sources</Th><Th>Model</Th><Th>Sync</Th></tr></thead>
          <tbody>
            {COMPETITIONS.map((c) => (
              <tr key={c.id}>
                <Td className="font-semibold text-fg"><span className="flex items-center gap-2"><Flag code={c.flag} />{c.name} <span className="font-mono text-[11px] text-fg-3">{c.code}</span></span></Td>
                <Td className="text-[12px]">{c.sources.join(' · ')}</Td>
                <Td><StatusBadge status={c.modelStatus} /></Td>
                <Td><Switch checked={active[c.id]} onChange={(v) => { setActive({ ...active, [c.id]: v }); toast({ tone: 'info', title: `${c.name} sync ${v ? 'enabled' : 'paused'}` }) }} label={`Sync ${c.name}`} /></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  )
}

function Badges() {
  const toast = useApp((s) => s.toast)
  const [checking, setChecking] = useState(false)
  const list = Object.values(BADGES)
  const crests = list.filter((b) => b.kind === 'club-crest')
  const flags = list.filter((b) => b.kind === 'national-flag')
  const missing = ALL_TEAMS.filter((t) => !BADGES[t.id])
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Coverage" value={`${list.length}/${ALL_TEAMS.length}`} sub={missing.length ? `${missing.length} on fallback` : 'no fallbacks in use'} />
        <Kpi label="Club crests" value={crests.length} sub={`${crests.filter((b) => b.format === 'svg').length} SVG · ${crests.filter((b) => b.format === 'png').length} PNG`} />
        <Kpi label="National teams" value={flags.length} sub="provider supplies flags" />
        <Kpi label="Contrast-adjusted" value={list.filter((b) => b.contrast).length} sub="thin outline on dark theme" />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader
            title="Badge registry"
            eyebrow="team_badges · source and URL stored per team"
            action={
              <Button
                size="sm"
                variant="outline"
                loading={checking}
                onClick={() => {
                  setChecking(true)
                  setTimeout(() => {
                    setChecking(false)
                    toast({ tone: 'success', title: `${list.length} badges re-checked`, body: 'All URLs returned 200 with an image content type.' })
                  }, 1100)
                }}
              >
                <RotateCcw className="size-3.5" /> Re-check all
              </Button>
            }
          />
          <Table className="mt-2">
            <thead>
              <tr><Th>Team</Th><Th>Type</Th><Th>Source</Th><Th>Provider ID</Th><Th>Verified</Th><Th /></tr>
            </thead>
            <tbody>
              {list.map((b) => {
                const t = ALL_TEAMS.find((x) => x.id === b.teamId)!
                return (
                  <tr key={b.teamId}>
                    <Td className="font-semibold text-fg">
                      <span className="flex items-center gap-2.5">
                        <Crest team={t} size={24} />
                        {t.name}
                        <span className="text-[11px] font-medium text-fg-3">{t.compId === 'wc' ? 'National' : compById(t.compId).code}</span>
                      </span>
                    </Td>
                    <Td>
                      <span className="text-[12px]">{b.kind === 'club-crest' ? 'Crest' : 'Flag'} · {b.format.toUpperCase()}</span>
                      {b.contrast && <Badge tone="info" className="ml-1.5">outline</Badge>}
                    </Td>
                    <Td className="text-[12px]">{b.source}</Td>
                    <Td className="font-mono text-[12px]">{b.providerTeamId}</Td>
                    <Td className="text-[12px]">{b.verifiedAt}</Td>
                    <Td>
                      <Button size="sm" variant="ghost" onClick={() => toast({ tone: 'info', title: 'Override URL', body: `Paste a licensed image URL for ${t.name}. The previous source is kept in history.` })}>
                        Override
                      </Button>
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        </Card>
        <div className="space-y-5">
          <Card className="p-5">
            <div className="eyebrow mb-3">Automatic resolution on import</div>
            <ol className="space-y-3">
              {BADGE_RESOLUTION_ORDER.map((r, i) => (
                <li key={r.source} className="flex gap-3 text-[12.5px]">
                  <span className="num flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[12px] font-bold">{i + 1}</span>
                  <span>
                    <b className="text-fg">{r.source}</b> <span className="font-mono text-[11px] text-fg-3">{r.field}</span>
                    <span className="block text-fg-3">{r.note}</span>
                  </span>
                </li>
              ))}
              <li className="flex gap-3 text-[12.5px]">
                <span className="num flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[12px] font-bold">5</span>
                <span>
                  <b className="text-fg">Neutral fallback</b>
                  <span className="block text-fg-3">Plain shield, no initials. Flagged for review in this list.</span>
                </span>
              </li>
            </ol>
          </Card>
          <Notice tone="neutral" title="Validation before use">
            Each image must return HTTP 200 with an image content type. PNGs must be at least 128 px. SVGs are sanitised (scripts and external references removed). Files are mirrored to Supabase Storage so the app keeps working if a provider is down.
          </Notice>
          <Notice tone="warn" title="Trademarks">
            Crests belong to their clubs and federations. They are shown unmodified, for identification only, in a personal app. A public or commercial release needs a licensing review.
          </Notice>
        </div>
      </div>
    </div>
  )
}

function MarketsAdmin() {
  const toast = useApp((s) => s.toast)
  const groups = ['pl', 'bl1', 'sa', 'cl']
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Markets defined" value={MARKET_DEFS.length} sub="extensible registry" />
        <Kpi label="Published (gate passed)" value={MARKET_DEFS.filter((d) => d.gate === 'active').length} sub="where data exists" />
        <Kpi label="Validating" value={MARKET_DEFS.filter((d) => d.gate === 'validating').length} sub="calibration, sample or rules" />
        <Kpi label="Need more data" value={MARKET_DEFS.filter((d) => supportLevel(d).level === 'needs-data').length} sub="player markets" />
      </div>
      <Card>
        <CardHeader title="Market registry & coverage" eyebrow="market_definitions · market_competition_status" />
        <Table className="mt-2">
          <thead>
            <tr>
              <Th>Market</Th>
              <Th>Required data</Th>
              {groups.map((g) => (
                <Th key={g} align="center">{compById(g).code}</Th>
              ))}
              <Th />
            </tr>
          </thead>
          <tbody>
            {MARKET_DEFS.map((d) => (
              <tr key={d.id}>
                <Td className="font-semibold text-fg">
                  {d.name}
                  <div className="font-mono text-[10.5px] font-medium text-fg-3">{d.id}</div>
                </Td>
                <Td>
                  <div className="flex max-w-[260px] flex-wrap gap-1">
                    {d.requires.map((r) => (
                      <span key={r} className={cx('rounded-md px-1.5 py-0.5 text-[10.5px] font-bold', DATA_REQS[r].free === 'yes' ? 'bg-success-soft text-success' : DATA_REQS[r].free === 'partial' ? 'bg-warn-soft text-warn' : 'bg-danger-soft text-danger')}>{DATA_REQS[r].label}</span>
                    ))}
                  </div>
                </Td>
                {groups.map((g) => {
                  const st = statusForCompetition(d, g)
                  const dot = st.status === 'active' ? 'bg-live' : st.status === 'validating' ? 'bg-warn' : st.status === 'disabled' ? 'bg-danger' : 'bg-fg-3/40'
                  return (
                    <Td key={g} align="center">
                      <span title={`${st.status}${st.reason ? ' — ' + st.reason : ''}`} className={cx('inline-block size-2.5 rounded-full', dot)} />
                    </Td>
                  )
                })}
                <Td>
                  {d.requires.includes('settlement') ? (
                    <Button size="sm" variant="outline" onClick={() => toast({ tone: 'info', title: 'Settlement rules editor', body: `Paste your bookmaker's rules for ${d.name}; publishing stays blocked until they are confirmed.` })}>
                      Verify rules
                    </Button>
                  ) : (
                    <span className="text-[11px] text-fg-3">{d.backtest.n ? `n ${d.backtest.n.toLocaleString()}` : 'no backtest'}</span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <div className="flex flex-wrap gap-4 px-5 py-3 text-[11px] text-fg-3">
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-live" /> Published</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-warn" /> Validating</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-fg-3/40" /> Data unavailable</span>
        </div>
      </Card>
      <Notice tone="neutral" title="Adding a market">
        A new market is a module under <span className="font-mono">ml/football/markets/</span> implementing requirements(), outcomes(), probabilities(), settle() and backtest(). It registers a row in market_definitions and starts as “validating” until it passes its own walk-forward gate. The prediction engine itself does not change.
      </Notice>
    </div>
  )
}

function Models() {
  const toast = useApp((s) => s.toast)
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Model versions" eyebrow="Football" icon={<GitBranch className="size-4 text-fg-3" />} />
        <Table className="mt-2">
          <thead><tr><Th>Version</Th><Th>Family</Th><Th>Trained</Th><Th align="right">Brier</Th><Th align="right">Log loss</Th><Th align="right">ECE</Th><Th>Status</Th><Th /></tr></thead>
          <tbody>
            {MODEL_VERSIONS.map((m) => (
              <tr key={m.version}>
                <Td className="font-mono text-[12.5px] font-semibold text-fg">{m.version}</Td>
                <Td>{m.family}</Td>
                <Td>{m.trained}<div className="text-[11px] text-fg-3">{m.window}</div></Td>
                <Td align="right" className="num text-[14px]">{m.brier.toFixed(3)}</Td>
                <Td align="right" className="num text-[14px]">{m.logLoss.toFixed(3)}</Td>
                <Td align="right" className={cx('num text-[14px]', m.ece > 0.03 && 'text-danger')}>{m.ece.toFixed(3)}</Td>
                <Td><StatusBadge status={m.status} /></Td>
                <Td>
                  {m.status === 'candidate' && <Button size="sm" variant="outline" disabled={m.ece > 0.03} title={m.ece > 0.03 ? 'Fails calibration gate' : undefined} onClick={() => toast({ tone: 'success', title: 'Promotion requested' })}>Promote</Button>}
                  {m.status === 'retired' && <Button size="sm" variant="ghost" onClick={() => toast({ tone: 'info', title: 'Rollback prepared', body: 'Requires confirmation.' })}><RotateCcw className="size-3.5" /> Rollback</Button>}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      <Card>
        <CardHeader title="Market gates" eyebrow="n ≥ 300 out-of-sample · beats base rate · ECE threshold" />
        <Table className="mt-2">
          <thead><tr><Th>Market</Th><Th>Status</Th><Th>Reason</Th></tr></thead>
          <tbody>
            {MARKETS.map((m) => (
              <tr key={m.key}><Td className="font-semibold text-fg">{m.name}</Td><Td><StatusBadge status={m.status} /></Td><Td className="text-[12px]">{m.reason ?? 'All gates passed'}</Td></tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  )
}

function Quality() {
  const toast = useApp((s) => s.toast)
  return (
    <div className="space-y-4">
      <Notice tone="info" title="Conflict policy">The higher-reliability source wins only if it is final and fresher. Fixtures with open conflicts are excluded from training and skipped for prediction.</Notice>
      {CONFLICTS.map((c) => (
        <Card key={c.id} className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="font-mono text-[11px] text-fg-3">{c.id} · {c.age} ago</div>
              <div className="text-[15px] font-bold">{c.fixture}</div>
              <div className="text-[13px] text-fg-3">{c.field}</div>
            </div>
            <StatusBadge status={c.status} />
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {c.values.map((v) => (
              <div key={v.source} className="card-inset flex items-center justify-between p-3">
                <div><div className="text-[12px] font-bold text-fg-3">{v.source}</div><div className="num text-[20px] font-bold">{v.value}</div></div>
                <Badge>reliability {v.reliability}</Badge>
              </div>
            ))}
          </div>
          {c.status === 'open' ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {c.values.map((v) => (
                <Button key={v.source} size="sm" variant="outline" onClick={() => toast({ tone: 'success', title: `Resolved with ${v.source}`, body: 'Fixture re-enters training at next run. Audit logged.' })}>Accept {v.source}</Button>
              ))}
              <Button size="sm" variant="ghost">Ignore</Button>
            </div>
          ) : (
            <p className="mt-3 text-[12px] text-fg-3">Resolution: {c.resolution}</p>
          )}
        </Card>
      ))}
    </div>
  )
}

function Flags() {
  const toast = useApp((s) => s.toast)
  const [flags, setFlags] = useState(FEATURE_FLAGS)
  return (
    <Card>
      <ul className="divide-y divide-line">
        {flags.map((f, i) => (
          <li key={f.key} className="flex items-center justify-between gap-4 px-5 py-4">
            <div>
              <div className="flex items-center gap-2 font-mono text-[13px] font-semibold"><FlagIcon className="size-3.5 text-fg-3" />{f.key}</div>
              <div className="text-[12px] text-fg-3">{f.description}</div>
            </div>
            <Switch checked={f.enabled} onChange={(v) => { setFlags(flags.map((x, j) => (j === i ? { ...x, enabled: v } : x))); toast({ tone: 'info', title: `${f.key} ${v ? 'enabled' : 'disabled'}` }) }} label={f.key} />
          </li>
        ))}
      </ul>
    </Card>
  )
}

function Logs() {
  const [level, setLevel] = useState<'all' | 'error' | 'warn' | 'audit'>('all')
  const rows = LOGS.filter((l) => level === 'all' || l.level === level)
  return (
    <Card>
      <div className="flex items-center justify-between px-5 pt-5">
        <div className="eyebrow flex items-center gap-1.5"><ScrollText className="size-3.5" /> Error & audit log</div>
        <Segmented size="sm" value={level} onChange={setLevel} items={[{ value: 'all', label: 'All' }, { value: 'error', label: 'Errors' }, { value: 'warn', label: 'Warnings' }, { value: 'audit', label: 'Audit' }]} />
      </div>
      <ul className="mt-3 divide-y divide-line font-mono text-[12px]">
        {rows.map((l, i) => (
          <li key={i} className="flex flex-wrap items-start gap-x-4 gap-y-1 px-5 py-3">
            <span className="text-fg-3">{l.at.replace('T', ' ').slice(0, 19)}</span>
            <span className={cx('w-12 font-bold uppercase', l.level === 'error' ? 'text-danger' : l.level === 'warn' ? 'text-warn' : l.level === 'audit' ? 'text-info' : 'text-fg-3')}>{l.level}</span>
            <span className="w-32 text-fg-2">{l.source}</span>
            <span className="min-w-0 flex-1 break-words font-sans text-[12.5px] text-fg">{l.message}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}
