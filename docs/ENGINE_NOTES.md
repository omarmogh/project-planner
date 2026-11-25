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
- **Browser tests** (`npm run e2e`, `tests/e2e/`): seven checks at phone width with a real Chromium: the demo day, a task from Start to its report, the commitments sheet (a lecture costs 30 minutes, a seminar becomes tasks with the Uni tag), typing a lecture count (80 works, 500 caps at 200), Pace for the demo student and for a student with no question bank, and the weekend setting on the Week tab. Playwright is a dev dependency (pinned); the uni-only student is generated by the real engine, not hand-written. Not covered: the onboarding screens, so the new sentence under the time question is covered by a unit test only.

## 9. Fixes from the three-student simulation (17 Nov)

Every problem in `docs/STUDENT_SIM_REPORT.md` got two candidate fixes; the chosen one and why are in section 9 of that report. Engine-side decisions:

- **A near uni exam leads** (`leadingUni`, spec 4). Chosen over a "mostly IM / balanced / mostly Step 1" control: defaults over settings, and the student's dates already say which exam is near and which is vague. The numbers (`UNI_LEADS_DAYS` 28, `BOARD_FAR_AFTER_UNI_DAYS` 60, `BOARD_SHARE_WHILE_UNI_LEADS` 30%) are estimates. A rough or projected board date has no countdown on Today.
- **Readiness in minutes, not days short** (`readiness().minutesShort`, `closable`). Clamping "days short" to the days left would have hidden the contradiction, not removed it: "+5 min a day" and "4 h 38 min needed" came from two different figures. Now one figure drives both, and over `GAP_MAX_EXTRA_PER_DAY` (90) Pace says the gap can't be closed with time.
- **Today's "studied" is timer minutes** (`studiedOn`), derived from sessions, so it matches Week by construction; storing minutes on the task was the other option and could drift. "Done already" credits the planned minutes as an untimed session that never tunes an estimate.
- **"Partly" never returns a longer task** (`Topic.partlyTo`): the next task covers only the rest of the unfinished one. "Picks up where you left off" only when something was started; otherwise "Next part of this topic".
- **One "weakest"**: Week uses `recentAccuracy`, the same as Pace.
- **The 70% retest line is stated** on the task, the report and the result.
- **Missed day**: one line at rollover (`missedLine`), computed once and stored, so it can't change or come back on re-render. Not shown after a planned rest or a first night.
- **Anki "Not sure"**: `newCardsUnsure` — the deck size is a default and is never shown; the reason says "about N new cards a day". Connect Anki talks to the real add-on (`src/lib/ankiConnect.ts`), says plainly when it isn't reachable and isn't offered on phones.
- **Lectures**: "3 of 8 done" in the student's own count, not "Lecture 7": Locus knows how many were left at setup, not the uni's numbering. Nothing after "Not sure".
- **Commitment ranges** without am/pm: an end not after the start moves to the afternoon ("4-9" → 16:00–21:00, "Clinic 9-1" → 09:00–13:00), English and Arabic alike. Arabic spellings added: سمنر, سيمينار, شفت, شيفت.
- **Squeezed day**: no Anki floor (it would break I2, the stated-time promise). Today names the one task "Do more" would add ("Have 25 min? Anki reviews").
- **Weekly report**: no card before a full week of use (`fullWeek`, `firstIn`), imports don't count as use; "Screenshot to share" only with good news (`shareable`). A partial card for the first days was the other option; it compares unequal weeks.
- **First night**: setup after `FIRST_NIGHT_FROM_HOUR` (21:00) gets the light-day cut and "The full plan starts tomorrow." Chosen over copy only, because a 3-hour list at 23:00 is the problem, not its wording. The store reads the clock; the engine only gets the hour (`isLateStart`), so it stays pure. Re-plans that day (a commitment, an import, the weekend setting) keep it light.
- **Setup**: an import prefill only replaces an untouched "questions done" and is capped at the bank; a total over the bank says it's likely from a reset; Arabic university names and normalisation (hamza, taa marbuta, diacritics, a leading "جامعة"); a third "studying now" system is refused with a hint instead of silently dropping the first; "About a minute" dropped.

## 10. Universal fixes (18 Nov)

Direction from Omar: fixes must work for every student at every university (Cleveland or Yarmouk), USMLE plus university exams only, and a feature that can't work for everyone is removed rather than special-cased.

