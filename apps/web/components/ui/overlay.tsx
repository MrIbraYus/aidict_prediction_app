'use client'
import { useEffect, useSyncExternalStore, type ReactNode } from 'react'
import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { cx } from '@/lib/format'

type Toast = { id: number; title: string; body?: string; tone?: 'success' | 'error' | 'info' }
let toasts: Toast[] = []
let seq = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

/** Show a short confirmation. Safe to call from any client component. */
export function toast(t: Omit<Toast, 'id'>) {
  const id = ++seq
  toasts = [...toasts, { ...t, id }].slice(-4)
  emit()
  setTimeout(() => dismiss(id), 4200)
}
function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}
const subscribe = (l: () => void) => (listeners.add(l), () => listeners.delete(l))
const EMPTY: Toast[] = []

export function Toaster({ children }: { children?: ReactNode }) {
  const list = useSyncExternalStore(subscribe, () => toasts, () => EMPTY)
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:pr-6" aria-live="polite">
      {children}
      {list.map((t) => (
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
