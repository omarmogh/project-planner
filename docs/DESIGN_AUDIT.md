# Design audit (November 2026)

Scope: every screen (onboarding, Today, Running, Block finished, Pace, Week, Board, the Your plan and commitment sheets), at 375 px (phone) and 1280 px (desktop), in light and dark mode. Tools: Playwright screenshots plus checks for console errors and horizontal overflow. The reference sites (Linear, Stripe, Apple, Dropbox) were captured with Thooku at 390, 768 and 1440 px; the measurements are in `docs/THOOKU_REFERENCE.md`. (An earlier version of this file said Thooku could not be installed. That was wrong: it ran in the second pass.)

Baseline before changes: no console errors and no horizontal overflow at either width, in either theme. `npm test` passed (340) and `npm run e2e` passed.

## Findings

| # | Priority | Where | Problem | Why it matters | Fix | Status |
|---|---|---|---|---|---|---|
| 1 | High | Whole app (desktop) | Almost no hover states: 3 `hover:` uses against 67 `active:` uses. Buttons, chips, task rows, text links and the sheet's Done gave no feedback to a mouse. | On a laptop it is unclear what is clickable. The app feels inert. | `hover:` on Button (all variants), Chip, the task-row circle, every text link (`hover:opacity-70`), Sheet Done, the "+" and the Running close button. Tailwind 4 applies `hover:` only on devices that hover, so touch is unchanged. | Done |
| 2 | High | Sheets, dark mode | The sheet panel is pure black over a dimmed black page, so it has no visible edge. | The sheet floats with no clear boundary; it reads as a rendering glitch. | The panel uses `shadow-lifted` (a hairline ring plus a soft shadow; in dark mode the ring is white at 14%). | Done |
| 3 | High | Today, Running | No keyboard shortcuts in a tool people use daily on a laptop. | Keyboard users have to reach for the mouse for the two most frequent actions. | `N` opens "Something you have to do" on Today. `Space` pauses or resumes the timer. Both are ignored while typing, while a button has focus, while a sheet is open, or when a modifier is held (`src/lib/useShortcut.ts`). Each is discoverable through the button's tooltip. | Done |
| 4 | Medium | Today | "Not feeling well? Take it easy" showed at the same time as the "Rough day?" card, which offers the same thing. | Two entries for one decision, on the screen whose job is "what do I do now". | The link is hidden while the card is showing. | Done |
| 5 | Medium | Pace headline, Today first day | Accent blue was used for status text that cannot be tapped ("5 lectures left, 1 a day is enough.", "Here's your first day"). | Blue means "tappable" everywhere else. Mixing the two weakens that cue. | Status text is now `fg` or `muted`. Accent stays on actions and on the "Added to …" label of a new fix. | Done |
| 6 | Medium | Week tab | Your plan, Weekend and Appearance sat under the report with no heading. Appearance was centred while the lines above it were left-aligned. | Settings were hard to find, and the block looked unfinished. | Grouped under a quiet "Settings" heading. All three lines are start-aligned at the same size. | Done |
| 7 | Low | Today (phone), sidebar | The "Locus" wordmark was `faint`, close to invisible. | The product had no visible identity anchor. | The wordmark is `fg` in the sidebar and on Today. It stays quieter (`muted`) on the share card. | Done |
| 8 | Low | `src/index.css` | `--shadow-lifted` was declared twice in the dark-mode media block. | Harmless, but it signals drift in the token file. | Removed the duplicate. | Done |
| 9 | Low | e2e test | The "Skip" check matched "Connect Anki to skip this step" (a substring) and passed without ever pressing Skip. | A test that cannot fail protects nothing. | Uses an exact name match. | Done |
| 10 | Medium | Today header | Three muted meta lines (planned time, goals countdown, system line) had the same weight. | Nothing told the eye where to land first. | The planned time is now one large number ("2 h 45 min planned") with "x of N tasks done" opposite it and a thin bar under them. The goals line sets labels in `fg` and countdowns in `muted`. No information was removed. | Done |
| 11 | Low | "Rough day?" card and other inline choices | Three equal text actions wrapped onto two lines, with no suggested choice. | The student had to read all three to decide. | The suggested choice is an accent pill, the alternative a neutral pill, and "Keep the full plan" a quiet link. The same pattern is used on Lighter day, Next system and Exam date prompts. | Done |
| 12 | Low | Native date inputs | Follow the browser locale (for example dd/mm against mm/dd). | A minor inconsistency with the app's own date words. | Left native for accessibility and the phone date pickers. | Open |

