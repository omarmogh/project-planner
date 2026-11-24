# Design audit (November 2026)

Scope: every screen (onboarding, Today, Running, Block finished, Pace, Week, Board, the Your plan and commitment sheets), at 375 px (phone) and 1280 px (desktop), in light and dark mode. Tools: Playwright screenshots plus checks for console errors and horizontal overflow. The reference sites (Linear, Stripe, Apple, Dropbox) were inspected the same way. The Thooku plugin could not be installed in this environment.

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
| 10 | Medium | Today header | Three muted meta lines (planned time, goals countdown, system line) differ in shape. | Slightly busy, but each answers a real question. | Left as is: merging them would hide information students asked for. Revisit after Phase 0 feedback. | Open |
| 11 | Low | "Rough day?" card (phone) | Three text actions wrap onto two lines. | Readable, but less tidy. | Left as is: shorter labels would lose meaning ("Take today off" against "Light day"). | Open |
| 12 | Low | Native date inputs | Follow the browser locale (for example dd/mm against mm/dd). | A minor inconsistency with the app's own date words. | Left native for accessibility and the phone date pickers. | Open |

Checked and fine as is: Running (one number, two actions); onboarding (one question per step); Pace accuracy bars (semantic colours with a 60% tick); Board density; focus rings (global `:focus-visible`); and reduced motion (a global media block turns off all animations and transitions, including the new hover transitions).

## Design system (as implemented)

All tokens are in `src/index.css`. Change the token there, never inline.

- **Colour.** Neutrals are `bg`, `surface`, `line`, `fg`, `muted` and `faint`. There is one accent: `accent` (#2a5bd7 light, #6b95ff dark), with `accent-soft` for selected and hover fills. Semantic colours are `good`, `warn` and `weak`, used only when they mean something. Accent marks things you can tap or a newly added item, never status text.
- **Type.** Inter Variable. Named steps run from caption-2 (11) to large-title (30), plus display (44) and timer (76). Numbers use `tnum`.
- **Spacing.** An 8-pt grid. Touch targets are at least 44 px (`min-h-11`), and primary buttons are 52 px (`min-h-13`).
- **Radius.** sm 0.375, md 0.75, lg 1 and xl 1.75 rem.
- **Elevation.** `shadow-paper` for cards on the Board, and `shadow-lifted` for anything floating (sheets, a focused note).
- **States.** Every interactive element has a resting, hover (pointer devices only), active (pressed), focus-visible (2 px accent ring), and disabled state. Text links use `hover:opacity-70 active:opacity-60`. Filled controls darken or tint on hover.
- **Motion.** `anim-rise`, `anim-fade` and `anim-sheet` with `--ease-calm`, used only when something changes (plan arrives, task completes, sheet opens). `prefers-reduced-motion` turns all of it off.
- **Keyboard.** `useShortcut(key, run)` for single-key shortcuts. Escape closes any sheet.
