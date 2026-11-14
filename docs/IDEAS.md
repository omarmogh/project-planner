# Locus — new ideas (round 9)

Goal: find features no competitor offers that make a tired 5th-year say "I need this".
Every idea must improve what the student **learns, remembers or scores**, or how well they **decide what to study**. Ideas that mainly measure effort or time were thrown out.

Status: steps 1–4 below. Step 5 (a clickable #1 behind `?idea=1`) is built only after Omar approves the top 3.

---

## 1. Ground it

### What learning science says works

**Well established.** These are replicated findings, many of them in medical learners.

| Finding | What it says | Key sources |
|---|---|---|
| **Retrieval practice (testing effect)** | Pulling information out of memory strengthens it more than re-reading it. This holds even with no feedback, and the effect is larger after a delay. | Roediger & Karpicke 2006; Larsen, Butler & Roediger 2009 (residents, 6-month retention); Dunlosky et al. 2013 rated it "high utility" |
| **Spacing** | Reviews spread out over time beat the same reviews massed together. The best gap grows with how long you need to remember. | Cepeda et al. 2006 (meta-analysis); Cepeda 2008; Kerfoot's spaced-education RCTs in urology residents and med students (2007–2010) |
| **Low value of passive review** | Re-reading, highlighting and summarizing give little lasting benefit, yet they *feel* productive. | Dunlosky et al. 2013 ("low utility") |
| **Fluency illusion / overconfidence** | Material that feels familiar (you just watched the video) is judged as learned. Judgments made right after study are poorly calibrated. | Koriat & Bjork 2005; Kornell & Bjork 2008 |
| **Delayed judgments of learning** | "Do I know this?" is far more accurate when asked later and from a cue alone than when asked right after study. | Nelson & Dunlosky 1991 (delayed-JOL effect) |
| **Interleaving for look-alikes** | Mixing similar categories teaches you to tell them apart better than blocking them. It is strongest when the task is discrimination (which disease is this?). | Kornell & Bjork 2008; Rohrer & Taylor 2007; Hatala et al. 2003 (ECG interpretation in med students) |
| **Hypercorrection** | Errors made with high confidence are corrected *more* easily than low-confidence errors, if the student gets feedback. | Butterfield & Metcalfe 2001; Metcalfe 2017 (review) |
| **Desirable difficulties** | Conditions that slow learning now (spacing, testing, mixing) often improve long-term retention. | Bjork 1994; Bjork & Bjork 2011 |
| **Forgetting curve** | Memory falls off steeply soon after learning, then more slowly. Each successful retrieval flattens the curve. | Ebbinghaus 1885; replicated by Murre & Dros 2015 |
| **Basic-science decay in med school** | Medical students lose a large share of their preclinical basic science within a few years unless it is used. | Custers 2010 (review). *The exact percentages vary by study, so treat any single number as approximate.* |
| **Explanatory feedback** | Feedback that explains *why* beats right/wrong feedback alone. | Butler, Godbole & Marsh 2013 |

**Moderate or uncertain.** Use these, but don't promise outcomes.

- **Pretesting.** Attempting questions *before* learning a topic improves later learning of it, even when you get them wrong (Richland, Kornell & Kao 2009; Pan & Carpenter 2023 review). The evidence is fairly robust in the lab. Evidence in real medical curricula is thinner.
- **Calibration training.** Students can learn to judge their own knowledge better with feedback. *Uncertain:* whether better calibration alone raises exam scores. The plausible mechanism is better choices about what to study, but direct evidence is limited.
- **Generation / illness scripts.** Linking knowledge to a real patient case helps clinical reasoning (Schmidt & Rikers 2007 on illness scripts). *Uncertain:* the size of the benefit for exam scores specifically.
- **Error-type analysis.** It is widely recommended for QBank review (the "why did I miss it" log). It has little controlled evidence behind it.
- **Protégé effect.** Teaching or preparing to teach helps learning (Nestojko et al. 2014). Effects are modest and setup-dependent.

### What our students struggle with

Sources: CLAUDE.md, Omar's own experience, and the Phase 0 interviews still to come.

1. **Several exams at once.** A rotation exam every few weeks, uni finals, and Step 1 in 6 months. Each one pulls toward different material.
2. **Rotations drain time and energy.** Ward hours, call and commuting mean study happens tired and in fragments.
3. **Scattered resources.** UWorld, B&B, First Aid, uni slides, Telegram lecture videos, past papers shared in group chats. No single tool sees all of them.
4. **Uni exams have no QBank.** For local exams there is often nothing to *test yourself with*. Students fall back on re-reading slides and re-watching Telegram videos, which are exactly the low-utility methods.
5. **Passive watching feels like progress.** "I watched all of Cardio" ≠ "I can recall Cardio" (the fluency illusion).
6. **Bad calls about what to study.** Students pick topics by feel, avoid weak ones, and overestimate topics that feel familiar.
7. **Ward learning is disconnected from desk learning.** Students see real heart failure patients in the morning and study a different system at night.

The biggest gap: **retrieval practice is the best-supported technique, and our students have no way to do it for half their material (uni slides, videos).** The second gap is that they misjudge what they know.

---

## 2. Generate: 15 ideas

Novelty checks use what I know (to June 2026) plus three quick web searches done for this doc. Where I say "believed new", I found no product doing it, but I can't prove a negative.

### 1. Recall Sweep
**Pitch:** See only a title, recall what you know, tap one of three buttons. Locus finds what you *think* you know but don't, for any material, including uni slides.

**A real day:** Lina is post-ward at 7 pm, too tired for a QBank block. Today's plan has "Recall sweep · Cardio · 4 min".
1. She presses Start. Card 1 shows "Heart failure: types and treatment" (a B&B title or uni lecture title, nothing else).
2. Prompt: "Think of the 3 things you'd want to remember." She thinks for ~15 s.
3. She taps **Had it**, **Fuzzy** or **Blank**. Next card.
4. After 8 cards: "2 blank, 1 fuzzy. Added: 10 questions on those this week. Had-it topics get a spot-check later."
5. The spot-check: if a "Had it" topic later scores <60% in a block, Locus tells her once, kindly: "You felt sure about Valvular disease, but it scored 45%. Worth a second look."

**Principle:** Retrieval practice. Delayed, cue-only judgments of learning (the most accurate kind of self-judgment). Spacing, because sweeps revisit covered topics.

**Data:** Topic titles Locus already has (topic map, B&B titles). For uni slides, the lecture titles the student pastes once at setup. Per card: 1 tap, which *is* the studying. No extra logging.

**Novelty check:** Blurting apps exist ([Blurtr](https://apps.apple.com/app/id6747290884), [Blurt](https://apps.apple.com/app/id6745759423)). There, you type or say everything you remember from your own notes and AI scores it. Anki has cards, but someone must write them. **The difference:** Locus needs no content and no typing. It runs on titles you already have, works for uni lectures and Telegram videos with no QBank, and feeds the result straight into the daily plan (blank → questions this week; "Had it" → spot-checked). I found no planner that does this. **Believed new.**

### 2. Patient of the day
**Pitch:** Saw a patient with DKA on the ward today? One tap, and tonight's study is about DKA.

**A real day:**
1. At 3 pm, between patients, Lina opens Locus. Today shows a small line: "Saw an interesting patient? Add them."
2. She types "dka" and picks **Diabetic ketoacidosis (Endo)** from the topic list (2 taps).
3. Tonight's plan swaps one task: "Endo: 10 questions on DKA. From your patient today." It is still sized to the time she has.
4. On Sunday, the week report shows: "3 ward patients turned into study this week."

**Principle:** Elaboration and illness scripts (linking knowledge to a concrete case). Relevance-driven timing: studying a topic when it has a real face makes it easier to remember. *The score effect is uncertain.*

**Data:** The topic map, which Locus already has. 2 taps, optional, never asked.

**Novelty check:** Patient logs exist ([Debrief](https://apps.apple.com/us/app/debrief/id6769976772), [WakeTrack](https://waketrack.wakehealth.edu)), but they track encounters for the school; they don't change your study plan. Planners (UWorld, Blueprint) don't know what you saw today. **Believed new.**

### 3. Call your score
**Pitch:** Before you type your block score, guess it. Over time Locus shows where you overestimate yourself, and plans around it.

**A real day:** Lina finishes 20 Cardio questions. The Block finished screen first asks "What do you think you got?" with chips 30 / 40 / 50 / 60 / 70 / 80%. She taps 70. Then she enters the real score: 50%. After 4+ blocks, Pace shows one line: "You tend to overestimate Cardio by ~15%. It's getting extra time."

**Principle:** Metacognition and calibration feedback. *Whether this improves scores is uncertain.*

**Data:** 1 tap per block.

**Novelty check:** Per-question confidence ratings already exist ([MedStudy Qbank+](https://explore.medstudy.com/blog/confidence-levels); [USMLE Benchmark](https://blog.blueprintprep.com/medical/the-best-usmle-prep-strategy-starts-with-question-banks-and-practice-tests/) has a 1–6 scale). **The difference:** a block-level prediction, for any resource, with calibration per system feeding the plan. That is **partly new**.

### 4. Sure-but-wrong
**Pitch:** On the Block finished screen, mark the missed topics you were *sure* about. Those get fixed first.

**A real day:** After a block, the missed-topics pick has an optional second tap: "Was sure." Fixes for those jump the queue, and the retest comes sooner.

**Principle:** Hypercorrection.

**Data:** 1 optional tap per missed topic.

**Novelty check:** Confidence per question already exists in MedStudy and Benchmark. Using it to prioritize the fix is a small twist. **Mostly not new.**

### 5. Why did I miss it
**Pitch:** One tap per block (didn't know / misread / down to two / ran out of time), and each reason gets a different fix.

**A real day:** After a 50% block, Lina taps "down to two". The fix becomes "10-min review: compare the two options you hesitated between", not "watch the video again".

**Principle:** Error analysis and targeted feedback. *Evidence is weak.*

**Data:** 1 tap per block.

**Novelty check:** Students already do this in spreadsheets (the widespread "error log" advice). Some QBanks have notes. Turning it into routed fixes is **partly new**.

### 6. Questions first
**Pitch:** For new topics, do 5 questions *before* the video. Getting them wrong is the point.

**A real day:** Plan: "Renal: 5 questions on glomerular disease first (expect to miss them), then the B&B video."

**Principle:** Pretesting. *Moderate evidence.*

**Data:** None. But the student has to find 5 questions on an unstudied topic in UWorld, and UWorld's topic filtering is coarse. That is real friction.

**Novelty check:** It's common study advice. **Believed new in planners**, though the idea itself is well known.

### 7. Look-alike duels
**Pitch:** Locus spots look-alike pairs (nephritic vs nephrotic, Crohn's vs UC, SIADH vs DI) and gives you a short drill that mixes them.

**A real day:** After Lina misses a nephrotic question, tomorrow's plan has "Duel: nephritic vs nephrotic · 5 min". One card at a time: "Name 2 things that tell them apart." Then she self-rates, and a mixed 10-question block follows the same week.

**Principle:** Interleaving for discrimination. Contrastive retrieval.

**Data:** A curated list of confusable pairs, ~40–60 to start. This is content work and needs medical review. No extra input.

**Novelty check:** Comparison tables exist in AMBOSS articles and First Aid, but you read them. Nobody I found schedules contrast drills from *your* misses. **Believed new.**

### 8. Exam-anchored keep-alive
**Pitch:** Solid topics get a tiny check timed so memory peaks at the exam date.

**Novelty check:** Too close to the existing retests in Locus and to Anki's scheduling. **Not new for Locus.**

### 9. Past-paper yield map
**Pitch:** Classmates mark which lectures came up in past uni exams. Locus weights the plan by local yield.

**Data:** Crowd-sourced, so it needs many users per batch. Accuracy and trust are a problem.

**Novelty check:** Unofficial "high-yield" lists are shared on Telegram. A structured version is **new locally**.

### 10. Last-48-hours sheet
**Pitch:** Before an exam, a personal list of everything you missed, your fuzzy recalls and your sure-but-wrong topics.

**Novelty check:** UWorld already lets you review incorrect questions, and AMBOSS has similar. Cross-resource is a twist. **Partly new.**

### 11. Quiz-swap buddy
**Pitch:** Two classmates quiz each other on each other's weak topics for 10 minutes.

**Novelty check:** Study-buddy apps exist. Matching on weak topics is new-ish, but it needs coordination between two tired people.

### 12. Explain-it-back
**Pitch:** After a video, explain it in 60 seconds (to yourself or by voice note).

**Novelty check:** Feynman-technique apps exist, and Blurt does it with AI scoring. **Not new.**

### 13. Exam-week drop list
**Pitch:** Locus tells you what to *skip* in the last week.

**Novelty check:** Planners already compress the schedule near the exam. **Not new.**

### 14. Dress rehearsal blocks
**Pitch:** Practice blocks at the real exam time of day.

**Novelty check:** Planners already schedule NBME/UWSA self-assessments. **Not new.**

### 15. Mix-it-up nudge
**Pitch:** Once a system is covered, Locus switches its blocks from single-system to mixed.

**Novelty check:** This is standard advice ("go random after a first pass"), and UWorld planners schedule random blocks. **Mostly not new.**

### Hard-rules re-check

Each idea was checked against the banned list: timer, gamification, rankings, wellbeing extras, generic AI, to-do stats, and anything already in Locus.

- #8 overlaps existing retests → **dropped** (it's already in Locus).
- #12 has no clear difference from existing apps → **dropped** (not new).
- #13 and #14 → **dropped** (not new).
- None mainly measures effort or time. #2's weekly line counts patients turned into study, which is a learning prompt rather than effort, and it can be cut if it feels like a stat.

Survivors going into critique: 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 15.

---

## 3. Tear it apart

The question for each idea: would a tired 5th-year on rotation use it **weekly**? Does it add input? Does it fit section 4b (calm, one decision per screen)? What does it cost?

| # | Idea | Used weekly? | Input burden | Fits 4b? | Build / run cost | Verdict |
|---|---|---|---|---|---|---|
| 1 | Recall Sweep | **Yes.** It's the one study activity that works when you're too tired for questions, and it's 3–5 min. | 1 tap per card, but the tap *is* the studying. Uni lectures need a one-time paste of titles. | Yes: one card, three buttons. | Low. Uses the existing topic map, the plan engine and a new task kind. No running cost. | **Keep.** Risk: self-ratings are overconfident. Mitigation: blank items are verified with questions, and "Had it" items are spot-checked against later scores. |
| 2 | Patient of the day | Likely 1–3× a week on rotations. Never asked, so no nagging. | 2 taps, optional. | Yes, if it's one quiet line on Today. | Low: topic search + a plan reorder rule. | **Keep.** Risk: the score benefit is unproven. Its value is motivation and relevance, and students will *feel* it. The topic list must include clinical names (DKA, not "Endo misc"). |
| 3 | Call your score | Yes, if it's a single tap on a screen they already see. | 1 tap per block. | Mostly. It adds one step before the score, so it must be skippable. | Very low. | **Keep as #4.** Per-question confidence already exists elsewhere. Calibration → score is uncertain. Could later be folded into Recall Sweep's spot-check, which already gives calibration feedback for free. |
| 4 | Sure-but-wrong | Rarely. One more tap on a screen that must stay under 10 s. | 1 tap per missed topic. | Adds clutter to Block finished. | Very low. | **Kill.** Not new enough, and it costs taps on the most time-sensitive screen. |
| 5 | Why did I miss it | Maybe for 2 weeks, then skipped. | 1 tap per block. | Borderline. | Low. | **Kill for now.** Weak evidence. Partly duplicates "Partly/Didn't" outcomes. Revisit if interviews show students keep error logs. |
| 6 | Questions first | Rarely. Finding 5 questions on an unstudied topic in UWorld is fiddly. | Real friction outside Locus. | Yes. | Very low. | **Kill as a feature.** Could become a one-line plan *reason* later ("Questions before the video: getting them wrong helps"). |
| 7 | Look-alike duels | Yes, triggered only by real misses. | None. | Yes: one card at a time. | **Medium:** a curated pair list (~40–60) that needs medical review. That is Omar's time. | **Keep.** A strong learning principle, and the pair list is a moat. Content effort is the cost. |
| 9 | Past-paper yield map | Would be loved, but needs many users per batch first. | Crowd input. | Yes. | Medium, plus moderation and trust. | **Later.** Revisit with shared templates in Phase 3. |
| 10 | Last-48-hours sheet | Once per exam, not weekly. | None. | Yes. | Low. | **Later.** Nice, but small. It falls out naturally once 1 and 7 exist. |
| 11 | Quiz-swap buddy | Unlikely. Two tired people must align their schedules. | High coordination. | Adds a social layer. | Medium. | **Kill.** |
| 15 | Mix-it-up nudge | Passive, so yes. | None. | Yes. | Very low. | **Fold in** as a plan-engine rule later, not a feature. Not distinct enough to market. |

---

## 4. Rank

Each score is 1–5. Build effort: 1 = small. Input burden: 1 = none, 2 = a tap or two, 3 = more.

**Score = (impact × uniqueness) ÷ (build effort + input burden)**

| Rank | Idea | Impact | Uniqueness | Effort | Burden | Score |
|---|---|---|---|---|---|---|
| **1** | **Recall Sweep** | 5 | 4 | 2 | 2 | **5.0** |
| **2** | **Patient of the day** | 3 | 5 | 2 | 2 | **3.75** |
| **3** | **Look-alike duels** | 4 | 4 | 3 | 2 | **3.2** |
| 4 | Call your score | 3 | 3 | 1 | 2 | 3.0 |
| 5 | Mix-it-up nudge | 2 | 2 | 1 | 1 | 2.0 |

### #1 Recall Sweep: why it could be the reason people choose Locus
- **It fills the biggest hole.** Uni exams and Telegram videos have no QBank, so students re-read and re-watch. Recall Sweep gives them retrieval practice for *any* material they can name. No competitor does this, because they only plan around their own content.
- **It works when you're wrecked.** A 4-minute sweep is the one valuable thing you can do at 10 pm after call. This fits the light-day logic perfectly: a light day can be "just a recall sweep".
- **It fixes the fluency illusion.** "You felt sure about Valvular disease, but scored 45%" is the moment a student realizes the app knows them. That moment is memorable and shareable.
- **It makes the plan smarter for free.** Blank and fuzzy topics feed the existing fix → retest loop with zero logging.
- **Pitch line:** *"Watched it ≠ know it. Locus checks."*

### #2 Patient of the day: why it could be the reason people choose Locus
- **Only a rotation student has this need,** and only a planner that knows about rotations can serve it. Blueprint and UWorld can't.
- It turns the ward into the study plan. That is how clinicians actually build knowledge (illness scripts), and students feel it immediately.
- It's optional, quiet and 2 taps, and it gives the student a reason to open Locus during the day.
- **Pitch line:** *"Saw it this morning, nailed it tonight."*

### #3 Look-alike duels: why it could be the reason people choose Locus
- Much of the exam is about telling look-alikes apart, and interleaving is the evidence-backed fix. No planner schedules contrast drills from *your* misses.
- **The curated pair list becomes Locus's own content asset:** small, high-yield and hard to copy well.
- **Cost to be honest about:** the pair list needs Omar's (or a resident's) review. That makes it more of a Phase 1–2 item than a quick win.
- **Pitch line:** *"Nephritic or nephrotic? Locus drills the ones you mix up."*

### Notes
- **Synergy:** 1 and 3 share one card mechanic (prompt → think → self-rate). Building Recall Sweep first makes Duels cheap later.
- **Free calibration:** Recall Sweep's spot-check gives most of "Call your score"'s benefit without the extra tap.
- **Phase 0 interview questions this adds:**
  - "How do you test yourself on uni lectures?"
  - "When you see an interesting patient, does it change what you study that night?"
  - Watch whether students react to the "you felt sure but scored 45%" moment.

### Step 5 plan (waiting for approval)
Prototype **Recall Sweep** in the existing clickable prototype. It sits behind an idea flag in `src/lib/features.ts` (off by default, on with `?idea=1`). With the flag on:
- Today shows a "Recall sweep · Cardio · 4 min" task built from Lina's covered Cardio topics.
- Pressing Start opens a one-card-at-a-time screen with Had it / Fuzzy / Blank.
- A summary shows what was added to the week.

Nothing else changes when the flag is off.

---
---

# Round 2

Brief: angles round 1 didn't touch (moments, people, decisions, inputs, the exam itself).

**Excluded:**
- All 15 round-1 ideas and their core mechanisms: self-rated recall, confidence ratings, contrast drills, patient-based study, error-reason routing, peer quizzing, crowd-marked past papers, drop lists, rehearsal blocks.
- The original HARD RULES.
- Anything already in Locus or listed in CLAUDE.md. This includes shared templates, calendar import for rotations, and richer Anki tag data.

Novelty checks use what I know (to June 2026) plus three web searches for this round. "Believed new" means I found nothing, not that nothing exists.

## R2.1 Ground it (additions to round 1)

**Well established**
- **Transfer-appropriate processing.** Memory works best when the way you practise matches the way you'll be tested (Morris, Bransford & Franks 1977). The testing-effect literature shows the same: practice in the final test's format transfers best. Medical students have both MCQ exams and clinical exams (OSCE, long case, viva), and most tools only train MCQs.
- **Sleep and memory consolidation.** Sleep after learning strengthens memory, and sleep deprivation harms recall and reasoning (Diekelmann & Born 2010). This is relevant to the night before an exam, but it overlaps "wellbeing", so no idea below is built on it.
- **Advance organizers and prior knowledge.** New information is learned faster when it can attach to an existing framework (Ausubel 1960; for medicine, see the illness-script literature, Schmidt & Rikers 2007). *The effect size of short "primers" is moderate and varies.*
- **Implementation intentions.** Concrete "when / where / what" plans raise follow-through (Gollwitzer & Sheeran 2006, meta-analysis). This one is about doing the work, not learning; it is noted because two ideas lean on it.

**Moderate or uncertain**
- **Collaborative learning.** Peer discussion of material each person has prepared helps understanding (Michaelsen on team-based learning; Smith et al. 2009 on peer discussion in *Science*). *Benefits depend heavily on group quality; free-riding is common.*
- **Personal resource effectiveness.** That one resource "works better for you" is plausible, but there is no direct evidence it can be measured from a student's own logs. Topic difficulty and the order resources were used both confound it.

**Our students, new observations for this round**
- Local exams are announced in Telegram groups and by class reps, often with a question split per subject or per lecturer ("IM exam: 60 MCQs: Cardio 15, GI 12…"). Students know this split, but no tool uses it.
- Many local rotation exams are **not** pure MCQ: OSCE stations, long cases and vivas are common. US planners assume MCQ.
- Lecture videos and exam dates arrive through Telegram channels the student already follows.
- Students hoard screenshots (slides, QBank explanations, ward notes) in their camera roll and almost never look at them again.
- The moment students quit a planner is when they fall *far* behind and the plan becomes fiction.

## R2.2 Generate: 10 ideas

Each idea is tagged with the angle it comes from: Moments, People, Decisions, Inputs or Exam.

### R2-1. Exam split → plan weights  ·  *Exam*
**Pitch:** Paste the question split your exam coordinator announced, and Locus plans by what your exam actually asks.

**A real day:**
1. A class rep posts in the batch Telegram group: "IM final 12 Feb: 100 MCQ: Cardio 20, GI 15, Renal 10, Endo 15, Resp 15, ID 10, Heme 15."
2. Lina copies it, opens the IM goal in Locus and taps "Add exam split". She pastes the text and Locus reads the numbers.
3. She confirms with one tap.
4. Today's plan now leans toward Cardio and Heme, because they are under-studied for their share.
5. The task reason line says: "Cardio is 20% of your IM final; you've spent 8% of your time on it."
6. If one person in the batch saves the split, others with the same template get it too.

**Principle:** Allocating time by exam weight. This is decision quality, not a memory effect. It turns the existing gap rule (`exam_weight − time_share`) from made-up example numbers into real local numbers.

**Data + input cost:** The announced split. One paste per exam, often done once per batch. Parsing is a simple regex for "Name number" pairs plus a confirm screen; Arabic subject names need a small synonym list.

**Novelty check:** US planners (UWorld, Blueprint) use the official NBME/USMLE content outline, which local exams don't have. Round-1 idea #9 (Past-paper yield map) is different: it was a crowd's *guess from past papers*, this is the *official current split*. **Believed new for local exams.**
**Honest caveat:** It reuses an existing engine rule. The new part is the input, so it is half feature, half data fix. It also answers the open decision in CLAUDE.md §12 ("real exam-weight numbers").

### R2-2. Practise in the exam's format  ·  *Exam*
**Pitch:** If your IM exam is an OSCE plus MCQs, your plan contains station practice, not just questions.

**A real day:**
1. When adding the IM goal, Locus asks one question: "How is it examined?" The chips are MCQ, OSCE / stations, Long case, Viva and Not sure. Lina taps MCQ + OSCE.
2. The plan now mixes task types in proportion to the exam. On Tuesday: "UWorld: 15 GI questions · 25 min" and "OSCE: abdominal exam station, run the checklist out loud, timed 8 min".
3. The OSCE task shows the station checklist inline (a short public or generic list, no copied content). The timer runs the station time, and she taps Done or Struggled.
4. A "Struggled" station comes back later in the week.

**Principle:** Transfer-appropriate processing (well established): practise the way you'll be tested.

**Data + input cost:** One tap per goal to choose the format. The station list per rotation is curated content (for Mutah IM, roughly 15–25 stations). After a station, one tap.

**Novelty check:** [Geeky Medics](https://geekymedics.com) and [PasTest](https://shop.pastest.com/blogs/news/preparing-for-the-osces-in-medical-school-the-complete-guide) have OSCE content, but they don't plan. Planners like [Blueprint](https://blog.blueprintprep.com/medical/how-to-use-cram-fighter-and-to-create-a-study-schedule-for-all-your-med-school-exams/) and [AMBOSS](https://amboss.com/int/medicalstudyplan) schedule MCQ-style content and don't mention stations. **Believed new: a planner that sizes task types to the exam format.**
**Overlap risk:** "Done / Struggled" on a station resembles self-rating. The core mechanism here is *format-matched allocation*, not recall rating, so it stays, but the tap should be checked against the round-1 exclusion.

### R2-3. Which resource works for you  ·  *Decisions*
**Pitch:** After a few weeks, Locus tells you which of *your* resources leads to better scores for which kind of topic.

**A real day:** On Sunday, Pace shows one line, only once there is enough data: "For you, topics you watched on B&B before questions score 68%; topics from uni slides alone score 54%. Next week's Renal starts with B&B." Lina can tap "Keep my way" to turn it off.

**Principle:** Better decisions about how to study (metacognitive control). *Uncertain:* whether the difference is the resource itself, or harder topics being studied with certain resources. It needs a confounding guard: compare within the same system, require a minimum number of sessions, and say "seems to" rather than "works".

**Data + input cost:** None extra. Locus already logs which resource was used per session and the scores that followed. It needs about 4–6 weeks of data before it says anything.

**Novelty check:** Each resource only knows itself: UWorld can't see B&B, and AMBOSS can't see uni slides. Students compare resources on Reddit and Telegram, but generically, not personally. **Believed new.**

### R2-4. Rescue options when you're far behind  ·  *Decisions*
**Pitch:** When "+15 min a day" can no longer fix it, Locus stops pretending. It offers 2–3 honest paths and shows what each one costs.

**A real day:**
1. After a week of surgery call, Lina is 19 days behind for her Step 1 date. Spreading the gap over the remaining days would mean +2 h a day.
2. Instead of a red warning, Pace shows one calm question: "The current plan doesn't fit anymore. Pick a path:"
   - **Move the date 4 weeks**: "Keeps everything; Step 1 moves to 18 May."
   - **Narrow the scope**: "Skip the second UWorld pass and low-weight systems. Covers ~85% of exam weight."
   - **Add time**: "+45 min on weekends only, no change on rotation days."
3. She picks one, and the whole plan rebuilds. Nothing else changes until the next mismatch.

**Principle:** Decision quality and implementation intentions. Mainly it prevents giving up, the point where planners lose students. *Its effect on learning is indirect.*

**Data + input cost:** Existing pace data and exam weights. One tap, and only when it's triggered.

**Novelty check:** UWorld's planner and Blueprint recalculate silently or ask you to rebalance by hand. Neither presents scenario trade-offs with their cost. Round-1 idea #13 (Exam-week drop list) was Locus deciding what to skip in the last week. This is different: a student choice between whole strategies, any time the plan breaks. **Partly new.** It is adjacent to the existing pace view, and the risk is that it reads as "more pace".

### R2-5. When to book Step 1  ·  *Decisions*
**Pitch:** Locus suggests a booking window from your rotation calendar and pace, instead of you guessing a date and hoping.

**A real day:** At setup, if Lina picks "Haven't booked yet", Locus answers: "At your pace, you'd finish UWorld in early June. Your rotations end 28 May and your IM final is 4 June. Suggested window: 15–30 June. Check with an NBME self-assessment around 1 June before you book."

**Principle:** Decision quality. No memory effect.

**Data + input cost:** Existing goals, availability and pace. One tap.

**Novelty check:** UWorld and Blueprint take your date as input. Score predictors exist for NBME/UWSA forms. **Step 1 is pass/fail**, so the real readiness signal is an NBME self-assessment, which Locus can only recommend scheduling. **Partly new, weak.**

### R2-6. Rotation week zero  ·  *Moments*
**Pitch:** In the first week of a new rotation, Locus front-loads what you'll meet on the ward from day one, so the ward makes sense.

**A real day:**
1. Lina's surgery rotation starts Sunday. On Thursday before, Today shows: "Surgery starts Sunday. The first week leans on the 6 things you'll see most: acute abdomen, post-op fever, fluids, bowel obstruction, appendicitis, hernias."
2. During week one, the evening plan pulls those topics forward. The time she has is unchanged; it is the same plan, re-ordered.
3. From week two the plan returns to the normal weight-based order.

**Principle:** Advance organizers and prior knowledge (moderate). Also timing relevance: what you've just studied attaches to what you see next morning.

**Data + input cost:** A curated list of top presentations per rotation (content work, Omar plus seniors). No student input: the rotation dates already exist.

**Novelty check:** AMBOSS has clerkship guides you read, and Blueprint suggests per-rotation study blocks. Neither re-orders your plan for the first week around common ward presentations. Round-1 idea #2 (Patient of the day) *reacts* to a patient you saw. This one is prospective and calendar-driven, with no patient input. **Partly new.**

### R2-7. Study group in sync  ·  *People*
**Pitch:** Three to five friends link their Locus plans, so they hit the same system in the same week and meet once to discuss it.

**A real day:**
1. Lina, Sara and Omar join a group with a shared code.
2. Locus aligns their plans' system order, not their daily tasks, so all three do Renal in week 3 at their own hours.
3. Thursday's plan has "Group: Renal discussion · 30 min · bring your 3 hardest questions".
4. Nobody's personal plan, scores or pace is shared, only the system order.

**Principle:** Collaborative learning and peer explanation (moderate). The commitment effect is about doing the work, not learning.

**Data + input cost:** Group membership (one-time code) and an agreed order. This requires accounts and sync, so Supabase must be in place: Phase 2 or later.

**Novelty check:** [Clerk](https://apps.apple.com/app/id6758461193) has study groups that share streaks and focus time, which is exactly the effort comparison we excluded. Focusmate and Discord study rooms offer co-presence only. Nothing I found aligns *curriculum order* across a group. **Believed new.** Round-1 idea #11 (Quiz-swap buddy) was pairwise quizzing on each other's weak topics; this shares order, not quizzes.

### R2-8. Batch struggle report  ·  *People*
**Pitch:** An anonymous, batch-level "what we're all stuck on" list that the class rep can take to a lecturer to request a review session.

**A real day:** On Sunday the class rep sees: "Batch of 42 (anonymous, min. 10 students per topic): Acid–base is weak for 64%, ECG interpretation for 51%." They forward it to the IM coordinator and ask for a one-hour review.

**Principle:** Targeted instruction (feedback to teachers). *The effect depends on faculty acting on it.*

**Data + input cost:** Aggregated topic states. No student input. Needs accounts, an opt-in and privacy thresholds.

**Novelty check:** UWorld and AMBOSS institutional dashboards give *faculty* cohort analytics when the school pays. This one is bottom-up and student-owned. **Partly new.** It is adjacent to "ranking students" only if done badly, so it must have no individual data and no percentiles per student.

### R2-9. Telegram channel watcher  ·  *Inputs*
**Pitch:** Point Locus at your batch's Telegram channel, and new lecture videos and exam dates show up in your plan without typing.

**A real day:**
1. At setup, Lina pastes the link to her batch's public channel.
2. When the lecturer's video for "Thyroid disorders" is posted, Locus shows a quiet line on Today: "New: Thyroid disorders video in your channel. Add to Endo?" She taps Add.
3. When "IM final moved to 15 Feb" is posted, Locus asks "Update your IM final date?" She taps Yes.

**Principle:** Material completeness and accurate dates. Better decisions, no memory effect.

**Data + input cost:** One paste at setup, then 1 tap per suggestion.
- Public channels can be read via Telegram's web preview (`t.me/s/<channel>`).
- Private groups need a Locus bot added, or messages forwarded to it.
- Arabic date parsing needs a small model or rules. Running an LLM extraction is about $0.0005 per message.

**Novelty check:** Planners like MyStudyLife and Blueprint don't read Telegram, and Telegram bots *publish to* channels rather than feed a planner. **Believed new.**
**Risks:** Telegram Terms of Service, lecturers' copyright (Locus must store only titles and links, never videos), and parsing errors.

### R2-10. Screenshot inbox  ·  *Inputs*
**Pitch:** Share a screenshot (a slide, a QBank explanation, a ward note) to Locus. It comes back in that topic's next task, when it's useful.

**A real day:**
1. Lina screenshots a UWorld explanation table on heart failure drugs.
2. She shares it to Locus (installed web app share target) and picks "Heart failure" from the topic suggestions. That is two taps.
3. Two weeks later, the Cardio questions task shows "Your saved: 1 screenshot" under the task. It opens full screen.
4. Nothing is rated or reviewed separately.

**Principle:** Spacing (the material returns at a later, relevant moment) and reducing scattered resources. *There is no evidence that simply re-showing material helps; re-viewing is passive.*

**Data + input cost:** Two taps per screenshot. Images are stored locally (Dexie) and never uploaded by default.

**Novelty check:** [Readwise](https://readwise.io) resurfaces saved highlights on a schedule, and Anki image occlusion turns images into cards by hand. **Partly new:** the difference is that it's topic-linked and appears inside the plan.

### Exclusion re-check
- **R2-2:** its "Done / Struggled" tap borders on round-1 self-rating. It stays, because the idea's core is format-matched allocation, but the tap could be dropped entirely, which removes the overlap.
- **R2-6:** borders on round-1 Patient of the day. It stays: the trigger is the calendar, not a patient.
- **R2-4:** borders on round-1 #13 drop list. It stays: it is the student's scenario choice, not Locus deciding what to skip.
- **R2-7:** borders on round-1 #11 quiz-swap. It stays: no peer quizzing.
- **R2-8:** comparison with peers was checked. It is batch-level only, with no individual rank.
- **None** is a timer, gamification, wellbeing extra, AI chat or to-do stat.

**Explored, then dropped before writing up:**
- *Seniors annotate templates.* Dropped as shared templates, which are already listed.
- *Seniors report what came up.* Dropped as round-1 #9 yield map.
- *Post-exam debrief with reasons.* Dropped as round-1 #5 at exam level.
- *Night-before sleep cut-off.* Dropped as a wellbeing overlap.
- *Photo of class schedule.* Dropped as calendar import, which is already listed.
- *Anki tag sync.* Dropped as richer Anki data, which is already listed.
- *Ward capture of questions you couldn't answer.* Dropped as round-1 #2 mechanism.

## R2.3 Tear it apart

| # | Idea | Used weekly? | Input burden | Fits 4b? | Build / run cost | Verdict |
|---|---|---|---|---|---|---|
| R2-1 | Exam split → weights | Set once per exam; *felt* every day in task reasons | One paste per exam, often once per batch | Yes: invisible except a better "why" line | Low: parser + confirm screen; engine rule exists | **Keep.** Highest value for least work. Risk: splits are announced late or change, so it must handle "Not announced yet" (fall back to defaults). |
| R2-2 | Exam-format practice | Yes during OSCE rotations | One tap per goal; one tap after a station | Yes: just another task type | Medium: station lists per rotation are content work; checklists must be original or generic, never copied | **Keep.** Strong evidence (TAP) and an obvious local gap. Content effort is the cost. Test in Phase 0: "How is your IM exam examined?" |
| R2-3 | Resource fit | Weekly line, once there's data | None | Yes: one line on Pace | Low engine work; needs 4–6 weeks of data and careful wording | **Keep, but late.** Cannot show anything in a 4-week beta for most students. Statistical honesty matters more than the feature. |
| R2-4 | Rescue options | Rarely, but at the exact moment people quit | One tap when triggered | Yes: one question, three answers | Low: scenario math reuses pace | **Keep.** It is the opposite of guilt, and retention may hinge on it. Risk: feels like a pace feature, not a new one. |
| R2-5 | Booking window | Once | One tap | Yes | Low | **Kill as a feature.** Weak and once-only. Step 1 is pass/fail; NBMEs decide. Could become one sentence in setup. |
| R2-6 | Rotation week zero | Once per rotation, ~every 4–8 weeks | None | Yes | Medium: per-rotation lists | **Later.** Nice, but small. It folds into templates once those exist. |
| R2-7 | Study group sync | Weekly, if the group holds | One-time join | Adds a social layer; must stay quiet | High: accounts, sync, group plan alignment, group drop-off | **Later (Phase 2+).** Needs a backend; groups fall apart. Ask in interviews whether students study in fixed groups. |
| R2-8 | Batch struggle report | Class reps only | None | Fine for students; reps see a separate view | High: accounts, privacy thresholds, faculty buy-in | **Kill for now.** It depends on lecturers acting on it. Revisit at the university-license stage. |
| R2-9 | Telegram watcher | Yes, if the channel is active | One paste, then one tap per item | Must stay one quiet line, or it becomes a feed | High: scraping, private groups, Arabic parsing, ToS, copyright | **Later.** Strongest "wow" for the local market, and the riskiest to build. Validate first: do most batches have a *public* channel? |
| R2-10 | Screenshot inbox | Probably not; students rarely open saved things | Two taps per screenshot | Adds a library that grows; risk of junk drawer | Medium: share target, image storage on phones | **Kill.** Re-showing material is passive (low utility), and it pulls Locus toward a notes app. |

## R2.4 Rank

Same formula and scales as round 1. Each score is 1–5. Build effort: 1 = small. Input burden: 1 = none, 2 = a tap or paste, 3 = more.

**Score = (impact × uniqueness) ÷ (build effort + input burden)**

| Rank | Idea | Impact | Uniqueness | Effort | Burden | Score |
|---|---|---|---|---|---|---|
| **1** | **Exam split → weights** | 4 | 4 | 1 | 2 | **5.3** |
| **2** | **Exam-format practice** | 4 | 4 | 2 | 2 | **4.0** |
| **3** | **Resource fit** | 3 | 4 | 2 | 1 | **4.0** |
| 4 | Rescue options | 4 | 3 | 2 | 2 | 3.0 |
| 5 | Telegram watcher | 3 | 5 | 4 | 1 | 3.0 |
| 6 | Rotation week zero | 3 | 3 | 3 | 1 | 2.25 |
| 7 | Study group sync | 3 | 4 | 4 | 2 | 2.0 |
| 8 | Booking window | 3 | 2 | 2 | 1 | 2.0 |
| 9 | Batch struggle report | 3 | 3 | 4 | 1 | 1.8 |
| 10 | Screenshot inbox | 3 | 3 | 3 | 2 | 1.8 |

Format practice and Resource fit tie on score. Format practice ranks higher because its learning principle is well established and it works from day one; Resource fit is uncertain and needs weeks of data.

### #1 Exam split → weights: why it could be the reason people choose Locus
- It answers the question every student asks before a local exam ("what's actually on it?"), using information they already have in a Telegram message.
- No international planner can do this, because they don't know local exams exist.
- It makes every task's "why" line concrete and local: "Cardio is 20% of your IM final".
- It's cheap: the engine rule already exists.
- **Pitch line:** *"Your exam's real split, not a US outline."*

### #2 Exam-format practice: why it could be the reason people choose Locus
- Jordanian rotation exams include OSCEs and vivas that no QBank or US planner prepares you for.
- A planner that schedules station practice is visibly built for *our* exams.
- It has the strongest evidence of this round: practise how you'll be tested.
- **Cost:** curated station lists per rotation, which is Omar's (or seniors') time.
- **Pitch line:** *"Your OSCE is in the plan too."*

### #3 Resource fit: why it could be the reason people choose Locus
- It's the only thing a cross-resource planner can know that no single resource can. It turns Locus's position (it sees everything) into advice.
- It answers a question students argue about constantly ("B&B or uni slides for Renal?") with *their own* results.
- **Honest limit:** it needs weeks of data and careful wording, so it's a reason to *stay*, not to start.
- **Pitch line:** *"Find out which resources actually work for you."*

### Notes
- **Rescue options (#4)** may matter more for retention than its score suggests. Consider it a design principle for the pace view in Phase 1 rather than a separate feature.
- **Telegram watcher (#5)** has the highest uniqueness. Validate before building: ask in Phase 0 whether their batch's channel is public, and how they hear about exam dates.
- **Phase 0 interview questions this round adds:**
  - "How do you find out what your exam covers and how it's split?"
  - "How is your IM rotation exam examined?"
  - "How do you decide whether to use B&B, uni slides or something else for a topic?"
  - "Where do you get lecture videos and exam announcements?"
- **Combined with round 1:** Recall Sweep (R1 #1) and Exam split → weights (R2 #1) are complementary. Recall Sweep makes uni material testable; the split makes uni time allocation correct. Together they are Locus's clearest "built for local exams" story.

Nothing from round 2 is built.
