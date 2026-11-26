import { useState } from 'react'
import { Star } from 'lucide-react'
import { MATCHES, getPrediction } from '../mock/matches'
import { teamById } from '../mock/teams'
import { PageHeader } from '../components/layout/shell'
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, Field, Input, Kpi, LivePill, Notice, Progress, Ring, Segmented, Select, SkeletonCard, StatusBadge, Switch, Tabs } from '../components/ui/primitives'
import { useApp } from '../lib/store'
import { Crest, Flag, FormPills, NeutralBadge } from '../components/sports/identity'
import { MatchRow, ProbBar, ProbTriple, StatCompare } from '../components/sports/match'

const COLORS: [string, string, string][] = [
  ['--bg', 'Canvas', 'Page background'],
  ['--surface-1', 'Surface 1', 'Cards'],
  ['--surface-2', 'Surface 2', 'Raised / hover'],
  ['--surface-3', 'Surface 3', 'Inputs, chips'],
  ['--text', 'Text', 'Primary'],
  ['--text-2', 'Text 2', 'Secondary'],
  ['--text-3', 'Text 3', 'Muted'],
  ['--brand', 'Brand crimson', '#B50F31 · from logo'],
  ['--brand-fg', 'Brand on dark', 'Text & icons'],
  ['--live', 'Live', 'In-play only'],
  ['--win', 'Win', 'Form W'],
  ['--draw', 'Draw', 'Form D'],
  ['--loss', 'Loss', 'Form L'],
  ['--gold', 'Gold', 'Saved / lean'],
  ['--home', 'Home', 'Outcome 1'],
  ['--away', 'Away', 'Outcome 2'],
  ['--info', 'Info', 'Neutral signal'],
  ['--warn', 'Warning', 'Validating / degraded'],
  ['--danger', 'Danger', 'Errors / conflicts'],
]

