# Quickstart: Read a tape as Scores

How to prove the slice works. Types and rules: [data-model.md](data-model.md); file, IPC and UI:
[contracts/](contracts/).

## Automated

| What | Command | Shows |
|------|---------|-------|
| Gap closing, Bars, Keys, staves and clefs, voices, note values, spelling, tempo, file name, choices and prefill, the writer (round trip through `readScoreSong`, Bar sums, golden file, determinism, input unchanged), the save request parser, the `scores:save` handler with fake effects | `npm run test:node` | Stories 1–4 in the domain and main; SC-002, SC-003, SC-005, SC-006 |
| Export dialog, staves preference, export flow (cancel, saved, failed, retry), page head action, en/de | `npm run test`, `npm run i18n:check` | Stories 1, 3, 4, 5 in the UI; SC-007 |
| Export a Tape brought from a 3/4 MusicXML Score with an upbeat in G major; change the Time signature; pick three staves and see them prefilled for the next Tape of that Organ; export while the Preview plays; cancel both dialogs | `npm run e2e` (`e2e/read-a-tape-as-scores.spec.ts`, save dialog stubbed in main) | Stories 1, 3, 4 in real Electron; FR-017 |
| Page head in one row at 1180 px (en) and 1440 px (de), icon-only below | `npm run e2e` (`e2e/tape-layout.spec.ts`) | research R14 |
| Boundary keys | `npm run e2e` (`e2e/boundary.spec.ts`) | ADR 4 allow-list with `scores` |
| Lint | `npm run lint` | |

## Reference cases (from the spec)

- **Bars** (Story 1.3): Song 3/4, upbeat 1 quarter, G major → Bar 0 Columns 0–7, then 24 Columns each;
  `<fifths>1</fifths>`.
- **Time signature change** (Story 1.4): 4/4 at Tick 0, 3/4 at Tick 3840, 480 per quarter → two Bars of 32
  Columns, 3/4 from Column 64.
- **Chosen** (Story 4.2): 6/8, upbeat 1 × 1/8 → first Bar 4 Columns, then 24.
- **Tempo** (Story 1.5): Tape per Crank turn 100 mm, Column length 5 mm, Crank speed 60 → 150. Without Tape
  per Crank turn: no `<direction>`.
- **Pitch** (Story 1.6): Pipe 67 → `G`, octave 4, whatever the Transposition.
- **Gap closing and values** (Story 2, Minimum Gap 2 mm, Column length 3 mm → 1 Column, 4/4): 7 + gap 1 →
  quarter, no rest; 7 + gap 2 → dotted eighth tied to 1/32, then sixteenth rest; 12 → dotted quarter; 3 →
  dotted sixteenth; 5 → eighth tied to 1/32; start 24 length 16 → quarter tied over the bar line to a quarter.
- **Chords and voices** (Story 2.6–7): two Holes same start and length → one `<chord/>`; a held lower note
  under moving higher ones → voice 2, stems down; voice 1 stems up.
- **Staves** (Story 3): Organ with Pipes on both sides of C4 → two staves split at 60; all Pipes ≥ 60 → one
  treble staff; a Hole on a Pipe not on the Organ → ordinary note on its staff.
- **Spelling** (Edge Cases): F major, MIDI 70 → B♭ (`<alter>-1</alter>`); C major, MIDI 70 → A♯.
- **Empty Tape**: every Bar of every staff is `<rest measure="yes"/>`.
- **Invalid choices** (Story 4.3): beats 0, beats 2.5, upbeat as long as the Bar → violations, Export
  disabled.

## By hand (needs the user, not in CI)

1. `npm run electron:local`, open a Tape brought from a MusicXML Score in 3/4 with an upbeat (slice 010),
   choose "Export as Scores", keep the prefill, save.
2. Open the file in MuseScore 4: no import warning; Bars, upbeat, key signature, tempo mark, clefs; voices with
   stems up and down where notes overlap; ties over bar lines; an octave clef staff shows its notes at the
   right pitch (research R9); accidentals shown sensibly (research R5); beaming acceptable (research R10).
3. Play it in MuseScore next to Crancula's Preview: same notes and tempo (SC-004).
4. Note in STATUS what was checked; open an issue for anything off.
