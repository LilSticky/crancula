# Research: Read a tape as Scores

Phase 0 of [plan.md](plan.md), 2026-10-26. Each item: decision, rationale, alternatives. A Column is a 1/32
note (DICTIONARY), so a quarter note is 8 Columns and a 4/4 Bar 32 Columns. The Scores use 8 divisions per
quarter note, so one Column is one MusicXML division.

## R1. Who writes the MusicXML

**Decision**: an own writer in a new domain folder `api/scores/`, pure TypeScript, emitting MusicXML 4.0
`score-partwise` text (uncompressed `.musicxml`, UTF-8, with the 4.0 partwise DOCTYPE) by string building
with XML escaping of the title. Output is deterministic: no encoding date, no app version (`<software>` is
`Crancula`). [ADR 29](../../documentation/adr/0029-own-musicxml-writer-in-the-domain.md).

**Rationale**: every rule of the slice (FR-005 to FR-014) is a domain rule that must be tested in Node
Vitest (ADR 2, ADR 7). The writer needs only a small part of MusicXML. ADR 27 made the same choice for
reading.

**Alternatives**: a library (no maintained TypeScript MusicXML writer; OpenSheetMusicDisplay and similar
render and read only, need a DOM); `DOMParser`/`XMLSerializer` in the renderer (not in Node tests, puts
domain logic in Angular); `.mxl` through fflate (the spec names uncompressed `.musicxml`).

## R2. How the output is proven

**Decision**: three layers.

1. Unit tests per rule (gap closing, Bars, note values, voices, clefs, spelling, tempo) on plain data.
2. A round trip: the written text is read back with `readScoreSong` of slice 010 (ADR 27). Its Song must
   have one Part per staff, Notes equal to the Holes after gap closing (pitch, start Column = Tick, length;
   ties joined by the reader), the Time signatures at their Columns, the upbeat and the Key. Every
   `<measure>` of every staff and voice must add up to its Bar's length (SC-002), checked on the text with
   the reader's `parseXml`.
3. By hand in MuseScore 4 (quickstart): opens without a warning, Bars, clefs, voices, key, tempo mark.

**Rationale**: the reader already exists and is tested against real MuseScore files; a round trip catches
wrong durations, missing `<backup>` and ties without a new dependency.

**Alternatives**: validating against the MusicXML XSD with a WebAssembly `xmllint` dev dependency (catches
schema errors but not wrong music; a new dependency to keep current under ADR 14); comparing with golden
files only (brittle; kept for one small reference file, `api/scores/scores.reference.musicxml`, like
`plotter-svg.reference.svg`).

## R3. Bars

**Decision**: `scoresBars(tapeLength, timeSignatures, upbeat)` lays Bars on Columns from Column 0:

- **Kept from the Song**: each Time signature's Tick becomes a Column with `columnOfTick` (the rounding of
  Quantisation). Two changes on one Column: the later one wins. Before the first one (a Song whose first
  Time signature is after Tick 0) the Bars are 4/4. A change that falls inside a Bar ends that Bar short
  there (spec Edge Cases).
- **Chosen in the dialog**: one Time signature from Column 0 for the whole Tape (FR-004).
- **Upbeat**: the first Bar is `upbeat` Columns long when it is > 0; the Song's upbeat is `columnOfTick`
  of its Ticks, and 0 means none.
- **End**: Bars continue until they cover the Tape's length; the last Bar is full length, filled with
  rests (FR-011). A Tape of length 0 cannot exist (`ColumnCount` ≥ 1).
- A Bar of `beats`/`beatType` is `beats × 32 / beatType` Columns. A Song's Time signature whose Bar is not
  a whole number of Columns (only beat type 64 with an odd beat count; the Song model allows 64) cannot be
  kept: the dialog then treats the Song as keeping no Time signature (prefill 4/4, no upbeat) and says why
  (`TAPE.SCORES.SONG_METRE_NOT_ON_COLUMNS`). Approved by the user on 2026-10-26 and written into FR-004. The dialog itself offers beat types 1 to 32 only (FR-004).
- In MusicXML the upbeat is `<measure number="0" implicit="yes">`; the following Bars count from 1. A Bar
  cut short before a change keeps its number and is written short (notation programs read it as an
  irregular Bar).

