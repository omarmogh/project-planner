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

## 6. What the two independent reviews found

**Spec review (fresh context, checked the code against the spec).** Fixed:

| Found | Fix |
|---|---|
| Two weak mixed blocks on one day got the same fix id (one "done" closed both) | The block's task id is part of the fix id; `moved` compares by id |
| A mixed block tapping a system that already had a loop created a topic called `sys-sys-gi` | Systems with an open loop are filtered before planning the fix |
| A "no idea" exam date near the end gave "+1150 new cards" in one day | New cards are capped and spread over a minimum horizon |
| On a light day, a rest day or an exam eve, due retests were in neither `tasks` nor `moved` | They are listed as moved in every mode; the simulator checks I3 on every day |
| Rescue "add time" put study on days the student said have zero minutes | Extra time applies only to days that have study time |
| Deadline chunks like 27 minutes after "Partly" | Rounded to 5 |
| Anki review minutes of 0 or 12 gave odd tasks | Rounded up to 5; no task at 0 |
| Zero-minute days counted as study days, so the daily need was understated | Not counted |
| Protected retests used up the count and share of the others | Tracked separately |
| Narrowing could skip question review of the weakest system | Only systems at or above 60% |
| "Do more" planned with far more than an hour | Exactly `DO_MORE_MINUTES` |
| An ignored rescue offer returned every day | `dismissRescue` ("not now") waits 14 days |
| Rescue could drop a topic with an open loop | Excluded |
| The "felt sure" review moved a topic to "fixing" with no retest behind it | Reviews without an action are not loops and change no status |
| Numbers outside `config.ts` (fix minutes, horizons, factors) | Moved to `config.ts` |
| Several spec sentences did not match the code | Spec rewritten (sharing, papers, limits, rescue, invariants) |

Left as is, on purpose: a retest whose fix is missing from the schedule counts as ready (a stuck retest is worse than an early one); a board goal's retests stay in the schedule after its exam (nothing plans them).

**Student review (a tired 5th-year reading the simulated days).** Fixed:

| Found | Fix |
|---|---|
| The week before a rotation exam used 70–90 of 300 minutes | In the wind-down, recall takes the freed time (up to 90 min, also after a paper) |
| "148 new cards a day" three days before Step 1 | Cap of 30; none in the last 7 days; the reason says when the deck won't finish |
| A fix "moved to tomorrow" for 58 days on a 30-minute plan | A fix longer than the day is shortened to fit on the every-other-day turn |
| Retest treadmill: 10–12 tasks a day, the same topic retested 7 times | No new topics during a backlog; after a rest and three more misses the loop stops |
| Rescue offered again and again, even after an answer | Doubling wait, "not now", and silence once nothing can close the gap |
| "Narrow" dropped Behavioral, Biostats and Pathology | Nothing is dropped without the student's own question counts per system |
| The same Pharm block 11 days running at 66% | Blocks target only really weak systems, at most 2 days in a row; otherwise mixed |
| Step 1 kept its share while the uni exam itself didn't fit | An exam that needs the whole day gets it |
| Light-day prompts about every second day | Encouragement once a week at most; two declines pause offers 14 days; a score drop needs 40 questions |
| "Essentials" five days before IM = Anki + a 10-minute crumb | Anki, then the nearest exam's own work |
| A fix answered "Partly" cycled for eight weeks | The second "Partly" closes it |
| "Finish the paper you started · 5 min" three days running | A paper's last few minutes count with the part before |
| No rest day when the next rotation was the same subject | The new rotation gets its own goal |
| "Surgery exam in 55 days" for an unannounced date | "in about 55 days (end of rotation)" |
| "Next system: Resp" on every Resp topic; "0 of 7 steps done" | "Next in Resp"; "in progress" / "last step" |

Not fixed, because they are Omar's decisions (see the final report): OSCE preparation; the literal exam eve when lectures are unread; retests on topics too narrow for UWorld; self-assessment exams (NBME) in a dedicated period; a floor for Anki in a week full of commitments; honest setup-time copy for a 30-minute plan.

