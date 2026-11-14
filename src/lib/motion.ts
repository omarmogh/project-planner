// Spring motion for the idea prototypes. Transform and opacity only (GPU-friendly).
// Springs are sampled once into a CSS linear() easing, so the browser runs them on the
// compositor like any other Web Animation. No animation library.

import { REDUCED_MOTION } from './useMedia'

/** Position of a damped spring at time t (0 → 1). ratio 1 = critically damped, < 1 overshoots a little. */
function springAt(t: number, w: number, ratio: number): number {
  if (ratio >= 1) return 1 - (1 + w * t) * Math.exp(-w * t)
  const wd = w * Math.sqrt(1 - ratio * ratio)
  return 1 - Math.exp(-ratio * w * t) * (Math.cos(wd * t) + ((ratio * w) / wd) * Math.sin(wd * t))
}

/**
 * A spring that settles in `ms` as a CSS easing. `bounce` 0 = critically damped (no overshoot);
 * 0.1 = a very slight overshoot. Falls back to a calm cubic-bezier where linear() isn't supported.
 */
export function spring(ms: number, bounce = 0): string {
  if (!supportsLinear()) return 'cubic-bezier(0.2, 0.8, 0.2, 1)'
  const ratio = 1 - bounce
  const T = ms / 1000
  // Settled = within 0.1% of the target at T.
  const w = ratio >= 1 ? 9.23 / T : 6.9 / (ratio * T)
  const n = 40
  const pts: string[] = []
  for (let i = 0; i <= n; i++) pts.push(i === n ? '1' : String(Math.round(springAt((i / n) * T, w, ratio) * 1e4) / 1e4))
  return `linear(${pts.join(', ')})`
}

let linearOk: boolean | undefined
function supportsLinear(): boolean {
  if (linearOk === undefined) {
    try {
      linearOk = typeof CSS !== 'undefined' && CSS.supports('transition-timing-function', 'linear(0, 1)')
    } catch {
      linearOk = false
    }
  }
  return linearOk
}

export const SPRING = {
  /** Presses, small things: 260 ms. */
  quick: { duration: 260, easing: '' },
  /** Cards and content: 360 ms, a hint of overshoot. */
  card: { duration: 360, easing: '' },
  /** Screen-sized moves (expand / collapse): 420 ms, no overshoot. */
  screen: { duration: 420, easing: '' },
}
// Built lazily (CSS.supports needs a browser).
export function springs() {
  if (!SPRING.quick.easing) {
    SPRING.quick.easing = spring(260)
    SPRING.card.easing = spring(360, 0.06)
    SPRING.screen.easing = spring(420)
  }
  return SPRING
}

/** Reduced motion: movement is replaced by short cross-fades. */
export const REDUCED_FADE = 150

export function prefersReduced(): boolean {
  try {
    return window.matchMedia(REDUCED_MOTION).matches
  } catch {
    return false
  }
}

/** Right-to-left: "forward" moves the other way. */
export function isRTL(el?: Element | null): boolean {
  return (el ? getComputedStyle(el).direction : document.documentElement.dir) === 'rtl'
}

/** Element.animate with fill 'both', or null when there's no element or no Web Animations. */
export function play(el: Element | null | undefined, frames: Keyframe[], opts: KeyframeAnimationOptions): Animation | null {
  if (!el || typeof (el as HTMLElement).animate !== 'function') return null
  return (el as HTMLElement).animate(frames, { fill: 'both', ...opts })
}

export const done = (a: Animation | null): Promise<void> => (a ? a.finished.then(() => undefined, () => undefined) : Promise.resolve())