| 13 | High | Whole app | Cool greys and no mark made it look like a template. | Identity (CLAUDE.md 4b: not AI-looking). | Warm neutrals for surfaces and text (contrast re-measured, all AA), and a small ring-and-dot mark next to "Locus". | Done |
| 14 | High | Today | The next task was only a filled circle in a list with dividers. | "What do I do now?" needs one obvious answer. | The selected task sits on a rounded `surface` highlight; the other rows show a soft highlight on hover; dividers removed. | Done |
| 15 | Medium | Today, Nav | Start and tab switching needed the mouse on a laptop. | Most-used actions (Linear). | `S` starts the selected task. `1–4` switch tabs on desktop, with key hints in the sidebar. | Done |
| 16 | Medium | Buttons, pills | Pressing gave no physical feedback. | Responsiveness (Apple). | `.press`: a small scale on press, 180 ms with an out-curve. Off under reduced motion. | Done |
| 17 | Low | Large titles | `tracking-tight` everywhere, too loose at 30–76 px. | Display type looked soft. | `tracking-display` (−0.022em) on large titles. | Done |
| 18 | Low | Sticky Start (phone) | Content scrolled under the bar with a hard edge. | It was unclear there was more below. | A 24 px fade above the bar on phone and tablet. | Done |
| 19 | Low | Bottom tabs | Inactive tabs used `faint`, below AA. | Readability. | `muted`. | Done |
| 20 | High | Today → Running → Block finished | Screens swapped instantly; nothing connected one step to the next. | Spatial continuity (ui-animation skill). | View Transitions: Start grows into the timer and the timer shrinks back on close; Block finished rises in and Today settles back on "Got it". | Done |
| 21 | High | Tabs | Tab changes were a hard cut. | Direction of travel. | Content slides a little in the direction of the tab (mirrored in RTL); the nav stays still. The sidebar highlight glides to the new tab. | Done |
| 22 | High | Sheets (phone) | Sheets popped in and vanished; no way to pull them down. | Touch-first, drawer physics. | A drawer: rises on the iOS curve, follows the finger from its top edge, closes past 80 px or a quick flick, springs back otherwise; friction when pulled up. The exit is faster than the entrance. | Done |
| 23 | Medium | Today task list | The selected highlight jumped between rows. | Continuity. | The highlight glides to the next task (FLIP, transform only). | Done |
| 24 | Medium | Progress bars, theme | Bars appeared full; the theme switch flashed. | Feedback when something changes. | Bars fill from empty on open (transform only); light/dark cross-fades. | Done |
| 25 | Low | Sheets closed from their own content (e.g. Add) | Still close instantly. | The parent unmounts them directly. | Left as is for now; Done, scrim and drag animate. | Open |

Checked and fine as is: Running (one number, two actions); onboarding (one question per step); Pace accuracy bars (semantic colours with a 60% tick); Board density; focus rings (global `:focus-visible`); and reduced motion (a global media block turns off all animations and transitions, including the new hover transitions).

## Design system (as implemented)

All tokens are in `src/index.css`. Change the token there, never inline.

