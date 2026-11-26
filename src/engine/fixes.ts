import { pct } from './accuracy'
import {
  FIX_AFTER_BLOCK_DAYS, FIX_CARDS, FIX_LET_GO_STUDY_DAYS, FIX_MINUTES, MIXED_SYSTEM, RETEST_AFTER_FIX_DAYS, RETEST_MINUTES, RETEST_QUESTIONS, WEAK_BELOW,
} from './config'
import { addDays } from './dates'
import { inSentence, listJoin, reasons } from './reasons'
import type { AnkiDeck, FixAction, ISODate, Material, Resource, Session, Task, Topic } from './types'

export interface BlockResult {
  date: ISODate
  goalId: string
  resourceId?: string
  system: string
  questions: number
  correct: number
  /** Topics the student tapped as weak. May be empty. */
  weakTopicIds: string[]
  /** Set for a topic task's questions: below WEAK_BELOW, that topic is the weak one. */
  topicId?: string
  /** The block's task id: keeps the fixes of two blocks on one day apart. */
  blockId?: string
  /** A uni paper: under the line with no taps, the weak topic is the whole subject (not a Step 1 system). */
  subjectTopic?: Topic
  /** A result logged from outside the plan: the reason names it ("NBME 1: 52%"). */
  label?: string
}

export interface FixOption {
  action: FixAction
  title: string
  minutes: number
}

export interface FixPlan {
  /**
   * 'topics' = tapped topics (or, after a mixed block, tapped systems);
   * 'system' = no taps but a system block < 60%;
   * 'block'  = no taps but a mixed block < 60%: review that block, nothing specific to retest.
   */
  scope: 'topics' | 'system' | 'block'
  topicIds: string[]
  /** Whole-system pseudo-topics that need to be added to the topic list. */
  newTopics: Topic[]
  fix: Task
  retest?: Task
  options: FixOption[]
}

/** Context a fix is planned from. */
export interface FixContext {
  topics: Topic[]
  resources: Resource[]
  anki?: AnkiDeck
  materials?: Material[]
  topicGoalId?: string
}

export interface GoalMaterial {
  resources: Resource[]
  anki?: AnkiDeck
  materials: Material[]
}

/** Only the material that belongs to this goal: a Step 1 fix never uses IM slides. */
export function goalMaterial(ctx: FixContext, goalId: string): GoalMaterial {
  return {
    resources: ctx.resources.filter((r) => r.goalId === goalId),
    anki: ctx.anki?.goalId === goalId ? ctx.anki : undefined,
    materials: ctx.topicGoalId === goalId ? ctx.materials ?? [] : [],
  }
}

/**
 * Narrow a goal's materials to the ones these topics are studied with: no "Re-read the Pathoma part on EKGs"
 * when Pathoma has no EKG chapter. A whole-system topic uses its system's topics. Without item data, unchanged.
 */
export function materialFor(m: GoalMaterial, topics: Topic[], all: Topic[]): GoalMaterial {
  const pool = topics.flatMap((t) => (t.items?.length ? [t] : all.filter((x) => x.system === t.system && x.items?.length)))
  if (!pool.length) return m
  const used = new Set<string>(pool.flatMap((t) => t.items!.map((i) => i.source)))
  return { ...m, materials: m.materials.filter((x) => used.has(x)) }
}

export function systemTopicId(system: string): string {
  return `sys-${system.toLowerCase()}`
}

export function systemTopic(system: string): Topic {
  return { id: systemTopicId(system), system, name: `${system}, overall`, status: 'weak', wholeSystem: true }
}

/** "heart failure", "heart failure and arrhythmias", "Cardio and Renal": a whole system is named by its system. */
export function topicPhrase(topics: Topic[]): string {
  return listJoin([...new Set(topics.map((t) => (t.wholeSystem ? t.system : inSentence(t.name))))])
}

