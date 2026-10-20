# Data Model: Place holes by hand

Domain types in pure TypeScript (ADR 2) and the view state around them. Names follow
`documentation/DICTIONARY.md` (Tape, Hole, Pipe, Column, Organ, Cutting Problem, Minimum Hole
Length, Minimum Gap, Lead-in). Columns are counted from 0 in the domain (`Column`) and shown from 1.

**Nothing new is stored.** `tapes.json` stays at version 1 (Holes as `[pipe, start, length]`,
`length` stored); `organs.json` is untouched; no migration (ADR 20, research R9).

## Tape (changed: one factory)

`Tape` and `Hole` keep their shape (`api/tape/tape.ts`). What changes is how a `Tape` is made.

### `validTape(fields: TapeFields): Result<Tape, TapeRuleViolation>` (research R1)

| Rule | Violation code |
|------|----------------|
| `name.trim()` is not empty (stored trimmed) | `name-blank` |
| `songId` and `selectedParts` both set or both absent | `song-reference-incomplete` |
| `selectedParts` sorted ascending, unique, non-empty | `selected-parts-invalid` |
| every Hole: `start` is a `Column` (int ≥ 0), `length` a `ColumnCount` (int ≥ 1) | (by type) |
| every Hole ends within the Tape: `start + length ≤ length` | `hole-beyond-end` |
| Holes sorted by Pipe, then start | `holes-not-sorted` |
| no two Holes of one Pipe overlap (`next.start ≥ start + length`; touching allowed) | `holes-overlap` |

`TapeRuleViolation = {code: TapeRuleViolationCode; hole?: Hole}` (the first offending Hole for
the Hole rules). Not checked here, because they need the Organ: the Hole's Pipe is on the Organ,
the Minimum Hole Length, the Minimum Gap (they are Cutting Problems, below).

Removed: `asValidTape`. Callers: `createTape`, `parseTapeLibrarySnapshot`, `renameTape`,
`removeHolesOfPipes`, the edit commands.

## HoleRef

`type HoleRef = Pick<Hole, 'pipe' | 'start'>` — names one Hole on a Tape (Holes of one Pipe never
overlap, so this is unique). Used by the commands and the view; never stored.

## Edit commands (`api/tape/hole-edits.ts`, research R3–R5)

All pure; none changes its input; everything not named below is carried over (FR-017).

| Command | Input | Output on success |
|---------|-------|-------------------|
| `addHole` | `tape`, `organ`, `pipe: MidiNoteNumber`, `start: Column` | `HoleEdit` |
| `moveHole` | `tape`, `organ`, `ref: HoleRef`, `to: {pipe, start: Column}` | `HoleEdit` |
| `changeHoleLength` | `tape`, `ref: HoleRef`, `to: {start: Column, length: ColumnCount}` | `HoleEdit` |
| `removeHole` | `tape`, `ref: HoleRef` | `Tape` |

### HoleEdit

| Field | Type | Meaning |
|-------|------|---------|
| `tape` | `Tape` | the Tape after the edit |
| `hole` | `Hole` | the added, moved or changed Hole as it is now (to select it) |

### HoleEditRefusal

| Code | Extra | When |
|------|-------|------|
| `no-such-hole` | — | `ref` names no Hole of the Tape |
| `not-on-the-organ` | `pipe` | add/move to a Pipe the Organ doesn't have (discovery invariant 4) |
| `overlaps` | `other: Hole` | the result would overlap `other`, a Hole of the same Pipe; for add: `other` covers `start` (FR-007, spec 1.7, 2.3, edge case "another Pipe's row") |

### Rules every command follows

- **Overlap** is checked against the Holes of the target Pipe without the edited Hole itself.
- **Growth** (FR-008): `length' = max(length, hole.start + hole.length)` for add, move and
  change; remove keeps `length`.
- **Added Hole's length** (FR-005, R4): `min(L, next.start − start)` where `L` is the Minimum
  Hole Length in whole Columns (`holeLimitsOf(organ, tape.columnLength).minimumHoleLength`, ≥ 1)
  and `next` the next Hole of that Pipe after `start`; `L` when there is none.
