// Recall Sweep (idea prototype, behind ?idea=1).
// Full-screen, tap-only: a title, a few seconds to think of 3 key points, then Had it / Fuzzy / Blank.
// Motion: springs on transform + opacity only. The Today row expands into this screen and the
// screen collapses back into the row. Reduced motion: 150 ms cross-fades instead of movement.

import { X } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { daysBetween, sweepOutcome, toDate, type ISODate, type Recall, type SweepItem } from '../engine'
import { REDUCED_FADE, done, isRTL, play, prefersReduced, springs } from '../lib/motion'
import { Button } from '../ui/Button'

/** How long the think step waits before the options appear. */
const THINK_MS = 4000

const OPTIONS: { r: Recall; label: string; tint: string }[] = [
  { r: 'had', label: 'Had it', tint: 'var(--good)' },
  { r: 'fuzzy', label: 'Fuzzy', tint: 'var(--warn)' },
  { r: 'blank', label: 'Blank', tint: 'var(--weak)' },
]

export interface SweepOrigin {
  /** The Today row the sweep expands from and collapses into. */
  row: HTMLElement
  /** The row's title; it morphs into the header title. */
  title: HTMLElement
}

export function RecallSweep({
  title, items, ratings: saved, today, origin, onRate, onClose,
}: {
  title: string
  items: SweepItem[]
  ratings: Record<string, Recall>
  today: ISODate
  origin: SweepOrigin
  onRate: (id: string, r: Recall) => void
  /** After the collapse finished. `completed` = every title rated. */
  onClose: (completed: boolean) => void
}) {
  const n = items.length
  const [index, setIndex] = useState(() => {
    const i = items.findIndex((it) => !saved[it.id])
    return i < 0 ? n : i
  })
  const [thinking, setThinking] = useState(true)
  // Ratings show at once; they are saved a moment later, once the next card has settled. Saving
  // re-renders Today underneath, and on a slow phone that work must not land inside a transition.
  const [local, setLocal] = useState<Record<string, Recall>>({})
  const ratings = { ...saved, ...local }
  const unsaved = useRef(new Map<string, Recall>())
  const saveTimer = useRef(0)
  const save = useCallback(() => {
    window.clearTimeout(saveTimer.current)
    unsaved.current.forEach((r, id) => onRate(id, r))
    unsaved.current.clear()
  }, [onRate])
  useEffect(() => save, [save])
  const summary = index >= n

  const layer = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const tint = useRef<HTMLDivElement>(null)
  const headerTitle = useRef<HTMLHeadingElement>(null)
  const chrome = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const line = useRef<HTMLDivElement>(null)
  const lineAnim = useRef<Animation | null>(null)
  const actions = useRef<HTMLDivElement>(null)
  const showOptions = useRef<HTMLButtonElement>(null)
  const ghosts = useRef<HTMLDivElement>(null)
  const closeBtn = useRef<HTMLButtonElement>(null)
  const bgAnims = useRef<Animation[]>([])
  const busy = useRef(false)
  const opened = useRef(false)

  const reduced = prefersReduced()
  const dir = isRTL(origin.row) ? -1 : 1

  // ── Open: the row expands into the screen ─────────────────────────────
  const expanded = useRef(false)
  useLayoutEffect(() => {
    // Once only (StrictMode re-runs effects; a second pass would measure the already-moved title).
    if (expanded.current) return
    expanded.current = true
    const S = springs()
    origin.title.style.opacity = '0'
    closeBtn.current?.focus({ preventScroll: true })
    if (reduced) {
      play(layer.current, [{ opacity: 0 }, { opacity: 1 }], { duration: REDUCED_FADE, easing: 'linear' })
      return
    }
    const r = origin.row.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    play(panel.current, [
      { transform: `translate(${r.left}px, ${r.top}px) scale(${r.width / vw}, ${r.height / vh})` },
      { transform: 'none' },
    ], { duration: S.screen.duration, easing: S.screen.easing })
    // A soft tint makes the moving shape legible; it's gone at both ends, so the row and the page look like themselves.
    play(tint.current, [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 0 }], { duration: S.screen.duration, easing: 'linear' })

    const t = origin.title.getBoundingClientRect()
    const f = headerTitle.current!.getBoundingClientRect()
    play(headerTitle.current, [{ transform: `translate(${t.left - f.left}px, ${t.top - f.top}px)` }, { transform: 'none' }], {
      duration: S.screen.duration, easing: S.screen.easing,
    })
    play(chrome.current, [{ opacity: 0 }, { opacity: 1 }], { duration: 240, delay: 220, easing: 'ease-out' })

    // Background content recedes: fades and scales to 0.98.
    const bg = origin.row.closest('main')?.parentElement
    if (bg) {
      ;(bg as HTMLElement).style.transformOrigin = `50% ${window.scrollY + vh / 2 - (bg.getBoundingClientRect().top + window.scrollY)}px`
      const a = play(bg, [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.98)' }], {
        duration: S.screen.duration, easing: S.screen.easing,
      })
      if (a) bgAnims.current.push(a)
    }
    document.querySelectorAll('nav').forEach((nav) => {
      const a = play(nav, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease-out' })
      if (a) bgAnims.current.push(a)
    })
  }, [])

  // ── A card arrives ─────────────────────────────────────────────────────
  useLayoutEffect(() => {
    if (summary) return
    const S = springs()
    const first = !opened.current
    opened.current = true
    const c = card.current
    if (!c) return
    if (reduced) {
      play(c, [{ opacity: 0 }, { opacity: 1 }], { duration: REDUCED_FADE, easing: 'linear', delay: first ? REDUCED_FADE : 0 })
    } else if (first) {
      // Title fades in and rises 8px; the hint follows.
      const [label, h, hint, track] = Array.from(c.children)
      play(label, [{ opacity: 0, transform: 'translateY(0.5rem)' }, { opacity: 1, transform: 'none' }], { duration: S.card.duration, easing: S.card.easing, delay: 200 })
      play(h, [{ opacity: 0, transform: 'translateY(0.5rem)' }, { opacity: 1, transform: 'none' }], { duration: S.card.duration, easing: S.card.easing, delay: 230 })
      play(hint, [{ opacity: 0, transform: 'translateY(0.5rem)' }, { opacity: 1, transform: 'none' }], { duration: S.card.duration, easing: S.card.easing, delay: 300 })
      play(track, [{ opacity: 0 }, { opacity: 1 }], { duration: 240, delay: 360, easing: 'ease-out' })
    } else {
      // From the right (the left in RTL), with a little depth.
      play(c, [
        { opacity: 0, transform: `translateX(${2.5 * dir}rem) scale(0.98)` },
        { opacity: 1, transform: 'none' },
      ], { duration: S.card.duration, easing: S.card.easing, delay: 120 })
    }
    if (!first) play(showOptions.current, [{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay: 200, easing: 'ease-out' })

    // Think step: a thin line fills calmly, then the options come.
    const l = line.current
    if (!l) return
    l.style.transform = 'scaleX(0)'
    const a = play(l, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], {
      duration: THINK_MS, delay: first ? 450 : 300, easing: 'cubic-bezier(0.45, 0, 0.55, 1)',
    })
    lineAnim.current = a
    let live = true
    const reveal = () => {
      if (!live) return
      l.style.transform = 'scaleX(1)'
      setThinking(false)
    }
    if (a) a.finished.then(reveal, () => undefined)
    else reveal()
    return () => {
      live = false
      a?.cancel()
    }
  }, [index])

  // ── Options rise in, staggered ─────────────────────────────────────────
  useLayoutEffect(() => {
    if (thinking || summary) return
    const S = springs()
    play(showOptions.current, [{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: 'ease-out' })
    const buttons = actions.current?.querySelectorAll('[data-option]') ?? []
    buttons.forEach((b, i) => {
      if (reduced) play(b, [{ opacity: 0 }, { opacity: 1 }], { duration: REDUCED_FADE, easing: 'linear' })
      else play(b, [{ opacity: 0, transform: 'translateY(0.75rem)' }, { opacity: 1, transform: 'none' }], { duration: S.card.duration, easing: S.card.easing, delay: i * 40 })
    })
    ;(buttons[0] as HTMLElement | undefined)?.focus({ preventScroll: true })
  }, [thinking, summary, reduced])

  const skipThinking = () => {
    const a = lineAnim.current
    if (a && a.playState !== 'finished') a.updatePlaybackRate(14)
  }

  // ── Rating: press, fill, the card leaves, the next one comes ───────────
  const rate = (r: Recall) => {
    if (busy.current || summary) return
    busy.current = true
    const item = items[index]
    const S = springs()
    const btn = actions.current?.querySelector<HTMLElement>(`[data-option="${r}"]`)
    const fill = btn?.querySelector<HTMLElement>('[data-fill]')
    if (fill) {
      fill.style.opacity = '1'
      play(fill, [{ opacity: 0 }, { opacity: 1 }], { duration: reduced ? REDUCED_FADE : 160, easing: 'ease-out' })
    }
    if (btn && !reduced) {
      play(btn, [{ transform: 'scale(0.97)' }, { transform: 'none' }], { duration: S.quick.duration, easing: S.quick.easing })
    }
    unsaved.current.set(item.id, r)
    setLocal((l) => ({ ...l, [item.id]: r }))
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(save, 900)

    window.setTimeout(() => {
      // The leaving card and options are copies, so the next card can arrive while they leave.
      const g = ghosts.current
      const exit = (el: HTMLElement | null, frames: Keyframe[], ms: number, easing: string) => {
        if (!el || !g) return
        const copy = el.cloneNode(true) as HTMLElement
        copy.removeAttribute('id')
        copy.setAttribute('aria-hidden', 'true')
        const rect = el.getBoundingClientRect()
        const host = g.getBoundingClientRect()
        Object.assign(copy.style, {
          position: 'absolute', left: `${rect.left - host.left}px`, top: `${rect.top - host.top}px`, width: `${rect.width}px`, margin: '0', pointerEvents: 'none',
        })
        g.appendChild(copy)
        done(play(copy, frames, { duration: ms, easing })).then(() => copy.remove())
      }
      if (reduced) {
        exit(card.current, [{ opacity: 1 }, { opacity: 0 }], REDUCED_FADE, 'linear')
      } else if (r === 'had') {
        exit(card.current, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-2rem)' }], 300, S.quick.easing)
      } else {
        exit(card.current, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-2.5 * dir}rem)` }], 300, S.quick.easing)
      }
      exit(actions.current, [{ opacity: 1 }, { opacity: 0 }], reduced ? REDUCED_FADE : 180, 'ease-out')
      setThinking(true)
      setIndex((i) => i + 1)
      busy.current = false
    }, reduced ? 120 : 200)
  }

  // ── Close: the screen collapses back into the row ──────────────────────
  const closing = useRef(false)
  const close = useCallback(async () => {
    if (closing.current) return
    closing.current = true
    const completed = items.every((it) => ratings[it.id])
    const S = springs()
    const finish = () => {
      save()
      bgAnims.current.forEach((a) => a.cancel())
      origin.title.style.opacity = ''
      onClose(completed)
    }
    if (reduced) {
      await done(play(layer.current, [{ opacity: 1 }, { opacity: 0 }], { duration: REDUCED_FADE, easing: 'linear' }))
      finish()
      return
    }
    lineAnim.current?.pause()
    // Content clears first, then the surface shrinks: the summary never overlaps the page coming back.
    play(body.current, [{ opacity: 1 }, { opacity: 0 }], { duration: 100, easing: 'ease-out' })
    play(chrome.current, [{ opacity: 1 }, { opacity: 0 }], { duration: 100, easing: 'ease-out' })
    const lag = 70
    if (ghosts.current) ghosts.current.replaceChildren()

    // Measure the row where it will land: without the receding scale.
    bgAnims.current.forEach((a) => a.cancel())
    bgAnims.current = []
    const r = origin.row.getBoundingClientRect()
    const t = origin.title.getBoundingClientRect()
    const f = headerTitle.current!.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const bg = origin.row.closest('main')?.parentElement
    if (bg) {
      const a = play(bg, [{ opacity: 0, transform: 'scale(0.98)' }, { opacity: 1, transform: 'scale(1)' }], { duration: S.screen.duration, easing: S.screen.easing, delay: lag })
      if (a) bgAnims.current.push(a)
    }
    document.querySelectorAll('nav').forEach((nav) => {
      const a = play(nav, [{ opacity: 0 }, { opacity: 1 }], { duration: 260, delay: 120 + lag, easing: 'ease-out' })
      if (a) bgAnims.current.push(a)
    })
    play(tint.current, [{ opacity: 0 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }], { duration: S.screen.duration, easing: 'linear', delay: lag })
    play(headerTitle.current, [{ transform: 'none' }, { transform: `translate(${t.left - f.left}px, ${t.top - f.top}px)` }], {
      duration: S.screen.duration, easing: S.screen.easing, delay: lag,
    })
    await done(play(panel.current, [
      { transform: 'none' },
      { transform: `translate(${r.left}px, ${r.top}px) scale(${r.width / vw}, ${r.height / vh})` },
    ], { duration: S.screen.duration, easing: S.screen.easing, delay: lag }))
    // Hand over to the real row: a short cross-fade (the row may now show a check).
    origin.title.style.opacity = ''
    await done(play(layer.current, [{ opacity: 1 }, { opacity: 0 }], { duration: 140, easing: 'ease-out' }))
    finish()
  }, [items, ratings, origin, onClose, reduced, save])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  const item = items[Math.min(index, n - 1)]

  return (
    <div ref={layer} className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={title}>
      {/* The expanding surface: starts as the row (tinted like a pressed row), ends as the page. */}
      <div ref={panel} className="absolute inset-0 origin-top-left overflow-hidden bg-bg" aria-hidden>
        <div ref={tint} className="absolute inset-0 bg-surface opacity-0" />
      </div>

      <div className="relative mx-auto flex h-dvh w-full max-w-phone flex-col tablet:max-w-tablet">
        <header className="relative flex h-14 shrink-0 items-center justify-center px-14">
          <h2 ref={headerTitle} className="truncate text-body leading-snug font-medium">{title}</h2>
          <div ref={chrome} className="absolute inset-x-2 inset-y-0 flex items-center justify-between">
            <button
              ref={closeBtn}
              type="button"
              onClick={close}
              aria-label="Close. Your ratings are kept."
              className="flex size-11 items-center justify-center rounded-full text-muted hover:opacity-70 active:opacity-60"
            >
              <X className="size-icon-lg" aria-hidden />
            </button>
            <span className={`pe-3 text-callout text-muted transition-opacity ${summary ? 'opacity-0' : ''}`} aria-live="polite">
              <Roll value={Math.min(index + 1, n)} reduced={reduced} /> of <span className="tnum">{n}</span>
            </span>
          </div>
        </header>

        <div ref={body} className="relative flex min-h-0 flex-1 flex-col px-5 pb-safe-4 tablet:px-8">
          <div ref={ghosts} className="pointer-events-none absolute inset-0" aria-hidden />

          {!summary ? (
            <>
              <div className="relative flex-1 pt-[14dvh]">
                <div ref={card} key={index}>
                  <p className="text-callout font-medium text-muted">{item.label}</p>
                  <h3 className="mt-2 text-title-1 leading-tight font-semibold tracking-display">{item.title}</h3>
                  <p className="mt-3 text-body-sm text-muted">Think of 3 key points</p>
                  <div className="mt-8 h-0.5 overflow-hidden rounded-full bg-line" aria-hidden>
                    <div ref={line} className="h-full origin-left bg-accent rtl:origin-right" style={{ transform: 'scaleX(0)' }} />
                  </div>
                </div>
              </div>

              {/* Fixed height: nothing above moves when the options appear. */}
              <div ref={actions} className="relative h-[10.75rem] shrink-0">
                {thinking ? null : (
                  <div className="flex flex-col gap-2">
                    {OPTIONS.map((o) => (
                      <button
                        key={o.r}
                        type="button"
                        data-option={o.r}
                        onClick={() => rate(o.r)}
                        className="relative flex min-h-13 w-full items-center justify-center overflow-hidden rounded-lg bg-surface text-body font-medium"
                      >
                        <span data-fill className="absolute inset-0 opacity-0" style={{ background: `color-mix(in srgb, ${o.tint} 24%, var(--surface))` }} aria-hidden />
                        <span className="relative">{o.label}</span>
                      </button>
                    ))}
                  </div>
                )}
                <button
                  ref={showOptions}
                  type="button"
                  onClick={skipThinking}
                  tabIndex={thinking ? 0 : -1}
                  aria-hidden={!thinking}
                  className={`absolute inset-x-0 bottom-0 flex min-h-13 items-center justify-center text-body font-medium text-accent hover:opacity-70 active:opacity-60 ${thinking ? '' : 'pointer-events-none opacity-0'}`}
                >
                  Show options
                </button>
              </div>
            </>
          ) : (
            <Summary items={items} ratings={ratings} today={today} reduced={reduced} onDone={close} />
          )}
        </div>
      </div>
    </div>
  )
}

/** "Added to your week": what the ratings added, staggered in. One button. */
function Summary({ items, ratings, today, reduced, onDone }: {
  items: SweepItem[]; ratings: Record<string, Recall>; today: ISODate; reduced: boolean; onDone: () => void
}) {
  const o = sweepOutcome(items, ratings, today)
  const list = useRef<HTMLDivElement>(null)
  const action = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const S = springs()
    const parts = [...Array.from(list.current?.querySelectorAll('[data-stagger]') ?? []), action.current]
    parts.forEach((el, i) => {
      if (reduced) play(el, [{ opacity: 0 }, { opacity: 1 }], { duration: REDUCED_FADE, easing: 'linear', delay: 60 })
      else play(el, [{ opacity: 0, transform: 'translateY(0.5rem)' }, { opacity: 1, transform: 'none' }], { duration: S.card.duration, easing: S.card.easing, delay: 160 + i * 50 })
    })
    action.current?.querySelector('button')?.focus({ preventScroll: true })
  }, [reduced])

  const soon = o.resweep.filter((x) => ratings[x.item.id] !== 'had')
  const had = items.filter((it) => ratings[it.id] === 'had')
  const soonDay = soon[0] ? weekdayName(soon[0].date) : ''

  return (
    <>
      <div ref={list} className="flex-1 overflow-y-auto pt-[8dvh]">
        <h3 data-stagger className="text-title-1 leading-tight font-semibold tracking-display">{o.tasks.length ? 'Added to your week' : 'Nothing to add'}</h3>
        {o.tasks.length === 0 && <p data-stagger className="mt-2 text-body-sm text-muted">Everything felt solid.</p>}
        {o.tasks.length > 0 && (
          <ul className="mt-5 divide-y divide-line border-y border-line">
            {o.tasks.map((t) => (
              <li key={t.id} data-stagger className="flex items-start justify-between gap-3 py-3.5">
                <span className="min-w-0">
                  <span className="block text-body leading-snug font-medium">{t.title}</span>
                  <span className="mt-0.5 block text-subhead text-muted">{t.reason}</span>
                </span>
                <span className="tnum shrink-0 pt-0.5 text-callout text-muted">{dayLabel(today, t.date)} · {t.minutes} min</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-5 space-y-2 text-subhead leading-snug text-muted">
          {soon.length > 0 && <p data-stagger>Back in {soonDay}'s sweep: {soon.map((x) => x.item.title).join(', ')}.</p>}
          {had.length > 0 && <p data-stagger>Had it: {had.map((x) => x.title).join(', ')}. Your question blocks will spot-check {had.length === 1 ? 'it' : 'them'}.</p>}
        </div>
      </div>
      <div ref={action} className="shrink-0 pt-3">
        <Button onClick={onDone}>Done</Button>
      </div>
    </>
  )
}

function weekdayName(iso: ISODate): string {
  return toDate(iso).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' })
}

function dayLabel(today: ISODate, iso: ISODate): string {
  return daysBetween(today, iso) === 1 ? 'Tomorrow' : toDate(iso).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })
}

/** A number that rolls vertically when it changes (cross-fades under reduced motion). */
function Roll({ value, reduced }: { value: number; reduced: boolean }) {
  const box = useRef<HTMLSpanElement>(null)
  const cur = useRef<HTMLSpanElement>(null)
  const prev = useRef(value)
  useLayoutEffect(() => {
    if (prev.current === value || !box.current || !cur.current) {
      prev.current = value
      return
    }
    const S = springs()
    const old = cur.current.cloneNode(true) as HTMLSpanElement
    old.textContent = String(prev.current)
    old.style.position = 'absolute'
    old.style.insetInlineStart = '0'
    old.style.top = '0'
    box.current.appendChild(old)
    prev.current = value
    if (reduced) {
      done(play(old, [{ opacity: 1 }, { opacity: 0 }], { duration: REDUCED_FADE, easing: 'linear' })).then(() => old.remove())
      play(cur.current, [{ opacity: 0 }, { opacity: 1 }], { duration: REDUCED_FADE, easing: 'linear' })
      return
    }
    done(play(old, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-70%)' }], { duration: 300, easing: S.quick.easing })).then(() => old.remove())
    play(cur.current, [{ opacity: 0, transform: 'translateY(70%)' }, { opacity: 1, transform: 'none' }], { duration: 340, easing: S.card.easing, delay: 40 })
  }, [value, reduced])
  return (
    <span ref={box} className="relative inline-block overflow-hidden align-bottom">
      <span ref={cur} className="tnum inline-block">{value}</span>
    </span>
  )
}
