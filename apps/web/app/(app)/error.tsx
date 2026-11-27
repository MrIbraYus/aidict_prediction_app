'use client'
import { ErrorState } from '@/components/ui/interactive'

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card">
      <ErrorState body="The data service did not respond or returned something unexpected. Nothing was lost." onRetry={reset} />
    </div>
  )
}