/**
 * The Anki half of a fix, by the student's deck (spec 6). A ready-made deck (AnKing and the like) already has the cards:
 * the fix unsuspends them. Own cards: make them. Not said: "add", which fits both.
 */
export function cardsPhrase(anki: Pick<AnkiDeck, 'deck'>, on?: string): string {
  const where = on ? ` on ${on}` : ''
  if (anki.deck === 'premade') return on ? `unsuspend the Anki cards${where}` : 'unsuspend their Anki cards'
  return `${anki.deck === 'own' ? 'make' : 'add'} ${FIX_CARDS} Anki cards${where}`
}

const capital = (x: string) => x.charAt(0).toUpperCase() + x.slice(1)

/** After the student says which deck they use: a pending fix's Anki half is re-worded to match ("make" ↔ "unsuspend"). */
export function retitleCards(title: string, anki: Pick<AnkiDeck, 'deck'>): string {
  const lead = /^(?:Make|Add) \d+ Anki cards on (.+)$|^Unsuspend the Anki cards on (.+)$/.exec(title)
  if (lead) return capital(cardsPhrase(anki, lead[1] ?? lead[2]))
  return title.replace(/ and (?:(?:make|add) \d+ Anki cards|unsuspend their Anki cards)$/, ` and ${cardsPhrase(anki)}`)
}

/** Fixes for a mixed block with no taps: go back over that block. */
export function blockFixOptions({ resources, anki }: GoalMaterial, label?: string): FixOption[] {
  const out: FixOption[] = []
  // A result logged from outside names itself ("from NBME 1"); the review needs no QBank in Locus then.
  const from = label ? label : 'the mixed block'
  if (anki) out.push({ action: 'reviewAndCards', title: `Review your wrong answers from ${from} and ${cardsPhrase(anki)}`, minutes: FIX_MINUTES.blockReviewAndCards })
  out.push({ action: 'reviewWrong', title: `Review your wrong answers from ${from}`, minutes: FIX_MINUTES.blockReview })
  return label || resources.some((r) => r.type === 'qbank') ? out : out.slice(-1)
}

/**
 * The fixes this student can actually do, best first.
 * Pass only the material of the block's goal (see goalMaterial). Fixes name the topic, never a page or video number.
 */
export function fixOptions(phrase: string, { resources, anki, materials }: GoalMaterial): FixOption[] {
  const has = (t: Resource['type']) => resources.find((r) => r.type === t)
  const out: FixOption[] = []
  const qbank = has('qbank')
  if (qbank && anki) {
    out.push({ action: 'reviewAndCards', title: `Review your wrong ${phrase} answers and ${cardsPhrase(anki)}`, minutes: FIX_MINUTES.reviewAndCards })
  }
  if (qbank) out.push({ action: 'reviewWrong', title: `Review your wrong ${phrase} answers`, minutes: FIX_MINUTES.reviewWrong })
  // A uni goal's own questions: the past paper's missed questions are the best first fix.
  else if (has('papers')) out.push({ action: 'reviewWrong', title: `Go over the ${phrase} questions you missed in the paper`, minutes: FIX_MINUTES.reviewWrong })
  if (anki) out.push({ action: 'makeCards', title: capital(cardsPhrase(anki, phrase)), minutes: FIX_MINUTES.makeCards })
  const slides = has('slides')
  // The whole subject: "Re-read your IM slides", never "the IM slides on IM".
  const whole = slides && phrase.toLowerCase() === slides.name.replace(/ slides$/, '').toLowerCase()
  if (slides) out.push({ action: 'rereadSlides', title: whole ? `Re-read your ${slides.name}` : `Re-read the ${slides.name} on ${phrase}`, minutes: FIX_MINUTES.rereadSlides })
  if (materials.includes('bnb')) out.push({ action: 'watchVideo', title: `Rewatch the B&B videos on ${phrase}`, minutes: FIX_MINUTES.watchVideo })
  if (materials.includes('firstaid')) out.push({ action: 'readChapter', title: `Re-read the First Aid section on ${phrase}`, minutes: FIX_MINUTES.readChapter })
  if (materials.includes('pathoma')) out.push({ action: 'readPathoma', title: `Re-read the Pathoma part on ${phrase}`, minutes: FIX_MINUTES.readPathoma })
  if (materials.includes('amboss')) out.push({ action: 'readAmboss', title: `Read the AMBOSS article on ${phrase}`, minutes: FIX_MINUTES.readAmboss })
  if (out.length === 0) out.push({ action: 'reviewWrong', title: `Review your notes on ${phrase}`, minutes: FIX_MINUTES.reviewWrong })
  return out
}

