import type { Metadata, Viewport } from 'next'
import { Barlow_Semi_Condensed, Manrope } from 'next/font/google'
import './globals.css'
import { ThemeSync } from '@/components/layout/theme-toggle'

const manrope = Manrope({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-manrope', display: 'swap' })
const barlow = Barlow_Semi_Condensed({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-barlow', display: 'swap' })

export const metadata: Metadata = {
  title: { default: 'AIDICT', template: '%s · AIDICT' },
  description: 'Football intelligence: calibrated probabilities, transparent methodology and an immutable prediction record.',
  icons: { icon: '/brand/aidict-icon.png' },
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // App-like on phones: no zoom on tapping a field, no pinch/double-tap zoom.
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0f0d0d' },
    { media: '(prefers-color-scheme: light)', color: '#f5f2f1' },
  ],
}

// Applies the saved theme (dark / light / system) before the first paint — no flash, and a private attribute name
// so a host page can never override it.
const themeScript = `(function(){try{var c=localStorage.getItem('aidict.theme')||'dark';var d=c==='system'?!matchMedia('(prefers-color-scheme: light)').matches:c!=='light';document.documentElement.setAttribute('data-aidict-theme',d?'dark':'light')}catch(e){}})()`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${manrope.variable} ${barlow.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ThemeSync />
        {children}
      </body>
    </html>
  )
}
