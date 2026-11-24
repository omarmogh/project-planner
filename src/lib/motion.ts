// Spring motion for the idea prototypes. Transform and opacity only (GPU-friendly).
// Springs are sampled once into a CSS linear() easing, so the browser runs them on the
// compositor like any other Web Animation. No animation library.

import { flushSync } from 'react-dom'
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

// ── Screen transitions ────────────────────────────────────────────────────────
// Screens change through the View Transitions API: the browser snapshots the old
// screen, React renders the new one, and CSS (index.css, "View transitions") moves
// between them on the compositor. Named elements (the Start button and the timer,
// the sidebar's active tab) morph from one place to the other instead of cutting.
//
// Not animated (ui-animation rules): actions started from the keyboard, reduced
// motion, a hidden tab, or browsers without the API. Those update at once.

/** forward/back = between tabs (direction follows tab order, mirrored in RTL);
 *  open/close = Start ↔ timer; up = a result slides in; down = back to Today; fade = cross-fade. */
export type VTKind = 'forward' | 'back' | 'open' | 'close' | 'up' | 'down' | 'fade'

let viaKeyboard = false
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', () => { viaKeyboard = true }, true)
  window.addEventListener('pointerdown', () => { viaKeyboard = false }, true)
}
/** True when the last input was a key press (shortcuts and Enter/Space on a button). */
export const lastInputWasKeyboard = () => viaKeyboard

type Doc = Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } }

export function canAnimate(): boolean {
  return !viaKeyboard && !prefersReduced() && document.visibilityState === 'visible'
}

/** Run a state update as a View Transition of the given kind (or at once when it shouldn't animate). */
export function transition(update: () => void, kind: VTKind = 'fade') {
  const d = document as Doc
  if (!d.startViewTransition || !canAnimate()) { update(); return }
  const root = document.documentElement
  root.dataset.vt = kind
  try {
    const vt = d.startViewTransition(() => flushSync(update))
    vt.finished.finally(() => { if (root.dataset.vt === kind) delete root.dataset.vt })
  } catch {
    delete root.dataset.vt
    update()
  }
}
