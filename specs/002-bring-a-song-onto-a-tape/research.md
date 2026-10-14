# Research: Bring a song onto a tape

Each entry gives the decision, the reason for it, and the alternatives considered. This is the
**stack-independent** part of Phase 0. Anything that depends on the tech-stack upgrade
([#13](https://github.com/LilSticky/crancula/issues/13), Angular 22 and friends) is marked
"decided in /speckit-plan after #13". Names follow `documentation/DICTIONARY.md`; the terms that
were missing there (Tick, Fit, Import Summary) were added with the user's approval, see
[Spec questions](#spec-questions).

Facts about libraries were checked on 2026-10-14 against the npm registry and the libraries'
sources on GitHub.

## R1 Reading the MIDI Song Source: own parser, not a library

- **Decision**: Write a small Standard MIDI File (SMF) reader in pure TypeScript,
  `readMidiSong(bytes: Uint8Array, fileName: string): Result<Song, SongRejection>`. It
  supports:
  - the header chunk `MThd` with format 0 and 1; format 2 (several independent sequences) is
    rejected with its own reason (FR-002, Spec question 1);
  - time division in Ticks per quarter note; time-code (SMPTE) division, top bit of the division
    set, is rejected as "not timed in beats" (FR-002);
  - track chunks `MTrk`, delta times as variable-length quantities, and **running status**
    (kept across meta and SysEx events, as most real files expect);
  - channel messages: note-off `8n`, note-on `9n` are used; `An`, `Bn`, `En` (2 data bytes) and
    `Cn`, `Dn` (1 data byte) are skipped;
  - SysEx `F0`/`F7` and meta `FF` events are skipped by their length, except Sequence/Track Name
    `FF 03` (names, R2) and End of Track `FF 2F` (end of a track, R2);
  - unknown chunk types are skipped by their length, as the SMF spec requires.

  Tempo, time signature, key signature, program changes, velocity and controllers are read past
  and ignored (FR-003). Only the Ticks per quarter note from the header matter for time.

  Robustness for untrusted bytes: every read is bounds-checked; a chunk length beyond the end of
  the file, a data byte ≥ `0x80` where a data byte is expected, running status before any status
  byte, or a variable-length quantity longer than 4 bytes rejects the file as "not a readable
  MIDI file". The reader never throws: it returns a `Result` whose error is one of the reasons in
  FR-002 (data model, `SongRejection`). A missing End of Track at the end of the file is
  tolerated. Text in names is decoded as UTF-8 when valid, otherwise as Latin-1
  (`TextDecoder`, available in Node and Chromium), then trimmed; empty names count as absent.
- **Where it runs**: in the **renderer**, on bytes the user picked. The reader is pure TS
  without Node or browser-only APIs apart from the `TextDecoder` global, so the main process can
  run it too if ever needed.
  - Getting the bytes: the user picks the file through an HTML file input
    (`accept=".mid,.midi"`), and the renderer reads `File.arrayBuffer()` and `File.name`. This
    needs **no new IPC channel** and no main-process file access at all, which keeps the ADR 4
    surface small; the renderer never gets a path or Node access. Playwright can feed the input
    with `setInputFiles({name, mimeType, buffer})`, so e2e tests need no native-dialog mocking,
    and the browser dev server keeps working.
  - Files larger than 16 MiB are rejected before reading (as "not a readable MIDI file"); real
    MIDI files are a few hundred kB at most.
  - The exact file-picking component (Material button plus hidden input) is decided in
    /speckit-plan after #13.
- **Where the code lives**: the Song model in `api/song/`, the MIDI reader beside it as an
  adapter (`api/song/midi/`) that depends on the Song model, never the reverse (ADR 2). Files
  import each other relatively (001 research R1). Final folder names are decided in
  /speckit-plan after #13.
- **Rationale**:
  - The spec needs semantics no library gives as-is: a Part per track × channel (R2), no Note
    lost silently (SC-003), explicit rejection of time-code files (FR-002), and typed reasons
    instead of exceptions.
  - The subset of SMF needed is small (about 200 lines plus tests) and stable since 1988; there
    is nothing to keep up with.
  - No runtime dependency, no licence question, nothing for the renderer bundle, and the domain
    stays pure TS (ADR 2, constitution III).
  - TDD is straightforward with hand-built byte fixtures (R8).
- **Alternatives considered**:
  - **`@tonejs/midi`** (2.0.28, MIT, last release 2022-02-04, about 288 kB unpacked; depends on
    `midi-file` and `array-flatten`). ADR 5 named it as the candidate. Rejected:
    - it splits tracks by channel **and program** ("at most one instrument per track"), so one
      melody with a program change becomes two Parts, against the spec's track × channel;
    - it silently drops a note-on that never gets a note-off (violates SC-003);
    - it reads only `ticksPerBeat` and never checks for SMPTE division, so a time-code file gives
      `undefined` Ticks per quarter and NaN times instead of a rejection;
    - it pairs overlapping same-pitch notes first-in-first-out with the first later note-off,
      which can merge a repeated note into one long note (see R2 for the rule we want);
    - it converts Ticks to seconds with tempo, which the Tape doesn't use;
    - it is unmaintained for over four years.
  - **`midi-file`** (1.2.4, MIT, last release 2023-03-15, about 47 kB unpacked, JS with a
    hand-written `index.d.ts`). It is a plain event parser, handles running status, turns note-on
    velocity 0 into note-off, and reports SMPTE division as `framesPerSecond`/`ticksPerFrame`.
    It would be an acceptable fallback, but: it throws strings, not errors; it doesn't
    bounds-check truncated data (`readBytes` silently returns short arrays); we would still write
    all the Note and Part logic ourselves; and its types are loose. The saving is only the
    byte-level loop.
  - **Parsing in the main process** with a native open dialog (`songs:open` returning the parsed
    Song): adds an IPC channel, a payload validator for a whole Song, and dialog mocking in e2e,
    with no benefit since the reader is pure. If /speckit-plan prefers a native dialog after #13,
    the channel should return `{fileName, bytes: Uint8Array}` only, and parsing stays in the
    renderer.
- **Follow-up**: record the choice in an ADR during /speckit-plan (it settles ADR 5's open
  "MIDI parser library" consequence).

## R2 From MIDI tracks and channels to Parts and Notes

- **Decision**:
  - **Part** = one (track, channel) pair that has at least one Note. Parts are ordered by track,
    then channel. Tracks or channels without Notes (a format 1 conductor track, a track with only
    controllers) give no Part. A Part's identity within its Song is its position in that order.
  - **Percussion**: a Part on MIDI channel 10 (channel index 9) is percussion (spec
    Assumptions). Nothing else (GM2 bank select, program numbers) makes a Part percussion.
  - **Part name**: the first Sequence/Track Name (`FF 03`) of its track; all Parts of one track
    share that name. Absent if the track has none.
  - **Song name** (FR-014): the first `FF 03` of the first track, as the SMF 1.0 spec defines
    the sequence name for format 0 and the first track of format 1. Otherwise the file name
    without a `.mid`/`.midi` extension.
  - **Note start and end**: a note-on with velocity > 0 starts a Note; a note-off, or a note-on
    with **velocity 0**, ends the sounding Note with the same key on the same track and channel.
  - **Overlapping same-pitch Notes** (a second note-on while the key is still sounding on the
    same track and channel): the sounding Note ends at that Tick and a new Note starts
    ("re-trigger"). One Pipe can't sound twice, and this keeps the repetition as two Notes, so
    FR-012 can keep a gap between them instead of hiding it in an overlap merge.
  - **Same-Tick ordering**: if a note-off at Tick *t* would end a Note that a re-trigger started
    at the same Tick *t*, it is taken as the late note-off of the previous Note and ignored.
    (Many files write "note-on, note-off" at the same Tick for a repeated note.)
  - A note-off with no sounding Note is ignored.
  - **Notes never released**: they end at their track's End of Track Tick, or at the track's last
    event when End of Track is missing. A Note may have duration 0 Ticks (a note-on and note-off
    at the same Tick, typical for drum hits); Quantisation makes it one Column long (R3).
  - Time is stored on the Song in **Ticks** together with its **Ticks per quarter note**, as
    integers. Absolute Tick values above 2³¹ reject the file as not readable (only corrupt files
    get there).
- **Rationale**: the spec fixes track × channel and channel 10 (Assumptions). The remaining rules
  make sure every note-on becomes exactly one Note (SC-003) and that repeated notes survive into
  the FR-012 gap fix.
- **Alternatives considered**:
  - First-in-first-out pairing for overlapping same-pitch notes (as `@tonejs/midi`): the
    repeated note becomes an overlap and is merged (FR-008), losing the repetition without the
    FR-012 report.
  - Dropping never-released notes: silent loss, violates SC-003.
  - Splitting Parts by program (instrument) changes: the spec says instruments must not affect
    the Tape (FR-003), and a Part per track × channel is what the spec assumes.
  - Normalising Song time to a fixed resolution (for example 1/32 Columns) at import: the Song
    "holds no Columns" (spec, Key Entities), and keeping Ticks lets a later slice re-quantise.

## R3 Quantisation onto the Column grid

- **Decision**: One Column is a 1/32 note, so one quarter note is 8 Columns and a Column
  boundary *c* lies at Tick `c × ticksPerQuarter / 8`. The start Tick and the end Tick
  (start + duration) of a Note are rounded **separately** to the nearest Column, ties rounding
  **up** (to the later Column), in exact integer arithmetic:

  ```text
  column(t) = floor((16·t + ticksPerQuarter) / (2·ticksPerQuarter))
  ```

  If the rounded end is not after the rounded start, the end becomes start + 1 (FR-005: a Note
  is at least one Column long). Quantisation counts Columns from the Song's Tick 0. The Tape then
  starts at the first Note of the selected Parts (FR-013), so the pipeline subtracts that Note's
  Column from every Column (see R6, "Tape start and length").
- **Worked examples** (Ticks per quarter note 480, so one Column is 60 Ticks):
  - quarter Note at Tick 480, duration 480 → Columns 8 to 16: start 8, length 8 (scenario 3);
  - start 29 → Column 0; start 30 (exactly half) → Column 1; start 31 → Column 1;
  - a 1/64 Note at Tick 0, duration 30 → start 0, end round(0.5) = 1 → length 1;
  - a grace Note of 10 Ticks → end rounds to 0, so it becomes Columns 0 to 1 (FR-005, edge case);
  - eighth-note triplets (160 Ticks each) starting at 0, 160, 320 → Columns 0, 3 (2.67), 5
    (5.33), ending at 8: lengths 3, 2, 3. Swung eighths are rounded the same way. The spec says
    this rounding isn't reported.
- **Rationale**: integer arithmetic is exact for every Ticks-per-quarter value, including ones
  not divisible by 8 (for example 25 or 100). Rounding start and end separately is what the spec
  asks (scenario 4) and keeps back-to-back Notes back to back.
- **Alternatives considered**:
  - Rounding the duration instead of the end: two Notes that touch could end up overlapping or
    apart.
  - Round half to even: avoids a tiny bias, but half-way cases are rare and "up" is easier to
    explain and test.
  - Floating-point `Math.round(t * 8 / tpq)`: works in practice, but integer arithmetic removes
    any doubt about ties.

## R4 Proposing the Transposition (FR-006)

- **Decision**:
  - Count the selected Notes per MIDI note number: a histogram `h[0..127]` in O(N).
  - The **allowed Transpositions** are the whole numbers *s* that keep every selected Note
    within 0–127: `−min ≤ s ≤ 127 − max` over the selected Notes (spec Assumptions). It always
    contains 0. The user's own choice (FR-007) is limited to the same range (Spec question 3).
  - Score of *s* = number of selected Notes whose note number + *s* is a Pipe of the Organ:
    `Σ over Pipes p of h[p − s]`.
  - Visit *s* in the order 0, +1, −1, +2, −2, … and keep the first strictly higher score. This
    gives "most Notes", then "fewest semitones", then "upward over downward" (FR-006, edge case)
    without a separate tie-break step.
  - Complexity: O(N) for the histogram plus at most 255 shifts × at most 128 Pipes ≈ 33 000
    steps, independent of Song length. Re-running it whenever the selected Parts change
    (Story 3) is instant.
- **Worked example** (scenario 1): Pipes C4–C6 (60–84), melody 48–72 using both ends. *s* = +12
  matches every Note; +11 and +13 lose Note 48 or 72; 0 matches only 60–72. Proposal +12.
- **Rationale**: the spec counts Notes, not durations or octave moves (Assumptions), so a
  histogram is all that matters; the visiting order encodes both tie-breaks.
- **Alternatives considered**: weighting by duration or counting octave-moved Notes, both
  excluded by the spec's Assumptions.

## R5 Moving Notes by whole octaves (FR-009)

- **Decision**: For each transposed note number *n* (0–127) precompute once per Organ:
  - *n* itself if it is a Pipe;
  - otherwise the Pipe *p* with `p ≡ n (mod 12)` and the smallest `|p − n|`; if two are equally
    near (necessarily `n − 12k` and `n + 12k`), the upward one;
  - otherwise none: the Note is an Unplayable Note.

  That is a 128-entry table built in O(128 × Pipes); each Note then needs O(1). The Note keeps
  its Columns; only its Pipe changes. Each moved Note is listed in the Import Summary with its
  note name after the Transposition, its Pipe, the number of octaves (signed), its Part and its
  Column (FR-015).
  Unplayable Notes are reported with their note name after the Transposition, Part and Column
  (FR-009).
- **Worked examples**: Pipes C4–C6 (60–84): B6 (95) → B5 (83), one octave down (scenario 5).
  Pipes C4, C6 only: a C5 (72) has C4 and C6 equally near → C6 (upward). No F# Pipe: F#4 is an
  Unplayable Note (scenario 6).
- **Rationale**: direct translation of FR-009 and its edge case; the table makes FR-007's live
  Fit (matching, moved, Unplayable) cheap for every Transposition the user tries.

## R6 From Notes to Holes: overlaps, then Minimum Hole Length and Minimum Gap (FR-008, FR-012)

- **Decision**: the pipeline follows the spec's order (Assumptions): Quantisation (R3) →
  Transposition (R4) → octave moves (R5) → merging overlaps → FR-012 fixes → the Tape's length
  in Columns (FR-013).
  - **Units**: from the Organ and the Tape's Column length *c* (mm, > 0):
    - `L` = Minimum Hole Length in Columns = the smallest whole number with `L × c ≥ Minimum
      Hole Length`;
    - `G` = Minimum Gap in Columns = the smallest whole number with `G × c ≥ Minimum Gap`.

    Both are computed as `ceil(mm / c − 1e-9)`, because floating-point division can land just
    above a whole number (for example 1.1 / 0.1 = 11.000000000000002 would otherwise give 12).
    Since the Minimum Hole Length (the hole diameter) and the Minimum Gap are > 0, `L ≥ 1` and
    `G ≥ 1`: two Holes that touch are always too close.
  - **Merging overlaps** (FR-008): per Pipe, sort by start; a Note whose start is **before** the
    current Hole's end extends that Hole to the later end. Touching Notes (start = end) are not
    an overlap; they stay two Holes and FR-012 separates them. Each merge is reported with its
    Pipe and Column.
  - **FR-012 fixes**, per row, holes sorted by start, index *i* from the first Hole:

    ```text
    while i < holes.length:
      h = holes[i]
      if length(h) < L:                         rule 1: lengthen at its end
        h.end = h.start + L;  report lengthened
      if i + 1 < holes.length:
        next = holes[i + 1]
        if next.start − h.end < G:              too close (also if now overlapping)
          newEnd = next.start − G
          if newEnd − h.start ≥ L:              rule 2: shorten at its end
            h.end = newEnd;  report shortened;  i += 1
          else:                                 rule 3: one Hole, repetition lost
            h.end = max(h.end, next.end);  remove next;  report merged
            (stay at i: h is checked again against its new next Hole)
        else: i += 1
      else: i += 1
    ```

  - **Termination**: every pass either increases *i* or removes a Hole, so the loop runs at most
    2 × (number of Holes) times.
  - **Correctness**: no start ever moves (rule 3 keeps the earlier start; the later Hole is
    gone). Once *i* moves past a Hole, its end never changes again, and later steps only change
    ends of later Holes, never their starts, so its length ≥ L and its gap to the next Hole ≥ G
    stay true. Rows are independent. Sorting makes the whole step O(H log H) for H Holes.
  - **Tape start and length**: the Tape starts at the first Note of the selected Parts, an
    Unplayable Note included (FR-013, Spec question 2). Its *offset* is the smallest quantised
    start Column among all selected Notes, taken before the Transposition and octave moves.
    Every Column of a Note or Hole is reduced by the offset, so the Tape's Column 0 is that
    Note's Column; silence before it is cut, silence between Notes is kept. Its length in Columns is the largest Hole end after the fixes: only
    the last Hole of a row can grow past the previous end. The length is stored on the Tape and
    stays the same when Holes are removed later (FR-021, Spec question 4).
  - Every fix is reported once per step applied, with Pipe and Column and the length before and
    after (SC-004). A Hole that is lengthened and then merged gets both reports.
- **Worked examples**: Column length *c* = 2 mm, Minimum Hole Length 3 mm → L = 2, Minimum Gap
  2.5 mm → G = 2. Holes as [start, end) in Columns.
  1. A 1/32 Note: [0, 1) → lengthened to [0, 2) (scenario 7).
  2. Two quarter Notes on the same Pipe back to back: [0, 8), [8, 16). Gap 0 < 2 → newEnd 6,
     length 6 ≥ 2 → [0, 6), [8, 16): shortened by 2 Columns (scenario 8).
  3. Three 1/32 Notes in a row on one Pipe: [0, 1), [1, 2), [2, 3).
     - i = 0: lengthen to [0, 2); next starts at 1 → newEnd −1, too short → merge: [0, 2).
     - i = 0 again: next [2, 3), gap 0 → newEnd 0, too short → merge: [0, 3).
     - i = 0 again: no next; length 3 ≥ 2. Result: one Hole [0, 3), two merges reported
       (edge case "the repetition is lost").
  4. Lengthening runs into the next Hole: [0, 1), [3, 10) with L = 3, G = 2 → lengthen to
     [0, 3); gap 0 → newEnd 1, length 1 < 3 → merge [0, 10).
  5. With the default Column length (= Minimum Hole Length, FR-010) L = 1, so rule 1 never
     fires; G follows the Organ's Minimum Gap.
- **Rationale**: a direct, single-pass translation of FR-012's three rules, with a proof that it
  ends and leaves no violation (SC-004).
- **Alternatives considered**:
  - Moving the next Hole's start later instead of shortening: FR-012 forbids moving starts.
  - Fixing gaps before lengths: a lengthened Hole could then become too close again; the spec's
    order handles that in one pass.
  - Working in mm instead of Columns: Holes must stay on Column boundaries (dictionary).

## R7 Storing Tapes and Songs (ADR 3, ADR 8)

- **Decision**:
  - **One snapshot file for Tapes and their Songs**: `<userData>/snapshots/tapes.json`, next to
    `organs.json` (ADR 8 pattern: atomic temp-file rename, coalesced writes, flush on quit,
    unreadable file renamed to `tapes.unreadable-<timestamp>.json`).
    - Separate from `organs.json` because FR-023 requires the Organs to stay usable when the
      Tapes can't be read.
    - Songs in the **same** file as Tapes, so a Tape and the Song it references are always
      written together atomically (FR-016).
  - **Shape, version 1** (the format `version` is checked; unknown versions are unreadable):

    ```json
    {
      "version": 1,
      "songs": [
        {"id": "<uuid>", "name": "Greensleeves", "ticksPerQuarter": 480,
         "parts": [{"name": "Melody", "percussion": false,
                    "notes": [[57, 0, 480], [60, 480, 960]]}]}
      ],
      "tapes": [
        {"id": "<uuid>", "name": "Greensleeves", "organId": "<uuid>", "songId": "<uuid>",
         "selectedParts": [0], "transposition": 12, "columnLength": 3, "length": 24,
         "holes": [[69, 0, 8], [72, 8, 16]]}
      ]
    }
    ```

    Notes are `[noteNumber, startTick, durationTicks]` and Holes `[pipe, startColumn,
    lengthInColumns]` triples, sorted by Pipe, then start, so the file is deterministic. A
    Tape's `selectedParts` are the positions of its selected Parts in the Song (Spec
    question 6), and `length` is its length in Columns, stored because removing Holes must not
    change it (Spec question 4).
  - **Size**: a dense 5-minute Song with 16 Parts has roughly 10 000 Notes. As triples that is
    about 16 bytes per Note, about 160 kB; as objects with field names it would be about 480 kB.
    The Tape's Holes are fewer (only selected, merged Notes), well under 100 kB. Ten such Tapes
    with their Songs stay around 2–3 MB, which a full-snapshot write (ADR 8) handles in
    milliseconds. Tapes only change on create and remove, not while typing.
  - **Songs are garbage-collected**: the snapshot holds exactly the Songs that at least one Tape
    references; removing the last Tape of a Song drops it (spec Assumptions). Importing the same
    file twice creates two Songs; no deduplication.
  - **Validation on load and on IPC** (ADR 4): the parser checks every structural invariant of
    the data model (ids are UUIDs and unique, every `songId` exists, Holes valid and not
    overlapping in their row, Notes valid). It does **not** check Organ-relative rules (Pipe
    exists, Minimum Hole Length, Minimum Gap): Tapes are not re-checked after Organ changes
    (spec Assumptions), and the Organs may be unreadable. Tapes whose Organ is unknown, because
    `organs.json` couldn't be read, stay in memory and on disk unchanged, are listed, and can't
    be opened until their Organ is readable (FR-023, Spec question 5).
  - **Cascades** (FR-020, FR-021): the renderer writes **children first**: the Tape snapshot
    without the removed Tapes or Holes, and only after it was written, the Organ snapshot. If the
    Tape write fails, the Organ change is not saved either and the user is told (FR-024). A crash
    between the two writes leaves an Organ whose Tapes or Holes are already gone, which the user
    asked for anyway; the reverse order could leave Tapes without their Organ. While the Tapes
    can't be read, deleting an Organ is refused, since its Tapes couldn't be removed with it
    (FR-020, Spec question 7).
  - Holes refer to their Pipe by its MIDI note number (the Pipe's identity, dictionary), so
    reordering Pipes needs no change to Tapes (FR-021).
  - IPC channel names (`tapes:load`, `tapes:save`, following 001's `organs:*`), the renderer
    store and whether the file logic is shared with `organs.json` are decided in /speckit-plan
    after #13.
- **Rationale**: keeps ADR 8's proven pattern, satisfies FR-016 and FR-023 at the same time, and
  stays small enough to rewrite whole.
- **Alternatives considered**:
  - One file for Organs, Tapes and Songs: atomic cascades, but a damaged Tape would make the
    Organs unreadable too (against FR-023), and it would need a migration of `organs.json`.
  - One file per Tape: more files, partial-failure cases, and Songs shared by several Tapes
    would need their own files; unnecessary at this size.
  - A separate `songs.json`: a Tape and its Song could no longer be written atomically.
  - Objects instead of triples for Notes and Holes: easier to read by hand, about three times
    larger.
  - Storing the original MIDI bytes: the spec stores the Song's Notes, Parts and name, not the
    file (Assumptions).

## R8 Reference Songs for tests

- **Decision**:
  - **Hand-built bytes in unit tests**: a small test helper encodes an SMF from a readable
    description (format, Ticks per quarter, tracks of `{delta, event}`), including
    variable-length quantities and optional running status. Fixtures:
    1. format 0, one melody C3–C5 in quarter Notes (scenario 1, Transposition +12);
    2. two quarter Notes on beats 1 and 2 (scenario 3);
    3. format 1: conductor track with Song name and tempo, melody, bass, drums on channel 10
       (Story 3, FR-004);
    4. the same melody with running status and note-on velocity 0 as note-off;
    5. a re-triggered note, a note-on/note-off pair at the same Tick, a never-released note;
    6. triplets and a 1/64 Note (R3);
    7. rejections: time-code division, no `MThd`, a truncated track, a file with only a
       conductor track (no Notes);
    8. one track with two channels (two Parts, shared name).
  - **Generated in the test, not committed**: a 5-minute Song with 16 Parts for SC-006, built
    with the same helper.
  - **e2e**: Playwright feeds the file input with bytes from the same helper
    (`setInputFiles({name, mimeType: 'audio/midi', buffer})`), so no binary files are needed in
    the repository. Where a binary fixture is useful (manual tries, a `.mid` the user can open
    in other tools), it is written by the helper into `e2e/fixtures/` and committed together
    with the script that made it.
  - **No third-party MIDI files** in the repository. Even for public-domain music, a MIDI file
    is a sequenced arrangement with its own copyright; many "free MIDI" sites have no clear
    licence. If a real-world file is wanted later, it must be one the user made (for example
    exported from their own notation of a public-domain tune) or clearly CC0, with its origin
    noted next to it.
- **Rationale**: byte fixtures are exact, readable in the test, cover each SMF corner on purpose,
  and keep the MIT repository free of licence questions.
- **Alternatives considered**: downloading real MIDI files (unknown licences, large, they test
  everything at once and nothing on purpose); committing opaque binary fixtures without a
  generator (hard to review or change).

## R9 Stack-dependent items left for /speckit-plan after #13

- The renderer store for Tapes (001 used `@ngrx/signals`), the file-picking component, the form
  for the selected Parts and the Transposition (signal forms, see 001 research R6), and the
  dialogs.
- How the read-only Tape view draws thousands of Columns × up to about 100 rows within 2 seconds
  (SC-006): canvas, SVG or a virtualised grid.
- IPC channel names, preload API shape and the shared snapshot-file code in `app/` (ADR 12
  bundling).
- Whether the import pipeline needs a Web Worker: the estimates above (O(N) parse, about 33 000
  steps for the Transposition, O(H log H) fixes) suggest it doesn't for SC-006.

## Spec questions

Gaps or ambiguities found while researching. All are **resolved** (2026-10-14): question 4 by the
user, the others by the defaults below; spec.md records them under Clarifications and
Assumptions.

1. **MIDI format 2** (several independent sequences in one file) was not mentioned. Treating its
   tracks as parallel would put unrelated patterns on top of each other.
   **Resolved**: rejected with a message naming the reason, like other unreadable files (FR-002;
   data model `SongRejection` `format-2`).
2. **Which Columns does the Import Summary use?** FR-009/FR-015 list Notes and Holes "with their
   Column". If the Tape started at its first Hole, an Unplayable Note before it would get a
   negative Column.
   **Resolved** (user, 2026-10-14): the Tape starts at the first Note of the selected Parts,
   Unplayable Notes included, so silence before it is cut (FR-013). Columns in the Import Summary
   are counted from 1 at the Tape's start (FR-015), so no Column is negative. Inside the program
   Columns stay counted from 0 at the Tape's start; the UI shows them plus one.
3. **Range of the user's Transposition (FR-007, "any other number")**: otherwise a transposed
   Note has no note number.
   **Resolved**: limited to the range that keeps every selected Note within MIDI note numbers
   0–127, as for the proposal (R4, FR-007).
4. **Tape after a Pipe is removed (FR-021)**: removing Holes can leave a Tape whose last Hole no
   longer sits at its end, or a Tape without any Hole.
   **Resolved by the user**: before saving, the Organ editor says how many Tapes and Holes are
   affected; after confirmation those Holes are removed and the Tapes keep everything else. The
   Tape's length in Columns is unchanged, so it is stored (data model). A Tape left without Holes
   stays; the user can remove it.
5. **Tapes without their Organ**: if `organs.json` is unreadable at startup (slice 001 then
   starts with no Organs), every Tape references an unknown Organ. They must not be deleted
   (FR-023, SC-007).
   **Resolved**: such Tapes stay stored and listed, but can't be opened until their Organ is
   readable; nothing is deleted (FR-023).
6. **Should the Tape remember which Parts were selected?** FR-016 kept the Song and the
   Transposition, but not the selected Parts. A later "Edit a tape" would likely need them.
   **Resolved**: the Tape stores its selected Parts and shows them when the user looks at it
   (FR-016, FR-018).
7. **Organ deletion while the Tapes are unreadable** (FR-020 vs FR-023): the confirmation can't
   name the number of Tapes.
   **Resolved**: the deletion is refused with a message, so no Tape is lost; the user deletes the
   Organ once the Tapes are readable (FR-020).

### Missing dictionary terms

**Resolved**: the user approved three new terms on 2026-10-14, now in `DICTIONARY.md`:

- **Tick**: the MIDI unit of musical time; the Song Source gives the Ticks per quarter note.
  Used for the Song's Note starts and durations (R2); Quantisation turns Ticks into Columns.
- **Fit**: the three counts shown for a Transposition (FR-007): Notes that match a Pipe, Notes
  moved by octaves, Unplayable Notes.
- **Import Summary**: what the user sees after a Song is brought onto a Tape (FR-015).

"Selection" is not a term: specs and code say "the selected Parts".

## R10 Stack-dependent items, settled in /speckit-plan (after #13)

Added 2026-10-14 by /speckit-plan, on the upgraded stack (Angular 22, NgRx Signals 22, Electron 44,
TypeScript 6, Vitest 5). Settles R9 and the "decided in /speckit-plan after #13" notes in R1, R7
and the data model.

### R10.1 Domain folders

- **Decision**: `api/song/` holds the Song model; the MIDI reader is an adapter beside it in
  `api/song/midi/` and imports from `api/song/`, never the reverse. `api/tape/` holds the Tape,
  the import pipeline (Quantisation, Transposition, octave moves, Hole fixes, `createTape`), the
  Import Summary and the Tape snapshot. `CranculaApi` moves from `api/organ/crancula-api.ts` to
  `api/app/crancula-api.ts`, because it now spans Organs, Tapes and the app. Files import each
  other relatively; `api/index.ts` re-exports the public API
  ([contracts/domain-api.md](contracts/domain-api.md)).
- **Rationale**: one folder per aggregate, as in 001 (`api/organ/`); the reader depends on the
  model (ADR 2, constitution III).
- **Alternatives considered**: one `api/tape/` folder for everything (mixes the Song Source
  adapter into the Tape domain); keeping `CranculaApi` under `organ/` (misleading once it holds
  Tapes).

### R10.2 Renderer store for Tapes

- **Decision**: a root `TapeLibrary` signal store (`@ngrx/signals` 22) with two named entity
  collections, `tape` and `song`, plus `loadProblem` and `saveProblem` like `OrganLibrary`. It is
  loaded by `provideAppInitializer`, after the Organs. Every change writes the whole snapshot
  through `tapes:save` and resolves `false` when writing failed; the in-memory change stays
  (FR-024). Insertion order of the `tape` collection is creation order (data model, FR-010).
- **Rationale**: same pattern as `OrganLibrary`, which works and is tested; named collections keep
  Songs and Tapes in one store, so they are always written together (R7).
- **Alternatives considered**: two stores (Song and Tape), which could drift apart between two
  writes; a plain service with signals (loses the `withEntities` helpers used in 001).

### R10.3 Cascades between Organs and Tapes (FR-020, FR-021)

- **Decision**: the Organ feature calls `TapeLibrary` **before** `OrganLibrary`:
  - deleting an Organ: `TapeLibrary.removeTapesOf(organId)`, and only if that write succeeded,
    `OrganLibrary.remove(organId)`. Refused while `TapeLibrary.loadProblem` is set (FR-020).
  - saving an Organ with removed Pipes: `TapeLibrary.affectedByRemovingPipes` feeds the
    confirmation; after confirming, `TapeLibrary.removeHolesOfPipes(organId, pipes)`, then
    `OrganLibrary.put(organ)` only if the Tape write succeeded.

  `OrganLibrary` itself stays unaware of Tapes; the Organ list and the Organ editor coordinate.
  While the Tapes can't be read, saving an Organ with removed Pipes is refused (FR-021a, settled
  2026-10-14, ADR 18).
- **Rationale**: children first (R7). Keeping the order in two components, each with its own
  test, is simpler than a third store.
- **Alternatives considered**: `OrganLibrary` injecting `TapeLibrary` (a store depending on
  another store's write order is harder to test); one combined snapshot file (rejected in R7).

### R10.4 Shared snapshot-file code in `app/`

- **Decision**: extract the load, coalesce, atomic-write and quarantine logic of
  `app/organ-library-file.ts` into a generic `app/snapshot-file.ts`
  (`createSnapshotFile<S>(dir, {fileName, parse, normalise}, options)`). `organ-library-file.ts`
  and the new `tape-library-file.ts` become thin configurations of it. `before-quit` flushes both
  files. The existing `organ-library-file.spec.ts` stays green unchanged (refactor under green).
- **Rationale**: ADR 8 says later aggregates follow the same pattern and the file logic can be
  shared; a copy would drift.
- **Alternatives considered**: copy and paste (two places to fix bugs); one class with an
  aggregate switch (less type-safe).

### R10.5 IPC channels and payload size

- **Decision**: `tapes:load` and `tapes:save`, mirroring `organs:*`, with the same result shapes
  ([contracts/tape-library-ipc.md](contracts/tape-library-ipc.md)). The full snapshot is sent on
  every change. At about 2–3 MB for ten long Tapes with their Songs (R7) that is fine for
  Electron's structured clone, and Tapes only change on create, remove and the cascades.
- **Rationale**: same boundary shape as 001, validated in main with `parseTapeLibrarySnapshot`
  (ADR 4).
- **Alternatives considered**: per-Tape channels (`tapes:put`, `tapes:remove`): smaller payloads,
  but partial state in main and more validation code, unnecessary at this size.

### R10.6 Picking the MIDI file

- **Decision**: a Material button that clicks a hidden `<input type="file" accept=".mid,.midi">`.
  The renderer checks `File.size` (over 16 MiB is `not-a-midi-file`), reads `File.name` and
  `File.arrayBuffer()`, and calls `readMidiSong`. No IPC (R1).
- **Rationale**: no new channel, works in the dev server, and Playwright feeds it with
  `setInputFiles` (R8).
- **Alternatives considered**: Electron's native open dialog (adds a channel and dialog mocking,
  R1).

### R10.7 The import form

- **Decision**: one page, `tapes/new`, with a signal form (`form()` from `@angular/forms/signals`,
  as the Organ editor since #13) over an import draft: Organ, selected Parts, Transposition, name,
  Column length. The Song is a separate signal, set by the file input. `computed` signals derive
  `allowedTranspositions`, the proposal and `fitOf` for the current Transposition (Stories 3 and
  5). One validator rule feeds `createTape`'s `TapeViolation`s into the fields, as
  `validateOrgan` does in the Organ editor. Changing the selected Parts resets the Transposition
  to the new proposal (Story 3 scenario 2). With exactly one Organ it is preselected; with none,
  the page shows the FR-001 hint with a link to `organs/new`.
- **Rationale**: same form technology and violation mapping as the Organ editor. Everything is a
  pure function of the draft and fast enough (R4: about 33 000 steps per proposal), so no Web
  Worker is needed (R9).
- **Alternatives considered**: a multi-step wizard (Material stepper): more UI states and tests,
  and no requirement asks for steps.

### R10.8 Showing the Import Summary once

- **Decision**: after `createTape` succeeded and the Tape was put into `TapeLibrary`, the page
  navigates to `tapes/:id` and passes the Import Summary as router navigation state. The Tape view
  shows it above the Tape when present; opening the Tape later shows none (spec Assumptions: shown
  once, not stored). If the write failed, the Tape stays in memory, the storage problem is shown
  (FR-024), and the navigation still happens.
- **Rationale**: no transient state in a store; the summary lives exactly as long as that
  navigation.
- **Alternatives considered**: a dialog after creating (hides the Tape the summary talks about);
  a "last summary" field in `TapeLibrary` (state that must be cleared again).

### R10.9 Drawing the read-only Tape view (FR-018, SC-006)

- **Decision**: one inline SVG per Tape, generated by the Angular template: one `rect` per Hole,
  `x = start × w`, `width = length × w`, `y = row × h`, with fixed pixel sizes per Column (`w`)
  and per row (`h`), inside a horizontally scrolling container. Row labels (note names, in the
  Organ's row order) stay fixed on the left. Holes whose Pipe is not on the Organ are not drawn
  (the parser doesn't check Organ-relative rules, R7). A light mark every 8th Column (a quarter
  note) helps orientation; no bar lines (spec Assumptions).
- **Rationale**: a 5-minute Song is about 5 000 Columns and a few thousand Holes. A few thousand
  SVG elements render well under 2 s in Chromium. SVG elements can be queried in jsdom component
  tests and in Playwright (row, start, length per Hole); a canvas can't.
- **Alternatives considered**: canvas (fast, but not testable by element); a virtualised grid of
  cells (Columns × rows = hundreds of thousands of cells; far more code even when virtualised).
  The view's SVG is not the export of "Punch a tape"; that slice has its own adapter in mm.

### R10.10 Routes and navigation

- **Decision**: `tapes` (Tape list, in the navbar), `tapes/new` (import form), `tapes/:id` (Tape
  view). The Tape list shows name, Organ name (or that the Organ is not available, FR-023), length
  in Columns and in mm (FR-017), an open action (disabled without a readable Organ), and remove
  with confirmation (FR-019, shared `ConfirmDialogComponent`).
- **Rationale**: same structure as `organs`, `organs/new`, `organs/:id`.
