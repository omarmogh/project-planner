// Every planning assumption in one place. These are guesses until Phase 0
// interviews say otherwise: tune them here, the engine and tests follow.

// ── Your day ───────────────────────────────────────────────────────────────

/** Share of a normal day left after a night on call (0.7 = 70%). */
export const POST_CALL_FACTOR = 0.7

/** Minutes planned on a call day. Only Anki fits; nothing else is planned. */
export const CALL_DAY_MINUTES = 30

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
// Estimates are defaults; once the timer has enough finished topic tasks,
// timerFactor() scales them by how long the student really takes.

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

/** Finished topic tasks needed before the timer starts tuning estimates. */
export const TIMER_MIN_SESSIONS = 5

/** Timer tuning never shrinks estimates below / grows them above these factors. */
export const TIMER_FACTOR_MIN = 0.75
export const TIMER_FACTOR_MAX = 1.5

/** Days ahead used to average how much time a day has for the topic plan (ready-by date). */
export const PROJECTION_DAYS = 28
