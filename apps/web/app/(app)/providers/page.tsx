import type { Metadata } from 'next'
import { getProvidersStatus } from '@/lib/data'
import { relTime } from '@/lib/format'
import { getUser, isAdmin } from '@/lib/supabase/server'
import { Badge, Card, CardHeader, EmptyState, Notice, PageHeader, StatusBadge, Table, Td, Th } from '@/components/ui/primitives'

export const metadata: Metadata = { title: 'Data status' }
export const dynamic = 'force-dynamic'

const JOB_LABEL: Record<string, string> = {
  sync_current: 'Fixtures & results sync',
  predict_upcoming: 'Publish predictions',
  settle_results: 'Settle picks',
  retrain_and_backtest: 'Backtest & market gates',
  sync_history: 'Historical data refresh',
}

export default async function ProvidersPage() {
  const [{ providers, jobs, logs }, user] = await Promise.all([getProvidersStatus(), getUser()])
  const admin = isAdmin(user)
  return (
    <>
      <PageHeader eyebrow="Transparency" title="Data status" description="Where AIDICT's data comes from, how fresh it is and what each source is licensed for. Only free, documented sources are used." />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card className="xl:col-span-2">
          <CardHeader title="Pipeline jobs" eyebrow="Run on a schedule by GitHub Actions" />
          {jobs.length === 0 ? (
            <EmptyState title="No jobs registered" />
          ) : (
            <Table className="mt-2">
              <thead>
                <tr>
                  <Th>Job</Th>
                  <Th>Schedule (UTC cron)</Th>
                  <Th>Last run</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j: { job: string; cron: string; last_run_at: string | null; last_status: string | null; is_enabled: boolean }) => (
                  <tr key={j.job}>
                    <Td className="font-semibold text-fg">{JOB_LABEL[j.job] ?? j.job}</Td>
                    <Td className="num">{j.cron}</Td>
                    <Td>{relTime(j.last_run_at)}</Td>
                    <Td>{!j.is_enabled ? <Badge>disabled</Badge> : j.last_status ? <StatusBadge status={j.last_status === 'success' ? 'success' : 'error'} label={j.last_status} /> : <Badge dot>not run yet</Badge>}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader title="Sources" eyebrow="Higher weight wins when sources disagree" />
          <Table className="mt-2">
            <thead>
              <tr>
                <Th>Provider</Th>
                <Th>Used for</Th>
                <Th>Licence</Th>
                <Th align="right">Weight</Th>
                <Th>Budget</Th>
              </tr>
            </thead>
            <tbody>
              {providers.map((p: { id: string; name: string; kind: string; licence: string; attribution_text: string | null; reliability_weight: number; daily_budget: number | null; minute_budget: number | null; is_enabled: boolean }) => (
                <tr key={p.id}>
                  <Td className="font-semibold text-fg">
                    {p.name} {!p.is_enabled && <Badge>off</Badge>}
                    {p.attribution_text && <div className="text-[11px] font-medium text-fg-3">{p.attribution_text}</div>}
                  </Td>
                  <Td>{p.kind}</Td>
                  <Td>{p.licence}</Td>
                  <Td align="right" className="num">{Number(p.reliability_weight).toFixed(2)}</Td>
                  <Td className="text-[12px]">{[p.minute_budget && `${p.minute_budget}/min`, p.daily_budget && `${p.daily_budget}/day`].filter(Boolean).join(' · ') || '—'}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader title="Recent requests" eyebrow={admin ? 'Last 40 provider calls' : 'Admins only'} />
          {!admin ? (
            <div className="p-5">
              <Notice tone="neutral" title="Request logs are visible to the workspace owner." />
            </div>
          ) : logs.length === 0 ? (
            <EmptyState title="No requests logged yet" />
          ) : (
            <Table className="mt-2">
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Provider</Th>
                  <Th>Job</Th>
                  <Th align="right">HTTP</Th>
                  <Th align="right">Rows</Th>
                  <Th align="right">Quota left</Th>
                  <Th>Error</Th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l: { provider_id: string; job: string; status_code: number | null; rows_upserted: number; quota_remaining: number | null; error: string | null; started_at: string }, i: number) => (
                  <tr key={i}>
                    <Td>{relTime(l.started_at)}</Td>
                    <Td>{l.provider_id}</Td>
                    <Td>{l.job}</Td>
                    <Td align="right" className="num">{l.status_code ?? '—'}</Td>
                    <Td align="right" className="num">{l.rows_upserted}</Td>
                    <Td align="right" className="num">{l.quota_remaining ?? '—'}</Td>
                    <Td className="max-w-[280px] truncate text-[12px] text-danger">{l.error ?? ''}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </>
  )
}
