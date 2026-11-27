import { useState } from 'react'
import { AlertTriangle, BookOpenCheck, Fingerprint, Info, Lock, Share2, ShieldAlert, Star, Users } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { navigate, useRoute, Link } from '../../lib/router'
import { useApp } from '../../lib/store'
import { cx, fairOdds, fmtDate, fmtTime, relTime, useOdds, useProb } from '../../lib/format'
import { LINEUPS, MARKETS, NOW, eloHistory, getPrediction, headToHead, matchById, teamForm, teamSeasonStats, type MarketKey, type Match, type Prediction } from '../../mock/matches'
import { compById, teamById } from '../../mock/teams'
import { PageHeader } from '../../components/layout/shell'
import { Badge, Button, Card, CardHeader, EmptyState, Notice, Progress, Ring, StatusBadge, Table, Tabs, Td, Th } from '../../components/ui/primitives'
import { PageState } from '../../components/ui/overlay'
import { MarketStatusDot, MatchHero, MultiAddButton, ScoreMatrix, StatCompare } from '../../components/sports/match'
import { ExplainSheet, MarketPicksCard, type ExplainTarget } from '../../components/markets'
import MarketsTab from './MarketsTab'
import { Crest, FormPills } from '../../components/sports/identity'

type Tab = 'overview' | 'prediction' | 'markets' | 'stats' | 'h2h' | 'lineups' | 'data'

export default function MatchPage() {
  const { parts } = useRoute()
  const match = matchById(parts[1])
  const tab = (parts[2] as Tab) ?? 'overview'
  const saved = useApp((s) => (match ? s.saved.includes(match.id) : false))
  const toggleSaved = useApp((s) => s.toggleSaved)
  const toast = useApp((s) => s.toast)
  if (!match)
    return (
      <Card>
        <EmptyState title="Match not found" body="It may have been removed by the provider or merged into another fixture." action={<Button onClick={() => navigate('/matches')}>Back to matches</Button>} />
      </Card>
    )
  const home = teamById(match.homeId)
  const away = teamById(match.awayId)
  const comp = compById(match.compId)
  return (
    <>
      <PageHeader
        back={{ to: '/matches', label: 'Matches' }}
        eyebrow={`${comp.name} · ${comp.season} · ${comp.round}`}
        title={`${home.name} vs ${away.name}`}
        actions={
          <>
            <MultiAddButton match={match} />
            <Button size="sm" variant={saved ? 'secondary' : 'outline'} onClick={() => toggleSaved(match.id)} aria-pressed={saved}>
              <Star className={cx('size-4', saved && 'fill-gold text-gold')} /> {saved ? 'Saved' : 'Save'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => toast({ tone: 'success', title: 'Link copied', body: 'Private link — requires sign-in.' })} aria-label="Share">
              <Share2 className="size-4" />
            </Button>
          </>
        }
      />
      <PageState>
        <MatchHero match={match} />
        <Tabs<Tab>
          className="mt-5"
          value={tab}
          onChange={(t) => navigate(`/match/${match.id}${t === 'overview' ? '' : '/' + t}`)}
          items={[
            { value: 'overview', label: 'Overview' },
            { value: 'prediction', label: 'Prediction' },
            { value: 'markets', label: 'All markets', badge: <span className="num rounded-md bg-surface-3 px-1.5 text-[11px] font-bold text-fg-2">24</span> },
            { value: 'stats', label: 'Statistics' },
            { value: 'h2h', label: 'Head-to-head' },
            { value: 'lineups', label: 'Line-ups', badge: match.lineups ? <span className="size-1.5 rounded-full bg-live" /> : undefined },
            { value: 'data', label: 'Data & model' },
          ]}
        />
        <div className="mt-5 animate-fade-up" key={tab}>
          {tab === 'overview' && <Overview match={match} />}
          {tab === 'prediction' && <PredictionTab match={match} />}
          {tab === 'markets' && <MarketsTab match={match} />}
          {tab === 'stats' && <StatsTab match={match} />}
          {tab === 'h2h' && <H2HTab match={match} />}
          {tab === 'lineups' && <LineupsTab match={match} />}
          {tab === 'data' && <DataTab match={match} />}
        </div>
      </PageState>
    </>
  )
}