- **Order**: the new Holes are sorted by Pipe, then start, before `validTape`.
- **Cutting Problems are allowed** (FR-009); Hole fixes are not applied.

### State transitions of one Hole

```text
 (none) --addHole--> Hole(p, s, l)
 Hole(p, s, l) --moveHole(p', s')--> Hole(p', s', l)
 Hole(p, s, l) --changeHoleLength(s', l')--> Hole(p, s', l')   // end moved: s' = s; start moved: s' + l' = s + l
 Hole(p, s, l) --removeHole--> (none)
 any refused command --> unchanged Tape, no history entry
```

## Cutting Problem (`api/tape/cutting-problems.ts`, renamed from `export-problems.ts`, research R2)

`cuttingProblems(tape, organ): readonly CuttingProblem[]` — the rule export uses (FR-012,
SC-004). Ordered by start Column, row, code.

| Code | Fields | Meaning |
|------|--------|---------|
| `no-pipe` | `pipe`, `start` | the Hole's Pipe is not on the Organ |
| `too-short` | `pipe`, `start`, `lengthMm`, `minimumHoleLengthMm` | shorter than the Minimum Hole Length (compared in whole Columns) |
| `too-close` | `pipe`, `start`, `nextStart`, `gapMm` (negative never happens on a valid Tape; 0 when touching), `minimumGapMm` | the gap to the next Hole of its Pipe is below the Minimum Gap |

### HoleCuttingProblems

`holesWithCuttingProblems(problems): readonly HoleCuttingProblems[]` — one entry per Hole that has
at least one Cutting Problem, in the order of the problems.

| Field | Type | Meaning |
|-------|------|---------|
| `hole` | `HoleRef` | the marked Hole |
| `problems` | `readonly HoleProblem[]` | its problems: `no-pipe`, `too-short`, `too-close` (to the next Hole), `too-close-previous` (the earlier Hole of a too-close pair is too close to this one) |

The count shown in the Tape view (FR-011) is the number of entries. Both Holes of a too-close pair
are entries (spec 3.2).

## View state (renderer, `src/app/features/tape/tape-view/`)

### EditHistory\<T\> (pure, research R8)

| Field | Meaning |
|-------|---------|
| `past: readonly T[]` | entries before the present, oldest first |
| `present: T` | what is shown and stored |
| `future: readonly T[]` | undone entries, next redo first |

`apply(next)` → past + present, future cleared; `undo()` / `redo()` move one entry;
`canUndo = past.length > 0`, `canRedo = future.length > 0`. Immutable: each call returns a new
history.

### TapeEditor entry

`{tape: Tape; selection: SelectableHole | undefined}` — the Tape and the selected Hole (row from
1, start) at that point. Lives in the `TapeEditor` service provided by `TapeViewComponent`;
dropped when the view is left or another Tape opens (FR-014).

### HoleDrag (pure, research R6)

| Field | Meaning |
|-------|---------|
| `part` | `'body' \| 'start' \| 'end'` — what was grabbed |
| `hole` | the grabbed Hole (`HoleRef` + `length`, row) |
| `from` | `{column, row}` under the press point (`gridAt`) |

`dragTarget(drag, now)` (the drag starts after 4 px of travel; the preview is a `HoleEdit` outcome, `applied` or `refused` with the Hole in the way; a refused preview only marks the grabbed Hole) → for `body`: `{pipe of row + Δrow, start: max(0, start + Δcolumn)}`; for
`end`: `{start, length: max(1, length + Δcolumn)}`; for `start`: `start' = clamp(start + Δcolumn,
0, end − 1)`, `length = end − start'`. Rows are clamped to the Organ's rows.

## TapeLibrary (store, changed)

New method `update(tape: Tape): Promise<boolean>`: `false` without change while `loadProblem` is
set or for an unknown id; else replace the Tape and save the whole library (ADR 8). `rename` and
`removeHolesOfPipes` keep their behaviour; they now get their Tapes from `validTape`.
