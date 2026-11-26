// Prints the Smart Market picks and sanity checks for every upcoming match (uses the dev server's module graph).
import { chromium } from 'playwright-core'
const browser = await chromium.launch({ channel: 'msedge' })
const page = await browser.newPage()
await page.goto('http://localhost:5173/')
const out = await page.evaluate(async () => {
  const mk = await import('/src/lib/markets.ts')
  const mm = await import('/src/mock/matches.ts')
  const rows = []
  for (const m of mm.MATCHES.filter((x) => x.status === 'SCHEDULED')) {
    const ev = mk.evaluateMatch(m)
    const r = mk.smartPicks(m)
    // sanity: outcomes of exhaustive markets sum to 1
    const sums = ev.filter((e) => ['dc'].indexOf(e.def.id) < 0 && e.outcomes.length && ['first-goal', 'corners-1x2', 'handicap', 'dc'].includes(e.def.id)).map((e) => `${e.def.id}:${(e.def.id === 'handicap' ? e.outcomes.slice(0, 3) : e.outcomes).reduce((s, o) => s + o.p, 0).toFixed(3)}`)
    rows.push({ id: m.id, status: ev.reduce((a, e) => ((a[e.status] = (a[e.status] || 0) + 1), a), {}), picks: r.picks.map((p) => `${p.market.def.name} | ${p.outcome.label} ${(p.outcome.p * 100).toFixed(0)}% (base ${(p.outcome.base * 100).toFixed(0)}) rel ${(p.market.reliability * 100).toFixed(0)} ${p.confidence}`), shortfall: r.shortfall, sums, excl: r.exclusions.slice(0, 2).map((x) => `${x.label} ${(x.p * 100).toFixed(0)}%: ${x.reason.slice(0, 70)}`) })
  }
  return rows
})
for (const r of out) console.log(JSON.stringify(r, null, 1))
await browser.close()