**Rationale**: the same rounding as the Holes keeps bar lines where the notes were at import. Story 1
scenarios 3 and 4 and Story 4 scenario 2 are the reference cases.

**Alternatives**: dropping a change that falls inside a Bar (moves every later bar line); stretching the
Bar to the next change (a Bar longer than its Time signature, which programs reject).

## R4. Key

**Decision**: the Song's Keys are written at their Columns (`columnOfTick`), each from the start of the Bar
that holds its Column; two Keys in one Bar: the later wins. Before the Song's first Key, and for a Tape
without a Song or a Song without Keys, the Key is C major (fifths 0). `<key>` carries `<fifths>` and
`<mode>`. A replaced Time signature does not drop the Keys.

**Rationale**: FR-014 names the Key the Song keeps; the Song model keeps Key changes, and dropping them would
spell notes wrongly after a modulation. A key signature mid-Bar is unusual in Scores.

**Alternatives**: only the first Key (simpler, wrong after modulation); Key changes at their exact Column
inside a Bar (legal MusicXML, rare in print, harder to read).

## R5. Spelling of notes

**Decision**: `spell(pitch, fifths)` gives step, alter (−1, 0, +1) and octave:

- A pitch class in the Key's scale (the seven notes of the major scale with `fifths`; a minor Key shares its
  relative major's signature) is spelled as the scale spells it (F♯ in G major, B♭ in F major, E♯ in
  C♯ major, C♭ in C♭ major).
- Any other pitch class is spelled with a sharp when `fifths` ≥ 0 and a flat when `fifths` < 0 (FR-014,
  Edge Case "B flat, not A sharp").
- The octave follows the spelled step (C♭4 is MIDI 59, B♯3 is MIDI 60).
- No `<accidental>` elements: notation programs derive the shown accidentals from pitch, Key and Bar, as
  MuseScore does on import (checked by hand).
- MusicXML octaves run 0–9, so MIDI 0–11 cannot be written at their pitch. Such a Hole (far below any
  Organ) is written an octave up, at octave 0; a B♯ that would fall in octave −1 is spelled C. No mark and no
  message: no Organ has such Pipes. Approved by the user on 2026-10-26 and written into FR-007.

**Rationale**: the spec's rule, plus the in-key spelling every reader expects.

**Alternatives**: always sharps (wrong in flat keys, refused by the spec); writing `<accidental>` with a
per-Bar accidental state (more code, programs recompute it anyway).

## R6. Gap closing

**Decision**: `closeGaps(holes, minimumGapColumns)` works per Pipe (the Holes are sorted by Pipe, then
start). `minimumGapColumns = ceil(minimumGap ÷ columnLength − 1e-9)`; the tolerance keeps 6 ÷ 3 at 2. A Hole
is lengthened to the next Hole's start in its row when `0 < gap ≤ minimumGapColumns`. Touching Holes
(gap 0) stay two notes. The last Hole in a row is never lengthened, so no note passes the Tape's end
(FR-008). The result is a list of `ScoresNote`s; the Tape is not touched.

**Rationale**: FR-008 and Story 2 scenarios 1, 2 and 8; the tolerance matches the 1e-9 of `validateOrgan`.

**Alternatives**: closing gaps up to the Minimum Hole Length too (not asked for); closing after
transposition into another row (the Tape has none at export).

## R7. Note values and the order inside a tie

**Decision**: lengths are cut at every bar line first. Each piece within a Bar is written as the fewest
values from the set dotted whole (48 Columns), whole (32), dotted half (24), half (16), dotted quarter (12),
quarter (8), dotted eighth (6), eighth (4), dotted sixteenth (3), sixteenth (2), 1/32 (1), found by a small
dynamic programme over Columns (a greedy choice is not proven optimal for this set; the programme is, and is
cheap). Several values are written **longest first** (5 Columns: eighth tied to a 1/32), as in Story 2.
Notes are tied (`<tie>` and `<notations><tied>`) across every piece; rests are not tied. A Bar without any
note on a staff is one `<rest measure="yes"/>` with the Bar's duration (FR-010). No beams (R10).

**Rationale**: FR-009 and Story 2 scenarios 2–4. Longest first reads like the spec's examples; a beat-aware
order (aligning to beats) would need a rule per Time signature and is left to a later change if the hand
check shows a need.

