---

description: "Tasks for 002 Bring a song onto a tape"
---

# Tasks: Bring a song onto a tape

**Input**: Design documents from `/specs/002-bring-a-song-onto-a-tape/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/domain-api.md](contracts/domain-api.md),
[contracts/tape-library-ipc.md](contracts/tape-library-ipc.md),
[contracts/tape-library-snapshot.md](contracts/tape-library-snapshot.md), [quickstart.md](quickstart.md)

**Tests**: TDD is mandatory (constitution, principle II). Every implementation task comes after a
test task that names its spec file, and that test must fail for the expected reason before you
implement. Follow the `tdd` skill: `test-first` writes the red test, `implementer` makes it green.

**Organization**: Tasks are grouped by user story so that each story can be implemented and tested
on its own. Stories follow the spec's priority order (US1, US2 P1; US3, US4 P2; US5, US6 P3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: Which user story this task belongs to (US1–US6); only in story phases
- **Commits**: one small conventional commit per test+implementation pair, on
  `002-bring-a-song-onto-a-tape`. Update `documentation/STATUS.md` at each checkpoint.

## Path conventions

- **`api/song/`, `api/song/midi/`, `api/tape/`, `api/app/`**: pure TypeScript domain. Relative
  imports only; no Angular, Electron or Node imports (ADR 2, constitution III). The only globals
  allowed are `TextDecoder` and `crypto.randomUUID` (research R1, contracts/domain-api.md).
  Tested with Node Vitest (`npm run test:node`, `vitest.node.config.ts`).
- **`app/`**: Electron main process and preload. Node Vitest with temporary directories.
- **`src/app/`**: Angular renderer. `ng test` (Vitest, jsdom, ADR 9). Standalone, OnPush, signals,
  signal forms, Angular Material, minimal SCSS.
- **`e2e/`**: Playwright Electron tests, started through `e2e/support/launch-app.ts`.
- **Words**: dictionary terms only (Organ, Pipe, Tape, Hole, Column, Song, Part, Note, Tick,
  Transposition, Fit, Unplayable Note, Quantisation, Import Summary, Minimum Hole Length, Minimum
  Gap, Song Source). "Column length" is a descriptive phrase, not a term (spec Clarifications).
  "The selected Parts" (`selectedParts`) is not a term of its own. Code-only names allowed by the
  plan: `PartIndex`, `ColumnCount`, `TapeLibrary`, `columnLength`.
- **i18n**: every new key goes into both `src/assets/i18n/en.json` and `de.json` in the same task;
  `src/app/i18n-parity.spec.ts` and `npm run i18n:check` must stay green.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Move `CranculaApi` to its new home and build the SMF test helper every MIDI test needs.

- [x] T001 Move `api/organ/crancula-api.ts` to `api/app/crancula-api.ts` and
  `api/organ/crancula-api.spec.ts` to `api/app/crancula-api.spec.ts` (research R10.1). Update the
  imports in `api/index.ts`, `app/preload.ts`, `app/main.ts`, `app/*-ipc.ts` and
  `src/app/core/crancula-api.token.ts`; the import path through `@api/index` stays the same. This
  is a refactor under green: no behaviour change; `npm run test`, `npm run lint` and
  `npm run build` pass before and after. Commit as `refactor(api): move CranculaApi to api/app`.
- [x] T002 Write the failing test `api/song/midi/smf-test-helper.spec.ts` for a Standard MIDI File
  encoder used only by tests (research R8). It asserts the exact bytes for:
  - an `MThd` header with format 0, 1 or 2 and Ticks per quarter note, or a time-code (SMPTE)
    division with the top bit set;
  - `MTrk` chunks from `{delta, event}` lists, with delta times as variable-length quantities
    (0, 127, 128, 16383, 0x0FFFFFFF);
  - note-on, note-off, Sequence/Track Name `FF 03`, tempo `FF 51`, End of Track `FF 2F`, a SysEx
    `F0`, a controller `Bn` and a program change `Cn`;
  - optional running status, an optional missing End of Track, and raw bytes appended or cut off
    (for truncated or malformed files).
- [x] T003 Implement `api/song/midi/smf-test-helper.ts` until T002 is green. It uses relative
  imports only, so `e2e/` can import it too. It is **not** re-exported from `api/index.ts`.

**Checkpoint**: `npm run test` green; the helper can build every fixture of research R8.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The Song and Tape domain with the whole import pipeline, the `tapes.json` snapshot,
the `tapes:*` IPC boundary and the `TapeLibrary` store. Every user story needs them.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Song domain (`api/song/`, Node Vitest)

- [x] T004 [P] Write the failing test `api/song/song.spec.ts` for the Song model
  (data-model.md "Value types" and "Song"):
  - `songId(value)`: `SongId` is a branded `string`, "UUID, like `OrganId`"; anything else gives
    `undefined`.
  - `Tick`: "integer ≥ 0, < 2³¹ (research R2)".
  - `TicksPerQuarter`: "integer 1–32767 (the SMF header's 15 bits)".
  - `PartIndex`: "integer ≥ 0, < the Song's number of Parts".
  - `Note`: `noteNumber` "0–127", `start`, `duration` "≥ 0; 0 is allowed"; invariant
    "`start + duration` < 2³¹".
  - `Part`: `name` "trimmed, non-empty when present"; `percussion` "true for MIDI channel 10";
    `notes` "non-empty; sorted by `start`, then `noteNumber`".
  - `Song`: `name` "trimmed, non-empty"; `parts` "non-empty; order = track, then channel".
  - `defaultSelectedParts(song)` returns every non-percussion `PartIndex` and no percussion Part
    (FR-004); a Song with only percussion Parts gives an empty set.
- [x] T005 Implement `api/song/song.ts` (types, `songId`, `defaultSelectedParts`, the internal
  brand helpers) until T004 is green. A valid `Song` can only be built by the MIDI reader or the
  snapshot parser (branded, non-exported constructor, like `Organ`). Depends on T004.
- [x] T006 Write the failing test `api/song/midi/read-midi-song.spec.ts`, part 1: the file level
  (research R1, data-model.md "Reading a Song"), with bytes from the SMF test helper (T003):
  - `SongRejection` `not-a-midi-file` "not a readable MIDI file: no `MThd`, truncated, malformed
    or too large": no `MThd`, a chunk length beyond the end of the file, a data byte ≥ `0x80`
    where a data byte is expected, running status before any status byte, a variable-length
    quantity longer than 4 bytes, an absolute Tick above 2³¹, and a file over
    `MAXIMUM_MIDI_FILE_SIZE` (16 MiB).
  - `format-2`: "a MIDI file of format 2"; `not-timed-in-beats`: "time-code (SMPTE) division";
    `no-notes`: "no Part with a Note" (a file with only a conductor track).
  - Format 0 and format 1 are read; unknown chunk types are skipped by their length; a missing
    End of Track at the end of the file is tolerated.
  - `readMidiSong` never throws: run it on every prefix of a valid file and on a few hundred
    seeded pseudo-random byte arrays; each call returns a `Result`.
- [x] T007 Implement `api/song/midi/read-midi-song.ts` (`readMidiSong(bytes, fileName)`,
  `MAXIMUM_MIDI_FILE_SIZE`, the bounds-checked byte reader, header and chunk walking, the
  rejections) until T006 is green. Only `Uint8Array` reads and the `TextDecoder` global.
  Depends on T005, T006.
- [x] T008 Extend `api/song/midi/read-midi-song.spec.ts`, part 2: Notes, Parts and names
  (research R2, fixtures 1–6 and 8 of R8):
  - a Part is one (track, channel) pair with at least one Note, ordered by track, then channel;
    one track with two channels gives two Parts that share the track's name;
  - channel 10 (index 9) is percussion, nothing else is;
  - Part name: the first `FF 03` of its track, absent when missing or empty after trimming; UTF-8
    when valid, else Latin-1;
  - Song name: the first `FF 03` of the first track, else the file name without `.mid`/`.midi`;
  - running status, kept across meta and SysEx events; note-on with velocity 0 ends a Note;
  - a second note-on of a sounding key ends that Note and starts a new one (re-trigger); a
    note-off at the same Tick as that re-trigger is ignored; a note-off with no sounding Note is
    ignored;
  - a Note never released ends at its track's End of Track Tick, or at the track's last event;
    duration 0 is kept;
  - tempo, time signature, program changes, controllers and velocity don't change the Song
    (FR-003); `ticksPerQuarter` comes from the header;
  - every Song gets a new `SongId`; Notes in each Part are sorted by start, then note number.
- [x] T009 Extend `api/song/midi/read-midi-song.ts` with the event loop, Note pairing, Parts and
  names until T008 is green. Re-export `readMidiSong`, `MAXIMUM_MIDI_FILE_SIZE`, `SongRejection`,
  the Song types, `songId` and `defaultSelectedParts` from `api/index.ts`
  (contracts/domain-api.md). Depends on T007, T008.

### Tape domain (`api/tape/`, Node Vitest)

- [x] T010 [P] Write the failing test `api/tape/tape.spec.ts` (data-model.md "Value types",
  "Hole", "Tape"):
  - `tapeId(value)`: `TapeId` is a branded "UUID".
  - `Column`: "integer ≥ 0; a position on the Tape, counted from 0 at the Tape's start, the first
    Note of the selected Parts (FR-013)".
  - `ColumnCount`: "integer ≥ 1; a length in Columns".
  - `Transposition`: "integer −127 to +127, in semitones".
  - `tapeLengthInMillimetres(tape)` = "`length × columnLength` (FR-017)".
  - `removeHolesOfPipes(tape, pipes)` removes exactly the Holes whose `pipe` is in `pipes` and
    "Keeps everything else, including `length`; the result may have no Hole" (FR-021).
- [x] T011 Implement `api/tape/tape.ts` (types, `tapeId`, `tapeLengthInMillimetres`,
  `removeHolesOfPipes`, internal brand helpers) until T010 is green. The `Tape` type is branded
  like `Organ`, so only `createTape` and the snapshot parser can build one. Depends on T005, T010.
- [x] T012 [P] Write the failing test `api/tape/quantisation.spec.ts` with the worked examples of
  research R3 (Ticks per quarter note 480): `column(t) = floor((16·t + ticksPerQuarter) /
  (2·ticksPerQuarter))`; quarter Note at Tick 480 → start 8, length 8 (Story 1 scenario 3);
  starts 29 → 0, 30 → 1, 31 → 1; a 1/64 Note → length 1; a grace Note of 10 Ticks → Columns 0 to 1
  (FR-005 "A Note that would become shorter than one Column MUST be one Column long"); eighth-note
  triplets → lengths 3, 2, 3; Ticks per quarter note 25 and 100 are exact.
- [x] T013 Implement `api/tape/quantisation.ts` until T012 is green. Integer arithmetic only.
  Depends on T011, T012.
- [x] T014 [P] Write the failing test `api/tape/transposition.spec.ts` (research R4, FR-006,
  FR-007):
  - `allowedTranspositions(song, selectedParts)` is "the range that keeps every selected Note
    within 0–127"; it always contains 0; a highest selected Note G9 (127) gives `highest` 0
    (Story 5 scenario 3).
  - `proposeTransposition(song, selectedParts, organ)`: Pipes C4–C6 and a melody C3–C5 give +12
    (Story 1 scenario 1); a Song whose Notes all match gives 0 (scenario 2); ties go to the
    fewest semitones, then upward (−6 vs +6 → +6); only directly matching Notes count, not
    durations or octave moves; only selected Parts count.
- [x] T015 Implement `api/tape/transposition.ts` (histogram, visiting order 0, +1, −1, +2, …)
  until T014 is green. Depends on T011, T014.
- [x] T016 [P] Write the failing test `api/tape/octave-moves.spec.ts` (research R5, FR-009): a
  128-entry table per Organ; a Pipe maps to itself; B6 (95) with Pipes C4–C6 → B5 (83), −1
  octave (Story 1 scenario 5); Pipes C4 and C6 only, C5 → C6 (upward on a tie); no F# Pipe →
  F#4 is an Unplayable Note (scenario 6).
- [x] T017 Implement `api/tape/octave-moves.ts` until T016 is green. Depends on T011, T016.
- [ ] T018 Write the failing test `api/tape/fit.spec.ts`: `fitOf(song, selectedParts, organ,
  transposition)` returns `matchingAPipe` "Notes whose transposed note number is a Pipe",
  `movedByOctaves` "Notes moved by whole octaves onto a Pipe (FR-009)" and `unplayable`
  "Unplayable Notes"; "The three counts add up to the number of selected Notes" (SC-003); Notes of
  unselected Parts don't count.
- [ ] T019 Implement `api/tape/fit.ts` until T018 is green. Depends on T015, T017, T018.
- [ ] T020 [P] Write the failing test `api/tape/hole-fixes.spec.ts` (research R6, FR-008,
  FR-012):
  - `L` and `G` are "the smallest whole number with `L × c ≥ Minimum Hole Length`" and
    "… `G × c ≥ Minimum Gap`", computed as `ceil(mm / c − 1e-9)`: 1.1 mm / 0.1 mm gives 11.
  - Overlap merge: Notes on the same Pipe whose start is before the current Hole's end become one
    Hole, reported as `overlap-merged` with Pipe and Column; touching Notes stay two Holes.
  - The five worked examples of R6 (c = 2 mm, Minimum Hole Length 3 mm, Minimum Gap 2.5 mm):
    lengthened [0, 1) → [0, 2); shortened [0, 8), [8, 16) → [0, 6), [8, 16); three 1/32 Notes →
    one Hole [0, 3) with two `repetition-merged` reports; lengthening into the next Hole →
    lengthened and merged [0, 10); with L = 1 rule 1 never fires.
  - "The start of a Hole MUST NOT be moved"; afterwards no Hole is shorter than `L` and no gap is
    below `G` (SC-004); every fix is reported in the order applied, with `from`/`to` or
    `lostColumn`.
- [ ] T021 Implement `api/tape/hole-fixes.ts` (overlap merge, the FR-012 loop of R6) and the
  `HoleChange` union in `api/tape/import-summary.ts` until T020 is green. Depends on T011, T020.
- [ ] T022 Write the failing test `api/tape/create-tape.spec.ts` for `createTape(input)` and
  `prefilledColumnLength(organ, tapes)` (contracts/domain-api.md, data-model.md):
  - Violations, all reported at once: `name-required` (FR-014), `column-length-must-be-positive`
    (FR-010), `no-part-selected` (FR-004), `transposition-out-of-range` (FR-007),
    `no-note-on-a-pipe` "(every selected Note is an Unplayable Note)".
  - Story 1 scenarios 1–8 end to end from SMF bytes: Transposition +12; Transposition 0; second
    quarter Note at Column 8, 8 long before fixes; rounding; B6 → B5 listed in `movedByOctaves`
    with `octaves` −1; F#4 listed in `unplayableNotes` with Part and Column; lengthened 1/32
    Note; shortened repeated Note.
  - Tape start (FR-013): the offset is the first Note of the selected Parts, an Unplayable Note
    included, before the Transposition; silence before it is cut, silence between Notes kept;
    an Unplayable first Note is at Column 0 and the first Hole starts after it.
  - The created Tape: `name` trimmed; `songId` and `selectedParts` "sorted ascending, unique,
    non-empty, each a Part of the Song"; `transposition`; `columnLength`; "Holes are sorted by
    `pipe`, then `start`"; "In each row (same `pipe`), Holes don't overlap"; "Every Hole lies
    within the Tape: `end ≤ length`"; every `pipe` is a Pipe of the Organ; "there is at least one
    Hole, and `length` is the largest `end` of all Holes (FR-013)".
  - Import Summary: `transposition`, `notesOnTape` "Notes matching a Pipe + Notes moved by
    octaves"; accounting (SC-003): selected Notes = matching + moved + Unplayable.
  - `prefilledColumnLength`: the Column length of the last Tape created for the same Organ (by
    array order), else `minimumHoleLength` of the Organ (FR-010).
  - Performance (SC-006): `readMidiSong` plus `createTape` on a generated 5-minute Song with
    16 Parts finishes well under 5 s.
- [ ] T023 Implement `api/tape/create-tape.ts` (the pipeline Quantisation → Transposition →
  octave moves → overlap merge → FR-012 fixes → Tape length, `prefilledColumnLength`,
  `TapeViolation`) and complete `api/tape/import-summary.ts` until T022 is green. Re-export the
  Tape API listed in contracts/domain-api.md from `api/index.ts`. Depends on T009, T013, T019,
  T021, T022.
- [ ] T024 Write the failing test `api/tape/tape-library-snapshot.spec.ts`
  (contracts/tape-library-snapshot.md): `parseTapeLibrarySnapshot` rejects with a reason a wrong
  shape, `version !== 1`, and each parser rule of the contract (duplicate or non-UUID ids, an
  unknown `songId`, `songId` without `selectedParts` or the reverse, unsorted or duplicate
  `selectedParts`, a `PartIndex` outside the Song, `transposition` outside −127…+127,
  `columnLength` not finite or ≤ 0, `length` < 1, a Hole beyond the Tape, unsorted or
  overlapping Holes in a row, unsorted Notes, `start + duration` ≥ 2³¹, a Song referenced by no
  Tape). It accepts a Tape with no Holes and a Tape whose `organId` names no known Organ, and
  never checks Organ-relative rules. `toTapeLibrarySnapshot` writes only referenced Songs,
  sorted Holes, omits absent optional fields; round trip `parse(toTapeLibrarySnapshot(x))` gives
  `x`.
- [ ] T025 Implement `api/tape/tape-library-snapshot.ts` (`TapeLibrarySnapshot`,
  `SongSnapshot`, `TapeSnapshot`, `parseTapeLibrarySnapshot`, `toTapeLibrarySnapshot`) until T024
  is green, and re-export it from `api/index.ts`. Depends on T011, T024.
- [ ] T026 Extend `api/app/crancula-api.spec.ts` with `expectTypeOf` checks: `CranculaApi.tapes`
  has `load(): Promise<TapeLibraryLoadResult>` and `save(snapshot: TapeLibrarySnapshot):
  Promise<TapeLibrarySaveResult>`, with the result unions of contracts/tape-library-ipc.md
  (`loaded | empty | unreadable{backupPath, reason}`, `saved | rejected{reason} |
  failed{reason}`).
- [ ] T027 Implement the `tapes` part and the result types in `api/app/crancula-api.ts` (generic
  `SnapshotLoadResult<S>`/`SnapshotSaveResult` with named aliases is allowed) and re-export them
  from `api/index.ts` until T026 is green. Depends on T001, T025, T026.

### Electron main process and preload (`app/`, Node Vitest + e2e)

- [ ] T028 Write the failing test `app/snapshot-file.spec.ts` for a generic
  `createSnapshotFile<S>(dir, {fileName, parse, normalise}, options)` with a toy snapshot
  (research R10.4, ADR 8): no file → `empty`; valid → `loaded`; bad JSON, failed parse or unknown
  version → renamed to `<name>.unreadable-<ISO timestamp>.json` with unchanged bytes and
  `unreadable`; `save` rejects an invalid payload without writing; coalesced writes with ~250 ms
  trailing debounce, one at a time, latest wins; `<name>.json.tmp` then rename; an I/O error gives
  `failed` and leaves the old file; `flush` awaits pending writes.
- [ ] T029 Extract `app/snapshot-file.ts` from `app/organ-library-file.ts` until T028 is green,
  and make `app/organ-library-file.ts` a thin configuration of it. `app/organ-library-file.spec.ts`
  stays green **unchanged** (refactor under green). Depends on T028.
- [ ] T030 Write the failing test `app/tape-library-file.spec.ts` (temporary directories):
  `createTapeLibraryFile(dir, options)` uses `tapes.json`, validates with
  `parseTapeLibrarySnapshot`, quarantines to `tapes.unreadable-<ISO timestamp>.json` with the
  original bytes (FR-023, SC-007), and never touches `organs.json`.
- [ ] T031 Implement `app/tape-library-file.ts` on top of `app/snapshot-file.ts` until T030 is
  green. Depends on T025, T029, T030.
- [ ] T032 Write the failing test `app/tape-library-ipc.spec.ts` (fake `ipcMain`):
  `registerTapeLibraryHandlers(ipcMain, file)` handles exactly `tapes:load` and `tapes:save`
  (`TAPE_LIBRARY_CHANNELS = {load: 'tapes:load', save: 'tapes:save'} as const`), and `tapes:save`
  answers `rejected` for a payload that fails `parseTapeLibrarySnapshot`.
- [ ] T033 Implement `app/tape-library-ipc.ts` until T032 is green. Depends on T031, T032.
- [ ] T034 Extend the e2e test `e2e/boundary.spec.ts`: `window.crancula.tapes.load` and
  `window.crancula.tapes.save` are functions; with a fresh `CRANCULA_USER_DATA`,
  `tapes.load()` returns `{status: 'empty'}`; `window.crancula` exposes no other new member.
- [ ] T035 Wire the Tape library into `app/preload.ts` (`tapes.load`/`tapes.save` through
  `ipcRenderer.invoke`, type-only imports from `../api`) and `app/main.ts` (create the Tape file
  in `<userData>/snapshots`, register the handlers, and on `before-quit` flush the Organ file and
  the Tape file, then quit) until T034 is green. Depends on T033, T034.

### Renderer adapter (`src/app/`, ng test)

- [ ] T036 [P] Extend `src/app/core/crancula-api.token.spec.ts`: `createInMemoryCranculaApi`
  takes an optional initial Tape snapshot and its `tapes` part behaves like its `organs` part
  (`empty` without one, `loaded` with one, `save` validates with `parseTapeLibrarySnapshot`), and
  can be told to answer `failed` or `unreadable` for tests (FR-023, FR-024).
- [ ] T037 Implement the `tapes` part in `src/app/core/crancula-api.token.ts` until T036 is
  green. Depends on T027, T036.
- [ ] T038 Write the failing test `src/app/features/tape/tape-library.store.spec.ts` for the
  `TapeLibrary` signal store (research R10.2, R10.3, data-model.md "Tape library"):
  - `load()` fills the named collections `tape` and `song` and sets `loadProblem` on
    `unreadable`; it runs after the Organs through `provideAppInitializer`;
  - `create(tape, song)` adds both and saves the whole snapshot; on `failed` or `rejected` it
    sets `saveProblem`, resolves `false`, and keeps the Tape in memory (FR-024);
  - `remove(id)` removes the Tape and "drops its Song when no other Tape references it";
  - `tapesOf(organId)`, `removeTapesOf(organId)`;
  - `affectedByRemovingPipes(organId, pipes): {tapes: number; holes: number}` and
    `removeHolesOfPipes(organId, pipes)`, keeping each Tape's length;
  - insertion order is creation order (for `prefilledColumnLength`);
  - while `loadProblem` is set, nothing is saved, so `tapes.json` is never overwritten.
- [ ] T039 Implement `src/app/features/tape/tape-library.store.ts` (`signalStore`,
  `withEntities` with named collections) and its app initializer until T038 is green.
  Depends on T037, T038.
- [ ] T040 [P] Create `e2e/support/midi-file.ts`: builds `setInputFiles` payloads
  (`{name, mimeType: 'audio/midi', buffer}`) from the SMF test helper (T003), with named fixtures
  for the e2e tests: melody C3–C5, three Parts with percussion, a long 5-minute Song with
  16 Parts, and a non-MIDI file. Test-support code only. Depends on T003.

**Checkpoint**: `npm run test` green (domain, `app/`, store); `e2e/boundary.spec.ts` green under
`npm run e2e`; the app still starts and the 001 e2e tests pass.

---

## Phase 3: User Story 1 - Bring a MIDI song onto a tape for my organ (Priority: P1) 🎯 MVP

**Goal**: Pick an Organ and a MIDI file; Crancula creates the Tape with the proposed Transposition
and the default Parts, and shows the Import Summary once.

**Independent Test**: With one stored Organ (Pipes C4–C6), import the melody C3–C5 and check the
Tape's Organ, Column length, Transposition +12 and every Hole.

### Tests for User Story 1 ⚠️ (write first, must fail)

- [ ] T041 [P] [US1] Write the component test
  `src/app/features/tape/tape-import/tape-import.component.spec.ts` (research R10.6, R10.7):
  - no Organ stored → a hint with a link to `/organs/new`, no form (FR-001, scenario 9);
  - exactly one Organ → preselected;
  - choosing a file reads `File.arrayBuffer()` and `File.name`; a file over 16 MiB or a
    `SongRejection` shows `TAPE.SONG_REJECTION.<CODE>` naming the reason and creates nothing
    (FR-002, scenario 10);
  - the name is prefilled with the Song's name (FR-014), the Column length with
    `prefilledColumnLength` (FR-010);
  - the default Parts and the proposed Transposition are used;
  - each `TapeViolation` is shown at its field as `TAPE.VIOLATION.<CODE>`;
  - Create calls `TapeLibrary.create` and navigates to `/tapes/<id>` with the Import Summary as
    navigation state, also when the write failed (R10.8).
- [ ] T042 [P] [US1] Write the component test
  `src/app/features/tape/import-summary/import-summary.component.spec.ts` (FR-015): it shows the
  Transposition, the number of Notes on the Tape, every Note moved by octaves (note name,
  octaves, Part, Pipe), every Unplayable Note (note name, Part), and every `HoleChange` kind with
  its Pipe's note name; every Column is shown **plus one** (Column 1 is the Tape's first Column).
- [ ] T043 [P] [US1] Write the component test
  `src/app/features/tape/tape-view/tape-view.component.spec.ts`, part 1: on `/tapes/<id>` with
  an Import Summary in the navigation state it shows the Import Summary; opened without one it
  shows none; an unknown id redirects to `/tapes`.
- [ ] T044 [P] [US1] Write the e2e test `e2e/tape-import.spec.ts`: with no Organ, the import page
  shows the hint and its link leads to the Organ editor; then save an Organ with Pipes C4–C6
  (`e2e/support/organ-editor.ts`), bring the melody C3–C5 onto a Tape through `setInputFiles`
  (`e2e/support/midi-file.ts`), and check the Import Summary shows Transposition +12; a non-MIDI
  file shows the rejection message.

### Implementation for User Story 1

- [ ] T045 [US1] Add `src/app/features/tape/routes.ts` with `tapes/new` (import page) and
  `tapes/:id` (Tape view), register it in `src/app.routes.ts`, and add a navbar entry through the
  `CranculaRoute` data. Depends on T041–T043.
- [ ] T046 [US1] Implement `src/app/features/tape/tape-import/tape-import.component.ts` (and
  `.html`, plus a form helper like `organ-form.ts` if needed): a Material button that clicks a
  hidden `<input type="file" accept=".mid,.midi">`, the Song as a signal, a signal form over the
  import draft (Organ, name, Column length), `computed` default Parts and proposal, one validator
  rule fed by `createTape`'s violations, and Create, until T041 is green. Depends on T039, T045.
- [ ] T047 [P] [US1] Implement `src/app/features/tape/import-summary/import-summary.component.ts`
  (presentational, input `ImportSummary`, uses `noteName`) until T042 is green.
- [ ] T048 [US1] Implement `src/app/features/tape/tape-view/tape-view.component.ts` (and `.html`)
  showing the Import Summary from the navigation state, until T043 is green. Depends on T047.
- [ ] T049 [US1] Add the `TAPE.IMPORT.*`, `TAPE.SONG_REJECTION.*`, `TAPE.VIOLATION.*`,
  `TAPE.SUMMARY.*` and navbar keys to `src/assets/i18n/en.json` and `de.json`; the parity test
  stays green; T044 is green. Depends on T046–T048.

**Checkpoint**: US1 works in Electron; T041–T044 green.

---

## Phase 4: User Story 2 - My tapes are kept (Priority: P1)

**Goal**: A Tape list; Tapes survive a restart; remove a Tape; unreadable `tapes.json` is reported
and kept; deleting an Organ and removing Pipes carry over to the Tapes.

**Independent Test**: Create a Tape, restart, compare its Holes, Column length and Organ; remove it
and restart again.

### Tests for User Story 2 ⚠️

- [ ] T050 [P] [US2] Write the component test
  `src/app/features/tape/tape-list/tape-list.component.spec.ts` (FR-017, FR-019, R10.10): an
  empty-state text; each Tape with its name, its Organ's name, its length in Columns and in mm;
  a Tape whose Organ is unknown shows "Organ not available" and its open action is disabled
  (FR-023); "Bring a song onto a tape" navigates to `/tapes/new`; remove opens the confirm dialog,
  cancel changes nothing, confirm calls `TapeLibrary.remove`.
- [ ] T051 [P] [US2] Extend `src/app/app.component.spec.ts`: a `TapeLibrary.loadProblem` shows a
  snackbar with the backup path, saying the Organs still work (FR-023); a `saveProblem` shows a
  snackbar (FR-024).
- [ ] T052 [P] [US2] Extend `src/app/features/organ/organ-list/organ-list.component.spec.ts`
  (FR-020, R10.3): the delete confirmation names the number of the Organ's Tapes; confirm calls
  `TapeLibrary.removeTapesOf` first and `OrganLibrary.remove` only if that write succeeded; while
  `TapeLibrary.loadProblem` is set, deleting is refused with a message and nothing changes.
- [ ] T053 [P] [US2] Extend `src/app/features/organ/organ-editor/organ-editor.component.spec.ts`
  (FR-021, FR-021a, Story 2 scenario 5): saving with removed Pipes that have Holes asks first,
  naming the number of Tapes and Holes (2 Tapes, 5 Holes); confirm calls
  `TapeLibrary.removeHolesOfPipes` first and `OrganLibrary.put` only if that write succeeded;
  cancel changes neither the Organ nor its Tapes; reordering or adding Pipes asks nothing; while
  the Tapes can't be read, saving with removed Pipes is refused with a message and other changes
  still save.
- [ ] T054 [P] [US2] Write the e2e test `e2e/tape-restart.spec.ts`: create a Tape, relaunch with
  the same `CRANCULA_USER_DATA`, the Tape is listed with identical Holes, Column length,
  Transposition and Organ (read from `snapshots/tapes.json`, SC-005); remove with cancel, then
  confirm, then restart, it is gone; write `{oops` to `tapes.json`, launch, see the message, the
  Organs work, `tapes.unreadable-*.json` contains exactly `{oops` (SC-007); with an unreadable
  `organs.json`, the Tapes are listed, can't be opened and `tapes.json` is unchanged (FR-023).
- [ ] T055 [P] [US2] Write the e2e test `e2e/tape-organ-changes.spec.ts`: delete an Organ with
  two Tapes, the confirmation names 2 Tapes, both are gone after a restart; remove a Pipe that
  has 5 Holes on 2 Tapes, the question names 2 Tapes and 5 Holes, after confirming and restarting
  those Holes are gone and both Tapes keep their name, other Holes and length in Columns.

### Implementation for User Story 2

- [ ] T056 [US2] Implement `src/app/features/tape/tape-list/tape-list.component.ts` (Material
  list or table, shared `ConfirmDialogComponent`), add the `tapes` route to
  `src/app/features/tape/routes.ts` and point the navbar entry at it, until T050 is green.
- [ ] T057 [US2] Show `TapeLibrary.loadProblem` and `saveProblem` from
  `src/app/app.component.ts` with `MatSnackBar` until T051 is green.
- [ ] T058 [US2] Implement the delete cascade in
  `src/app/features/organ/organ-list/organ-list.component.ts` until T052 is green.
- [ ] T059 [US2] Implement the removed-Pipes question and cascade in
  `src/app/features/organ/organ-editor/organ-editor.component.ts` until T053 is green.
- [ ] T060 [US2] Add the `TAPE.LIST.*`, `TAPE.STORAGE.*` and the new `ORGAN.*` cascade keys to
  `en.json` and `de.json`; T054 and T055 are green. Depends on T056–T059.

**Checkpoint**: The P1 stories are complete. This is the MVP of the slice: bring a Song onto a
Tape, see the Import Summary, list, remove, restart, and the Organ cascades.

---

## Phase 5: User Story 3 - Choose which parts go onto the tape (Priority: P2)

**Goal**: See the Song's Parts and choose the selected Parts; the proposal and its Fit follow.

**Independent Test**: Import melody, bass and percussion; deselect the bass; only melody Notes
become Holes.

### Tests for User Story 3 ⚠️

- [ ] T061 [P] [US3] Extend `src/app/features/tape/tape-import/tape-import.component.spec.ts`
  (FR-004, Story 3): each Part shows its name (if any) and its number of Notes; non-percussion
  Parts are selected and percussion not; deselecting a Part updates the proposed Transposition
  and its Fit (Notes matching a Pipe, moved by octaves, Unplayable Notes) and resets the
  Transposition to the new proposal; with no Part selected, Create is disabled; a Song with only
  percussion Parts starts with nothing selected.
- [ ] T062 [P] [US3] Extend `e2e/tape-import.spec.ts`: three Parts (one percussion), deselect the
  bass, create the Tape, and `snapshots/tapes.json` holds only the melody Part in `selectedParts`
  and only melody Holes.

### Implementation for User Story 3

- [ ] T063 [US3] Add the Parts selection (Material checkboxes) and the Fit display to the import
  page, with the `TAPE.PARTS.*` and `TAPE.FIT.*` keys in `en.json` and `de.json`, until T061 and
  T062 are green.

**Checkpoint**: US1–US3 green.

---

## Phase 6: User Story 4 - Look at my tape (Priority: P2)

**Goal**: A read-only view of a stored Tape: one row per Pipe, its Holes, and its selected Parts.

**Independent Test**: Create a Tape from a reference MIDI file and compare the shown Holes with the
expected rows, start Columns and lengths.

### Tests for User Story 4 ⚠️

- [ ] T064 [P] [US4] Extend `src/app/features/tape/tape-view/tape-view.component.spec.ts`
  (FR-018, R10.9): one row per Pipe in the Organ's row order, labelled with its note name; one
  SVG `rect` per Hole with `x = start × w`, `width = length × w`, `y = row × h`; Holes of Pipes not
  on the Organ are not drawn; a mark every 8th Column; the scroll container covers the whole
  Tape length; the names of the selected Parts are shown; no control changes the Tape; a Tape
  whose Organ is unknown can't be opened.
- [ ] T065 [P] [US4] Extend `e2e/tape-import.spec.ts`: after creating, the Tape view shows the
  expected Holes per row; opening the Tape again from the list shows no Import Summary; a Tape
  from the 5-minute 16-Part Song opens within 2 s and can be scrolled to its end (SC-006).

### Implementation for User Story 4

- [ ] T066 [US4] Draw the read-only Tape in `src/app/features/tape/tape-view/tape-view.component.ts`
  (and `.html`, minimal `.scss` for the scroll container and the fixed labels) and add the
  `TAPE.VIEW.*` keys to `en.json` and `de.json`, until T064 and T065 are green.

**Checkpoint**: US1–US4 green.

---

## Phase 7: User Story 5 - Try another transposition (Priority: P3)

**Goal**: Replace the proposed Transposition, see its Fit, and return to the proposal.

**Independent Test**: Change the proposal by +12, create the Tape, its Holes are one octave higher.

### Tests for User Story 5 ⚠️

- [ ] T067 [P] [US5] Extend `src/app/features/tape/tape-import/tape-import.component.spec.ts`
  (FR-007, Story 5): a number input for the Transposition, limited to `allowedTranspositions`;
  choosing +7 instead of −5 shows the Fit for +7 and the created Tape uses +7; "use proposal"
  restores the proposal; with a highest selected Note G9, +1 can't be chosen
  (`transposition-out-of-range` at the field, Create disabled).

### Implementation for User Story 5

- [ ] T068 [US5] Add the Transposition input and "use proposal" to the import page, with the
  `TAPE.TRANSPOSITION.*` keys in `en.json` and `de.json`, until T067 is green.

**Checkpoint**: US1–US5 green.

---

## Phase 8: User Story 6 - Use it in German or English (Priority: P3)

**Goal**: Every text of the slice, including the Import Summary and every message, is in German and
English.

**Independent Test**: Switch to German and walk through Stories 1 and 2; no raw key is shown.

### Tests for User Story 6 ⚠️

- [ ] T069 [P] [US6] Write the test `src/app/features/tape/tape-i18n.spec.ts`: every
  `SongRejection`, `TapeViolationCode` and `HoleChange` kind has a key in `en.json` and `de.json`,
  and the German texts differ from the English ones.
- [ ] T070 [P] [US6] Write the e2e test `e2e/tape-german.spec.ts` (SC-008): switch to German,
  bring a Song onto a Tape, trigger a Song rejection and a `TapeViolation`, open the Tape list and
  the Tape view; no visible text matches `TAPE.` or `ORGAN.` key patterns, and the messages are
  German.

### Implementation for User Story 6

- [ ] T071 [US6] Fill every missing or untranslated key in `src/assets/i18n/de.json` (and
  `en.json`) until T069 and T070 are green.

**Checkpoint**: all user stories green.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T072 [P] Remove i18n keys nothing uses any more; check the changed files for `any`,
  non-null assertions and `console.*`; check that `api/song/` and `api/tape/` import no Angular,
  Electron or Node module.
- [ ] T073 [P] Update `quickstart.md` and `data-model.md` where the implementation settled a detail
  (for example the remaining "decided in /speckit-plan after #13" notes, i18n key names).
- [ ] T074 Run `npm run lint`, `npm run i18n:check`, `npm run test` and `npm run build`; all green.
- [ ] T075 Run `npm run e2e`; the whole suite, including the 001 tests, is green.
- [ ] T076 Run the `spec-auditor` agent on the slice against `spec.md` and this file; fix every
  gap through a new test+implementation task pair appended to this file.
- [ ] T077 Through the `housekeeper` agent: update `documentation/STATUS.md` (slice done, next
  step "Punch a tape") and set "Bring a song onto a tape" to `done` in
  `documentation/ROADMAP.md`.
- [ ] T078 Open a pull request (ADR 10) with `gh pr create`; the body has `Closes #2` and refs for
  any other issue touched. Squash-merge it with `gh pr merge --squash --delete-branch` once CI
  (e2e on Linux, Windows and macOS, ADR 13) is green.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: first. T001 before T027; T002 → T003 before every MIDI test.
- **Foundational (Phase 2)** depends on Setup and blocks every story:
  - Song: T004 → T005 → T006 → T007 → T008 → T009.
  - Tape: T010 → T011; then T012 → T013, T014 → T015, T016 → T017 in parallel; T018 → T019;
    T020 → T021; T022 → T023 (needs T009 too); T024 → T025; T026 → T027.
  - Main process: T028 → T029 → T030 → T031 → T032 → T033 → T034 → T035.
  - Renderer: T036 → T037 → T038 → T039.
  - T040 after T003.
- **US1 (Phase 3)** depends on Phase 2.
- **US2 (Phase 4)** depends on US1 (it needs created Tapes); the Organ cascades (T052, T053,
  T058, T059) only need Phase 2.
- **US3, US5** depend on US1 (they extend the import page); US5 follows US3, since both change
  the import form.
- **US4** depends on US1 (the Tape view shell) and US2 (open from the list, T065).
- **US6** depends on all other stories.
- **Polish** comes last.

### Within each story

Tests first, and they must fail for the expected reason. Implementation follows; each
test+implementation pair is one commit. The matching reviewer runs after each implementation
(`angular-reviewer` for `src/`, `electron-reviewer` for `app/`).

### Parallel opportunities

- **Setup:** T002 runs alongside T001.
- **Foundational:** T004 and T010 start together; T012, T014, T016, T020 in parallel after T011;
  the main-process chain (T028…) alongside the domain once T025 and T027 exist; T036 alongside
  the main-process chain; T040 at any time after T003.
- **Within a story:** every test task marked [P], for example T041–T044 or T050–T055.
- Editing agents of one session run sequentially in the same working tree (AGENTS.md); [P] marks
  what may run in parallel across worktrees or for read-only reviewers.

## Parallel Example: User Story 1

```text
Task: "T041 tape-import component test"
Task: "T042 import-summary component test"
Task: "T043 tape-view component test, part 1"
Task: "T044 e2e tape-import test"
```

## Parallel Example: User Story 2

```text
Task: "T050 tape-list component test"
Task: "T051 app component test for Tape storage problems"
Task: "T052 organ-list delete cascade test"
Task: "T053 organ-editor removed-Pipes test"
Task: "T054 e2e tape-restart test"
Task: "T055 e2e tape-organ-changes test"
```

## Parallel Example: User Story 3

```text
Task: "T061 tape-import Parts test"
Task: "T062 e2e three Parts, bass deselected"
```

## Parallel Example: User Story 4

```text
Task: "T064 tape-view SVG test"
Task: "T065 e2e Tape view and SC-006 timing"
```

## Parallel Example: User Story 5

```text
Task: "T067 tape-import Transposition test"
```

## Parallel Example: User Story 6

```text
Task: "T069 tape i18n key coverage test"
Task: "T070 e2e German walkthrough"
```

## Implementation Strategy

1. **MVP first:** Phases 1–4 (Setup, Foundational, US1, US2, all P1). A Song is brought onto a
   Tape with the default Parts and the proposed Transposition, the Import Summary is shown, Tapes
   are listed, removed, survive a restart, and the Organ cascades keep Tapes consistent. Stop and
   validate in Electron (`npm run e2e`) and update STATUS.
2. **Then P2:** US3 (choose the selected Parts) and US4 (look at the Tape).
3. **Then P3:** US5 (another Transposition) and US6 (German throughout).
4. **Finish:** Polish, the Definition of Done gate, the `spec-auditor` run, then the pull request
   with `Closes #2` and the squash-merge.