- **A mid-day re-plan never overshoots the day** (`replanToday`, `fitToday`, `BuildOptions.spentMinutes`). Adding a commitment, importing results or changing the weekend after tasks were done used to build a full day on top of them. Now minutes already started or done come out of the room, and if pending tasks still don't fit, the lowest-impact ones are dropped first. A light day stays light.
- **Retest close call:** the pass line itself passes (7/10). 6/10 is "one question short" and gets 5 more questions; 6/10 + 5/5 passes, 6/10 + 4/5 doesn't. Before this, 7/10 was too close to call, which contradicted the stated 70% line.
- **Commitment parser:** explicit dates (24/11, 24 Nov, Nov 24) win over a weekday in the same text ("Call Tuesday 24 Nov"). Only real month names count, so "Anki 10 decks" has no date. Exam words (test, assessment, viva, OSCE, MCQ, midterm, finals) are tagged Uni.
- **Report cap 400 questions** (`MAX_REPORT_QUESTIONS`): full-length self-assessments (NBME, UWSA, a uni grand test) are 200–280 questions; the old cap cut them.
- **Copy:** a moved fix or retest is "first in line on your next study day", not "tomorrow", because tomorrow can be a rest day, exam day or fully booked. A rest day says the rest moves to the coming days.

### 10.1 Setup that fits any student (18 Nov)

- **"No exam for this rotation"** is an answer per subject (`noExam`): no goal, no lectures, no papers; board study gets the time. Some rotations are assessed only at the end of the year, some not at all.
- **"Not sure" is never turned into invented detail.** A "Not sure" lecture count still plans time from a default, but tasks say "Next part of your material", never "Lecture 7". A "Not sure" Anki new-card count plans from `ANKI_NEW_UNSURE` (`newCardsUnsure`), but never shows a made-up number: no "N new cards left", no "the deck won't all be seen" warning.
- **Up to 5 rotation subjects** (`MAX_ROTATION_SUBJECTS`), for universities with one annual exam over several subjects.
- **Goals are USMLE plus university exams only.** PLAB, SMLE and the Jordanian board were removed from setup: a country's exam we can't support properly is worse than none (Omar's direction). The engine is not exam-specific, so they can come back as data.
- **Any question bank**: "Another question bank" (AMBOSS, Kaplan, TrueLearn, a local bank) with its own size (`qbankTotal`, "Not sure" → the UWorld size), planned the same way under the neutral name "QBank". The resource id stays `uworld` so saved plans and imports keep working.
- **Recall Sweep labels** use the board goal's own label ("Step 2 CK · Cardio"), not a fixed "Step 1".

### 10.2 Commitments for every kind of week (18 Nov)

- **Busy time without a clock time** ("Ward 6h") counts at `UNTIMED_BUSY_SHARE` (50%) *(estimate, TODO(review))*. It used to count in full, which cut a whole evening for a daytime ward shift. Half is the midpoint between daytime (25%) and the study window (100%), since we don't know when it is.
- **Repeating busy time** (`Commitment.repeat`, weekdays 0–6): "Ward Mon–Sat 8–2", "Clinic every Tuesday", "Lectures weekdays 8-12", "كل يوم", "من الأحد للخميس". It applies from its start date on those weekdays until deleted. "Weekdays" means the student's own non-weekend days. Only busy time repeats; deadline work never does. Chosen over a rota/timetable screen: one line of text covers most schedules, and there is still no list to manage.
- **A long shift is a rough day** (`RoughPatch.longShift`): a single (non-repeating) busy item of `LONG_BUSY_MINUTES` (8 h) or more today or yesterday lets Today offer a light day. Replaces the rejected post-call questions without asking anything. A repeating ward block is the student's normal week, so it doesn't count.
- **Parser:** a shift range like "7-3" reads 07:00–15:00 (an end before the start moves to the afternoon). An overnight range is only read when both ends have am/pm ("7pm-7am"); without them it stays a same-day range, because a wrong overnight guess would wipe out a whole day.

### 10.3 Defaults that aren't one country's (18 Nov)

- **Weekend default is Sat–Sun** (`DEFAULT_WEEKEND_COUNTRY` is unset), or the device country's weekend from the browser language (`deviceRegion()`, e.g. ar-JO → JO → Fri–Sat). Picking a university still sets it from the university's country. Graduates, who skip the university question, get the device country's weekend. Wrong guesses are one tap away ("Weekend: Fri–Sat · Change").
- **University search** prefers the device country (half a rank, never hides other countries) and matches initials: JUST, UCLA, MIT (small words such as "of", "and" are skipped). Ambiguous initials list every match; the device country decides the order.
- **Placeholders** are neutral ("Search your university", "e.g. Dermatology").
- **Study window** (`STUDY_WINDOW`, 16:00 to the 4 AM day end) stays a single config value for everyone. It fits most students; a per-student setting would be a question nobody can answer without checking. Revisit if beta students on night shifts report wrong capacity.

### 10.4 Changing the plan later (18 Nov)

- **"Your plan · Change"** on the Week tab (`PlanSettings.tsx`, store `editPlan`): exam dates, the rotation's end date and daily study time (weekdays / weekends). Each change re-plans Today at once with the same rules as any mid-day re-plan (never over the day's time). A date in the past or today is ignored.
- Moving the rotation end also moves a uni exam that was only assumed at its end (`dateSource: 'assumed'`). A date the student set stays.
- **Adding or removing an exam means setting up again**, one step away behind a confirmation that says logged work is cleared. Editing the goal list in place would need the whole setup flow again in a second place; not worth it before the beta shows it's needed.

