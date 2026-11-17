# Global student stress test (Nov 2026)

Six simulated senior students, at six real medical schools, used the prototype from setup through 13 days (Mon 16 – Sun 29 Nov 2026). The aim was to find mistakes that come from the app starting as one student's case (Mutah, Jordan, USMLE Step 1), not to find the ideal user.

**Bottom line:** none of the six would still use it on day 30 or recommend it to their batch. Most of them praised the same things: the calm tone ("Nothing is lost"), the quick logging (one tap for Anki, two numbers for questions) and the clean first screen. Michigan singled out the fix → retest loop as genuinely good. Every student quit over the same root cause. The app assumes a Mutah-style year: rotations that each end in a uni exam with lecture slides, evening study, a US board exam with UWorld, English (or Arabic in the parser only), and an exam date that never moves.

Labels: **Confirmed** = I reproduced it in code or with a probe, with file:line. **Seen** = the student shows it in screenshots; I did not reproduce it. **Felt** = the student's judgement.

---

## 1. Method

- **Students.** Each persona was written from public information about a real school and its exam path, checked on the web before the run. I corrected three after the check (US, IN, MX); the corrections are in `sim-students/global/personas.md`, which is gitignored with the rest of `sim-students/`.

| Code | School | Stage and goal (as checked) |
|---|---|---|
| SA | King Saud University, Riyadh | 6th year; internship next; SMLE in the internship; Sun–Thu hospital; Arabic UI |
| IN | Kasturba Medical College, Manipal | Final-year MBBS; one annual university exam (4 papers, Apr–May); NEET-PG after (NExT is deferred to about 2028–29); Marrow, no Anki |
| EG | Kasr Al Ainy (Cairo University) | 6th year; finals May–June; Egyptian licensing exam (pass/fail); undecided between Germany and PLAB; budget Android in Arabic |
| DE | Charité Berlin | PJ (final practical year), Innere tertial; M3 oral exam about May 2027; AMBOSS + Anki on desktop; wants German |
| US | University of Michigan | Clinical year (M2, Clinical Trunk); 12-week IM block, NBME shelf 18 Dec; Step 1 pass/fail about Apr–May 2027 |
| MX | UNAM, Mexico City | Internado de pregrado; 36-h guardias every 3rd day; ENARM late Sept 2027; Spanish |

- **How they used it.**
  - A real browser on a phone-size screen (iPhone 13), with the persona's own time zone and locale.
  - A persistent profile per student, so data carried across days. The clock was set to the persona's local time on each visit.
  - Each student had to reload mid-task, come back after missed days, try to change the exam date or goal, and look for their language.
  - Life events were scripted per persona: a wedding, an exam moved earlier, a power cut, a grand test, Thanksgiving travel, guardias.
  - Students had no access to the code or docs.
- **Code scan.** A separate pass listed Jordan-, Mutah- and USMLE-specific spots in the code. The main claims below were re-checked by hand.
- **Limits.**
  - The students are simulated. Their judgement is a stand-in for real students, not a replacement.
  - Most of them compressed the 13 days into about 10 visits, and some days got little detail.
  - Personal weekly details (shifts, classes) are invented to be plausible. Where public information was thin, the persona was written as unsure.

---

## 2. The most common complaints

| # | Complaint | Students | Status |
|---|---|---|---|
| 1 | Answering "No" to "Exam at the end of the rotation?" still gives an exam and a date, and the whole plan is built on it | MX, EG, DE; US got lectures it doesn't have; IN: "rotation" doesn't fit a year-end exam | Confirmed |
| 2 | Exam date, goals and rotation can't be changed after setup | SA, MX, EG, DE, US | Confirmed: no edit screen exists |
| 3 | No exam or resource of their own: SMLE, NEET-PG, Egyptian licensing exam, M3, ENARM; Marrow, Plabable, AMBOSS Kreuzen, CTO, department books | All six (US: no NBME shelf or Online MedEd) | Confirmed (lists in code) |
| 4 | English only, though Arabic, German and Spanish speakers looked for their language | SA, EG, DE, MX | Confirmed: no i18n layer |
| 5 | Their real week can't be described: nothing repeats, early-morning study doesn't exist, the day after a 36-h shift gets a full plan, an evening class wipes out the evening | MX, EG, IN, DE, US | Confirmed (parser and study window) |
| 6 | The numbers can't be trusted: "ahead of schedule" when behind, weekly questions wrong or 0, a plan above the stated time, half the time unused | IN, EG, SA, DE, MX, US | Partly confirmed (see 3.6) |
| 7 | Fixes and retests pile up after small blocks; the same 65% gives two different verdicts | SA, IN, US ("70% passes", then "Too close to call" at 70%) | Partly confirmed (see 3.6) |

