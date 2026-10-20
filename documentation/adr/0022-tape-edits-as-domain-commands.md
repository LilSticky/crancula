# 22. Tape edits are domain commands over one Tape factory; undo is a history of Tapes

Date: 2026-10-19

## Status

Accepted

## Context

"Place holes by hand" ([spec 004](../../specs/004-place-holes-by-hand/spec.md), #105) lets the organ
owner add, move, lengthen, shorten and remove Holes, with undo and redo. Until now a `Tape` came only
from `createTape` or the snapshot parser, and each of them checked the Tape's structural rules on its
own; `removeHolesOfPipes` and `renameTape` copied a branded Tape without any check. The rules for
Holes that can't be cut lived in two places (`export-problems.ts`, `hole-fixes.ts`). Editing would
have been a third copy of both. Details: [research R1–R3, R8, R9](../../specs/004-place-holes-by-hand/research.md).

## Decision

We will build every Tape through one validating factory, `validTape(fields): Result<Tape, …>`, used by
`createTape`, the snapshot parser and every command that changes a Tape.

We will write each edit (add, move, change length, remove a Hole) as a pure domain function in
`api/tape/` that takes a Tape and the Organ and returns the new Tape or why the edit is refused.
Holes are named by their Pipe and start Column; no Hole identifiers are stored.

We will work out Cutting Problems in one domain function, `cuttingProblems(tape, organ)`, used by the
Plotter export and by the Tape view's marks, so both always agree.

We will keep undo and redo as a history of Tape values held by the Tape view, dropped when the view is
left. Every edit, undo and redo is saved through the existing Tape library save path (`tapes:save`);
the snapshot format does not change.

## Consequences

- A Tape that breaks a structural rule can't be built anywhere; new commands get the checks for free.
- Export and editing can't drift apart on what can be cut (spec 004 SC-004).
- Undo is trivially correct (it restores a previous value), but holds whole Tapes in memory; fine for
  Tapes of thousands of Columns, to be revisited if Tapes get far larger.
- No undo across leaving the Tape view or restarting Crancula.
- Transposing Holes (#106) and changing the Column length (#107) follow the same pattern.
