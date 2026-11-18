// Reads one line the student types ("Seminar on DKA Thursday 3h", "Lecture 10–12",
// "محاضرة 10-12", "Gym 6pm 1h") into a commitment preview. Local, no AI. Pure.
// Anything it can't read stays null: the preview's chips are then empty to fill in.

import { addDays, toDate, toISO, weekday } from './dates'
import type { CommitmentKind, CommitmentTag, ISODate } from './types'

export interface ParsedCommitment {
  kind: CommitmentKind | null
  title: string
  date: ISODate | null
  /** 'HH:MM' */
  from: string | null
  to: string | null
  minutes: number | null
  tag: CommitmentTag
  topicId: string | null
}

// Letters and digits around a match; \b doesn't work for Arabic.
const B = '(?<![\\p{L}\\p{N}])'
const E = '(?![\\p{L}\\p{N}])'
const re = (src: string) => new RegExp(`${B}(?:${src})${E}`, 'iu')

const MER = '(am|pm|a\\.m\\.|p\\.m\\.|ص|م|صباحا|صباحاً|مساء|مساءً|بالليل)'
const HM = '(\\d{1,2})(?:[:.](\\d{2}))?'

const PM = /^(pm|p\.m\.|م|مساء|مساءً|بالليل)$/i
const AM = /^(am|a\.m\.|ص|صباحا|صباحاً)$/i

