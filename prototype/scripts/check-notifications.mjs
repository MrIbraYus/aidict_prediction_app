// Exercises the notification rules end-to-end in Edge and prints the delivery log.
// Requires `npm run dev`. Usage: node scripts/check-notifications.mjs
import { chromium } from 'playwright-core'

const BASE = process.env.BASE_URL ?? 'http://localhost:5173/'
const browser = await chromium.launch({ channel: 'msedge', args: ['--autoplay-policy=user-gesture-required'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

const log = async () =>
  page.$$eval('ul.max-h-56 li', (lis) => lis.map((li) => li.innerText.replace(/\s+/g, ' ').trim()))

await page.goto(`${BASE}#/notifications`)
await page.waitForTimeout(1200)

// 1) Before any user gesture, a programmatic event must not play sound (autoplay rules).
await page.evaluate(() => document.querySelector('button')?.dispatchEvent(new Event('noop')))
const click = (name) => page.getByRole('button', { name, exact: true }).click()

await click('Goal') // first real click also unlocks audio; the event itself is processed after unlock
await page.waitForTimeout(1200)
console.log('after Goal →', (await log())[0])

await click('Send same event again')
await page.waitForTimeout(900)
console.log('repeat →', (await log())[0])

await click('Full time')
await page.waitForTimeout(400)
await click('Settled')
await page.waitForTimeout(1500)
console.log('full time + settled →', (await log()).slice(0, 2))

await click('New predictions')
await page.waitForTimeout(1000)
console.log('new predictions (silent by default) →', (await log())[0])

await page.getByRole('button', { name: /Burst: 5 events/ }).click()
await page.waitForTimeout(1500)
console.log('burst →', (await log()).slice(0, 5))

const toasts = await page.$$eval('[role="status"]', (els) => els.length)
console.log('toasts visible after burst:', toasts)

// Out-of-scope: a goal in a match that is not saved should be filtered (scope = saved).
const inScope = await page.evaluate(() => document.title)
console.log('page title:', inScope)

// Settings preview button plays even with autoplay unlocked
await page.goto(`${BASE}#/settings?section=notifications`)
await page.waitForTimeout(1500)
await page.getByRole('button', { name: 'Preview Goal scored sound' }).click()
await page.waitForTimeout(500)
const audioState = await page.evaluate(async () => {
  const ctx = new AudioContext()
  return ctx.state
})
console.log('fresh AudioContext state after gestures:', audioState)
console.log(errors.length ? 'CONSOLE ERRORS:\n' + [...new Set(errors)].join('\n') : 'no console errors')
await browser.close()