- **Colour.** Warm neutrals:  `bg`, `surface`, `line`, `fg`, `muted` and `faint`. There is one accent: `accent` (#2a5bd7 light, #6b95ff dark), with `accent-soft` for selected and hover fills. Semantic colours are `good`, `warn` and `weak`, used only when they mean something. Accent marks things you can tap or a newly added item, never status text.
- **Type.** Inter Variable. Named steps run from caption-2 (11) to large-title (30), plus display (44) and timer (76). Numbers use `tnum`.
- **Spacing.** An 8-pt grid. Touch targets are at least 44 px (`min-h-11`), and primary buttons are 52 px (`min-h-13`).
- **Radius.** sm 0.375, md 0.75, lg 1 and xl 1.75 rem.
- **Elevation.** `shadow-paper` for cards on the Board, and `shadow-lifted` for anything floating (sheets, a focused note).
- **States.** Every interactive element has a resting, hover (pointer devices only), active (pressed), focus-visible (2 px accent outline, 3 px offset), and disabled state. Text links use `hover:opacity-70 active:opacity-60`. Filled controls darken or tint on hover.
- **Motion.** Follows the ui-animation skill: transform and opacity only; exits faster than entrances; nothing moves for keyboard-triggered actions, in a hidden tab, or under `prefers-reduced-motion`.
  - Tokens: `--motion-quick` 180 ms with `--ease-out` for hover; `--motion-press` 140 ms for `.press`; `--ease-enter` `(0.22, 1, 0.36, 1)` for things arriving; `--ease-drawer` `(0.32, 0.72, 0, 1)` for sheets and the timer; `--vt-dx` (1rem, −1rem in RTL) for tab slides.
  - Screen changes go through `transition(update, kind)` in `src/lib/motion.ts` (View Transitions API; falls back to an instant change). Kinds: `forward`/`back` (tabs), `open`/`close` (Start ↔ Running), `up`/`down` (Block finished in and out), `fade`, and `theme`.
  - Moving highlights (sidebar tab, selected task) use FLIP with WAAPI, measured on the parent.
  - `anim-rise`, `anim-fade`, `anim-sheet` for elements entering; `.bar-fill` with `@starting-style` for progress.
- **Keyboard.** `useShortcut(key, run)` for single-key shortcuts: `N` add, `S` start, `Space` pause, `1–4` tabs (desktop). Escape closes any sheet.
- **Components.** `Button` (primary actions), `Pill` (choices inside a card: accent = suggested, neutral = alternative), `Wordmark`, `ProgressBar` (`thin` variant).

## Board: editing, pins, strings (Nov 2026)

| Change | Why |
|---|---|
| A video topic opens with a chevron to tick each video on its own (the topic row still ticks all) | "4/4" told you the count but not which ones |
| Pin = fixed in place. A pinned paper or note can't be dragged (dragging it pans the board, with a short note); no accent outline | A pin was a highlight; now it does what a pin does |
| Every checklist can be edited (pencil): rename it and its rows, delete rows, add rows, remove it from the Board. Plan checklists: edits are Board-only, ticks still change the plan, hidden rows and removed checklists can be put back | Full editing without changing the plan engine |
| "+ Add" is a menu: Note, Checklist (your own), Link two things, and put back removed checklists | One entry point for everything you can add |
| Strings: link two things (tap one, then the other); tap a string to remove it. Drawn under the papers | Tie a note on a weak topic to its videos or lectures; group related uni and USMLE material |
| Fixed: adding a note zoomed to the top-left corner (stale position); new things now land at the centre, stepping aside if something is already there | Bug |
| Fixed: the blue focus ring around a note while typing (global `:focus-visible` beat `outline-none`); `.note-text` / `.board-input` opt out | The note itself is the focus |

### Strings to rows, colour, bend; the pin (Nov 2026)

- **Rows as ends.** In link mode, tapping a row (a lecture, a topic, a video, an item) ties the string to that row. Tapping elsewhere on the card ties it to the whole card. The string leaves from the row's side edge facing the other end. A part folded under its topic falls back to the topic's row. Two rows on one card loop out on the right.
- **Tap a string** to pick it. The two ends get an outline in the string's colour, and the linked rows get a soft wash with a side bar. Other strings dim to 35%. A bar opens over the string's middle: 5 colours (grey, blue, green, amber, coral; semantic tokens only), "Straighten" (when bent) and Remove (icon, labelled). The bar flips below near the top of the screen and stays inside the screen sideways.
- **Bend.** Drag anywhere on a picked string (or its middle handle). The curve passes through the finger at the point it was grabbed: the quadratic's control point is solved from the grab position `t`, clamped to 0.15–0.85. The bend is saved on release. A tap without movement only picks the string.
- **Pin.** The pin is now a 14 px head (accent, card-coloured ring, soft shadow), centred on the paper's top edge and the same size at every zoom. Pinning drops it in with a small overshoot (360 ms) while the paper gives slightly (scale 0.985). Unpinning lifts and fades it (180 ms) before it goes. The toggle icon tilts 45° when unpinned. With reduced motion, nothing animates.

## Study sessions and Tick all (Nov 2026)

| Change | Why |
|---|---|
| Today: each task's circle chooses whether it's in the session (accent dot pops in); left-out rows are muted with "Not in this session · stays on today". Start reads "Start · n tasks · time" | Doing 2 of the 3 planned tasks without fighting the plan |
| Running: one primary action ("Done · next", "Finish" on the last task), Pause beside it. "+5 min" and "Tasks · k of n" are pills under the clock | Ticking is the main thing; the rest is one tap away |
| "Tasks" sheet: tick any task, see when it was ticked and its timer minutes, switch to another task, leave one for later, add one of today's other tasks | The session stays flexible while the timer runs |
| Timer sheet: Timer / Pomodoro segmented control and steppers for the Pomodoro lengths | Brought back from v2, which the student liked |
| Break screen: "Stand up, drink some water", the countdown and one button (Skip break / Back to it) | A break that is clearly a break |
| Board: "Tick all" / "Untick all" at the end of each checklist, with Undo for 6 s | Ticking a whole list in one tap, safely |

## "+" also adds what is already there (Nov 2026)
| Change | Why |
|---|---|
| "Or pick from your plan or Board" under Add in the "+" sheet, shown until you type | Students expected "+" to add existing tasks; the picker was only reachable after the day ended. One link, hidden once typing starts, keeps the sheet's one job. |
