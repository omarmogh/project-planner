# Student simulation, batch 2: 8 new students worldwide + old batch re-rating

Run: 18 Nov 2026, against the current `claude/epic-gates-j4pjav` build (after the batch-1 fixes).
App time: Mon 23 Nov – Sun 6 Dec 2026 for new students; Mon 23 – Thu 26 Nov for the re-rates.
No app code was changed for this report. Raw notes, personas and screenshots are in `sim-students/batch2/` (gitignored, local only).

Labels used below:
- **Confirmed**: seen on a screenshot and/or checked in the code.
- **Seen**: reported by a student with a screenshot, not re-checked by me.
- **Felt**: an opinion or a guess by the student.

---

## 1. Method

**Random draw, no bias.** I drew 8 schools from a pool of 44 medical schools on every continent, with every school from batch 1 left out. Stage (basic / clinical / graduate) and level (strong / average / struggling) were drawn separately.

| Code | Student | School | Stage | Level |
|---|---|---|---|---|
| CZ | Tereza, 5th yr (Czech programme) | Charles University, 1st Faculty, Prague | Clinical | Average |
| ND | Aditya, MBBS Phase I | AIIMS New Delhi | Basic | Struggling |
| CO | Valentina, 4th semester | Universidad Nacional de Colombia, Bogotá | Basic | Average |
| PL | Ingrid, 5th yr (English MD, Norwegian) | Jagiellonian University, Kraków | Clinical | Strong |
| CN | Lin, PGY1 resident (8-yr MD) | Peking Union Medical College | Graduate | Struggling |
| PH | Bea, LU VI clerk | UP College of Medicine, Manila | Clinical | Strong |
| KR | Seo-yeon, 본과 3 | Seoul National University | Clinical | Average |
| TR | Elif, Dönem 2 | Hacettepe University, Ankara | Basic | Average |

**How each student worked:**
1. Researched their real school: curriculum, exam format, rotation or block length, holidays, common resources, and lifestyle (commute, hostel, duty cycles, side jobs).
2. Wrote a persona with a **BEFORE** baseline: hours a week, questions and cards, stress and confidence (1–10), and how they plan now.
3. Used the app for two weeks of app time on an iPhone-size browser with their own locale and timezone. They studied, missed days, got sick, added their real commitments and changed the plan.
4. Answered the same five questions as batch 1, plus AFTER vs BEFORE, day-30 use, recommend 0–10, pay, and top 3 complaints.

**Old batch re-rating.** All 9 earlier students re-ran the new build for 4 days of app time: the 3 Mutah students (A, B, C) and the 6 global ones (SA, IN, EG, DE, US, MX). Each could read only their own old notes. They marked every old complaint Fixed / Better / Same / Worse, scored each 1–5, listed new problems and gave old → new verdicts.

