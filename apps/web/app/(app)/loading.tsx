import { SkeletonCard } from '@/components/ui/primitives'

export default function Loading() {
  return (
    <div className="grid gap-4 lg:grid-cols-3" aria-busy="true">
      <SkeletonCard rows={6} className="lg:col-span-2" />
      <SkeletonCard rows={3} />
    </div>
  )
}