---

## 3. Mistakes that come from the app's origin

### 3.1 "Every rotation ends in an exam, with lectures" (Mutah assumption)

- **"No" doesn't mean "no exam". Confirmed.**
  - Onboarding asks "IM exam at the end of the rotation?" (`src/screens/Onboarding.tsx:136-137`).
  - "No" only opens "When is it?". With no date or "Don't know yet", the exam falls back to the rotation's end, marked as assumed (`src/data/setup.ts:207-210`). There is no answer that means "this rotation has no exam".
  - Seen by: Berlin (PJ has no exams, but "IM exam in 27 days" sat on every screen), Mexico City (Peds, no exam: "Peds exam in 45 days", "Past papers 0 of 3" and a daily "Is your Peds exam date out yet?"), Cairo ("IM exam in 41 days", with real finals in May–June).
- **Lectures are invented.** "Not sure" on lectures falls back to the template default, so the plan shows "Peds slides: next 2 lectures" and "15 lectures left" to students who have no slide decks (MX, DE).
- **Defaults point the same way:**
  - `examAtEnd: true` in `src/data/universities/default.ts:17` and `mutah.ts:19`.
  - New subjects default to it too (`src/data/setup.ts:142`).
- **One annual exam doesn't fit.** Manipal has one university exam with four papers. The rotation picker allows at most three subjects ("Up to 3 subjects in one rotation"), so OBG was silently dropped.

### 3.2 "The board exam is USMLE, studied with UWorld and Anki"

- **Goals.** The list is University / Step 1 / Step 2 CK / PLAB / SMLE / Jordanian board. It has no NEET-PG, Egyptian licensing exam, M3 or ENARM. PLAB shows "everything covered" with no question tracking (EG).
- **Resources.** UWorld, B&B, First Aid, Pathoma, AMBOSS, Anki and slides only.
  - Students had to pick stand-ins: UWorld for Marrow (IN), Anki for a student who doesn't use it (EG).
  - The default QBank name is 'UWorld' (`src/engine/topics.ts:258`, `src/engine/planSteps.ts:288`).
  - Fix copy names B&B, First Aid, Pathoma and AMBOSS (`src/engine/fixes.ts:106-109`).
- **Recall Sweep** labels are hardcoded `Step 1 · ${system}` (`src/engine/sweep.ts:74`), and Today shows a `Step 1` tag (`src/screens/Today.tsx:620`).
- **Only Anki has a quick count.** AMBOSS Kreuzen can't be logged, so Berlin's week said "7 h 10 min studied · 0 questions".
- **Anki numbers appear from nowhere.** "Not sure" on Anki still showed "2,970 new cards left" (MX, EG). It's a default the student never typed.
- **The questions stepper stops at 120. Confirmed** (`src/screens/BlockFinished.tsx:118`). Its default is the task's planned amount (line 48). Manipal's 200-question grand test couldn't be entered; it was logged as smaller blocks, and the weekly card showed "80 questions · 29% correct". The weekly sum itself is correct (`src/engine/weekly.ts:36-38`); the input was clipped or left at the default. NBME, Marrow and AMBOSS self-tests are often 200+.

### 3.3 "Study happens in the evening, after the hospital" (Jordan routine)

- **The study window is 16:00 to 4 AM. Confirmed** (`STUDY_WINDOW`, `DAY_ENDS_HOUR` in `src/engine/config.ts`). Busy time inside the window counts in full against study time.
  - Cairo: a German class 18:00–20:30 left "no study time left today" on a 2-hour day, though she studies after class. The rule assumes busy evening time replaces study. For a student with a class in the evening, it only moves study later.
  - Manipal: the 5–7 AM slot has no place.
- **Shifts.** The day after a 36-h guardia gets a full plan (MX). The light-day logic waits for skipped tasks and doesn't know a shift just ended.
- **Day count.** Plans use about 1 h 30 min of a 3–4 h day (DE weekdays, MX weekend, under "Weekend: a longer day."). Seen; the likely cause is that the plan is sized to the invented uni exam's small need. It's not a separate bug.

### 3.4 Language and text parsing