**Limits.**
- These are simulated students. Their school research is real, but several school sites (Hacettepe, PUMCH, parts of UP's VLE) could not be fetched. Those facts came from search snippets and are marked "guessed" in the personas.
- Two weeks of app time can't show long-term retention. Read the before/after numbers as "first impression of the habit", not as outcomes.
- I kept the user's earlier rule: language support is planned for later, so "no local language" is reported as students felt it, not as a bug.

---

## 2. The headline

| | Batch 1 global (6) | Batch 2 new (8) |
|---|---|---|
| Recommend, mean (0–10) | ≈ 4 | **4.3** (3, 3, 4, 4, 5, 5, 5, 5) |
| Day-30 "yes" | 0 | **0** |
| Day-30 "maybe" | — | 3 (CO, PH, TR) |
| Day-30 "maybe, leaning no" | — | 3 (CZ, PL, KR) |
| Day-30 "no" | — | 2 (ND, CN) |
| Would pay now | 0 | **0** (all 8 name a price *if* their exam system fits) |

The old students who re-rated are clearly happier (section 6). Of their 114 old complaints, 38 are Fixed and 27 Better. Their mean recommend score rose from ≈ 4.2 to 5.4, all three Mutah students went 7 → 8 and say yes for day 30, and IN and EG moved from "no" to "maybe".
The new students, all outside USMLE-at-Mutah, hit a **different wall: the app's model of a student**.
- One exam per plan.
- One rotation; a new one means "set up again" and the history is wiped.
- Question banks are the only scored resource, so past papers, orals, practicals and 족보 can't be scored.
- Study happens right after 16:00.
- "Not sure" means UWorld.

Every new student said almost the same sentence in their own way: *"the calm daily plan is good, but it doesn't know what my exams are."*

---

## 3. What frustrated the new students, ranked by how many hit it

| # | Problem | Who (of 8) | Label | Severity they gave |
|---|---|---|---|---|
| 1 | **Adding an exam or the next rotation = "Set up again… What you've logged so far is cleared."** After the exam passes the app goes empty: "No exams ahead", "You're on track", "The plan picks up tomorrow" above "0 min · 0 tasks". | 8/8 (ND, CN, KR did the wipe) | Confirmed (`PlanSettings.tsx` "Add or remove an exam…" → reset) | Would-quit ×3 |
| 2 | **USMLE-shaped everywhere.** Goals are University / Step 1 / Step 2 CK, so there is no KMLE, PLE, TUS, Chinese licensing exam or Polish LEK. The resource list is US. The weak-topic chips are Step 1 systems (no Anatomy/Physio/Histo). Pace says "Bring in your UWorld results", and a 족보 fix was labelled "From your UWorld results". | 8/8 | Confirmed | Annoying → would-quit |
| 3 | **Past papers / past questions take no score.** "Paper done… Keep a note of what you missed." So the fix → retest loop never fires for uni-only students, and the weekly card shows "0 questions". "Past papers 0 of 3" appears without ever being asked. | 6/8 (CO, PL, KR, TR, CZ, ND) | Confirmed | Annoying |
| 4 | **The plan under-fills the stated time.** For example "1 h 05 min planned" of 4 h, or "1 h 30" of 4 h next to "Weekend: a longer day." | 5/8 (CZ, PL, CO, ND, TR) | Confirmed in code: leftover time only grows question blocks (`planSteps.ts` growStep), so a plan with no question bank stays short | Annoying |
| 5 | **An evening commitment wipes the day.** "CPX 18:30–20:30 → no study time left today" (KR), meeting 18–20 → "Takes all of Tomorrow's study time" (TR). These students study 21:00–23:30. Family evenings (CO) and a 17–22 Saturday (CZ) did the same. | 5/8 | Confirmed, works as designed: time from 16:00 counts in full (`config.ts`). The assumption is wrong for students who study late | Annoying |
| 6 | **"Not sure" question count silently becomes 3,600 (UWorld's size)** for any bank. This produced "about 169 h more work than time" and "Needed… 183 h 16 min a day" (ND), and "129 h more work" (KR). The 3,600 stays on screen after tapping Not sure. | 4/8 (ND, KR, PH, TR), seen by CN as a 138 h warning | **Confirmed in code**: Not sure sets `qbankTotal` to null, and `bankSize()` falls back to `UWORLD_TOTAL_DEFAULT = 3600` (`setup.ts:186`, `templates.ts:113`) | Would-quit ×2 ("I felt sick reading 183 h a day") |
| 7 | **No local language, and the "+" box ignores local day words.** "viernes / lunes" (CO), "středa" (CZ), "Çarşamba / 9 Aralık" (TR), "내일" (KR), "周四" (CN); "bukra" from re-A too. Times shown 12-hour with no am/pm ("10–5") on 24-hour locales. | 7/8 | Confirmed. Language is deferred by your decision; the day words are a smaller, separate fix | Annoying |
| 8 | **University search misses local names.** "Univerzita Karlova", "서울대", "协和" give no match, and only one AIIMS campus is listed. **The typed-university form has no Continue button**, a dead end CN only escaped by picking a wrong school. | 4/8 | **Confirmed** (CN screenshot `d0h-01-typed.png`: name + country filled, no button) | Would-quit (CN) |
| 9 | **Retests after the exam.** "Retest Saturday" = the day after the exam (KR); "Retest Wednesday" = exam day (PH). | 2/8 | Seen | Annoying |
| 10 | **Retest top-ups are pooled without saying so.** 4/5 on the extra questions was reported as "67%… a different fix" because it was combined with the previous 6/10. | 2/8 (TR, PH) | Seen | Annoying |
| 11 | **"Light day" changes nothing when the plan is already small.** "Essentials (about 105 min)" was the whole plan (ND); TR saw the same. **"Do more" triggered the "Rough day?" offer** (KR). | 3/8 | Seen | Minor → annoying |
| 12 | **Deadline work crammed into one night.** "Review epilepsy by Friday 2h" at 21:48 → "All of it today, ready a day early", which replaced Anki (CZ). A 2 h deadline put on one evening (ND). | 2/8 | Seen | Annoying |
| 13 | **No way to describe the exam they actually have.** A ~70-question oral list (CZ), a kurul with practical + theory (TR), monthly 出科 rotations (CN), PGH duty cycles (PH). | 4/8 | Felt / design gap | Would-quit (CZ) |

Smaller things, one student each (all Seen):
- "Anki 0 new cards left" after Not sure (CZ, PH).
- "Partly" ignores 90 timed minutes (PH).
- Today's duty titled "Duty tomorrow" (PH).
- "ADDED TO TOMORROW" for a 0-minute duty day (PH).
- "9 of 13.5 done" half lectures (CO, TR).
- "Resp, still your weakest" right after "Resp: Passed" (TR).
- Stale "Good luck tomorrow" after the exam (ND).
- "After hospital and lectures" shown to basic-science students (CO).
- Exam date didn't save on the first try (PH).
- Blank page offline (PH, TR; maybe the dev server).
- Holidays not known: Christmas, Colombian festivo, Diwali (CO, PL, ND).
- No "I'm sick" (CO, SA).

---

## 4. What they liked most, and what they like but want better

**Liked most, often said unprompted:**
1. **"No decisions, just press Start"** and **"Nothing is lost"** after a missed day (CO, TR, CZ, PH, KR). This is the strongest signal in both batches.
2. **The "+" box for commitments in English.** "24h duty Fri 7am to Sat 7am" and "Case presentation Thu Dec 3 prep 4h" were parsed exactly (PH). The shift day showed "no study time left today… Have 15 min? Anki reviews" with no guilt (CZ, PH).
3. **Exam-eve and rest copy.** "Rest matters more than one more page tonight. Good luck tomorrow." (PL, KR, CN)
4. **The fix → retest loop**, for the students who got a question block (ND, KR, TR, PH): *"I actually did the wrong-question review, which I never do."* (TR)
5. **"Rough day? Do just the essentials"** and **"Too close to call… 5 more"** (CN).
6. **Fast re-planning** after a date change or a busy line (PL); the timer surviving reloads (PL, TR).

**Liked, but want it better:**
- Fix → retest: *"tell me how it's counting ('6/10 + 4/5 = 10/15')"* (TR). Let a seminar grilling or an oral question create a weak topic, not only a question block (CZ).
- Commitments: understand local day words, and that *"after a meeting I still study at night"* (TR, KR). Spread deadline work instead of one night (CZ).
- Topic links: *"it knew epilepsy = seizures, cool"* (CZ), but topics should be their subjects (Anatomy, Physio, Peds), not Step 1 systems.
- "Do more" should offer past questions, not only more slides (TR).

---

## 5. Before → after (productivity)

Two weeks of app time; self-reported by the simulated students.

| Student | Study time | Questions / cards | Stress (1–10) | Confidence (1–10) | Notes |
|---|---|---|---|---|---|
| CZ | ≈ same | — | 6 → 7 | 4 → 6 → 3 | Felt "on track" until 9 days out, then found ~45 oral questions untouched |
| ND | ≈ same | — | up (the hours warnings) | — | Empty plan after the first sessional |
| CO | slightly up | Anki 100 → 300 a week | 7 → 6 | 4 → 6 | Slides finished 5 days early |
| PL | same | AMBOSS ~250 a week, outside the app | 5 → 5 | 7 → 6 | Sunday planning 40 → 10 min |
| CN | down (post-call) | couldn't log her own block | — | — | Gave up at the rotation change |
| PH | ≈ 7 h a week, same | Anki 250 → 450 a week | 6 → 6 | 6 → 6 | Still crammed before the exam |
| KR | same | — | 7 (peak 8) | 4 → 5 | |
| TR | up | questions up (95 logged) | 6 → 5 | 4 → 6 | The "press Start" evening habit stuck |

**Reading:**
- Real gains came where the student had **one exam that fits the model** (CO, TR): stress down, confidence up, more Anki.
- Where the exam didn't fit (CZ oral, ND sessionals, CN licensing), confidence went *down*. The app said "on track" while the real exam work was invisible to it.
- That false "on track" is worse than no app.
- Planning time dropped for everyone who stayed (PL: 40 → 10 min on Sundays).

---

## 6. Old batch re-rating: did the batch-1 fixes land?

| Student | Fixed | Better | Same | Worse | Day-30 old → new | Recommend old → new |
|---|---|---|---|---|---|---|
| A (Mutah, IM) | 7 | 1 | 6 | 0 | maybe → **yes** | 7 → **8** |
| B (Mutah, Surgery + Step 1) | 4 | 6 | 4 | 0 | yes → **yes** | 7 → **8** |
| C (Mutah, Peds) | 5 | 4 | 4 | 0 | yes (for retests) → **yes** | 7 → **8** |
| SA (King Saud) | 2 | 1 | 7 | 2 | maybe → maybe | ~4 → **5** |
| IN (India, NEET-PG) | 7 | 3 | 3 | 0 | no → **maybe** | ~2 → **5** |
| EG (Egypt) | 5 | 3 | 4 | 1 | no → **maybe** | ~2 → **4** |
| DE (Germany) | 1 | 3 | 6 | 2 | no → **no** | ~2 → **2** |
| US (US, shelf + Step 1) | 5 | 2 | 3 | 0 | maybe → **maybe, leaning yes** | ~5 → **6** |
| MX (Mexico, ENARM) | 2 | 4 | 7 | 0 | no → **no** | ~1–2 → **3** |
| **All 9** | **38** | **27** | **44** | **5** | 3 yes, 4 maybe, 2 no | mean ≈ 4.2 → **5.4** |

Old batch-1 "before" recommend scores were not always numeric. Where they weren't, the student mapped their old verdict to a number.

**Fixed and felt:**
- IM comes first before the IM exam: "it comes first until then" (A).
- The timer and the report survive reloads (A, B).
- No invented Step 1 date (A) and no invented Anki deck (B).
- Missed day: "Nothing is lost" (A, B).
- The retest pass line is now visible: "70% or more passes" (B).
- "Done already" for Anki (B).
- The Tomorrow preview holds overnight (B).
- Arabic shift and repeat parsing: "مناوبة جراحة كل أربعاء 4-9" (a surgery shift every Wednesday, 4 to 9) (B). Arabic university search, "سمنر بكرا 3 ساعات" (seminar tomorrow, 3 hours) and Arabic digits ٧٠ also work (C).
- The exam date can be edited (A, B, SA).
- The plan stays inside the stated hours (SA, US, MX: "3 h 50 min planned" on a 4 h weekend).
- Repeating postings, "Tuesday" parsed right, any task can be started, correct weekly stats (IN).
- An evening class no longer wipes the day: "30 min of study time instead of 3 h" (EG). An untimed 4 h family item now takes 2 h, not the whole day (US).
- "UNAM" is found (MX); "No exam" is honest (EG, DE); 900 questions done is kept (US).

**Still the same (old complaints):**
- "Surgery slides: next lecture": the app never knows which lecture (A, B).
- The lecture stepper still steps +1 from 15 (A).
- "Cardio: 0 of 15 topics watched" (A, B).
- The "Correct __ %" box (B).
- Step 1 systems chips (SA).
- English only (SA).
- No sick day (SA).
- **"Don't know yet" still invents an exam date** ("IM exam in about 42 days (end of rotation)", "Peds exam … Thursday 31 Dec"), and Pace then judges against it: "about 123 h more work than time" from day 1 (EG, MX).
- No local exam: NEET-PG (IN), M3 (DE), ENARM (MX), plus EMLE and PLAB (EG). German, Spanish and Egyptian-Arabic day words are not parsed.
- A US shelf exam is still planned as "IM slides" plus Step 1 renal physiology, and adding Surgery means a reset (US).
- Under-fill (DE: 1 h 45 of 3 h, no "Do more"), no early-morning study window (IN), "How did it go?" offers only Continue (IN), a Sun/Tue/Thu repeat saved as Sunday only (EG), and a blank page offline (EG).
- Connect Anki offered on a phone (B, SA).
- Past papers can't be used (SA).
- The app reopens on the last tab (A).

**Worse:**
- **SMLE and PLAB disappeared from the goals** (SA, EG). This follows from the USMLE + uni decision, but both students noticed. DE's two "worse" are the same: "No exam" now blocks setting up, and the goals can't be edited.
- **A repeating hospital shift "Sun–Thu 7:30–15:00" dropped her evening plan from 2 h 30 to 35 min.** Setup had already told her to give hours "After hospital and lectures", so the hospital counted twice. Confirmed on her screenshots. This is the same root as the new batch's #5.

**New problems from re-raters:**
- Editing the exam date silently shrank today from 2 h 30 to 1 h 40 with no line explaining it (B).
- The Week "So far" total leaves out today without saying so (A, B, C).
- A seminar took all of Thursday's Peds study 11 days before the exam (C).
- "If I skip tomorrow → ready around 4 Jan" doesn't say that 4 Jan is the exam day (C).
- Micro starts at "Bacterial basics" after 120 Micro questions done, and there is no Sketchy or "other" source (C).
- "bukra" (Arabizi for "tomorrow") is not understood (A).
- "Your commitments take today's study time" shown on a full day (SA).
- "Due tomorrow" vs "Due Saturday" relative to the wrong day (SA).

---

## 7. Do they complain about the same things as batch 1?

| Batch-1 complaint | Batch 2 |
|---|---|
| Rotation forced an exam / "No exam" | **Gone.** Nobody hit it |
| No way to edit the plan | **Mostly gone** (date, time, rotation end). **Adding an exam is still a reset**, now the #1 complaint |
| Plan above the stated time | **Gone** (SA confirms) → replaced by the opposite, **under-fill** |
| Own exam / own resources | **Same, louder.** Every new student; CZ, ND, CN, KR would quit over it |
| No local language | **Same** (deferred by decision) |
| Untimed / repeating commitments | **Better** in English and Arabic; other languages' day words are not parsed |
| Retest verdict contradictions | **Better** (pass line shown) but **pooling is still unexplained** (TR, PH) |
| "Ahead of schedule" / false comfort | **Same in a new form:** "You're on track" with no exam, or with invisible exam work |
| Hospital hours | **Worse**: a typed hospital shift is double-counted (SA) |

---

## 8. Observations for Omar (no code changed; your call)

In order of how much they'd move the day-30 answer, as I read the notes:

1. **Several exams and the next rotation without a reset.** All 8 new students hit it. It is also why the app goes empty after an exam. It probably needs the "What's next?" question that is already listed as "engine ready, no screen" in the brief.
2. **A scored past-paper / past-question block for uni exams** (questions + % like a QBank block), so the fix → retest loop and the weekly card work for students who never touch UWorld. Six of eight asked for this. It is probably the cheapest way to make the core loop universal.
3. **"Not sure" must never mean 3,600, and "Don't know yet" must never mean a date.** The re-raters show the second one is still there (EG, MX). Use a small neutral default or leave the bank out of the hours sum until it's known, and never show three-digit hour gaps on the first screen. Two would-quits came from one fallback line.
4. **Fill the stated time when there's no question bank**, so leftover time can grow slides / recall / past papers too. Otherwise don't say "a longer day".
5. **Evening commitments versus when the student actually studies.** The 16:00 window is wrong for many people, and a typed hospital shift double-counts hours given "after hospital". One question in onboarding ("When do you usually study? Evening / Late night / Mixed") or learning it from timer start times would fix both. This needs your judgment: it adds a question, and the brief prefers defaults.
6. **Small, cheap fixes:**
   - the Continue button on the typed-university form (would-quit)
   - retests never on or after the exam
   - explain retest pooling ("6/10 + 4/5")
   - "Do more" must not trigger "Rough day?"
   - Light day hidden when essentials = the whole plan
   - no half lectures
   - stale post-exam copy
   - "Anki 0 new cards left" after Not sure
   - "After hospital" shown only to clinical students
7. **Questions only you can answer:**
   - Do you want topic lists other than Step 1 systems (subjects like Anatomy / Physiology / Histology for basic years) in this phase, given your USMLE + university scope?
   - Is "describe your exam" (oral question list, practical + theory) in scope for the MVP, or should those students simply be out of scope for now?
   - The language is deferred, but parsing local **day words** in the "+" box is small. Would you take that now?
