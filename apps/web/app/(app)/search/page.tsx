import type { Metadata } from 'next'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { searchAll } from '@/lib/data'
import { FLAG_BY_CODE } from '@/lib/format'
import { Card, CardHeader, EmptyState, PageHeader } from '@/components/ui/primitives'
import { Crest, Flag } from '@/components/sports/identity'

export const metadata: Metadata = { title: 'Search' }
export const dynamic = 'force-dynamic'

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? '').trim()
  const { teams, competitions } = await searchAll(q)
  return (
    <>
      <PageHeader eyebrow="Search" title={q ? `Results for “${q}”` : 'Search'} />
      <form action="/search" className="mb-5 flex h-11 items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 focus-within:border-brand-fg" role="search">
        <Search className="size-4 text-fg-3" />
        <input name="q" defaultValue={q} autoFocus placeholder="Team or competition" aria-label="Search teams or competitions" className="h-full w-full bg-transparent text-[16px] font-medium outline-none placeholder:text-fg-3 sm:text-sm" />
      </form>
      {q.length < 2 ? (
        <Card>
          <EmptyState icon={<Search className="size-6" />} title="Type at least two letters" />
        </Card>
      ) : teams.length + competitions.length === 0 ? (
        <Card>
          <EmptyState title="Nothing found" body="Only teams and competitions AIDICT tracks are searchable." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title="Teams" eyebrow={`${teams.length}`} />
            <div className="p-3">
              {teams.map((t) => (
                <Link key={t.id} href={`/team/${t.id}`} className="flex items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-surface-2">
                  <Crest team={t} size={24} />
                  <span className="text-[14px] font-semibold">{t.name}</span>
                </Link>
              ))}
            </div>
          </Card>
          <Card>
            <CardHeader title="Competitions" eyebrow={`${competitions.length}`} />
            <div className="p-3">
              {competitions.map((c) => (
                <Link key={c.id} href={`/competitions/${c.code}`} className="flex items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-surface-2">
                  <Flag code={FLAG_BY_CODE[c.code] ?? 'eur'} />
                  <span className="text-[14px] font-semibold">{c.name}</span>
                </Link>
              ))}
            </div>
          </Card>
        </div>
      )}
    </>
  )
}
