// Captures every prototype screen at desktop and phone sizes into documentation/prototype-screenshots/.
// Uses the system Microsoft Edge via playwright-core (no browser download). Requires `npm run dev` running.
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const BASE = process.env.BASE_URL ?? 'http://localhost:5173/'
const OUT = resolve(process.cwd(), '..', 'documentation', 'prototype-screenshots')
mkdirSync(OUT, { recursive: true })

const SCREENS = [
  ['01-login', 'login'],
  ['02-dashboard', ''],
  ['03-sports', 'sports'],
  ['04-competitions', 'competitions'],
  ['04b-competition-table', 'competitions/pl'],
  ['05-upcoming-matches', 'matches'],
  ['06-live', 'live'],
  ['07-match-overview', 'match/m-pl-ars-che'],
  ['08-match-statistics', 'match/m-pl-ars-che/stats'],
  ['09-prediction-details', 'match/m-pl-ars-che/prediction'],
  ['09b-match-lineups', 'match/m-pl-ars-che/lineups'],
  ['09c-match-h2h', 'match/m-pl-ars-che/h2h'],
  ['09d-match-data-model', 'match/m-sa-juv-rom/data'],
  ['10-smart-predictions', 'smart'],
  ['10b-smart-market-predictions', 'markets'],
  ['09e-all-markets-arsenal-chelsea', 'match/m-pl-ars-che/markets'],
  ['09f-all-markets-bayern-frankfurt', 'match/m-bl1-bay-sge/markets'],
  ['11-multi-match', 'multi'],
  ['12-team', 'team/ars'],
  ['13-player', 'player/saka'],
  ['14-history', 'history'],
  ['15-performance', 'performance'],
  ['16-saved', 'saved'],
  ['17-notifications', 'notifications'],
  ['18-profile', 'profile'],
  ['19-settings', 'settings'],
  ['20-data-status', 'providers'],
  ['21-responsible-use', 'responsible'],
  ['22-about', 'about'],
  ['23-admin-health', 'admin'],
  ['23b-admin-providers', 'admin/providers'],
  ['23c-admin-models', 'admin/models'],
  ['23d-admin-quality', 'admin/quality'],
  ['23e-admin-badges', 'admin/badges'],
  ['23f-admin-markets', 'admin/markets'],
  ['04c-world-cup-national-teams', 'competitions/wc'],
  ['12b-national-team', 'team/eng'],
  ['24-design-system', 'design'],
]

const VIEWPORTS = [
  ['desktop', { width: 1440, height: 900 }, false],
  ['mobile', { width: 390, height: 844 }, true],
]

const only = process.argv[2]
const browser = await chromium.launch({ channel: 'msedge' })
for (const [label, viewport, isMobile] of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: isMobile ? 2 : 1, isMobile, hasTouch: isMobile, colorScheme: 'dark' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  for (const [name, route] of SCREENS) {
    if (only && !name.includes(only)) continue
    await page.goto(`${BASE}#/${route}`)
    await page.waitForTimeout(1200)
    // Trigger lazy-loaded badges, then wait until every image has finished loading.
    await page.evaluate(async () => {
      const inView = () => [...document.images].filter((i) => { const r = i.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && i.offsetParent !== null })
      for (let y = 0; y < document.body.scrollHeight; y += Math.round(innerHeight * 0.8)) {
        window.scrollTo(0, y)
        const t0 = Date.now()
        while (Date.now() - t0 < 4000 && inView().some((i) => !i.complete)) await new Promise((r) => setTimeout(r, 100))
      }
      window.scrollTo(0, 0)
    })
    await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 15000 }).catch(() => console.log(`  ⚠ ${label}/${name}: images still loading`))
    await page.waitForTimeout(1800)
    const broken = await page.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src))
    if (broken.length) console.log(`  ⚠ ${label}/${name}: broken images`, broken)
    await page.screenshot({ path: resolve(OUT, `${label}-${name}.png`), fullPage: true })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    if (overflow > 1) console.log(`  ⚠ ${label}/${name}: horizontal overflow ${overflow}px`)
  }
  // Interaction shots (viewport only): search results, bell menu, notification toasts.
  if (!only || only === 'interact') {
    await page.goto(`${BASE}#/`)
    await page.waitForTimeout(1500)
    if (!isMobile) {
      await page.getByRole('combobox', { name: 'Search' }).first().fill('real')
      await page.waitForTimeout(1200)
      await page.screenshot({ path: resolve(OUT, `${label}-30-search-results.png`) })
      await page.keyboard.press('Escape')
      await page.getByRole('button', { name: /^Notifications/ }).click()
      await page.waitForTimeout(1200)
      await page.screenshot({ path: resolve(OUT, `${label}-31-bell-menu.png`) })
    } else {
      await page.getByRole('button', { name: 'Search', exact: true }).click()
      await page.waitForTimeout(400)
      await page.getByRole('combobox', { name: 'Search' }).last().fill('real')
      await page.waitForTimeout(1200)
      await page.screenshot({ path: resolve(OUT, `${label}-30-search-results.png`) })
    }
    // Smart Markets: open the full statistical explanation of the first pick.
    await page.goto(`${BASE}#/markets`)
    await page.waitForTimeout(1800)
    if (!isMobile) await page.getByRole('button', { name: 'Explain' }).first().click()
    else await page.locator('article ul button').first().click()
    await page.waitForTimeout(1500)
    await page.screenshot({ path: resolve(OUT, `${label}-33-pick-explanation.png`) })
    await page.keyboard.press('Escape')
    // Performance → Markets tab
    await page.goto(`${BASE}#/performance`)
    await page.waitForTimeout(1500)
    await page.getByRole('radio', { name: 'Markets (24)' }).click()
    await page.waitForTimeout(2500)
    await page.screenshot({ path: resolve(OUT, `${label}-34-performance-markets.png`), fullPage: true })
    await page.goto(`${BASE}#/notifications`)
    await page.waitForTimeout(1200)
    await page.getByRole('button', { name: 'Goal', exact: true }).click()
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: 'Starting soon', exact: true }).click()
    await page.waitForTimeout(1400)
    await page.screenshot({ path: resolve(OUT, `${label}-32-notification-toasts.png`) })
  }
  if (errors.length) console.log(`  ⚠ ${label}: console errors\n   ` + [...new Set(errors)].join('\n   '))
  await ctx.close()
  console.log(`✓ ${label} done`)
}
await browser.close()
console.log(`Saved to ${OUT}`)
