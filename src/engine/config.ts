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

/** After any offer, the next one waits at least this many days (2 = never on back-to-back days). */
export const OFFER_GAP_DAYS = 2

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
 * Study happens in the evening and late at night (many push on after 10–11 PM), so busy time
 * inside STUDY_WINDOW counts in full; the window runs to the end of the study day (DAY_ENDS_HOUR).
 * Estimate, not evidence: TODO(review) from Phase 0 interviews. daytime busy time (a lecture at 10) only costs
 * some energy, so a 2 h morning lecture takes 30 min from the plan.
 * Busy time with no clock time counts in full.
 */
export const STUDY_WINDOW = { from: 16 * 60, to: 28 * 60 } as const // 16:00 → 04:00, the end of the study day
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

// ── The study day ──────────────────────────────────────────────────────────

/** A study day ends at this hour; work after midnight counts toward the previous day. */
export const DAY_ENDS_HOUR = 4

// ── Sharing time between goals (spec 4) ────────────────────────────────────

/** A goal's share of a day below this is saved up and planned every 2nd, 3rd… day instead. Estimate. */
export const MIN_GOAL_CHUNK = 20

/** Saving up never skips more than this many days in a row. */
export const MAX_GOAL_SKIP_DAYS = 4

/** Topics started on one day, so long days leave room to consolidate. Estimate. */
export const MAX_NEW_TOPICS_PER_DAY = 4

/** Question blocks on one day (each at most QBANK_MAX). Estimate. */
export const MAX_BLOCKS_PER_DAY = 2

/** A finished topic doesn't come back as new study within this many days (fixes and retests are exempt). */
export const TOPIC_REPEAT_DAYS = 7

// ── Exams (spec 5) ─────────────────────────────────────────────────────────

/** The day before an exam: one light review, at most this long and this share of the day. Estimates. */
export const EVE_MAX_MINUTES = 60
export const EVE_MAX_SHARE = 0.5
export const EVE_MIN_MINUTES = 15

/**
 * Wind-down before a uni exam: board goals shrink to Anki only.
 * WIND_DOWN_MAX_DAYS for rotations of WIND_DOWN_FULL_WEEKS or more; shorter rotations get
 * WIND_DOWN_SHARE of their length, at least WIND_DOWN_MIN_DAYS. Estimates; a template may override them.
 */
export const WIND_DOWN_MAX_DAYS = 7
export const WIND_DOWN_FULL_WEEKS = 4
export const WIND_DOWN_SHARE = 1 / 3
export const WIND_DOWN_MIN_DAYS = 2

// ── Uni goals: lectures, summaries, past papers (spec 4.2) ─────────────────
// Institution-specific values (how many papers, how long one takes) come from the
// university template; these are the engine-side defaults and shapes.

/** Minutes for one past paper, doing it and going over the misses. Estimate. */
export const PAPER_MINUTES = 60

/** A paper can be split over days in parts of at least this many minutes. */
export const PAPER_MIN_PART = 20

/**
 * Papers are spread over the last share of the prep time: PAPERS_WINDOW_SMALL for
 * PAPERS_SMALL_LECTURES or fewer lectures, PAPERS_WINDOW_LARGE for PAPERS_LARGE_LECTURES or more,
 * in between linearly. Estimates.
 */
export const PAPERS_WINDOW_SMALL = 1 / 2
export const PAPERS_WINDOW_LARGE = 1 / 3
export const PAPERS_SMALL_LECTURES = 10
export const PAPERS_LARGE_LECTURES = 30

/** Paper k of N is due (k/N)^PAPERS_BACKLOAD of the way through the window: under 1 = denser near the exam. */
export const PAPERS_BACKLOAD = 0.7

/** The last paper is due this many days before the exam, so the eve reviews its mistakes. */
export const PAPERS_LAST_BEFORE_EXAM_DAYS = 2

/** A lecture studied from its summary takes this share of the full time. Estimate (Omar: "feels fine, not sure"). */
export const SUMMARY_SHARE = 0.4

// ── Fix → retest loop limits (spec 6) ──────────────────────────────────────

export const MAX_RETESTS_PER_DAY = 2
export const MAX_FIXES_PER_DAY = 2
/** With a backlog (more than MAX_OPEN_LOOPS topics waiting), each limit is this many times higher. */
export const BACKLOG_LIMIT_FACTOR = 2

/** Fixes and retests together take at most this share of the study time left after Anki. Estimates. */
export const FIXLOOP_SHARE = 0.5
export const FIXLOOP_SHARE_BACKLOG = 0.75
/** More topics than this waiting → the bigger share. */
export const MAX_OPEN_LOOPS = 6

/** Retests failed in a row before the topic rests. */
export const MAX_RETEST_FAILS = 3
/** …for this many days, then a fresh pass. Estimate (spacing). */
export const PARK_DAYS = 14

/** Simulator check: outside a pause, a due retest shouldn't wait longer than this. */
export const RETEST_MAX_WAIT_DAYS = 14

// ── Rescue mode (spec 9) ───────────────────────────────────────────────────

/** "Reasonable extra time": minutes a day the normal "+X min a day" answer may ask for. Estimate. */
export const RESCUE_EXTRA_MINUTES = 30

/** No rescue offer with fewer study days than this left before the exam. */
export const RESCUE_MIN_DAYS_LEFT = 4

/** A gap smaller than this is never a rescue. */
export const RESCUE_MIN_SHORT_MINUTES = 120

/** After an answer, the offer isn't repeated for this many days. */
export const RESCUE_COOLDOWN_DAYS = 7

/** "Add time" is offered in steps of this many minutes, and never more than RESCUE_MAX_EXTRA a day. */
export const RESCUE_EXTRA_STEP = 15
export const RESCUE_MAX_EXTRA = 180

/** "Do more" plans as if the day had this much more time. */
export const DO_MORE_MINUTES = 60

/** Anki shortened to fit a busy day is never planned under this many minutes. */
export const ANKI_MIN_MINUTES = 10

/** With no other goal waiting, lectures run ahead of the day's need by at most this factor. Estimate. */
export const LECTURES_AHEAD = 1.5

/**
 * Lectures and papers all done before the exam: a short daily self-test on them keeps them
 * (retrieval practice, spaced). Minutes a day; doubled inside the wind-down. Estimate.
 */
export const UNI_REVIEW_MINUTES = 30

/** Lectures aim to be finished this share of the remaining days before the exam, leaving room for papers and recall. Estimate. */
export const LECTURES_DONE_BEFORE_SHARE = 0.2

/** The topic queue looks this many systems past the current one, so a system's last days aren't half empty. */
export const QUEUE_NEXT_SYSTEMS = 2

/** Rescue never leaves out more than this share of a board exam's topics. Estimate. */
export const RESCUE_MAX_DROP_SHARE = 0.3

/** Days of history used to estimate how much time fixes and retests take each day. */
export const LOOP_RESERVE_DAYS = 14

/** Lectures in one day when a uni exam has the whole day to itself. Estimate. */
export const LECTURES_MAX_PER_DAY = 4

/** The nearest exam takes at most this share of the study time when another goal is waiting (outside a wind-down). Estimate. */
export const SOONEST_MAX_SHARE = 0.7

/** One topic task is never longer than this; a longer topic continues as "part 2". Estimate (attention span). */
export const TOPIC_TASK_MAX_MINUTES = 90