- **English only. Confirmed.** There is no i18n layer; RTL is dev-only, and number formats use en-US. Students asked for Arabic (SA, EG), German (DE) and Spanish (MX).
- **The "+" parser reads English and Arabic only. Confirmed with a probe on the students' own lines:**
  - "Guardia jueves 19 36h" gives no day and no kind.
  - "Fallvorstellung Innere Donnerstag 2h" gives no day.
  - "Postings Mon-Sat 8-2" becomes a one-off on Monday titled "Postings -Sat". Day ranges aren't understood, and nothing repeats.
  - "Paeds internal assessment Tuesday 9am 2h" is tagged *Personal* and treated as busy time. An exam is not a busy hour.
  - English "Tuesday 9am" parses correctly, so I couldn't reproduce the Manipal "Tuesday not parsed" complaint.
  - "Call Tuesday 24 Nov" typed on Tue 17 Nov is saved for **today**: the weekday wins and "24 Nov" is dropped from the title. Michigan got "0 min planned" that day.
  - Arabic "محاضرة الأحد 10-12" parsed correctly for Riyadh.
- **Repeating items.** German class Sun/Tue/Thu, guardias every 3rd day and daily postings all had to be entered one by one (MX, EG, IN).
- **A length without a clock time counts in full.** "Family dinner Thursday 4h" or "Travel Wednesday 8h" removes the whole 2 h 30 min day (`busyReduction`, `src/engine/commitments.ts:56-59`). The 25% daytime discount only works when a time is given. Seen by Michigan (US).
- **Tags** are Uni / USMLE / Personal. The middle one is the only exam named, whatever the student's board.

### 3.5 University search and weekends

- **Short names aren't found. Confirmed** in `universities.json`:
  - "UNAM" gives no match; only "Universidad Nacional Autónoma de México" is listed.
  - "Kasr Al Ainy" isn't listed; only "Cairo University".
  - "Kasturba" isn't listed; only "Manipal University".
  - The placeholder says "Search, e.g. Mutah" (`Onboarding.tsx:681`), and search prefers Jordan (`list.ts:55`).
- **Weekends.** With no university picked, the weekend defaults to Jordan's Fri–Sat (`DEFAULT_WEEKEND_COUNTRY='JO'`, `templates.ts:137`).
  - Cairo has a Friday-only weekend. Mexico City and Manipal work some Saturdays.
  - The single country weekend can't express a 6-day week.

### 3.6 Not from the origin, but found here (affects everyone)

- **The plan goes over the stated daily time. Confirmed cause.**
  - Riyadh, Fri 27: "7 h 05 min planned" on a 4-h day after adding a 3-h seminar.
  - The engine alone stays within the limit; I probed `buildDay` with a 180-min deadline due in 1, 2 and 3 days, and every day totalled exactly the stated 180 min.
  - The overshoot is in the store. When a commitment is added or edited, `withCommitments` keeps today's started or done tasks and adds a fresh `buildDay` built on the full day (`src/store/demoStore.ts:226-234`). Time already spent is counted twice.
  - On a light day it adds deadline chunks on top of the light plan without trimming (line 231).
  - This breaks the spec invariant "the plan never exceeds the stated daily time", and the simulator can't catch it because it drives the engine, not the store.
- **"You're ahead of schedule" after missed days. Confirmed meaning mismatch.**
  - `aheadOfSchedule` (`src/engine/lightday.ts:69-76`) is true when a day off still leaves every dated exam ready in time.
  - With a far exam, or an invented one with few lectures, that holds even after skipping days. "Ahead" then reads as false (IN, EG). Saying "Taking today off still keeps you on track" says what the code computes.
- **"Nothing to fix" after marking weak systems** (IN). Seen, not reproduced.
- **Small blocks make big loops.** A 10-question block at 55% creates a fix and a retest. Three such blocks gave five open fixes by Wednesday (SA). Seen. A minimum question count before a topic is called weak would stop it.
- **Same score, two verdicts. Confirmed for the copy.**
  - The retest line says "70% or more passes" (`src/screens/BlockFinished.tsx:235`, `RETEST_PASS = 70`).
  - A score one question from the line is "Too close to call" (`RETEST_BORDERLINE_QUESTIONS = 1`, line 274). So 70% on 10 questions isn't a pass (US).
  - Riyadh's 65% "too close" followed by "needs another pass" is the follow-up questions settling it; the wording doesn't explain that.
- **Start runs the first task**, not the one the student tapped (IN). Seen.

---

## 4. Each student

**SA: Reem, King Saud University, Riyadh.** All 14 days.
- **Liked:** fast logging, and the wedding and sick days were handled well ("0 min planned… Your commitments take today's study time").
- **Problems:** when the department moved her final two weeks earlier, there was nowhere to change it, and the plan was wrong for a week. Content is UWorld/Step 1 only: no SMLE QBank, no OSCE, no Arabic UI on an ar-SA browser.
- **Felt:** "That day I understood it is a planner that is blind to my university's reality."
- **Verdict:** not usable until the exam date can be edited and the material is local.

