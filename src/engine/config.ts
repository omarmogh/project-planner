// Every planning assumption in one place. These are guesses until Phase 0
// interviews say otherwise: tune them here, the engine and tests follow.

// ── Question blocks ────────────────────────────────────────────────────────

/** Minutes per qbank question, answering + reading the explanation. */
export const QBANK_MINUTES_PER_QUESTION = 3

/** Smallest question block worth planning. Below this, the block is skipped for the day. */
export const QBANK_MIN = 10

/**
 * Early loop: a student with a question bank who hasn't done a block in Locus yet gets one short block
 * (this many questions) even while new topics are still being studied, so the first fix → retest
 * shows up in the first days (retrieval practice; the score is the signal the loop runs on).
 */
export const EARLY_BLOCK_QUESTIONS = 10
/** …offered on the first this many study days (days with a logged session for the goal). Estimate, TODO(review). */
export const EARLY_BLOCK_DAYS = 2

/** Largest block in one sitting (UWorld's own maximum is 40). */
export const QBANK_MAX = 40

/** Systems are only targeted once they have accuracy data; until then the block is mixed. */
export const MIXED_SYSTEM = 'Mixed'

// ── Accuracy ───────────────────────────────────────────────────────────────

/** Days of question blocks that count toward a system's accuracy. */
export const ACCURACY_WINDOW_DAYS = 30

/**
 * Results brought in from UWorld are history (all-time stats), not this month's work: they keep counting
 * for a system until the student's own recent blocks on it reach this many questions. Estimate.
 */
export const IMPORT_REPLACED_BY_QUESTIONS = 40

/** A block below this % (with no topics tapped) gets a fix. Also the "solid" line on Pace. */
export const WEAK_BELOW = 60

/**
 * A result logged with "Log a result" as a percent only (no question count) counts like this many questions
 * in accuracy. Estimate: about one block, so one exam score never outweighs weeks of blocks.
 */
export const OUTSIDE_DEFAULT_QUESTIONS = 20

/** After a test-like commitment (a quiz, a colloquium, an NBME) Today asks how it went for this many days. */
export const RESULT_ASK_DAYS = 2

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

/**
 * Most questions one report can hold. A full-length self-assessment (NBME, UWSA, a 200-question grand test)
 * is one report, never split up to fit the form.
 */
export const MAX_REPORT_QUESTIONS = 400

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
/** A new fix never lands on a day with no study time (busy all day, an exam): it moves to the next day with time, at most this many days on. */
export const FIX_MOVE_MAX_DAYS = 7

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
export const ROUGH_MIN_QUESTIONS = 40

/** A lighter day is offered at most this many times in any 7 days. After that: "Just the first task". */
export const LIGHT_OFFERS_PER_WEEK = 2

/** After any offer, the next one waits at least this many days (2 = never on back-to-back days). */
export const OFFER_GAP_DAYS = 2

/** Two offers declined in a row → no new offer for this many days. */
export const OFFER_DECLINED_BACKOFF_DAYS = 14

/**
 * Coming back after this many missed days, the first day back starts as a light day on its own (essentials
 * only near an exam): a full day after a long gap is what makes students close the app. "Do more" still adds.
 * Estimate, TODO(review).
 */
export const RETURN_GAP_DAYS = 3

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
 * Study happens in the evening and late at night (many push on after 10–11 PM). Busy time inside
 * STUDY_WINDOW counts in full only when the rest of the window can't hold the plan (see ROOM_UNTIL);
 * the window runs to the end of the study day (DAY_ENDS_HOUR).
 * Estimate, not evidence: TODO(review) from Phase 0 interviews. daytime busy time (a lecture at 10) only costs
 * some energy, so a 2 h morning lecture takes 30 min from the plan.
 * Busy time with no clock time counts in full.
 */
export const STUDY_WINDOW = { from: 16 * 60, to: 28 * 60 } as const // 16:00 → 04:00, the end of the study day
/**
 * When the student usually studies (Availability.studyWindow; default 'evening' = STUDY_WINDOW).
 * Minutes after midnight on the study day (past 24:00 = after midnight, up to the 4 AM day end).
 * 'mixed' = any time from the morning on. Estimates, TODO(review).
 */