### 10.5 Fix pass: goals, uni papers, windows, unknowns (18 Nov)

- **E1 Goals change without a reset** (`addGoal`, `removeGoal`, `editGoal`, `editResource`, `startNextRotation`; setup's `addExam`, `nextRotation`). Supersedes 10.4's "adding or removing an exam means setting up again". Passed uni goals retire to `pastGoals` `RETIRE_AFTER_DAYS` (2) after their last sitting; `whatsNext` reports `rotationEnded` / `noExam`. Basic years plan like rotations (`BASIC_SUBJECTS`).
- **E2 Scored uni papers:** a paper result makes fixes and retests on uni topics (lecture titles or the subject). Uni sessions are kept out of board decisions (`boardSessions`).
- **E3** `Resource.itemNames` (lecture titles in task names). An oral question list is a slides resource with unit "question".
- **E4** `growUni`: leftover time gets whole lectures, a paper due within `PAPER_GROW_AHEAD_DAYS`, then recall; never over the cap. The recall test now checks it stays within the day rather than a fixed length.
- **E5 Unknowns are not judged:** "Not sure" amounts and dates the student did not set give no shortfall, no "days behind" and no rescue. Rescue now fires only for `set` dates (was: firm, which included `assumed`). This narrows I16's behaviour; the invariant itself is unchanged and still checked. Without an exam ahead the verdict never says "on track".
- **E6 Study window** per student (`Availability.studyWindow`, default evening = the old rule, so nothing changes for existing students). Supersedes 10.3's "one value for everyone". Rotation shifts count 0 outside the window during the rotation: the stated hours already assume the ward. `learnStudyWindow` is pure and only suggests.
- **E7** Retests are capped `RETEST_BEFORE_EXAM_DAYS` (2) before a firm exam; a new one that can't fit is left out (the topic stays weak on Pace). Confirm results show the pooled line.
- **E8** Deadline work is never all on today when other days exist. A list of days is a repeat. Leftover "today/tomorrow" words leave the title. A new fix skips 0-minute days (`FIX_MOVE_MAX_DAYS`, 7).
- **E9** No light-day offer when it would change nothing. "Do more" outcomes (`extra`) are not misses. The weekly report does not call a system "still your weakest" in the week a retest passed in it (uses the confirm session's own %, not the pooled result: minor).
- **Personas 28–33** (basic year, uni + papers, two exams in one block, next rotation, unknown bank size, late-night studier) added; all 33 run clean.
- **Not done:** E10 (imported progress moving topic order): not cheap without changing topic ordering for every student; left for later.

## Board and lecture switching (Nov 2026)

- **Per-lecture tracking.** `Resource.doneItems` (indices) and `upNext` (the student's picks); `Task.items` on lectures tasks. `doneUnits` stays the count so pace maths is unchanged. Engine helpers in `src/engine/uni.ts`: `doneLectures`, `lectureQueue`, `setLectureDone`, `chooseLectures`, `markLecturesDone` (tests in `lectures.test.ts`).
- **Switch lecture** (Today, on the selected lectures task): pick which of the remaining lectures to do today; capped at the task's count, same time. Works for numbered lectures too (the student asked for it even without names). Older saved tasks without `items` fall back to the queue.
- **Board** (new tab): a pan/zoom canvas of checklist papers (lectures, past papers, B&B videos per system, a Step 1 exam-day paper) plus sticky notes and pins. Ticks write to the same state the engine reads, then `replanToday` runs and a toast says "Today's plan updated". Zoomed out, papers show their name and progress in large type; pins keep their size and show a title. Layout positions, notes, pins and the Step 1 ticks live in `board` in the store, never in the engine.
- **Step 1 paper** (`STEP1` in `Board.tsx`, TODO(review) each year): format from the 2027 USMLE Bulletin of Information (30-minute blocks of up to 20 questions, up to 280 questions, 8-hour day, at least 55 minutes of breaks). usmle.org could not be reached from the build environment to confirm which test dates it applies to, so the paper tells the student to check usmle.org for their date.
- **Visual pass (Nov 2026).** Papers are raised cards (`--card`, `--shadow-paper`) on a darker `--canvas`, so they read as surfaces in both themes. Notes keep paper colours in dark mode (dimmed pastels with dark ink, `--on-note`), not muddy dark tints. Zoomed out below `FAR_K`, a paper shows a two-line label at fixed screen size (title, then kind and progress when wide enough) over skeleton rows, so nothing is cut mid-word. Focus zoom is `FOCUS_K` (110%), the focused paper is lifted with a shadow, and the dot grid doubles its step as you zoom out so it never turns to noise. Checked against the ui-ux-pro-max contrast and surface rules; its suggested style (neumorphism, purple, serif) was not used because it conflicts with CLAUDE.md 4b.

## Early loop and busy time (Nov 2026)

- **Early block.** A QBank student with no logged block on it gets a 10-question block (`EARLY_BLOCK_QUESTIONS`) within their first `EARLY_BLOCK_DAYS` (2) study days, reserved before topic study even when a uni exam leads. Reason: "A short first block: your score shows what to fix first". Goal: the first fix → retest by day 3, not week 2. Tests: `earlyLoop.test.ts`.
- **Default sweep for uni-only students.** `planSweep` sweeps finished lectures that have titles; `rateSweep` stores re-sweep dates in `EngineState.sweepDue`. Untitled ("Lecture 4") lectures are never swept: there is nothing to recall from a number. Returns nothing when any QBank exists (those students get the early block). Tests: `planSweep.test.ts`.
- **Busy time, day-level (supersedes "inside the window counts in full").** Busy time inside the window only cuts study when the free window (to `ROOM_UNTIL`, 01:00) is shorter than the stated hours; otherwise a 25% fatigue share. Same-time items are merged. A one-hour evening lecture on a 3 h day now costs 15 min, not 60. Students who are busy all evening still lose it all. I2 is unchanged (it uses the same `busyReduction`). The commitment preview shows the item's added cost on that day ("Leaves study time as it is" when 0). All 33 personas run clean.

## "Do more" with a choice (Nov 2026)

- **`moreChoices(state, tasks, today, max = 4)`** (`day.ts`): the `doMore` task first ("Suggested"), then the next few tasks `buildDay` would plan with the room of `max` extra tasks. It skips commitments, anything over 60 min, a second Anki task and duplicates. Every pick is `extra` ("Extra, your choice · …"), so it never counts against the student, and the rule "the plan never exceeds the stated daily time" still holds: the choice appears only after the day is done, and only on request. Test in `engine.test.ts`.
- **Board items as extras.** Open items on the student's own Board checklists can be picked too (15 / 25 / 45 min, default 25). The task carries `boardTick`. Marking it Done ticks that Board item. It has no resource or topic, so pace and estimates ignore it.

## Study sessions (Nov 2026)

- **Start runs a session, not one task.** Today's circles choose what's in it (tap to leave a task out; it stays on Today, `leftOut` in the store, cleared each day). "Start · 4 tasks · 2 h" runs them in order with one timer. The engine is unchanged: a session is only how the student works through the plan.
- **Per-task time.** `src/store/session.ts` (pure, tests in `session.test.ts`) keeps each task's timer time across switches. Ticking a task records when and how long (`Lap`). Under a minute counts the planned minutes (the old rule). Pauses and Pomodoro breaks never count as study time, so time estimates still learn from real study.
- **Reports at the end.** Ending the session (or ticking the last task) logs each ticked task in order. A ticked task is "done": tasks that need no score (lectures, videos, review) skip the Done / Partly / Didn't question; QBank and Anki still ask their one-tap number. Unticked tasks stay on Today. "Stop without saving" only appears when nothing was ticked.
- **+5 min** extends the current task's countdown only (`extra`); it doesn't change the plan.
- **Timer or Pomodoro** (`timerPrefs`, persisted): focus / short / long / long-break-every, optional auto-start of the next focus. A soft chime and vibration mark the end of a focus or break (`src/lib/chime.ts`, fails silently).

## "+" picks from the plan or the Board (Nov 2026)
- The "+" sheet on Today, with nothing typed yet, links to the same picker "Do more" uses ("Or pick from your plan or Board"), at any time of the day. Same choices (`moreChoices` + open Board items), same `addMore`: the task is `extra`, so the plan still never exceeds the stated daily time.
- Added mid-day, it joins the end of the list and the current selection stays; after the day is done it becomes the selected task, as before.

## Commitments read as written (batch 3, Nov 2026)

- Batch 3 students typed spans ("Grandma sick today and tomorrow"), whole days ("Wedding Thursday"), night duty ("Night duty 8-8") and one-off weeks ("Lectures Sun, Tue this week only"); the parser read them as single days, 8 AM–8 AM, or forever. Now: `Commitment.until` and `allDay`, the once / every-week rule, 24-hour and night times (spec section 7).
- **Untimed spill** (`WAKE_MINUTES`, 08:00, TODO(review)): an untimed item longer than the waking time outside the window takes window time, so a 12 h shift with no clock time no longer costs only 6 h × 50%.
- `longShift` (light days) now counts whole days and one-off spans, and still ignores weekly repeats (the stated hours already assume them).
- Kept: "Ward Sun-Thu 8-2" stays weekly until deleted; exams and visits are never whole days; deadlines never get `until`. Tests: `commitmentParse.test.ts`, `commitments.test.ts`, the new e2e check.

## Progress recorded as it happened (batch 3, Nov 2026)

- Students ticked a 40-min task after 10 min and it counted as fully done; "End session" threw away 30 min of an unticked task; typing "lectures left" invented or erased lectures. Now: an early tick asks how far you got (`EARLY_STOP_SHARE`), ending a session keeps real time on unticked tasks (`KEEP_SESSION_MINUTES`), and the lecture correction moves ticks rather than the course size (spec section on recording).
- Kept: question, paper and Anki reports already ask for numbers and are unchanged; a tick under a minute (done elsewhere) still credits the planned time; older saved reports without `ticked` count as ticked. Tests: `session.test.ts`, `lectures.test.ts`.

## No invented dates (batch 3, Nov 2026)
- AM (uni first, Step 1 "no idea") had Step 1 planned as if its projected ready-by date were a booked exam: the uni-leads rule only applied within 28 days, so a uni exam 40 days out shared the day with Step 1 and got 2 lectures a day for 80 lectures in 40 days. Now "no idea" next to a dated uni exam = the uni exam leads at any distance (rough dates keep the distance rule: a rough date is something the student said). The same case now plans 3–4 lectures a day.
- The ready-by projection ignored the lead split, so Pace's month was earlier than the plan could deliver. `goalMinutesOn` now caps a non-leading goal at the same 30%. `leadingUni` moved to `pace.ts` (re-exported from `planSteps.ts`).
- Wording: every estimated date says what kind it is (spec 4.1). New: rough answer "{year+1} or later" (`RoughWhen` 'next', mid that year), `roughLabel`, `WELL_AHEAD_DAYS`.
- General, not one case: the rule keys on the date's source, not on the persona; any student with a dated uni exam and an undated board exam gets it, and a student with only a board exam keeps the ready-by month as before.


## Log a result (batch 3, Nov 2026)
- Students had no place for an NBME, a mid-rotation quiz, an oral, or questions done outside Locus, so the loop never saw their real weak spots. Now: "Log a result" in the "+" sheet, and Today asks once after a test-like commitment or exam part (spec 6). One general path for every kind of result: name, optional score (percent or "7/10"), optional weak systems or lectures, optional time.
- Decisions: an outside result is a session with `outside` and no plan task (it moves no material, so pace and "done" counts stay honest); it is scored like a mixed block (board) or a past paper (uni), so the usual fix → retest rules, limits and exam caps apply unchanged. With no score it only counts time. New config: `OUTSIDE_DEFAULT_QUESTIONS` (20, used for a bare percent), `RESULT_ASK_DAYS` (2). Tests: `results.test.ts`, e2e "log a result".
