import Link from 'next/link'
import { EmptyState } from '@/components/ui/primitives'

export default function NotFound() {
  return (
    <main className="mx-auto max-w-lg px-5 py-20">
      <div className="card">
        <EmptyState title="Page not found" body="That match, team or page does not exist, or you do not have access to it." action={<Link href="/" className="inline-flex h-10 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-white">Go to dashboard</Link>} />
      </div>
    </main>
  )
}