export const STUDY_WINDOWS = {
  evening: STUDY_WINDOW,
  late: { from: 20 * 60, to: 28 * 60 },
  early: { from: 4 * 60, to: 12 * 60 },
  mixed: { from: 8 * 60, to: 28 * 60 },
} as const
/** Learning the window from timer start times: at least this many timed sessions… */
export const STUDY_WINDOW_LEARN_MIN = 10
/** …and at least this share of them starting inside one window; otherwise 'mixed'. */
export const STUDY_WINDOW_LEARN_SHARE = 0.6
/** Words that make busy time a hospital shift (daytime shift hours on a rotation day count 0: the student's hours are already "after hospital"). */
export const SHIFT_WORDS = /\b(ward|wards|shift|hospital|rounds?|clinic|duty|rotation|placement)\b|مناوب|مستشفى|دوام|راوند/i
export const DAYTIME_BUSY_SHARE = 0.25
/**
 * Busy time inside the study window only cuts the plan when the free part of the window is shorter
 * than the plan; the free part counts up to this time (01:00), not to the 4 AM day end, because few
 * students can start a 2 h plan at 2 AM. Otherwise it costs DAYTIME_BUSY_SHARE of its length (energy,
 * fatigue after duty). Estimate, TODO(review).
 */
export const ROOM_UNTIL = 25 * 60
/**
 * Busy time with no clock time ("Ward 6h"): we can't tell day from evening, so it counts at this share.
 * Between the daytime share and in full. Estimate, TODO(review).
 */
/**
 * When the student's waking day starts (minutes after midnight). Busy time with no clock time fills the waking
 * hours outside the study window first (to ROOM_UNTIL); only what's longer spills into the study window.
 * Estimate, TODO(review).
 */
export const WAKE_MINUTES = 8 * 60
export const UNTIMED_BUSY_SHARE = 0.5
/** One-off busy time at least this long (a long shift, a day on call) makes that day and the next count as rough. */
export const LONG_BUSY_MINUTES = 8 * 60

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

/**
 * Setup finished at or after this hour (and before DAY_ENDS_HOUR): the first day is one short task,
 * the same cut as a light day, and the full plan starts tomorrow. Nobody does a 3-hour plan at 11 PM. TODO(review)
 */
export const FIRST_NIGHT_FROM_HOUR = 21

// ── Sharing time between goals (spec 4) ────────────────────────────────────

/** A goal's share of a day below this is saved up and planned every 2nd, 3rd… day instead. Estimate. */
export const MIN_GOAL_CHUNK = 20

/** Saving up never skips more than this many days in a row. */
export const MAX_GOAL_SKIP_DAYS = 4

/** Topics started on one day, so long days leave room to consolidate. Estimate. */
export const MAX_NEW_TOPICS_PER_DAY = 4

/** Question blocks on one day (each at most QBANK_MAX). Estimate. */
export const MAX_BLOCKS_PER_DAY = 2

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
/** With a backlog (more than MAX_OPEN_LOOPS topics waiting), the limits stay; no new topic is started (this many a day) until the pile is back under the line. */
export const BACKLOG_LIMIT_FACTOR = 1
export const BACKLOG_NEW_TOPICS_PER_DAY = 0

/** A topic that rested PARK_DAYS and then failed MAX_RETEST_FAILS more times gets no further loop: it stays weak on Pace. */
export const MAX_PARKS = 1

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

/** Most lectures a student can enter for one subject. A big system can have 40–80. */
export const MAX_LECTURES = 200

/** Lectures in one day when a uni exam has the whole day to itself. Estimate. */
export const LECTURES_MAX_PER_DAY = 4
/**
 * Leftover time (growStep) adds a past paper early only when the next one is due within this many days
 * (or the lectures are done): papers stay spread over their window (spacing). Estimate.
 */
export const PAPER_GROW_AHEAD_DAYS = 7

/** The nearest exam takes at most this share of the study time when another goal is waiting (outside a wind-down). Estimate. */
export const SOONEST_MAX_SHARE = 0.7

/**
 * A firm uni exam within UNI_LEADS_DAYS leads the day when the board exam is undated (rough or "no idea")
 * or more than BOARD_FAR_AFTER_UNI_DAYS after it: the board goal keeps BOARD_SHARE_WHILE_UNI_LEADS of the
 * study time, the uni exam may use the rest (lectures run ahead). Time the uni exam can't use goes back. Estimates.
 */
export const UNI_LEADS_DAYS = 28
export const BOARD_FAR_AFTER_UNI_DAYS = 60
export const BOARD_SHARE_WHILE_UNI_LEADS = 0.3

/** One topic task is never longer than this; a longer topic continues as "part 2". Estimate (attention span). */
export const TOPIC_TASK_MAX_MINUTES = 90

// ── Fix sizes ──────────────────────────────────────────────────────────────

/** Minutes each kind of fix takes. Estimates. */
export const FIX_MINUTES = {
  reviewAndCards: 20, reviewWrong: 15, makeCards: 15, rereadSlides: 25, watchVideo: 25, readChapter: 20, readPathoma: 20, readAmboss: 15,
  blockReviewAndCards: 25, blockReview: 20,
} as const

