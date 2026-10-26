# Implementation Plan: Read a tape as Scores

**Branch**: `012-read-a-tape-as-scores` | **Date**: 2026-10-26 | **Spec**: [spec.md](spec.md) | **Issue**: [#169](https://github.com/LilSticky/crancula/issues/169)

**Input**: Feature specification from `specs/012-read-a-tape-as-scores/spec.md`

## Summary

The Tape view gets a fifth page head action, "Export as Scores". It opens a dialog prefilled with the Song's
Time signature(s) and upbeat (else 4/4, no upbeat) and with split notes for the staves (remembered per Organ in
`localStorage`, else C4 when the Organ has Pipes on both sides). On confirm, a pure domain writer in a new
folder `api/scores/` turns the Tape into one MusicXML 4.0 document: gaps up to the Minimum Gap are closed,
lengths become the fewest note values (longest first, tied over bar lines), Bars follow the chosen or the
Song's Time signatures from Column 0, notes are spread over staves by pitch and over up to four voices (highest
chord in voice 1), spelled in the Song's Key, with a tempo mark from the Crank speed. One new IPC channel,
`scores:save`, shows the save dialog and writes the text, like `plotter:save-svg`. The Tape, Song and Organ are
only read. Details in [research.md](research.md); decision in
[ADR 29](../../documentation/adr/0029-own-musicxml-writer-in-the-domain.md).

## Technical Context

**Language/Version**: TypeScript (strict), Angular 22, Electron (current major, ADR 14)

**Primary Dependencies**: none new; Angular Material (dialog, radio, select, form field, snackbar)

**Storage**: none new in snapshots; the split notes per Organ in `localStorage` key
`crancula.scoresSplitNotes` (ADR 11). The Scores file is written where the user chooses and not kept.

**Testing**: Vitest in node (every `api/scores/` rule, the writer with a round trip through `readScoreSong`
and Bar sums, a golden file, `scores-save-request`, `app/scores-ipc.ts` with fake effects), Vitest in jsdom
(dialog, preference, export flow, page head action), Playwright e2e `e2e/read-a-tape-as-scores.spec.ts`
(save dialog stubbed), `e2e/tape-layout.spec.ts` and `e2e/boundary.spec.ts` updated

**Target Platform**: Electron desktop on Windows, macOS, Linux

**Project Type**: desktop app (Angular renderer, Electron main, shared `api/`)

**Performance Goals**: a 10-minute Tape exported in under 5 s (SC-005); every step is linear after one sort

**Constraints**: every Bar of every staff and voice sums to its length (SC-002); fewest tied values
(SC-003); deterministic output; no path from the renderer (ADR 4); text ≤ 64 × 2²⁰ characters

**Scale/Scope**: ~10 000 Columns, a few thousand Holes, a few hundred Bars, 1–4 staves typically

## Constitution Check

