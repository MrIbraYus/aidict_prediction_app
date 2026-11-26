import { useEffect, useState, type ReactNode } from 'react'
import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { useApp } from '../../lib/store'
import { cx } from '../../lib/format'
import { EmptyState, ErrorState, SkeletonCard } from './primitives'
import { NotificationToasts } from '../notify'

export function Toaster() {
  const toasts = useApp((s) => s.toasts)
  const dismiss = useApp((s) => s.dismissToast)
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:pr-6" aria-live="polite">
      <NotificationToasts />
      {toasts.map((t) => (
        <div key={t.id} className="animate-slide-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-line-strong bg-surface-2 p-3.5 shadow-pop">
          {t.tone === 'success' ? <CheckCircle2 className="mt-0.5 size-5 text-success" /> : t.tone === 'error' ? <XCircle className="mt-0.5 size-5 text-danger" /> : <Info className="mt-0.5 size-5 text-info" />}
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-bold text-fg">{t.title}</div>
            {t.body && <div className="mt-0.5 text-[12px] text-fg-3">{t.body}</div>}
          </div>
          <button aria-label="Dismiss" onClick={() => dismiss(t.id)} className="text-fg-3 hover:text-fg">
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  )
}

export function Sheet({ open, onClose, title, children, side = 'bottom' }: { open: boolean; onClose: () => void; title: string; children: ReactNode; side?: 'bottom' | 'right' }) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', h)
      document.body.style.overflow = ''
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-[var(--overlay)] backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={cx(
          'animate-fade-up absolute border-line-strong bg-bg-elev shadow-pop',
          side === 'bottom' ? 'inset-x-0 bottom-0 max-h-[86dvh] overflow-auto rounded-t-[28px] border-t' : 'inset-y-0 right-0 w-full max-w-md overflow-auto border-l',
        )}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-bg-elev/95 px-5 py-4 backdrop-blur">
          <h2 className="text-[15px] font-bold">{title}</h2>
          <button aria-label="Close" onClick={onClose} className="flex size-9 items-center justify-center rounded-full bg-surface-2 text-fg-2 hover:text-fg">
            <X className="size-4" />
          </button>
        </div>
        <div className="p-5 pb-10">{children}</div>
      </div>
    </div>
  )
}

/**
 * Prototype-only wrapper: shows a short skeleton on first render and lets the reviewer force
 * Loading / Empty / Error states from the prototype bar, so every screen's states can be inspected.
 */
export function PageState({ children, loading, empty, error, skeletonRows = 5 }: { children: ReactNode; loading?: ReactNode; empty?: ReactNode; error?: ReactNode; skeletonRows?: number }) {
  const forced = useApp((s) => s.viewState)
  const set = useApp((s) => s.set)
  const [booting, setBooting] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setBooting(false), 380)
    return () => clearTimeout(t)
  }, [])
  if (forced === 'loading' || booting)
    return (
      <>
        {loading ?? (
          <div className="grid gap-4 lg:grid-cols-3">
            <SkeletonCard rows={skeletonRows} className="lg:col-span-2" />
            <SkeletonCard rows={3} />
          </div>
        )}
      </>
    )
  if (forced === 'empty') return <div className="card">{empty ?? <EmptyState title="Nothing here yet" body="When data is available it will appear here." />}</div>
  if (forced === 'error') return <div className="card">{error ?? <ErrorState onRetry={() => set({ viewState: 'default' })} />}</div>
  return <>{children}</>
}