export function retestTask(
  id: string, date: ISODate, goalId: string, system: string, topics: Topic[], sourceDate: ISODate, round: 1 | 2 = 1, fixId?: string,
): Task {
  return {
    id,
    date,
    kind: 'retest',
    goalId,
    system,
    topicIds: topics.map((t) => t.id),
    title: `Retest: ${RETEST_QUESTIONS} ${topicPhrase(topics)} questions`,
    detail: round === 2 ? 'Confirms it stuck' : undefined,
    reason: 'Retest',
    minutes: RETEST_MINUTES,
    amount: RETEST_QUESTIONS,
    status: 'pending',
    sourceDate,
    retestRound: round,
    fixId,
  }
}

export function fixTask(id: string, date: ISODate, goalId: string, system: string, topics: Topic[], option: FixOption, reason: string, sourceDate: ISODate): Task {
  return {
    id,
    date,
    kind: 'fix',
    goalId,
    system,
    topicIds: topics.map((t) => t.id),
    title: option.title,
    reason,
    minutes: option.minutes,
    status: 'pending',
    sourceDate,
    fixAction: option.action,
  }
}

/**
 * Decide whether a finished block needs a fix.
 * - Tapped topics become the weak topics (after a mixed block: tapped systems).
 * - No taps and < WEAK_BELOW → the fix covers the whole system
 *   (or, for a mixed block, a review of that block).
 * - Otherwise nothing to fix.
 * Fixes use only material from the block's goal. The fix lands FIX_AFTER_BLOCK_DAYS later,
 * the first retest RETEST_AFTER_FIX_DAYS after the fix.
 */
