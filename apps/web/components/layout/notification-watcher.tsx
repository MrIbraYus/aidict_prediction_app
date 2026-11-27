'use client'
import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { unreadSummary } from '@/lib/actions'
import { toast } from '../ui/overlay'

const SOUND: Record<string, string> = { system: 'system-alert', prediction: 'new-prediction', kickoff: 'kickoff-soon', live: 'match-live', goal: 'goal', finished: 'match-finished', settled: 'prediction-settled' }

/** Polls the inbox while the tab is visible; on a new notification plays its sound (per Settings), shows a toast and refreshes badges. */
export function NotificationWatcher({ initial }: { initial: number }) {
  const router = useRouter()
  const last = useRef(initial)
  useEffect(() => {
    last.current = initial
  }, [initial])
  useEffect(() => {
    let stopped = false
    const tick = async () => {
      if (stopped || document.visibilityState !== 'visible') return
      try {
        const s = await unreadSummary()
        if (s.count > last.current && s.latest) {
          let pref = { on: true, volume: 0.7 }
          try {
            pref = { ...pref, ...JSON.parse(localStorage.getItem('aidict.sound') ?? '{}') }
          } catch {}
          if (pref.on) {
            const audio = new Audio(`/sounds/${SOUND[s.latest.category] ?? 'system-alert'}.wav`)
            audio.volume = pref.volume
            void audio.play().catch(() => undefined) // browsers may block sound until the page has been clicked once
          }
          toast({ title: s.latest.title, body: 'Open Notifications to read it.', tone: 'info' })
          router.refresh()
        }
        last.current = s.count
      } catch {
        /* offline or signed out: try again next tick */
      }
    }
    const t = setInterval(tick, 45_000)
    const onVisible = () => document.visibilityState === 'visible' && void tick()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stopped = true
      clearInterval(t)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [router])
  return null
}
