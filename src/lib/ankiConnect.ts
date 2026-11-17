// Path B: a real, minimal AnkiConnect client (desktop add-on, http://127.0.0.1:8765).
// Every call fails quietly to null: the caller falls back to the student's own numbers (path A).
// In a browser it only works if the student added this site to AnkiConnect's webCorsOriginList;
// the Tauri desktop app (Phase 1) is where it is meant to live.

const URL = 'http://127.0.0.1:8765'
const TIMEOUT_MS = 1500

async function call<T>(action: string, params: Record<string, unknown> = {}): Promise<T | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(URL, { method: 'POST', body: JSON.stringify({ action, version: 6, params }), signal: ctrl.signal })
    if (!res.ok) return null
    const body = (await res.json()) as { result: T; error: string | null }
    return body.error ? null : body.result
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export interface AnkiStatus {
  /** New cards across all decks, from Anki itself. */
  newCards: number
  /** Reviews due today, from Anki itself. */
  dueToday: number
}

/** Reachable → Anki's real numbers; otherwise null. Nothing here is ever estimated. */
export async function checkAnki(): Promise<AnkiStatus | null> {
  const decks = await call<string[]>('deckNames')
  if (!decks) return null
  const stats = await call<Record<string, { name: string; new_count: number; review_count: number; learn_count: number }>>('getDeckStats', { decks })
  if (!stats) return null
  // A parent deck already counts its children: only top-level decks are summed.
  const all = Object.values(stats)
  const top = all.filter((d) => !d.name.includes('::'))
  const list = top.length ? top : all
  return {
    newCards: list.reduce((n, d) => n + d.new_count, 0),
    dueToday: list.reduce((n, d) => n + d.review_count + d.learn_count, 0),
  }
}

/** Cards reviewed today according to Anki, or null if Anki isn't reachable. */
export function reviewedToday(): Promise<number | null> {
  return call<number>('getNumCardsReviewedToday')
}

/** Phones have no AnkiConnect (AnkiDroid / AnkiMobile): the option isn't offered there. */
export function canConnectAnki(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return true
  return !window.matchMedia('(pointer: coarse) and (hover: none)').matches
}