export default function DesignSystem() {
  const [tab, setTab] = useState('info')
  const [seg, setSeg] = useState('a')
  const [sw, setSw] = useState(true)
  const [sel, setSel] = useState('pl')
  const toast = useApp((s) => s.toast)
  const m = MATCHES.find((x) => x.id === 'm-pl-ars-che')!
  const live = MATCHES.find((x) => x.status === 'LIVE')!
  const p = getPrediction(m)
  return (
    <>
      <PageHeader eyebrow="AIDICT 1.0" title="Design system" description="Tokens and components shared by every screen. The same tokens port to the Next.js app and inform the Android design." />
      <div className="space-y-6">
        <Card>
          <CardHeader title="Colour tokens" eyebrow="Dark primary · light derived" />
          <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 lg:grid-cols-5">
            {COLORS.map(([v, n, d]) => (
              <div key={v} className="overflow-hidden rounded-xl border border-line">
                <div className="h-14" style={{ background: `var(${v})` }} />
                <div className="p-2.5">
                  <div className="text-[12px] font-bold">{n}</div>
                  <div className="font-mono text-[10.5px] text-fg-3">{v}</div>
                  <div className="text-[10.5px] text-fg-3">{d}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <div className="eyebrow mb-4">Typography</div>
            <div className="space-y-3">
              <div><span className="text-[28px] font-extrabold tracking-[-0.01em]">Page title · Manrope 800 / 28</span></div>
              <div><span className="text-[17px] font-bold">Section title · Manrope 700 / 17</span></div>
              <div><span className="text-[14px] text-fg-2">Body · Manrope 500 / 14 — clear, compact and highly legible.</span></div>
              <div><span className="eyebrow">Eyebrow · 11 / caps / 0.08em</span></div>
              <div className="flex items-end gap-6"><span className="num text-[56px] font-bold leading-none">2 : 1</span><span className="num text-[36px] font-bold leading-none text-brand-fg">54%</span></div>
              <p className="text-[12px] text-fg-3">Scores and statistics use Barlow Semi Condensed with tabular figures, so numbers align in tables and live updates do not shift layout.</p>
            </div>
          </Card>
          <Card className="p-5">
            <div className="eyebrow mb-4">Radius · elevation · spacing</div>
            <div className="flex flex-wrap items-end gap-3">
              {[['xs', 6], ['sm', 10], ['md', 14], ['lg', 20], ['xl', 28]].map(([k, r]) => (
                <div key={k as string} className="text-center">
                  <div className="size-16 border border-line-strong bg-surface-2" style={{ borderRadius: r as number }} />
                  <div className="mt-1 text-[11px] font-bold text-fg-3">{k} · {r}</div>
                </div>
              ))}
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3">
              <div className="card flex h-16 items-center justify-center text-[11px] font-bold text-fg-3">card</div>
              <div className="flex h-16 items-center justify-center rounded-[20px] border border-line bg-surface-2 text-[11px] font-bold text-fg-3 shadow-pop">pop</div>
              <div className="flex h-16 items-center justify-center rounded-[20px] border border-line bg-surface-1 text-[11px] font-bold text-fg-3 shadow-glow">glow · active</div>
            </div>
            <p className="mt-4 text-[12px] text-fg-3">4-pt spacing grid. Page gutter 16 px (mobile) / 28 px (desktop). Breakpoints: 640 · 768 · 1024 · 1280 · 1536.</p>
          </Card>
        </div>

        <Card className="p-5">
          <div className="eyebrow mb-4">Controls</div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary">Primary</Button>
            <Button>Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="primary" loading>Loading</Button>
            <Button disabled>Disabled</Button>
          </div>
          <div className="mt-5 grid gap-5 md:grid-cols-3">
            <Field label="Input" hint="Helper text"><Input placeholder="Search teams" /></Field>
            <Field label="Input — error" error="Enter a valid email address."><Input defaultValue="owner@" error /></Field>
            <Field label="Select"><Select value={sel} onChange={setSel} options={[{ value: 'pl', label: 'Premier League' }, { value: 'pd', label: 'LaLiga' }, { value: 'ded', label: 'Eredivisie', hint: 'Model validating' }]} /></Field>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-5">
            <Segmented value={seg} onChange={setSeg} items={[{ value: 'a', label: 'Info' }, { value: 'b', label: 'Summary' }, { value: 'c', label: 'Stats' }]} />
            <Switch checked={sw} onChange={setSw} label="Demo switch" />
            <Button size="sm" onClick={() => toast({ tone: 'success', title: 'Success toast', body: 'Saved successfully.' })}>Show toast</Button>
          </div>
          <Tabs className="mt-5" value={tab} onChange={setTab} items={[{ value: 'info', label: 'Info' }, { value: 'summary', label: 'Summary' }, { value: 'report', label: 'Report' }, { value: 'stats', label: 'Stats' }]} />
        </Card>

        <Card className="p-5">
          <div className="eyebrow mb-4">Status language</div>
          <div className="flex flex-wrap items-center gap-2">
            <LivePill />
            <Badge tone="live">Pick</Badge>
            <Badge tone="gold">Lean</Badge>
            <Badge>Skip</Badge>
            <StatusBadge status="active" />
            <StatusBadge status="validating" />
            <StatusBadge status="disabled" />
            <StatusBadge status="operational" />
            <StatusBadge status="degraded" />
            <StatusBadge status="open" label="Conflict" />
            <Badge tone="brand">Published</Badge>
            <Badge tone="info">Benchmark</Badge>
            <Star className="size-5 fill-gold text-gold" />
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <div className="eyebrow mb-4">Sports components</div>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                {['ars', 'che', 'rma', 'bay', 'juv', 'psg', 'eng', 'bra'].map((id) => <Crest key={id} team={teamById(id)} size={32} />)}
                <NeutralBadge size={32} label="Unknown team" />
                <div className="flex gap-1.5"><Flag code="eng" /><Flag code="esp" /><Flag code="ger" /><Flag code="ita" /><Flag code="fra" /><Flag code="eur" /></div>
              </div>
              <p className="text-[12px] text-fg-3">Badges: authentic provider crests in a fixed square box (object-contain). National teams use provider-supplied flags. The last item is the neutral fallback, used only when no authentic badge exists.</p>
              <FormPills form={['W', 'W', 'D', 'L', 'W']} />
              <ProbBar p={p.x12} />
              <ProbTriple p={p.x12} />
              <StatCompare label="Shots on target" home={5.8} away={4.6} format={(v) => v.toFixed(1)} />
              <div className="flex items-center gap-4"><Ring value={0.78} /><Ring value={0.58} /><Ring value={0.34} /><div className="w-40"><Progress value={0.63} tone="warn" /></div></div>
            </div>
          </Card>
          <Card className="p-5">
            <div className="eyebrow mb-4">Match rows</div>
            <div className="space-y-2">
              <MatchRow match={m} />
              <MatchRow match={live} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Kpi label="Brier" value="0.583" delta="−0.072 vs base" deltaGood />
              <Kpi label="Hit rate" value="52.4%" sub="n=1,284" />
            </div>
          </Card>
        </div>

        <div>
          <div className="eyebrow mb-3">States</div>
          <div className="grid gap-5 lg:grid-cols-4">
            <SkeletonCard rows={3} />
            <Card><EmptyState title="Empty state" body="Explains why and what to do next." /></Card>
            <Card><ErrorState body="Provider unavailable. Cached data shown." onRetry={() => {}} /></Card>
            <Card className="space-y-3 p-5">
              <Notice tone="success" title="Success">Settings saved.</Notice>
              <Notice tone="warn" title="Delayed source">Scores updated 12 min ago.</Notice>
              <Notice tone="danger" title="Conflict">Two providers disagree.</Notice>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}
