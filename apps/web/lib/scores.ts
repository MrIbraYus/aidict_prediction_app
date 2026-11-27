/** Scorelines ordered from most to least likely (from the stored score matrix). Members see the order, never the numbers. */
export function topScores(matrix: number[][], n = 12): { key: string; h: number; a: number; p: number }[] {
  const all: { key: string; h: number; a: number; p: number }[] = []
  matrix.forEach((row, h) => row.forEach((p, a) => all.push({ key: `${h}-${a}`, h, a, p })))
  return all.sort((x, y) => y.p - x.p).slice(0, n)
}