/** Anki cards a fix asks for. */
export const FIX_CARDS = 5

/**
 * A fix still undone after the student studied on this many other days is let go: it leaves Today and its
 * retest goes ahead, because the retest is the real check. A fix nobody does must not sit on the list for a week. Estimate.
 */
export const FIX_LET_GO_STUDY_DAYS = 4

/** A fix answered "Partly" comes back tomorrow with the rest of its time, never under this. */
export const FIX_PARTLY_MIN_MINUTES = 10

/** Weak topics named in the exam-eve review. */
export const EVE_TOPICS = 3

/** For an exam without a firm date, new Anki cards are spread over at least this many days. */
export const ANKI_NEW_MIN_HORIZON_DAYS = 30

/** How far ahead the ready-by walk looks, and the fallback when there is no time at all. */
export const READY_HORIZON_DAYS = 1100
export const READY_FALLBACK_DAYS = 365

/** Ready more than this many days early: Pace says "well before the exam" with a month, not a day count that reads as fake precision. */
export const WELL_AHEAD_DAYS = 60

/** Each answered rescue offer for the same exam multiplies the wait before the next one by this. */
export const RESCUE_COOLDOWN_FACTOR = 2

/** New Anki cards a day never go above this: more can't be learned inside the review time. Estimate. */
export const ANKI_MAX_NEW_PER_DAY = 30

/** New cards a day when the student isn't sure how many are left: a steady pace, never derived from a made-up deck size. Estimate. */
export const ANKI_NEW_PER_DAY_UNSURE = 20

/** "Behind on reviews": extra review minutes a day, no new cards, for this many days. Estimates, TODO(review). */
export const ANKI_CATCHUP_EXTRA_MINUTES = 30
export const ANKI_CATCHUP_DAYS = 7

/** No new Anki cards this close to a firm exam: they wouldn't mature in time. Estimate. */
export const ANKI_NO_NEW_BEFORE_EXAM_DAYS = 7

/** "Move the date" is only offered when it moves by at least this many days. */
export const RESCUE_MIN_MOVE_DAYS = 3

/** An ignored rescue offer ("not now") comes back after this many days. */
export const RESCUE_DISMISS_DAYS = 14

/** The same system isn't targeted by the day's question block more than this many days in a row. */
export const BLOCK_SAME_SYSTEM_DAYS = 2

/** In the wind-down, the daily self-test on finished lectures may take up to this many minutes. Estimate. */
export const UNI_WIND_DOWN_REVIEW_MAX = 90

/** "Move the date" is only offered up to this many days later: past that it isn't a real option. Estimate. */
export const RESCUE_MAX_MOVE_DAYS = 60

// ── Retests too close to call ──────────────────────────────────────────────

/**
 * A retest that lands this many questions below the pass line (6 of 10) is too close to call:
 * one more right answer would have passed. The pass line itself passes. A few more questions settle it. Estimate.
 */
export const RETEST_BORDERLINE_QUESTIONS = 1

/** The extra questions, their minutes, and how many days later they are planned. Estimates. */
export const RETEST_CONFIRM_QUESTIONS = 5
export const RETEST_CONFIRM_MINUTES = 10
export const RETEST_CONFIRM_DELAY_DAYS = 1

/** Setup says so when the time given leaves at least this much of a dated exam's work (minutes) without time. */
export const SETUP_NOTE_MIN_SHORT_MINUTES = 120

/** Above this many extra minutes a day, Pace doesn't offer "+N min a day": it says the gap can't be closed by time alone. Estimate. */
export const GAP_MAX_EXTRA_PER_DAY = 90

/** A pasted results row with only a % (no question count) counts as this many questions, a short block's worth. Estimate. */
export const PCT_ONLY_QUESTIONS = 20

// ── Retests near the exam (E7) ─────────────────────────────────────────────

/**
 * A retest for an exam with a firm date lands at least this many days before it: the day before is light
 * review only and the exam day has nothing. Later retests move earlier; one that can't fit is left out.
 */
export const RETEST_BEFORE_EXAM_DAYS = 2

// ── Plan edits (E1) ────────────────────────────────────────────────────────

/** A passed uni exam's goal moves to the past this many days after its last sitting (after its rest day). */
export const RETIRE_AFTER_DAYS = 2

/**
 * Honest progress (batch 3). A task ticked after less than this share of its planned minutes asks
 * "How far did you get?" instead of counting as done. Estimate, TODO(review).
 */
export const EARLY_STOP_SHARE = 0.6
/** Ending a session keeps an unticked task's timer time once it has at least this many minutes. Below it, a false start. */
export const KEEP_SESSION_MINUTES = 5
