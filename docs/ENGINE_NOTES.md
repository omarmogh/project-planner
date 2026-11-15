# Engine notes

A running log for the plan engine: each decision, each deviation from `docs/ENGINE_SPEC.md`, and why.
Newest sections at the bottom. "Conservative" means: when a case was not designed, the option that
plans less, promises less and loses nothing was chosen.

## 1. Decisions Omar made (requirements)

- Wind-down scales with the rotation (Q1 = B): 7 days for rotations of 4 weeks or more, a third of the rotation otherwise, at least 2.
- Board fixes and retests pause during the wind-down and return afterwards through the daily limits (Q2 = A).
- Uni goals are lectures + past papers; summaries are the "narrow the scope" step (Q3).
- A finished topic doesn't return as new study within 7 days; continuing an unfinished topic is fine and labelled "part 2" (Q4 = B).
- Rescue narrows in two stages, by imported question counts when they exist (Q5).
- One "What's next?" question when a rotation ends (Q6 = A).
- Learning science over one university; institution facts are data in `src/data/universities/`.

## 2. Conflicts between rules, and how each was resolved

| Conflict | Resolution |
|---|---|
| "Never exceeds the daily time" vs "due retests are never dropped" vs "commitments first" | One strict order (spec 3). What doesn't fit is **moved** to the next day and listed in `DayPlan.moved`. Before this, overdue fixes and retests were added even when the day went negative. |
| "Anki is the last thing cut" vs the old light day (kept a retest, dropped Anki) | Light days keep Anki first, then retests, then fixes. A 30-minute Anki task on a "20-minute" light day stays: the highest-impact task is always kept. |
| "Anki last cut" vs a day too short for the reviews | Anki is shortened to what fits (never under 10 min) instead of dropped, with no new cards that day. If Anki fills the whole day the plan says so (`ankiFillsDay`); it is not capped, because only Anki knows what's due. |
| "Exam eve: light review of weak topics only" vs "Anki last cut" | The eve is literal: one review task, no Anki. Exam day and the day after: nothing. "Do more" can still add Anki. **Decision for Omar (report).** |
| Exam protocol vs two exams in one week | Exam day beats eve, eve beats rest. |
| "Past papers across the whole prep period" vs "in the last half to third" | Both: papers sit in a window (last half for small material, last third for large), and inside it they are spread and denser toward the exam. The last one is due two days before the exam. When lectures finish early the plan does **not** rush papers; it adds a short daily self-test instead, so papers keep their spacing. |
| "Narrow: drop not-started first" vs covering the exam | Dropping is capped at 30% of topics (`RESCUE_MAX_DROP_SHARE`). Past that, narrowing says "not enough by itself" instead of emptying the plan. Before the cap, one persona was offered "165 topics left out, covers 0%". |
| "Goals share time by urgency" | The nearest firm exam takes what it needs per day, up to 70% of the study time; exams within 3 days of each other split by need; the last goal takes the rest. A pure proportional split let a hopeless far goal starve a feasible near one. |

## 3. Situations nobody had designed, and what the engine does now

- **Day rollover.** `startDay` / `endDay` exist. A task never answered is closed as skipped with `auto: true`; auto-closed tasks alone don't count as a rough patch (two quiet days in a row still do).
- **Retest before its fix.** A retest carries `fixId` and is due only after that fix is done, `RETEST_AFTER_FIX_DAYS` later.
- **Repeated failures.** A failed retest gets a different fix action; after 3 failures in a row the topic rests 14 days.
- **Two loops for one topic.** A topic with a pending fix or retest never gets a second loop.
- **Weak in everything.** Fixes and retests are limited per day and by share (50%, or 75% and doubled counts with a backlog of more than 6 topics).
- **Items that never fit.** The day's first topic may split one long item across days. A topic task is at most 90 min; longer topics continue as parts, back to back on long days.
- **Long days.** At most 4 new topics a day, then question blocks (at most 2).
- **End of a system.** The queue continues into the next systems, so a system's last days aren't half empty. A system under way is finished before a new one starts (before: once the focus system was done, every day started a different system).
- **"No idea" dates** are recomputed every morning. Rough dates that pass become projected. Neither gets the exam protocol, the wind-down or rescue.
- **The rotation ends.** `rotationEnded` asks once; `nextRotation` / `startBreak` (in `src/data/setup.ts`) apply the answer.
- **Uni material finished early.** A 30-minute daily self-test on the lectures (60 in the wind-down) until the exam, instead of empty days.
- **A uni exam as the only goal.** Lectures run at most 1.5× the day's need; the rest of the day stays free ("Do more" is there). Before: all lectures in the first week, then nothing.
- **Empty days** are recorded as days off, so they never trigger a light-day offer. Offers are never made on back-to-back days.
- **Rescue asked again.** Each answer doubles the wait before the next offer for the same exam (7, 14, 28 days). No offer on an eve, exam or rest day, or with fewer than 4 study days left.
- **Fix-loop time in projections.** The board goal's ready-by date sets aside the minutes fixes and retests really took per day over the last 14 days. Without it, an 8-hour student "fit" after narrowing and was short again every week.

## 4. Deviations from the spec, or things it leaves open

- **OSCE / viva** get the exam protocol but no planned material. Future work.
- **Uni and Step 1 overlap** (IM lectures and Step 1 Cardio) is not credited. Only the suggested next system follows the rotation (`ROTATION_SYSTEMS`). Future work: real double-counting.
- **"Shaky lectures" on the eve.** Lecture titles aren't known, so the uni eve review is "your past-paper mistakes and your own notes".
- **Exam weights** are still placeholders: imported question counts per system, else map order reversed.
- **`SUMMARY_SHARE` 40%** is Omar's "feels fine, not sure".
- **Busy time after midnight** ("01:00") counts as late in the same study day.
- **A board goal with everything done** (all topics covered, qbank finished) has nothing planned. Not designed; rare in Phase 0.
- **Unplanned work** (questions done outside Locus) is only known through the UWorld import and video ticks.

## 5. What the simulator found (and the fix)

| Found | Fix |
|---|---|
| A new rotation's lectures were never planned: the share (8 min a day) never held a 30-min lecture | Small shares are saved up to one task's worth every 2nd–5th day |
| Single topic tasks of 145 and 155 minutes | 90-minute cap, parts |
| A different system every day once the focus system was finished | Finish the system under way first |
| Question-block minutes like 117 and 59 | Rounded to 5 inside the budget |
| Uni-only student: 4 lectures a day for 9 days, then 18 empty days with light-day offers | Paced lectures, daily self-test, empty days are days off |
| 20 light days in 12 weeks for someone who skips two fixed days | Auto-closed tasks aren't "misses" |
| Rescue offered 7–10 times in 8 weeks; "covers 0% of topics" | Fix-loop reserve, drop cap, doubling cooldown |
| 480-minute day with 130 minutes planned at the end of a system | Queue continues into the next systems |
| 84 open loops for a student who fails retests | Higher limits with a backlog |
| Rescue offered on an exam eve for an exam two days away | No offers near the exam |
