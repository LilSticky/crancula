# Quickstart: Cut several tapes side by side

How to prove the slice works. Types and rules: [data-model.md](data-model.md); boundaries and UI:
[contracts/](contracts/).

Reference: Organ A (tape width 100 mm, Lead-in 50 mm, Minimum Gap 2 mm) with the reference Tape (200 Columns
of 3 mm, 652 mm); Organ B (tape width 60 mm) with "Waltz" (400 mm); roll plotter "Vinyl cutter", working width
300 mm, Tape spacing 3 mm.

## Automated

| What | Command | Shows |
|------|---------|-------|
| Tape spacing rule and draft, snapshot v1 → v2, `sideBySideCut`, `laneRoom`, `laneGeometry`, `sideBySideSvg`, file name, refusals | `npm run test:node` | Stories 1–5 in the domain; SC-002, SC-003, SC-004 |
| Tape list ticks, side-by-side page (picker, Lanes, add menu, drawing, save flow), Plotter editor field, en/de | `npm run test`, `npm run i18n:check` | Stories 2, 3, 5, 6 in the UI; SC-005, SC-006 |
| Tick, arrange, save and read the file; Tape spacing after restart | `npm run e2e` (`e2e/side-by-side.spec.ts`) | Stories 1, 4 in real Electron |
| Lint | `npm run lint` | |

## Scenarios (domain and component tests)

1. **Two Lanes** (Story 1.1): reference Tape then Waltz → `usedWidth` 163, `length` 652, Lane 1 top 0, Lane 2
   top 103; SVG `width="652mm" height="163mm"`; Lane 2 Outline from y 103 to 163.
2. **Lane equals single export** (Story 1.2, SC-002): every Slot and Outline corner of `laneGeometry(lane 2)`
   equals Waltz's `tapeGeometry` with `y + 103`.
3. **Order in the file** (Story 1.3): Lane 1 Holes, Lane 1 Outline, Lane 2 Holes, Lane 2 Outline.
4. **File name** (Story 1.4): two Lanes → "Reference and 1 more.svg"; German "Reference und 1 weitere.svg";
   one Lane → "Reference.svg"; "a/b" → "a_b and 1 more.svg".
5. **Free width** (Story 2.1–2.2): reference alone → free 200; + Waltz → 137; + reference again → needed 103,
   fits, free 34; a fourth 100 mm Tape → `laneRoom` `{fits: false, needed: 103, free: 34}`, add menu entry
   disabled with "needs 103 mm, only 34 mm free".
6. **Exact fit**: Lanes summing to exactly 300 mm with spacings fit (1e-9 tolerance).
7. **Move and remove** (Story 2.4): moving Waltz up gives Waltz top 0, reference top 63; free width unchanged
   at 137; removing renumbers.
8. **One Lane** (Story 2.5): `sideBySideSvg` byte-identical to `plotterSvg(tapeGeometry(...))` and the fixture.
9. **Cutting Problem** (Story 3.1–3.2): Waltz with a Hole below the Minimum Hole Length → refusal
   `cutting-problems` naming "Waltz", Lane marked; Waltz twice → named once; Save opens no save dialog.
10. **No Organ** (Story 3.3): Tape without Organ disabled in the Tape list and add menu with "has no Organ".
11. **Too wide alone** (Story 3.4): a 320 mm Tape on the 300 mm roll can't be added (needed 320, free 300).
12. **Tape spacing** (Story 4): 5 mm → Waltz 105–165; 0 valid; −1 and "abc" refused naming the field; a sheet
    Plotter has no field; a v1 snapshot roll plotter reads with 3 mm; written as v2.
13. **Roll plotters only** (Story 5): picker lists only roll plotters; the Tape view's roll pick is chosen
    first; none → "Describe a Plotter…"; switching to a 150 mm roll plotter marks Waltz's Lane as not fitting
    and Save is refused naming it.
14. **German** (Story 6): page, refusals and file name in German.

## End to end (`e2e/side-by-side.spec.ts`)

- Describe both Organs and the Vinyl cutter, create both Tapes, tick the reference Tape then Waltz, choose
  "Cut side by side", stub the save dialog (`e2e/support/save-dialog.ts`) with a temporary path, Save, read
  the file: `width="652mm" height="163mm"`, two Tape Outlines; the snackbar names the path.
- Set the Vinyl cutter's Tape spacing to 5 mm, restart, the field shows 5.

## By hand (once before merging)

1. `npm run electron:local`; describe a roll plotter "Vinyl cutter" 300 mm; Tape spacing shows 3.
2. Tick two Tapes in the Tape list, Cut side by side: drawing to scale, free width, add the first Tape again,
   try a third, see it disabled with the needed and free width.
3. Save, open the file in Inkscape: true size, Lanes 3 mm apart, each Lead-in tip at the left edge.
4. Switch to German and repeat 2: all texts and the proposed file name German.
