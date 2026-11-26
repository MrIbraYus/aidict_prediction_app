/**
 * Probability helpers used by the prototype to keep SAMPLE numbers internally consistent.
 * The production engine (Python, Dixon–Coles) replaces this at Stage 3 — the maths is the same idea:
 * every goal market is derived from ONE score matrix so markets never contradict each other.
 */

export type Matrix = number[][]

function poissonPmf(k: number, lambda: number) {
  let p = Math.exp(-lambda)
  for (let i = 1; i <= k; i++) p = (p * lambda) / i
  return p
}

/** Dixon–Coles low-score dependence adjustment τ. */
function tau(h: number, a: number, lh: number, la: number, rho: number) {
  if (h === 0 && a === 0) return 1 - lh * la * rho
  if (h === 0 && a === 1) return 1 + lh * rho
  if (h === 1 && a === 0) return 1 + la * rho
  if (h === 1 && a === 1) return 1 - rho
  return 1
}

export function scoreMatrix(lh: number, la: number, rho = -0.08, max = 10): Matrix {
  const m: Matrix = []
  let total = 0
  for (let h = 0; h <= max; h++) {
    m[h] = []
    for (let a = 0; a <= max; a++) {
      const p = poissonPmf(h, lh) * poissonPmf(a, la) * tau(h, a, lh, la, rho)
      m[h][a] = p
      total += p
    }
  }
  for (let h = 0; h <= max; h++) for (let a = 0; a <= max; a++) m[h][a] /= total
  return m
}

const sum = (m: Matrix, f: (h: number, a: number) => boolean) => {
  let s = 0
  for (let h = 0; h < m.length; h++) for (let a = 0; a < m[h].length; a++) if (f(h, a)) s += m[h][a]
  return s
}

export function oneXTwo(m: Matrix) {
  return { home: sum(m, (h, a) => h > a), draw: sum(m, (h, a) => h === a), away: sum(m, (h, a) => h < a) }
}
export const overLine = (m: Matrix, line: number) => sum(m, (h, a) => h + a > line)
export const btts = (m: Matrix) => sum(m, (h, a) => h > 0 && a > 0)
export const teamOver = (m: Matrix, side: 'home' | 'away', line: number) =>
  sum(m, (h, a) => (side === 'home' ? h : a) > line)

export function topScores(m: Matrix, n = 6) {
  const all: { h: number; a: number; p: number }[] = []
  for (let h = 0; h < m.length; h++) for (let a = 0; a < m[h].length; a++) all.push({ h, a, p: m[h][a] })
  return all.sort((x, y) => y.p - x.p).slice(0, n)
}

/** Asian handicap for the home side on a half-ball line (e.g. -0.5, -1.5). Returns P(win). */
export const asianHalf = (m: Matrix, line: number) => sum(m, (h, a) => h - a + line > 0)

/** Asian handicap on a whole line (e.g. -1): win / push / lose. */
export function asianWhole(m: Matrix, line: number) {
  return {
    win: sum(m, (h, a) => h - a + line > 0),
    push: sum(m, (h, a) => h - a + line === 0),
    lose: sum(m, (h, a) => h - a + line < 0),
  }
}

/** Exact distribution of the number of correct legs (Poisson-binomial). Legs assumed independent. */
export function poissonBinomial(ps: number[]) {
  let dist = [1]
  for (const p of ps) {
    const next = new Array(dist.length + 1).fill(0)
    dist.forEach((q, k) => {
      next[k] += q * (1 - p)
      next[k + 1] += q * p
    })
    dist = next
  }
  return dist
}

/** Deterministic PRNG so sample data is stable between reloads. */
export function rng(seed: number) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
