---

description: "Tasks for 012 Read a tape as Scores"
---

# Tasks: Read a tape as Scores

**Input**: Design documents from `/specs/012-read-a-tape-as-scores/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/musicxml-output.md](contracts/musicxml-output.md),
[contracts/scores-ipc.md](contracts/scores-ipc.md), [contracts/scores-export-ui.md](contracts/scores-export-ui.md),
[quickstart.md](quickstart.md), [ADR 29](../../documentation/adr/0029-own-musicxml-writer-in-the-domain.md)

**Tests**: TDD is mandatory (constitution, principle II). Every Green task follows a Red task that must fail for
the expected reason first (`tdd` skill). **Red** tasks go to the `test-first` agent, **Green** tasks to
`implementer`. Test pyramid: Node Vitest (`npm run test:node`) for everything in `api/` and `app/`; `ng test`
(jsdom) for `src/`; Playwright e2e only for what needs real Electron (the native save dialog stubbed in main,
the file on disk, the page head at real widths, the preload allow-list).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1–US5 from spec.md; only in story phases
- **Red / Green**: a Red task writes only the failing test (`test-first`); its Green task makes it pass and
  refactors (`implementer`)
- **Commits**: one small conventional commit per Red+Green pair on `012-read-a-tape-as-scores`. Update
  `documentation/STATUS.md` at each checkpoint.
- **Reference data**: build Tapes and Organs with `api/tape/tape-fixture.ts` (`tapeOf`, `referenceOrgan`);
  Songs with `song(...)` from `api/song/song.ts`. Story 2 Organ: Minimum Gap 2 mm; Tape Column length 3 mm
  (Minimum Gap = 1 Column), 4/4 (32 Columns per Bar).

## Phase 1: Setup

- [ ] T001 Add the keys of [contracts/scores-export-ui.md](contracts/scores-export-ui.md) and
  [contracts/scores-ipc.md](contracts/scores-ipc.md) with en and de texts to `src/assets/i18n/en.json` and
  `de.json`: `TAPE.VIEW.EXPORT_SCORES` ("Export as Scores" / "Als Noten exportieren"), `TAPE.SCORES.TITLE`,
  `TIME_SIGNATURE` ("Time signature" / "Taktart"), `TIME_SONG` ("As in the Song: {{metre}}" / "Wie im Stück:
  {{metre}}"), `TIME_OTHER`, `BEATS`, `BEAT_TYPE`, `UPBEAT` ("Upbeat" / "Auftakt"), `UPBEAT_COUNT`,
  `UPBEAT_VALUE`, `NOTE_VALUE.{1,2,4,8,16,32}`, `STAVES`, `SPLIT_NOTE`, `SPLIT_ADD`, `SPLIT_REMOVE`, `STAFF`,
  `CLEF.{TREBLE,TREBLE_8VA,BASS,BASS_8VB}`, `SONG_METRE_NOT_ON_COLUMNS`, `ERROR.{BEATS,BEAT_TYPE,UPBEAT,UPBEAT_TOO_LONG,SPLIT_NOTES}`,
  `CONFIRM`, `CANCEL`, `DIALOG_TITLE`, `FILTER_NAME` ("MusicXML file" / "MusicXML-Datei"), `SAVED`
  ("Saved: {{name}}"), `FAILED` (with `{{reason}}`), `RETRY`. German uses Noten, Taktart, Takt, Tonart,
  Stück (DICTIONARY). `npm run i18n:check` green. (`implementer`, no test: data only)

## Phase 2: Foundational

Blocks every story: the parts of the writer that every Scores file needs.

- [ ] T002 [P] Red: `api/scores/note-values.spec.ts`: `noteValues(n)` gives the fewest values from {48 dotted
  whole, 32 whole, 24 dotted half, 16 half, 12 dotted quarter, 8 quarter, 6 dotted eighth, 4 eighth, 3 dotted
  16th, 2 16th, 1 32nd}, longest first: 8 → quarter; 12 → dotted quarter; 3 → dotted 16th; 5 → eighth + 32nd;
  7 → dotted eighth + 32nd; every n 1–200 sums to n and its count equals a brute-force minimum (FR-009, R7).
- [ ] T003 Green: `api/scores/note-values.ts` (`NoteType`, `NoteValue`, `noteValues`, dynamic programme);
  export from `api/index.ts`.
- [ ] T004 [P] Red: `api/scores/spell.spec.ts`: `spell(pitch, fifths)` → C major 60 C4, 61 C♯4, 70 A♯4; G
  major 66 F♯4; F major 70 B♭4, 66 G♭4 (off-key flats when fifths < 0); C♯ major 65 E♯4 and 60 B♯3; C♭ major
  59 C♭4; every pitch 12–127 spelled back to its MIDI number; MIDI 0–11 written one octave up at octave 0, and
  a B♯ that would land in octave −1 spelled C (FR-007, FR-014, R5).
- [ ] T005 Green: `api/scores/spell.ts` (`Step`, `Spelling`, `spell`); export.
- [ ] T006 [P] Red: `api/scores/voices.spec.ts`: `assignVoices(staff, notes)`: same start and length → one
  chord, pitches ascending; a held low note under moving higher notes → the higher chords in voice 1, the held
  note in voice 2; chords in one voice never overlap; five overlapping layers → the fifth goes into voice 4,
  whose chords are then cut into tied pieces at every start and end so none overlap (FR-012, R8).
- [ ] T007 Green: `api/scores/voices.ts` (`VoiceNumber`, `Chord`, `StaffVoices`, `assignVoices`); export.
- [ ] T008 [P] Red: `api/scores/scores-bars.spec.ts` (Bars only, Keys follow in T016): one Time signature
  `{beats, beatType}` from Column 0 over `tape.length`, with an upbeat in Columns: 4/4 over 70 Columns → Bars at
  0, 32, 64, the last full (32); 6/8 with upbeat 4 → 0–3, then 24 each, Bar numbers 0, 1, 2… (Story 4.2, FR-011);
  a Bar of `beats × 32 / beatType` Columns.
- [ ] T009 Green: `api/scores/scores-bars.ts` (`Bar`, `scoresBars` for one chosen Time signature); export.

**Checkpoint**: `npm run test:node` green; commit; STATUS.

## Phase 3: User Story 1 - Export my tape as Scores (P1) 🎯 MVP

**Goal**: "Export as Scores" writes one MusicXML file with Bars from the Song, its Key, a tempo mark and the
Pipes' pitches, through the save dialog; the Tape stays as it was.

**Independent Test**: export a reference Tape from a Song in 3/4 with an upbeat of one quarter and G major; read
the file back and compare Bars, pitches, key and tempo mark.

### Domain

- [ ] T010 [P] [US1] Red: `api/scores/scores-tempo.spec.ts`: Tape per Crank turn 100 mm, Column length 5 mm,
  Crank speed 60 → 150 (Story 1.5); rounded to nearest; at least 1; `undefined` without Tape per Crank turn
  (FR-013). `api/scores/scores-file-name.spec.ts`: "Waltz" → "Waltz.musicxml"; forbidden characters replaced as
  in `safeFileName`.
- [ ] T011 [US1] Green: `api/scores/scores-tempo.ts`, `api/scores/scores-file-name.ts`; export.
- [ ] T012 [P] [US1] Red: extend `api/scores/scores-bars.spec.ts` with `'song'` Time signatures: Song 3/4 at
  Tick 0 with upbeat of one quarter → Bar 0 Columns 0–7, then 24 each (Story 1.3); 4/4 at Tick 0 and 3/4 at Tick
  3840 at 480 per quarter → two 4/4 Bars, 3/4 from Column 64 (Story 1.4); a change inside a Bar ends that Bar
  short; two changes on one Column → the later wins; before a first Time signature after Tick 0 → 4/4; Tick
  between Columns lies on `columnOfTick`; `songKeepsBarsOnColumns` false for 3/64 (R3).
- [ ] T013 [US1] Green: `'song'` in `api/scores/scores-bars.ts`, `songKeepsBarsOnColumns`.
- [ ] T014 [P] [US1] Red: `api/scores/scores-choices.spec.ts` (prefill only): `prefilledScoresChoices(organ,
  song, remembered)`: Song 3/4 with upbeat 1/4 → `'song'`, upbeat 1 × 1/4; Song keeping none, a 3/64 Song or no
  Song → 4/4, upbeat 0; split notes `[60]` when the Organ has Pipes below 60 and at or above, else `[]`;
  remembered split notes win (FR-004, FR-005).
- [ ] T015 [US1] Green: `api/scores/scores-choices.ts` (`ScoresBeatType`, `ChosenTimeSignature`,
  `ScoresChoices`, `ScoresChoicesInput`, `prefilledScoresChoices`, a `toScoresChoices` for valid input); export.
- [ ] T016 [P] [US1] Red: Keys in `api/scores/scores-bars.spec.ts`: Song G major at Tick 0 → every Bar fifths 1;
  a Key change mid-Bar applies from that Bar's start; two Keys in one Bar → the later; no Song or no Keys → C
  major; `showsKey`/`showsTimeSignature` true on the first Bar and on changes only (FR-014, R4).
- [ ] T017 [US1] Green: Keys in `api/scores/scores-bars.ts`.
- [ ] T018 [P] [US1] Red: `api/scores/scores-staves.spec.ts` (plain clefs): `scoresStaves([], …)` one staff;
  `[60]` two staves, top `from 60`, bottom `below 60`; every pitch 0–127 on exactly one staff (`staffOf`); clef
  treble when the middle of the staff's Organ Pipes is ≥ 60, else bass; no Pipe → middle of its notes; neither →
  by its range bound (FR-005, FR-006, R9).
- [ ] T019 [US1] Green: `api/scores/scores-staves.ts` (`Clef`, `Staff`, `scoresStaves`, `staffOf`, plain clefs);
  export.
- [ ] T020 [P] [US1] Red: `api/scores/scores-musicxml.spec.ts`: `scoresMusicXml` for the Story 1.3 Tape writes
  the document of [contracts/musicxml-output.md](contracts/musicxml-output.md): DOCTYPE 4.0, `<work-title>` the
  Tape's name XML-escaped (FR-015), `<divisions>8`, `<key><fifths>1`, `<time>3/4`, `measure number="0"
  implicit="yes"`, metronome quarter = 150 and `<sound tempo>` (none without Tape per Crank turn), Pipe 67 → G4
  whatever the Transposition (Story 1.6); every voice stream of every measure sums to its Bar (parsed with
  `parseXml`); read back with `readScoreSong` → one Part per staff whose Notes equal the Holes; an empty Tape →
  only `<rest measure="yes"/>`; same input → same text; Tape, Song and Organ deep-equal before and after
  (FR-017, SC-006); Holes whose Pipe is not on the Organ are ordinary notes (FR-007); golden file
  `api/scores/scores.reference.musicxml`.
- [ ] T021 [US1] Green: `api/scores/scores-musicxml.ts` (`ScoresInput`, `scoresMusicXml`; staves, `<backup>`,
  voice numbers `(staff − 1) × 4 + voice`, stems only in Bars with more than one voice, ties and `<tied>`,
  chords, rests, whole-bar rests); record the golden file; export.

### Boundary

- [ ] T022 [P] [US1] Red: `api/app/scores-save-request.spec.ts`: `parseScoresSaveRequest` rejects a non-object,
  an extra or missing field, a non-string, a file name failing `isSafeFileName(name, 'musicxml')` (not
  `.musicxml`, device name, forbidden character, < 5 or > 255 characters), a text over 64 × 2²⁰ characters or
  without `<?xml` and `<score-partwise`, a label failing `isLabel`; accepts a valid request. Existing
  `svg-save-request.spec.ts` stays green with `isSafeFileName(name, 'svg')`.
- [ ] T023 [US1] Green: `api/app/scores-save-request.ts`; generalise `isSafeSvgFileName` to
  `isSafeFileName(name, extension)` and share the length limit in `api/app/svg-save-request.ts`; `scores.save`
  in `api/app/crancula-api.ts`; export.
- [ ] T024 [P] [US1] Red: `app/scores-ipc.spec.ts` with fake effects: rejected payload → no dialog; no window →
  rejected; cancel → nothing written; saved → exact text at the chosen path, filter `['musicxml']`,
  `showOverwriteConfirmation`, default path in Documents with the suggested name; write error → `failed` with the
  code; the next save starts in the last folder (FR-002, FR-003, FR-018).
- [ ] T025 [US1] Green: `app/scores-ipc.ts` (`SCORES_CHANNELS`, `ScoresEffects`, `registerScoresHandlers`);
  wire in `app/main.ts` with `dialog.showSaveDialog` looked up at call time; `scores.save` in `app/preload.ts`;
  in-memory `scores.save` with a failure switch in `src/app/core/crancula-api.token.ts`.

### UI

- [ ] T026 [P] [US1] Red: `src/app/features/tape/tape-view/scores-export/scores-export-dialog.component.spec.ts`
  (read-only part): shows the Song's metre with "As in the Song", the upbeat and the staves with their clefs;
  Cancel closes with `undefined`; Export closes with the prefilled `ScoresChoices`.
- [ ] T027 [US1] Green: `scores-export-dialog.component.ts` (OnPush, signals, Material dialog, `data-testid`s of
  the contract).
- [ ] T028 [P] [US1] Red: `src/app/features/tape/tape-view/scores-export/scores-export.spec.ts`: cancel the
  dialog → no save call, no snackbar; confirm → `api.scores.save` with `scoresFileName`, the writer's text and
  the translated dialog texts; `saved` → `TAPE.SCORES.SAVED` with the path; `cancelled` → nothing; `failed`,
  `rejected` or a throw → `TAPE.SCORES.FAILED` with the reason and "Try again"; `saving` true while running.
- [ ] T029 [US1] Green: `scores-export.ts` (`ScoresExport`, like `PlotterExport`).
- [ ] T030 [P] [US1] Red: `tape-view.component.spec.ts`: "Export as Scores" (`export-scores`) after "Export for
  the Plotter", labelled and icon-only (`compactActions`), enabled with Cutting Problems and while the Preview
  plays, the Preview not stopped and no undo step after an export; disabled while `saving` (FR-001, FR-017).
- [ ] T031 [US1] Green: the action in `tape-view.component.{ts,html}`, passing the Tape, Organ and the Song from
  `TapeLibrary`.
- [ ] T032 [US1] e2e Red then Green: `e2e/read-a-tape-as-scores.spec.ts`: import a 3/4 MusicXML Score with an
  upbeat in G major (fixture under `e2e/support/`), stub `dialog.showSaveDialog` in main, export with the
  prefill, read the written file: `<time>` 3/4, implicit Bar 0, `<fifths>1`, tempo mark; export again while the
  Preview plays; cancel the export dialog → no file. `e2e/boundary.spec.ts` lists the `scores` key. Run by
  `test-first`, fixed by `implementer`.

**Checkpoint**: export works with the prefill; `npm run test`, the two e2e green; commit; STATUS.

## Phase 4: User Story 2 - The Scores read like music, not like a Tape (P1)

**Goal**: small gaps closed, fewest note values, chords and voices.

**Independent Test**: export the Story 2 reference Tape and compare each Bar's notes and rests.

- [ ] T033 [P] [US2] Red: `api/scores/close-gaps.spec.ts`: `minimumGapColumns` = ceil(Minimum Gap ÷ Column
  length − 1e-9) (2 mm ÷ 3 mm → 1; 6 ÷ 3 → 2; 0 → 0); `closeGaps`: 7 + gap 1 → length 8; 7 + gap 2 → stays 7;
  touching Holes stay two notes; the last Hole of a Pipe keeps its length; Holes of other Pipes are independent;
  the input Holes are unchanged (FR-008, Story 2.1, 2.2, 2.8).
- [ ] T034 [US2] Green: `api/scores/close-gaps.ts` (`ScoresNote`, `minimumGapColumns`, `closeGaps`); export.
- [ ] T035 [P] [US2] Red: Story 2 cases in `api/scores/scores-musicxml.spec.ts`: 7 + gap 1 → quarter, no rest; 7
  + gap 2 → dotted eighth tied to 32nd then 16th rest; 12 → dotted quarter; 3 → dotted 16th; 5 → eighth tied to
  32nd; start 24 length 16 → quarter tied over the bar line to a quarter; an empty Bar on a staff → whole-bar
  rest; same start and length on two Pipes → `<chord/>`; overlapping different lengths → voice 2 with stems
  down, voice 1 up (Story 2.1–2.7, FR-009, FR-010, FR-012); no note has more tied values than `noteValues` gives
  (SC-003).
- [ ] T036 [US2] Green: use `closeGaps` in `scoresMusicXml`; refresh the golden file.

**Checkpoint**: commit; STATUS.

## Phase 5: User Story 3 - Choose the staves (P2)

**Goal**: split notes picked in the dialog, octave clefs, remembered per Organ.

**Independent Test**: export the same Tape with the prefill and with three staves; check each staff's notes and
clef; the next Tape of the Organ is prefilled with the three.

- [ ] T037 [P] [US3] Red: octave clefs in `api/scores/scores-staves.spec.ts`: a treble staff whose notes mostly
  need ≥ 3 more ledger lines than with 8va → `treble-8va`; a bass staff far below → `bass-8vb`; half or fewer →
  plain; no notes → plain (FR-006, R9). Writer test: `<clef-octave-change>` 1 / −1, pitches unchanged.
- [ ] T038 [US3] Green: ledger line count and octave clefs in `api/scores/scores-staves.ts` and
  `scores-musicxml.ts`.
- [ ] T039 [P] [US3] Red: `split-notes` part of `api/scores/scores-choices.spec.ts`: `validateScoresChoices`
  reports `splitNotes` `not-distinct` and `out-of-range` (outside 0–127); split notes are sorted.
- [ ] T040 [US3] Green: split notes in `validateScoresChoices`.
- [ ] T041 [P] [US3] Red: `scores-staves-preference.spec.ts`: `splitNotesFor(organId)` undefined when nothing
  is stored, when the JSON is broken or the list is not sorted distinct integers 0–127, or when `localStorage`
  throws; `remember` stores per Organ under `crancula.scoresSplitNotes` without touching other Organs (FR-005,
  R12).
- [ ] T042 [US3] Green: `src/app/features/tape/tape-view/scores-export/scores-staves-preference.ts`.
- [ ] T043 [P] [US3] Red: dialog spec: add, remove and change split notes (note-name selects, highest on top);
  "Add a split note" an octave below the lowest (C4 when none, next free below if taken); staff lines show range
  and clef; Export disabled with duplicates. Flow spec: confirm remembers the split notes for the Organ, cancel
  does not; the next export of another Tape of the Organ is prefilled with them, another Organ is not (Story 3.4).
- [ ] T044 [US3] Green: staves editing in `scores-export-dialog.component.ts`; `remember` in `scores-export.ts`.

**Checkpoint**: commit; STATUS.

## Phase 6: User Story 4 - Give a Tape without a Time signature its Bars (P2)

**Goal**: the Time signature and upbeat entered for one export, never stored.

**Independent Test**: export a Tape composed from scratch in 3/4 with an upbeat of one quarter; open the dialog
again and see 4/4 and no upbeat.

- [ ] T045 [P] [US4] Red: `validateScoresChoices` in `api/scores/scores-choices.spec.ts`: beats 0, 2.5 or 100 →
  `beats`; beat type 64 or 3 → `beatType`; upbeat count negative or not whole → `upbeat`; upbeat as long as the
  first Bar → `not-shorter-than-bar`; upbeat 1 × 1/8 in 6/8 → 4 Columns; `'song'` refused when
  `songKeepsBarsOnColumns` is false (FR-004, Story 4.3).
- [ ] T046 [US4] Green: the remaining rules of `validateScoresChoices`.
- [ ] T047 [P] [US4] Red: dialog spec: without a Song only the fields, prefilled 4/4 and 0; "Another one" with
  6/8 and 1 × 1/8 returns that choice; each violation shows its `mat-error` and disables Export; a 3/64 Song shows
  `SONG_METRE_NOT_ON_COLUMNS` and 4/4; reopening shows the prefill again (nothing stored) (Story 4.1–4.5).
- [ ] T048 [US4] Green: Time signature and upbeat fields in `scores-export-dialog.component.ts`.
- [ ] T049 [US4] e2e: extend `e2e/read-a-tape-as-scores.spec.ts`: a Tape composed from scratch exported in 6/8
  with an upbeat of one eighth → first Bar 4 Columns (duration 4), then 24; reopening shows 4/4. (`test-first`,
  then `implementer`)

**Checkpoint**: commit; STATUS.

## Phase 7: User Story 5 - Use it in German or English (P3)

- [ ] T050 [P] [US5] Red: `src/app/features/tape/tape-i18n.spec.ts`: every `TAPE.SCORES.*` and
  `TAPE.VIEW.EXPORT_SCORES` key used in the dialog and flow exists in en and de; with German, the dialog and
  messages show no key; the suggested file name is the Tape's name in both (Story 5.1, SC-007).
- [ ] T051 [US5] Green: fix texts; `npm run i18n:check` green.
- [ ] T052 [US5] e2e: `e2e/tape-layout.spec.ts`: the page head with five actions in one row at 1180 px (en) and
  1440 px (de), icon-only below; raise `COMPACT_QUERY` / `GERMAN_ACTIONS_QUERY` in `tape-view.component.ts` if
  needed (R14). (`test-first`, then `implementer`)

**Checkpoint**: commit; STATUS.

## Phase 8: Polish & Cross-Cutting

- [ ] T053 [P] Extend `npm run ux:screens` (`e2e/ux/`) with the export dialog (with a Song, without, with an
  error, with three staves) in light and dark; run the `ux-review` skill → `specs/012-read-a-tape-as-scores/ux-review.md`;
  fix findings via `implementer`.
- [ ] T054 [P] Reviews, read-only and in parallel: `angular-reviewer` (`src/`), `electron-reviewer` (`app/`,
  `scores:save`, ADR 4 and ADR 29), `spec-auditor` (spec vs. tests and tasks) →
  `specs/012-read-a-tape-as-scores/audit.md`; `domain-modeler` checks the terms (Scores, Time signature, Bar,
  Key, Hole, Pipe, Minimum Gap) in code, tests and UI texts; fix findings via `implementer`.
- [ ] T055 Performance: a node test exports a generated 10-minute Tape (~10 000 Columns, 3 000 Holes) in under
  5 s (SC-005) in `api/scores/scores-musicxml.spec.ts`. (`test-first`; `implementer` only if red)
- [ ] T056 Gate: `npm run test`, `npm run lint`, `npm run i18n:check`, `npm run build` green;
  `e2e/read-a-tape-as-scores.spec.ts`, `e2e/tape-layout.spec.ts`, `e2e/tape-export.spec.ts`,
  `e2e/boundary.spec.ts` green locally; full e2e green in CI on Linux, Windows and macOS (ADR 13).
- [ ] T057 Hand check by the user ([quickstart.md](quickstart.md) "By hand"): open an exported file in
  MuseScore 4; Bars, upbeat, key, tempo mark, clefs and octave clefs, voices, ties, accidentals, beaming; play it
  next to the Preview (SC-001, SC-002, SC-004). Record the result in STATUS; open issues for anything off; if not
  done before merging, say so in STATUS and the pull request.
- [ ] T058 `documentation/STATUS.md`, `documentation/ROADMAP.md` (Read a tape as Scores done), `CHANGELOG.md`
  `[Unreleased]` (export a Tape as Scores for MuseScore), README feature list; pull request with `Closes #169`.
  (`housekeeper` for STATUS/ROADMAP)

