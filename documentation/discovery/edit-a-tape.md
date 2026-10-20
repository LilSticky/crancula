# Discovery: Edit a tape (#103)

Domain-modeler proposal of 2026-10-19, with the user's decisions of the same day.
Sources: DICTIONARY.md, ROADMAP.md ("Later"), specs/002 and specs/003, api/tape/*.

## Decisions (user, 2026-10-19)

| # | Question | Decision |
|---|----------|----------|
| 1 | An edit breaks Minimum Hole Length or Minimum Gap | Allow it and mark the Hole that can't be cut at once; export stays the gate |
| 2 | Transposing an edited Tape | Move the Holes to other Pipes; manual edits stay, the Song is untouched |
| 3 | A Hole added, moved or lengthened past the end | The Tape grows; it never shrinks by itself |
| 4 | A Hole moved, lengthened or transposed onto another Hole of its Pipe | Refused for move and lengthen; merged on transposition and reported |
| 5 | A transposed Hole without a Pipe | Moved by whole octaves as at import, else removed and listed; the outcome is shown before applying |
| 6 | Scope | Holes, Transposition and undo/redo. Changing the Column length comes later; renaming is #82 |
| 7 | Split | 1) Place holes by hand (with marks and undo/redo) 2) Transpose holes 3) Adjust a tape (Column length), later |
| 8 | Ends and grid | Both ends of a Hole can be moved; everything snaps to whole Columns |

## What exists today (facts)

- The `Tape` (api/tape/tape.ts) is branded as valid and comes only from `createTape` or the snapshot parser.
  Its structural rules are checked twice: create-tape.ts and tape-library-snapshot.ts (start ≥ 0, length ≥ 1,
  ends within `length`, sorted, no overlap in a row).
- Organ-dependent rules (the Hole's Pipe is on the Organ, Minimum Hole Length, Minimum Gap) are not Tape
  invariants: fixed at import (hole-fixes.ts), refused at export (export-problems.ts), not checked on load.
- A Hole has no id; (Pipe, start) identifies it, because Holes of one Pipe never overlap.
- `Tape.transposition` is "the Transposition it was created with" (spec 002 FR-016).
- The Import Summary is shown once and not stored.

## Domain events (proposed)

HoleAdded, HoleLengthChanged (either end), HoleMoved (along the row, to another Pipe, or both), HoleRemoved,
HolesTransposed (per Hole: moved / moved by octaves / merged / removed), TapeLengthened (implicit),
EditUndone, EditRedone.

## Commands (proposed)

AddHole, ChangeHoleLength, MoveHole, RemoveHole, TransposeHoles(selected Holes, semitones); Undo, Redo.
Each names Holes by (Pipe, start) and returns the new Tape or the reasons it was refused (`Result`),
like `createTape`.

## Aggregate and invariants

Aggregate: **Tape**. It reads the Organ as input to a command and never changes it.

1. A Hole starts at Column ≥ 0; the Lead-in carries no Holes.
2. A Hole is at least 1 Column long and ends within the Tape's length (the Tape grows instead, decision 3).
3. No two Holes of the same Pipe overlap.
4. A new or moved Hole sits on a Pipe the Organ has now. Holes whose Pipe has gone may remain as data.
5. Holes are sorted by Pipe, then start.
6. The Tape keeps its Organ, Song reference and selected Parts; edits never change the Song.

Cuttability (Pipe on the Organ, ≥ Minimum Hole Length, gap ≥ Minimum Gap) is checked against the Organ as it
is now and shown as marks (decision 1).

The Song is provenance only. The Fit and the Import Summary belong to import; edits don't touch them.
Transposition reports its own outcome (decision 5).

## Terms: missing or ambiguous (proposals; DICTIONARY.md unchanged until approved)

1. **Move vs. shift** (Hole entry uses both): use "move" only.
2. **Shortening a Hole** is missing: "Can be lengthened or shortened at either end."
3. **Transposition** speaks of "the notes of a Tape": "Transposing Holes moves each of them by a number of
   semitones to another Pipe. The Tape's Transposition is the one it was created with."
4. **A Hole that can't be cut**: the code says `ExportProblem`; candidates "Cutting Problem" (Schnittproblem)
   or the phrase "a Hole that can't be cut".
5. **The selected Holes**: a phrase, like "the selected Parts", not a term.
6. **Tape length**: say "in Columns" or "in mm" explicitly in the Tape entry.
7. "Single notes" on a Tape means single Holes; use Hole.

## Model observations (for the plan)

- tape.ts `removeHolesOfPipes` spreads a branded Tape and skips every check. Edit commands must not copy it.
  Proposal: one `tape(fields): Result<Tape, …>` factory for invariants 1–5, used by createTape, the snapshot
  parser and every edit command.
- The cuttability rule is written twice (export-problems.ts, hole-fixes.ts). Proposal: one domain function,
  e.g. `cuttingProblems(tape, organ)`, reused by export and editing.

## Split (decision 7)

1. **Place holes by hand** (#103 first part, specs/004): add, move, lengthen or shorten at either end, remove;
   Holes that can't be cut marked as they happen; the Tape grows; undo/redo.
2. **Transpose holes** (specs/005): the selected Holes or all of them by semitones; octave moves, merges and
   removals reported before applying.
3. **Adjust a tape** (later): change the Column length (re-checks cuttability).