/* ─────────────────────────── Overview ─────────────────────────── */
function Overview({ match }: { match: Match }) {
  const p = getPrediction(match)
  const [target, setTarget] = useState<ExplainTarget | null>(null)
  const home = teamById(match.homeId)
  const away = teamById(match.awayId)
  const fmt = useProb()
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-5">
        <div>
          <h2 className="mb-2 flex items-center gap-2 text-[15px] font-bold">Smart market picks <span className="text-[12px] font-semibold text-fg-3">strongest predictions across 24 markets</span></h2>
          <MarketPicksCard match={match} showHeader={false} onExplain={(pk) => setTarget({ match, market: pk.market, outcome: pk.outcome, pick: pk })} />
          <ExplainSheet target={target} onClose={() => setTarget(null)} />
        </div>
        <Card>
          <CardHeader title="Why the model leans this way" eyebrow="Explanation" action={<Link to={`/match/${match.id}/prediction`} className="text-[12px] font-bold text-brand-fg">Full prediction →</Link>} />
          <div className="p-5 pt-3">
            <p className="text-[14px] leading-relaxed text-fg-2">
              Dixon–Coles expects <b className="text-fg">{p.lh.toFixed(2)}</b> goals for {home.short} and <b className="text-fg">{p.la.toFixed(2)}</b> for {away.short}. {p.recommendation === 'skip' ? <>The engine recommends <b className="text-fg">skipping</b>: {p.skipReason}</> : <>The strongest statistical signal is <b className="text-fg">{p.pick.label}</b> at <b className="text-fg">{fmt(p.pick.p)}</b> (95% interval {fmt(p.interval[0])}–{fmt(p.interval[1])}).</>}
            </p>
            <Factors factors={p.factors} />
          </div>
        </Card>
        <div className="grid gap-5 md:grid-cols-2">
          {[home, away].map((t) => (
            <Card key={t.id} className="p-5">
              <div className="flex items-center gap-3">
                <Crest team={t} size={30} />
                <div>
                  <Link to={`/team/${t.id}`} className="text-[14px] font-bold hover:text-brand-fg">{t.name}</Link>
                  <div className="text-[12px] text-fg-3">Elo {t.elo} · last 6</div>
                </div>
              </div>
              <div className="mt-4">
                <FormPills form={teamForm(t).map((f) => f.r)} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {(() => {
                  const s = teamSeasonStats(t)
                  return [
                    ['GF/g', s.goalsFor.toFixed(2)],
                    ['GA/g', s.goalsAgainst.toFixed(2)],
                    ['SoT/g', s.shotsOnTarget.toFixed(1)],
                  ].map(([k, v]) => (
                    <div key={k} className="card-inset py-2">
                      <div className="num text-[18px] font-bold">{v}</div>
                      <div className="text-[10px] font-bold text-fg-3">{k}</div>
                    </div>
                  ))
                })()}
              </div>
            </Card>
          ))}
        </div>
      </div>
      <div className="space-y-5">
        <Card className="p-5">
          <div className="eyebrow mb-3">Signal</div>
          <div className="flex items-center gap-4">
            <Ring value={p.signal / 100} size={72} stroke={6} />
            <div className="text-[13px] text-fg-2">
              <div className="font-bold text-fg">{p.recommendation === 'pick' ? 'Strong statistical signal' : p.recommendation === 'lean' ? 'Moderate signal' : 'Insufficient evidence'}</div>
              Combines edge over base rate, calibration, data completeness and model agreement.
            </div>
          </div>
          <div className="mt-4 space-y-2.5">
            {(
              [
                ['Edge vs base rate', p.components.edge],
                ['Calibration reliability', p.components.calibration],
                ['Data completeness', p.components.completeness],
                ['Model agreement', p.components.agreement],
              ] as const
            ).map(([k, v]) => (
              <div key={k}>
                <div className="mb-1 flex justify-between text-[12px] font-semibold"><span className="text-fg-3">{k}</span><span className="num text-fg">{Math.round(v * 100)}</span></div>
                <Progress value={v} tone={v > 0.75 ? 'live' : v > 0.5 ? 'warn' : 'danger'} height={5} />
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <div className="eyebrow mb-3">Key markets</div>
          <div className="space-y-2">
            {[
              ['Over 2.5 goals', p.over25],
              ['Both teams score', p.btts],
              [`${home.short} or draw`, p.dc.homeDraw],
              [`${home.short} draw no bet`, p.dnbHome],
            ].map(([k, v]) => (
              <div key={k as string} className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2.5 text-[13px] font-semibold">
                <span className="text-fg-2">{k}</span>
                <span className="num text-[16px] font-bold">{fmt(v as number)}</span>
              </div>
            ))}
          </div>
        </Card>
        {match.conflict && (
          <Notice tone="danger" icon={<AlertTriangle className="size-4" />} title="Open data conflict">
            {match.conflict}
          </Notice>
        )}
        <Notice tone="neutral" icon={<Lock className="size-4" />} title="Immutable snapshot">
          Published {fmtDate(p.snapshotAt)} {fmtTime(p.snapshotAt)} UTC · {p.modelVersion}. Locks at kick-off; never edited afterwards.
        </Notice>
      </div>
    </div>
  )
}

function Factors({ factors }: { factors: Prediction['factors'] }) {
  const max = Math.max(...factors.map((f) => Math.abs(f.impact)), 1)
  return (
    <ul className="mt-5 space-y-3">
      {factors.map((f) => (
        <li key={f.label} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,1fr)_200px_56px]">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[13px] font-semibold text-fg">
              {f.missing && <ShieldAlert className="size-3.5 text-warn" />}
              {f.label}
            </div>
            <div className="truncate text-[12px] text-fg-3">{f.detail}</div>
          </div>
          <div className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto">
            {f.missing ? (
              <div className="rounded-full border border-dashed border-line-strong py-0.5 text-center text-[10px] font-bold text-fg-3">NOT USED</div>
            ) : (
              <div className="relative h-2 rounded-full bg-surface-3">
                <span className="absolute inset-y-0 left-1/2 w-px bg-line-strong" />
                <div
                  className="absolute inset-y-0 rounded-full"
                  style={{
                    left: f.impact >= 0 ? '50%' : `${50 - (Math.abs(f.impact) / max) * 50}%`,
                    width: `${(Math.abs(f.impact) / max) * 50}%`,
                    background: f.impact >= 0 ? 'var(--home)' : 'var(--away)',
                  }}
                />
              </div>
            )}
          </div>
          <span className={cx('num text-right text-[14px] font-bold', f.missing ? 'text-fg-3' : f.impact >= 0 ? 'text-home' : 'text-away')}>{f.missing ? '—' : `${f.impact > 0 ? '+' : ''}${f.impact.toFixed(1)}`}</span>
        </li>
      ))}
      <li className="pt-1 text-[11px] text-fg-3">Impact in percentage points on the home-win probability (logistic-regression attribution). Positive favours the home side.</li>
    </ul>
  )
}

