// Every planning assumption in one place. These are guesses until Phase 0
// interviews say otherwise: tune them here, the engine and tests follow.

// ── Question blocks ────────────────────────────────────────────────────────

/** Minutes per qbank question, answering + reading the explanation. */
export const QBANK_MINUTES_PER_QUESTION = 3

/** Smallest question block worth planning. Below this, the block is skipped for the day. */
export const QBANK_MIN = 10

/** Largest block in one sitting (UWorld's own maximum is 40). */
export const QBANK_MAX = 40

/** Systems are only targeted once they have accuracy data; until then the block is mixed. */
export const MIXED_SYSTEM = 'Mixed'

// ── Accuracy ───────────────────────────────────────────────────────────────

/** Days of question blocks that count toward a system's accuracy. */
export const ACCURACY_WINDOW_DAYS = 30

/** A block below this % (with no topics tapped) gets a fix. Also the "solid" line on Pace. */
export const WEAK_BELOW = 60

/** From here up to WEAK_BELOW a system shows as borderline (amber) on Pace. */
export const BORDERLINE_FROM = 55

// ── Fix → retest loop ──────────────────────────────────────────────────────

/** Days from a block to its fix (1 = the fix lands tomorrow). */
export const FIX_AFTER_BLOCK_DAYS = 1

/** Days from the fix to the first retest. */
export const RETEST_AFTER_FIX_DAYS = 3

/** A retest at or above this % passes. */
export const RETEST_PASS = 70

/** After a passed first retest, days until the second one. Passing both = solid. */
export const CONFIRM_RETEST_AFTER_DAYS = 7

/** Questions in one retest. */
export const RETEST_QUESTIONS = 10

/** Minutes planned for a retest. Shorter than a normal block: only the misses get a close read. */
export const RETEST_MINUTES = 15

// ── Topics ─────────────────────────────────────────────────────────────────
// A study task is one topic, studied with the student's own resources.
// Estimates are defaults; estimates.ts blends them toward the student's own
// timer minutes after every finished task (see "Time estimates" below).

/**
 * Minutes per B&B video, including pauses and notes.
 * TODO(placeholder): the checklist averages 17.7 min per video; 20 adds a little for pausing.
 */
export const BNB_MINUTES_PER_VIDEO = 20

/** Minutes to read one First Aid section. TODO(placeholder). */
export const FIRST_AID_MINUTES_PER_SECTION = 20

/** Minutes for the Pathoma part of a topic. TODO(placeholder). */
export const PATHOMA_MINUTES_PER_TOPIC = 20

/** Minutes for the AMBOSS article on a topic. TODO(placeholder). */
export const AMBOSS_MINUTES_PER_TOPIC = 15

/** Qbank questions at the end of each topic ("then 10 UWorld questions on it"). */
export const TOPIC_QUESTIONS = 10

/** No study task shorter than this. Fixes and retests are exempt. */
export const MIN_TASK_MINUTES = 15

/** "Partly" counts as this share of the task done; the rest is planned first next time. */
export const PARTLY_SHARE = 0.5

/** Minutes per uni lecture of slides. TODO(placeholder). */
export const LECTURE_MINUTES = 30

/** Days ahead used to average how much time a day has for the topic plan (ready-by date). */
export const PROJECTION_DAYS = 28

/**
 * Uni exams within this many days of each other share the day's lecture time
 * in proportion to the lectures each has left (sooner exam first), instead of
 * the sooner one taking everything.
 */
export const CLOSE_EXAMS_DAYS = 3

// ── Time estimates ─────────────────────────────────────────────────────────
// No calibration mode: every finished task nudges its kind's estimate.
// Each estimate is a factor on the config defaults above (1 = as configured).
// After a finished task with ratio r = actual timer minutes / planned minutes:
//
//   step   = (r − factor) / (ESTIMATE_PRIOR_SESSIONS + n)      n = sessions counted so far, incl. this one
//   step   = clamp(step, −ESTIMATE_MAX_STEP, +ESTIMATE_MAX_STEP)
//   factor = clamp(factor + step, ESTIMATE_MIN, ESTIMATE_MAX)
//
// So the config default counts like ESTIMATE_PRIOR_SESSIONS sessions of data:
// the first real session moves the estimate 1/4 of the way, the 10th about 1/13,
// and the factor ends up close to the running average of the student's real times.

/** How many sessions the config default is "worth" against real timer data. */
export const ESTIMATE_PRIOR_SESSIONS = 3

/** A task that ran this many times longer than planned (left running) or this many times shorter is ignored. */
export const ESTIMATE_OUTLIER_RATIO = 3

/** One session never moves an estimate by more than this (0.1 = 10 percentage points of the default). */
export const ESTIMATE_MAX_STEP = 0.1

/** Estimates never go below / above these factors of the config defaults. */
export const ESTIMATE_MIN = 0.6
export const ESTIMATE_MAX = 1.8

// ── Light days ─────────────────────────────────────────────────────────────
// When the last days were rough, Today offers a lighter day once. Never guilt.

/** Days back (plus today) the engine looks at for a rough patch. */
export const ROUGH_LOOKBACK_DAYS = 2

/** Skipped + "Partly" tasks in that window that count as a rough patch. */
export const ROUGH_MISSES = 2

/** Question % this many points below the student's usual (prior 14 days) counts as a rough patch. */
export const ROUGH_SCORE_DROP = 15

/** Days before the lookback window that set the student's usual %. */
export const ROUGH_BASELINE_DAYS = 14

/** Questions needed in both windows before a score drop counts. */
export const ROUGH_MIN_QUESTIONS = 20

/** A lighter day is offered at most this many times in any 7 days. After that: "Just the first task". */
export const LIGHT_OFFERS_PER_WEEK = 2

/** About this many minutes on a light day (always at least one task). */
export const LIGHT_DAY_MINUTES = 20

/** Within this many days of an exam a break is never offered: only the essentials. */
export const EXAM_PROTECT_DAYS = 5

/** Tasks kept on an "essentials only" day. */
export const ESSENTIAL_TASKS = 2

// ── Commitments ("things you have to do") ──────────────────────────────────
// They take time from the plan; the plan adapts around them. See commitments.ts.

/**
 * Busy time reduces the day's study time by this share of its length.
 * Study happens in the evening (TODO(review): from Phase 0 interviews), so busy time
 * inside STUDY_WINDOW counts in full; daytime busy time (a lecture at 10) only costs
 * some energy, so a 2 h morning lecture takes 30 min from the plan.
 * Busy time with no clock time counts in full.
 */
export const STUDY_WINDOW = { from: 16 * 60, to: 23 * 60 } as const
export const DAYTIME_BUSY_SHARE = 0.25

/** No deadline chunk shorter than this. */
export const DEADLINE_MIN_CHUNK = 30

/** Deadline work aims to finish this many days before the deadline when it fits (1 = the day before). */
export const DEADLINE_BUFFER_DAYS = 2

/** A topic linked to deadline work isn't planned separately until this many days after the deadline. */
export const TOPIC_LINK_DAYS = 7

/** "Had it" in a sweep, then under WEAK_BELOW in a block within this many days → one gentle note. */
export const CONFIDENCE_WINDOW_DAYS = 30

/** The short review added after that note (when no fix already covers the topic). */
export const CONFIDENCE_REVIEW_MINUTES = 15
