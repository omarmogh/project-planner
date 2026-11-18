import { describe, expect, it } from 'vitest'
import { addDays, parseCommitment } from '..'
import { TOPIC_ALIASES } from '../../data/topicAliases'

const T = '2026-11-15' // Sunday
const topics = [{ id: 'endo-diabetes', name: 'Diabetes' }, { id: 'cardio-heart-failure', name: 'Heart failure' }]
const p = (text: string) => parseCommitment(text, T, topics, TOPIC_ALIASES)

describe('parseCommitment: English', () => {
  it('"Seminar on DKA Thursday 3h" → deadline work, linked to Diabetes', () => {
    expect(p('Seminar on DKA Thursday 3h')).toEqual({
      kind: 'deadline', title: 'Seminar on DKA', date: '2026-11-19', from: null, to: null, minutes: 180, tag: 'uni', topicId: 'endo-diabetes', repeat: null,
    })
  })

  it('"Lecture 10–12" → busy today', () => {
    expect(p('Lecture 10–12')).toMatchObject({ kind: 'busy', title: 'Lecture', date: T, from: '10:00', to: '12:00', minutes: null, tag: 'uni' })
  })

  it('"Gym 6pm 1h" → busy 18:00–19:00, personal', () => {
    expect(p('Gym 6pm 1h')).toMatchObject({ kind: 'busy', title: 'Gym', date: T, from: '18:00', to: '19:00', tag: 'personal' })
  })

  it('ranges and times', () => {
    expect(p('gym 6-8pm')).toMatchObject({ from: '18:00', to: '20:00' })
    expect(p('Clinic 10-2 tomorrow')).toMatchObject({ kind: 'busy', date: addDays(T, 1), from: '10:00', to: '14:00' })
    expect(p('Lecture from 9:30 to 11')).toMatchObject({ from: '09:30', to: '11:00', title: 'Lecture' })
    expect(p('Meeting at 5 for 1.5h')).toMatchObject({ kind: 'busy', from: '17:00', to: '18:30' })
  })

  it('deadline words, days and dates', () => {
    expect(p('Case report due 20/11, about 2h')).toMatchObject({ kind: 'deadline', date: '2026-11-20', minutes: 120, title: 'Case report' })
    expect(p('Assignment due Nov 18 90 min')).toMatchObject({ kind: 'deadline', date: '2026-11-18', minutes: 90, title: 'Assignment' })
    expect(p('Presentation on heart failure tue 2h')).toMatchObject({ kind: 'deadline', date: '2026-11-17', topicId: 'cardio-heart-failure' })
    // A presentation at a set time is busy time, not work to prepare.
    expect(p('Presentation Thursday 10-11')).toMatchObject({ kind: 'busy', date: '2026-11-19' })
    expect(p('Sunday lecture 10-12').date).toBe(T) // today counts
  })

  it('a weekday next to a date: the date wins, and both leave the title', () => {
    expect(p('Call Tuesday 24 Nov')).toMatchObject({ date: '2026-11-24', title: 'Call' })
    expect(p('Seminar Thu 3 December 2h')).toMatchObject({ date: '2026-12-03', title: 'Seminar', minutes: 120 })
    expect(p('Anki 10 decks').date).toBe(null)
  })

  it('exams and assessments are university, not personal', () => {
    expect(p('Paeds internal assessment Tuesday 9am 2h').tag).toBe('uni')
    expect(p('OSCE Thursday 8-12').tag).toBe('uni')
  })

  it('USMLE tag', () => {
    expect(p('UWorld assessment Friday 3h').tag).toBe('usmle')
  })
})

describe('parseCommitment: Arabic and mixed', () => {
  it('"محاضرة 10-12"', () => {
    expect(p('محاضرة 10-12')).toMatchObject({ kind: 'busy', title: 'محاضرة', date: T, from: '10:00', to: '12:00', tag: 'uni' })
  })

  it('Arabic-Indic digits, days and lengths', () => {
    expect(p('محاضرة ١٠-١٢ بكرة')).toMatchObject({ kind: 'busy', date: addDays(T, 1), from: '10:00', to: '12:00' })
    expect(p('سمينار عن السكري يوم الخميس ٣ ساعات')).toMatchObject({ kind: 'deadline', date: '2026-11-19', minutes: 180, topicId: 'endo-diabetes', tag: 'uni', title: 'سمينار عن السكري' })
    expect(p('واجب بعد بكرة ساعتين')).toMatchObject({ kind: 'deadline', date: addDays(T, 2), minutes: 120, title: 'واجب' })
    expect(p('جيم الساعة 6 ساعة ونص')).toMatchObject({ kind: 'busy', from: '18:00', to: '19:30', tag: 'personal' })
    expect(p('نادي 7م')).toMatchObject({ kind: 'busy', from: '19:00' })
  })

  it('the student report: an evening shift range and the short spelling "سمنر"', () => {
    expect(p('مناوبة جراحة بكرا 4-9')).toMatchObject({ kind: 'busy', title: 'مناوبة جراحة', date: addDays(T, 1), from: '16:00', to: '21:00', tag: 'uni' })
    expect(p('مناوبة بكرا من 4 ل 9')).toMatchObject({ from: '16:00', to: '21:00' })
    expect(p('Shift tomorrow 4-9')).toMatchObject({ kind: 'busy', from: '16:00', to: '21:00', title: 'Shift' })
    expect(p('سمنر بكرا 3 ساعات')).toMatchObject({ kind: 'deadline', date: addDays(T, 1), minutes: 180, tag: 'uni', title: 'سمنر' })
  })

  it('a bare morning range stays in the morning', () => {
    expect(p('Lecture 8-11')).toMatchObject({ from: '08:00', to: '11:00' })
    expect(p('Clinic 9-1')).toMatchObject({ from: '09:00', to: '13:00' })
  })

  it('mixed English and Arabic', () => {
    expect(p('Seminar عن DKA الخميس 2h')).toMatchObject({ kind: 'deadline', date: '2026-11-19', minutes: 120, topicId: 'endo-diabetes' })
    expect(p('lecture بكرة 10-12')).toMatchObject({ kind: 'busy', date: addDays(T, 1), from: '10:00', title: 'Lecture' })
  })
})

describe('parseCommitment: what it can\'t read stays empty', () => {
  it('no kind, no day, no length', () => {
    expect(p('hmm')).toEqual({ kind: null, title: 'Hmm', date: null, from: null, to: null, minutes: null, tag: 'personal', topicId: null, repeat: null })
  })
  it('deadline work without a day leaves the day empty', () => {
    expect(p('Assignment 2h')).toMatchObject({ kind: 'deadline', date: null, minutes: 120 })
  })
  it('empty text', () => {
    expect(p('  ')).toMatchObject({ kind: null, title: '', date: null })
  })
})
