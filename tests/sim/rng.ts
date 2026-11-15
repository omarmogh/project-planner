/** Seeded randomness (mulberry32): the same seed always gives the same simulated weeks. */
export type Rng = () => number

export function rng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Roughly normal around `mean` (sum of three uniforms), clamped. */
export function around(r: Rng, mean: number, spread: number, lo = 0, hi = 100): number {
  const x = mean + (r() + r() + r() - 1.5) * spread * 1.4
  return Math.max(lo, Math.min(hi, x))
}
