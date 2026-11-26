import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from 'react'

/** Minimal hash router for the prototype (no dependency; Next.js App Router replaces it at Stage 3). */

function getHash() {
  const h = window.location.hash.replace(/^#/, '')
  return h === '' ? '/' : h
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

export function useRoute() {
  const full = useSyncExternalStore(subscribe, getHash, () => '/')
  const [path, query = ''] = full.split('?')
  const parts = path.split('/').filter(Boolean)
  return { path, parts, query: new URLSearchParams(query) }
}

export function navigate(to: string) {
  if (getHash() === to) return
  window.location.hash = to
  window.scrollTo({ top: 0 })
}

export function isActive(current: string, to: string) {
  if (to === '/') return current === '/'
  return current === to || current.startsWith(to + '/')
}

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { to: string; children: ReactNode }

export function Link({ to, onClick, children, ...rest }: LinkProps) {
  return (
    <a
      href={`#${to}`}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e)
        if (e.defaultPrevented || e.metaKey || e.ctrlKey) return
        e.preventDefault()
        navigate(to)
      }}
      {...rest}
    >
      {children}
    </a>
  )
}
