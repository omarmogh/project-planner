# Student simulation report: three students, setup plus four days

Written 16 November 2026. Prototype as it stands on branch `claude/epic-gates-j4pjav`. No app code was changed for this review.

**How it was run.** Three separate agents each played one student. Each got only a persona card, the running app and instructions for driving a real browser (Chromium, 390×844, touch, fresh storage). They were told not to open the engine spec, the engine notes, the ideas file, `CLAUDE.md` or any source code. Days were moved with the browser's own clock (Playwright `page.clock`), so the app's own 4 AM rollover did the work. **No date override was added to the app**, so there is nothing to revert. Calendar used: Day 0 (setup) Mon 16 Nov 2026 evening, Day 1 Tue 17, Day 2 Wed 18, Day 3 Thu 19, Day 4 Fri 20, Day 5 Sat 21, timezone Asia/Amman.

**How to read the labels.**

- **Confirmed** = it happened in the browser and there is a screenshot. Where I re-ran it myself afterwards, or found the line of code that causes it, I say so.
- **Felt** = a reaction or a guess about how a real student would take it. Nothing in the app proves it.
- **Known** = one of the three things you already listed as unfinished (rescue screen, "What's next?" after a rotation, past-papers and OSCE questions in onboarding). Not counted as findings.

Screenshots are in `sim-students/A/`, `sim-students/B/`, `sim-students/C/` (each with the student's raw `notes.md`) and my own re-checks in `sim-students/verify/`.

---

## 1. Summary: the five findings most likely to make a real student stop

**1. A running timer, and the "how did it go?" screen, vanish if the tab reloads.** Confirmed, all three students, 11 times in total. Start a task, switch to UWorld or Anki for 20–50 minutes, come back: if the phone has reloaded the tab, Locus is on Today as if nothing was started. Student C lost a 52-minute Anki session on day 1. I reproduced it with a plain reload (`sim-students/verify/v1-03-running-20min.png` → `v1-04-after-reload.png`; report screen: `v1-05-report-screen.png` → `v1-07-report-after-reload.png`). It is deliberate in the code (`src/store/demoStore.ts`, the `partialize` comment: "a running timer and a half-reported block don't survive a refresh"). This is the one that hits the core loop every single day, because the whole point is that the student leaves Locus to study somewhere else. How often a real phone reloads the tab is something the simulation cannot tell you (see section 6).

**2. The app shows numbers it made up, and students who know their real numbers catch it.** Confirmed, B and C.
- C tapped "Check connection" on a phone with no Anki anywhere and got "Connected. 3,200 new cards · 214 due today" (`sim-students/C/d0-17-anki-fake-connected.png`). After that every Anki finish said "Anki says 212 cards reviewed today", the same 212 on four different days (`C/d1-04-anki-finish.png`, `C/d2-07-anki-finish.png`). It is a mock constant (`src/screens/AnkiConnect.tsx`, `MOCK_DUE_TODAY = 214`; `src/screens/BlockFinished.tsx` reports `MOCK_DUE_TODAY - 2`).
- B answered "Not sure" for new cards left and was then told "2,975 new cards left" and "25 new cards a day finishes your deck in time" (`B/d0-26-after-anki.png`). The 3,000 is a default (`ANKI_NEW_UNSURE` in `src/engine/config.ts`), shown as if it were B's deck.
Both students named this as the thing that would make them delete the app. In a prototype shown to classmates, the fake "Connected" is the riskiest single screen: the first person who taps it without Anki open will stop believing the rest.

**3. For a student with a uni exam close and Step 1 far or vague, the plan is mostly Step 1.** Confirmed, A (also visible for B and C on the uni side). A said "No idea" for the Step 1 date and "maybe next year". The app picked a date itself ("Step 1 in 134 days", `A/d0-14-after-build.png`) and then gave IM 30 minutes against 80–90 for Step 1 on weekdays, and 35 minutes against 3 h 25 min on the weekend with the IM exam 17 days away (`A/d4-01-open.png`). A's end answer: would drift away in week two unless Step 1 can be pushed down until after the IM exam. This is your example user from the brief, so it matters more than its single-student count suggests.

**4. The headline numbers on Pace move and contradict each other.** Confirmed, all three.
- C: "Peds exam: about 4 days short. +5 min a day closes the gap." became 5, then 8, then "about 11 days short" with the exam 9 days away, still with "+5 min a day" (`C/d1-14-pace.png`, `C/d5-02-pace.png`). The same screen says "Needed 4 h 38 min a day · You have 4 h" (`C/d3-02-what-if.png`), which is 38 minutes, not 5.
- B: "Skipping tomorrow: ready 1 day later, around 11 Feb" (`B/d2-12-whatif-skip-full.png`); after the skip Pace said 13 Feb (`B/d4-01-coming-back.png`). The date had also slid from 7 Feb to 10 Feb over two days labelled "on track". (For C the same prediction came true exactly: `C/d3-03-if-i-skip-tomorrow.png` → `C/d5-01-return.png`.)
- A: "ready for Step 1 around March 2027" at setup (`A/d0-13-time-march2027.png`) became April by Friday; the Step 1 countdown read 134 on both Monday and Tuesday.
C's end answer was to "ignore the Peds headline". A headline students learn to ignore is worse than no headline.

**5. "Studied" on Today counts planned minutes, not real ones, and "Done" is accepted after one minute.** Confirmed, all three. A's timers ran 1 + 36 minutes on Tuesday and Today said "1 h 10 min studied" (`A/d1-10-end-of-day.png`); the Week tab said 1 h 11 min for the whole week (`A/d4-10-week.png`). C: "3 h 40 min studied" against 2 h 34 on the timer (`C/d1-13-all-done.png`). Cause: `studiedMinutes()` in `src/engine/progress.ts` returns the task's planned minutes for Done. The same root cause is the missing "I already did this": B had done Anki earlier in the day and had to press Start then Finish to tick it off, which logged 1 minute (`B/d0-25-anki-finish.png`). Note the caveat in section 6: many of the short timers were caused by the test setup, so the size of the gap is exaggerated, but the two screens disagreeing is real.

**What did not make the top five but came up for all three:** coming back after a skipped day is completely silent. All three felt relief first ("it doesn't make you feel like a failure") and then doubt ("did it even notice?"). That is Felt, and it is the reaction closest to your no-guilt principle working, so I would test it with classmates before changing it.

---

## 2. The three students

### Student A: lower-performing, IM rotation, exam in about 3 weeks, Step 1 "maybe next year"

**Voice:** avoids, under-reports, a little ashamed, wants to be told what to do without being judged.

**Setup walkthrough (Mon 16 Nov, about 21:30).** Thirteen small screens; felt like 2–3 minutes; never close to quitting.
- Ticked Step 1 because everyone does, then "Not yet" → "No idea" for the date.
- Lectures left: the stepper starts at 15 and moves one per tap. A stopped at 20 although the real number is 26 or more, and did not notice it can be typed (`A/d0-06.png`). Confirmed for the stepper; the under-reporting is the persona's choice.
- Skipped the UWorld import, typed 550 done.
- Left the default 2 h weekdays / 4 h weekends although A's honest number is about 1 h. Felt: the default reads like the expected answer.
- Setup said "At this pace you'd be ready for Step 1 around March 2027" (`A/d0-13-time-march2027.png`).
- First Today at 21:40: "Here's your first day", 1 h 50 min planned, "IM exam in 21 days · Step 1 in 134 days" (`A/d0-14-after-build.png`). Inner thought: "I said no idea. Where did 134 come from?"

**Day by day.**
- **Day 1, Tue.** Opened to the Week tab, not Today, because that was the last tab used (`A/d1-01-open.png`). Started the IM lecture, left for the slides, came back to a reset app (`A/d1-04-reopen.png`). Did 36 of 80 minutes of the Cardio video and answered Partly: "partly done. The rest comes first next time." (`A/d1-09-after-partly.png`), which A liked. End of day: "1 h 10 min studied" against 37 real minutes (`A/d1-10-end-of-day.png`). Tomorrow's preview showed the same task at 90 minutes, longer than the 80 A had failed to finish (`A/d1-11-tomorrow-90min.png`). "I did half and it got bigger?"
- **Day 2, Wed.** Did not open the app. (No `d2-*` files exist.)
- **Day 3, Thu.** No comment at all about yesterday; same 2 h plan; the Cardio end date had quietly moved from 10 Dec to 11 Dec. Strong relief, then "did it notice?". Timer ran past the estimate: "3:00 over 30 min — finish when you're done" (`A/d3-02-timer-over.png`), liked. Scored 4 of 10 and had to convert it to 40 because the field is "Correct __ %". Result screen: "Below 60%, so it gets a fix and a retest" (`A/d3-05-after-40pct.png`): "ok, it's not shouting at me, it's telling me what happens next." Tomorrow listed "Cardio: Cardiac cycle" twice, the second marked "Picks up where you left off" although it is the question block and was never started (`A/d3-07-tomorrow.png`; I saw the same on Saturday, `verify/v1-02-today.png`).
- **Day 4, Fri (weekend).** 3 h 45 min planned, 35 min of it IM (`A/d4-01-open.png`). Typed `3azoomeh family dinner 7pm 3h` into "+": parsed, "Takes 3 h from today's study time", plan shrank to 50 min and kept the IM lecture plus the 15-minute fix (`A/d4-03-plus-typed.png`, `A/d4-04-after-commitment.png`). Best moment of the week for A. One wrinkle: the line read "→ 1 h of study time instead of 4 h" while "Weekend: a longer day." was still on screen. Week tab: "1 h 11 min studied · 10 questions · 40% correct · Weak topics fixed 0 · Next week: Cardio, still your weakest · Screenshot to share." (`A/d4-10-week.png`). Felt judged, and would never share it. It also appeared on day 4 although Monday said it comes in 7 days.

**Feelings and trust (1–10):** setup 6 → day 1 6 → day 3 7 → day 4 7. Up on the silent return and the dinner; held down by Step 1 taking the plan and the Week card.

**End answers.**
- Keep using it? Yes for the IM lecture and the "+", but would drift in week two unless Step 1 can be pushed down until after 7 Dec.
- To a friend: "Jarbiha, it doesn't make you feel like a failure when you skip a day, w bt7kilha 3endi 3azoomeh and it shrinks the plan; bas it's obsessed with Step 1."
- Would delete it if: the Week card were pushed at me, or the first red "you're behind".
- Would miss: opening after a bad day to a normal small plan with no comment.

### Student B: medium, Surgery rotation, exam in about 5 weeks, Step 1 in about 4 months, loyal to a paper planner

**Voice:** skeptical, precise, checks every number against the planner.

**Setup walkthrough.** 12–14 screens, 3–4 minutes against the promised "About a minute".
- Used "Pick date" for the rotation end (17 Dec) and "No" for exam-at-end, with its own date 20 Dec: handled correctly ("in 34 days").
- Typed 26 lectures directly (found the typing A missed).
- UWorld "Type the numbers" is 19 systems × 2 boxes (`B/d0-13-uworld-type.png`). B filled six and stopped. The app then said "6 systems, 880 questions. Renal (52%) gets a fix first." and prefilled "UWorld questions done 880" on the next screen (`B/d0-15.png`); B's real total is 1,260 and had to correct it.
- Anki new cards: "Not sure". Reviews: 45 min.
- "Connect Anki on this computer?" shown on a phone (`B/d0-19.png`). Skipped.
- The sources screen only lists Step 1 sources; nothing for Surgery.

**Day by day.**
- **Day 0 evening.** Full 2 h 25 min plan at 21:25. Anki already done that morning: no way to say so, so Start → Finish, 1 minute logged (`B/d0-25-anki-finish.png`), then "2,975 new cards left" (`B/d0-26-after-anki.png`). "I told you I don't know. Why are you telling me?" Lost a timer and the "About how many did you review?" step to a tab reload (`B/d0-23-anki-timer.png`, `B/d0-24-reopen-midtimer.png`).
- **Day 1, Tue.** Neuro block under the line: fix added with a reason, and "Change fix" offered four choices (`B/d1-07-neuro-result.png`, `B/d1-08-change-fix.png`). "This is the first thing my planner can't do." Trust up. The Tomorrow list at 23:00 said 2 h 15 min, 5 tasks (`B/d1-10-tomorrow-full.png`).
- **Day 2, Wed.** Today was 2 h 10 min, 4 tasks, not what the preview had shown (`B/d2-01-today.png`). Typed "مناوبة جراحة بكرا 4-9": day, type and tag were right, the time was not read, and the numbers were displayed "9-4" (`B/d2-03-add-arabic.png`). After entering 16:00–21:00 by hand: "Takes all of Tomorrow's study time." with nothing in between (`B/d2-04-add-times.png`). B backed out and did not save it. Pause was not counted as study time (`B/d2-07-paused.png`), liked. "If I skip tomorrow: ready 1 day later, around 11 Feb" (`B/d2-12-whatif-skip-full.png`), liked a lot. End of day "2 h 10 min studied" against 2 h 03 on the timers (`B/d2-09-all-done.png`).
- **Day 3, Thu.** Did not open the app. (No `d3-*` files exist.)
- **Day 4, Fri.** App reopened on Pace: "Ready around 13 Feb" (`B/d4-01-coming-back.png`), two days later than promised. Today's only sign of the missed day was "Retest, postponed from yesterday" (`B/d4-02-today.png`). Anki still planned at 45 min after a missed day; it took 68. Retest scored 70%: "Too close to call. 70% on the retest, one question from the line. 5 more Renal questions tomorrow will settle it." (`B/d4-04-retest-result.png`). The only line the app has ever named is 60%. After a Partly answer the report asked "How did the 10 questions go?" with the counter at 5 (`B/d4-06-brainstem-partly.png`). Week said "Neuro, still your weakest" while Pace showed Renal lowest at 53% (`B/d4-09-week-full.png`). Seven tasks today, eight tomorrow.

**Feelings and trust:** setup 6 → day 0 end 6 → day 1 7 → day 2 8 → day 4 7. Peak at the what-if; the drop is the what-if being wrong.

**End answers.**
- Keep using it? Yes for Step 1, beside the paper planner, which stays for the rotation.
- To a friend: "Jarrbiha: it tells you every day what to do for Step 1 and it chases your weak topics for you, bas don't trust its Anki numbers and keep your planner for the rotation."
- Would delete it if: a second untrue statement, or more made-up numbers.
- Would miss: the automatic fix and the dated retest.

### Student C: higher-performing, Peds rotation, exam in about 2 weeks, Step 1 in about 7 weeks, tries to break things

**Voice:** impatient, tests every input, low tolerance for anything that looks invented.

**Setup walkthrough.**
- Searched "مؤتة": "No match in the list." (`C/d0-02-university-search.png`). Found it in English.
- A fourth rotation subject was refused with a clear message (`C/d0-03-four-rotations.png`). Fine.
- "2 weeks" never shows which date it means (it became Mon 30 Nov).
- Lectures: −5 became 5 and 999 became 200, silently (`C/d0-04-lectures.png`).
- Odd Step 1 dates were rejected with good messages (`C/d0-06-odd-dates.png`).
- No Sketchy and no "other" in sources.
- Pasted garbage into the UWorld import: good message (`C/d0-08-garbage-read.png`). Pasted real numbers with one row at 250%: parsed, that row shown as "no %" (`C/d0-09-paste-read.png`).
- Typed Psych 99999 questions at 140%: cut to 9,999 and 100, and accepted as "11 systems, 11,509 questions" although UWorld has 3,600 (`C/d0-11-extreme-numbers.png`). After C corrected the import to 1,570, the next screen still prefilled "UWorld questions done 11,509" (`C/d0-12-uworld-done-11509.png`; reproduced twice; cause is `Math.max(previous, new)` in `src/screens/Onboarding.tsx` line 320).
- Picking a third "studying now" system silently dropped the first (`C/d0-13-third-system-drops-first.png`).
- Time step: at 2 h "Peds exam is about 39 days short" (the exam is 14 days away); at 30 min "Step 1 is about 61 days short"; at 4 h "about 4 days short" (`C/d0-14…16`). C chose 4 h.
- Connect Anki → "Connected. 3,200 new cards · 214 due today" with no Anki (`C/d0-17-anki-fake-connected.png`). "It's lying. What else is?"

**Day by day.**
- **Day 1, Tue.** Anki task labelled "Synced from Anki". Lost a 52-minute Anki timer to a tab reload (`C/d1-02-anki-running.png`, `C/d1-03-reopen-mid-task.png`). Score field tests (`C/d1-08-micro-score.png`): 130 → Save greyed out with no reason; −20 → 20; "7/10" → 710; question count 5000 → 120, 0 → 1. Arabic digits were ignored (seen, no separate screenshot). Peds lecture ran over; next estimate went 60 → 65 (`C/d1-10-peds-overtime.png`), liked. Renal 50%: clear fix and retest (`C/d1-12-renal-50.png`). "3 h 40 min studied" against 2 h 34 (`C/d1-13-all-done.png`). Pace: "about 4 days short. +5 min a day" (`C/d1-14-pace.png`).
- **Day 2, Wed.** Opened on Week (`C/d2-01-opens-on-week.png`). "seminar DKA thursday 3h" → "Counts as studying Diabetes this week." (`C/d2-03-add-seminar.png`, `C/d2-05-today-with-seminar.png`): "ok, that's smart." The Arabic version "سمنر بكرا 3 ساعات" was not parsed.
- **Day 3, Thu.** Opened on Pace: 8 days short. What-if slider moves in 15-minute steps and only shows Step 1 (`C/d3-02-what-if.png`). Did 40 questions instead of 10; the title stayed "How did the 10 questions go?" (`C/d3-07-gramneg-40q.png`). 90% on a topic still showed "0 solid". "Do more" did nothing on three taps with 3 h 55 of 4 h used (`C/d3-11-do-more.png`). "If I skip tomorrow" predicted 28 Dec (`C/d3-03-if-i-skip-tomorrow.png`).
- **Day 4, Fri.** Did not open the app. (No `d4-*` files exist.)
- **Day 5, Sat 09:40.** Normal Today, 3 h 55 min, 7 tasks, "Retest, postponed from yesterday" (`C/d5-01-return.png`). Step 1 "Ready around 28 Dec", exactly as predicted. Peds now "about 11 days short", 9 days out (`C/d5-02-pace.png`). Biostats retest 80%: "Passed. One more retest Saturday 28 Nov to make sure it sticks, then it counts as solid." (`C/d5-05-biostats-solid.png`). Renal retest failed: "needs another pass… A different fix this time" (`C/d5-06-renal-retest-failed.png`). Both liked. Week numbers were exact (`C/d5-03-week.png`), but "Renal, still your weakest" while Biostats was lower. Lost another timer (`C/d5-04-timer-lost-again.png`).

**Feelings and trust:** setup 5 → day 1 6 → day 2 6 → day 3 6 → day 5 7. Lowest start of the three because of the fake connection; recovered only because the retest loop did exactly what it said.

**End answers.**
- Keep using it? Yes for the retests; Anki stays outside the app; ignores the Peds headline.
- To friends: "Jarrbo: it catches your weak topics and actually makes you retest them, bas don't believe its Anki numbers or the 'days short' thing."
- Would delete it if: caught inventing one more thing.
- Would miss: "Below 60%, so it gets a fix and a retest", with a date.

---

## 3. Across students

### Every friction point

Severity is my judgement of how likely it is to cost you a user, not how hard it is to fix.

| # | Screen | What happened | Who | Severity | Status |
|---|---|---|---|---|---|
| 1 | Running timer | Timer gone after the tab reloads; minutes lost | A B C | High | Confirmed (`verify/v1-04-after-reload.png`) |
| 2 | Block finished | Report screen gone after reload; task back to "not started" | A B C | High | Confirmed (`verify/v1-07-report-after-reload.png`) |
| 3 | Connect Anki | "Connected. 3,200 new cards · 214 due today" with no Anki | C (B saw the screen, skipped) | High | Confirmed (`C/d0-17…`) |
| 4 | Anki finished | "Anki says 212 cards reviewed today", same on four days | C | High | Confirmed (`C/d1-04…`, `C/d2-07…`) |
| 5 | Anki finished / Tomorrow | Deck size invented after "Not sure" ("2,975 new cards left") | B | High | Confirmed (`B/d0-26…`) |
| 6 | Today | Step 1 takes most of the day with a uni exam 2–3 weeks away | A (B, C milder) | High | Confirmed (`A/d4-01-open.png`) |
| 7 | Today header | A Step 1 countdown after answering "No idea" | A | Medium | Confirmed (`A/d0-14…`) |
| 8 | Pace | "N days short" grows to more than the days left; "+5 min a day" next to a 38-minute gap | C | High | Confirmed (`C/d5-02-pace.png`, `C/d3-02…`) |
| 9 | Setup, time step | "Peds exam is about 39 days short" for an exam 14 days away | C | Medium | Confirmed (`C/d0-14…`) |
| 10 | Pace / What if | "If I skip tomorrow" prediction off by two days | B (correct for C) | Medium | Confirmed (`B/d2-12…`, `B/d4-01…`) |
| 11 | Pace | Ready date slides while labelled "on track" | A B | Medium | Confirmed (`A/d0-13…`, `B/d4-01…`) |
| 12 | Today, end of day | "N studied" is planned minutes, not timer minutes; Week shows the real ones | A B C | Medium | Confirmed (`A/d1-10…` vs `A/d4-10…`) |
| 13 | Today | No "I already did this"; Start → Finish logs 1 minute | B (A, C used it as a workaround) | Medium | Confirmed (`B/d0-25…`) |
| 14 | Today / Pace (uni) | "IM slides: next lecture" never says which lecture; no fix loop for the uni exam | A B C | Medium | Confirmed (every Today screenshot) |
| 15 | Pace (uni) | "Past papers 0 of 4" though never asked | A B | Low | **Known** |
| 16 | App open | Opens on the last tab used (Week or Pace), not Today | A B C | Medium | Confirmed (`A/d1-01-open.png`, `C/d2-01…`) |
| 17 | Today after a skipped day | No acknowledgement at all; only "Retest, postponed from yesterday" if one was due | A B C | Medium | Confirmed it is silent (`A/d3-*`, `B/d4-02…`, `C/d5-01…`); the doubt is Felt |
| 18 | Today / Tomorrow | "Picks up where you left off" on a task that was never started; same topic title twice | A B | Low | Confirmed (`A/d3-07…`, `verify/v1-02-today.png`) |
| 19 | Tomorrow preview | After Partly, the same task comes back longer (80 → 90 min) | A | Medium | Confirmed (`A/d1-11…`) |
| 20 | Tomorrow preview | Tomorrow's plan differs from what was previewed the night before | B | Low | Confirmed (`B/d1-10…` vs `B/d2-01…`) |
| 21 | Block finished | Score is percent only; 4 of 10 must be converted; "7/10" becomes 710 | A C | Medium | Confirmed (`C/d1-08…`) |
| 22 | Block finished | Title stays "How did the 10 questions go?" when the count is 40, or 5 after Partly | B C | Low | Confirmed (`C/d3-07…`, `B/d4-06…`) |
| 23 | Block finished | Save greyed out for 130% with no reason; −20 silently becomes 20 | C | Low | Confirmed (`C/d1-08…`) |
| 24 | Retest result | "one question from the line": the pass line (70%) is never stated; the only named line is 60% | B | Medium | Confirmed (`B/d4-04…`; `RETEST_PASS = 70`, `WEAK_BELOW = 60` in `src/engine/config.ts`) |
| 25 | Week | "still your weakest" names a different system from the lowest on Pace | B C | Low | Confirmed (`B/d4-09…`, `C/d5-03…`) |
| 26 | Week | Card appears within days though it said 7; "0 fixed · Screenshot to share" reads as a judgement | A (timing also C) | Medium | Card timing Confirmed (`A/d4-10…`); the judged feeling is Felt |
| 27 | Commitments | Arabic time range not read ("4-9" shown as "9-4"); "سمنر بكرا 3 ساعات" not parsed | B C | Medium | Confirmed (`B/d2-03…`); C's has no screenshot |
| 28 | Commitments | Evening block takes "all of tomorrow's study time", nothing in between | B | Medium | Confirmed (`B/d2-04…`) |
| 29 | Commitments | "1 h of study time instead of 4 h" for a 3 h dinner, with "Weekend: a longer day." still shown | A | Low | Confirmed (`A/d4-04…`) |
| 30 | Setup, UWorld | 19 systems × 2 boxes to type by hand | B | Medium | Confirmed (`B/d0-13…`) |
| 31 | Setup, UWorld | "Questions done" prefilled from a partial or corrected import (880; stale 11,509) | B C | Medium | Confirmed (`B/d0-15.png`, `C/d0-12…`) |
| 32 | Setup, UWorld | 11,509 questions accepted against a 3,600 bank | C | Low | Confirmed (`C/d0-11…`) |
| 33 | Setup | Lectures stepper starts at 15, one per tap, typing not signposted; silent clamping (−5 → 5, 999 → 200) | A C | Low | Confirmed (`A/d0-06.png`, `C/d0-04…`) |
| 34 | Setup | Third "studying now" system silently drops the first | C | Low | Confirmed (`C/d0-13…`) |
| 35 | Setup | University search does not find "مؤتة" | C | Medium for your batch | Confirmed (`C/d0-02…`) |
| 36 | Setup | "About a minute" took 2–4 minutes | A B | Low | Felt (agents cannot time a human) |
| 37 | Setup | Default 2 h / 4 h left untouched by a student whose real time is 1 h | A | Medium | Felt |
| 38 | Setup | "Connect Anki on this computer?" asked on a phone | B C | Low | Confirmed (`B/d0-19.png`) |
| 39 | Setup | Sources list has no Sketchy, no "other", nothing for the rotation | B C | Low | Confirmed (setup screenshots) |
| 40 | First Today | Full day's plan handed out at 21:30 on the first night | A B | Medium | Confirmed (`A/d0-14…`) |
| 41 | Today | "Do more" does nothing when the day is nearly full | C | Low | Confirmed (`C/d3-11-do-more.png`) |
| 42 | Today / Pace | "about 11 days left" on Today against "until 5 Dec" on Pace for the same system | B C | Low | Confirmed (`B/d0-30-pace-full.png`) |
| 43 | Today | "0 solid" after a 90% block; "topics watched" for a reading resource | B C | Low | Confirmed (`C/d3-06…`) |
| 44 | Today | Plan never fills the stated daily time (2 h 10–2 h 25 of 2 h 30) | B | Low | Confirmed (`B/d2-01…`) |
| 45 | Today | 7–8 tasks in a day | B C | Low | Felt as a problem; counts Confirmed |
| 46 | Pace | UWorld total went up 15 after two 10-question blocks | B | Low | Not confirmed: no screenshot, treat as a lead only |
| 47 | Missing screens | Rescue options; "What's next?" after the rotation | (C would have hit rescue) | n/a | **Known** |

### What only one student hit, and why

- **Step 1 swallowing the plan (A).** Only A had a vague, far Step 1 and a low daily time. B and C wanted Step 1 in the plan.
- **Invented deck size (B).** Only B answered "Not sure" and then read the result carefully. A did not use Anki; C went through the fake connection instead.
- **Fake "Connected" and "212 cards" (C).** Only C tapped "Check connection". Any curious classmate will.
- **"Days short" contradiction (C).** Only C's exam was close enough for the uni goal to be behind.
- **What-if prediction wrong (B) but right (C).** B had a retest due on the skipped day; C did too. I do not know why they differ; it needs a look in the engine.
- **"Too close to call" (B).** Only B landed exactly on 70%.
- **Task grew after Partly (A).** Only A answered Partly on a long video task on day 1.
- **All the input clamping (C).** Only C typed nonsense on purpose. Real students will hit the "7/10" and Arabic-digit cases by accident, the rest rarely.
- **Week card felt like a judgement (A).** Only the low scorer minds a card that prints the score with a share prompt. B and C found the numbers accurate and moved on.
- **All-or-nothing commitment (B).** Only B entered a block that covered the whole evening study window.

---

## 4. Bugs, with steps to reproduce

All at 390×844. "Finish setup" means any complete onboarding.

1. **Running timer lost on reload.** Finish setup → Today → Start → wait → reload the page (or let the phone discard the tab). Result: Today, task not started, no minutes kept. `src/store/demoStore.ts` (`running` and `overlay` are left out of `partialize`). Screens: `verify/v1-03…`, `v1-04…`.
2. **Half-finished report lost on reload.** Start → Finish → on "How did it go?" reload. Result: Today, task not started, the timed minutes gone. Same cause. `verify/v1-05…`, `v1-07…`.
3. **Fake Anki connection.** Setup with Anki → "Connect Anki" → "Check connection" with no Anki running. Result: "Connected. … 214 due today"; later every Anki finish reports 212 cards. `src/screens/AnkiConnect.tsx`, `src/screens/BlockFinished.tsx` line 26. This is prototype fake data, but nothing on screen says so.
4. **Stale "UWorld questions done".** Setup → UWorld import → type a large number (e.g. Psych 9,999) → Continue → Back → correct it → Continue. Result: "UWorld questions done" still shows the old, larger total. `src/screens/Onboarding.tsx` line 320 (`Math.max` keeps the larger value). `C/d0-12…`.
5. **"Days short" larger than days left, with a fixed "+5 min a day".** Setup: uni exam in 2 weeks, 26+ lectures left, 4 h a day, Step 1 in 7 weeks. Use it a few days, skip one. Result on Pace: "about 11 days short" 9 days before the exam, "+5 min a day closes the gap", while the what-if panel says 4 h 38 min needed against 4 h. `src/screens/Pace.tsx`, `src/engine/reasons.ts` line 119. `C/d5-02-pace.png`.
6. **"Picks up where you left off" on an unstarted task.** Do the video for a topic → next day the topic's question block appears with that reason; if the video is also still listed, the same title appears twice. `src/engine/reasons.ts` line 90. `verify/v1-02-today.png`.
7. **Report title ignores the edited count.** On a question block report, change the count to 40 (or answer Partly so it becomes 5). Title still says "How did the 10 questions go?". `src/screens/BlockFinished.tsx` line 45. `C/d3-07…`.
8. **Score field.** Type "7/10" → reads 710; type 130 → Save greyed out, no message; type −20 → 20. `src/screens/BlockFinished.tsx`. `C/d1-08…`.
9. **"Do more" no-op.** Finish all tasks on a day planned within a few minutes of the daily limit → tap "Do more". Nothing happens and nothing explains why. `src/screens/Today.tsx` line 180, `src/engine/day.ts`. `C/d3-11…`.
10. **Arabic time range.** "+" → "مناوبة جراحة بكرا 4-9". Day, type and tag are read; the time is not, and the digits display reversed. `src/engine/commitmentParse.ts`. `B/d2-03…`.
11. **"Weakest" disagrees between Week and Pace.** After blocks in two or more systems, compare Week's "still your weakest" with the lowest bar on Pace. `src/screens/Weekly.tsx` line 34. `B/d4-09…`.
12. **"Skip tomorrow" prediction.** With a retest due tomorrow, open What if → "If I skip tomorrow", note the date, skip the day, reopen Pace. For B it was two days later than predicted. Seen once; C's matched. Needs an engine look before calling it a bug.

Not bugs, but behaviours that surprised: the app reopening on the last tab (`tab` is saved on purpose), and the Today total counting planned minutes (`studiedMinutes()` in `src/engine/progress.ts`).

---

## 5. What worked

Each of these changed a student's mind in the app's favour, and all are Confirmed on screen.

- **The weak-block screen.** "Below 60%, so it gets a fix and a retest", with what was added and when. All three liked it; A, the one most afraid of being judged, was not put off (`A/d3-05…`, `B/d1-07…`, `C/d1-12…`).
- **The retest results.** Pass with a second retest dated; fail with "a different fix this time" (`C/d5-05…`, `C/d5-06…`). This is what brought C from 5 to 7, and what B and C would miss.
- **"Change fix"** with four choices (`B/d1-08…`).
- **Commitments in mixed language.** `3azoomeh family dinner 7pm 3h` and "seminar DKA thursday 3h → Counts as studying Diabetes this week" (`A/d4-03…`, `C/d2-03…`). "بكرا" read as tomorrow.
- **Partly.** "The rest comes first next time" and "Not right? Change it" (`A/d1-09…`, `B/d1-03…`, `C/d1-11…`).
- **Timer manners.** "3:00 over 30 min — finish when you're done"; Pause not counted; "Stop without saving" does that; the next estimate moved 60 → 65 after an overrun.
- **No guilt on return.** Nothing red, no streak, a normal plan. A's favourite thing about the app.
- **Honest limits where they exist.** "30 new cards a day is what fits; the deck won't all be seen before the exam" (`C/d0-19…`). C trusted this line more than any other.
- **"If I skip tomorrow"** as a one-tap question (when it is right).
- **Validation messages** for a fourth rotation, bad Step 1 dates and a garbage paste.
- **Setup never lost anyone.** Longer than promised, but nobody came close to quitting.

---

## 6. Where this simulation is probably wrong

- **The agents are not students.** They are patient, they read every line, and they do not get bored. Real students skim, so they will miss more copy than these did and be bothered less by wording.
- **How often the timer is lost is unknown.** The test setup closed the browser between sessions and restored only saved storage, so every return was a reload. On a real phone the tab often survives a 30-minute trip to UWorld, and often does not (low memory, iOS Safari). The bug is real (I reproduced it with a plain reload); the frequency in section 1 is the test's, not a phone's.
- **Many "Done" answers came after a 1-minute timer**, because sessions ended on the report screen and the agent had to redo the step. That inflates the gap in finding 5. The mismatch between Today and Week is still real and comes from the code.
- **`CLAUDE.md` was put into each agent's context automatically by the environment.** None of them opened it or any of the forbidden files (B ran `git status` once; nobody read the spec, notes, ideas or source). But they were not as naive as intended: they may have known words like "fix" and "retest" in advance, which makes the loop look easier to understand than it will be for a classmate.
- **Feelings are guesses.** Trust scores, "felt judged" and "relief then doubt" are plausible reactions from a persona card, nothing more. That is why they are marked Felt.
- **Nobody actually studied.** Scores were chosen by the persona, so nothing here says whether the fixes help or whether the time estimates are right.
- **Four days is short.** Light-day offers, exam week, the last days before the uni exam and the rotation ending were never reached. Rescue mode would have fired for C but has no screen (Known).
- **Not tested at all:** a real phone, Safari, Arabic interface, dark mode, slow network, notifications, two devices.
- **One run per persona.** A different run would make different choices; one-student findings in section 3 could be more or less common than they look.
- **Persona bias.** I wrote the cards. A was told to be vague about Step 1, which is exactly what exposed finding 3. Whether your classmates are vague about Step 1 is a question for the interviews.

---

## 7. Questions for the 10 classmate interviews

Ask these before showing the prototype unless marked "after".

1. "When you sit down to study and you're using UWorld or Anki on your phone, what else is open? Do you switch between apps, and does anything ever reload on you?" (finding 1)
2. "Do you do Anki on your laptop or your phone?" (already on your list; findings 2 and 3 make it urgent)
3. "Do you know roughly how many new Anki cards you have left? Without checking?" (invented deck size)
4. "Right now, with the rotation exam coming, how much of an evening goes to Step 1 and how much to the rotation? Who decides that?" (finding 3)
5. "Do you have a Step 1 date? If not, do you want it in your daily plan anyway?" (finding 3)
6. "After a question block, how do you remember your result: 7 out of 10, or 70%?" (score entry)
7. "When you miss a day, what do you want your planner to say the next morning? Nothing? One line?" (silent return)
8. After the demo: "This says 'about 4 days short'. What does that mean to you? What would you do?" (finding 4)
9. After the demo: "It says 2 hours studied. Is that what you'd expect it to count?" (finding 5)
10. "How many hours do you really study on a weekday in this rotation? And what would you tell an app?" (A left the default)
11. "If you had a seminar or an on-call tomorrow, how would you type it?" Let them type it themselves, in whatever language. (commitment parsing)
12. After the demo: "Would you ever screenshot this weekly card? Who would you send it to?" (Week card)
13. "For the rotation exam, what do you study from, and how do you pick the next lecture?" (generic uni side)
14. "What's the first thing you'd want to see when you open it at 9 pm for the first time?" (first-night full plan)

---

## 8. Recommended fixes, by impact (made: see section 9)

1. **Keep the running timer and the pending report across reloads.** Save the start time and the open report with the rest of the state, and reopen on them. *Small.* Closes findings 1 and 2 of the table, the only ones that break the core loop.
2. **Stop showing invented Anki numbers.** For the classmate demo: make "Check connection" say plainly that it is a demo, or hide Connect Anki on phones altogether; and when the student says "Not sure", say "about 25 new cards a day" without quoting a deck size. *Small.*
3. **Let the uni exam lead when it is near and Step 1 is far or undated.** At minimum, "No idea" should mean no countdown and a small Step 1 share until the rotation exam passes; better, one choice in setup or on Today: "Until the IM exam: mostly IM / balanced / mostly Step 1". *Medium* (engine sharing rule plus one control).
4. **Make the Pace headline say one consistent thing.** Never print more days short than days left; derive "+N min a day" from the same figure as "Needed … a day"; when the gap cannot be closed with time, say so and point to the options. *Medium.* The full answer is the rescue screen (**Known**, *large*).
5. **Count real minutes on Today, and add "Already did it".** Use the timer minutes for "N studied" so it matches Week; give each task a quiet "Done already" that asks only for the result. *Small to medium.*
6. **Open on Today each new day.** Keep the last tab within a day if you like, but the first open after 4 AM goes to Today. *Small.*
7. **Score entry as "7 of 10".** Accept correct-of-total as well as percent, accept Arabic digits, and make the title follow the count. *Small.*
8. **State the retest line.** "70% or more passes" on the retest task and its result. *Small.*
9. **One quiet line after a missed day.** Something like "Yesterday's tasks are spread over the next days. Nothing lost." shown once. Test the wording with classmates first; A liked the silence. *Small.*
10. **Fix the small untruths.** "Picks up where you left off" only when something was started; one "weakest" shared by Week and Pace; Partly should not return a longer task; "Do more" should say why it cannot add anything. *Small each.*
11. **Uni side: name the lecture.** Even "Lecture 7 of 26" is better than "next lecture"; a fix loop for the uni exam depends on past papers (**Known**). *Medium.*
12. **Setup clean-up.** Do not prefill "questions done" from a partial import (or at least never keep a stale larger value); cap the import at the bank's size; say when a value was adjusted; add Arabic names to the university search; drop "About a minute". *Small each.*
13. **Commitments.** Read Arabic time ranges; when a block covers the whole evening, offer "a short essentials day" in place of "takes all of tomorrow's study time". *Medium.*
14. **Week card.** Do not show it before a full week, and drop "Screenshot to share" when there is nothing good on it. *Small.*
15. **First night.** If setup finishes late in the evening, start with one short task and say the full plan starts tomorrow. *Small.*

---

## 9. Fixes made

For each problem, two options were weighed (A and B); the chosen one is built and tested. Table rows (#) refer to section 3, bugs to section 4.

| Fix | Problem | A | B | Chosen, and why |
|---|---|---|---|---|
| 1 | Timer and report lost on reload (rows 1, 2; bugs 1, 2) | Save the running timer (start time) and the open report with the rest of the state | Ask "Resume your block?" after a reload | **A.** Nothing to answer; the elapsed time is right because it's computed from the start time. |
| 2 | Invented Anki numbers (rows 3–5, 38; bug 3) | A real AnkiConnect client that says plainly when Anki isn't reachable, hidden on phones, and "about N new cards a day" after "Not sure" | Keep the mock, labelled "demo" | **A.** A labelled fake still teaches classmates the wrong thing; the real call is small and fails quietly back to the manual path. |
| 3 | Step 1 takes the day with a uni exam near (rows 6, 7) | An automatic rule: a firm uni exam within 28 days leads when Step 1 is undated or 60+ days after it; Step 1 keeps 30%. No countdown for "No idea" or rough dates | A "mostly IM / balanced / mostly Step 1" control | **A.** Defaults over settings; the dates already say which exam is near. |
| 4 | "Days short" larger than days left; "+5 min" beside a 38-min gap (rows 8, 9; bug 5) | Say the gap in time; "+X min a day" from the same figure; over 90 min a day, say it can't be closed with time | Clamp days short to the days left | **A.** B hides the contradiction; A removes it. |
| 5 | "Studied" is planned minutes; no "Already did it" (rows 12, 13) | Store timer minutes on each task | Derive the total from the day's sessions; "Done already" asks only for the result | **B**, plus "Done already". One source of truth, so Today and Week can't disagree. Untimed sessions never tune estimates. |
| 6 | Opens on the last tab (row 16) | Reset to Today on a new study day | Don't save the tab at all | **A.** Within a day the tab is kept (a reload stays where you were). |
| 7 | Score only as a percent; "7/10" → 710 (rows 21–23; bugs 7, 8) | A free-text field that reads 62, 62%, 7/10, 7 of 10, ٧/١٠ and explains anything it can't read | A questions/correct stepper pair | **A.** One field, typed as students say it; the title follows the count. |
| 8 | The 70% retest line never stated (row 24) | State it on the task, the report and the result | State it in the result only | **A.** You should know the line before you start. |
| 9 | Silence after a missed day (row 17) | One calm line, worked out at the day change and stored | Worked out on each render | **A.** Shown once and can't come back; not after a planned rest or a first night. Wording still to test with classmates (A liked the silence). |
| 10 | Small untruths (rows 18, 19, 25, 41; bugs 6, 9, 11) | "Picks up where you left off" only after a start, else "Next part of this topic"; Week's weakest from Pace's accuracy; after Partly the task covers only the rest; "Do more" decided before the tap | Hide the lines that can be wrong | **A.** Each line is now true by construction, rather than removed. |
| 11 | "Next lecture" never says which (row 14) | "Lecture 7 of 26" | Progress in the detail line: "3 of 8 done" | **B.** Setup asks how many lectures are left, not the uni's numbering, so "Lecture 7" would be invented. Hidden after "Not sure". |
| 12 | Setup (rows 31–36; bug 4) | Prefill "questions done" with the larger value (as before); silently drop the oldest system; transliteration only for search | Replace only an untouched field, capped at the bank, with a note when the import is over it; refuse a third system with a hint; Arabic names plus normalisation; drop "About a minute" | **B.** Nothing is changed silently, and "مؤتة", "موته", "جامعة مؤتة" all find Mutah. |
| 13 | Commitments (rows 27–29; bug 10) | Read ranges with an afternoon rule; on a fully booked evening an engine Anki floor | Same range rule; offer the one next task by name ("Have 25 min? Anki reviews") | **B** for the evening (A would break "never more than your stated time"). Ranges: "4-9" → 16:00–21:00 in both languages; سمنر, سيمينار, شفت, شيفت added; times show left-to-right in Arabic; the weekend line is hidden when a commitment takes the time. |
| 14 | Week card too early; "0 fixed · Screenshot to share" (row 26) | No card before a full week: "Your first weekly report comes in N days" plus a "so far" line | A partial card for the first days | **A.** A partial week compares unequal things. Share only shows with good news; zero rows are hidden. |
| 15 | Full plan at 21:30 on the first night (row 40) | After 21:00 (config), the light-day cut: one short task and "The full plan starts tomorrow." | Copy only, same list | **A.** The list is the problem, not the wording. An untouched first night isn't a missed day. |

### Rows not changed, and why

| # | Why |
|---|---|
| 10 | "If I skip tomorrow" off by two days, seen once (C's matched). Needs a reproduction in the engine before changing anything. |
| 11 | Ready date sliding while "on track": readiness now speaks in time (fix 4), which removes the worst case; whether the label should change with a sliding date is a wording call for the interviews. |
| 15, 47 | Past papers question, rescue screen, "What's next?": **Known**, Phase 1 screens. |
| 20 | Tomorrow differs from the preview: expected, because the day re-plans from what was done. Could be a one-line "Changed since last night" later. |
| 30, 39 | Typing 19 systems; sources list: the paste box already covers 30; more sources wait for the interviews. |
| 33, 37 | Lecture stepper start and the 2 h / 4 h default: ask classmates what a typical day is before changing the defaults. |
| 42–46 | Low; 44 (plan a little under the stated time) is the 5-minute rounding and is intended; 46 is unconfirmed. |

### Tests

`src/engine/__tests__/fixes.test.ts` (score entry, studied minutes, wording, readiness in time, the uni lead rule, the first night), plus new cases in `setup.test.ts` (Arabic university names), `commitmentParse.test.ts` (ranges, Arabic spellings) and `core.test.ts` (the full-week rule). `npx tsc --noEmit` is clean; `npx vitest run`: 267 passed, 1 skipped, the 27-student simulator included.
