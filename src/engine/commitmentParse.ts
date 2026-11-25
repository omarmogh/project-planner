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
  /** Busy time that repeats on these weekdays (0 = Sunday); null = once. */
  repeat: number[] | null
  /** The last day busy time covers: a span ("today and tomorrow", "for 3 days") or the end of a repeat. */
  until: ISODate | null
  /** Busy time that takes the whole day ("whole day", a funeral, a trip). */
  allDay: boolean
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

// Weekday names without the word-boundary wrapper, so they can be combined into ranges and lists.
const DAY_SRC: [string, number][] = [
  ['sunday|sun', 0], ['monday|mon', 1], ['tuesday|tues|tue', 2], ['wednesday|wed', 3],
  ['thursday|thurs|thur|thu', 4], ['friday|fri', 5], ['saturday|sat', 6],
  ['(?:يوم\\s*)?(?:ال)?(?:أحد|احد)', 0], ['(?:يوم\\s*)?(?:ال)?(?:اثنين|إثنين)', 1],
  ['(?:يوم\\s*)?(?:ال)?(?:ثلاثاء|ثلاثا)', 2], ['(?:يوم\\s*)?(?:ال)?(?:أربعاء|اربعاء|اربعا)', 3],
  ['(?:يوم\\s*)?(?:ال)?خميس', 4], ['(?:يوم\\s*)?(?:ال)?(?:جمعة|جمعه)', 5], ['(?:يوم\\s*)?(?:ال)?سبت', 6],
]
const WEEKDAYS: [RegExp, number][] = DAY_SRC.map(([src, d]) => [re(src), d])
const ANY_DAY = `(?:${DAY_SRC.map(([src]) => src).join('|')})`
/** Which weekday a matched name is. */
const dayOf = (word: string) => DAY_SRC.find(([src]) => new RegExp(`^(?:${src})$`, 'iu').test(word.trim()))?.[1] ?? null

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
// Short or full month names only ("10 decks" isn't December).
const MONTH = '(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)(?:uary|ruary|ch|il|e|y|ust|t|tember|ober|ember)?\\.?'

const DEADLINE_STRONG = re('assignment|homework|hw|due|deadline|report|project|essay|paper|submit|submission|واجب|تسليم|تقرير|مشروع|بحث')
const DEADLINE_SOFT = re('seminar|presentation|present|talk|journal club|case presentation|سمينار|سيمنار|سمنر|سيمينار|عرض|تقديم|برزنتيشن|بريزنتيشن')
const BUSY = re('lecture|lectures|lec|class|lab|tutorial|tutoring|gym|workout|clinic|rounds|ward|shift|duty|on call|call|meeting|appointment|شفت|شيفت|محاضرة|محاضره|محاضرات|كلاس|درس|جيم|نادي|دوام|عيادة|عياده|مناوبة|اجتماع|موعد')

/** Things that happen once, not every week: a day range with one of these is this week only ("Funeral Mon to Wed"). */
const ONE_OFF = re('funeral|wedding|trip|travel|travelling|traveling|flight|vacation|holiday|holidays|conference|congress|exam|exams|sick|ill|visit|visiting|moving|away|out of town|عزاء|جنازة|جنازه|عرس|سفر|مسافر|مسافرة|رحلة|رحله|اجازة|إجازة|اجازه|عطلة|عطله|مريض|مريضة|مريضه|امتحان|امتحانات|مؤتمر|زيارة|زياره')
/** One-off things that fill the day when no time is given ("Wedding Thursday", "Sick today"). Exams and visits don't. */
const ALL_DAY_EVENT = re('funeral|wedding|trip|travel|travelling|traveling|flight|vacation|holiday|holidays|conference|congress|sick|ill|moving|away|out of town|عزاء|جنازة|جنازه|عرس|سفر|مسافر|مسافرة|رحلة|رحله|اجازة|إجازة|اجازه|عطلة|عطله|مريض|مريضة|مريضه|مؤتمر')
const ALL_DAY = re('whole day|all day|all-day|full day|entire day|the whole day|طول اليوم|كل اليوم|اليوم كله|اليوم كامل|يوم كامل')
/** Night words: bare hours in a range then mean evening → next morning ("Night duty 8-8"). */
const NIGHT = re('night|nights|overnight|nightshift|tonight|ليلي|ليلية|ليليه|سهر|سهرة|سهره|الليلة|الليله|بالليل')
const THIS_WEEK = re('this week|هذا الأسبوع|هذا الاسبوع|هالأسبوع|هالاسبوع')
const NEXT_WEEK = re('next week|الأسبوع الجاي|الاسبوع الجاي|الأسبوع القادم|الاسبوع القادم|الأسبوع الجاية')
const TODAY_W = 'today|tonight|this evening|اليوم|الليلة|الليله'
const TOMORROW_W = 'tomorrow|tmrw|tmr|بكرة|بكره|بكرا|غدا|غداً|غدًا'

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

