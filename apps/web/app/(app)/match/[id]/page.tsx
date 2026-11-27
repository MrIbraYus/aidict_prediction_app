import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AlertTriangle, BookOpenCheck, Lock } from 'lucide-react'
import { getFixture, getHeadToHead, getMarketStatuses, getSavedIds, getTeamResults, marketDefinitions, viewer, viewerTimeZone } from '@/lib/data'
import { cx, fairOdds, fmtDate, fmtTime, horizonLabel, pct, relTime } from '@/lib/format'
import type { FixtureVM, OutcomeVM, PickVM, TeamVM } from '@/lib/types'
import { Badge, Card, CardHeader, EmptyState, LinkTabs, Notice, PageHeader, Progress, Table, Td, Th } from '@/components/ui/primitives'
import { ConfidenceBadge, MatchHero, ScoreMatrix, StatCompare, isDone } from '@/components/sports/match'
import { Crest, FormPills } from '@/components/sports/identity'
import { SaveButton } from '@/components/sports/save-button'

export const dynamic = 'force-dynamic'

type Detail = NonNullable<Awaited<ReturnType<typeof getFixture>>>

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const f = await getFixture(Number((await params).id)).catch(() => null)
  return { title: f ? `${f.home.short} v ${f.away.short}` : 'Match' }
}

const TABS = ['overview', 'markets', 'prediction', 'form', 'data'] as const
type Tab = (typeof TABS)[number]

export default async function MatchPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; all?: string }> }) {
  const id = Number((await params).id)
  if (!Number.isInteger(id) || id <= 0) notFound()
  const sp = await searchParams
  const tab: Tab = (TABS as readonly string[]).includes(sp.tab ?? '') ? (sp.tab as Tab) : 'overview'
  const [f, tz, saved, { admin }] = await Promise.all([getFixture(id), viewerTimeZone(), getSavedIds(), viewer()])
  if (!f) notFound()
  if (tab === 'data' && !admin) notFound()
  const count = new Set(f.outcomes.map((o) => o.market)).size
  return (
    <>
      <PageHeader back={{ to: '/matches', label: 'Matches' }} title={`${f.home.name} v ${f.away.name}`} eyebrow={`${f.competition.name} · ${f.season}`} actions={<SaveButton fixtureId={f.id} saved={saved.has(f.id)} variant="button" />} />
      <MatchHero f={f} tz={tz} />
      <LinkTabs
        className="mb-5 mt-5"
        value={tab}
        items={[
          { value: 'overview', label: 'Overview', href: `/match/${id}` },
          { value: 'markets', label: 'All markets', href: `/match/${id}?tab=markets`, badge: count ? <span className="num rounded-md bg-surface-3 px-1.5 text-[11px] font-bold text-fg-2">{count}</span> : undefined },
          { value: 'prediction', label: 'Scores', href: `/match/${id}?tab=prediction` },
          { value: 'form', label: 'Form & H2H', href: `/match/${id}?tab=form` },
          ...(admin ? [{ value: 'data', label: 'Data & model', href: `/match/${id}?tab=data` }] : []),
        ]}
      />
      {tab === 'overview' && <Overview f={f} tz={tz} admin={admin} />}
      {tab === 'markets' && <Markets f={f} showAll={sp.all === '1'} admin={admin} />}
      {tab === 'prediction' && <Prediction f={f} admin={admin} />}
      {tab === 'form' && <Form f={f} tz={tz} />}
      {tab === 'data' && <Data f={f} tz={tz} />}
    </>
  )
}

