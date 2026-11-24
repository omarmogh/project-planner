# Reference study: Linear, Dropbox, Apple, Stripe (Thooku, November 2026)

## 1. Summary

Four reference sites were captured with Thooku in headless Chromium at 390, 768 and 1440 px: a marketing page and an inner page for each, giving computed styles, motion and focus rules. The goal was to borrow *principles* for Locus, not looks. Priority when they conflict: Linear (usability, keyboard) > Dropbox (identity) > Apple (simplicity, accessibility, motion) > Stripe (polish).

What Locus took:
- From Linear: tight display tracking, quick motion (under 200 ms), single-key shortcuts and visible key hints.
- From Dropbox: warm neutrals instead of cool greys, and a small, confident mark.
- From Apple: 44 px pill actions, a 3 px focus offset, and full respect for reduced motion.
- From Stripe: the out-curve `cubic-bezier(0.25, 1, 0.5, 1)` and restraint with colour.

What it did not take: brand typefaces, brand colours, logos, illustrations, hero layouts and smooth-scroll libraries. These are trade dress or decoration, and section 4b of CLAUDE.md rules decoration out.

## 2. Registry

| Site | Pages captured | Widths | Evidence |
|---|---|---|---|
| Linear | home, inner | 390 / 768 / 1440 | Measured (computed styles), Observed (screenshots) |
| Stripe | home, inner | 390 / 768 / 1440 | Measured, Observed |
| Apple | home, inner | 390 / 768 / 1440 | Measured, Observed |
| Dropbox | home, inner | 390 / 768 / 1440 | Measured, Observed |
| Locus | 8 screens | 390 / 1280, light and dark | Measured, Observed (before and after) |

## 3. Per-site profiles

**Linear.**
- Type: Inter at weight 510. h1 is 64 px at −0.022em. h2 uses two greys.
- Buttons: 32 px pills. Nav items: radius 6 px.
- Motion: 100–160 ms, `cubic-bezier(0.25, 0.46, 0.45, 0.94)`.
- Reduced motion: 49 rules (Measured).
- Focus: a 1 px outline at offset −2 px.
- Keyboard-first product, with shortcut hints shown in the UI (Observed).

**Stripe.**
- Type: a light-weight grotesque, tracking −0.02em.
- Buttons: radius 4 px, heights 40 and 48 px.
- Motion: 240–300 ms, `cubic-bezier(0.25, 1, 0.5, 1)`.
- Focus: a 3 px translucent ring.
- Reduced motion: 0 rules (Measured). This is a gap, so Locus does not follow Stripe here.

**Apple.**
- Body text 17/25, tracking −0.022em. Muted text #6e6e73.
- Pill buttons 44 px high, radius 980 px.
- Motion: 320 ms, `cubic-bezier(0.4, 0, 0.6, 1)`.
- Focus: a 2 px outline at offset 3 px.

**Dropbox.**
- Warm neutrals: rgb(247, 245, 242) surface, rgb(30, 25, 25) text.
- Radius 8 px. Focus: a 3 px box-shadow ring.
- Hover motion around 100 ms. Smooth scrolling through a library (Observed).

## 4. Cross-site matrix

| Attribute | Linear | Stripe | Apple | Dropbox | Locus (after) |
|---|---|---|---|---|---|
| Display tracking | −0.022em | −0.02em | −0.022em | tight | −0.022em |
| Neutral temperature | cool | cool | cool grey | warm | warm |
| Primary action shape | pill 32 px | 4 px radius, 40/48 px | pill 44 px | 8 px radius | 8 px radius, 52 px primary; pills 44 px for secondary |
| Motion duration | 100–160 ms | 240–300 ms | 320 ms | ~100 ms | 180 ms |
| Easing | ease-out-quad | out-quart | ease-in-out | — | `(0.25, 1, 0.5, 1)` |
| Focus | 1 px, −2 offset | 3 px ring | 2 px, +3 offset | 3 px ring | 2 px, +3 offset |
| Reduced-motion rules | 49 | 0 | present | present | global: all off |
| Keyboard shortcuts | yes, hinted | no | no | no | N, S, Space, 1–4, Esc |
| Overflow at 390 px | none | none | none | none | none |