/** Arabic-Indic and Persian digits → 0–9, dashes → "-". */
export function normalize(text: string): string {
  return text
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[‐-―−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Hour + meridiem → minutes after midnight. A bare 1–7 is afternoon (nobody has a lecture at 3 am). */
function toMinutes(h: number, m: number, mer?: string, bareIsPm = true): number | null {
  if (h > 24 || m > 59) return null
  if (mer && PM.test(mer) && h < 12) h += 12
  else if (mer && AM.test(mer) && h === 12) h = 0
  else if (!mer && bareIsPm && h >= 1 && h <= 7) h += 12
  return h * 60 + m
}

const hm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

const WEEKDAYS: [RegExp, number][] = [
  [re('sunday|sun'), 0], [re('monday|mon'), 1], [re('tuesday|tues|tue'), 2], [re('wednesday|wed'), 3],
  [re('thursday|thurs|thur|thu'), 4], [re('friday|fri'), 5], [re('saturday|sat'), 6],
  [re('(?:يوم\\s*)?(?:ال)?(?:أحد|احد)'), 0], [re('(?:يوم\\s*)?(?:ال)?(?:اثنين|إثنين)'), 1],
  [re('(?:يوم\\s*)?(?:ال)?(?:ثلاثاء|ثلاثا)'), 2], [re('(?:يوم\\s*)?(?:ال)?(?:أربعاء|اربعاء|اربعا)'), 3],
  [re('(?:يوم\\s*)?(?:ال)?خميس'), 4], [re('(?:يوم\\s*)?(?:ال)?(?:جمعة|جمعه)'), 5], [re('(?:يوم\\s*)?(?:ال)?سبت'), 6],
]

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
// Short or full month names only ("10 decks" isn't December).
const MONTH = '(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)(?:uary|ruary|ch|il|e|y|ust|t|tember|ober|ember)?\\.?'

const DEADLINE_STRONG = re('assignment|homework|hw|due|deadline|report|project|essay|paper|submit|submission|واجب|تسليم|تقرير|مشروع|بحث')
const DEADLINE_SOFT = re('seminar|presentation|present|talk|journal club|case presentation|سمينار|سيمنار|سمنر|سيمينار|عرض|تقديم|برزنتيشن|بريزنتيشن')
const BUSY = re('lecture|lectures|lec|class|lab|tutorial|gym|workout|clinic|rounds|ward|shift|meeting|appointment|شفت|شيفت|محاضرة|محاضره|محاضرات|كلاس|درس|جيم|نادي|دوام|عيادة|عياده|مناوبة|اجتماع|موعد')

const USMLE = re('uworld|usmle|step\\s?1|step\\s?2|step|nbme|amboss|pathoma|first aid|b&b|boards and beyond|sketchy|ستيب')
const UNI = re('lecture|lectures|lec|seminar|presentation|assignment|homework|exam|exams|quiz|test|assessment|viva|osce|mcq|midterm|finals?|clinic|rounds|ward|lab|tutorial|class|report|case|journal club|shift|محاضرة|محاضره|محاضرات|سمينار|سيمنار|سمنر|سيمينار|عرض|تقديم|واجب|امتحان|كويز|عيادة|جامعة|الجامعة|دوام|تقرير|مناوبة|شفت|شيفت')
const PERSONAL = re('gym|workout|family|friend|friends|dinner|lunch|wedding|party|haircut|jumuah|جيم|نادي|عيلة|عائلة|العيلة|عرس|صحاب|اصحاب|شخصي')

/** Little words left around removed dates and times: "Seminar on", "Lecture at", "محاضرة يوم". */
const CONNECTOR = /^(at|on|from|by|for|this|next|the|in|due|about|around|approx|roughly|حوالي|تقريبا|-|,|،|يوم|الساعة|الساعه|من|في|الى|إلى|بال|ب)$/iu

export interface TopicRef { id: string; name: string }

/** The topic the text mentions, by name or a common alias ("DKA" → Diabetes). Longest match wins. */
export function matchTopic(text: string, topics: TopicRef[], aliases: Record<string, string>): string | null {
  const lower = normalize(text).toLowerCase()
  const key = (x: string) => normalize(x).toLowerCase()
  const byName = new Map(topics.map((t) => [key(t.name), t]))
  const candidates: [string, TopicRef][] = [
    ...topics.map((t) => [key(t.name), t] as [string, TopicRef]),
    ...Object.entries(aliases).flatMap(([k, name]) => {
      const t = byName.get(key(name))
      return t ? [[key(k), t] as [string, TopicRef]] : []
    }),
  ].sort((a, b) => b[0].length - a[0].length)
  for (const [k, t] of candidates) {
    const esc = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (re(esc).test(lower)) return t.id
  }
  return null
}

/** Next date on that weekday, today included. */
function nextWeekday(today: ISODate, day: number): ISODate {
  return addDays(today, (day - weekday(today) + 7) % 7)
}

/** A day + month this year, or next year if it already passed. */
function dayMonth(today: ISODate, d: number, m: number): ISODate | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  const y = toDate(today).getUTCFullYear()
  const iso = (yy: number) => toISO(new Date(Date.UTC(yy, m - 1, d)))
  const thisYear = iso(y)
  if (toDate(thisYear).getUTCMonth() !== m - 1) return null
  return thisYear >= today ? thisYear : iso(y + 1)
}

export function parseCommitment(text: string, today: ISODate, topics: TopicRef[] = [], aliases: Record<string, string> = {}): ParsedCommitment {
  const src = normalize(text)
  let work = src
  /** First match of `rx` that `fn` accepts is cut out of the text (so the title is what's left). */
  const take = (rx: RegExp, fn: (m: RegExpExecArray) => boolean) => {
    const g = new RegExp(rx.source, rx.flags.includes('g') ? rx.flags : rx.flags + 'g')
    for (let m = g.exec(work); m; m = g.exec(work)) {
      if (fn(m)) {
        work = work.slice(0, m.index) + ' '.repeat(m[0].length) + work.slice(m.index + m[0].length)
        return true
      }
    }
    return false
  }

  let from: number | null = null
  let to: number | null = null
  let minutes: number | null = null
  let date: ISODate | null = null

  // Days. "بعد بكرة" before "بكرة".
  take(re('بعد\\s*(?:بكرة|بكره|بكرا|غدا|غداً|غدًا)'), () => ((date = addDays(today, 2)), true))
  if (!date) take(re('today|tonight|this evening|اليوم|الليلة|الليله'), () => ((date = today), true))
  if (!date) take(re('tomorrow|tmrw|tmr|بكرة|بكره|بكرا|غدا|غداً|غدًا'), () => ((date = addDays(today, 1)), true))
  // An explicit date wins over a weekday next to it: "Call Tuesday 24 Nov" is the 24th, not today.
  if (!date) take(re('(\\d{1,2})/(\\d{1,2})(?:/\\d{2,4})?'), (m) => !!(date = dayMonth(today, +m[1], +m[2])))
  if (!date) take(re(`(\\d{1,2})\\s*${MONTH}`), (m) => !!(date = dayMonth(today, +m[1], MONTHS.indexOf(m[2].toLowerCase()) + 1)))
  if (!date) take(re(`${MONTH}\\s*(\\d{1,2})`), (m) => !!(date = dayMonth(today, +m[2], MONTHS.indexOf(m[1].toLowerCase()) + 1)))
  // The weekday is still cut out of the title; it only sets the day when no date was given.
  for (const [rx, day] of WEEKDAYS) if (take(rx, () => (date ??= nextWeekday(today, day), true))) break

  // Time range: "10-12", "10:30–12", "6-8pm", "from 10 to 12", "من 10 الى 12".
  take(re(`(?:from\\s+|من\\s*)?${HM}\\s*${MER}?\\s*(?:-|to|till|until|الى|إلى|لـ|لل|ل)\\s*${HM}\\s*${MER}?`), (m) => {
    const endMer = m[6]
    let a = toMinutes(+m[1], +(m[2] ?? 0), m[3], !endMer)
    let b = toMinutes(+m[4], +(m[5] ?? 0), endMer)
    if (a === null || b === null) return false
    // "6-8pm": the start shares the end's afternoon.
    if (endMer && !m[3] && PM.test(endMer) && a < 12 * 60 && a + 12 * 60 <= b) a += 12 * 60
    // "4-9" with no am/pm: the start is read as 4 pm, so the end is 9 pm, not 9 am.
    if (!endMer && !m[3] && b <= a && b < 12 * 60 && b + 12 * 60 > a) b += 12 * 60
    if (b <= a) return false
    from = a
    to = b
    return true
  })

  // Lengths. Arabic phrases first ("ساعة ونص" before "ساعة").
  const len = (n: number) => () => ((minutes = n), true)
  if (minutes === null) take(re('(?:ساعة|ساعه)\\s*و\\s*(?:نص|نصف)'), len(90))
  if (minutes === null) take(re('(?:نص|نصف)\\s*(?:ساعة|ساعه)'), len(30))
  if (minutes === null) take(re('ربع\\s*(?:ساعة|ساعه)'), len(15))
  if (minutes === null) take(re('ساعتين|ساعتان'), len(120))
  // "الساعة 6" is a clock time, not a length.
  if (from === null) take(re(`(?:الساعة|الساعه|at|@)\\s*${HM}\\s*${MER}?`), (m) => (from = toMinutes(+m[1], +(m[2] ?? 0), m[3])) !== null)
  if (minutes === null) take(re('(\\d+(?:\\.\\d+)?)\\s*(?:ساعات|ساعة|ساعه)'), (m) => ((minutes = Math.round(+m[1] * 60)), true))
  if (minutes === null) take(re('(\\d+)\\s*(?:دقيقة|دقيقه|دقائق|دقايق|د)'), (m) => ((minutes = +m[1]), true))
  if (minutes === null) take(re('ساعة|ساعه'), len(60))
  if (minutes === null) {
    take(re('(\\d+(?:\\.\\d+)?)\\s*(?:h|hr|hrs|hour|hours)\\s*(?:(\\d{1,2})\\s*(?:m|min|mins|minutes)?)?'), (m) => {
      minutes = Math.round(+m[1] * 60) + +(m[2] ?? 0)
      return true
    })
  }
  if (minutes === null) take(re('(\\d+)\\s*(?:m|min|mins|minute|minutes)'), (m) => ((minutes = +m[1]), true))
  if (minutes === null) take(re('an hour|one hour|hour'), len(60))

  // Single clock time: "6pm", "18:00", "6م".
  if (from === null) take(re(`${HM}\\s*${MER}`), (m) => (from = toMinutes(+m[1], +(m[2] ?? 0), m[3])) !== null)
  if (from === null) take(re('(\\d{1,2}):(\\d{2})'), (m) => (from = toMinutes(+m[1], +m[2], undefined, false)) !== null)

  if (from !== null && to === null && minutes) to = from + minutes
  const clock = from !== null

  // Kind.
  let kind: CommitmentKind | null = null
  if (DEADLINE_STRONG.test(src) && !clock) kind = 'deadline'
  else if (DEADLINE_SOFT.test(src)) kind = clock ? 'busy' : 'deadline'
  else if (BUSY.test(src) || clock) kind = 'busy'
  else if (DEADLINE_STRONG.test(src)) kind = 'deadline'

  // Busy time without a day is today; deadline work without a day stays empty to pick.
  if (!date && kind === 'busy') date = today

  const topicId = matchTopic(src, topics, aliases)
  const tag: CommitmentTag = USMLE.test(src) ? 'usmle' : UNI.test(src) ? 'uni' : PERSONAL.test(src) ? 'personal' : topicId ? 'uni' : 'personal'

  // Connectors and filler left around the cut-out parts ("due", "about", stray commas) go.
  const isFiller = (w: string) => CONNECTOR.test(w.replace(/[,،]+$/u, '') || w)
  const words = work.split(/\s+/).filter(Boolean)
  while (words.length && isFiller(words[words.length - 1])) words.pop()
  while (words.length && isFiller(words[0])) words.shift()
  const rest = words.join(' ').replace(/\s+([,،])/g, '$1').replace(/[,،\s-]+$/u, '')
  const title = rest.charAt(0).toUpperCase() + rest.slice(1)

  // Busy time with clock times has no separate length; its length is to − from.
  return {
    kind,
    title,
    date,
    from: from !== null ? hm(from) : null,
    to: to !== null ? hm(to) : null,
    minutes: kind === 'busy' && from !== null && to !== null ? null : minutes,
    tag,
    topicId,
  }
}