## 7. Changes after Omar's feedback (16 Nov)

- **Imported UWorld results are history.** Before, an import was dated the day of the paste and accuracy only looks back 30 days, so after a month the baseline silently stopped counting. Now imported rows keep counting for a system until the student's own recent blocks on it reach `IMPORT_REPLACED_BY_QUESTIONS` (40); then only their own work counts. The paste box asks for all-time stats. No period dropdown. Repeated pastes compared as snapshots are left for later: rounded percentages make a small difference noisy (about ±4 points on 120 new questions, about ±15 on 30), and Locus already logs every block, so recent accuracy mostly comes from there.
- **Lecture counts** go up to `MAX_LECTURES` (200, was 60) and the number can be tapped and typed. No hold-to-repeat.
- **"Uni exams" is "University"** (the chip); a basic-sciences student's single goal reads "University exam".
- **Pace:** "Accuracy by system" only appears for a student with a question bank (or imported results). A "University" section lists each uni exam with lectures left against days left and past papers done. The verdict above it is unchanged.
- **Not built, waiting for the classmate interviews:** asking about rotation priority 2–3 weeks before the exam (the default stays: last week), and the second-pass list (defer fixes for systems finished earlier during a first pass).

## 8. Follow-ups from the progress report (16 Nov)

- **`buildDay` is split by step** (`plan.ts` is the orchestrator, `planSteps.ts` has one function per step of the spec's list). Verified by diffing all 27 simulated students' days against the run before the split: byte-identical.
- **Retest wording:** "Second retest" is now "One-week check"; a late one says "postponed from Wednesday 2 Dec", never "due today". In the app a long list of moved items is already one line ("3 fixes and retests didn't fit today"); only the simulator log lists them.
- **Rescue "move the date"** is hidden beyond `RESCUE_MAX_MOVE_DAYS` (60).
- **Retests too close to call** (6 or 7 of 10) are confirmed with 5 more questions the next day instead of decided. Deviation from the earlier spec: "solid" and "weak" now need a result at least one question clear of the line, or a confirmed one. Cost: about 10 extra minutes on the retests that land on the line (in the simulator, 1 to 39 per student over 8–12 weeks, most with many retests).
- **Honest sentence at setup** (`timeNote` in `src/data/setup.ts`), under the time question: first an exam the time cannot cover ("Step 1 is about 14 days short"), then Anki taking half the day or more, then the ready-by month for a date that is not set. Nothing when the time is plenty.
- **Weekend setting:** Today shows it on the first day only (until a task is started); it was already that way, so the progress report overstated it. There was no way to change it later, so the Week tab now has the same row.
- **`replanAfterLightDay` became `lightDayNote`**: it never rescheduled anything, only worked out the line "about N more minutes a day over M days".
- **`TOPIC_REPEAT_DAYS` is gone.** A finished topic never re-enters the queue, which is stricter than 7 days; the simulator now checks "no finished topic is planned as new study".
- **Pace:** Daily load and What-if sit behind one tap ("Daily load and what if") at the bottom.
- **Performance.** Engine calls per screen, measured on this machine: 0.05–10 ms each (the slowest is the road to the exam). In a browser with the CPU slowed 4× (a rough stand-in for a mid-range phone), switching tabs took 137 ms (Pace) and 117 ms (Today) before, and 82 ms and 74 ms after caching the Pace numbers, tomorrow's preview and the light-day offer per plan object. Not measured on a real phone.
- **Left alone on purpose:** Recall Sweep (decide after interviews); the `exam` formats and `rotations` fields in university templates (they go with the OSCE decision).
- **Graphify:** `graph.json` and `manifest.json` are no longer tracked (rebuild with `graphify update .`); the report stays. `docs/ENGINE_REPORT.md` was removed: this file and the PDF cover it.