export function planFix(result: BlockResult, ctx: FixContext): FixPlan | null {
  const score = pct(result.correct, result.questions)
  const material = goalMaterial(ctx, result.goalId)
  const fixDate = addDays(result.date, FIX_AFTER_BLOCK_DAYS)
  const retestDate = addDays(fixDate, RETEST_AFTER_FIX_DAYS)
  const mixed = result.system === MIXED_SYSTEM
  let topics: Topic[]
  let newTopics: Topic[] = []
  let scope: FixPlan['scope']
  let reason: string

  const studied = result.topicId ? ctx.topics.find((t) => t.id === result.topicId) : undefined
  if (studied) {
    if (score >= WEAK_BELOW) return null
    topics = [studied]
    scope = 'topics'
    reason = reasons.topicScore(studied.name, score)
  } else if (result.weakTopicIds.length > 0) {
    // After a mixed block the chips are systems; each becomes a whole-system topic.
    if (mixed) {
      topics = result.weakTopicIds.map((sys) => ctx.topics.find((t) => t.id === systemTopicId(sys)) ?? systemTopic(sys))
      newTopics = topics.filter((t) => !ctx.topics.some((x) => x.id === t.id))
      reason = reasons.markedWeakSystems(result.weakTopicIds)
    } else {
      topics = ctx.topics.filter((t) => result.weakTopicIds.includes(t.id))
      reason = reasons.markedWeak(topics.map((t) => t.name))
    }
    scope = 'topics'
  } else if (score < WEAK_BELOW && mixed) {
    const options = blockFixOptions(material, result.label)
    const fix = fixTask(`fix-${result.date}-mixed${result.blockId ? `-${result.blockId}` : ''}`, fixDate, result.goalId, MIXED_SYSTEM, [], options[0], result.label ? reasons.resultScore(result.label, score) : reasons.blockScore('Mixed', score), result.date)
    return { scope: 'block', topicIds: [], newTopics: [], fix, options }
  } else if (score < WEAK_BELOW) {
    const id = result.subjectTopic?.id ?? systemTopicId(result.system)
    const existing = ctx.topics.find((t) => t.id === id)
    const topic = existing ?? result.subjectTopic ?? systemTopic(result.system)
    if (!existing) newTopics = [topic]
    topics = [topic]
    scope = 'system'
    reason = result.label ? reasons.resultScore(result.label, score) : result.subjectTopic ? reasons.paperScore(result.system, score) : reasons.blockScore(result.system, score)
  } else {
    return null
  }

  const options = fixOptions(topicPhrase(topics), materialFor(material, topics, ctx.topics))
  // After a mixed block with several systems tapped, the retest is mixed too,
  // so its score isn't credited to one system.
  const system = !mixed ? result.system : topics.length === 1 ? topics[0].system : MIXED_SYSTEM
  const key = `${result.date}-${result.system.toLowerCase()}-${topics.map((t) => t.id).join('+')}${mixed && result.blockId ? `-${result.blockId}` : ''}`
  return {
    scope,
    topicIds: topics.map((t) => t.id),
    newTopics,
    fix: fixTask(`fix-${key}`, fixDate, result.goalId, system, topics, options[0], reason, result.date),
    retest: retestTask(`retest-${key}`, retestDate, result.goalId, system, topics, result.date, 1, `fix-${key}`),
    options,
  }
}

/** "Change fix": swap the action, keep date, reason and topics. */
export function changeFix(fix: Task, option: FixOption): Task {
  return { ...fix, title: option.title, minutes: option.minutes, fixAction: option.action }
}

/** Topics that already have a pending fix or retest: they don't get a second loop. */
export function openLoopTopicIds(scheduled: Task[]): Set<string> {
  const ids = new Set<string>()
  for (const t of scheduled) {
    // Short reviews (a recall sweep, the "felt sure" note) have no action and no retest: they aren't loops.
    if (t.status !== 'pending' || !(t.kind === 'retest' || (t.kind === 'fix' && t.fixAction))) continue
    for (const id of t.topicIds ?? []) ids.add(id)
  }
  return ids
}

/**
 * A fix still undone after the student studied on FIX_LET_GO_STUDY_DAYS other days since it was due (spec 6):
 * it leaves the plan and its retest goes ahead. Days with no study (ill, away, an exam) never count.
 */
export function fixLetGo(fix: Task, sessions: Pick<Session, 'date' | 'imported'>[], today: ISODate): boolean {
  if (fix.kind !== 'fix' || fix.status !== 'pending' || fix.commitmentId) return false
  const days = new Set(sessions.filter((x) => !x.imported && x.date >= fix.date && x.date < today).map((x) => x.date))
  return days.size >= FIX_LET_GO_STUDY_DAYS
}

/** A new day: fixes left undone over FIX_LET_GO_STUDY_DAYS study days are let go, so their retests can go ahead. */
export function letGoFixes(scheduled: Task[], sessions: Pick<Session, 'date' | 'imported'>[], today: ISODate): Task[] {
  return scheduled.map((t) => (fixLetGo(t, sessions, today) ? { ...t, status: 'skipped' as const, letGo: true } : t))
}

/** A retest is due only once its fix is done or let go (and its own date has come). */
export function retestReady(retest: Task, scheduled: Task[]): boolean {
  if (!retest.fixId) return true
  const fix = scheduled.find((t) => t.id === retest.fixId)
  return !fix || fix.status === 'done' || !!fix.letGo
}