| Principle | Check | Result |
|-----------|-------|--------|
| I. Domain-Driven Slicing | Capability "Read a tape as Scores"; Tape, Hole, Pipe, Song, Scores, Time signature, Bar, Key, Metre, Minimum Gap, Crank speed, Tape per Crank turn, Column are dictionary terms; the Tape entry already says "Can be exported as Scores" (#171). Staff, clef, voice, chord, rest, tie, note value, upbeat, split note are Scores words in prose (spec Assumptions), not new terms | Pass |
| II. TDD | Each `api/scores/` rule starts with a failing test from the spec's reference cases; UI and IPC likewise | Pass |
| III. Framework-Free Domain | All rules and the writer in `api/scores/`; the renderer only asks and shows; main only saves | Pass |
| IV. Memory First | Nothing stored; Tape, Song, Organ read from memory; the split notes are a UI preference (ADR 11) | Pass |
| V. Strict Electron Boundary | One allow-listed channel `scores:save`, payload parsed with `parseScoresSaveRequest` in main; no path from the renderer | Pass |
| VI. Context Never Gets Lost | ADR 29; STATUS and ROADMAP at the end of the slice; DICTIONARY needs no change | Pass |
| VII. Small Vertical Slices | US1 + US2 export with the prefill (P1); US3 staves and US4 Time signature build on the dialog; US5 i18n | Pass |

Post-design re-check: unchanged, pass. No new dependency.

## Project Structure

### Documentation (this feature)

```text
specs/012-read-a-tape-as-scores/
├── spec.md, open-questions.md, plan.md, research.md, data-model.md, quickstart.md
├── contracts/musicxml-output.md, contracts/scores-ipc.md, contracts/scores-export-ui.md
└── tasks.md (next: /speckit-tasks)
```

### Source Code (repository root)

```text
api/scores/
├── scores-choices.ts             # ScoresChoices(Input), validateScoresChoices, prefilledScoresChoices
├── close-gaps.ts                 # minimumGapColumns, closeGaps → ScoresNote (R6)
├── scores-bars.ts                # Bars from Time signatures, upbeat, Keys; songKeepsBarsOnColumns (R3, R4)
├── scores-staves.ts              # staves from split notes, staffOf, clefs and ledger lines (R9)
├── voices.ts                     # chords, assignVoices, voice-4 overflow (R8)
├── note-values.ts                # noteValues: fewest values, longest first (R7)
├── spell.ts                      # spell(pitch, fifths) (R5)
├── scores-tempo.ts               # scoresTempo (FR-013)
├── scores-file-name.ts           # scoresFileName
├── scores-musicxml.ts            # scoresMusicXml: the writer (R1, contracts/musicxml-output.md)
└── scores.reference.musicxml     # golden file of the reference Tape
api/app/
├── scores-save-request.ts        # ScoresSaveRequest/Result, parseScoresSaveRequest (R13)
├── svg-save-request.ts           # isSafeSvgFileName → isSafeFileName(name, extension); shared limits
└── crancula-api.ts               # + scores.save
api/index.ts                      # exports the above
app/
├── scores-ipc.ts                 # SCORES_CHANNELS scores:save, registerScoresHandlers
├── preload.ts                    # + scores.save
└── main.ts                       # wires the handler with dialog and fs effects
src/app/core/crancula-api.token.ts # in-memory scores.save for dev and tests
src/app/features/tape/tape-view/
├── scores-export/
│   ├── scores-export-dialog.component.ts   # Time signature, upbeat, staves (R11)
│   ├── scores-export.ts                    # flow: dialog → writer → save → snackbar
│   └── scores-staves-preference.ts         # split notes per Organ in localStorage (R12)
└── tape-view.component.{ts,html}  # + "Export as Scores" action; breakpoints rechecked (R14)
src/assets/i18n/{en,de}.json      # TAPE.VIEW.EXPORT_SCORES, TAPE.SCORES.*
e2e/read-a-tape-as-scores.spec.ts, e2e/tape-layout.spec.ts, e2e/boundary.spec.ts (+ scores key)
```

**Structure Decision**: Scores writing is its own domain folder `api/scores/`, next to the reader in
`api/song/musicxml/`, because it reads a Tape, an Organ and a Song together and belongs to none of them. The
UI sits beside `plotter-export.ts` in the Tape view, as its sibling export.

## Decisions left open by the spec

- **Voice assignment**: chords by start, highest first, into the lowest free of four voices; overflow cut into
  tied pieces in voice 4 (R8).
- **Order inside a tie**: longest value first (R7).
- **Beaming, line breaks, accidentals shown**: left to the notation program; no `<beam>`, `<print>` or
  `<accidental>` (R5, R10).
- **Upbeat entry**: a count of a note value (e.g. 1 × 1/4), as the Metre shows it (R11).
- **Off-key spelling**: in-key notes as the scale spells them; others sharps, or flats in a key with flats (R5).
- **Key changes**: all of the Song's, each from the start of the Bar holding it; C major before the first (R4).
- **Song Time signatures not on Columns** (beat type 64, odd beats): treated as none, with a hint (R3; user-approved 2026-10-26, FR-004).
- **MIDI 0–11**: written an octave up at octave 0, MusicXML has no octave −1 (R5; user-approved 2026-10-26, FR-007).
- **Octave clef rule made countable**: ≥ 3 fewer ledger lines for more than half of the staff's notes (R9).
- **File layout**: pure writer in `api/scores/` (ADR 2, ADR 29); one IPC channel `scores:save` (R13).
- **Command placement**: fifth page head action; compact breakpoints raised if needed (R14).

## Open questions

None for the user. The hand check in MuseScore (quickstart) may show that octave clefs, accidentals or beaming
need a follow-up; that would be an issue, not a change of scope.

## Complexity Tracking

| Item | Why needed | Simpler alternative rejected because |
|------|------------|--------------------------------------|
| New channel `scores:save` | Save dialog with a `.musicxml` filter and its own last folder (FR-002, FR-003) | Reusing `plotter:save-svg` mixes two formats' validation; a write-to-path channel breaks ADR 4 |
| Voice-4 overflow rule | Every Hole must be written (FR-007) with at most four voices (FR-012) | Refusing or dropping notes breaks FR-007 |
