import { describe, expect, it } from 'vitest'
import { DEFAULT_WEEKEND, weekendFor, weekendLabel } from '../../data/weekends'
import { countryList, searchUniversities, type UniversityData } from '../../data/universities'
import data from '../../data/universities/universities.json'
import { defaultAnswers, pickUniversity, rotationEnd, rotationEndAnswered, subjectExam } from '../../data/setup'
import { addDays, dayContext } from '..'

const T = '2026-11-15'
const unis = data as UniversityData

describe('weekend by country', () => {
  it('Fri–Sat in Jordan and most Arab countries', () => {
    for (const c of ['JO', 'SA', 'EG', 'IQ', 'KW', 'QA', 'BH', 'OM', 'DZ']) expect(weekendFor(c)).toEqual([5, 6])
  })
  it('Sat–Sun in the UAE, the US, Europe and anywhere unknown', () => {
    for (const c of ['AE', 'US', 'GB', 'DE', 'XX', undefined]) expect(weekendFor(c)).toEqual(DEFAULT_WEEKEND)
  })
  it('picking a university sets the weekend; the plan follows it', () => {
    const a = { ...defaultAnswers(), ...pickUniversity({ name: 'Mutah University', country: 'JO' }) }
    expect(a.weekendDays).toEqual([5, 6])
    const avail = { weekdayMinutes: 120, weekendMinutes: 240, weekendDays: a.weekendDays }
    expect(dayContext(avail, '2026-11-20').kind).toBe('weekend') // Friday
    expect(dayContext({ ...avail, weekendDays: weekendFor('AE') }, '2026-11-20').kind).toBe('normal')
  })
})

it('weekend labels read naturally', () => {
  expect(weekendLabel([5, 6])).toBe('Fri–Sat')
  expect(weekendLabel([0, 6])).toBe('Sat–Sun')
  expect(weekendLabel([5])).toBe('Fri')
  expect(weekendLabel([5, 0])).toBe('Fri, Sun')
})

describe('university search', () => {
  it('finds Mutah however it is typed', () => {
    for (const q of ['mutah', "Mu'tah", 'MUTAH univ']) expect(searchUniversities(unis, q)[0]).toEqual({ name: 'Mutah University', country: 'JO' })
  })
  it('finds Arabic names, whatever the hamza or ة spelling', () => {
    for (const q of ['مؤتة', 'موته', 'جامعة مؤتة', 'جامعه موته']) expect(searchUniversities(unis, q)[0]?.name).toBe('Mutah University')
    expect(searchUniversities(unis, 'الاردنية')[0]?.name).toBe('University of Jordan')
    expect(searchUniversities(unis, 'اليرموك')[0]?.name).toBe('Yarmouk University')
  })
  it('knows short names: JUST', () => {
    expect(searchUniversities(unis, 'JUST')[0].name).toBe('Jordan University of Science and Technology')
  })
  it('nothing for one letter; every country listed for the fallback', () => {
    expect(searchUniversities(unis, 'm')).toEqual([])
    expect(countryList(unis).some((c) => c.code === 'JO' && c.name === 'Jordan')).toBe(true)
  })
})

describe('rotation end and exams per subject', () => {
  const a = (end: Parameters<typeof rotationEndAnswered>[0]) => ({
    ...defaultAnswers(), university: { name: 'Mutah University', country: 'JO' }, rotation: { subjects: [], end },
  })
  it('week chips count from today; a picked date is used as is', () => {
    expect(rotationEnd(a({ weeks: 2 }), T)).toBe(addDays(T, 14))
    expect(rotationEnd(a({ date: addDays(T, 10) }), T)).toBe(addDays(T, 10))
  })
  it('"This week" ends on the last workday before the weekend', () => {
    // T is Sunday 15 Nov 2026. Fri–Sat weekend → Thursday; Sat–Sun → Friday.
    expect(rotationEnd({ ...a({ weeks: 0 }), weekendDays: [5, 6] }, T)).toBe(addDays(T, 4))
    expect(rotationEnd({ ...a({ weeks: 0 }), weekendDays: [6, 0] }, T)).toBe(addDays(T, 5))
    // On the weekend itself: next week's last workday.
    expect(rotationEnd({ ...a({ weeks: 0 }), weekendDays: [5, 6] }, addDays(T, 5))).toBe(addDays(T, 11))
  })
  it('needs a chip, or a date that is not in the past', () => {
    expect(rotationEndAnswered(undefined, T)).toBe(false)
    expect(rotationEndAnswered({ date: '' }, T)).toBe(false)
    expect(rotationEndAnswered({ date: addDays(T, -1) }, T)).toBe(false)
    expect(rotationEndAnswered({ weeks: 1 }, T)).toBe(true)
  })
  it('exam at the end by default; otherwise its own date, or the end assumed', () => {
    const end = addDays(T, 20)
    expect(subjectExam({ key: 'im', name: 'IM', examAtEnd: true, lecturesLeft: 5 }, end)).toEqual({ date: end, source: 'set' })
    expect(subjectExam({ key: 'im', name: 'IM', examAtEnd: false, examDate: addDays(T, 12), lecturesLeft: 5 }, end)).toEqual({ date: addDays(T, 12), source: 'set' })
    expect(subjectExam({ key: 'im', name: 'IM', examAtEnd: false, examDate: 'dont-know', lecturesLeft: 5 }, end)).toEqual({ date: end, source: 'assumed' })
  })
})

describe('universal defaults', () => {
  const uni = data as unknown as UniversityData
  it('finds a university by its initials', () => {
    expect(searchUniversities(uni, 'just')[0].name).toBe('Jordan University of Science and Technology')
    // Ambiguous initials list every match; the device country decides the order.
    expect(searchUniversities(uni, 'MIT').map((u) => u.name)).toContain('Massachusetts Institute of Technology')
    expect(searchUniversities(uni, 'MIT', 8, 'US')[0].name).toBe('Massachusetts Institute of Technology')
    expect(searchUniversities(uni, 'ucla')[0].name).toBe('University of California, Los Angeles')
  })
  it('a name match prefers the device country, never hides the rest', () => {
    const jo = searchUniversities(uni, 'applied science', 8, 'JO')
    expect(jo[0].country).toBe('JO')
  })
  it('no university, no region: the global Sat–Sun weekend', () => {
    expect([...defaultAnswers().weekendDays].sort()).toEqual([0, 6])
    expect([...defaultAnswers('JO').weekendDays].sort()).toEqual([5, 6])
  })
})
