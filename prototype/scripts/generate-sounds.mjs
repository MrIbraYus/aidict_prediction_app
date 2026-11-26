// Generates AIDICT's original notification sounds (additive synthesis → 16-bit mono WAV).
// No third-party audio is used, so the sounds are AIDICT's own (released CC0 inside this project).
// Output: public/sounds/*.wav  ·  Run: node scripts/generate-sounds.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SR = 44100
const OUT = resolve(process.cwd(), 'public', 'sounds')
mkdirSync(OUT, { recursive: true })

/** A struck tone: partials [ratio, gain, decaySeconds]. */
function note(buf, start, freq, { partials, attack = 0.004, gain = 1, length = 0.6 }) {
  const s0 = Math.round(start * SR)
  const n = Math.round(length * SR)
  for (let i = 0; i < n && s0 + i < buf.length; i++) {
    const t = i / SR
    const env = Math.min(1, t / attack)
    let v = 0
    for (const [ratio, g, decay] of partials) v += g * Math.exp(-t / decay) * Math.sin(2 * Math.PI * freq * ratio * t)
    buf[s0 + i] += v * env * gain
  }
}

const MARIMBA = [[1, 1, 0.22], [4, 0.18, 0.05], [10, 0.05, 0.02]]
const BELL = [[1, 1, 0.45], [2.0, 0.32, 0.25], [3.01, 0.16, 0.14], [4.2, 0.07, 0.08]]
const GLASS = [[1, 1, 0.3], [2.76, 0.25, 0.12], [5.4, 0.08, 0.05]]
const SOFT = [[1, 1, 0.35], [2, 0.18, 0.18], [3, 0.06, 0.1]]
const ALERT = [[1, 1, 0.28], [3, 0.22, 0.14], [5, 0.08, 0.08]]

const f = (name) => 440 * 2 ** ((name - 69) / 12) // MIDI → Hz

const SOUNDS = {
  // New prediction: two soft rising marimba notes (A5 → E6). Calm; off by default.
  'new-prediction': { len: 0.6, notes: [[0, f(81), MARIMBA, 0.8], [0.11, f(88), MARIMBA, 0.7]] },
  // Match starting soon: three ascending glass notes (G5 C6 E6).
  'kickoff-soon': { len: 0.85, notes: [[0, f(79), GLASS, 0.75], [0.13, f(84), GLASS, 0.75], [0.26, f(88), GLASS, 0.8]] },
  // Match going live: two quick bright taps (D6, D6).
  'match-live': { len: 0.55, notes: [[0, f(86), MARIMBA, 0.9], [0.14, f(86), MARIMBA, 0.75]] },
  // Goal: fast celebratory arpeggio C6 E6 G6 C7, last note rings.
  goal: { len: 1.05, notes: [[0, f(84), BELL, 0.55], [0.07, f(88), BELL, 0.55], [0.14, f(91), BELL, 0.6], [0.21, f(96), BELL, 0.7]] },
  // Match finished: resolving descent G5 → C5.
  'match-finished': { len: 0.9, notes: [[0, f(79), SOFT, 0.8], [0.18, f(72), SOFT, 0.85]] },
  // Prediction settled: single warm bell (E5) with a light fifth.
  'prediction-settled': { len: 0.95, notes: [[0, f(76), BELL, 0.85], [0.04, f(83), BELL, 0.25]] },
  // Important system notice: two mellow equal tones (A4, A4), lower and more serious.
  'system-alert': { len: 0.7, notes: [[0, f(69), ALERT, 0.8], [0.2, f(69), ALERT, 0.8]] },
}

function toWav(samples) {
  const data = Buffer.alloc(samples.length * 2)
  samples.forEach((v, i) => data.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(v * 32767))), i * 2))
  const h = Buffer.alloc(44)
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8)
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22)
  h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34)
  h.write('data', 36); h.writeUInt32LE(data.length, 40)
  return Buffer.concat([h, data])
}

const manifest = []
for (const [id, def] of Object.entries(SOUNDS)) {
  const buf = new Float64Array(Math.round(def.len * SR))
  for (const [t, hz, partials, g] of def.notes) note(buf, t, hz, { partials, gain: g, length: def.len - t })
  // Fade the tail to silence and normalise to −3 dBFS so every sound has the same peak loudness.
  const fade = Math.round(0.06 * SR)
  for (let i = 0; i < fade; i++) buf[buf.length - 1 - i] *= i / fade
  const peak = Math.max(...buf.map(Math.abs))
  const norm = 0.708 / peak
  const out = Array.from(buf, (v) => v * norm)
  const file = `${id}.wav`
  writeFileSync(resolve(OUT, file), toWav(out))
  manifest.push({ id, file, durationMs: Math.round(def.len * 1000), peakDbfs: -3, licence: 'Original — generated for AIDICT (CC0)' })
}
writeFileSync(resolve(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2))
console.log(manifest.map((m) => `${m.file} ${m.durationMs}ms`).join('\n'))
