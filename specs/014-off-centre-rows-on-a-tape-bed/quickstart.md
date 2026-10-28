# Quickstart: Off-centre rows on a Tape Bed

1. `npm run test`: domain (fit, validation, snapshot, geometry, Presets) and editor specs green.
2. `npm run e2e`: `e2e/organ-guide-margin.spec.ts` green.
3. By hand (`npm run electron:local`):
   - New Organ → 20er-Drehorgel Preset: Guide margin 10, Border "8.5 mm guide side · 25.35 mm far side".
   - Save, restart: the values are still there.
   - Import a MIDI Song onto a Tape for it; the Tape view shows a narrow top strip and a wide bottom strip.
   - Export SVG; in Inkscape, row 1's hole centres lie 10 mm below the top edge (SC-001).
   - Clear the Guide margin: both Borders 16.93 mm, as before.
4. On the organ (user): cut and play a Tape for the 20er (SC-004).