/** `weekend`: the student's weekend days (0 = Sunday), so "weekdays" means their working days. */
export function parseCommitment(text: string, today: ISODate, topics: TopicRef[] = [], aliases: Record<string, string> = {}, weekend: number[] = [0, 6]): ParsedCommitment {
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

  let until: ISODate | null = null
  // "Whole day" before "اليوم" is read as today ("اليوم كله").
  const allDayWord = take(ALL_DAY, () => true)
  const thisWeek = take(THIS_WEEK, () => true)
  const nextWeek = !thisWeek && take(NEXT_WEEK, () => true)
  // Spans of days: "today and tomorrow", "tomorrow and the day after", "اليوم وبكرة".
  take(re(`(?:${TODAY_W})\\s*(?:and|&|to|till|until|-|و|ل|لل|الى|إلى)\\s*(?:${TOMORROW_W})`), () => ((date = today), (until = addDays(today, 1)), true))
  if (!date) take(re(`(?:${TOMORROW_W})\\s*(?:and|&|-|و)\\s*(?:the day after|day after|بعده|بعد\\s*(?:بكرة|بكره|بكرا|غدا))`), () => ((date = addDays(today, 1)), (until = addDays(today, 2)), true))

  // Days. "بعد بكرة" before "بكرة".
  take(re('بعد\\s*(?:بكرة|بكره|بكرا|غدا|غداً|غدًا)'), () => ((date = addDays(today, 2)), true))
  if (!date) take(re('today|tonight|this evening|اليوم|الليلة|الليله'), () => ((date = today), true))
  if (!date) take(re('tomorrow|tmrw|tmr|بكرة|بكره|بكرا|غدا|غداً|غدًا'), () => ((date = addDays(today, 1)), true))
  // "Duty today 7am to 7am tomorrow": a second day word only says where the time ends; it never stays in the title.
  if (date) while (take(re('today|tonight|tomorrow|tmrw|tmr|اليوم|الليلة|الليله|بكرة|بكره|بكرا|غدا|غداً|غدًا'), () => true));
  // How long it lasts in days: "for 3 days", "next 2 days", "لمدة 3 أيام" ("in 3 days" is a due date, not a span).
  let spanDays = 0
  take(re('(?:for|next|the next|for the next|over|لمدة|مدة)\\s*(\\d{1,2})\\s*(?:days|day|أيام|ايام|يوم)'), (m) => ((spanDays = +m[1]), spanDays >= 1))
  if (!spanDays) take(re('all week|whole week|the whole week|the week|طول الأسبوع|طول الاسبوع|كل الأسبوع|كل الاسبوع|الأسبوع كله|الاسبوع كله'), () => ((spanDays = 7), true))
  // "until Thursday", "till 5 Dec", "حتى الخميس": the last day. Taken before dates, so the start date isn't the end.
  // Not after a weekday ("Mon until Wed" is a day range).
  const untilDay = (word: string): ISODate | null => {
    const w = word.trim()
    if (new RegExp(`^(?:${TOMORROW_W})$`, 'iu').test(w)) return addDays(today, 1)
    const d = dayOf(w)
    if (d !== null) return nextWeekday(addDays(today, 1), d)
    const dm = /^(\d{1,2})\/(\d{1,2})(?:\/\d{2,4})?$/.exec(w)
    if (dm) return dayMonth(today, +dm[1], +dm[2])
    const a = new RegExp(`^(\\d{1,2})\\s*${MONTH}$`, 'iu').exec(w)
    if (a) return dayMonth(today, +a[1], MONTHS.indexOf(a[2].toLowerCase()) + 1)
    const b = new RegExp(`^${MONTH}\\s*(\\d{1,2})$`, 'iu').exec(w)
    if (b) return dayMonth(today, +b[2], MONTHS.indexOf(b[1].toLowerCase()) + 1)
    return null
  }
  take(re(`(?:until|till|til|through|thru|up to|حتى|لحد|لغاية|لغايه)\\s*(${TOMORROW_W}|${ANY_DAY}|\\d{1,2}/\\d{1,2}(?:/\\d{2,4})?|\\d{1,2}\\s*${MONTH}|${MONTH}\\s*\\d{1,2})`), (m) => {
    if (dayOf(m[1].trim()) !== null && new RegExp(`(?:${ANY_DAY})\\s*$`, 'iu').test(work.slice(0, m.index))) return false
    return !!(until = untilDay(m[1]))
  })

  // An explicit date wins over a weekday next to it: "Call Tuesday 24 Nov" is the 24th, not today.
  if (!date) take(re('(\\d{1,2})/(\\d{1,2})(?:/\\d{2,4})?'), (m) => !!(date = dayMonth(today, +m[1], +m[2])))
  if (!date) take(re(`(\\d{1,2})\\s*${MONTH}`), (m) => !!(date = dayMonth(today, +m[1], MONTHS.indexOf(m[2].toLowerCase()) + 1)))
  if (!date) take(re(`${MONTH}\\s*(\\d{1,2})`), (m) => !!(date = dayMonth(today, +m[2], MONTHS.indexOf(m[1].toLowerCase()) + 1)))
  // Repeats: "every day", "weekdays", "Mon–Sat", "Sun to Thu", "every Monday and Wednesday", "Tuesdays", "كل يوم", "من الأحد للخميس".
  let repeat: number[] | null = null
  /** A day range or list without "every": weekly or this week only, decided once the rest is read. */
  let days: number[] | null = null
  let rangeStart: number | null = null
  let rangeEnd: number | null = null
  const span = (a: number, b: number) => Array.from({ length: ((b - a + 7) % 7) + 1 }, (_, i) => (a + i) % 7)
  take(re('every\\s*day|everyday|daily|each day|كل\\s*يوم|يوميا|يومياً'), () => ((repeat = [0, 1, 2, 3, 4, 5, 6]), true))
  if (!repeat) take(re('weekdays|every\\s*weekday|ايام\\s*الدوام|أيام\\s*الدوام'), () => ((repeat = [0, 1, 2, 3, 4, 5, 6].filter((d) => !weekend.includes(d))), true))
  if (!repeat) {
    take(re(`(?:from\\s+|من\\s*)?(${ANY_DAY})\\s*(?:-|–|to|till|until|through|thru|الى|إلى|لل|ل)\\s*(${ANY_DAY})`), (m) => {
      const a = dayOf(m[1]), b = dayOf(m[2])
      if (a === null || b === null || a === b) return false
      days = span(a, b)
      rangeStart = a
      rangeEnd = b
      return true
    })
  }
  if (!repeat) {
    take(re(`(?:every|each|كل)\\s*(${ANY_DAY}(?:\\s*(?:,|،|/|&|and|و)\\s*${ANY_DAY})*)`), (m) => {
      const ds = m[1].split(/\s*(?:,|،|\/|&|\band\b|\sو)\s*/u).map(dayOf).filter((d): d is number => d !== null)
      if (!ds.length) return false
      repeat = [...new Set(ds)].sort((x, y) => x - y)
      return true
    })
  }
  // A list of two or more days without "every" ("Sun/Tue/Thu", "Sun, Tue and Thu") repeats on all of them.
  if (!repeat && !days) {
    take(re(`(${ANY_DAY}(?:\\s*(?:,|،|/|&|and|و)\\s*${ANY_DAY})+)`), (m) => {
      const ds = m[1].split(/\s*(?:,|،|\/|&|\band\b|\sو)\s*/u).map(dayOf).filter((d): d is number => d !== null)
      if (new Set(ds).size < 2) return false
      days = [...new Set(ds)].sort((x, y) => x - y)
      return true
    })
  }
  if (!repeat && !days) {
    take(re('(sundays|mondays|tuesdays|wednesdays|thursdays|fridays|saturdays)'), (m) => {
      const d = dayOf(m[1].slice(0, -1))
      if (d === null) return false
      repeat = [d]
      return true
    })
  }
  // A range said with a one-off thing or "this/next week" happens once: those days of one week.
  // Otherwise it's the student's week ("Ward Sun–Thu 8–2", "Lectures Sun, Tue") and repeats.
  const once = !!days && (ONE_OFF.test(src) || thisWeek || nextWeek)
  if (days && !once) repeat = days
  // "next week": from the first day of the student's next week (the day after their weekend).
  const weekStart = (Math.max(...(weekend.length ? weekend : [6])) + 1) % 7
  const from0 = nextWeek ? nextWeekday(addDays(today, 1), weekStart) : today
  const firstOf = (ds: number[], start: ISODate) => addDays(start, Math.min(...ds.map((d) => (d - weekday(start) + 7) % 7)))
  if (once && !date) {
    const ds = days as unknown as number[]
    // A range already under way ("Mon to Wed" said on Tuesday) starts today.
    date = rangeStart !== null && !nextWeek && ds.includes(weekday(today)) ? today : firstOf(ds, from0)
    // Its last day: the last named day within a week of the start.
    until = rangeEnd !== null ? nextWeekday(date as ISODate, rangeEnd) : addDays(date as ISODate, Math.max(...ds.map((d) => (d - weekday(date as ISODate) + 7) % 7)))
    // Only one of the days is left (said on its last day): just that day.
    if (until === date) {
      days = null
      until = null
    }
  }
  // A repeat starts on its next day, today included.
  if (repeat && !date) date = firstOf(repeat as number[], from0)

  // The weekday is still cut out of the title; it only sets the day when no date was given.
  for (const [rx, day] of WEEKDAYS) if (take(rx, () => (date ??= nextWeekday(from0, day), true))) break
  if (!date && nextWeek) date = from0

  // Time range: "10-12", "10:30–12", "6-8pm", "from 10 to 12", "من 10 الى 12".
  const night = NIGHT.test(src)
  take(re(`(?:from\\s+|من\\s*)?${HM}\\s*${MER}?\\s*(?:-|to|till|until|الى|إلى|لـ|لل|ل)\\s*${HM}\\s*${MER}?`), (m) => {
    const endMer = m[6]
    const h1 = +m[1], m1 = +(m[2] ?? 0), h2 = +m[4], m2 = +(m[5] ?? 0)
    if (!m[3] && !endMer) {
      if (h1 > 24 || h2 > 24 || m1 > 59 || m2 > 59) return false
      // "17:00-07:00", "08-14", "13-15": a leading zero or an hour past 12 means a 24-hour clock; the end before the start runs overnight.
      if (/^0\d/.test(m[1]) || /^0\d/.test(m[4]) || h1 > 12 || h2 > 12) {
        from = h1 * 60 + m1
        to = h2 * 60 + m2
        return true
      }
      // "Night duty 8-8", "Night shift 10-6": evening to the next morning.
      if (night) {
        const a = (h1 % 12 + 12) * 60 + m1 // 8 → 20:00, 12 → 24:00
        let b = (h2 % 12) * 60 + m2
        b = b + 12 * 60 > a ? b + 12 * 60 : b + 24 * 60
        from = a
        to = b
        return true
      }
    }
    let a = toMinutes(+m[1], +(m[2] ?? 0), m[3], !endMer)
    let b = toMinutes(+m[4], +(m[5] ?? 0), endMer)
    if (a === null || b === null) return false
    // "6-8pm": the start shares the end's afternoon.
    if (endMer && !m[3] && PM.test(endMer) && a < 12 * 60 && a + 12 * 60 <= b) a += 12 * 60
    // "4-9" with no am/pm: the start is read as 4 pm, so the end is 9 pm, not 9 am.
    if (!endMer && !m[3] && b <= a && b < 12 * 60 && b + 12 * 60 > a) b += 12 * 60
    // "Shift 7-3": still backwards, so the start was the morning (7 am–3 pm).
    if (!endMer && !m[3] && b <= a && a >= 12 * 60) {
      a -= 12 * 60
      if (b <= a) b += 12 * 60
    }
    // "10pm-2am", "7pm–7am": a night shift runs past midnight when the times say so.
    if (b <= a && !(m[3] && endMer) && !(night && endMer)) return false
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
  if (spanDays && !until) until = addDays(date ?? today, spanDays - 1)

  // Kind.
  let kind: CommitmentKind | null = null
  if (DEADLINE_STRONG.test(src) && !clock) kind = 'deadline'
  else if (DEADLINE_SOFT.test(src)) kind = clock ? 'busy' : 'deadline'
  else if (BUSY.test(src) || clock || repeat || days || allDayWord || ONE_OFF.test(src) || until) kind = 'busy'
  else if (DEADLINE_STRONG.test(src)) kind = 'deadline'

  // Busy time without a day is today; deadline work without a day stays empty to pick.
  if (!date && kind === 'busy') date = today
  if (until && date && until <= date && !repeat) until = null
  if (until && date && until < date) until = null
  // The whole day: said so, or a span of days / an all-day event with no time or length given.
  const multiDay = !!until && !repeat
  const allDay = kind === 'busy' && !clock && (allDayWord || (minutes === null && (multiDay || (!repeat && ALL_DAY_EVENT.test(src)))))

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
    minutes: kind === 'busy' && ((from !== null && to !== null) || allDay) ? null : minutes,
    tag,
    topicId,
    // Deadline work happens once; only busy time repeats or spans days.
    repeat: kind === 'deadline' ? null : repeat ?? (once ? days : null),
    until: kind === 'deadline' ? null : until,
    allDay,
  }
}
