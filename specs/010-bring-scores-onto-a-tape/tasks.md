---

description: "Tasks for 010 Bring Scores onto a tape"
---

# Tasks: Bring Scores onto a tape

**Input**: Design documents from `/specs/010-bring-scores-onto-a-tape/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/tape-library-snapshot.md](contracts/tape-library-snapshot.md),
[contracts/score-import-ui.md](contracts/score-import-ui.md), [quickstart.md](quickstart.md),
[ADR 20](../../documentation/adr/README.md), [ADR 27](../../documentation/adr/0027-own-musicxml-reader-in-the-domain.md)

**Tests**: TDD is mandatory (constitution, principle II). Every implementation task follows a test
task that must fail for the expected reason first (`tdd` skill: `test-first` red, `implementer`
green). Test pyramid: Node Vitest (`npm run test:node`) for everything in `api/`; `ng test` (jsdom) for
`src/`; Playwright e2e only for what needs real Electron (a real file through the file input, `.mxl` in the
packaged renderer, restart).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1–US6 from spec.md; only in story phases
- **Red / Green**: a Red task writes only the failing test; its Green task makes it pass and refactors
- **Commits**: one small conventional commit per Red+Green pair on `010-bring-scores-onto-a-tape`.
  Update `documentation/STATUS.md` at each checkpoint.
- Fixtures are built in code: MusicXML strings via `api/song/musicxml/score-test-helper.ts`, `.mxl` by
  zipping with `fflate` in the test, MIDI via `api/song/midi/smf-test-helper.ts` (ADR 17).

## Phase 1: Setup

- [x] T001 Add `fflate` at exactly `0.8.3` to `dependencies` in `package.json` (`npm install --save-exact fflate@0.8.3`); add it (MIT) to the third-party notices wherever `@breezystack/lamejs` is listed; `npm run build` green.
- [x] T002 Add the keys of [contracts/score-import-ui.md](contracts/score-import-ui.md) with en and de texts to `src/assets/i18n/en.json` and `de.json`: `TAPE.IMPORT.CHOOSE_SONG` changes to "Choose a Song Source" / "Notenquelle wählen"; `TAPE.IMPORT.SONG_SOURCES` (names MIDI and MusicXML), `TAPE.IMPORT.SCORE_HINT` ("Only a PDF or printed Scores?" / "Nur ein PDF oder gedruckte Noten?"), `TAPE.IMPORT.SCORE_HINT_LINK` ("How to get MusicXML" / "So kommst du zu MusicXML"); `TAPE.SONG_REJECTION.<CODE>` for every code of [data-model.md](data-model.md#songrejection-changed) (`TOO_LARGE`, `NOT_A_SONG_SOURCE`, `PDF`, `NOT_A_SCORE`, `DAMAGED_ARCHIVE`, `NO_SCORE_IN_ARCHIVE`, keeping the existing MIDI ones); `TAPE.SCORE_HOW_TO.TITLE`, `STEP_1`…`STEP_5`, `CLOSE`; `TAPE.METRE.*` (time signature, `MAJOR`/`MINOR` with `{{key}}`, `UPBEAT` with `{{fraction}}`, the 15 major and 15 minor key names in en and de, e.g. "G major"/"G-Dur", "E minor"/"e-Moll"); `TAPE.SUMMARY.GRACE_NOTES_LEFT_OUT`, `TAPE.SUMMARY.ORNAMENTS_LEFT_OUT`. German uses Stück, Stimme, Noten, Notenquelle. `npm run i18n:check` green.

## Phase 2: Foundational (domain types, recognition, snapshot)

Blocks every story: the Song gains its new fields and the import has one entry point.

- [ ] T003 [P] Red: extend `api/song/song.spec.ts`: `song({...})` accepts `timeSignatures`, `upbeat`, `keys` and returns `undefined` when `timeSignatures` or `keys` are not sorted by `start` or have two equal starts; when a `TimeSignature.beats` is outside 1–99 or not an integer; when `beatType` is not 1, 2, 4, 8, 16, 32 or 64; when a `Key.fifths` is outside −7…7; when `mode` is not `'major' | 'minor'`; when `upbeat` is ≤ 0, not shorter than the first Time signature's Bar (`beats × ticksPerQuarter × 4 / beatType`), or given without a Time signature at Tick 0. A Song without them has `[]`, `undefined`, `[]`.
- [ ] T004 Green: `TimeSignature`, `Key`, `upbeat` and the rules in `api/song/song.ts`; every existing caller of `song()` (MIDI reader, snapshot, tests) passes or defaults the new fields; export the types from `api/index.ts`.
- [ ] T005 [P] Red: `api/tape/tape-library-snapshot.spec.ts`: writes `version: 3`; a Song with Time signatures, upbeat and Keys round-trips as `[start, beats, beatType]`, `upbeat`, `[start, fifths, mode]`, fields omitted when empty; version 1 and 2 files load with `[]`, `undefined`, `[]` and are otherwise unchanged (US4 scenario 6); a v3 Song entry that breaks a `song()` rule makes the file unreadable (ADR 8).
- [ ] T006 Green: version 3 in `api/tape/tape-library-snapshot.ts` (read 1–3, write 3, ADR 20), following [contracts/tape-library-snapshot.md](contracts/tape-library-snapshot.md); `parseTapeLibrarySnapshot` on both IPC sides stays the validator (no channel change).
- [ ] T007 [P] Red: `api/song/read-song-source.spec.ts`: by first bytes, `MThd` → MIDI (same Song as `readMidiSong`), `PK\x03\x04` → archive, `%PDF` → rejection `pdf`, XML (optional BOM, whitespace, `<?xml` or `<`) → MusicXML, anything else → `not-a-song-source`; a file over 16 MiB → `too-large` before any reading; the file name is used only for the Song name fallback. Result is `SongReading { song, leftOut? }` or a `SongRejection` code.
- [ ] T008 Green: `api/song/read-song-source.ts` with `SongReading`, `LeftOut`, the widened `SongRejection` union from data-model.md; MusicXML and archive branches return `not-a-score` / `damaged-archive` until US1; export `readSongSource` from `api/index.ts`.
- [ ] T009 [P] Red: `api/tape/create-tape.spec.ts`: `createTape` with `leftOut: Map<PartIndex, LeftOut>` puts the sum over the selected Parts into `ImportSummary.leftOut`; without `leftOut` (MIDI) the summary has no `leftOut`; Holes, length and every other summary field are identical with and without it (FR-020).
- [ ] T010 Green: `LeftOut` in `api/tape/import-summary.ts`, optional `leftOut` in `CreateTapeInput` in `api/tape/create-tape.ts`.

**Checkpoint**: `npm run test:node` green; the app still imports MIDI unchanged; commit; STATUS.

## Phase 3: User Story 1 - Bring a Score onto a tape for my organ (P1) 🎯 MVP

**Goal**: a MusicXML Score without repeats, `.musicxml` or `.mxl`, becomes a Song with one Part per staff and goes onto a Tape like MIDI.

**Independent Test**: a two-staff reference Score without repeats gives the same Tape (Parts, Transposition, every Hole's Pipe, start Column, length) as the same music from MIDI.

### Domain

- [ ] T011 [P] [US1] Red: `api/song/musicxml/xml.spec.ts`: the own XML reader (research R2) builds an `XmlElement` tree with attributes, children and text; decodes the five predefined entities and numeric character references; skips the XML declaration, comments, processing instructions and `<!DOCTYPE …>` including an internal subset, without resolving any DTD or external entity; handles CDATA; rejects unbalanced or unterminated markup (returns `undefined`).
- [ ] T012 [US1] Green: `api/song/musicxml/xml.ts`.
- [ ] T013 [P] [US1] Red: `api/song/musicxml/score-test-helper.spec.ts`: the helper builds a `score-partwise` string from a compact description (parts with name, staves, measures with notes, chords, backup/forward, rests, attributes) that `xml.ts` reads back.
- [ ] T014 [US1] Green: `api/song/musicxml/score-test-helper.ts`.
- [ ] T015 [P] [US1] Red: `api/song/musicxml/mxl.spec.ts`: an archive zipped with `fflate` in the test is unpacked: the rootfile named in `META-INF/container.xml` is returned; without `container.xml`, the first `.musicxml`/`.xml` entry outside `META-INF/`; no Score entry → `no-score-in-archive`; corrupt bytes → `damaged-archive`; a Score entry whose uncompressed size is over 16 MiB → `too-large`, checked before inflating it (research R3).
- [ ] T016 [US1] Green: `api/song/musicxml/mxl.ts` using `fflate` (`unzipSync` with a filter).
- [ ] T017 [P] [US1] Red: `api/song/musicxml/score-measures.spec.ts`: from the tree, per part and written measure, the Notes with staff, written position and length in divisions (`backup`, `forward`, `chord` handled), pitch (step, alter, octave → MIDI note number; quarter-tone `alter` rounded to the nearest semitone, half way up) or unpitched, and the divisions, `transpose` (chromatic + octave-change), Time signature, Key and staves in force; `score-timewise` gives the same result as the equivalent `score-partwise` (R5); `opus` or another root → `not-a-score`; rests are no Notes; cross-staff notes stay on their written `<staff>`.
- [ ] T018 [US1] Green: `api/song/musicxml/score-measures.ts`.
- [ ] T019 [P] [US1] Red: `api/song/musicxml/lay-out.spec.ts` (straight order, no repeats yet): Ticks per quarter is the LCM of all divisions, capped at 32767, fallback 960 with rounding (R6); a quarter then a quarter: second Note starts 1 quarter later and is 1 quarter long (US1 scenario 2); a three-Note chord starts together (scenario 3); two voices of one staff land in one list of Notes (scenario 4); sounding pitch = written + transpose; a measure shorter or longer than its Time signature advances by its actual content length.
- [ ] T020 [US1] Green: `api/song/musicxml/lay-out.ts` (taking an explicit played measure order, identity for now).
- [ ] T021 [P] [US1] Red: `api/song/musicxml/read-score-song.spec.ts`: piano part with two staves → Parts "Piano 1" and "Piano 2" (scenario 1); a one-staff part named "Flute" → "Flute"; a part without name → unnamed Part; flute + violin + piano → four Parts in part-list then staff order; a staff with a percussion clef or only unpitched notes → percussion Part (scenario 7); a staff without Notes is no Part; no Part with Notes → `no-notes`; the Song name is the work title, else the movement title, else the file name without extension (scenario 6); malformed XML → `not-a-score`.
- [ ] T022 [US1] Green: `api/song/musicxml/read-score-song.ts`; wire it into `readSongSource` for XML and (via `mxl.ts`) archive input.
- [ ] T023 [P] [US1] Red: SC-001 in `api/song/musicxml/read-score-song.spec.ts` (or `api/tape/create-tape.spec.ts`): the same two-staff music built as MusicXML and as SMF gives, through `createTape` with the same Organ and Transposition, identical Holes; the `.mxl` of that Score gives the same Song as the `.musicxml` (scenario 5).
- [ ] T024 [US1] Green: fix whatever T023 shows (Tick rounding to Columns stays in `createTape`, FR-011).

### UI

- [ ] T025 [US1] Red: `src/app/features/tape/tape-import/tape-import.component.spec.ts`: the file input `song-file` accepts `.mid,.midi,.musicxml,.xml,.mxl,.pdf`; the button reads `TAPE.IMPORT.CHOOSE_SONG`; choosing a MusicXML file shows its Parts with Note counts, percussion unselected; the Tape name is prefilled with the Score's title; a rejection shows `song-rejection` with `data-code` = the code and text `TAPE.SONG_REJECTION.<CODE>`; the size check now comes from `readSongSource` (`too-large`); `leftOut` from the reading is handed to `createTape`.
- [ ] T026 [US1] Green: `src/app/features/tape/tape-import/tape-import.component.ts` / `.html` call `readSongSource` instead of `readMidiSong`, drop the component's own size check, keep the reading's `leftOut` and pass it on.
- [ ] T027 [US1] Red→Green: `e2e/score-import.spec.ts`: in real Electron with one stored Organ, write a two-staff `.musicxml` and an `.mxl` of it to a temp folder, hand each to `song-file` with `setInputFiles`, see Parts "Piano 1"/"Piano 2", create the Tape; restart the app; the Tape and its Holes are unchanged (scenario 9).

**Checkpoint**: US1 works end to end (MVP); commit; STATUS.

## Phase 4: User Story 2 - Repeats are played out (P2)

**Goal**: repeats, endings, D.C./D.S., fine and coda are played out into one straight sequence.

**Independent Test**: an 8-Bar Score with Bars 1–4 under repeat signs, a first ending on Bar 4 and a second on Bar 5 gives Holes in played-out order.

- [ ] T028 [P] [US2] Red: `api/song/musicxml/score-measures.spec.ts`: `MeasureMarks` per measure from `<barline>` (`repeat forward/backward`, `times`), `<ending number type>` ("1, 2" lists), `<sound segno coda tocoda fine dacapo dalsegno>`, and the jump words D.C., Da Capo, D.S., Dal Segno, Fine, To Coda in `<words>`, case-insensitive (R7); other words give no mark.
- [ ] T029 [US2] Green: marks in `api/song/musicxml/score-measures.ts`.
- [ ] T030 [P] [US2] Red: `api/song/musicxml/play-out.spec.ts`: A B under repeat + C → A B A B C (scenario 1); A B(ending 1) C(ending 2) D → A B A C D (scenario 2); `times="3"` → three passes (scenario 3); D.C. al fine and D.S. al fine end at fine (scenario 4); D.C./D.S. al coda jump from to-coda to coda and end there (scenario 5); after a D.C./D.S. jump repeats are skipped and endings take the last ending (scenario 6, Q1 A); a repeat without forward mark repeats from the start; D.C. without fine plays to the end; to-coda without coda is ignored; nested or inconsistent marks terminate (bounded passes) without error.
- [ ] T031 [US2] Green: `api/song/musicxml/play-out.ts`, a pure function `MeasureMarks[] → number[]` (written measure indexes in played order).
- [ ] T032 [P] [US2] Red: `api/song/musicxml/read-score-song.spec.ts`: the 8-Bar reference Score gives Notes at the played-out Ticks; every staff follows the first part's marks.
- [ ] T033 [US2] Green: `lay-out.ts` lays measures out in the order from `play-out.ts`; `read-score-song.ts` wires it.
- [ ] T034 [P] [US2] Red: SC-005 in `api/song/musicxml/read-score-song.spec.ts`: a generated Score of 16 staves that plays 5 minutes after play-out is read in under 5 s (generous bound, no flakiness on CI).
- [ ] T035 [US2] Green: make T034 pass if needed (avoid quadratic work in play-out or lay-out).

**Checkpoint**: commit; STATUS.

## Phase 5: User Story 3 - Ties, grace notes and ornaments (P2)

**Goal**: ties join in played-out order; grace notes and ornaments are left out and counted.

**Independent Test**: a Score with a tie over a bar line, two grace notes and a trill gives one tied Hole, no grace Holes, a plain trilled Hole, and the Import Summary counts 2 and 1.

- [ ] T036 [P] [US3] Red: `api/song/musicxml/lay-out.spec.ts`: a half tied over the bar line to a quarter of the same pitch is one Note of 3 quarters (scenario 1); a tie at the end of a repeat joins the next Note in played-out order only when it has the same MIDI note number and starts exactly at the tied Note's end (scenario 2); G♯ tied to A♭ joins; a tie whose next Note starts later or earlier does not join.
- [ ] T037 [US3] Green: tie joining in `api/song/musicxml/lay-out.ts`.
- [ ] T038 [P] [US3] Red: `api/song/musicxml/lay-out.spec.ts`: a grace note is no Note and the main Note starts where written (scenario 3); trill, mordent, turn, tremolo → one plain Note as long as written (scenario 4); an arpeggiated chord starts together (scenario 5); `leftOut` per Part counts grace notes and ornaments (arpeggiate counts as one ornament per chord) once per played pass (R8); a staff with only a grace note has no Part; a Score without either has counts 0 (scenario 6).
- [ ] T039 [US3] Green: grace notes, ornaments and counts in `lay-out.ts`; `read-score-song.ts` returns `leftOut` keyed by `PartIndex`.
- [ ] T040 [P] [US3] Red: `src/app/features/tape/import-summary/import-summary.component.spec.ts`: with `summary.leftOut` two rows `grace-notes-left-out-value` and `ornaments-left-out-value` (0 included) with `TAPE.SUMMARY.GRACE_NOTES_LEFT_OUT` / `ORNAMENTS_LEFT_OUT`; without `leftOut` (MIDI) neither row.
- [ ] T041 [US3] Green: `src/app/features/tape/import-summary/import-summary.component.html` / `.ts`.

**Checkpoint**: commit; STATUS.

## Phase 6: User Story 4 - The Song keeps its Time signature and Key (P2)

**Goal**: Songs from Scores and MIDI keep Time signatures, upbeat and Keys; the first ones are shown read-only.

**Independent Test**: a Score in 3/4 with a quarter upbeat, 2/4 from Bar 9 and G major keeps all of it across a restart.

- [ ] T042 [P] [US4] Red: `api/song/musicxml/lay-out.spec.ts`: 3/4 with a first measure of one quarter → Time signature 3/4 at Tick 0 and `upbeat` = 1 quarter (scenario 1); a change to 2/4 at Bar 9 → second Time signature at Bar 9's played-out Tick (scenario 2); a change inside a repeated section is kept on every pass at its played-out Tick (scenario 3); G major → Key `{fifths: 1, mode: 'major'}`, E minor → `{1, 'minor'}`, `aeolian` → minor, `dorian` and other modes → major with their fifths (R9); every Key change kept at its Tick (Q2 A); `3+2` → 5; a later irregular measure does not shift Bars and the Time signature restarts at the next measure; "free time" → none; polymetre → the first part's; a repeated Time signature or Key equal to the one in force is not kept twice.
- [ ] T043 [US4] Green: Time signatures, upbeat and Keys in `lay-out.ts` and `read-score-song.ts`.
- [ ] T044 [P] [US4] Red: `api/song/midi/read-midi-song.spec.ts`: meta event `0x58` → Time signature at its Tick (denominator as a power of two), `0x59` → Key (`sf` signed, `mi` 0/1) at its Tick (scenario 5); no `0x58` → no Time signature (Q4 A); a Song from MIDI never keeps an upbeat; repeated equal events are kept once.
- [ ] T045 [US4] Green: meta events in `api/song/midi/read-midi-song.ts`.
- [ ] T046 [P] [US4] Red: `api/song/song-metre.spec.ts`: `songMetre(song)` gives the first Time signature, the first Key and the upbeat as a reduced fraction of a whole note (1 quarter → 1/4, 3 eighths → 3/8); fields absent when the Song keeps none.
- [ ] T047 [US4] Green: `api/song/song-metre.ts`, exported from `api/index.ts`.
- [ ] T048 [P] [US4] Red: `src/app/features/tape/song-metre/song-metre.component.spec.ts`: renders "3/4, G major, upbeat 1/4" in English and "3/4, G-Dur, Auftakt 1/4" in German from `TAPE.METRE.*`; only the parts the Song keeps; nothing when it keeps none.
- [ ] T049 [US4] Green: `src/app/features/tape/song-metre/song-metre.component.ts` (standalone, OnPush, signal input, presentational).
- [ ] T050 [US4] Red: `tape-import.component.spec.ts` shows `song-metre` in `song-facts` for a Song that keeps any; `src/app/features/tape/tape-view/` spec shows it in the Tape details for the Tape's Song.
- [ ] T051 [US4] Green: place `song-metre` in `tape-import.component.html` and the Tape details of the Tape view.
- [ ] T052 [US4] Red→Green: extend `e2e/score-import.spec.ts`: a 3/4 Score with a quarter upbeat and G major shows "3/4, G major, upbeat 1/4" on the import screen and, after a restart, in the Tape details (scenarios 1, 7).

**Checkpoint**: commit; STATUS.

## Phase 7: User Story 5 - Bring a printed or PDF Score onto a tape (P3)

**Goal**: the way from a PDF or printed Score to MusicXML is findable on the import screen.

**Independent Test**: the hint on the import screen opens the how-to; choosing a PDF is rejected with the same link.

- [ ] T053 [P] [US5] Red: `src/app/features/tape/tape-import/score-how-to-dialog/score-how-to-dialog.component.spec.ts`: title `TAPE.SCORE_HOW_TO.TITLE`, five numbered steps `STEP_1`…`STEP_5`, a Close button that closes the dialog.
- [ ] T054 [US5] Green: `score-how-to-dialog.component.ts` / `.html` (Angular Material dialog, standalone, OnPush).
- [ ] T055 [US5] Red: `tape-import.component.spec.ts`: the hint `score-how-to-hint` with `TAPE.IMPORT.SONG_SOURCES` and `SCORE_HINT`, its link button `score-how-to-open` opens the dialog (scenario 1); the `pdf` rejection holds the same `score-how-to-open` link (scenario 2).
- [ ] T056 [US5] Green: hint and link in `tape-import.component.html` / `.ts`.
- [ ] T057 [US5] Red→Green: extend `e2e/score-import.spec.ts`: choosing a `.pdf` shows the `pdf` rejection, no Tape is created, the link opens the how-to dialog.

**Checkpoint**: commit; STATUS.

## Phase 8: User Story 6 - Use it in German or English (P3)

**Goal**: every new text is translated.

**Independent Test**: in German, Stories 1, 3 and 5 show no untranslated text.

- [ ] T058 [US6] Red→Green: `src/app/features/tape/tape-i18n.spec.ts`: every `TAPE.SONG_REJECTION.*` code of `SongRejection`, `TAPE.SCORE_HOW_TO.*`, `TAPE.METRE.*` (all 30 key names) and the two `TAPE.SUMMARY` rows exist in en and de and are non-empty; the German texts use Stück, Stimme, Noten, Notenquelle and not Song, Part, Scores.
- [ ] T059 [US6] Red→Green: extend `e2e/tape-german.spec.ts` (or `score-import.spec.ts`): in German, import a Score: button "Notenquelle wählen", Import Summary rows and how-to dialog in German.

**Checkpoint**: commit; STATUS.

## Phase 9: Polish & Cross-Cutting

- [ ] T060 [P] Extend `npm run ux:screens` (`e2e/` screens script) with the import screen showing a Score's Parts and metre, the how-to dialog, the `pdf` rejection, and the Tape details with metre; run the `ux-review` skill on them; fix findings.
- [ ] T061 [P] Reviews, read-only and in parallel: `angular-reviewer` (src/), `electron-reviewer` (only if `app/` changed; confirm no new channel), `spec-auditor` (spec vs. tests and tasks) → `specs/010-bring-scores-onto-a-tape/audit.md`; `domain-modeler` checks that staff, voice, grace note, ornament, tie, ending and measure appear only inside `api/song/musicxml/`; fix findings via `implementer`.
- [ ] T062 `npm run test`, `npm run lint`, `npm run i18n:check`, `npm run build` green; `e2e/score-import.spec.ts`, `tape-import.spec.ts`, `tape-restart.spec.ts` green locally, full e2e in CI.
- [ ] T063 Quickstart by hand (SC-004, [quickstart.md](quickstart.md) "By hand"): MuseScore `.musicxml` and `.mxl` with repeats and a da capo, one Audiveris `.mxl`; record the result in STATUS. Needs the user's files or tools; if not available, say so in STATUS and the pull request.
- [ ] T064 `documentation/STATUS.md`, `documentation/ROADMAP.md` (Bring Scores onto a tape done), `CHANGELOG.md` `[Unreleased]`, README feature list (MusicXML, Song Source); pull request with `Closes #167`.

