# UX review: running app, screens/current (2026-10-16)

Previous: 33/50 (after #63), 30/50 (after #62), 29/50 (before #62)

| H1 | H2 | H3 | H4 | H5 | H6 | H7 | H8 | H9 | H10 | Total |
|----|----|----|----|----|----|----|----|----|-----|-------|
| 4  | 3  | 4  | 3  | 4  | 2  | 4  | 3  | 4  | 5   | 36/50 |

After #64 (Organ editor on one screen: Tape Bed and Pipes side by side, Pipe rack in two scrolling columns, sticky action bar with save state, error summary, Delete in the page head). Density (H3) gains two points: the editor no longer scrolls the page, at 1280x800 and at 1024x700 (13). Feedback (H5) gains one: pressing Save lists the problems (03), the bar names the unsaved fields (04b) and the leave dialog (03b) is calm and clear. Tape view (#65), lists (#66) and Tape import (#69) are not restyled yet.

## Findings
1. **[sev 3] H6 · 08-tape-view, 11-tape-view-dark** - The Tape is still small and sits under a text block and a bullet list, with no millimetre scale, Column numbers or Organ name and export in the page head. Fix: make the Tape the visual centre, scaled to true mm with a ruler, put the Organ and actions in the head. Tag: #65.
2. **[sev 2] H4 · 03, 04, 13** - The floating labels of the 31 MIDI note fields are cut by the field above (the label sits on the row border), and in 03 the empty fields' labels run into the "mm" suffix ("Spacing betwee mm", "Hole diameter mm"). At 1024 px "Spacing between r" and "Minimum Hole Ler" are truncated (13). Fix: shorter or wrapping labels, label-less MIDI note fields with the column header as label (aria-label kept), more row height. Tag: new (follow-up to #64).
3. **[sev 2] H4 · 10-organ-editor-german** - The Pipe rack header runs together ("ReiheMIDI-Note", "Reihe" touches the next column), and the lingering snackbar text "Organ saved" is English in the German UI (also visible in 04b as a stale "Organ saved" while changes are unsaved). Fix: translate the snackbar, dismiss it on the next edit, pad the header cells. Tag: new.
4. **[sev 2] H2 · 02-organ-list-empty, 06-tape-list-empty** - Empty states are one grey line; no guided first step. Tag: #66.
5. **[sev 2] H7 · 05-organ-list, 09-tape-list** - Lists are plain rows with bare icons and unlabelled facts. Tag: #66.
6. **[sev 2] H8 · 12-organ-list-compact, 13-organ-editor-compact** - The compact rail has icon-only nav and stacked toggles without visible labels; the disabled Save in 13 and the "Saved on this computer" note are low contrast. Fix: tooltips and aria-labels, 4.5:1 for informative disabled text. Tag: new.
7. **[sev 2] H2 · 07-tape-import** - The chosen file is not shown as a chip, "Use proposal" is unexplained and the fit result is a plain list without a warning state. Tag: #69.
8. **[sev 1] H3 · 13-organ-editor-compact** - At 1024x700 the second rack column is clipped at the right edge and needs a horizontal scrollbar; the Pipes sheet shows only 8 rows. Fix: one column below a width threshold or narrower note fields. Tag: new.

## Strengths
- The editor fits one screen: Tape Bed (fields in a two-column grid, fit sentence, drawing) left, scrolling Pipe rack right, action bar always in view (H3).
- Error summary after Save (03) with one link per problem, matching inline errors and a bar that says how many problems block saving (H5, H9).
- Save state is honest: "No unsaved changes" with Save disabled, a dot and the changed field names when dirty (04b), Discard changes next to Save.
- The leave dialog (03b) has a clear primary (Keep editing), lists each problem with its field and now has the same wording as the summary.
- Note names (F3, F#3) with sharps dimmed make the rack scannable; German (10) shows locale decimals everywhere ("2,5", "6,25").
- The walnut rail, serif titles and dark scheme from #63 stay consistent (H1, H7, H9); plain Material with tokens keeps the rest feasible (H10).
