# Locus plan engine: specification

How the engine in `src/engine/` decides a day's plan. Plain language first, types and numbers where they matter.
Decisions and deviations made while building it are logged in `docs/ENGINE_NOTES.md`.

Three rules about the rules:

1. **Learning science, not one university.** Each major rule names the principle behind it. Where a number is an estimate and not evidence, it says *(estimate)*.
2. **Institution facts are data.** Rotation lengths, exam formats, past papers, lecture counts and weekends live in `src/data/universities/` (a global default plus one template per university) and `src/data/weekends.ts`. The engine never names a university.
3. **Every tunable number is in `src/engine/config.ts`** (or in a university template when it is institution-specific).

---

## 1. Data model

All engine functions are pure: `(state, date, …) → result`. No clock, no storage, no randomness. "Today" is a **study day** (section 2), passed in as `YYYY-MM-DD`.

### 1.1 What the student gives (stable)

| Type | Fields that matter | Notes |
|---|---|---|
| `Goal` | `id`, `kind` (`uni` or a board exam), `label`, `examDate`, `dateSource`, `windDownDays?`, `parts?` | `dateSource`: `set` (student gave it), `assumed` (uni exam assumed at rotation end), `rough` ("mid 2027"), `projected` ("no idea": the engine's ready-by date). **Firm** = `set` or `assumed`. `windDownDays` is filled at setup from the university template (section 5.2). `parts` are extra sittings of the same exam (`{ label: 'OSCE', date }`). A passed uni goal moves to `EngineState.pastGoals` (section 5.3). |
| `Resource` | `type` (`qbank`, `slides`, `papers`), `totalUnits`, `doneUnits`, `minutesPerUnit`, `fromSummary?` | Counted material. `slides` = lectures. `papers` = past papers or practice papers. `fromSummary` is set by rescue (section 9). `itemNames?` are the student's lecture titles, shown in tasks ("Lectures: Heart failure, Asthma"). An oral question list is a `slides` resource with unit "question"/"questions". `unitsUnsure` marks a "Not sure" count. `doneItems?` = which lectures are done, by index (the student can tick them out of order); `upNext?` = lectures the student picked for the next task. `doneUnits` stays the count. |
| `Topic` | `system`, `name`, `status`, `items`, `doneItems`, `partialMin`, `coveredOn?`, `questionsOnly?`, `dropped?`, `fails?` | Board material is planned by topic. `items` = the videos, reading and questions for that topic with the student's own resources. |
| `AnkiDeck` | `goalId`, `newCardsLeft`, `reviewMinutes` | Anki decides which cards are due. The engine only reserves time. |
| `Availability` | `weekdayMinutes`, `weekendMinutes`, `weekendDays`, `extra?` | `extra = { minutes, until }` is extra daily time the student agreed to in rescue mode. `studyWindow?` (`evening` default, `late`, `early`, `mixed`): when the student usually studies (section 7). |
| `Rotation` | `name`, `until`, `systems?` | `systems` = board systems that match the rotation (from the template), used to suggest the next system. |
| `Commitment` | `kind` (`busy` or `deadline`), `date`, `from`/`to`, `minutes`, `topicId?` | Things the student has to do. They only take time. |

### 1.2 What the engine records (history)

| Type | Meaning |
|---|---|
| `Session` | One finished or partly finished task: date, kind, minutes from the timer, questions and correct when there were any. |
| `TaskOutcome` | Done / Partly / Skipped for every task, including ones never opened (closed as skipped at day's end). |
| `scheduled: Task[]` | Fixes and retests, each with a date. A retest carries `fixId`: it cannot be due before that fix is done. |
| `LightOffer` | Each light-day offer and its answer. |
| `RescueRecord` | Each rescue offer and the option chosen. |
| `confident` | Topics rated "Had it" in a Recall Sweep. |

### 1.3 What the engine returns

`buildDay(state, date) → DayPlan`:

```ts
interface DayPlan {
  date: ISODate
  kind: 'normal' | 'weekend'                    // from the student's weekend days
  type: 'normal' | 'eve' | 'exam' | 'rest'      // exam protocol, section 5.1
  mode: 'full' | 'light' | 'essentials' | 'rest' // the answer to a light-day offer, section 8
  available: number        // stated minutes for the day (+ agreed extra)
  busy: number             // minutes busy time takes
  tasks: Task[]            // in the order the student does them
  moved: Task[]            // due fixes and retests not planned today: moved to the next day
  windDown: string[]       // uni goals whose wind-down is active today
  sittings: Sitting[]      // the exam(s) that make today an eve, an exam day or a rest day
  notes: DayNote[]         // 'squeezed', 'ankiFillsDay', 'ankiShortened', 'paused', 'moved': one calm line each on Today
  squeezed: boolean        // commitments left no room for study
  overloaded: string[]     // deadline work that cannot fit before its deadline
}
```

`Task.kind` is `anki`, `study`, `fix`, `retest` or `review` (the exam-eve review). A topic task that continues an unfinished topic carries `part` (2, 3 …) and the topic's progress.

---

## 2. The study day

A study day ends at `DAY_ENDS_HOUR` (4 AM). Work after midnight counts toward the previous day (`studyDay(now)` in `dates.ts`; the only place a clock is read is the app shell).

When a day ends (`endDay`):

- Every task never answered is recorded as **skipped**. Nothing is lost: its work is still in the state and the next plan picks it up.
- Nothing is marked as failed. There are no streaks.

When a day starts (`startDay`):

- `projected` exam dates are recomputed from the current pace, so a "no idea" date never passes silently.
- A `rough` date that has passed becomes `projected`.
- Fixes and retests of uni goals whose exam has passed are removed. Board topics keep theirs.

---

## 3. How a day is decided

`buildDay` runs these steps in order. Each step can only use the time the earlier steps left.

1. **Day type.** Exam day, the day after, the day before, or a normal day (section 5.1). Exam and rest days stop here with no tasks.
2. **Capacity.** Stated minutes for that weekday or weekend day, plus any agreed extra, minus busy time (section 7).
3. **Deadline work.** Today's chunks of deadline commitments (section 7). Commitments always come first.
4. **Exam eve.** If today is the day before a firm exam: one light review task for that exam and nothing else (section 5.1).
5. **Anki reviews.** Reserved next, because they are the last thing cut. If less time is left than the reviews need, the Anki task is shortened to what is left (never under `ANKI_MIN_MINUTES`; with less than that, or on a day with no stated time, there is no Anki task). No new cards on a shortened day.
   New cards per day are what finishes the deck by the exam, but never more than `ANKI_MAX_NEW_PER_DAY` (30) *(estimate)*: past that the reason says the deck will not all be seen. None in the last `ANKI_NO_NEW_BEFORE_EXAM_DAYS` (7) before a firm exam, none during a wind-down, and for a date that is not firm they are spread over at least `ANKI_NEW_MIN_HORIZON_DAYS` (30).
6. **Due retests**, nearest exam first (section 6).
7. **Due fixes**, oldest first (section 6).
8. **Goal study.** *Early block:* a student with a QBank and no logged question block on it, in their first `EARLY_BLOCK_DAYS` (2) study days, gets a block of `EARLY_BLOCK_QUESTIONS` (10) reserved before topic study, even when a uni exam leads, so the first score (and its fix → retest) arrives by day 3 (retrieval practice; the score shows what to fix). Then: The remaining time is shared between goals by urgency (section 4), unless a wind-down pauses a goal (section 5.2).
9. **Leftover time** grows a question block, or adds a second one on long days.
10. **Light day.** If the student accepted a lighter day today, the list is cut down (section 8).

The order of work on screen: Anki, deadline work, the nearest exam's study, fixes, retests, later exams' study.

**The plan never exceeds the day.** Everything except deadline work must fit inside `available − busy − deadline work`. What does not fit moves to the next day and is listed in `moved`. Only deadline work that cannot fit before its deadline may exceed the day, because it is the student's own obligation, and it is flagged.

**"Do more"** (`doMore`): worked out before the tap, so Today only offers it when there is something to add (otherwise one line says why). On a squeezed day (commitments leave no room for study) Today offers that one task by name: "Have 25 min? Anki reviews". On request, the engine returns the next task it would plan with `DO_MORE_MINUTES` (60) more (Anki first if it was cut, then tomorrow's study). It never brings a retest forward before its date, because the gap is the point of a retest. Extra tasks are the student's choice and are outside the daily cap.

---

## 4. Sharing time between goals

*Principle: prioritise by likely yield and by deadline. Numbers are estimates.*

For each goal with work left, the engine computes what it **needs per day** to finish on time:

```
need(goal) = minutes of work left ÷ study days left before its exam
```

Study days exclude exam days, rest days, exam eves, days with no stated time and (for a paused goal) wind-down days. A goal with a `rough` or `projected` date uses that date as a soft target.

- **The nearest firm exam goes first.** It takes what it needs for the day, up to `SOONEST_MAX_SHARE` (70%) of the study time *(estimate)*, so a far goal still moves. If it needs the whole day or more, it gets the whole day.
- Firm exams within `CLOSE_EXAMS_DAYS` (3) of each other form one group and split the group's time **in proportion to need**.
- Then the next exam, the same way. The last goal takes what is left. Goals without a firm date come after the firm ones.
- A share too small to hold one task (a lecture for a uni goal, `MIN_GOAL_CHUNK` 20 min otherwise) is saved up: that goal is planned every 2nd to 5th day (`MAX_GOAL_SKIP_DAYS`) with one task's worth, so nothing is planned in crumbs.
- Time a goal cannot use passes to the next goal; the board goal, which can always use time, is filled last.
- **A near uni exam leads** (`leadingUni`): a firm uni exam within `UNI_LEADS_DAYS` (28) is planned first when every other goal is undated (rough or "no idea") or more than `BOARD_FAR_AFTER_UNI_DAYS` (60) after it. When every other goal is "no idea" (projected), the uni exam leads at any distance: "no idea" means "not yet", so the board goal stays in the background instead of chasing a date the student never gave. The board goal then keeps `BOARD_SHARE_WHILE_UNI_LEADS` (30%) of the day so it still moves *(estimates)*; time the uni exam can't use still goes to it. The ready-by projection (`goalMinutesOn`) applies the same cap, so Pace's ready-by month matches the days Today plans. No setting: the student's dates decide. A rough or projected board date shows no countdown on Today.
- **Estimated dates say so.** Projected: Pace says "Step 1: no date yet" with the ready-by month; Today asks once "Have you booked Step 1?"; setup says the uni exams come first when one is dated. Rough: "early / mid / late 2027" everywhere, never a day (onboarding shows each answer's months, plus "2028 or later"). Assumed (a rotation's end): "date not out yet, planned for the rotation's end". A ready-by more than `WELL_AHEAD_DAYS` (60) early is a month ("well before the exam"), not a day count.

### 4.1 Board goals: by topic

*Principles: retrieval practice (each topic ends in questions on it); spacing (fix, then retest days later); interleaving (two systems alternate; question blocks are mixed across systems until there is accuracy data).*

- The queue: topics already started first, then the current system's topics in map order (two current systems alternate).
- A topic is a run of items: videos, then reading, then its questions. A task takes as many whole items as fit, up to `TOPIC_TASK_MAX_MINUTES` (90) *(estimate)*. If not even one item fits the day, the item itself is split and continues next time, so short days never stall.
- **Continuing is fine.** An unfinished topic comes back as "part 2", "part 3" with its progress; on a long day the parts follow each other back to back. A **finished** topic never comes back as new study (the student's rule was 7 days; "never" covers it). Fixes and retests are exempt.
- A system under way is finished before a new one starts. When it runs out mid-day, the next systems in the queue follow (`QUEUE_NEXT_SYSTEMS`).
- At most `MAX_NEW_TOPICS_PER_DAY` (4) *(estimate)* topics are started on one day, so a long day leaves room to consolidate. The rest of a long day goes to question blocks (at most `MAX_BLOCKS_PER_DAY`, each at most `QBANK_MAX` 40).
- Question blocks target the weakest system that is really weak (under `WEAK_BELOW`), and never the same system more than `BLOCK_SAME_SYSTEM_DAYS` (2) days running. Otherwise, and before any accuracy data, they are mixed.
- When choosing the next system: a weak not-started system first, then a system matching the current rotation (template data), then map order.

### 4.2 Uni goals: lectures, summaries, past papers

*Principles: retrieval practice and practising in the exam's format (past papers) over re-reading; papers are spread and weighted toward the exam.*

- **Lectures** are a count. Each day gets what finishes them `LECTURES_DONE_BEFORE_SHARE` (20%) of the remaining days early *(estimate)*. When the uni exam is the only goal studying, they run at most `LECTURES_AHEAD` (1.5×) ahead; inside the wind-down, up to `LECTURES_MAX_PER_DAY` (4).
- **Past papers** are spread over a window before the exam and are denser near it. The window is the last half of the prep time for small material and the last third for large material (`PAPERS_WINDOW_*` in the template) *(estimate)*. Inside the window, paper *k* of *N* is due at `(k/N)^PAPERS_BACKLOAD` of the way through. The last paper is due two days before the exam so the eve can review its mistakes. Papers keep their dates even when lectures finish early: spacing is the point.
- **Recall.** When no lecture or paper is due, a short daily self-test on the lectures (`UNI_REVIEW_MINUTES`, 30) is planned instead of an empty day. Inside the wind-down the freed time goes to the exam: recall runs up to `UNI_WIND_DOWN_REVIEW_MAX` (90), also after a paper.
- "Not sure" how many papers: the template's default (global 3, *(estimate)*).
- **Summaries** are never asked about. They are what "narrow the scope" means for a uni exam (section 9): remaining lectures are studied from the summary at `SUMMARY_SHARE` (40%) of the time *(estimate)*.
- **Which lectures.** A lectures task carries `items` (the lecture indices it covers). The next lectures are `lectureQueue`: the student's picks (`upNext`) first, then the lowest not-done indices. "Switch lecture" on Today changes the picks without changing the time; ticking a lecture on the Board marks it done wherever it sits in the list. Both re-plan today (`replanToday`). Tasks saved before `items` existed are read as the first lectures in the queue.
- Two uni exams within `CLOSE_EXAMS_DAYS` of each other share by need like any two goals.
- An OSCE or viva is a `part` with its own date: it gets the exam protocol but no planned material (logged as future work).
- **Uni topics** are the goal's subjects or the student's lecture titles (`uniTopicChoices`, ids `uni-<goalId>-<slug>`; `uni-<goalId>-all` when there are none). A past paper is **scored** like a question block: under `WEAK_BELOW`, or with topics tapped as missed (`weakTopicIds`), it creates a fix and a retest on those uni topics. Uni sessions never feed board decisions (`boardSessions`); uni accuracy is its own figure (`uniAccuracy`).
- **Basic years** (stage before clinical) use the same model: a block of subjects (`BASIC_SUBJECTS`) is a rotation, each subject with an exam is a uni goal.
- **Filling the day** (`growUni`, in `growStep`): time left after everything else goes to whole lectures (at most `LECTURES_MAX_PER_DAY`), then a past paper due within `PAPER_GROW_AHEAD_DAYS` (7), then recall. Never a part lecture and never over the day's time.

---

## 5. Exams

### 5.1 The three days around a firm exam

Applies to every sitting with a firm date (the written exam and each `part`).

| Day | Plan | Reason |
|---|---|---|
| Day before (`eve`) | One **light review** for that exam: weak topics for a board exam; past-paper mistakes and your own notes for a uni exam. At most `EVE_MAX_MINUTES` and `EVE_MAX_SHARE` of the day. Nothing else, Anki included. | Sleep and consolidation matter more than new material the night before. *(Cap is an estimate.)* |
| Exam day | Nothing planned. | |
| Day after | Rest. Nothing planned. | Recovery; not counted as a light day. |

When days collide (two exams in one week): **exam day beats eve, eve beats rest.** The day between a Tuesday and a Thursday exam is Thursday's eve.

Rough and projected dates get none of this.

### 5.2 Wind-down before a uni exam

In the last `windDownDays` before a uni exam, every board goal shrinks to **Anki reviews only**: no new cards, no topics, no question blocks, no fixes, no retests.

`windDownDays` is set per goal at setup from the template: `WIND_DOWN_MAX_DAYS` (7) for rotations of `WIND_DOWN_FULL_WEEKS` (4) or more, otherwise `WIND_DOWN_SHARE` (a third) of the rotation, rounded, at least 2. A 2-week minor rotation gives 5 days. *(Both are estimates.)*

Board fixes and retests that come due in the window are **paused**. After the exam and its rest day they return through the normal daily limits (section 6), oldest first. A retest that waited still counts as that retest.

### 5.3 After an exam

- No study, fix or retest is ever planned for a goal on or after its exam date.
- A uni goal's remaining fixes and retests are dropped. Board topics keep theirs.
- The first day after a rotation ends, the app asks one question: "What's next?" (the next rotation and its end, or a break with its own daily hours). Until it is answered the plan continues with the remaining goals at the current hours. `whatsNext(state, date)` reports when to ask (`rotationEnded`, or `noExam` when nothing is ahead).
- **Retiring:** `RETIRE_AFTER_DAYS` (2) after a uni goal's last sitting (`lastSitting`), `startDay` moves it to `pastGoals` (`retireGoals`). Its sessions, topics and resources stay as history.
- **Changing goals without a reset:** `addGoal`, `removeGoal`, `editGoal`, `editResource` and `startNextRotation(state, { name, until, exams }, date)` edit the state in place. Sessions, topics and Anki are kept; ids stay unique (a second exam in the same subject gets its own id); removing a goal drops its material and pending fixes and retests; moving a date moves pending retests back before it (section 6).

---

## 6. The fix → retest loop

*Principles: retrieval practice (a retest is questions, never re-reading), spacing (the gaps), and successive relearning (two passes to call it solid). The intervals are estimates.*

- A question block or a topic's questions under `WEAK_BELOW` (60%), or topics the student taps as missed, create **one fix** (dated `FIX_AFTER_BLOCK_DAYS`, 1 day later) and **one retest**.
- A topic with an open loop does not get a second one.
- The retest is due `RETEST_AFTER_FIX_DAYS` (3) after its fix **is done**, never before. A fix answered "Partly" or skipped returns the next day and pushes its retest with it.
- Retest ≥ `RETEST_PASS` (70%): a second retest `CONFIRM_RETEST_AFTER_DAYS` (7) later. **A topic is solid only after both pass.**
- Retest failed: weak again, with a new fix that uses a **different action** than last time. After `MAX_RETEST_FAILS` (3) failures in a row the topic rests for `PARK_DAYS` (14) and then gets a fresh pass. If it misses three more times after that (`MAX_PARKS`), the loop stops: the topic stays weak on Pace, with no more retests, so one stubborn topic cannot loop for months.
- **A result one question under the line is not decided.** On a 10-question retest, 6 correct is too close to call (`RETEST_BORDERLINE_QUESTIONS`, 1): the topic stays as it is and `RETEST_CONFIRM_QUESTIONS` (5) more are planned `RETEST_CONFIRM_DELAY_DAYS` (1) day later. The two results count together (6/10 + 5/5 passes, 6/10 + 4/5 does not), and a confirming retest is never confirmed again. The pass line itself passes (7/10 is a pass), so the screen's "70% or more passes" is always true. *Reason: ten questions are a noisy sample; one question should not decide "solid" or "weak".*
- A fix answered "Partly" comes back the next day with the rest of its time; answered "Partly" a second time it counts as done.
- A topic task answered "Partly" comes back covering only the rest of that task (`partlyTo`), never more, so it is never longer than the one the student didn't finish.
- The pass line is stated wherever a retest is: "70% or more passes" on the task and on its result.
- **Recall Sweep for uni-only students** (no QBank): Today offers a sweep of finished, titled lectures by default (`planSweep` in `src/data/sweep.ts`); a lecture comes back when its re-sweep date (`EngineState.sweepDue`) arrives. Fuzzy → a 10-min skim within 2 days. This gives students without question blocks a fix → re-check loop by day 3. Untitled lectures are never swept.
- **Results from outside the plan** (an exam, an NBME, a quiz, an oral, a block done elsewhere) enter the same loop (`reportOutside`, `src/engine/report.ts`). The student types what it was and, optionally, a score, the systems or lectures that felt weak, and the time it took. It counts for one goal: a board goal's result is scored like a mixed block, a uni goal's like a past paper. It is a session with `outside` set: its minutes count as studied that day, it moves no material forward and it is never one of the plan's tasks. Without a score nothing is decided. A block review after it names it: "Review your wrong answers from NBME 1".
- **Asked once, never nagged:** after a test-like commitment ("quiz", "colloquium", "NBME", "OSCE", "viva"…, `isTestLike`) or an exam part has ended, Today asks "How did the X go?" once (`resultPrompt`, `src/engine/results.ts`), within `RESULT_ASK_DAYS` (2) days. Answering or "Not now" stores the key in `resultsAsked`. A goal's own exam is never asked about: that exam is over, so there is nothing left to fix for it.
- Short reviews without a retest (a Recall Sweep item, the "felt sure" note) are not loops and never change a topic's status.

Daily limits, so fixes never crowd out all new study:

- At most `MAX_RETESTS_PER_DAY` (2) and `MAX_FIXES_PER_DAY` (2).
- Together at most `FIXLOOP_SHARE` (50%) of the study time left after deadline work and Anki.
- **Backlog:** with more than `MAX_OPEN_LOOPS` (6) topics waiting, the share rises to `FIXLOOP_SHARE_BACKLOG` (75%) and **no new topic is started** until the pile is back under the line. Topics already started continue. *Fix what is weak before adding more.*
- On a day so short that the share never holds one item, every other day the oldest due item goes first; a fix longer than the whole day is shortened to fit.
- **Due retests for the nearest firm exam are protected:** they are outside the count and share limits and only need to fit in the day.
- A due retest that does not fit is **moved to the next day, never dropped.**
- **Retests never on or after the exam:** a retest for a goal with a firm date is due at the latest `RETEST_BEFORE_EXAM_DAYS` (2) before it (`retestLatest`, `fitRetests`). A late one moves to that day; a newly created one that cannot fit after its fix is left out. A "no idea" date has no cap.
- A confirming retest's result shows both parts pooled: "6/10 + 4/5 = 10/15" (`pooled` on the outcome, `pooledLine`).
- **A new fix never lands on a 0-minute day:** when the next day is an exam day, eve, rest day or has less than `MIN_TASK_MINUTES` of room, the fix moves to the next free day within `FIX_MOVE_MAX_DAYS` (7) and its retest keeps its gap.

---

## 7. Commitments

- **Busy time** reduces the day's capacity only when it squeezes the study window. The usable window runs from the window's start to `ROOM_UNTIL` (01:00) *(estimate)* or the window's end, whichever is earlier. Busy stretches inside it are merged (two items at the same time count once). `room` = usable length − busy inside. The inside part costs `min(inside, max(cap − room, inside × DAYTIME_BUSY_SHARE))`: nothing beyond a small fatigue share while the free evening still holds the stated hours, and the shortfall when it doesn't. Time outside the window counts at `DAYTIME_BUSY_SHARE` (25%) *(estimate)*; untimed items at `UNTIMED_BUSY_SHARE`. The total never exceeds the day's stated minutes. Example (cap 3 h): lecture 18–19 → 15 min; seminar 16–23 → 1 h 45 min; busy 16:00–01:00 → the whole 3 h. `busyCost` (one item, worst case) is kept for previews. Windows (`STUDY_WINDOWS`): evening 16:00–04:00 (default, `STUDY_WINDOW`), late 20:00–04:00, early 04:00–12:00, mixed 08:00–04:00.
- **Rotation shifts** (titles matching `SHIFT_WORDS`: ward, shift, hospital, rounds, clinic, duty, …) on or before the rotation's end count 0 outside the window and 0 when untimed: the stated daily hours already assume the rotation. After the rotation they count like any busy time.
- `learnStudyWindow(startMinutes)` suggests a window from timer start times: nothing under `STUDY_WINDOW_LEARN_MIN` (10) starts; a window holding `STUDY_WINDOW_LEARN_SHARE` (60%) of them; else `mixed`. Pure; the store decides when to use it.
- **Deadline work** is split over the days up to the deadline in chunks of at least `DEADLINE_MIN_CHUNK` (30 min). It aims to be finished two days before the due day (`DEADLINE_BUFFER_DAYS`), so there is a spare day; if that does not fit, the day before; due today means today. When another day before the deadline exists, the work is never all put on today. It avoids exam days, rest days and exam eves unless nothing else is left. Unfinished work drops out once its deadline has passed.
- A linked topic counts as being studied until `TOPIC_LINK_DAYS` after the deadline.
- If commitments leave no room, the plan says so and study moves. Anki and protected retests keep their place in the order above. There is no Anki floor on such a day (it would break the stated-time promise, I2); Today offers the next task through "Do more" instead.
- **Busy time without a clock time** counts at `UNTIMED_BUSY_SHARE` (50%) *(estimate)* while it fits in the waking hours outside the window (`WAKE_MINUTES`, 08:00, to the window's start, capped at `ROOM_UNTIL`). A longer item spills into the window from its start ("Night duty 12h" takes the evening), and the outside part counts at the share.
- **Whole days** (`allDay`): "whole day", "all day", a span of days with no length, or a one-off event that is not an exam ("Wedding Thursday"). The whole study window is busy: no study that day; retests and study move on.
- **Spans** (`until`): "today and tomorrow", "for 3 days", "all week", "until Thursday / 20 Dec", "Mon to Wed". A busy item covers every day from `date` to `until` (with `repeat`, only those weekdays). `isOneOff` = no repeat, or an `until`.
- **Once vs every week.** A day range or list ("Sun, Tue 6-8pm") repeats weekly until deleted, unless the text says it is one-off ("this week", "next week", "only", "once", …): then it covers those days of this (or next) week only. The sheet's chip switches between the two; a weekly item can also end on a date ("Until").
- **24-hour and night times.** A range with a leading zero or an hour over 12 is read on a 24-hour clock and may run overnight ("20-08"). With a night word (night, overnight, on call, …) bare numbers run evening to morning ("Night duty 8-8" → 20:00–08:00).
- **Repeating busy time** (`repeat`: weekdays) applies on those weekdays from its date on, until deleted. Only busy time repeats. A list of two or more days ("Sun/Tue/Thu", "Sun, Tue and Thu") is a repeat. Day words after the date are not part of the title ("Duty today 7am to 7am tomorrow" → "Duty").
- **A long shift** (one one-off busy item of `LONG_BUSY_MINUTES`, 8 h, or more, or a whole day, today or yesterday) counts as a rough patch for light days (section 8).
- **Overnight ranges** are read only when both ends say am/pm ("7pm-7am").
- **Time ranges without am/pm** ("4-9", "Clinic 9-1"): when the end is not after the start, both are read on a 12-hour clock and the end moves to the afternoon (16:00–21:00, 09:00–13:00). The same rule for English and Arabic.

---

## 8. Light days

*Principle: a plan that bends keeps people coming back; nothing here is evidence-based in its numbers.*

- After a rough patch (several tasks skipped or partly done, a clear score drop, missed days, or a long shift today or yesterday), Today offers a lighter day once. Planned days off (exam, rest, zero-time days, an accepted rest day) never count as "missed".
- At most `LIGHT_OFFERS_PER_WEEK` (2) offers in 7 days; after that one line of encouragement, at most once a week. Never on back-to-back days. Two offers declined in a row pause offers for `OFFER_DECLINED_BACKOFF_DAYS` (14).
- A task never opened and closed at day's end does not count as a "miss" by itself; two quiet days in a row do. A score drop needs `ROUGH_MIN_QUESTIONS` (40) questions on each side.
- The offer is made only when the lighter day changes something (`todayOffer`): not when the essentials are already the whole plan, and "first task only" not on a one-task day. A rest day on offer always changes something.
- Tasks added through "Do more" (`TaskOutcome.extra`) never count toward a rough patch.
- Within `EXAM_PROTECT_DAYS` (5) of a firm exam there is never a break: "essentials only" keeps `ESSENTIAL_TASKS` (2) tasks: Anki, then that exam's own work before anything else.
- A full rest day is offered only when the student is ahead of schedule.
- What is kept, in order: **Anki, retests, fixes**, question blocks, topics, lectures. Anki is the last thing cut.
- **First night:** setup finished at or after `FIRST_NIGHT_FROM_HOUR` (21:00, until the 4 AM day end) gives the same cut as a light day (one task, the highest-impact one, plus what fits in `LIGHT_DAY_MINUTES`) and "The full plan starts tomorrow." It is not counted as an offer, and an untouched first night is not a missed day. The clock is read by the store; the engine only gets the hour (`isLateStart`).
- Dropped work is not rescheduled by hand: it is still in the state, and the next days pick it up inside their limits. Fixes and retests a lighter day cuts are listed in `moved`.

---

## 9. Rescue mode

When the work left for a goal cannot fit before a **firm** exam date, **even with reasonable extra time**, the engine stops packing days. It keeps planning normal, honest days and offers three options with their cost.

**Trigger** (`rescueCheck`): for a goal with a firm date,

```
work left  >  time the goal gets until its exam  +  RESCUE_EXTRA_MINUTES (30) × study days left
```

and the gap is at least `RESCUE_MIN_SHORT_MINUTES`. Below that line the normal answer applies: "+X min a day closes it".

**Readiness is said in time, never in days short** (`readiness`): `minutesShort` is the work left minus the goal's time until the exam, and "+X min a day" is that gap over the study days left, so the two never disagree. When X is over `GAP_MAX_EXTRA_PER_DAY` (90) the gap is not closable with time and Pace says so ("about 6 h more work than time before it") instead of printing a daily number nobody can do. Only a date the student set (`set`) triggers rescue; an assumed, rough or projected date is not judged. A date not known shows no shortfall (`Readiness.dateKnown` false, "date not known"), and a "Not sure" amount is flagged (`amountUnsure`). Rough and projected dates show "at this pace you're ready around X". No offer is made on an exam eve, exam day or rest day, or with fewer than `RESCUE_MIN_DAYS_LEFT` (4) study days left.

**Options:**

| Option | Offered when | Cost shown | Effect |
|---|---|---|---|
| Move the date | Board exams only (a uni date is not the student's to move), and only when it moves by 3 to 60 days (`RESCUE_MIN_MOVE_DAYS`, `RESCUE_MAX_MOVE_DAYS`): a move of hundreds of days is a different plan, not an option | The new date | `examDate` moves to the ready-by date. |
| Narrow the scope | When something is left to narrow | What is skipped, and the share of material still covered | See below. |
| Add time | Until `RESCUE_MAX_EXTRA` a day is reached | Minutes a day until the exam | `availability.extra`, on days that have study time. The daily cap rises by that much because the student agreed to it. |

An option that does not close the gap by itself says so.

**Narrowing a board goal**, in this order, stopping as soon as the plan fits:

1. Not-started topics become **questions only** (no videos or reading). *Retrieval practice beats re-reading when time is short.*
2. Not-started topics are **dropped**, lowest-weight system first, never more than `RESCUE_MAX_DROP_SHARE` (30%) of the topics and never a topic with an open fix or retest. Weight = questions per system in the student's imported UWorld stats. **Without imported stats nothing is dropped**: the engine has no honest basis to call a system low-yield *(until real exam weights exist)*.
3. The second pass of questions is left out for the systems with the **best accuracy** (only systems at or above `WEAK_BELOW`).

**Narrowing a uni goal:** remaining lectures switch to summaries; then the number of past papers is reduced, never below one.

Due retests for the nearest exam stay protected throughout. After a choice the offer is not repeated for `RESCUE_COOLDOWN_DAYS` (7), and each further choice for the same exam doubles that wait. "Not now" waits `RESCUE_DISMISS_DAYS` (14). Once the student has chosen and nothing left can close the gap, the engine stops asking; Pace keeps showing the honest ready-by date.

---

## 10. Time estimates

Recording what happened (store, `src/store/session.ts`): a task ticked before `EARLY_STOP_SHARE` (60%) of its planned time asks "How far did you get?" (All of it / Part of it) instead of counting as done. "End session" saves every ticked task, plus any unticked task with at least `KEEP_SESSION_MINUTES` (5) of timer time, which gets the full Done / Partly / Didn't question; a shorter false start saves nothing. Correcting "lectures left" changes which lectures are ticked (`correctLecturesLeft`); the course only grows when its size was a guess or more are left than it has.

Today's "studied" total is the day's timer minutes (`studiedOn`, imported results left out), the same figure Week shows. "Done already" (no timer) credits the planned minutes and marks the session untimed, so it never tunes an estimate.

Each finished task nudges its kind's estimate (topics, lectures, questions) toward the student's own timer minutes: the default counts like `ESTIMATE_PRIOR_SESSIONS` sessions, outliers are ignored, and one session moves it at most `ESTIMATE_MAX_STEP`. Fixes, retests, Anki, deadline work and imported results never tune estimates. There is no calibration mode.

---

## 11. Invariants

The simulator (`tests/sim/`) checks every one of these on every simulated day.

| # | Invariant | Scope | Reason |
|---|---|---|---|
| I1 | No task for a goal on or after its exam date. | Every task | Studying for a finished exam destroys trust at once. |
| I2 | Planned minutes, without deadline work, ≤ `available − busy − deadline work` (never below 0). | Every day, before "Do more" | The student's stated time is a promise. |
| I3 | A pending retest never disappears. If due and not planned, it is in `moved`, on every kind of day and in every mode. | All retests, except a uni goal's after its exam | A vanished retest means the weak topic was silently forgotten. |
| I4 | A topic becomes `solid` only on a day a second-round retest passed for it. | Topic status changes | "Solid" has to mean something. |
| I5 | Accepted light or rest days ≤ `LIGHT_OFFERS_PER_WEEK` in any 7 days; no rest day within `EXAM_PROTECT_DAYS` of a firm exam. | Light-day answers | Kind, but not a way to drift into the exam. |
| I6 | The day is a weekend day exactly when its weekday is in the student's weekend days, and `available` matches. | Every day | Weekends differ by country. |
| I7 | Exam day and the day after: no study tasks. Exam eve: only the review. Deadline work that cannot go anywhere else is the one exception. | Firm dates | Section 5.1. |
| I8 | Inside a uni wind-down, board goals have only Anki. | Wind-down days | Section 5.2. |
| I9 | If anything else is planned on a normal day, Anki is planned (possibly shortened). | Students with Anki | Anki is the last thing cut. |
| I10 | A retest is never planned before its date, nor before its fix is done. | All retests | The gap is the mechanism. |
| I11 | A finished topic does not return as new study. Parts of one topic may follow each other in a day; a topic never appears in two separate places. Dropped topics are never planned. | Study tasks | No "same topic again" days. |
| I12 | Fix and retest counts and their share of the study time stay within their daily limits (protected retests excepted). | Every day | Fixes must not crowd out progress. |
| I13 | Deadline chunks are at least `DEADLINE_MIN_CHUNK` (or finish the work), and none is planned after the deadline. | Commitments | |
| I14 | At most one pending retest and one pending fix per topic; ids in `scheduled` are unique. | `scheduled` | No duplicate retests. |
| I15 | Task minutes are positive multiples of 5; ids are unique within a day. | Every task | |
| I16 | Rescue is offered only for firm dates (in practice only `set`); "move the date" never for a uni exam; every option states a cost. | Rescue offers | Section 9. |
| I17 | Progress: a goal with work left and time available is planned at least once in any 7 normal days outside wind-down, and no due retest waits more than `RETEST_MAX_WAIT_DAYS` outside a pause. | Liveness | Catches silent stalls. |
| I18 | `buildDay` is deterministic and never mutates its input. | Every call | Purity. |
| I19 | The same fix action is not given twice in a row for the same topic after a failed retest (when another action exists). | Fix escalation | Repeating what did not work looks silly. |
| I20 | No new Anki cards on a day where Anki was shortened, and never more than `ANKI_MAX_NEW_PER_DAY`. | Anki | Do not grow a pile that already does not fit. |
