# UX review: Read a tape as Scores (2026-10-27)

Screens already captured in `documentation/design/screens/current/` (1280×800, the Octave organ, C4–C6, Tape
"Waltz" from a Song in 3/4, G major, upbeat 1/4): `29-tape-view-export-menu` (+ `-dark`, `-german`),
`30-scores-export-song`, `30b-scores-export-without-song`, `30c-scores-export-invalid`,
`30d-scores-export-three-staves` (each + `-dark`, `-german`). Contrast measured on the PNG pixels (WCAG relative
luminance). Not captured: the `SPLIT_NOTES` error (two equal split notes), the `SONG_METRE_NOT_ON_COLUMNS` hint,
the saved / failed snackbars.

| H1 | H2 | H3 | H4 | H5 | H6 | H7 | H8 | H9 | H10 | Total |
|----|----|----|----|----|----|----|----|----|-----|-------|
| 4  | 4  | 4  | 3  | 3  | 4  | 4  | 4  | 4  | 5   | 39/50 |

H6 is scored on whether the Tape stays the centre: the dialog is modal and compact, the Tape stays visible
behind it, and the page head keeps four actions.

## Measured contrast

| Element | Light | Dark |
|---------|-------|------|
| `mat-error` text vs. dialog surface | 6.26:1 | 8.37:1 |
| Staff lines, section labels (secondary text) | 6.34:1 | 8.93:1 |
| Menu items | 14.8:1 | – |
| Outlined field border (idle) vs. dialog surface | **2.36:1** | 4.51:1 |

## Findings

### Must

1. **[sev 3] H4/H5 · 30, 30b, 30c, 30d (all schemes, en/de)**: the staff lines show MIDI extremes, not the
   Organ: "Staff 1: C-1 to G9, treble clef" for an Organ whose Pipes span C4–C6, and in 30d "Staff 2: C3 to
   B3, bass clef" and "Staff 3: C-1 to B2, bass clef" hold no Pipe of this Organ at all, yet nothing says so and
   Export stays enabled. The organ owner can't tell which Pipes land on which staff, and exports empty staves
   by accident. Fix (`ScoresExportDialogComponent` template, `TAPE.SCORES.STAFF` en/de): clip each range to the
   Organ's Pipes and count them ("Staff 1: C4 to C6, 25 Pipes, treble clef"); for a staff with no Pipe show
   "Staff 3: no Pipes, stays empty" with a `warning` icon in the error colour (a new key
   `TAPE.SCORES.STAFF_EMPTY`), so the meaning does not rest on colour. Whether an empty staff blocks Export
   is a spec question; at minimum warn.

### Should

2. **[sev 2] H4/H5 · 30c (en/de/dark) vs. 30b**: with "Another one" chosen, Beats and Beat type sit side by side
   in 30b but stack in 30c (Beats widens to ~300 px, Beat type drops below), so the dialog grows ~130 px and
   fields move under the pointer once an error appears. Fix (dialog SCSS): one two-column grid
   (`grid-template-columns: 1fr 1fr; gap: 8px 12px`) for Beats/Beat type exactly as for the Upbeat row, and
   `subscriptSizing="dynamic"` on all fields so an error adds only its own line.
3. **[sev 2] H4 · 30c, 30d (all)**: the split note fields are stacked with no gap; the second "Split note"
   floating label sits on the first field's bottom border (same defect as finding 6 of the 011 review), and the
   rows don't say which staff they start. Fix: 8 px row gap, and merge the two lists into one row per staff
   ("Staff 1 from [C4 ▾] … treble clef, 25 Pipes  [x]"), highest on top, the lowest staff shown as a
   read-only "Staff 3 down to the lowest Pipe" row; then "Staff N" lines and split-note selects no longer need
   to be matched by eye.
4. **[sev 2] H7/H8 · 30c, 30d German**: "Remove this split note" / "Diesen Teilungston entfernen" is a ~200 px
   text button repeated per row, while the app uses icon buttons for row removal elsewhere. Fix:
   `mat-icon-button` with `close` (or `delete`) icon, `aria-label` and `matTooltip` from
   `TAPE.SCORES.SPLIT_REMOVE` with the note ("Remove split note C3"); 40 px target.
5. **[sev 2] H2/H7 · 30, 30b (all)**: "Add a split note" is a bare text button directly under the "Staves"
   heading; without an icon or outline it reads as a sub-heading, not an action. Fix: `mat-stroked-button` (or
   text button) with an `add` icon, placed after the last split-note row and before the staff lines.
6. **[sev 2] H1/H7 · 30–30d (all)**: the dialog title "Scores" / "Noten" names a thing, while the menu item says
   "Export as Scores" and the confirm button "Export". Fix (`TAPE.SCORES.TITLE`): "Export as Scores" / "Als Noten
   exportieren", so the action keeps one name through the flow.
7. **[sev 2] H5/H2 · 30, 30d**: the dialog doesn't show what comes from elsewhere: the Key (G major) and the
   tempo mark from the Crank speed are silent, so the user can't check them before saving a file. Fix: one
   read-only summary line under the title, e.g. "Waltz, G major, tempo from the Crank speed: ♩ = 96" (key
   `TAPE.SCORES.SUMMARY`), using the same metre wording as the side panel's "Metre" row.

### Nits

8. **[sev 1] H7 · 30c German**: "Gib eine ganze Zahl von Schlägen von 1 bis 99 ein." repeats "von". Fix
   (`TAPE.SCORES.ERROR.BEATS` de): "Gib eine ganze Zahl von 1 bis 99 ein."
9. **[sev 1] H4 · 30c (all)**: the radio "Another one" / "Andere" is vague out of context (screen readers read
   it alone). Fix: "Another time signature" / "Andere Taktart".
10. **[sev 1] H8 · all dialogs, light**: the idle outlined-field border is 2.36:1 against the dialog surface
    (needs 3:1 for a UI part); dark passes at 4.51:1. App-wide theme token, not this slice: raise
    `outline` for light in `src/styles.scss` (`mat.form-field-overrides`, `outlined-outline-color`) in a
    separate issue. Also capture the missing states (equal split notes, metre-not-on-Columns hint, saved and
    failed snackbars) in `npm run ux:screens`.

## Strengths

- One Export menu keeps the page head at four actions; German fits as icons at 1280 px (29-german), and the
  scissors / `queue_music` icons tell the two exports apart without reading.
- Prefilled from the Song ("As in the Song: 3/4", upbeat 1 × Quarter): the user can export with one click.
- Errors are specific, in plain words, placed under their field, with a red outline as a second cue; Export
  is disabled while they show. Contrast passes in both schemes.
- Dictionary terms are used throughout (Song/Stück, Scores/Noten, Taktart, Auftakt); German text fits without
  clipping in every dialog state.