/* ───────────── Overview ───────────── */
async function Overview({ f, tz, admin }: { f: Detail; tz: string; admin: boolean }) {
  const picks = f.picks ?? []
  const s = f.snapshot
  const [homeRes, awayRes] = await Promise.all([getTeamResults(f.home.id, f.kickoff, 6), getTeamResults(f.away.id, f.kickoff, 6)])
  const key = (m: string, o: string) => f.outcomes.find((x) => x.market === m && x.outcome === o)
  const keyMarkets: [string, OutcomeVM | undefined][] = [
    ['Over 2.5 goals', key('ou', 'over2.5')],
    ['Both teams score', key('btts', 'yes')],
    [`${f.home.short} or draw`, key('dc', '1X')],
    [`${f.away.short} or draw`, key('dc', 'X2')],
  ]
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-5">
        <Card>
          <CardHeader title="Smart picks" eyebrow={s ? `${picks.length} of max 5` : 'Not published yet'} action={<Link href={`/match/${f.id}?tab=markets`} className="text-[12px] font-bold text-brand-fg">All markets →</Link>} />
          <div className="p-4 pt-3">
            {!s ? (
              <EmptyState title="No prediction yet" body={isDone(f) ? 'No snapshot was published for this match.' : 'A preview is published up to 7 days before kick-off, then refreshed the day before and 2 hours before.'} />
            ) : picks.length === 0 ? (
              <Notice tone="neutral" title="No pick for this match">
                {admin && s.selection?.shortfall ? s.selection.shortfall : 'No outcome was strong enough to publish as a pick. Probabilities for every market are under All markets.'}
              </Notice>
            ) : (
              <div className="space-y-2">
                {picks.map((p) => (
                  <PickRow key={p.id} p={p} admin={admin} />
                ))}
                {admin && s.selection?.shortfall && <p className="px-1 pt-1 text-[12px] text-fg-3">{s.selection.shortfall}</p>}
              </div>
            )}
            {admin && s?.selection?.exclusions?.length ? (
              <details className="mt-3 rounded-xl border border-line px-3.5 py-2.5 text-[12.5px]">
                <summary className="cursor-pointer font-bold text-fg-2">Why other strong outcomes were left out ({s.selection.exclusions.length})</summary>
                <ul className="mt-2 space-y-1.5 text-fg-3">
                  {s.selection.exclusions.slice(0, 12).map((e, i) => (
                    <li key={i}>
                      <b className="text-fg-2">{e.label}</b> · {pct(e.p)} — {e.reason}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        </Card>
        {s && (
          <Card>
            <CardHeader title="What the numbers say" eyebrow="Summary" action={<Link href={`/match/${f.id}?tab=prediction`} className="text-[12px] font-bold text-brand-fg">Scores →</Link>} />
            <div className="p-5 pt-3 text-[14px] leading-relaxed text-fg-2">
              Expected goals: <b className="text-fg">{s.lambdaHome.toFixed(2)}</b> for {f.home.short} and <b className="text-fg">{s.lambdaAway.toFixed(2)}</b> for {f.away.short}
              {s.x12 && (
                <>
                  , which gives {f.home.short} <b className="text-fg">{pct(s.x12.home)}</b>, draw <b className="text-fg">{pct(s.x12.draw)}</b> and {f.away.short} <b className="text-fg">{pct(s.x12.away)}</b>
                </>
              )}
              .
              {admin && (
                <span className="mt-2 block text-[12.5px] text-fg-3">
                  Owner view · goals model on {Number(s.inputs.train_matches ?? 0).toLocaleString()} matches, shots weight {String(s.inputs.shots_weight ?? '—')}
                  {Array.isArray(s.inputs.promoted) && (s.inputs.promoted as string[]).length > 0 && <>, promoted prior for {(s.inputs.promoted as string[]).length} team(s)</>}.
                </span>
              )}
            </div>
          </Card>
        )}
        <div className="grid gap-5 md:grid-cols-2">
          <TeamForm team={f.home} results={homeRes} tz={tz} />
          <TeamForm team={f.away} results={awayRes} tz={tz} />
        </div>
      </div>
      <div className="space-y-5">
        {s && (
          <Card className="p-5">
            <div className="eyebrow mb-3">Key markets</div>
            <div className="space-y-2">
              {keyMarkets.map(([k, o]) => (
                <div key={k} className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2.5 text-[13px] font-semibold">
                  <span className="text-fg-2">{k}</span>
                  <span className="flex items-center gap-2">
                    {o && o.status !== 'active' && <span className="text-[10px] font-bold uppercase text-fg-3">{o.status}</span>}
                    <span className="num text-[16px] font-bold">{o ? pct(o.p) : '—'}</span>
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-fg-3">Every market comes from the same prediction, so they never contradict each other.</p>
          </Card>
        )}
        {f.inventory.some((i) => i.data_type === 'conflict' && i.available) && (
          <Notice tone="danger" icon={<AlertTriangle className="size-4" />} title="Open data conflict">
            Two sources disagree about this match. An admin reviews it before results are settled.
          </Notice>
        )}
        {s && (
          <Notice tone="neutral" icon={<Lock className="size-4" />} title="Immutable snapshot">
            Published {fmtDate(s.snapshotAt, tz)} {fmtTime(s.snapshotAt, tz)} · {horizonLabel(s.horizon)}
            {admin && s.modelVersion ? ` · model ${s.modelVersion}` : ''}. Predictions are never edited after publication.
          </Notice>
        )}
      </div>
    </div>
  )
}

function PickRow({ p, admin }: { p: PickVM; admin: boolean }) {
  return (
    <details className="group rounded-2xl border border-line bg-surface-2/60 open:bg-surface-2">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-3.5 py-3">
        <span className="num flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-[13px] font-bold text-fg-2">{p.rank}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-bold text-fg">{p.label}</div>
          <div className="truncate text-[12px] text-fg-3">
            {p.marketName}
            {admin && <> · reliability {Math.round(p.reliability * 100)} · {p.lift >= 0 ? '+' : ''}{Math.round(p.lift * 100)} pts vs base</>}
          </div>
        </div>
        <div className="text-right">
          <div className="num text-[18px] font-bold text-fg">{pct(p.p)}</div>
          <ConfidenceBadge c={p.confidence} />
        </div>
      </summary>
      <div className="border-t border-line px-4 pb-4 pt-3 text-[12.5px] text-fg-2">
        <div className="mb-2 text-[12px] text-fg-3">
          {p.interval && <>Likely range {pct(p.interval[0])}–{pct(p.interval[1])} · </>}fair price {fairOdds(p.p)}
        </div>
        {p.reasons.length === 0 && <p className="text-fg-3">{p.marketName}: {pct(p.p)} chance.</p>}
        <ul className="list-disc space-y-1 pl-4">
          {p.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
        {p.result && (
          <div className="mt-3">
            Result: <Badge tone={p.result === 'won' ? 'success' : p.result === 'lost' ? 'danger' : 'neutral'}>{p.result}</Badge>
          </div>
        )}
      </div>
    </details>
  )
}

function TeamForm({ team, results, tz }: { team: TeamVM; results: FixtureVM[]; tz: string }) {
  const rows = results.filter((r) => r.score)
  const form = rows.map((r) => {
    const home = r.home.id === team.id
    const [gf, ga] = home ? r.score! : [r.score![1], r.score![0]]
    return { r, gf, ga, res: (gf > ga ? 'W' : gf < ga ? 'L' : 'D') as 'W' | 'D' | 'L', opp: home ? r.away : r.home, home }
  })
  const gf = form.reduce((a, x) => a + x.gf, 0) / (form.length || 1)
  const ga = form.reduce((a, x) => a + x.ga, 0) / (form.length || 1)
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <Crest team={team} size={30} />
        <div>
          <Link href={`/team/${team.id}`} className="text-[14px] font-bold hover:text-brand-fg">
            {team.name}
          </Link>
          <div className="text-[12px] text-fg-3">Last {form.length} results (newest first)</div>
        </div>
      </div>
      {form.length === 0 ? (
        <p className="mt-4 text-[12px] text-fg-3">No stored results yet.</p>
      ) : (
        <>
          <div className="mt-4">
            <FormPills form={form.map((x) => x.res)} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-center">
            {[
              ['Goals for / game', gf.toFixed(2)],
              ['Goals against / game', ga.toFixed(2)],
            ].map(([k, v]) => (
              <div key={k} className="card-inset py-2">
                <div className="num text-[18px] font-bold">{v}</div>
                <div className="text-[10px] font-bold text-fg-3">{k}</div>
              </div>
            ))}
          </div>
          <ul className="mt-3 space-y-1 text-[12px]">
            {form.map((x) => (
              <li key={x.r.id} className="flex items-center gap-2 text-fg-3">
                <span className="w-12">{fmtDate(x.r.kickoff, tz)}</span>
                <span className="w-4 text-center font-bold">{x.home ? 'H' : 'A'}</span>
                <Crest team={x.opp} size={14} />
                <Link href={`/match/${x.r.id}`} className="min-w-0 flex-1 truncate font-semibold text-fg-2 hover:text-fg">
                  {x.opp.short}
                </Link>
                <span className={cx('num text-[13px] font-bold', x.res === 'W' ? 'text-success' : x.res === 'L' ? 'text-danger' : 'text-fg-2')}>
                  {x.gf}–{x.ga}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  )
}

/* ───────────── All markets ───────────── */
async function Markets({ f, showAll, admin }: { f: Detail; showAll: boolean; admin: boolean }) {
  if (!f.snapshot) return <Card><EmptyState title="Markets are published with the prediction" body="Up to 7 days before kick-off, every supported market is computed from the same score matrix." /></Card>
  const [defs, statuses] = await Promise.all([marketDefinitions(), admin ? getMarketStatuses(f.competition.id) : Promise.resolve(new Map())])
  const pickRank = new Map((f.picks ?? []).map((p) => [`${p.market}|${p.outcome}`, p.rank]))
  const byMarket = new Map<string, OutcomeVM[]>()
  for (const o of f.outcomes) byMarket.set(o.market, [...(byMarket.get(o.market) ?? []), o])
  const CATS: [string, string][] = [
    ['other', 'Main markets'], ['double', 'Double chance'], ['goals', 'Goals'], ['combined', 'Combinations'], ['handicap', 'Handicaps'],
    ['first', 'First goal'], ['sequence', 'Goal sequences'], ['result', 'Lead paths (1UP / 2UP)'], ['corners', 'Corners'], ['player', 'Players'],
  ]
  const groups = new Map<string, [string, OutcomeVM[]][]>()
  for (const [m, os] of byMarket) {
    const cat = defs.get(m)?.category ?? 'other'
    const key = CATS.some(([c]) => c === cat) ? cat : 'other'
    const visible = showAll ? os : os.filter((o) => o.status === 'active')
    if (visible.length) groups.set(key, [...(groups.get(key) ?? []), [m, visible]])
  }
  const activeCount = f.outcomes.filter((o) => o.status === 'active').length
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-fg-3">
          {activeCount} of {f.outcomes.length} outcomes are available as picks for {f.competition.name}. The rest are shown for information only.
        </p>
        <div className="flex gap-1 rounded-xl border border-line bg-inset p-1 text-[12px] font-semibold">
          <Link href={`/match/${f.id}?tab=markets`} scroll={false} className={cx('rounded-[9px] px-3 py-1', !showAll ? 'bg-surface-3 text-fg' : 'text-fg-3')}>
            Active only
          </Link>
          <Link href={`/match/${f.id}?tab=markets&all=1`} scroll={false} className={cx('rounded-[9px] px-3 py-1', showAll ? 'bg-surface-3 text-fg' : 'text-fg-3')}>
            All outcomes
          </Link>
        </div>
      </div>
      {groups.size === 0 && (
        <Card>
          <EmptyState title="No markets available as picks here yet" body="Choose All outcomes to see every probability for this match." />
        </Card>
      )}
      {CATS.filter(([c]) => groups.has(c)).map(([c, label]) => (
        <Card key={c}>
          <CardHeader title={label} eyebrow={`${groups.get(c)!.length} markets`} />
          <div className="divide-y divide-line px-5 pb-2 pt-2">
            {groups.get(c)!.map(([m, os]) => (
              <div key={m} className="py-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-[13px] font-bold text-fg">{defs.get(m)?.name ?? m}</span>
                  {admin && statuses.get(m) && statuses.get(m)!.status !== 'active' && <Badge tone="warn">{statuses.get(m)!.status}</Badge>}
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {os.map((o) => {
                    const rank = pickRank.get(`${o.market}|${o.outcome}`)
                    return (
                      <div key={o.outcome} className={cx('rounded-xl border px-3 py-2.5', rank ? 'border-brand/40 bg-brand-soft' : 'border-line bg-surface-2/60')} title={admin ? (o.reason ?? undefined) : undefined}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-[12.5px] font-semibold text-fg-2">{o.label}</span>
                          <span className="num text-[16px] font-bold text-fg">{pct(o.p)}</span>
                        </div>
                        <Progress value={o.p} tone={o.status === 'active' ? 'brand' : 'neutral'} height={4} className="mt-1.5" />
                        <div className="mt-1.5 flex items-center justify-between text-[11px] text-fg-3">
                          <span>base {o.base != null ? pct(o.base) : '—'}</span>
                          {rank ? <span className="font-bold text-brand-fg">Pick #{rank}</span> : <span>{o.status === 'active' ? 'available' : admin ? o.status : 'info only'}</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  )
}

/* ───────────── Score model ───────────── */
function Prediction({ f, admin }: { f: Detail; admin: boolean }) {
  const s = f.snapshot
  if (!s) return <Card><EmptyState title="No prediction yet" body="The score model runs up to 7 days before kick-off." /></Card>
  const cells: { h: number; a: number; p: number }[] = []
  s.matrix.forEach((row, h) => row.forEach((p, a) => cells.push({ h, a, p })))
  const top = [...cells].sort((x, y) => y.p - x.p).slice(0, 8)
  const totals = Array.from({ length: 7 }, (_, n) => cells.filter((c) => (n < 6 ? c.h + c.a === n : c.h + c.a >= 6)).reduce((a, c) => a + c.p, 0))
  const peak = Math.max(...totals)
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card>
        <CardHeader title="Correct-score probabilities" eyebrow={`Expected goals ${s.lambdaHome.toFixed(2)} – ${s.lambdaAway.toFixed(2)}${admin ? ` · ρ ${Number(s.inputs.rho ?? 0).toFixed(3)}` : ''}`} />
        <div className="p-4">
          <ScoreMatrix matrix={s.matrix} />
        </div>
      </Card>
      <div className="space-y-5">
        <Card className="p-5">
          <div className="eyebrow mb-3">Most likely scores</div>
          <div className="space-y-1.5">
            {top.map((c) => (
              <div key={`${c.h}-${c.a}`} className="flex items-center gap-3 text-[13px]">
                <span className="num w-10 text-[15px] font-bold text-fg">
                  {c.h}–{c.a}
                </span>
                <Progress value={c.p / top[0].p} height={5} className="flex-1" />
                <span className="num w-12 text-right font-bold text-fg-2">{pct(c.p, 1)}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <div className="eyebrow mb-3">Total goals</div>
          <div className="flex h-28 items-end gap-2">
            {totals.map((p, n) => (
              <div key={n} className="flex flex-1 flex-col items-center gap-1">
                <span className="num text-[11px] font-bold text-fg-3">{Math.round(p * 100)}</span>
                <div className="w-full rounded-t-md bg-brand-fg/80" style={{ height: `${(p / peak) * 80}px` }} />
                <span className="num text-[12px] font-bold text-fg-2">{n < 6 ? n : '6+'}</span>
              </div>
            ))}
          </div>
        </Card>
        {s.x12 && (
          <Card className="p-5">
            <div className="eyebrow mb-3">Fair prices (1 ÷ probability)</div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {(
                [
                  ['1', s.x12.home],
                  ['X', s.x12.draw],
                  ['2', s.x12.away],
                ] as const
              ).map(([k, p]) => (
                <div key={k} className="card-inset py-2">
                  <div className="text-[10px] font-bold text-fg-3">{k}</div>
                  <div className="num text-[18px] font-bold">{fairOdds(p)}</div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-fg-3">Prices with no margin, worked out from the probabilities. They are not bookmaker odds and not a recommendation to bet.</p>
          </Card>
        )}
      </div>
    </div>
  )
}

/* ───────────── Form & H2H ───────────── */
async function Form({ f, tz }: { f: Detail; tz: string }) {
  const [h2h, homeRes, awayRes] = await Promise.all([getHeadToHead(f.home.id, f.away.id, 10), getTeamResults(f.home.id, f.kickoff, 10), getTeamResults(f.away.id, f.kickoff, 10)])
  const agg = (team: number, rows: FixtureVM[]) => {
    const r = rows.filter((x) => x.score)
    const n = r.length || 1
    let gf = 0, ga = 0, cs = 0, btts = 0, o25 = 0, pts = 0
    for (const x of r) {
      const [a, b] = x.home.id === team ? x.score! : [x.score![1], x.score![0]]
      gf += a; ga += b; cs += b === 0 ? 1 : 0; btts += a > 0 && b > 0 ? 1 : 0; o25 += a + b > 2 ? 1 : 0; pts += a > b ? 3 : a === b ? 1 : 0
    }
    return { n: r.length, gf: gf / n, ga: ga / n, cs: cs / n, btts: btts / n, o25: o25 / n, ppg: pts / n }
  }
  const H = agg(f.home.id, homeRes)
  const A = agg(f.away.id, awayRes)
  const wins = h2h.reduce(
    (a, x) => {
      if (!x.score) return a
      const [hg, ag] = x.home.id === f.home.id ? x.score : [x.score[1], x.score[0]]
      return hg > ag ? { ...a, h: a.h + 1 } : hg < ag ? { ...a, a: a.a + 1 } : { ...a, d: a.d + 1 }
    },
    { h: 0, d: 0, a: 0 },
  )
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Card className="p-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-2 text-[13px] font-bold">
            <Crest team={f.home} size={18} /> {f.home.short}
          </span>
          <span className="eyebrow">Last {Math.max(H.n, A.n)} matches</span>
          <span className="flex items-center gap-2 text-[13px] font-bold">
            {f.away.short} <Crest team={f.away} size={18} />
          </span>
        </div>
        <StatCompare label="Points per game" home={H.ppg} away={A.ppg} digits={2} />
        <StatCompare label="Goals scored / game" home={H.gf} away={A.gf} digits={2} />
        <StatCompare label="Goals conceded / game" home={H.ga} away={A.ga} digits={2} lowerIsBetter />
        <StatCompare label="Clean sheets %" home={H.cs * 100} away={A.cs * 100} />
        <StatCompare label="Both teams scored %" home={H.btts * 100} away={A.btts * 100} />
        <StatCompare label="Over 2.5 goals %" home={H.o25 * 100} away={A.o25 * 100} />
        <p className="mt-2 text-[11px] text-fg-3">From final results in all competitions. Recent form is shown for context.</p>
      </Card>
      <Card>
        <CardHeader title="Head-to-head" eyebrow={h2h.length ? `${f.home.short} ${wins.h} · draws ${wins.d} · ${f.away.short} ${wins.a}` : 'No previous meetings stored'} />
        <div className="space-y-1 p-3">
          {h2h.map((x) => (
            <Link key={x.id} href={`/match/${x.id}`} className="flex items-center gap-3 rounded-xl px-2.5 py-2 text-[13px] hover:bg-surface-2">
              <span className="w-20 text-[12px] text-fg-3">{fmtDate(x.kickoff, tz)} {new Date(x.kickoff).getUTCFullYear()}</span>
              <span className="flex min-w-0 flex-1 items-center justify-end gap-2 truncate font-semibold">
                {x.home.short} <Crest team={x.home} size={16} />
              </span>
              <span className="num w-12 text-center text-[15px] font-bold">{x.score ? `${x.score[0]}–${x.score[1]}` : '–'}</span>
              <span className="flex min-w-0 flex-1 items-center gap-2 truncate font-semibold">
                <Crest team={x.away} size={16} /> {x.away.short}
              </span>
            </Link>
          ))}
          {h2h.length === 0 && <p className="px-2 py-6 text-center text-[12px] text-fg-3">The stored history has no meetings between these teams.</p>}
        </div>
      </Card>
    </div>
  )
}

/* ───────────── Data & model ───────────── */
function Data({ f, tz }: { f: Detail; tz: string }) {
  const s = f.snapshot
  const label: Record<string, string> = { results: 'Fixture, result & history', corners: 'Corners', goal_times: 'Goal minutes (goal order)', lineups: 'Line-ups', player_stats: 'Player statistics', penalties: 'Penalties' }
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card>
        <CardHeader title="Data provenance" eyebrow="What this match's prediction could use" />
        {f.inventory.length === 0 ? (
          <EmptyState title="No inventory recorded" body="The sync job records which inputs exist for each fixture." />
        ) : (
          <Table className="mt-2">
            <thead>
              <tr>
                <Th>Input</Th>
                <Th>Source</Th>
                <Th>As of</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {f.inventory.map((r) => (
                <tr key={r.data_type}>
                  <Td className="font-semibold text-fg">
                    {label[r.data_type] ?? r.data_type}
                    {r.completeness != null && <div className="text-[11px] font-medium text-fg-3">completeness {pct(Number(r.completeness))}</div>}
                  </Td>
                  <Td>{r.source ?? '—'}</Td>
                  <Td>{r.as_of ? relTime(r.as_of) : '—'}</Td>
                  <Td>{r.available ? <Badge tone="success" dot>Available</Badge> : <Badge dot>Unavailable</Badge>}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <div className="space-y-5">
        {s && (
          <Card className="p-5">
            <div className="eyebrow mb-3 flex items-center gap-1.5">
              <Lock className="size-3.5" /> Snapshot
            </div>
            <dl className="space-y-1.5 text-[12px]">
              {[
                ['Published', `${fmtDate(s.snapshotAt, tz)} ${fmtTime(s.snapshotAt, tz)}`],
                ['Horizon', horizonLabel(s.horizon)],
                ['Model', s.modelVersion],
                ['Training matches', Number(s.inputs.train_matches ?? 0).toLocaleString()],
                ['Time decay ξ', String(s.inputs.xi ?? '—')],
                ['Input hash', s.inputHash.slice(0, 23) + '…'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-fg-3">{k}</dt>
                  <dd className="num truncate font-semibold text-fg-2">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
        )}
        <Card className="p-5">
          <div className="eyebrow mb-3 flex items-center gap-1.5">
            <BookOpenCheck className="size-3.5" /> Methodology
          </div>
          <ol className="space-y-3 text-[12.5px] text-fg-2">
            <li><b className="text-fg">1 · Goals model.</b> Dixon–Coles attack/defence ratings with time decay (ξ = 0.0019/day) and low-score correction.</li>
            <li><b className="text-fg">2 · Markets.</b> Every market is summed from one score matrix; goal-order markets enumerate every scoring sequence.</li>
            <li><b className="text-fg">3 · Calibration.</b> Platt scaling fitted out-of-fold on walk-forward predictions only.</li>
            <li><b className="text-fg">4 · Gates.</b> An outcome publishes only with ≥ 1,000 out-of-sample predictions, a significant log-loss edge over the base rate, calibration error ≤ 0.03–0.04, and two consecutive passes.</li>
            <li><b className="text-fg">5 · Record.</b> Snapshots are append-only and settled against official results.</li>
          </ol>
        </Card>
      </div>
    </div>
  )
}
