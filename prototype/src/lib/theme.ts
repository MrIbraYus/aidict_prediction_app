import { useEffect, useState } from 'react'
import { useApp } from './store'

export function useResolvedTheme() {
  const theme = useApp((s) => s.theme)
  const [sys, setSys] = useState<'dark' | 'light'>(() => (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'))
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const h = () => setSys(mq.matches ? 'light' : 'dark')
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])
  return theme === 'system' ? sys : theme
}
