'use client'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme, type ThemeChoice } from '@/lib/theme'
import { cx } from '@/lib/format'

const NEXT: Record<ThemeChoice, ThemeChoice> = { dark: 'light', light: 'system', system: 'dark' }
const LABEL: Record<ThemeChoice, string> = { dark: 'Dark', light: 'Light', system: 'System' }

/** One-tap cycle Dark → Light → System; the icon shows the current choice. */
export function ThemeToggle({ className }: { className?: string }) {
  const { choice, set } = useTheme()
  const Icon = choice === 'light' ? Sun : choice === 'system' ? Monitor : Moon
  return (
    <button
      onClick={() => set(NEXT[choice])}
      aria-label={`Theme: ${LABEL[choice]}. Switch to ${LABEL[NEXT[choice]]}`}
      title={`Theme: ${LABEL[choice]} (click for ${LABEL[NEXT[choice]]})`}
      className={cx('relative inline-flex size-10 items-center justify-center rounded-full border border-line bg-surface-2 text-fg-2 transition-colors hover:border-line-strong hover:text-fg', className)}
    >
      <Icon className="size-[18px]" />
    </button>
  )
}

/** Explicit three-way picker for Settings. */
export function ThemePicker() {
  const { choice, resolved, set } = useTheme()
  const items: { value: ThemeChoice; label: string; icon: typeof Sun; hint: string }[] = [
    { value: 'dark', label: 'Dark', icon: Moon, hint: 'Default' },
    { value: 'light', label: 'Light', icon: Sun, hint: 'High daylight contrast' },
    { value: 'system', label: 'System', icon: Monitor, hint: `Follows your device (now ${resolved})` },
  ]
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Theme">
      {items.map((it) => {
        const on = choice === it.value
        const Icon = it.icon
        return (
          <button
            key={it.value}
            role="radio"
            aria-checked={on}
            onClick={() => set(it.value)}
            className={cx('flex items-center gap-3 rounded-xl border p-3 text-left transition-colors', on ? 'border-brand-fg bg-brand-soft' : 'border-line bg-surface-2 hover:border-line-strong')}
          >
            <Icon className={cx('size-5', on ? 'text-brand-fg' : 'text-fg-3')} />
            <span>
              <span className="block text-[13px] font-bold text-fg">{it.label}</span>
              <span className="block text-[11px] text-fg-3">{it.hint}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** Mounted once in the root layout: keeps the theme in sync with the device (System), other tabs and other toggles on every page. */
export function ThemeSync() {
  useTheme()
  return null
}