/* ─────────────────────────── Prediction ─────────────────────────── */
function PredictionTab({ match }: { match: Match }) {
  const p = getPrediction(match)
  const [market, setMarket] = useState<MarketKey>('1x2')
  const def = MARKETS.find((m) => m.key === market)!
  const home = teamById(match.homeId)
  const away = teamById(match.awayId)
  const fmt = useProb()
  const odds = useOdds()
  const hideValue = useApp((s) => s.hideValue)

  const outcomes: { label: string; p: number; odds?: number }[] = (() => {
    switch (market) {
      case '1x2': return [{ label: home.short, p: p.x12.home, odds: match.odds?.home }, { label: 'Draw', p: p.x12.draw, odds: match.odds?.draw }, { label: away.short, p: p.x12.away, odds: match.odds?.away }]
      case 'dc': return [{ label: `${home.short} or draw`, p: p.dc.homeDraw }, { label: `${home.short} or ${away.short}`, p: p.dc.homeAway }, { label: `Draw or ${away.short}`, p: p.dc.drawAway }]
      case 'dnb': return [{ label: home.short, p: p.dnbHome }, { label: away.short, p: 1 - p.dnbHome }]
      case 'ou25': return [{ label: 'Over 2.5', p: p.over25, odds: match.odds?.over25 }, { label: 'Under 2.5', p: 1 - p.over25, odds: match.odds?.under25 }]
      case 'btts': return [{ label: 'Yes', p: p.btts, odds: match.odds?.bttsYes }, { label: 'No', p: 1 - p.btts, odds: match.odds?.bttsNo }]
      case 'tg': return [{ label: `${home.short} over 1.5`, p: p.homeOver15 }, { label: `${away.short} over 0.5`, p: p.awayOver05 }]
      case 'cs': return p.scores.slice(0, 4).map((s) => ({ label: `${s.h}–${s.a}`, p: s.p }))
      case 'ah': return [{ label: `${home.short} ${p.ahHome.line > 0 ? '+' : ''}${p.ahHome.line}`, p: p.ahHome.p }, { label: `${away.short} ${-p.ahHome.line > 0 ? '+' : ''}${-p.ahHome.line}`, p: 1 - p.ahHome.p }]
      default: return []
    }
  })()
  const margin = match.odds && (market === '1x2' || market === 'ou25' || market === 'btts') ? outcomes.reduce((s, o) => s + (o.odds ? 1 / o.odds : 0), 0) - 1 : null

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-5">
        <Card className="p-4 sm:p-5">
          <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {MARKETS.map((m) => (
              <button
                key={m.key}
                onClick={() => setMarket(m.key)}
                className={cx('flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[12.5px] font-bold transition-colors', market === m.key ? 'border-transparent bg-fg text-fg-inverse' : 'border-line text-fg-2 hover:text-fg')}
              >
                <MarketStatusDot status={m.status} />
                {m.name}
              </button>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <h2 className="text-[17px] font-bold">{def.name}</h2>
            <StatusBadge status={def.status} />
          </div>
          {def.status !== 'active' ? (
            <div className="mt-4">
              <Notice tone={def.status === 'validating' ? 'warn' : 'neutral'} icon={<Info className="size-4" />} title={def.status === 'validating' ? 'Not published — validation in progress' : 'Market disabled'}>
                {def.reason} AIDICT does not show probabilities for markets that have not passed validation.
              </Notice>
            </div>
          ) : (
            <>
              <div className={cx('mt-4 grid gap-3', outcomes.length === 2 ? 'grid-cols-2' : outcomes.length === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3')}>
                {outcomes.map((o) => {
                  const ev = o.odds ? o.p * o.odds - 1 : null
                  return (
                    <div key={o.label} className="card-inset p-3 sm:p-4">
                      <div className="truncate text-[12px] font-bold text-fg-3">{o.label}</div>
                      <div className="num mt-1 text-[30px] font-bold leading-none sm:text-[36px]">{fmt(o.p, market === 'cs' ? 1 : 0)}</div>
                      <div className="mt-2 text-[11px] font-semibold text-fg-3">Fair odds {fairOdds(o.p)}</div>
                      {o.odds && !hideValue && (
                        <div className="mt-2 border-t border-line pt-2 text-[11px] font-semibold">
                          <div className="flex justify-between text-fg-3"><span>Market</span><span className="num text-[13px] text-fg-2">{odds(o.odds)}</span></div>
                          <div className="flex justify-between text-fg-3"><span>Implied</span><span className="num text-[13px] text-fg-2">{fmt(1 / o.odds, 1)}</span></div>
                          <div className="flex justify-between text-fg-3"><span>EV / unit</span><span className={cx('num text-[13px]', ev! > 0.02 ? 'text-success' : ev! < 0 ? 'text-danger' : 'text-fg-2')}>{ev! >= 0 ? '+' : ''}{(ev! * 100).toFixed(1)}%</span></div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              {match.odds && !hideValue && outcomes.some((o) => o.odds && o.p * o.odds - 1 > 0.1) && (
                <Notice className="mt-4" tone="warn" icon={<AlertTriangle className="size-4" />} title="Unusually large edge">
                  An expected value above +10% against a liquid market is more often a data or model error than real value. Check line-ups and news before trusting it.
                </Notice>
              )}
              {match.odds && margin !== null && !hideValue ? (
                <p className="mt-3 text-[11.5px] text-fg-3">
                  Odds: {match.odds.source} · captured {fmtDate(match.odds.capturedAt)} {fmtTime(match.odds.capturedAt)} UTC · bookmaker margin {(margin * 100).toFixed(1)}%. EV = model probability × decimal odds − 1. EV uses raw odds; a positive value is not a guarantee and is shown only when the market's calibration passes.
                </p>
              ) : (
                <p className="mt-3 text-[11.5px] text-fg-3">No odds source attached for this market — value is not assessed. Fair odds are 1 ÷ model probability.</p>
              )}
            </>
          )}
        </Card>

        <Card>
          <CardHeader title="Correct-score matrix" eyebrow={`λ home ${p.lh.toFixed(2)} · λ away ${p.la.toFixed(2)} · ρ −0.08`} />
          <div className="p-5">
            <ScoreMatrix pred={p} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Model comparison" eyebrow="1X2 · same inputs, same snapshot" />
          <Table className="mt-2">
            <thead>
              <tr>
                <Th>Model</Th>
                <Th align="right">1</Th>
                <Th align="right">X</Th>
                <Th align="right">2</Th>
                <Th>Role</Th>
              </tr>
            </thead>
            <tbody>
              {p.models.map((mo) => (
                <tr key={mo.key} className={mo.key === 'dc' ? 'bg-brand-soft/40' : ''}>
                  <Td className="font-semibold text-fg">{mo.name}</Td>
                  <Td align="right"><span className="num text-[15px] font-bold text-fg">{fmt(mo.home)}</span></Td>
                  <Td align="right"><span className="num text-[15px] font-bold text-fg">{fmt(mo.draw)}</span></Td>
                  <Td align="right"><span className="num text-[15px] font-bold text-fg">{fmt(mo.away)}</span></Td>
                  <Td>{mo.key === 'dc' ? <Badge tone="brand">Published</Badge> : <span className="text-[12px]">{mo.note}</span>}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div className="flex flex-wrap items-center gap-3 px-5 py-4 text-[12px] text-fg-3">
            <span>Home-win spread across models: <b className={cx('num text-[14px]', p.spread > 0.1 ? 'text-danger' : 'text-fg')}>{(p.spread * 100).toFixed(1)} pp</b></span>
            {p.spread > 0.1 && <Badge tone="danger">Disagreement → skip</Badge>}
          </div>
        </Card>
      </div>

      <div className="space-y-5">
        <Card className="p-5">
          <div className="eyebrow mb-2">Published selection</div>
          {p.recommendation === 'skip' ? (
            <>
              <div className="text-[18px] font-bold">Skip this match</div>
              <p className="mt-1.5 text-[13px] text-fg-3">{p.skipReason}</p>
            </>
          ) : (
            <>
              <div className="text-[18px] font-bold">{p.pick.label}</div>
              <div className="num mt-1 text-[40px] font-bold leading-none text-brand-fg">{fmt(p.pick.p)}</div>
              <div className="mt-2 text-[12px] text-fg-3">95% interval {fmt(p.interval[0])} – {fmt(p.interval[1])} · signal {p.signal}/100</div>
            </>
          )}
          <div className="mt-4 rounded-xl bg-surface-2 p-3 text-[12px] text-fg-3">
            A {fmt(p.pick.p)} probability means this outcome is expected to fail roughly {Math.round((1 - p.pick.p) * 10)} times in 10 similar situations.
          </div>
        </Card>
        <Card className="p-5">
          <div className="eyebrow mb-3">Calibration for this segment</div>
          <div className="flex items-center justify-between text-[13px]"><span className="text-fg-3">Expected calibration error</span><span className="num text-[16px] font-bold">{p.ece.toFixed(3)}</span></div>
          <div className="mt-2 flex items-center justify-between text-[13px]"><span className="text-fg-3">Out-of-sample predictions</span><span className="num text-[16px] font-bold">{compById(match.compId).oosSample.toLocaleString()}</span></div>
          <div className="mt-2 flex items-center justify-between text-[13px]"><span className="text-fg-3">Data completeness</span><span className="num text-[16px] font-bold">{Math.round(match.completeness * 100)}%</span></div>
          <Progress className="mt-3" value={match.completeness} tone={match.completeness >= 0.9 ? 'live' : 'warn'} />
        </Card>
        <Card className="p-5">
          <div className="eyebrow mb-3">Snapshot</div>
          <dl className="space-y-2 text-[12.5px]">
            {[
              ['Model', p.modelVersion],
              ['Calibration', 'Isotonic (walk-forward fit)'],
              ['Snapshot', `${fmtDate(p.snapshotAt)} ${fmtTime(p.snapshotAt)} UTC · T-24h`],
              ['Input hash', p.inputHash],
              ['Status', match.status === 'SCHEDULED' ? 'Open — locks at kick-off' : 'Locked'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="text-fg-3">{k}</dt>
                <dd className="truncate text-right font-semibold text-fg-2" title={v}>{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex items-center gap-2 text-[11px] font-semibold text-fg-3">
            <Fingerprint className="size-3.5" /> Immutable after publication
          </div>
        </Card>
      </div>
    </div>
  )
}

/* ─────────────────────────── Statistics ─────────────────────────── */
function StatsTab({ match }: { match: Match }) {
  const home = teamById(match.homeId)
  const away = teamById(match.awayId)
  const hs = teamSeasonStats(home)
  const as = teamSeasonStats(away)
  const periods = ['0–15', '16–30', '31–45', '46–60', '61–75', '76–90']
  const goalTiming = periods.map((k, i) => ({ period: k, [home.short]: hs.goalsByPeriod[i], [away.short]: as.goalsByPeriod[i] }))
  const eloH = eloHistory(home)
  const eloA = eloHistory(away)
  const elo = eloH.map((e, i) => ({ date: e.date.slice(5), [home.short]: e.elo, [away.short]: eloA[i].elo }))
  const pct = (v: number) => `${Math.round(v * 100)}%`
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="p-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-2 text-[13px] font-bold"><Crest team={home} size={18} /> {home.short}</span>
          <span className="eyebrow">Season per game</span>
          <span className="flex items-center gap-2 text-[13px] font-bold">{away.short} <Crest team={away} size={18} /></span>
        </div>
        <StatCompare label="Goals scored" home={hs.goalsFor} away={as.goalsFor} format={(v) => v.toFixed(2)} />
        <StatCompare label="Goals conceded" home={hs.goalsAgainst} away={as.goalsAgainst} format={(v) => v.toFixed(2)} lowerIsBetter />
        <StatCompare label="Shots" home={hs.shots} away={as.shots} format={(v) => v.toFixed(1)} />
        <StatCompare label="Shots on target" home={hs.shotsOnTarget} away={as.shotsOnTarget} format={(v) => v.toFixed(1)} />
        <StatCompare label="Corners" home={hs.corners} away={as.corners} format={(v) => v.toFixed(1)} />
        <StatCompare label="Clean sheets" home={hs.cleanSheets} away={as.cleanSheets} format={pct} />
        <StatCompare label="BTTS matches" home={hs.bttsRate} away={as.bttsRate} format={pct} />
        <StatCompare label="Over 2.5 matches" home={hs.over25Rate} away={as.over25Rate} format={pct} />
        <StatCompare label="Expected goals (xG)" home={0} away={0} unavailable="No reliable xG source for 2026-27 — not estimated" />
        <p className="mt-3 text-[11px] text-fg-3">Shots, corners: football-data.co.uk definitions. Goals: football-data.org results. Sources are never mixed within one statistic.</p>
      </Card>
      <div className="space-y-5">
        <Card>
          <CardHeader title="Goals by match period" eyebrow="Average per game" />
          <div className="h-[240px] p-3">
            <ResponsiveContainer>
              <BarChart data={goalTiming} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="var(--grid)" vertical={false} />
                <XAxis dataKey="period" tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'var(--surface-2)' }} contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border-strong)', borderRadius: 12, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey={home.short} fill="var(--home)" radius={[4, 4, 0, 0]} />
                <Bar dataKey={away.short} fill="var(--away)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHeader title="Elo rating trend" eyebrow="Last 6 months" />
          <div className="h-[220px] p-3">
            <ResponsiveContainer>
              <LineChart data={elo} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="var(--grid)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} interval={5} />
                <YAxis domain={['dataMin - 20', 'dataMax + 20']} tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border-strong)', borderRadius: 12, fontSize: 12 }} />
                <Line type="monotone" dataKey={home.short} stroke="var(--home)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey={away.short} stroke="var(--away)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5">
          <div className="eyebrow mb-3">Home / away records</div>
          <div className="grid grid-cols-2 gap-3 text-[13px]">
            <div className="card-inset p-3"><div className="font-bold">{home.short} at home</div><div className="num mt-1 text-[20px] font-bold">{hs.homeRecord.w}W {hs.homeRecord.d}D {hs.homeRecord.l}L</div></div>
            <div className="card-inset p-3"><div className="font-bold">{away.short} away</div><div className="num mt-1 text-[20px] font-bold">{as.awayRecord.w}W {as.awayRecord.d}D {as.awayRecord.l}L</div></div>
          </div>
        </Card>
      </div>
    </div>
  )
}

/* ─────────────────────────── Head-to-head ─────────────────────────── */
function H2HTab({ match }: { match: Match }) {
  const home = teamById(match.homeId)
  const away = teamById(match.awayId)
  const games = headToHead(home, away)
  const wins = games.reduce((acc, g) => {
    const winner = g.score[0] > g.score[1] ? g.homeId : g.score[1] > g.score[0] ? g.awayId : 'draw'
    acc[winner] = (acc[winner] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)
  const goals = games.reduce((s, g) => s + g.score[0] + g.score[1], 0) / games.length
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
      <Card className="p-5">
        <div className="eyebrow mb-4">Last {games.length} meetings</div>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            [home.short, wins[home.id] ?? 0, 'var(--home)'],
            ['Draws', wins.draw ?? 0, 'var(--neutral)'],
            [away.short, wins[away.id] ?? 0, 'var(--away)'],
          ].map(([k, v, c]) => (
            <div key={k as string} className="card-inset py-3">
              <div className="num text-[28px] font-bold" style={{ color: c as string }}>{v as number}</div>
              <div className="text-[11px] font-bold text-fg-3">{k as string}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-between text-[13px]"><span className="text-fg-3">Goals per meeting</span><span className="num text-[16px] font-bold">{goals.toFixed(2)}</span></div>
        <Notice className="mt-4" tone="neutral" icon={<Info className="size-4" />}>Head-to-head carries little weight in the model (it is mostly explained by team strength). It is shown for context.</Notice>
      </Card>
      <Card>
        <ul className="divide-y divide-line">
          {games.map((g, i) => (
            <li key={i} className="flex items-center gap-3 px-5 py-3">
              <span className="w-20 text-[12px] font-semibold text-fg-3">{g.date}</span>
              <span className="flex flex-1 items-center justify-end gap-2 text-[13px] font-semibold">{teamById(g.homeId).short}<Crest team={teamById(g.homeId)} size={18} /></span>
              <span className="num w-14 rounded-lg bg-surface-2 py-1 text-center text-[16px] font-bold">{g.score[0]}–{g.score[1]}</span>
              <span className="flex flex-1 items-center gap-2 text-[13px] font-semibold"><Crest team={teamById(g.awayId)} size={18} />{teamById(g.awayId).short}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

/* ─────────────────────────── Line-ups ─────────────────────────── */
function LineupsTab({ match }: { match: Match }) {
  const l = LINEUPS[match.id]
  if (!l)
    return (
      <Card>
        <EmptyState
          icon={<Users className="size-6" />}
          title="Line-ups not available"
          body="football-data.org's free tier does not include line-ups, and the API-Football budget (100 calls/day) is reserved for featured and saved matches. The model does not assume line-ups it cannot see."
        />
      </Card>
    )
  const home = teamById(match.homeId)
  const away = teamById(match.awayId)
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <Card className="p-4 sm:p-6">
        <Pitch home={l.home} away={l.away} homeTeam={home.short} awayTeam={away.short} />
        <p className="mt-3 text-[11px] text-fg-3">Source: {l.source}</p>
      </Card>
      <Card className="p-5">
        {[{ t: home, x: l.home }, { t: away, x: l.away }].map(({ t, x }) => (
          <div key={t.id} className="mb-5 last:mb-0">
            <div className="mb-2 flex items-center gap-2 text-[14px] font-bold"><Crest team={t} size={20} /> {t.short} <span className="text-[12px] font-semibold text-fg-3">{x.formation}</span></div>
            <ol className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12.5px] text-fg-2">
              {x.players.map((pl, i) => (
                <li key={pl}><span className="num mr-1.5 text-fg-3">{i + 1}</span>{pl}</li>
              ))}
            </ol>
          </div>
        ))}
      </Card>
    </div>
  )
}

function Pitch({ home, away, homeTeam, awayTeam }: { home: { formation: string; players: string[] }; away: { formation: string; players: string[] }; homeTeam: string; awayTeam: string }) {
  const rows = (f: string) => [1, ...f.split('-').map(Number)]
  const place = (side: 'home' | 'away', x: { formation: string; players: string[] }) => {
    const r = rows(x.formation)
    let idx = 0
    return r.flatMap((count, ri) =>
      Array.from({ length: count }).map((_, ci) => {
        const name = x.players[idx++]
        const yBase = (ri / (r.length - 1)) * 42 + 5
        const y = side === 'home' ? 100 - yBase : yBase
        const xPos = ((ci + 1) / (count + 1)) * 100
        return { name, x: xPos, y, num: idx }
      }),
    )
  }
  return (
    <div className="relative mx-auto aspect-[68/100] w-full max-w-[440px] overflow-hidden rounded-2xl border border-line bg-[linear-gradient(180deg,#1d2a1f_0%,#18231a_100%)] [[data-aidict-theme=light]_&]:bg-[linear-gradient(180deg,#e7efe6_0%,#dde8dc_100%)]">
      <svg viewBox="0 0 68 100" className="absolute inset-0 size-full" preserveAspectRatio="none" aria-hidden>
        <g fill="none" stroke="currentColor" strokeOpacity=".18" strokeWidth=".35" className="text-fg">
          <rect x="2" y="2" width="64" height="96" rx="1" />
          <line x1="2" y1="50" x2="66" y2="50" />
          <circle cx="34" cy="50" r="8" />
          <rect x="16" y="2" width="36" height="15" />
          <rect x="26" y="2" width="16" height="5.5" />
          <rect x="16" y="83" width="36" height="15" />
          <rect x="26" y="92.5" width="16" height="5.5" />
        </g>
      </svg>
      <span className="absolute left-3 top-2 text-[10px] font-bold text-fg-3">{awayTeam} · {away.formation}</span>
      <span className="absolute bottom-2 left-3 text-[10px] font-bold text-fg-3">{homeTeam} · {home.formation}</span>
      {[...place('home', home).map((p) => ({ ...p, side: 'home' })), ...place('away', away).map((p) => ({ ...p, side: 'away' }))].map((p) => (
        <div key={p.side + p.num} className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
          <span className="num flex size-7 items-center justify-center rounded-full text-[12px] font-bold text-white shadow-[0_2px_8px_rgba(0,0,0,.4)]" style={{ background: p.side === 'home' ? 'var(--home)' : 'var(--away)' }}>{p.num}</span>
          <span className="mt-0.5 max-w-[70px] truncate rounded bg-black/40 px-1 text-[9.5px] font-bold text-white">{p.name}</span>
        </div>
      ))}
    </div>
  )
}

/* ─────────────────────────── Data & model ─────────────────────────── */
function DataTab({ match }: { match: Match }) {
  const p = getPrediction(match)
  const rows = [
    { field: 'Fixture & kick-off', source: 'football-data.org', updated: '2026-11-28T15:17:00Z', status: 'confirmed', note: 'Matched with OpenFootball schedule' },
    { field: 'Results history (16 seasons)', source: 'OpenFootball + football-data.org', updated: '2026-11-28T05:30:00Z', status: match.conflict ? 'conflict' : 'confirmed', note: match.conflict ?? '2 sources agree' },
    { field: 'Shots / shots on target', source: 'football-data.co.uk', updated: '2026-11-23T04:10:00Z', status: 'confirmed', note: 'Weekly import' },
    { field: 'Standings', source: 'football-data.org', updated: '2026-11-28T15:17:00Z', status: 'confirmed', note: '' },
    { field: 'Line-ups', source: match.lineups ? 'API-Football' : '—', updated: match.lineups ? '2026-11-28T16:32:00Z' : '', status: match.lineups ? 'confirmed' : 'unavailable', note: match.lineups ? '1 of 100 daily calls' : 'Not on free tier' },
    { field: 'Odds', source: match.odds ? match.odds.source : '—', updated: match.odds?.capturedAt ?? '', status: match.odds ? 'confirmed' : 'unavailable', note: match.odds ? 'Pre-match only' : 'Value not assessed' },
    { field: 'xG', source: '—', updated: '', status: 'unavailable', note: 'Excluded — no reliable source' },
  ]
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card>
        <CardHeader title="Data provenance" eyebrow={`Completeness ${Math.round(match.completeness * 100)}%`} />
        <Table className="mt-2">
          <thead><tr><Th>Input</Th><Th>Source</Th><Th>Updated</Th><Th>Status</Th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.field}>
                <Td className="font-semibold text-fg">{r.field}<div className="text-[11px] font-medium text-fg-3">{r.note}</div></Td>
                <Td>{r.source}</Td>
                <Td>{r.updated ? relTime(r.updated, NOW) : '—'}</Td>
                <Td>{r.status === 'confirmed' ? <Badge tone="success" dot>Confirmed</Badge> : r.status === 'conflict' ? <Badge tone="danger" dot>Conflict</Badge> : <Badge dot>Unavailable</Badge>}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      <Card className="p-5">
        <div className="eyebrow mb-3 flex items-center gap-1.5"><BookOpenCheck className="size-3.5" /> Methodology</div>
        <ol className="space-y-3 text-[12.5px] text-fg-2">
          <li><b className="text-fg">1 · Ratings.</b> Elo with home advantage and season regression.</li>
          <li><b className="text-fg">2 · Goals model.</b> Dixon–Coles attack/defence with time decay (ξ = 0.0019/day) and low-score correction.</li>
          <li><b className="text-fg">3 · Markets.</b> Every market is summed from one score matrix, so they never contradict.</li>
          <li><b className="text-fg">4 · Calibration.</b> Isotonic mapping fitted on walk-forward out-of-fold predictions only.</li>
          <li><b className="text-fg">5 · Gates.</b> Markets publish only after ≥300 out-of-sample predictions, beating the base rate and ECE ≤ 0.03.</li>
        </ol>
        <div className="mt-4 rounded-xl bg-surface-2 p-3 text-[12px] text-fg-3">Model {p.modelVersion} · trained 23 Nov 2026 on 2016-08 → 2026-11 · git 4f1c9e2</div>
      </Card>
    </div>
  )
}