## Dependencies

- Phase 1 → Phase 2 → US1 → (US2, US3, US4 in any order) → US5 → US6 → Polish.
- T004 before T006, T008, T043, T045; T008 before T022; T010 before T026 and T039.
- T012 before T014, T017; T016 and T018 before T022; T020 before T033, T037, T039, T043.
- US2 T033 before US3's tie-over-repeat case (T036 scenario 2) and US4's change-inside-repeat case (T042 scenario 3).
- T047 before T049; T049 before T051; T054 before T056; T002 before every UI Green task.
- e2e tasks T027, T052, T057, T059 need their story's UI Green tasks.

## Parallel examples

- Phase 2 Red tasks T003, T005, T007, T009 together (one `test-first` run each; edits stay sequential in one tree).
- US1 domain Red tasks T011, T013, T015 in different files; T017 after T012.
- After US1: US3's T040/T041 (UI) alongside US4's T044/T045 (MIDI) — different files.
- Reviews in T061 in parallel (read-only).

## Implementation strategy

MVP is US1 (Phases 1–3): a Score without repeats onto a Tape, `.musicxml` and `.mxl`, stored across a
restart. Then US2 (repeats — most barrel organ Scores need it), US3 (ties and counts), US4 (metre, also from
MIDI), US5 (how-to), US6 (translations), then polish. Each checkpoint leaves the app usable and committed.