## Dependencies

- Phase 1 → Phase 2 → US1 → US2 → (US3, US4 in any order) → US5 → Polish.
- T001 before every UI Green task (T027, T029, T031, T044, T048).
- T003, T005, T007, T009 before T021. T011, T013, T015, T017, T019 before T021.
- T023 before T025; T025 before T029 and T032. T027 and T029 before T031; T031 before T032.
- T021 before T036, T038; T015 before T040, T046; T042 before T044.
- e2e tasks T032, T049, T052 need their story's Green tasks.

## Parallel examples

- Foundational Red tasks T002, T004, T006, T008 (different files; one `test-first` run each, edits sequential in
  one tree).
- US1: T010, T012, T014, T018, T022, T024 Red in different files; UI Red tasks T026, T028 once T023 is in.
- US3 and US4 can interleave after US2: T037/T039/T041 and T045 touch different files.
- Reviews in T054 in parallel (read-only).

## Implementation strategy

MVP is US1 (Phases 1–3): a Tape exported with the prefilled dialog, Bars, Key, tempo mark and pitches right,
saved through the save dialog. US2 then makes the Scores readable (gap closing, fewest values, chords and
voices); with US1 that is the P1 capability. US3 (staves) and US4 (Time signature for Tapes without one) build on
the dialog; US5 checks translations and the page head. Each checkpoint leaves the app usable and committed.