**Alternatives**: shortest first; splitting at beats like engravers do (more ties than the fewest, against
FR-009 and SC-003).

## R8. Voices

**Decision**: on each staff, notes with the same start and length (after R6) form one chord. Chords are
taken in order of start, then highest pitch first, and each goes into the lowest-numbered of four voices
that is free at its start (its last chord has ended). So at any start the highest chord gets voice 1, and a
held note that a melody moves over goes to voice 2. When all four voices are busy, the chord goes into
voice 4, and voice 4 is then written in one stream: its notes are cut into tied pieces at every start and
end of another of its notes, so overlapping chords share values (the answer B of Q4, only for overflow).

Voices are numbered per staff in MusicXML as `(staff − 1) × 4 + voice`, separated by `<backup>`. Stems:
in a Bar where a staff has more than one voice with notes, voices 1 and 3 get `<stem>up</stem>`, 2 and 4
`<stem>down</stem>`; a Bar with one voice leaves stems to the program. Voice 1 is always written and filled
with rests (or a whole-bar rest); voices 2–4 are written only in Bars where they have a note, then filled
with rests.

**Rationale**: FR-012, Story 2 scenarios 6 and 7; "highest notes in voice 1" keeps the melody in voice 1, as
in piano Scores. The overflow rule keeps every note's length without a fifth voice, which MusicXML programs
handle poorly.

**Alternatives**: longest notes in voice 1 (the melody would jump between voices); refusing more than four
voices (FR-007 wants every Hole).

## R9. Staves and clefs

**Decision**:

- **Staves**: the split notes, sorted and distinct, cut the pitches 0–127 into ranges; staff 1 (top) holds
  the highest range. A note goes to the staff whose range holds its pitch (FR-005, FR-007).
- **Prefill**: the split notes remembered for the Organ (R11); else `[60]` (C4) when the Organ has a Pipe
  below 60 and one at or above 60; else none (one staff).
- **Clef**: the middle of a staff's range of pitches is `(lowest + highest) ÷ 2` of the Organ's Pipes on
  that staff; with no Pipe there, of its notes; with neither, its lower split note (the bottom staff: its
  upper split note − 1). Treble clef when the middle is ≥ 60, else bass clef (FR-006).
- **Octave clef**: a staff's ledger lines per note are counted from the spelled step's position (treble:
  lines E4 to F5; bass: G2 to A3). It gets treble 8va (or bass 8vb) when, for more than half of its notes,
  the octave clef needs at least three fewer ledger lines than the plain clef. A staff without notes keeps
  the plain clef.
- MusicXML: `<staves>N</staves>`, `<clef number="s">` with `<sign>G</sign><line>2</line>` or
  `<sign>F</sign><line>4</line>`, plus `<clef-octave-change>1</clef-octave-change>` (8va) or `-1` (8vb).
  Pitches are written at their true pitch; the octave clef only changes where they are drawn. MuseScore's
  reading of this is part of the hand check.

**Rationale**: the spec's rule made countable. "Saves more than two ledger lines for most of its notes"
becomes "≥ 3 fewer for more than half".

**Alternatives**: middle of the split range (a range is unbounded at the ends); counting Pipes instead of
notes for the octave clef (a staff with one high Pipe played all the time would not get it).

## R10. Layout left to the program

**Decision**: no `<beam>`, no `<print>` line or page breaks, no instrument name (the `score-part` has an
empty `<part-name/>`), no dynamics or articulation.
The title is `<work><work-title>` with the Tape's name (FR-015).

**Rationale**: the spec leaves beaming and line breaks to the notation program; MuseScore lays out and
beams by Time signature.

**Alternatives**: beams per beat (more code; only if the hand check shows flags everywhere).

## R11. The export dialog

**Decision**: one Material dialog, `ScoresExportDialogComponent`, with three groups:

- **Time signature**: with a Song that keeps them, two choices: "As in the Song" (read-only, e.g. "3/4" or
  "4/4, from Bar 3 3/4") and "Another one"; without, only the fields. The fields are beats (number input,
  whole, 1–99) and beat type (select 1, 2, 4, 8, 16, 32).
- **Upbeat**: count (number input, whole, ≥ 0) of a note value (select whole … 1/32), the same "1/4" way the
  Metre shows the upbeat. Prefilled from the Song's upbeat in lowest terms of a whole note (one quarter =
  1 × 1/4), else 0. Its length in Columns is `count × 32 ÷ value`; 0 means none. It is refused when not
  shorter than the first Bar.
