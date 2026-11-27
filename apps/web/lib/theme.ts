'use client'
import { useCallback, useEffect, useState } from 'react'

export type ThemeChoice = 'dark' | 'light' | 'system'
const KEY = 'aidict.theme'
const EVENT = 'aidict-theme'
let memory: ThemeChoice | null = null // fallback when storage is blocked

function read(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'system' || v === 'dark' ? v : (memory ?? 'dark')
  } catch {
    return memory ?? 'dark'
  }
}

function resolve(choice: ThemeChoice): 'dark' | 'light' {
  if (choice !== 'system') return choice
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function apply(choice: ThemeChoice) {
  document.documentElement.setAttribute('data-aidict-theme', resolve(choice))
}

/**
 * Theme choice shared by every component on the page and every open tab: saved per device,
 * applied to <html data-aidict-theme>, and followed live when set to "system".
 */
export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>('dark')
  const [resolved, setResolved] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    const sync = () => {
      const c = read()
      apply(c)
      setChoice(c)
      setResolved(resolve(c))
    }
    sync()
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const onStorage = (e: StorageEvent) => e.key === KEY && sync()
    mq.addEventListener('change', sync)
    window.addEventListener(EVENT, sync)
    window.addEventListener('storage', onStorage)
    // Fallback for webviews that never fire matchMedia 'change': re-check when the app regains focus.
    const onVisible = () => document.visibilityState === 'visible' && sync()
    window.addEventListener('focus', sync)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      mq.removeEventListener('change', sync)
      window.removeEventListener(EVENT, sync)
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', sync)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  const set = useCallback((c: ThemeChoice) => {
    memory = c
    try {
      localStorage.setItem(KEY, c)
    } catch {
      /* storage unavailable: applies for this visit only */
    }
    apply(c)
    setChoice(c)
    setResolved(resolve(c))
    window.dispatchEvent(new Event(EVENT))
  }, [])

  return { choice, resolved, set }
}