## 5. Patterns

- **Shared:** tight display tracking; one accent; no horizontal overflow on phones; focus visible on every control.
- **Unique:** Linear shows keyboard hints; Dropbox uses warm neutrals; Apple uses 44 px pills.
- **Conflicting:**
  - Motion speed: Linear is quick, Apple is slow. Locus chose 180 ms because it is a daily tool, and Linear ranks first.
  - Focus style: ring against outline. Locus chose an outline at a 3 px offset (Apple), which reads clearly in both themes.

## 6. Unified tokens (Locus, `src/index.css`)

Swatches:

| Token | Light | Dark |
|---|---|---|
| surface | ![](https://placehold.co/64x24/f5f4f1/1c1b1a.png?text=f5f4f1) | ![](https://placehold.co/64x24/1d1c1a/f5f4f1.png?text=1d1c1a) |
| fg | ![](https://placehold.co/64x24/1c1b1a/ffffff.png?text=1c1b1a) | ![](https://placehold.co/64x24/f5f4f1/1c1b1a.png?text=f5f4f1) |
| muted | ![](https://placehold.co/64x24/6c6a65/ffffff.png?text=6c6a65) | ![](https://placehold.co/64x24/9b9892/1c1b1a.png?text=9b9892) |
| line | ![](https://placehold.co/64x24/e8e6e1/1c1b1a.png?text=e8e6e1) | ![](https://placehold.co/64x24/2d2c29/f5f4f1.png?text=2d2c29) |
| accent | ![](https://placehold.co/64x24/2a5bd7/ffffff.png?text=2a5bd7) | ![](https://placehold.co/64x24/6b95ff/1c1b1a.png?text=6b95ff) |

Contrast (Measured):

| Pair | Ratio |
|---|---|
| muted on bg | 5.40 |
| muted on surface | 4.91 |
| dark muted on surface | 5.92 |
| accent on surface | 5.34 |

All pass WCAG AA for body text.

Motion and type tokens:
- `--motion-quick: 180ms`
- `--ease-out: cubic-bezier(0.25, 1, 0.5, 1)`
- `--tracking-display: -0.022em`
- `--tracking-label: 0.06em`
- `--focus-offset: 3px`
- Added in the motion pass (ui-animation skill): `--motion-press: 140ms`, `--ease-enter: cubic-bezier(0.22, 1, 0.36, 1)`, `--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)`, `--vt-dx`. See `docs/DESIGN_AUDIT.md` for where each is used.

## 7. Components

- **Pill** (`src/ui/Pill.tsx`):
  - 44 px, rounded, for secondary choices inside cards.
  - Accent tone for the suggested choice, neutral tone for the alternative.
  - One choice per card stays a plain text link.
- **Wordmark** (`src/ui/Wordmark.tsx`): a ring around a dot (a "locus": a point in place) next to the name.
- **Button:** gained the `.press` scale feedback (0.985 with a mouse, 0.97 on touch).
- **ProgressBar:** a `thin` variant for the Today header.
- **Nav:** sidebar shortcuts 1–4 with `<kbd>` hints. Inactive bottom tabs use `muted` (readable) instead of `faint`.

## 8. Flows

- **Today:**
  1. Open the app.
  2. The selected next task is highlighted.
  3. Press `S` (or Start).
  4. The Running screen opens; `Space` pauses it.
  5. Finish.
  6. Report.
- **Add a commitment:** press `N`, type, then Enter.
- **Desktop:** `1–4` switch tabs without the mouse.

## 9. Dependencies

None added. Thooku and Playwright were used for capture only (scratchpad, not committed).

## 10. Blueprint for the next pass

- Apply the Pill pattern on Pace and Week where text links sit in pairs.
- Consider a `?` sheet listing the shortcuts once there are more than five.
- Native date inputs stay native (accessibility, phone pickers).

## 11. Evidence and unknowns

- Measured: computed styles, durations, easings, contrast ratios, overflow.
- Observed: screenshots at three widths for each site, and before/after for Locus.
- Inferred: the reasons behind each site's choices.
- Unknown:
  - Hover transitions on Linear (home and inner) and on Apple's inner page. The probes timed out.
  - Behaviour behind log-in walls.