- **Staves**: one row per split note, each a select over note names (C0 … G9, by `noteName`), shown from the
  highest at the top, each row with a remove button; "Add a split note" adds one an octave below the lowest
  split (C4 when there is none), the next free note below if taken. Under them, the staves read
  "Staff 1: G4 and up · Staff 2: up to F♯4" with each staff's clef.
- "Export" is disabled while `validateScoresChoices` reports a violation; each violation shows as a
  `mat-error` under its field (FR-004, Story 4 scenario 3). Cancel closes with nothing (FR-002).

**Rationale**: the beats/beat type fields mirror the Time signature; the count-of-a-value upbeat needs no
fractions typed and maps to whole Columns. Split notes by name are what musicians call them.

**Alternatives**: the upbeat in beats with decimals (0.5 for a sixteenth in 4/4 is awkward); in Columns
(not a Scores word); a slider over pitches for the splits (imprecise).

## R12. Remembering the split notes

**Decision**: `ScoresStavesPreference` in the renderer keeps `{[organId]: number[]}` as JSON under the
`localStorage` key `crancula.scoresSplitNotes` (ADR 11). It is written when an export is confirmed (not on
cancel), read with a parser that drops anything that is not a sorted list of distinct integers 0–127, and
every access is wrapped so blocked storage only loses the prefill. The Time signature and upbeat are never
stored (FR-004).

**Rationale**: FR-005 and Q2; `PlotterPreference` is the precedent.

**Alternatives**: on the Organ (changes its snapshot for a Scores-only concern; rejected in Q2).

## R13. Saving the file

**Decision**: one new allow-listed channel `scores:save` in `app/scores-ipc.ts`, mirroring
`plotter:save-svg`: request `{suggestedFileName, musicXml, dialogTitle, filterName}`, parsed by
`parseScoresSaveRequest` in `api/app/scores-save-request.ts`; the save dialog has the filter
`['musicxml']` and `showOverwriteConfirmation`, starts in the folder last used by this channel (else
Documents); the text is written as UTF-8. Result: `saved` with the path, `cancelled`, `rejected`, `failed`
with the OS error code. The suggested name is `scoresFileName(tape.name)` = `safeFileName(name) +
'.musicxml'`. The file name check of `svg-save-request.ts` is generalised to `isSafeFileName(name,
extension)`; the size limit (64 × 2²⁰ characters) and the label rule are shared. The document check is
`startsWith('<?xml')` and contains `<score-partwise`.

**Rationale**: ADR 4 and ADR 21: the renderer never names a path; the same dialog behaviour as the Plotter
export (FR-002, FR-003, FR-018, Edge Cases "file already exists", "writing fails").

**Alternatives**: reusing `plotter:save-svg` with a format field (mixes two exports' validation); the two-step
choose/write of recordings (ADR 26; needed there only because rendering takes long after the dialog).

## R14. Where the command lives

**Decision**: a fifth page head action in the Tape view, "Export as Scores" (`TAPE.VIEW.EXPORT_SCORES`, icon
`queue_music`), after "Export for the Plotter", in both the labelled and the icon-only form. It is enabled
for every Tape, also with Cutting Problems, while the Preview plays and while recording (FR-001, FR-017);
only disabled while a Scores save runs. The `e2e/tape-layout.spec.ts` one-row checks at 1180 px (English)
and 1440 px (German) are rerun; if five labelled actions no longer fit in one row, the two compact
breakpoints in `tape-view.component.ts` are raised to where they do.

**Rationale**: the spec puts it next to "Export for the Plotter"; a menu over both exports would change the
existing export's tests and flow.

**Alternatives**: an export menu (one more click for the Plotter, the most used command); the Tape list (spec:
later).

## R15. Inputs and performance

**Decision**: the dialog and the writer take the Tape and Organ the Tape view holds, and the Song from the
Tape library store (as `songMetre` already does); they are read only. A 10-minute Tape (~10 000 Columns, a
few thousand Holes) is a few hundred Bars: every step is linear after one sort, well under SC-005's 5 s.
Writing runs synchronously in the renderer like `plotterSvg`.

**Alternatives**: a Worker (not needed at this size).