**IN: Arjun, Kasturba Medical College, Manipal.** About 10 visits; days 8, 9 and 12 skipped.
- **Problems:** setup "felt like it was built for someone else: every second screen made me pick a stand-in". UWorld stood in for Marrow, 3 subjects for 4, and a "rotation" for a year-end exam. He was annoyed by "ahead of schedule" when he was behind, and by a grand test the app counted as non-study busy time.
- **Felt:** he liked the calm tone and the fix-and-retest idea, but never saw a retest.
- **Verdict:** would drop it by week 2. He would pay only for Marrow and NEET-PG support, his real week, and Indian pricing.

**EG: Mariam, Kasr Al Ainy, Cairo.** Thu 26 – Sat 28 mostly skipped.
- **Problems:** "within a minute I was picking Anki for a thing I don't use." The invented "IM exam in 41 days" made her distrust it, and the German class eating her whole evening "was the worst". She could not type or read the app in Arabic.
- **Verdict:** would go back to her sheet and Plabable. She would pay for an Arabic UI, her own resources and her real week.

**DE: Jonas, Charité Berlin (PJ).**
- **Liked:** "the Anki 'about how many' tap is exactly the right amount of effort"; the tone.
- **Problems:** planned through lectures he doesn't have, for an exam that doesn't exist. AMBOSS Kreuzen is invisible.
- **Verdict:** would not open it on day 30. He might recommend it to 3rd–4th years with real block exams. He would pay only for M3 and AMBOSS support in German.

**US: Taylor, University of Michigan.** Setup was redone after the persona correction (M2 clerkship, Step 1 in Apr–May 2027); not every day has a full evening session.
- **Liked:** the fix → retest loop is "genuinely good" (40% on acid–base became a fix plus a retest).
- **Problems:**
  - Nothing can be edited after setup: Step 1 date, adding Surgery after 18 Dec, daily hours, language.
  - A clerkship student got "15 lectures left" for IM slides that don't exist, and Step 1 systems for an IM shelf. There's no NBME shelf or Online MedEd.
  - The app projected its own Step 1 date (3 Mar) that doesn't match the real plan.
  - Untimed commitments (family dinner, Thanksgiving travel) wiped whole days.
  - The plan grew to 3 h 10 min on a stated 2 h 30 min.
  - "First in line tomorrow" is shown even when tomorrow has 0 min.
- **Verdict:** wouldn't use it on day 30 unless dates and content can be edited.

**MX: Valeria, UNAM, Mexico City.** About 10 visits.
- **Problems:**
  - English only, and no ENARM, CTO or GPC options.
  - Peds had no exam, yet it planned one.
  - Guardias had to be entered one by one.
  - The day after a guardia got a full plan.
  - Nothing could be changed after setup.
- **Liked:** guardia days themselves ("0 min… Have 30 min? Anki reviews").
- **Verdict:** wouldn't use or recommend it. She would pay for Spanish, an ENARM countdown and awareness of guardias.

---

## 5. What this means for the brief

These are observations for Omar to decide on, not changes made.

1. **The rotation-exam model is the biggest origin bias.** Mutah's "every block ends in an exam, with slides" is not how Charité PJ, the Indian annual exam, the Mexican internado or Cairo finals work. A single "No exam for this rotation" answer would remove the most-cited complaint from three of the six students, and the invented lectures from a fourth.
2. **An edit screen for the exam date and goals** came up in five of six runs, independent of country. Exam dates moving is universal; the brief already lists the rescue screen as not built.
3. **The board-exam and resource lists are the second bias.** For rollout steps 1–2 (Mutah, then Jordan) they're fine. Step 3 (Arab students for USMLE/PLAB/SMLE) already needs an SMLE QBank and Arabic UI. Anything beyond the Arab world needs a free-text exam and resource with sensible defaults, which the "material" model in section 4 of the brief already allows in principle.
4. **The 16:00–04:00 window is a Jordan routine, not a learning-science rule.** Early-morning studiers and evening classes break it. Asking "When do you usually study? Mornings / Evenings / Late night" would replace a hardcoded assumption with one tap.
5. **Four bugs hurt everyone, including Mutah:**
   - the plan going above the stated time after adding a commitment;
   - "ahead of schedule" wording after missed days;
   - "Tuesday 24 Nov" saved for today;
   - "70% passes" contradicted at 70%. All are small to fix and all cost trust.
