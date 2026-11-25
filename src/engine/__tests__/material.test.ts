// Fixes use only material the topic is studied with, and name whole systems plainly (batch 3).
import { describe, expect, it } from 'vitest'
import { PATHOMA_CHAPTERS, PATHOMA_BY_TOPIC } from '../../data/resources/pathoma'
import { TOPICS, topicId } from '../../data/topics'
import { fixOptions, materialFor, systemTopic, topicPhrase, type GoalMaterial } from '../fixes'
import type { Topic } from '../types'

const ekg: Topic = { id: 'cardio-ekg', system: 'Cardio', name: 'EKG', status: 'weak', items: [{ source: 'bnb', title: 'EKG', minutes: 20 }, { source: 'firstaid', title: 'EKG', minutes: 15 }] }
const hf: Topic = { id: 'cardio-hf', system: 'Cardio', name: 'Heart failure', status: 'weak', items: [{ source: 'bnb', title: 'HF', minutes: 20 }, { source: 'pathoma', title: 'Cardiac pathology', minutes: 30 }] }
const m: GoalMaterial = { resources: [], materials: ['bnb', 'firstaid', 'pathoma'] }

describe('Pathoma by chapter', () => {
  it('maps only topics that exist, each once', () => {
    const all = new Set(Object.entries(TOPICS).flatMap(([sys, names]) => names.map((n) => topicId(sys, n))))
    const mapped = PATHOMA_CHAPTERS.flatMap((c) => c.topics.map(([s, n]) => topicId(s, n)))
    expect(mapped.filter((id) => !all.has(id))).toEqual([])
    expect(new Set(mapped).size).toBe(mapped.length)
    expect(PATHOMA_BY_TOPIC.size).toBe(mapped.length)
  })
})

describe('materialFor', () => {
  it('drops material the topic has no part in', () => {
    expect(materialFor(m, [ekg], [ekg, hf]).materials).toEqual(['bnb', 'firstaid'])
    expect(fixOptions('EKG', materialFor(m, [ekg], [ekg, hf])).some((o) => /pathoma/i.test(o.title))).toBe(false)
  })
  it('keeps what any of the topics uses', () => {
    expect(materialFor(m, [ekg, hf], [ekg, hf]).materials).toEqual(['bnb', 'firstaid', 'pathoma'])
  })
  it('uses the system for a whole-system topic', () => {
    expect(materialFor(m, [systemTopic('Cardio')], [ekg, hf]).materials).toEqual(['bnb', 'firstaid', 'pathoma'])
  })
  it('leaves material alone without item data', () => {
    expect(materialFor(m, [{ ...ekg, items: undefined }], [])).toEqual(m)
  })
})

describe('topicPhrase', () => {
  it('names a whole system by its system, once', () => {
    expect(topicPhrase([systemTopic('Cardio'), systemTopic('Renal')])).toBe('Cardio and Renal')
    expect(topicPhrase([systemTopic('Cardio'), systemTopic('Cardio')])).toBe('Cardio')
    expect(topicPhrase([hf])).toBe('heart failure')
  })
})

import { DEMO_TODAY, linaState } from '../../data/demo'
import { buildDay, reportTask, addDays, ANKI_CATCHUP_EXTRA_MINUTES, ANKI_NEW_PER_DAY_UNSURE } from '..'

describe('Anki numbers (batch 3)', () => {
  const T = DEMO_TODAY
  const base = linaState(DEMO_TODAY)
  const ankiOf = (s: typeof base) => buildDay(s, T).tasks.find((t) => t.kind === 'anki')
  it('"Not sure" plans a steady pace, never one from a made-up deck size, and never counts it down', () => {
    const s = { ...base, anki: { ...base.anki!, newCardsLeft: 3000, newCardsUnsure: true } }
    const task = ankiOf(s)!
    expect(task.amount).toBe(ANKI_NEW_PER_DAY_UNSURE)
    const out = reportTask(s, task, { result: 'done', cards: 100 }, T)
    expect(out.state.anki!.newCardsLeft).toBe(3000)
  })
  it('a reviews-only log takes no new cards off', () => {
    const task = ankiOf(base)!
    expect(task.amount).toBeGreaterThan(0)
    const left = base.anki!.newCardsLeft
    expect(reportTask(base, task, { result: 'done', cards: 100, newCards: false }, T).state.anki!.newCardsLeft).toBe(left)
    expect(reportTask(base, task, { result: 'done', cards: 100 }, T).state.anki!.newCardsLeft).toBe(left - task.amount!)
  })
  it('catching up: longer reviews, no new cards, back to normal after', () => {
    const s = { ...base, anki: { ...base.anki!, catchUpUntil: addDays(T, 6) } }
    const normal = ankiOf(base)!
    const catching = ankiOf(s)!
    expect(catching.amount).toBe(0)
    expect(catching.minutes).toBeGreaterThan(normal.minutes)
    expect(catching.minutes).toBeLessThanOrEqual(normal.minutes + ANKI_CATCHUP_EXTRA_MINUTES)
    const after = buildDay(s, addDays(T, 7)).tasks.find((t) => t.kind === 'anki')
    expect(after?.reason).not.toMatch(/Catching up/)
  })
})
