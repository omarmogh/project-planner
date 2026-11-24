import { Check, Maximize, Minus, Pin, Plus, StickyNote, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react'
import { doneLectures, watchedIds, type Goal, type Resource } from '../engine'
import { watchChecklist } from '../data/setup'
import { REDUCED_MOTION, useMedia } from '../lib/useMedia'
import { useDemo, type BoardNote, type NoteTone } from '../store/demoStore'
import { Nav } from '../ui/Nav'

/**
 * The Board: every checklist on one calm canvas, plus sticky notes to self.
 * Ticking a lecture, a past paper or a video here changes the plan straight away.
 * Pan by dragging the background; zoom with the wheel, a pinch or + / −; 0 fits everything; Esc goes back to the overview.
 * Tap a paper or a note to bring it into focus.
 */

const PAPER_W = 288
const NOTE_W = 224
const COL = PAPER_W + 48
const ROW_H = 44
const MIN_K = 0.15
const MAX_K = 2.5
/** Below this zoom the papers are too small to tick: a tap focuses instead. */
const FAR_K = 0.55
/** The zoom the board opens at (or less, to fit one paper across a phone). */
const START_K = 0.8
const MOVE_PX = 4
/** Focusing a paper brings it to about its natural size, not larger. */
const FOCUS_K = 1.1
/** The dot grid doubles its spacing when zoomed out, so it never turns into noise. */
const gridStep = (k: number) => { let s = 24; while (s * k < 16) s *= 2; return s * k }

type Kind = 'lectures' | 'papers' | 'videos' | 'ref'
interface Paper { id: string; kind: Kind; title: string; kindLabel: string; rows: number; resource?: Resource; goal?: Goal; system?: string }
interface Cam { x: number; y: number; k: number }
type XY = { x: number; y: number }

const TONES: NoteTone[] = ['sun', 'sky', 'mint', 'rose']
const TONE_BG: Record<NoteTone, string> = { sun: 'bg-note-sun', sky: 'bg-note-sky', mint: 'bg-note-mint', rose: 'bg-note-rose' }
const TONE_NAME: Record<NoteTone, string> = { sun: 'Yellow', sky: 'Blue', mint: 'Green', rose: 'Pink' }

/**
 * Step 1 at a glance. The format changed in the 2027 Bulletin of Information (30-minute blocks);
 * the date it applies from is on usmle.org, so the paper says to check it. TODO(review): re-check each year.
 */
const STEP1: { head: string; items: { id: string; text: string }[] }[] = [
  {
    head: 'The exam (2027 Bulletin)',
    items: [
      { id: 'fmt', text: 'One 8-hour day, up to 280 questions' },
      { id: 'blocks', text: '30-minute blocks of up to 20 questions' },
      { id: 'breaks', text: 'At least 55 min of break time, 5-min optional tutorial' },
      { id: 'score', text: 'Pass/fail' },
      { id: 'check', text: 'Checked on usmle.org which format applies to my date' },
    ],
  },
  {
    head: 'Before the day',
    items: [
      { id: 'sample', text: 'Did the official sample questions in the testing software' },
      { id: 'nbme', text: 'Took an NBME self-assessment 1–2 weeks before' },
      { id: 'permit', text: 'Scheduling permit printed or saved' },
      { id: 'id', text: 'Government photo ID, not expired, name matches the permit' },
      { id: 'route', text: 'Know the route to the test centre and when to arrive' },
    ],
  },
]

export function Board() {
  const plan = useDemo((s) => s.plan)
  const board = useDemo((s) => s.board)
  const todayTasks = useDemo((s) => s.todayTasks)
  const reduceMotion = useMedia(REDUCED_MOTION)

  const papers = useMemo<Paper[]>(() => {
    if (!plan) return []
    const out: Paper[] = []
    const goalOf = (r: Resource) => plan.goals.find((g) => g.id === r.goalId)
    for (const r of plan.resources) {
      const goal = goalOf(r)
      if (r.type === 'slides' && r.totalUnits > 0) {
        out.push({ id: `lec:${r.id}`, kind: 'lectures', title: goal?.label ?? r.name, kindLabel: 'Lectures', rows: Math.ceil(r.totalUnits), resource: r, goal })
      }
      if (r.type === 'papers' && r.totalUnits > 0) {
        out.push({ id: `pap:${r.id}`, kind: 'papers', title: goal?.label ?? r.name, kindLabel: 'Past papers', rows: Math.ceil(r.totalUnits), resource: r, goal })
      }
    }
    if (plan.topicGoalId && plan.materials.includes('bnb')) {
      const systems = [...new Set([...plan.focus, ...plan.topics.map((t) => t.system)])]
      for (const system of systems) {
        const groups = watchChecklist(system)
        if (groups.length) out.push({ id: `bnb:${system}`, kind: 'videos', title: system, kindLabel: 'Videos', rows: groups.length, system })
      }
    }
    if (plan.goals.some((g) => g.kind === 'step1')) {
      out.push({ id: 'ref:step1', kind: 'ref', title: 'Step 1', kindLabel: 'Exam day', rows: STEP1.reduce((n, g) => n + g.items.length + 1, 0) })
    }
    return out
  }, [plan])

  // Where each paper sits when it hasn't been moved: lectures and papers in the first columns, then videos, then Step 1.
  const defaults = useMemo(() => {
    const at: Record<string, XY> = {}
    const colY: number[] = []
    const place = (id: string, col: number, rows: number) => {
      const y = colY[col] ?? 0
      at[id] = { x: col * COL, y }
      colY[col] = y + 96 + rows * ROW_H + 48
    }
    let col = 0
    const uni = papers.filter((p) => p.kind === 'lectures' || p.kind === 'papers')
    const goals = [...new Set(uni.map((p) => p.goal?.id))]
    for (const g of goals) {
      for (const p of uni.filter((x) => x.goal?.id === g)) place(p.id, col, p.rows)
      col++
    }
    // Exam-day paper under the first column: it's short and read early.
    for (const p of papers.filter((x) => x.kind === 'ref')) place(p.id, 0, p.rows)
    if (col === 0) col = 1
    // Videos: focus systems first, each into the shortest column, so the board stays wide rather than tall.
    const videos = papers.filter((p) => p.kind === 'videos')
    const n = Math.min(videos.length, Math.max(3, Math.min(5, Math.ceil(Math.sqrt(videos.length)))))
    for (const p of videos) {
      let best = col
      for (let c = col; c < col + n; c++) if ((colY[c] ?? 0) < (colY[best] ?? 0)) best = c
      place(p.id, best, p.rows)
    }
    return at
  }, [papers])

  const view = useRef<HTMLDivElement>(null)
  const nodes = useRef(new Map<string, HTMLElement>())
  const [cam, setCam] = useState<Cam>({ x: 24, y: 24, k: 1 })
  const camRef = useRef(cam)
  camRef.current = cam
  const [animate, setAnimate] = useState(false)
  const [focused, setFocused] = useState<string | null>(null)
  const [drag, setDrag] = useState<{ id: string; at: XY } | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const posOf = useCallback((id: string): XY => {
    if (drag?.id === id) return drag.at
    const n = board.notes.find((x) => x.id === id)
    if (n) return { x: n.x, y: n.y }
    return board.at[id] ?? defaults[id] ?? { x: 0, y: 0 }
  }, [board, defaults, drag])

  const viewSize = () => {
    const r = view.current?.getBoundingClientRect()
    return { w: r?.width ?? 800, h: r?.height ?? 600 }
  }

  const moveCam = useCallback((next: Cam, smooth: boolean) => {
    const k = Math.min(MAX_K, Math.max(MIN_K, next.k))
    setAnimate(smooth && !reduceMotion)
    camRef.current = { ...next, k }
    setCam({ ...next, k })
  }, [reduceMotion])

  useEffect(() => {
    if (!animate) return
    const t = window.setTimeout(() => setAnimate(false), 460)
    return () => window.clearTimeout(t)
  }, [animate, cam])

  const boxOf = useCallback((id: string) => {
    const p = posOf(id)
    const el = nodes.current.get(id)
    return { x: p.x, y: p.y, w: el?.offsetWidth ?? PAPER_W, h: el?.offsetHeight ?? 200 }
  }, [posOf])

  const fitBox = useCallback((b: { x: number; y: number; w: number; h: number }, fill: number, maxK: number, smooth: boolean) => {
    const { w, h } = viewSize()
    const k = Math.min(maxK, (w * fill) / b.w, (h * fill) / b.h)
    moveCam({ k, x: w / 2 - (b.x + b.w / 2) * k, y: h / 2 - (b.y + b.h / 2) * k }, smooth)
  }, [moveCam])

  const overview = useCallback((smooth = true) => {
    setFocused(null)
    const ids = [...papers.map((p) => p.id), ...board.notes.map((n) => n.id)]
    if (ids.length === 0) return moveCam({ x: 24, y: 24, k: 1 }, smooth)
    const boxes = ids.map(boxOf)
    const x = Math.min(...boxes.map((b) => b.x))
    const y = Math.min(...boxes.map((b) => b.y))
    const r = Math.max(...boxes.map((b) => b.x + b.w))
    const btm = Math.max(...boxes.map((b) => b.y + b.h))
    fitBox({ x, y, w: r - x, h: btm - y }, 0.92, 1, smooth)
  }, [papers, board.notes, boxOf, fitBox, moveCam])

  const focusOn = useCallback((id: string) => {
    setFocused(id)
    const b = boxOf(id)
    // Tall papers: fit the width and show the top, rather than shrinking the text to fit the whole list.
    const { w, h } = viewSize()
    const k = Math.min(FOCUS_K, (w * 0.86) / b.w)
    if (b.h * k > h * 0.9) moveCam({ k, x: w / 2 - (b.x + b.w / 2) * k, y: 32 - b.y * k }, true)
    else fitBox(b, 0.86, FOCUS_K, true)
  }, [boxOf, fitBox, moveCam])

  // Open at a zoom where the text reads, from the top-left corner; "Show everything" is one tap away.
  const start = useCallback(() => {
    const ids = [...papers.map((p) => p.id), ...board.notes.map((n) => n.id)]
    if (ids.length === 0) return moveCam({ x: 24, y: 24, k: 1 }, false)
    overview(false)
    const { w } = viewSize()
    const readable = Math.min(START_K, (w - 48) / PAPER_W)
    if (camRef.current.k >= readable) return
    const boxes = ids.map(boxOf)
    const x = Math.min(...boxes.map((b) => b.x))
    const y = Math.min(...boxes.map((b) => b.y))
    moveCam({ k: readable, x: 24 - x * readable, y: 32 - y * readable }, false)
  }, [papers, board.notes, boxOf, overview, moveCam])
  useLayoutEffect(() => { start() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const zoomAt = useCallback((factor: number, at?: XY) => {
    const c = camRef.current
    const { w, h } = viewSize()
    const p = at ?? { x: w / 2, y: h / 2 }
    const k = Math.min(MAX_K, Math.max(MIN_K, c.k * factor))
    moveCam({ k, x: p.x - (p.x - c.x) * (k / c.k), y: p.y - (p.y - c.y) * (k / c.k) }, !at)
  }, [moveCam])

  // Wheel zoom around the pointer. Non-passive so the page doesn't scroll.
  useEffect(() => {
    const el = view.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
      zoomAt(Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015)), { x: e.clientX - r.left, y: e.clientY - r.top })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  const newNote = useCallback(() => {
    const { w, h } = viewSize()
    const c = camRef.current
    const x = Math.round((w / 2 - c.x) / c.k - NOTE_W / 2)
    const y = Math.round((h / 2 - c.y) / c.k - NOTE_W / 2)
    const id = useDemo.getState().addNote(x, y)
    setFocused(id)
    window.setTimeout(() => {
      focusOn(id)
      nodes.current.get(id)?.querySelector('textarea')?.focus({ preventScroll: true })
    }, 0)
  }, [focusOn])

  // Keyboard: + / − zoom, 0 fits, arrows pan, N adds a note, Esc back to the overview.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest('textarea, input')
      if (e.key === 'Escape') {
        if (typing) (e.target as HTMLElement).blur()
        overview()
        return
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return
      const c = camRef.current
      if (e.key === '+' || e.key === '=') zoomAt(1.25)
      else if (e.key === '-' || e.key === '_') zoomAt(0.8)
      else if (e.key === '0') overview()
      else if (e.key === 'n' || e.key === 'N') newNote()
      else if (e.key === 'ArrowLeft') moveCam({ ...c, x: c.x + 80 }, true)
      else if (e.key === 'ArrowRight') moveCam({ ...c, x: c.x - 80 }, true)
      else if (e.key === 'ArrowUp') moveCam({ ...c, y: c.y + 80 }, true)
      else if (e.key === 'ArrowDown') moveCam({ ...c, y: c.y - 80 }, true)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [overview, zoomAt, newNote, moveCam])

  // Pointers: one finger on the background pans, two pinch-zoom, one on a paper moves it (a tap focuses it).
  const pointers = useRef(new Map<number, XY>())
  const gesture = useRef<
    | { type: 'pan'; start: XY; cam: Cam }
    | { type: 'pinch'; dist: number; mid: XY; cam: Cam }
    | { type: 'item'; id: string; start: XY; from: XY; moved: boolean }
    | null
  >(null)

  const local = (e: { clientX: number; clientY: number }): XY => {
    const r = view.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const startPinch = () => {
    const [a, b] = [...pointers.current.values()]
    gesture.current = { type: 'pinch', dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, cam: camRef.current }
    setDrag(null)
  }

  const onViewDown = (e: RPointerEvent) => {
    pointers.current.set(e.pointerId, local(e))
    if (pointers.current.size === 2) return startPinch()
    if (gesture.current) return
    gesture.current = { type: 'pan', start: local(e), cam: camRef.current }
    view.current?.setPointerCapture(e.pointerId)
  }

  const onItemDown = (id: string) => (e: RPointerEvent) => {
    const far = camRef.current.k < FAR_K
    const t = e.target as HTMLElement
    e.stopPropagation()
    // Ticks, buttons and typing keep working: they never start a pan or a move.
    if (!far && t.closest('button, textarea, input, [data-nodrag]')) return
    pointers.current.set(e.pointerId, local(e))
    if (pointers.current.size === 2) return startPinch()
    gesture.current = { type: 'item', id, start: local(e), from: posOf(id), moved: false }
    view.current?.setPointerCapture(e.pointerId)
  }

  const onMove = (e: RPointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return
    const p = local(e)
    pointers.current.set(e.pointerId, p)
    const g = gesture.current
    if (!g) return
    if (g.type === 'pinch' && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const k = Math.min(MAX_K, Math.max(MIN_K, g.cam.k * (dist / g.dist)))
      moveCam({ k, x: mid.x - (g.mid.x - g.cam.x) * (k / g.cam.k), y: mid.y - (g.mid.y - g.cam.y) * (k / g.cam.k) }, false)
    } else if (g.type === 'pan') {
      moveCam({ ...g.cam, x: g.cam.x + p.x - g.start.x, y: g.cam.y + p.y - g.start.y }, false)
    } else if (g.type === 'item') {
      const dx = p.x - g.start.x
      const dy = p.y - g.start.y
      if (!g.moved && Math.hypot(dx, dy) < MOVE_PX) return
      g.moved = true
      const k = camRef.current.k
      setDrag({ id: g.id, at: { x: Math.round(g.from.x + dx / k), y: Math.round(g.from.y + dy / k) } })
    }
  }

  const onUp = (e: RPointerEvent) => {
    pointers.current.delete(e.pointerId)
    const g = gesture.current
    if (pointers.current.size > 0) {
      // Lifting one finger of a pinch: carry on panning with the other.
      if (g?.type === 'pinch') {
        const [rest] = [...pointers.current.values()]
        gesture.current = { type: 'pan', start: rest, cam: camRef.current }
      }
      return
    }
    gesture.current = null
    if (g?.type === 'item') {
      if (g.moved && drag) useDemo.getState().moveOnBoard(g.id, drag.at.x, drag.at.y)
      else if (!g.moved) {
        focusOn(g.id)
        if (g.id.startsWith('note-')) window.setTimeout(() => nodes.current.get(g.id)?.querySelector('textarea')?.focus({ preventScroll: true }), 0)
      }
      setDrag(null)
    }
  }

  // A tick that changes the plan says so, once, quietly.
  const toastTimer = useRef<number | undefined>(undefined)
  const replanned = () => {
    setToast("Today's plan updated")
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2200)
  }
  useEffect(() => () => window.clearTimeout(toastTimer.current), [])

  if (!plan) return null
  const todayItems = new Set(
    todayTasks.filter((t) => t.status === 'pending').flatMap((t) => (t.items ?? []).map((i) => `${t.resourceId}:${i}`)),
  )
  const far = cam.k < FAR_K
  const empty = papers.length === 0 && board.notes.length === 0

  const holder = (id: string, children: ReactNode, width: number, label: string) => {
    const p = posOf(id)
    const pinned = board.pins.includes(id)
    const lifted = drag?.id === id
    return (
      <div
        key={id}
        ref={(el) => { if (el) nodes.current.set(id, el); else nodes.current.delete(id) }}
        onPointerDown={onItemDown(id)}
        className={`absolute touch-none select-none ${lifted ? 'z-20 cursor-grabbing' : focused === id ? 'z-10' : ''}`}
        style={{ left: p.x, top: p.y, width }}
      >
        {children}
        {pinned && (
          <div
            className="pointer-events-none absolute start-1/2 top-0 flex flex-col items-center"
            style={{ transform: `translate(-50%, -70%) scale(${1 / cam.k})`, transformOrigin: '50% 100%' }}
            aria-hidden
          >
            <PinMark />
            {far && id.startsWith('note-') && <span className="mt-1 max-w-48 truncate rounded-sm bg-card px-2 py-0.5 text-footnote font-semibold text-fg shadow-paper">{label}</span>}
          </div>
        )}
        {far && <div className="absolute inset-0 cursor-pointer" aria-hidden />}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 flex flex-col pb-tabbar desktop:ps-sidebar desktop:pb-0">
      <Nav variant="side" />
      <header className="z-10 flex min-h-14 items-center gap-3 border-b border-line bg-bg px-5 tablet:px-8">
        <h1 className="text-title-3 font-semibold tracking-tight">Board</h1>
        <p className="hidden flex-1 truncate text-subhead text-muted tablet:block">Tick what you've done. Today's plan follows.</p>
        <span className="flex-1 tablet:hidden" />
        <button
          type="button"
          onClick={newNote}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-callout font-medium text-accent hover:opacity-70 active:opacity-60"
        >
          <StickyNote className="size-icon-sm" aria-hidden />
          Add note
        </button>
      </header>

      <div
        ref={view}
        onPointerDown={onViewDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className="relative flex-1 touch-none overflow-hidden bg-canvas outline-none"
        role="application"
        aria-label="Board. Drag to move around, plus and minus to zoom, Escape for the overview."
        style={{
          backgroundImage: 'radial-gradient(var(--grid-dot) 1px, transparent 1.2px)',
          backgroundSize: `${gridStep(cam.k)}px ${gridStep(cam.k)}px`,
          backgroundPosition: `${cam.x}px ${cam.y}px`,
          cursor: gesture.current?.type === 'pan' ? 'grabbing' : 'grab',
        }}
      >
        <div
          className="absolute start-0 top-0 origin-top-left"
          style={{
            transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.k})`,
            transition: animate ? 'transform 420ms var(--ease-calm)' : undefined,
          }}
        >
          {papers.map((p) =>
            holder(p.id, (
              <PaperCard paper={p} pinned={board.pins.includes(p.id)} focused={focused === p.id} todayItems={todayItems} ticks={board.ticks} onReplan={replanned} k={cam.k} />
            ), PAPER_W, `${p.title} · ${p.kindLabel}`),
          )}
          {board.notes.map((n) =>
            holder(n.id, <NoteCard note={n} pinned={board.pins.includes(n.id)} focused={focused === n.id} onFocus={() => setFocused(n.id)} />, NOTE_W, n.text.split('\n')[0] || 'Note'),
          )}
        </div>

        {empty && (
          <p className="absolute inset-x-0 top-1/3 px-8 text-center text-callout text-muted">
            Your checklists appear here as you add lectures or videos. Add a note to start.
          </p>
        )}

        {toast && (
          <p role="status" className="anim-fade pointer-events-none absolute inset-x-0 top-3 mx-auto w-fit rounded-lg bg-card px-4 py-2 text-subhead font-medium text-fg shadow-paper">
            {toast}
          </p>
        )}

        <div className="absolute bottom-4 end-4 flex items-center rounded-lg bg-card shadow-paper" onPointerDown={(e) => e.stopPropagation()}>
          <IconButton label="Zoom out (−)" onClick={() => zoomAt(0.8)}><Minus className="size-icon-sm" /></IconButton>
          <span className="tnum w-12 text-center text-footnote text-muted" aria-live="polite">{Math.round(cam.k * 100)}%</span>
          <IconButton label="Zoom in (+)" onClick={() => zoomAt(1.25)}><Plus className="size-icon-sm" /></IconButton>
          <span className="h-6 w-px bg-line" aria-hidden />
          <IconButton label="Show everything (0)" onClick={() => overview()}><Maximize className="size-icon-sm" /></IconButton>
        </div>
        {focused && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => overview()}
            className="absolute bottom-4 start-4 inline-flex min-h-11 items-center rounded-lg bg-card px-4 shadow-paper text-subhead font-medium text-fg hover:opacity-70 active:opacity-60"
          >
            Overview <kbd className="ms-2 hidden font-sans text-faint desktop:inline">Esc</kbd>
          </button>
        )}
      </div>
      <Nav variant="bottom" />
    </div>
  )
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="flex size-11 items-center justify-center text-fg hover:opacity-70 active:opacity-60">
      {children}
    </button>
  )
}

/** The pin for important papers and notes. Drawn at the same screen size at every zoom, so it shows from afar. */
function PinMark() {
  return (
    <svg width="28" height="36" viewBox="0 0 28 36" className="drop-shadow-sm">
      <line x1="14" y1="20" x2="14" y2="34" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="14" cy="12" r="10" fill="var(--accent)" />
      <circle cx="10.5" cy="8.5" r="3" fill="var(--on-accent)" opacity="0.35" />
    </svg>
  )
}

function PinToggle({ id, pinned, onNote }: { id: string; pinned: boolean; onNote?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => useDemo.getState().togglePin(id)}
      aria-pressed={pinned}
      aria-label={pinned ? 'Unpin' : 'Pin as important'}
      title={pinned ? 'Unpin' : 'Pin as important'}
      className={`-me-2 flex size-11 shrink-0 items-center justify-center hover:opacity-70 active:opacity-60 ${onNote ? (pinned ? 'text-on-note' : 'text-on-note-muted') : pinned ? 'text-accent' : 'text-faint'}`}
    >
      <Pin className="size-icon-sm" fill={pinned ? 'currentColor' : 'none'} />
    </button>
  )
}

function Tick({ on, label, sub, today, far, onClick }: { on: boolean; label: string; sub?: string; today?: boolean; far?: boolean; onClick: () => void }) {
  // Zoomed out, a row is a line the length of its label: the paper keeps its shape and its progress shows at a glance.
  if (far) {
    return (
      <li className="flex min-h-11 items-center gap-3" aria-hidden>
        <span className={`size-icon-md shrink-0 rounded-sm ${on ? 'bg-accent' : 'border border-faint'}`} />
        <span className={`h-2.5 rounded-full ${on ? 'bg-accent-soft' : 'bg-line'}`} style={{ width: `${Math.min(100, 24 + label.length * 2.4)}%` }} />
      </li>
    )
  }
  return (
    <li>
      <button
        type="button"
        role="checkbox"
        aria-checked={on}
        onClick={onClick}
        className="flex min-h-11 w-full items-center gap-3 text-start text-body-sm hover:opacity-70 active:opacity-60"
      >
        <span
          className={`flex size-icon-md shrink-0 items-center justify-center rounded-sm border transition-colors duration-150 ${on ? 'border-accent bg-accent text-on-accent' : 'border-faint'}`}
          aria-hidden
        >
          {on && <Check className="size-icon-xs" strokeWidth={3} />}
        </span>
        <span className={`min-w-0 flex-1 leading-snug ${on ? 'text-muted' : ''}`}>{label}</span>
        {today && !on && <span className="shrink-0 rounded-sm bg-accent-soft px-1.5 py-0.5 text-caption-1 font-medium text-accent">Today</span>}
        {sub && <span className="tnum shrink-0 text-footnote text-muted">{sub}</span>}
      </button>
    </li>
  )
}

function PaperCard({ paper, pinned, focused, todayItems, ticks, onReplan, k }: {
  paper: Paper; pinned: boolean; focused: boolean; todayItems: Set<string>; ticks: string[]; onReplan: () => void; k: number
}) {
  const far = k < FAR_K
  const s = useDemo.getState()
  const topics = useDemo((x) => x.plan?.topics)
  let done = 0
  let total = 0
  let body: ReactNode = null

  if (paper.kind === 'lectures' && paper.resource) {
    const r = paper.resource
    const set = doneLectures(r)
    total = Math.ceil(r.totalUnits)
    done = set.size
    const word = (r.unit?.[0] ?? 'lecture').replace(/^./, (c) => c.toUpperCase())
    body = (
      <ul>
        {Array.from({ length: total }, (_, i) => (
          <Tick
            key={i}
            on={set.has(i)}
            label={r.itemNames?.[i] ? `${i + 1}. ${r.itemNames[i]}` : `${word} ${i + 1}`}
            today={todayItems.has(`${r.id}:${i}`)}
            far={far}
            onClick={() => { s.tickLecture(r.id, i, !set.has(i)); onReplan() }}
          />
        ))}
      </ul>
    )
  } else if (paper.kind === 'papers' && paper.resource) {
    const r = paper.resource
    total = Math.ceil(r.totalUnits)
    done = Math.floor(r.doneUnits)
    body = (
      <ul>
        {Array.from({ length: total }, (_, i) => (
          <Tick key={i} on={i < done} label={`Paper ${i + 1}`} far={far} onClick={() => { s.setPapersDone(r.id, i < done ? i : i + 1); onReplan() }} />
        ))}
      </ul>
    )
  } else if (paper.kind === 'videos' && paper.system && topics) {
    const watched = new Set(watchedIds(topics, paper.system))
    const groups = watchChecklist(paper.system)
    total = groups.length
    body = (
      <ul>
        {groups.map((g) => {
          const ids = g.videos.map((v) => v.id)
          const n = ids.filter((id) => watched.has(id)).length
          const all = n === ids.length
          if (all) done++
          return (
            <Tick
              key={g.topicId}
              on={all}
              label={g.topic}
              sub={ids.length > 1 && !all ? `${n}/${ids.length}` : undefined}
              far={far}
              onClick={() => { s.setWatched(ids, !all); onReplan() }}
            />
          )
        })}
      </ul>
    )
  } else if (paper.kind === 'ref') {
    const on = new Set(ticks)
    for (const g of STEP1) for (const it of g.items) { total++; if (on.has(`step1:${it.id}`)) done++ }
    body = STEP1.map((g) => (
      <section key={g.head} className="pt-2">
        <h3 className="text-footnote font-semibold tracking-wide text-muted">{g.head}</h3>
        <ul>
          {g.items.map((it) => {
            const id = `step1:${it.id}`
            return <Tick key={id} on={on.has(id)} label={it.text} far={far} onClick={() => s.tickBoard(id, !on.has(id))} />
          })}
        </ul>
      </section>
    ))
  }

  const pct = total ? (done / total) * 100 : 0
  return (
    <article
      className={`relative overflow-hidden rounded-lg bg-card px-4 pb-3 shadow-paper transition-[outline-color] duration-200 ${pinned ? 'outline-2 outline-solid outline-accent' : focused ? 'shadow-lifted' : ''}`}
      aria-label={`${paper.title} · ${paper.kindLabel}`}
    >
      <header className="flex cursor-grab items-center gap-2 pt-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-callout font-semibold tracking-tight" title={paper.title}>{paper.title}</h2>
          <p className="truncate text-footnote text-muted">{paper.kindLabel} <span className="tnum">· {done} of {total}</span></p>
        </div>
        <PinToggle id={paper.id} pinned={pinned} />
      </header>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-line" aria-hidden>
        <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
      <div className="pt-1">{body}</div>
      {/* Zoomed out, the name and progress are drawn at a fixed screen size over the top of the paper, so they always read. */}
      {far && (
        <div
          className="absolute start-0 top-0 origin-top-left bg-card px-2.5 pt-2 pb-2"
          style={{ width: PAPER_W * k, transform: `scale(${1 / k})` }}
          aria-hidden
        >
          {/* Too narrow for words on screen: the paper shows only its progress. */}
          {PAPER_W * k >= 72 && (
            <>
              <p className="truncate text-footnote font-semibold leading-tight text-fg">{paper.title}</p>
              <p className="tnum truncate text-caption-1 text-muted">{PAPER_W * k >= 150 ? `${paper.kindLabel} · ` : ''}{done}/{total}</p>
            </>
          )}
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
    </article>
  )
}

function NoteCard({ note, pinned, focused, onFocus }: { note: BoardNote; pinned: boolean; focused: boolean; onFocus: () => void }) {
  const s = useDemo.getState()
  return (
    <div className={`flex min-h-56 flex-col rounded-md ${TONE_BG[note.tone]} shadow-paper ${pinned ? 'outline-2 outline-solid outline-accent' : ''}`}>
      <div className="flex min-h-11 cursor-grab items-center gap-1 ps-3 pe-1">
        {focused ? (
          <>
            <div className="flex flex-1 items-center gap-1" role="radiogroup" aria-label="Colour">
              {TONES.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={note.tone === t}
                  aria-label={TONE_NAME[t]}
                  onClick={() => s.updateNote(note.id, { tone: t })}
                  className="flex size-8 items-center justify-center"
                >
                  <span className={`size-4 rounded-full border border-line ${TONE_BG[t]} ${note.tone === t ? 'outline-2 outline-offset-1 outline-solid outline-on-note' : ''}`} />
                </button>
              ))}
            </div>
            <button
              type="button"
              aria-label="Delete note"
              title="Delete note"
              onClick={() => s.removeNote(note.id)}
              className="flex size-11 items-center justify-center text-on-note-muted hover:opacity-70 active:opacity-60"
            >
              <Trash2 className="size-icon-sm" />
            </button>
          </>
        ) : <span className="flex-1" />}
        <PinToggle id={note.id} pinned={pinned} onNote />
      </div>
      <textarea
        value={note.text}
        onChange={(e) => s.updateNote(note.id, { text: e.target.value })}
        onFocus={onFocus}
        placeholder="Note to self"
        aria-label="Note"
        rows={6}
        className="min-h-44 flex-1 resize-none bg-transparent px-4 pb-4 text-body-sm leading-snug text-on-note outline-none placeholder:text-on-note/50"
      />
    </div>
  )
}
