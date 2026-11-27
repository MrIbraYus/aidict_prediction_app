// Verifies theme switching: dark/light/system, persistence across reload, and live system changes.
import { chromium } from 'playwright-core'
const BASE = process.env.BASE_URL ?? 'http://localhost:5173/'
const browser = await chromium.launch({ channel: 'msedge' })
const ctx = await browser.newContext({ colorScheme: 'light', viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
const attr = () => page.evaluate(() => document.documentElement.getAttribute('data-aidict-theme'))
const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor)
let ok = true
const check = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); ok &&= c }
await page.goto(`${BASE}#/settings`); await page.waitForTimeout(1200)
check((await attr()) === 'dark', `default is dark (${await attr()}, body ${await bg()})`)
await page.getByRole('radio', { name: 'Light' }).click(); await page.waitForTimeout(300)
check((await attr()) === 'light', `Light applied (body ${await bg()})`)
await page.reload(); await page.waitForTimeout(1200)
check((await attr()) === 'light', 'Light remembered after reload')
await page.getByRole('radio', { name: 'System' }).click(); await page.waitForTimeout(300)
check((await attr()) === 'light', 'System follows device (light)')
await page.emulateMedia({ colorScheme: 'dark' }); await page.waitForTimeout(400)
check((await attr()) === 'dark', 'System switches live when the device turns dark')
await page.reload(); await page.waitForTimeout(1200)
check((await attr()) === 'dark', 'System remembered after reload (device dark)')
// Host page setting its own data-theme must not affect AIDICT
await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light')); await page.waitForTimeout(200)
check((await attr()) === 'dark' && (await bg()) === 'rgb(15, 13, 13)', 'host data-theme attribute no longer interferes')
await page.getByRole('radio', { name: 'Dark' }).click()
const toggle = page.getByRole('button', { name: /Change theme/ })
await toggle.click(); check((await attr()) === 'light', 'quick toggle: Dark → Light')
await toggle.click(); check((await toggle.innerText()).includes('System'), 'quick toggle: Light → System')
await toggle.click(); check((await attr()) === 'dark', 'quick toggle: System → Dark')
await browser.close()
process.exit(ok ? 0 : 1)
