import { Check, ChevronDown, Link2, ListChecks, Maximize, Minus, Pencil, Pin, Plus, StickyNote, Trash2, Undo2 } from 'lucide-react'
import { Fragment, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react'
import { doneLectures, watchedIds, type Goal, type Resource } from '../engine'
import { watchChecklist } from '../data/setup'
import { REDUCED_MOTION, useMedia } from '../lib/useMedia'
import { useDemo, type BoardItem, type BoardLink, type BoardList, type BoardNote, type LinkEnd, type LinkTone, type NoteTone, type PaperEdit } from '../store/demoStore'
import { canAnimate, play } from '../lib/motion'
import { Nav } from '../ui/Nav'

/**
 * The Board: every checklist on one calm canvas, plus sticky notes, the student's own checklists and strings between them.
 * Ticking a lecture, a past paper or a video here changes the plan straight away.
 * Pan by dragging the background; zoom with the wheel, a pinch or + / −; 0 fits everything; Esc goes back to the overview.
 * Tap a paper or a note to bring it into focus. A pinned paper stays where it is: dragging it moves the board instead.
 * Links ("strings") tie related things together, like a note on why heart failure keeps going wrong and the Cardio videos.
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


const LIST_H = 200
const NOTE_H = 224
const newId = () => `i${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`

export function Board() {
  const plan = useDemo((s) => s.plan)
  const rawBoard = useDemo((s) => s.board)
  const todayTasks = useDemo((s) => s.todayTasks)
  const reduceMotion = useMedia(REDUCED_MOTION)
  // Saves from before lists, edits and links existed have none of them.
  const board = useMemo(() => ({
    ...rawBoard,
    lists: rawBoard.lists ?? [],
    edits: rawBoard.edits ?? {},
    removed: rawBoard.removed ?? [],
    links: rawBoard.links ?? [],
  }), [rawBoard])

  const allPapers = useMemo<Paper[]>(() => {
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
  const papers = useMemo(() => allPapers.filter((p) => !board.removed.includes(p.id)), [allPapers, board.removed])
  const removedPapers = allPapers.filter((p) => board.removed.includes(p.id))

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
    const uni = allPapers.filter((p) => p.kind === 'lectures' || p.kind === 'papers')
    const goals = [...new Set(uni.map((p) => p.goal?.id))]
    for (const g of goals) {
      for (const p of uni.filter((x) => x.goal?.id === g)) place(p.id, col, p.rows)
      col++
    }
    // Exam-day paper under the first column: it's short and read early.
    for (const p of allPapers.filter((x) => x.kind === 'ref')) place(p.id, 0, p.rows)
    if (col === 0) col = 1
    // Videos: focus systems first, each into the shortest column, so the board stays wide rather than tall.
    const videos = allPapers.filter((p) => p.kind === 'videos')
    const n = Math.min(videos.length, Math.max(3, Math.min(5, Math.ceil(Math.sqrt(videos.length)))))
    for (const p of videos) {
      let best = col
      for (let c = col; c < col + n; c++) if ((colY[c] ?? 0) < (colY[best] ?? 0)) best = c
      place(p.id, best, p.rows)
    }
    return at
  }, [allPapers])

  const view = useRef<HTMLDivElement>(null)
  const nodes = useRef(new Map<string, HTMLElement>())
  const [cam, setCam] = useState<Cam>({ x: 24, y: 24, k: 1 })
  const camRef = useRef(cam)
  camRef.current = cam
  const [animate, setAnimate] = useState(false)
  const [focused, setFocused] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [drag, setDrag] = useState<{ id: string; at: XY } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  /** Linking: tap one thing (or one row on it), then another. `from` is the first one tapped. */
  const [linking, setLinking] = useState<{ from: LinkEnd | null } | null>(null)
  const [pickedLink, setPickedLink] = useState<string | null>(null)
  /** A string being bent: its control point, live, before it is saved on release. */
  const [bending, setBending] = useState<{ id: string; bend: XY } | null>(null)
  const [barW, setBarW] = useState(0)
  // Card sizes are read from the DOM; render once more after the first layout so strings start at the right place.
  const [, remeasure] = useState(0)
  useLayoutEffect(() => { remeasure(1) }, [])

  const posOf = useCallback((id: string): XY => {
    if (drag?.id === id) return drag.at
    const n = board.notes.find((x) => x.id === id) ?? board.lists.find((x) => x.id === id)
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

  // Strings are drawn from measured cards: re-draw when one changes size (a topic opens, an item is added).
  const [, setMeasured] = useState(0)
  const hasLinks = (board.links?.length ?? 0) > 0
  useEffect(() => {
    if (!hasLinks || typeof ResizeObserver === 'undefined') return
    let raf = 0
    const ro = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setMeasured((n) => n + 1)) })
    nodes.current.forEach((el) => ro.observe(el))
    return () => { ro.disconnect(); cancelAnimationFrame(raf) }
  })

  const widthOf = (id: string) => (id.startsWith('note-') ? NOTE_W : PAPER_W)
  const boxOf = useCallback((id: string) => {
    const p = posOf(id)
    const el = nodes.current.get(id)
    return { x: p.x, y: p.y, w: el?.offsetWidth ?? widthOf(id), h: el?.offsetHeight ?? (id.startsWith('note-') ? NOTE_H : LIST_H) }
  }, [posOf])

  const fitBox = useCallback((b: { x: number; y: number; w: number; h: number }, fill: number, maxK: number, smooth: boolean) => {
    const { w, h } = viewSize()
    const k = Math.min(maxK, (w * fill) / b.w, (h * fill) / b.h)
    moveCam({ k, x: w / 2 - (b.x + b.w / 2) * k, y: h / 2 - (b.y + b.h / 2) * k }, smooth)
  }, [moveCam])

  const allIds = useCallback(
    () => [...papers.map((p) => p.id), ...board.notes.map((n) => n.id), ...board.lists.map((l) => l.id)],
    [papers, board.notes, board.lists],
  )

  const overview = useCallback((smooth = true) => {
    setFocused(null)
    setEditing(null)
    const ids = allIds()
    if (ids.length === 0) return moveCam({ x: 24, y: 24, k: 1 }, smooth)
    const boxes = ids.map(boxOf)
    const x = Math.min(...boxes.map((b) => b.x))
    const y = Math.min(...boxes.map((b) => b.y))
    const r = Math.max(...boxes.map((b) => b.x + b.w))
    const btm = Math.max(...boxes.map((b) => b.y + b.h))
    fitBox({ x, y, w: r - x, h: btm - y }, 0.92, 1, smooth)
  }, [allIds, boxOf, fitBox, moveCam])

  /** Bring one thing into focus. A thing that was just added isn't in the DOM yet, so its box is passed in. */
  const focusOn = useCallback((id: string, known?: { x: number; y: number; w: number; h: number }) => {
    setFocused(id)
    const b = known ?? boxOf(id)
    // Tall papers: fit the width and show the top, rather than shrinking the text to fit the whole list.
    const { w, h } = viewSize()
    const k = Math.min(FOCUS_K, (w * 0.86) / b.w)
    if (b.h * k > h * 0.9) moveCam({ k, x: w / 2 - (b.x + b.w / 2) * k, y: 32 - b.y * k }, true)
    else fitBox(b, 0.86, FOCUS_K, true)
  }, [boxOf, fitBox, moveCam])

  // Open at a zoom where the text reads, from the top-left corner; "Show everything" is one tap away.
  const start = useCallback(() => {
    const ids = allIds()
    if (ids.length === 0) return moveCam({ x: 24, y: 24, k: 1 }, false)
    overview(false)
    const { w } = viewSize()
    const readable = Math.min(START_K, (w - 48) / PAPER_W)
    if (camRef.current.k >= readable) return
    const boxes = ids.map(boxOf)
    const x = Math.min(...boxes.map((b) => b.x))
    const y = Math.min(...boxes.map((b) => b.y))
    moveCam({ k: readable, x: 24 - x * readable, y: 32 - y * readable }, false)
  }, [allIds, boxOf, overview, moveCam])
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

  /** The board point at the centre of the screen, for a new thing of this size. */
  const centre = (w: number, h: number) => {
    const v = viewSize()
    const c = camRef.current
    const at = { x: Math.round((v.w / 2 - c.x) / c.k - w / 2), y: Math.round((v.h / 2 - c.y) / c.k - h / 2) }
    // Something already sits there (often the last thing added): step down and right, so neither hides the other.
    const taken = allIds().map((id) => posOf(id))
    for (let i = 0; i < 20 && taken.some((p) => Math.abs(p.x - at.x) < 40 && Math.abs(p.y - at.y) < 40); i++) { at.x += 48; at.y += 48 }
    return at
  }

  const newNote = useCallback(() => {
    setLinking(null)
    const at = centre(NOTE_W, NOTE_H)
    const id = useDemo.getState().addNote(at.x, at.y)
    setEditing(null)
    focusOn(id, { ...at, w: NOTE_W, h: NOTE_H })
    window.setTimeout(() => nodes.current.get(id)?.querySelector('textarea')?.focus({ preventScroll: true }), 0)
  }, [focusOn, allIds, posOf]) // eslint-disable-line react-hooks/exhaustive-deps

  const newList = useCallback(() => {
    setLinking(null)
    const at = centre(PAPER_W, LIST_H)
    const id = useDemo.getState().addList(at.x, at.y)
    setEditing(id)
    focusOn(id, { ...at, w: PAPER_W, h: LIST_H })
    window.setTimeout(() => nodes.current.get(id)?.querySelector('input')?.focus({ preventScroll: true }), 0)
  }, [focusOn, allIds, posOf]) // eslint-disable-line react-hooks/exhaustive-deps

  const startLinking = () => {
    setEditing(null)
    setPickedLink(null)
    setLinking({ from: null })
  }

  // Keyboard: + / − zoom, 0 fits, arrows pan, N adds a note, Esc steps back (linking, editing, then the overview).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest('textarea, input')
      if (e.key === 'Escape') {
        if (typing) (e.target as HTMLElement).blur()
        if (linking) return setLinking(null)
        if (pickedLink) return setPickedLink(null)
        if (editing) return setEditing(null)
        overview()
        return
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return
      if ((e.target as HTMLElement | null)?.closest?.('[role="menu"]')) return
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
  }, [overview, zoomAt, newNote, moveCam, linking, editing, pickedLink])

  // Pointers: one finger on the background pans, two pinch-zoom, one on a paper moves it (a tap focuses it).
  // A pinned paper, or any paper while linking, never moves: dragging it pans the board.
  const pointers = useRef(new Map<number, XY>())
  const gesture = useRef<
    | { type: 'pan'; start: XY; cam: Cam }
    | { type: 'pinch'; dist: number; mid: XY; cam: Cam }
    | { type: 'item'; id: string; start: XY; from: XY; cam: Cam; moved: boolean; locked: boolean; row?: string }
    | { type: 'bend'; link: BoardLink; t: number; start: XY; moved: boolean }
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
    setPickedLink(null)
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
    setPickedLink(null)
    // Ticks, buttons and typing keep working: they never start a pan or a move (unless linking, where a tap picks the paper).
    if (!far && !linking && t.closest('button, textarea, input, [data-nodrag]')) return
    pointers.current.set(e.pointerId, local(e))
    if (pointers.current.size === 2) return startPinch()
    const locked = !!linking || board.pins.includes(id)
    // Linking: the row under the finger (a topic, a lecture, an item) is the end; elsewhere on the card, the whole card.
    const card = nodes.current.get(id)
    const hit = linking ? document.elementsFromPoint(e.clientX, e.clientY).find((x) => x instanceof HTMLElement && x.dataset.row && card?.contains(x)) : undefined
    const row = (hit as HTMLElement | undefined)?.dataset.row
    gesture.current = { type: 'item', id, start: local(e), from: posOf(id), cam: camRef.current, moved: false, locked, row }
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
    } else if (g.type === 'bend') {
      if (!g.moved && Math.hypot(p.x - g.start.x, p.y - g.start.y) < MOVE_PX) return
      g.moved = true
      // The curve passes through the finger at the point it was grabbed: solve the quadratic for its control point.
      const c = camRef.current
      const P = { x: (p.x - c.x) / c.k, y: (p.y - c.y) / c.k }
      const [A, B] = endsOf(g.link)
      const t = g.t
      const C = { x: (P.x - (1 - t) ** 2 * A.x - t * t * B.x) / (2 * t * (1 - t)), y: (P.y - (1 - t) ** 2 * A.y - t * t * B.y) / (2 * t * (1 - t)) }
      setBending({ id: g.link.id, bend: { x: Math.round(C.x - (A.x + B.x) / 2), y: Math.round(C.y - (A.y + B.y) / 2) } })
    } else if (g.type === 'item') {
      const dx = p.x - g.start.x
      const dy = p.y - g.start.y
      if (!g.moved && Math.hypot(dx, dy) < MOVE_PX) return
      if (!g.moved && g.locked && !linking) flash('Pinned in place. Unpin it to move it.')
      g.moved = true
      if (g.locked) return moveCam({ ...g.cam, x: g.cam.x + dx, y: g.cam.y + dy }, false)
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
    if (g?.type === 'bend') {
      if (g.moved && bending) useDemo.getState().updateLink(bending.id, { bend: bending.bend })
      setBending(null)
    }
    if (g?.type === 'item') {
      if (g.moved && !g.locked && drag) useDemo.getState().moveOnBoard(g.id, drag.at.x, drag.at.y)
      else if (!g.moved && linking) {
        const end: LinkEnd = g.row ? { id: g.id, row: g.row } : { id: g.id }
        if (!linking.from) setLinking({ from: end })
        else if (linking.from.id !== end.id || linking.from.row !== end.row) {
          const before = useDemo.getState().board.links?.length ?? 0
          useDemo.getState().toggleLink(linking.from, end)
          const after = useDemo.getState().board.links ?? []
          setLinking(null)
          // A new string is shown picked, so its two ends light up and its colour can be chosen at once.
          if (after.length > before) setPickedLink(after[after.length - 1].id)
          else flash('Link removed')
        }
      } else if (!g.moved) {
        if (editing && editing !== g.id) setEditing(null)
        focusOn(g.id)
        if (g.id.startsWith('note-')) window.setTimeout(() => nodes.current.get(g.id)?.querySelector('textarea')?.focus({ preventScroll: true }), 0)
      }
      setDrag(null)
    }
  }

  // Strings. Each end is a card's centre, or the edge of one row on it (the side facing the other end).
  const centreOf = (id: string) => { const b = boxOf(id); return { x: b.x + b.w / 2, y: b.y + Math.min(b.h / 2, 120) } }
  /** A row's top and height inside its card, in board units (measured, so it follows edits and zoom). */
  const rowBox = (id: string, row?: string): { top: number; h: number } | null => {
    const card = nodes.current.get(id)
    if (!row || !card) return null
    const all = [...card.querySelectorAll<HTMLElement>('[data-row]')]
    // A part hidden under its folded topic: the string ties to the topic's row instead.
    const el = all.find((x) => x.dataset.row === row) ?? all.find((x) => x.dataset.parts?.split(' ').includes(row))
    if (!el) return null
    const c = card.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    const scale = card.offsetHeight ? c.height / card.offsetHeight : 1
    if (!scale) return null
    return { top: (r.top - c.top) / scale, h: r.height / scale }
  }
  const endPoint = (id: string, row: string | undefined, toward: XY): XY => {
    const r = rowBox(id, row)
    if (!r) return centreOf(id)
    const b = boxOf(id)
    return { x: toward.x > b.x + b.w / 2 ? b.x + b.w : b.x, y: b.y + r.top + r.h / 2 }
  }
  function endsOf(l: BoardLink): [XY, XY] {
    // Two rows on one card: both ends on its right edge, the string loops out beside it.
    if (l.from === l.to) {
      const right = { x: Number.MAX_SAFE_INTEGER, y: 0 }
      return [endPoint(l.from, l.fromRow, right), endPoint(l.to, l.toRow, right)]
    }
    return [endPoint(l.from, l.fromRow, centreOf(l.to)), endPoint(l.to, l.toRow, centreOf(l.from))]
  }
  /** The control point: saved (or being bent), else a gentle sag that grows with length. */
  const controlOf = (l: BoardLink, A: XY, B: XY): XY => {
    const bend = bending?.id === l.id ? bending.bend : l.bend
    const mid = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 }
    if (bend) return { x: mid.x + bend.x, y: mid.y + bend.y }
    if (l.from === l.to) return { x: mid.x + 48 + Math.abs(B.y - A.y) * 0.35, y: mid.y }
    return { x: mid.x, y: mid.y + Math.min(80, 16 + Math.hypot(B.x - A.x, B.y - A.y) * 0.12) }
  }
  const curveAt = (A: XY, C: XY, B: XY, t: number): XY => ({
    x: (1 - t) ** 2 * A.x + 2 * t * (1 - t) * C.x + t * t * B.x,
    y: (1 - t) ** 2 * A.y + 2 * t * (1 - t) * C.y + t * t * B.y,
  })
  /** Grab a string: it's picked; dragging bends it at the point under the finger. */
  const onStringDown = (l: BoardLink, at?: number) => (e: RPointerEvent) => {
    e.stopPropagation()
    if (linking) return
    setPickedLink(l.id)
    pointers.current.set(e.pointerId, local(e))
    if (pointers.current.size === 2) return startPinch()
    let t = at ?? 0.5
    if (at === undefined) {
      const c = camRef.current
      const q = local(e)
      const P = { x: (q.x - c.x) / c.k, y: (q.y - c.y) / c.k }
      const [A, B] = endsOf(l)
      const C = controlOf(l, A, B)
      let best = Infinity
      for (let i = 1; i < 40; i++) {
        const pt = curveAt(A, C, B, i / 40)
        const d = Math.hypot(pt.x - P.x, pt.y - P.y)
        if (d < best) { best = d; t = i / 40 }
      }
    }
    gesture.current = { type: 'bend', link: l, t: Math.min(0.85, Math.max(0.15, t)), start: local(e), moved: false }
    view.current?.setPointerCapture(e.pointerId)
  }

  // Short, quiet messages: a tick that changed the plan, a pinned paper that won't move.
  const toastTimer = useRef<number | undefined>(undefined)
  const flash = (text: string) => {
    setToast(text)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2200)
  }
  const replanned = () => flash("Today's plan updated")
  useEffect(() => () => window.clearTimeout(toastTimer.current), [])

  if (!plan) return null
  const todayItems = new Set(
    todayTasks.filter((t) => t.status === 'pending').flatMap((t) => (t.items ?? []).map((i) => `${t.resourceId}:${i}`)),
  )
  const far = cam.k < FAR_K
  const empty = papers.length === 0 && board.notes.length === 0 && board.lists.length === 0
  const ids = new Set(allIds())
  const links = board.links.filter((l) => ids.has(l.from) && ids.has(l.to))
  const picked = links.find((l) => l.id === pickedLink)

  const holder = (id: string, children: ReactNode, width: number, label: string) => {
    const p = posOf(id)
    const pinned = board.pins.includes(id)
    const lifted = drag?.id === id
    const source = linking?.from?.id === id && !linking.from.row
    const sourceRow = linking?.from?.id === id ? linking.from.row : undefined
    const lit = picked && (picked.from === id || picked.to === id)
    const litRows = picked ? [picked.from === id ? picked.fromRow : undefined, picked.to === id ? picked.toRow : undefined].filter((r): r is string => !!r) : []
    const tone = picked ? toneVar(picked.tone) : ''
    return (
      <div
        key={id}
        ref={(el) => { if (el) nodes.current.set(id, el); else nodes.current.delete(id) }}
        onPointerDown={onItemDown(id)}
        className={`absolute touch-none select-none rounded-lg ${lifted ? 'z-20 cursor-grabbing' : focused === id ? 'z-10' : ''} ${linking ? 'cursor-crosshair' : ''} ${source ? 'outline-2 outline-offset-4 outline-solid outline-accent' : ''}`}
        style={{
          left: p.x, top: p.y, width,
          ...(lit ? { outline: `2px solid ${tone}`, outlineOffset: 4 } : {}),
          transition: 'outline-color 200ms var(--ease-out)',
        }}
      >
        {children}
        {[...litRows, ...(sourceRow ? [sourceRow] : [])].map((r) => (
          <RowGlow key={r} rect={rowBox(id, r)} color={sourceRow === r ? 'var(--accent)' : tone} />
        ))}
        <PinMark pinned={pinned} scale={1 / cam.k} label={far && id.startsWith('note-') ? label : undefined} card={() => nodes.current.get(id)?.firstElementChild as HTMLElement | null} />
        {(far || linking) && <div className="absolute inset-0 cursor-pointer" aria-hidden />}
      </div>
    )
  }

  const cardProps = (id: string) => ({
    pinned: board.pins.includes(id),
    focused: focused === id,
    editing: editing === id,
    onEdit: (on: boolean) => { setEditing(on ? id : null); if (on) setFocused(id) },
    ticks: board.ticks,
    onReplan: replanned,
    k: cam.k,
  })

  return (
    <div className="fixed inset-0 flex flex-col pb-tabbar desktop:ps-sidebar desktop:pb-0">
      <Nav variant="side" />
      <header className="z-30 flex min-h-14 items-center gap-3 border-b border-line bg-bg px-5 tablet:px-8">
        <h1 className="text-title-3 font-semibold tracking-tight">Board</h1>
        <p className="hidden flex-1 truncate text-subhead text-muted tablet:block">Tick what you've done. Today's plan follows.</p>
        <span className="flex-1 tablet:hidden" />
        <AddMenu
          onNote={newNote}
          onList={newList}
          onLink={startLinking}
          canLink={ids.size >= 2}
          removed={removedPapers.map((p) => ({ id: p.id, label: `${board.edits[p.id]?.title || p.title} · ${p.kindLabel}` }))}
          onRestore={(id) => useDemo.getState().setPaperRemoved(id, false)}
        />
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
          {/* Strings sit under the papers, so they seem tied to them and never cover a tick. */}
          <svg className="pointer-events-none absolute start-0 top-0 overflow-visible" width="1" height="1" aria-hidden>
            {links.map((l) => {
              const [a, b] = endsOf(l)
              const c = controlOf(l, a, b)
              const d = `M ${a.x} ${a.y} Q ${c.x} ${c.y} ${b.x} ${b.y}`
              const on = l.id === pickedLink
              const color = toneVar(l.tone)
              return (
                <g key={l.id} style={{ opacity: picked && !on ? 0.35 : 1, transition: 'opacity 200ms var(--ease-out)' }}>
                  {on && <path d={d} fill="none" stroke={color} strokeOpacity={0.18} strokeWidth={9} strokeLinecap="round" vectorEffect="non-scaling-stroke" className="anim-fade" />}
                  <path d={d} fill="none" stroke={color} strokeWidth={on ? 2.5 : 1.75} strokeLinecap="round" vectorEffect="non-scaling-stroke" style={{ transition: 'stroke 200ms var(--ease-out)' }} />
                  {[a, b].map((pt, i) => <circle key={i} cx={pt.x} cy={pt.y} r={3 / cam.k} fill={color} />)}
                  <path
                    d={d}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={22}
                    vectorEffect="non-scaling-stroke"
                    className={`pointer-events-auto ${on ? 'cursor-move' : 'cursor-pointer'}`}
                    onPointerDown={onStringDown(l)}
                  >
                    <title>Tap to see what it links. Drag to bend it.</title>
                  </path>
                </g>
              )
            })}
          </svg>
          {papers.map((p) =>
            holder(p.id, (
              <PaperCard paper={p} edit={board.edits[p.id] ?? {}} todayItems={todayItems} {...cardProps(p.id)} />
            ), PAPER_W, `${p.title} · ${p.kindLabel}`),
          )}
          {board.lists.map((l) =>
            holder(l.id, <ListCard list={l} {...cardProps(l.id)} />, PAPER_W, l.title || 'Checklist'),
          )}
          {board.notes.map((n) =>
            holder(n.id, <NoteCard note={n} pinned={board.pins.includes(n.id)} focused={focused === n.id} onFocus={() => setFocused(n.id)} />, NOTE_W, n.text.split('\n')[0] || 'Note'),
          )}
          {picked && (() => {
            const [a, b] = endsOf(picked)
            const c = controlOf(picked, a, b)
            const mid = curveAt(a, c, b, 0.5)
            const current = picked.tone ?? 'string'
            // Near the top of the screen the bar opens below the string, so the header never covers it.
            const below = mid.y * cam.k + cam.y < 96
            // …and it stays inside the screen sideways (its width is about the same every time).
            const half = (barW || (picked.bend ? 330 : 240)) / 2
            const sx = mid.x * cam.k + cam.x
            const vw = viewSize().w
            const shift = (Math.min(Math.max(sx, half + 8), Math.max(half + 8, vw - half - 8)) - sx) / cam.k
            return (
              <>
                {/* The handle sits on the string's middle: grab it (or anywhere on the string) to bend. */}
                <span
                  onPointerDown={onStringDown(picked, 0.5)}
                  className="absolute z-30 size-11 cursor-move touch-none"
                  style={{ left: mid.x, top: mid.y, transform: `translate(-50%, -50%) scale(${1 / cam.k})` }}
                  aria-hidden
                >
                  <span className="anim-fade absolute inset-0 m-auto size-3.5 rounded-full border-2 bg-card shadow-paper" style={{ borderColor: toneVar(picked.tone) }} />
                </span>
                <div
                  ref={(el) => { if (el && el.offsetWidth !== barW) setBarW(el.offsetWidth) }}
                  role="toolbar"
                  aria-label="Link"
                  onPointerDown={(e) => e.stopPropagation()}
                  className="anim-fade absolute z-30 flex select-none items-center gap-1 rounded-lg bg-card ps-2 pe-1 shadow-lifted"
                  style={{ left: mid.x + shift, top: mid.y, transform: below ? `translate(-50%, 20px) scale(${1 / cam.k})` : `translate(-50%, calc(-100% - 20px)) scale(${1 / cam.k})`, transformOrigin: below ? '50% 0' : '50% 100%' }}
                >
                  {LINK_TONES.map((t) => (
                    <button
                      key={t.tone}
                      type="button"
                      aria-label={`Colour: ${t.label}`}
                      aria-pressed={current === t.tone}
                      title={t.label}
                      onClick={() => useDemo.getState().updateLink(picked.id, { tone: t.tone })}
                      className="press grid size-8 place-items-center rounded-full"
                    >
                      <span
                        className={`block size-5 rounded-full transition-[box-shadow,transform] duration-200 ease-[var(--ease-enter)] ${current === t.tone ? 'scale-110' : ''}`}
                        style={{ background: toneVar(t.tone), boxShadow: current === t.tone ? `0 0 0 2px var(--card), 0 0 0 4px ${toneVar(t.tone)}` : undefined }}
                      />
                    </button>
                  ))}
                  {picked.bend && (
                    <button
                      type="button"
                      onClick={() => useDemo.getState().updateLink(picked.id, { bend: undefined })}
                      className="ms-1 inline-flex min-h-11 items-center whitespace-nowrap rounded-md px-2 text-subhead font-medium text-muted hover:opacity-70 active:opacity-60"
                    >
                      Straighten
                    </button>
                  )}
                  <span className="mx-1 h-6 w-px bg-line" aria-hidden />
                  <button
                    type="button"
                    onClick={() => { useDemo.getState().removeLink(picked.id); setPickedLink(null) }}
                    aria-label="Remove link"
                    title="Remove link"
                    className="grid size-11 place-items-center rounded-md text-fg hover:opacity-70 active:opacity-60"
                  >
                    <Trash2 className="size-icon-sm" aria-hidden />
                  </button>
                </div>
              </>
            )
          })()}
        </div>

        {empty && (
          <p className="absolute inset-x-0 top-1/3 px-8 text-center text-callout text-muted">
            Your checklists appear here as you add lectures or videos. Add a note or a checklist to start.
          </p>
        )}

        {linking && (
          <div role="status" className="anim-fade absolute inset-x-0 top-3 z-30 mx-auto flex w-fit max-w-[calc(100%-2rem)] items-center gap-3 rounded-lg bg-card ps-4 pe-1 shadow-lifted" onPointerDown={(e) => e.stopPropagation()}>
            <p className="text-subhead font-medium text-fg">{linking.from ? 'Now tap what to link it to' : 'Tap the first thing to link'}</p>
            <button type="button" onClick={() => setLinking(null)} className="min-h-11 rounded-md px-3 text-subhead font-semibold text-accent hover:bg-accent-soft active:opacity-60">Cancel</button>
          </div>
        )}

        {toast && !linking && (
          <p role="status" className="anim-fade pointer-events-none absolute inset-x-0 top-3 z-30 mx-auto w-fit rounded-lg bg-card px-4 py-2 text-subhead font-medium text-fg shadow-paper">
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
        {focused && !linking && (
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

/** The one "+" on the Board: choose what to add. */
function AddMenu({ onNote, onList, onLink, canLink, removed, onRestore }: {
  onNote: () => void; onList: () => void; onLink: () => void; canLink: boolean
  removed: { id: string; label: string }[]; onRestore: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const menuId = useId()
  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); box.current?.querySelector<HTMLElement>('[aria-haspopup]')?.focus() }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const items = [...(box.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [])]
        const i = items.indexOf(document.activeElement as HTMLElement)
        items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
        e.preventDefault()
      }
    }
    window.addEventListener('pointerdown', away)
    window.addEventListener('keydown', key, true)
    return () => { window.removeEventListener('pointerdown', away); window.removeEventListener('keydown', key, true) }
  }, [open])
  const pick = (run: () => void) => () => { setOpen(false); run() }
  const item = 'flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-start text-body-sm text-fg hover:bg-surface active:opacity-60 disabled:text-faint disabled:hover:bg-transparent'
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-callout font-medium text-accent hover:opacity-70 active:opacity-60"
      >
        <Plus className="size-icon-sm" aria-hidden />
        Add
        <ChevronDown className={`size-icon-xs transition-transform duration-200 ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <div id={menuId} role="menu" aria-label="Add to the Board" className="anim-fade absolute end-0 top-full z-40 mt-1 w-64 rounded-lg bg-card p-1.5 shadow-lifted">
          <button type="button" role="menuitem" autoFocus onClick={pick(onNote)} className={item}>
            <StickyNote className="size-icon-sm text-muted" aria-hidden />
            <span className="flex-1">Note</span>
            <kbd className="hidden font-sans text-footnote text-faint desktop:inline">N</kbd>
          </button>
          <button type="button" role="menuitem" onClick={pick(onList)} className={item}>
            <ListChecks className="size-icon-sm text-muted" aria-hidden />
            <span className="flex-1">Checklist</span>
          </button>
          <button type="button" role="menuitem" disabled={!canLink} onClick={pick(onLink)} className={item}>
            <Link2 className="size-icon-sm text-muted" aria-hidden />
            <span className="flex-1">
              Link two things
              <span className="block text-footnote text-muted">Tie a note to the checklist it's about</span>
            </span>
          </button>
          {removed.length > 0 && (
            <>
              <p className="mt-1 border-t border-line px-3 pt-2 pb-1 text-footnote font-semibold text-muted">Put back on the Board</p>
              {removed.map((r) => (
                <button key={r.id} type="button" role="menuitem" onClick={pick(() => onRestore(r.id))} className={item}>
                  <Undo2 className="size-icon-sm text-muted" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{r.label}</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
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

const LINK_TONES: { tone: LinkTone; label: string }[] = [
  { tone: 'string', label: 'Grey' },
  { tone: 'accent', label: 'Blue' },
  { tone: 'good', label: 'Green' },
  { tone: 'warn', label: 'Amber' },
  { tone: 'weak', label: 'Coral' },
]
function toneVar(t?: LinkTone): string {
  return `var(--${t ?? 'string'})`
}

/** A soft wash over a linked row, so it's clear which topic or item a string ties to. */
function RowGlow({ rect, color }: { rect: { top: number; h: number } | null; color: string }) {
  if (!rect) return null
  return (
    <span
      className="anim-fade pointer-events-none absolute inset-x-2 rounded-md"
      style={{ top: rect.top, height: rect.h, background: `color-mix(in srgb, ${color} 16%, transparent)`, boxShadow: `inset 3px 0 0 ${color}` }}
      aria-hidden
    />
  )
}

/**
 * The pin that holds a paper in place: a small head on the top edge, the same screen size at every zoom.
 * It drops in and settles when pinned (the paper gives a little under it) and lifts away when unpinned.
 */
function PinMark({ pinned, scale, label, card }: { pinned: boolean; scale: number; label?: string; card: () => HTMLElement | null }) {
  const [shown, setShown] = useState(pinned)
  const head = useRef<HTMLSpanElement>(null)
  const first = useRef(true)
  useEffect(() => {
    const isFirst = first.current
    first.current = false
    if (pinned) {
      setShown(true)
      if (isFirst || !canAnimate()) return
      requestAnimationFrame(() => {
        if (head.current) play(head.current, [
          { transform: 'translateY(-16px) scale(1.5)', opacity: 0 },
          { transform: 'translateY(1px) scale(0.92)', opacity: 1, offset: 0.7 },
          { transform: 'translateY(0) scale(1)', opacity: 1 },
        ], { duration: 360, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' })
        const c = card()
        if (c) play(c, [{ transform: 'scale(1)' }, { transform: 'scale(0.985)', offset: 0.6 }, { transform: 'scale(1)' }], { duration: 360, easing: 'ease-out', fill: 'none', composite: 'add' })
      })
      return
    }
    if (isFirst) return
    if (!canAnimate() || !head.current) return setShown(false)
    const a = play(head.current, [
      { transform: 'translateY(0) scale(1)', opacity: 1 },
      { transform: 'translateY(-12px) scale(1.3)', opacity: 0 },
    ], { duration: 180, easing: 'ease-in', fill: 'forwards' })
    const t = window.setTimeout(() => setShown(false), 180)
    return () => { window.clearTimeout(t); a?.cancel?.() }
  }, [pinned])
  if (!shown) return null
  return (
    <div
      className="pointer-events-none absolute start-1/2 top-0 z-10 flex flex-col items-center"
      style={{ transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: '50% 50%' }}
      aria-hidden
    >
      <span ref={head} className="block size-3.5 rounded-full bg-accent" style={{ boxShadow: '0 0 0 2.5px var(--card), 0 1px 3px 1px rgb(0 0 0 / 0.22)' }} />
      {label && <span className="mt-1.5 max-w-48 truncate rounded-sm bg-card px-2 py-0.5 text-footnote font-semibold text-fg shadow-paper">{label}</span>}
    </div>
  )
}

function PinToggle({ id, pinned, onNote }: { id: string; pinned: boolean; onNote?: boolean }) {
  const label = pinned ? 'Unpin so it can move' : 'Pin in place'
  return (
    <button
      type="button"
      onClick={() => useDemo.getState().togglePin(id)}
      aria-pressed={pinned}
      aria-label={label}
      title={label}
      className={`-me-2 flex size-11 shrink-0 items-center justify-center hover:opacity-70 active:opacity-60 ${onNote ? (pinned ? 'text-on-note' : 'text-on-note-muted') : pinned ? 'text-accent' : 'text-faint'}`}
    >
      <Pin className={`size-icon-sm transition-transform duration-300 ease-[var(--ease-enter)] ${pinned ? '' : 'rotate-45'}`} fill={pinned ? 'currentColor' : 'none'} />
    </button>
  )
}

function Box({ on }: { on: boolean }) {
  return (
    <span
      className={`flex size-icon-md shrink-0 items-center justify-center rounded-sm border transition-colors duration-150 ${on ? 'border-accent bg-accent text-on-accent' : 'border-faint'}`}
      aria-hidden
    >
      {on && <Check className="size-icon-xs" strokeWidth={3} />}
    </span>
  )
}

/** One row of a checklist. A row with parts (a topic's videos) opens to tick each part on its own. */
interface Row {
  key: string
  label: string
  on: boolean
  toggle: () => void
  sub?: string
  today?: boolean
  head?: string
  parts?: { key: string; label: string; on: boolean; toggle: () => void }[]
  /** What editing it changes: a plan item (Board-only rename and hide), an extra item on a plan paper, or the student's own list. */
  owner: 'plan' | 'extra' | 'own'
  /** The text while editing (may be empty while the student retypes it). */
  raw: string
}

function Tick({ row, far }: { row: Row; far?: boolean }) {
  const [open, setOpen] = useState(false)
  // Zoomed out, a row is a line the length of its label: the paper keeps its shape and its progress shows at a glance.
  if (far) {
    return (
      <li data-row={row.key} className="flex min-h-11 items-center gap-3" aria-hidden>
        <span className={`size-icon-md shrink-0 rounded-sm ${row.on ? 'bg-accent' : 'border border-faint'}`} />
        <span className={`h-2.5 rounded-full ${row.on ? 'bg-accent-soft' : 'bg-line'}`} style={{ width: `${Math.min(100, 24 + row.label.length * 2.4)}%` }} />
      </li>
    )
  }
  const parts = row.parts && row.parts.length > 1 ? row.parts : undefined
  return (
    <li data-row={row.key} data-parts={parts?.map((p) => p.key).join(' ')}>
      <div className="flex items-center">
        <button
          type="button"
          role="checkbox"
          aria-checked={row.on ? true : parts?.some((p) => p.on) ? 'mixed' : false}
          onClick={row.toggle}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-start text-body-sm hover:opacity-70 active:opacity-60"
        >
          <Box on={row.on} />
          <span className={`min-w-0 flex-1 leading-snug ${row.on ? 'text-muted' : ''}`}>{row.label}</span>
          {row.today && !row.on && <span className="shrink-0 rounded-sm bg-accent-soft px-1.5 py-0.5 text-caption-1 font-medium text-accent">Today</span>}
          {row.sub && <span className="tnum shrink-0 text-footnote text-muted">{row.sub}</span>}
        </button>
        {parts && (
          <button
            type="button"
            aria-expanded={open}
            aria-label={`${open ? 'Hide' : 'Show'} the ${parts.length} parts of ${row.label}`}
            title={open ? 'Hide parts' : 'Show parts'}
            onClick={() => setOpen((o) => !o)}
            className="-me-2 flex size-11 shrink-0 items-center justify-center text-muted hover:opacity-70 active:opacity-60"
          >
            <ChevronDown className={`size-icon-sm transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>
      {parts && open && (
        <ul className="anim-rise ms-[0.6875rem] border-s border-line ps-4">
          {parts.map((p) => (
            <li key={p.key} data-row={p.key}>
              <button
                type="button"
                role="checkbox"
                aria-checked={p.on}
                onClick={p.toggle}
                className="flex min-h-11 w-full items-center gap-3 text-start text-subhead hover:opacity-70 active:opacity-60"
              >
                <Box on={p.on} />
                <span className={`min-w-0 flex-1 leading-snug ${p.on ? 'text-muted' : 'text-fg'}`}>{p.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

/** Editing a checklist: rename any row, delete it, add rows, rename the list, delete the list. */
interface Editor {
  title: string
  setTitle: (t: string) => void
  rename: (row: Row, text: string) => void
  reset?: (row: Row) => void
  remove: (row: Row) => void
  add: (text: string) => void
  /** Plan papers: rows hidden from the Board, and a way to bring them back. */
  hidden?: number
  restoreHidden?: () => void
  deleteLabel: string
  onDelete: () => void
  note?: string
}

function EditRows({ rows, editor }: { rows: Row[]; editor: Editor }) {
  const [draft, setDraft] = useState('')
  const [confirm, setConfirm] = useState(false)
  useEffect(() => {
    if (!confirm) return
    const t = window.setTimeout(() => setConfirm(false), 3000)
    return () => window.clearTimeout(t)
  }, [confirm])
  const add = () => {
    const t = draft.trim()
    if (!t) return
    editor.add(t)
    setDraft('')
  }
  return (
    <div data-nodrag>
      {editor.note && <p className="pt-2 text-footnote text-muted">{editor.note}</p>}
      <ul className="pt-1">
        {rows.map((r) => (
          <li key={r.key} className="flex min-h-11 items-center gap-2">
            <input
              value={r.raw}
              onChange={(e) => editor.rename(r, e.target.value)}
              onBlur={(e) => { if (!e.target.value.trim()) editor.reset?.(r) }}
              aria-label={`Rename ${r.label}`}
              placeholder={r.label}
              className="board-input min-w-0 flex-1 border-b border-transparent bg-transparent py-1.5 text-body-sm text-fg placeholder:text-faint focus:border-accent"
            />
            <button
              type="button"
              onClick={() => editor.remove(r)}
              aria-label={`Delete ${r.label}`}
              title="Delete"
              className="-me-2 flex size-11 shrink-0 items-center justify-center text-muted hover:text-weak active:opacity-60"
            >
              <Trash2 className="size-icon-sm" />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex min-h-11 items-center gap-2">
        <Plus className="size-icon-sm shrink-0 text-muted" aria-hidden />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          onBlur={add}
          placeholder="Add an item"
          aria-label="Add an item"
          className="board-input min-w-0 flex-1 border-b border-transparent bg-transparent py-1.5 text-body-sm text-fg placeholder:text-faint focus:border-accent"
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 border-t border-line pt-1">
        {!!editor.hidden && editor.restoreHidden && (
          <button type="button" onClick={editor.restoreHidden} className="inline-flex min-h-11 items-center text-subhead font-medium text-accent hover:opacity-70 active:opacity-60">
            Show {editor.hidden} hidden
          </button>
        )}
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => (confirm ? editor.onDelete() : setConfirm(true))}
          className="inline-flex min-h-11 items-center gap-2 text-subhead font-medium text-weak hover:opacity-70 active:opacity-60"
        >
          <Trash2 className="size-icon-sm" aria-hidden />
          {confirm ? 'Tap again to delete' : editor.deleteLabel}
        </button>
      </div>
    </div>
  )
}

interface CardProps {
  pinned: boolean; focused: boolean; editing: boolean; onEdit: (on: boolean) => void
  ticks: string[]; onReplan: () => void; k: number
}

/** The paper itself: title, progress, rows, the far-zoom label, and edit mode. Shared by plan papers and the student's own lists. */
function Paper({ id, title, rawTitle, kindLabel, rows, editor, pinned, focused, editing, onEdit, k, empty }: CardProps & {
  id: string; title: string; rawTitle: string; kindLabel: string; rows: Row[]; editor: Editor; empty?: string
}) {
  const far = k < FAR_K
  const total = rows.length
  const done = rows.filter((r) => r.on).length
  const pct = total ? (done / total) * 100 : 0
  let lastHead: string | undefined
  return (
    <article
      className={`relative overflow-hidden rounded-lg bg-card px-4 pb-3 shadow-paper ${focused ? 'shadow-lifted' : ''}`}
      aria-label={`${title} · ${kindLabel}`}
    >
      <header className={`flex items-center gap-2 pt-3 ${editing ? '' : 'cursor-grab'}`}>
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              value={rawTitle}
              onChange={(e) => editor.setTitle(e.target.value)}
              placeholder={title || 'Checklist name'}
              aria-label="Checklist name"
              className="board-input w-full border-b border-transparent bg-transparent py-0.5 text-callout font-semibold tracking-tight text-fg placeholder:text-faint focus:border-accent"
            />
          ) : (
            <h2 className="truncate text-callout font-semibold tracking-tight" title={title}>{title || 'Untitled checklist'}</h2>
          )}
          <p className="truncate text-footnote text-muted">{kindLabel} <span className="tnum">· {done} of {total}</span></p>
        </div>
        {editing ? (
          <button type="button" onClick={() => onEdit(false)} className="-me-2 min-h-11 shrink-0 rounded-md px-3 text-subhead font-semibold text-accent hover:bg-accent-soft active:opacity-60">
            Done
          </button>
        ) : (
          <>
            {(focused || !rows.length) && (
              <button
                type="button"
                onClick={() => onEdit(true)}
                aria-label={`Edit ${title || 'checklist'}`}
                title="Edit"
                className="flex size-11 shrink-0 items-center justify-center text-faint hover:opacity-70 active:opacity-60"
              >
                <Pencil className="size-icon-sm" />
              </button>
            )}
            <PinToggle id={id} pinned={pinned} />
          </>
        )}
      </header>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-line" aria-hidden>
        <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
      {editing ? (
        <EditRows rows={rows} editor={editor} />
      ) : (
        <div className="pt-1">
          {rows.length === 0 && empty && <p className="py-3 text-subhead text-muted">{empty}</p>}
          <ul>
            {rows.map((r) => {
              const head = r.head !== lastHead ? r.head : undefined
              lastHead = r.head
              return (
                <Fragment key={r.key}>
                  {head && !far && <li className="pt-2"><h3 className="text-footnote font-semibold tracking-wide text-muted">{head}</h3></li>}
                  <Tick row={r} far={far} />
                </Fragment>
              )
            })}
          </ul>
        </div>
      )}
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
              <p className="truncate text-footnote font-semibold leading-tight text-fg">{title || 'Checklist'}</p>
              <p className="tnum truncate text-caption-1 text-muted">{PAPER_W * k >= 150 ? `${kindLabel} · ` : ''}{done}/{total}</p>
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

const named = (name: string | undefined, fallback: string) => (name && name.trim() ? name : fallback)

/** A checklist that comes from the plan. Ticks change the plan; edits change only the Board. */
function PaperCard({ paper, edit, todayItems, ...card }: CardProps & { paper: Paper; edit: PaperEdit; todayItems: Set<string> }) {
  const s = useDemo.getState()
  const topics = useDemo((x) => x.plan?.topics)
  const { ticks, onReplan } = card
  const on = new Set(ticks)
  const base: (Omit<Row, 'label' | 'raw' | 'owner'> & { def: string })[] = []

  if (paper.kind === 'lectures' && paper.resource) {
    const r = paper.resource
    const set = doneLectures(r)
    const word = (r.unit?.[0] ?? 'lecture').replace(/^./, (c) => c.toUpperCase())
    for (let i = 0; i < Math.ceil(r.totalUnits); i++) {
      base.push({
        key: String(i),
        def: r.itemNames?.[i] ? `${i + 1}. ${r.itemNames[i]}` : `${word} ${i + 1}`,
        on: set.has(i),
        today: todayItems.has(`${r.id}:${i}`),
        toggle: () => { s.tickLecture(r.id, i, !set.has(i)); onReplan() },
      })
    }
  } else if (paper.kind === 'papers' && paper.resource) {
    const r = paper.resource
    const done = Math.floor(r.doneUnits)
    for (let i = 0; i < Math.ceil(r.totalUnits); i++) {
      base.push({ key: String(i), def: `Paper ${i + 1}`, on: i < done, toggle: () => { s.setPapersDone(r.id, i < done ? i : i + 1); onReplan() } })
    }
  } else if (paper.kind === 'videos' && paper.system && topics) {
    const watched = new Set(watchedIds(topics, paper.system))
    for (const g of watchChecklist(paper.system)) {
      const vids = g.videos.map((v) => v.id)
      const n = vids.filter((v) => watched.has(v)).length
      const all = n === vids.length
      base.push({
        key: g.topicId,
        def: g.topic,
        on: all,
        sub: vids.length > 1 ? `${n}/${vids.length}` : undefined,
        toggle: () => { s.setWatched(vids, !all); onReplan() },
        parts: g.videos.map((v) => ({
          key: v.id,
          label: v.title,
          on: watched.has(v.id),
          toggle: () => { s.setWatched([v.id], !watched.has(v.id)); onReplan() },
        })),
      })
    }
  } else if (paper.kind === 'ref') {
    for (const g of STEP1) {
      for (const it of g.items) {
        const tid = `step1:${it.id}`
        base.push({ key: it.id, head: g.head, def: it.text, on: on.has(tid), toggle: () => s.tickBoard(tid, !on.has(tid)) })
      }
    }
  }

  const hidden = new Set(edit.hidden ?? [])
  const names = edit.names ?? {}
  const rows: Row[] = base
    .filter((b) => !hidden.has(b.key))
    .map(({ def, ...b }) => ({ ...b, label: named(names[b.key], def), raw: names[b.key] ?? def, owner: 'plan' as const }))
  const lastHead = rows.length ? rows[rows.length - 1].head : undefined
  for (const it of edit.extra ?? []) {
    const tid = `x:${paper.id}:${it.id}`
    rows.push({
      key: `x:${it.id}`, label: it.text || 'Item', raw: it.text, on: on.has(tid), owner: 'extra', head: lastHead,
      toggle: () => s.tickBoard(tid, !on.has(tid)),
    })
  }

  const ed = (f: (e: PaperEdit) => PaperEdit) => s.editPaper(paper.id, f)
  const editor: Editor = {
    title: edit.title ?? paper.title,
    setTitle: (t) => ed((e) => ({ ...e, title: t })),
    rename: (row, text) => {
      if (row.owner === 'extra') {
        const id = row.key.slice(2)
        ed((e) => ({ ...e, extra: (e.extra ?? []).map((x) => (x.id === id ? { ...x, text } : x)) }))
      } else {
        ed((e) => ({ ...e, names: { ...(e.names ?? {}), [row.key]: text } }))
      }
    },
    // Cleared and left: back to the plan's own name.
    reset: (row) => {
      if (row.owner !== 'plan') return
      ed((e) => { const names = { ...(e.names ?? {}) }; delete names[row.key]; return { ...e, names } })
    },
    remove: (row) => {
      if (row.owner === 'extra') {
        const id = row.key.slice(2)
        ed((e) => ({ ...e, extra: (e.extra ?? []).filter((x) => x.id !== id) }))
        s.tickBoard(`x:${paper.id}:${id}`, false)
      } else ed((e) => ({ ...e, hidden: [...new Set([...(e.hidden ?? []), row.key])] }))
    },
    add: (text) => ed((e) => ({ ...e, extra: [...(e.extra ?? []), { id: newId(), text } satisfies BoardItem] })),
    hidden: hidden.size,
    restoreHidden: () => ed((e) => ({ ...e, hidden: [] })),
    deleteLabel: 'Remove from Board',
    onDelete: () => { card.onEdit(false); s.setPaperRemoved(paper.id, true) },
    note: paper.kind === 'ref' ? undefined : 'Changes here are for the Board only. Your plan keeps every item; ticks still update it.',
  }
  const title = named(edit.title, paper.title)
  return <Paper {...card} id={paper.id} title={title} rawTitle={edit.title ?? paper.title} kindLabel={paper.kindLabel} rows={rows} editor={editor} />
}

/** A checklist the student made. Everything about it is theirs to change. */
function ListCard({ list, ...card }: CardProps & { list: BoardList }) {
  const s = useDemo.getState()
  const on = new Set(card.ticks)
  const rows: Row[] = list.items.map((it) => {
    const tid = `${list.id}:${it.id}`
    return { key: it.id, label: it.text || 'Item', raw: it.text, on: on.has(tid), owner: 'own', toggle: () => s.tickBoard(tid, !on.has(tid)) }
  })
  const editor: Editor = {
    title: list.title,
    setTitle: (t) => s.updateList(list.id, { title: t }),
    rename: (row, text) => s.updateList(list.id, { items: list.items.map((x) => (x.id === row.key ? { ...x, text } : x)) }),
    remove: (row) => { s.updateList(list.id, { items: list.items.filter((x) => x.id !== row.key) }); s.tickBoard(`${list.id}:${row.key}`, false) },
    add: (text) => s.updateList(list.id, { items: [...useDemo.getState().board.lists!.find((l) => l.id === list.id)!.items, { id: newId(), text }] }),
    deleteLabel: 'Delete checklist',
    onDelete: () => { card.onEdit(false); s.removeList(list.id) },
  }
  return <Paper {...card} id={list.id} title={list.title} rawTitle={list.title} kindLabel="Checklist" rows={rows} editor={editor} empty="Nothing here yet. Tap the pencil to add items." />
}

function NoteCard({ note, pinned, focused, onFocus }: { note: BoardNote; pinned: boolean; focused: boolean; onFocus: () => void }) {
  const s = useDemo.getState()
  return (
    <div className={`flex min-h-56 flex-col rounded-md ${TONE_BG[note.tone]} shadow-paper`}>
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
        className="min-h-44 flex-1 resize-none bg-transparent px-4 pb-4 text-body-sm leading-snug note-text text-on-note placeholder:text-on-note/50"
      />
    </div>
  )
}
