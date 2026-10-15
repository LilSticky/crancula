# Data Model: Describe my organ

These are domain types in `api/organ/`, written in pure TypeScript. Names follow
`documentation/DICTIONARY.md`. Valid domain objects are immutable and can only be created through
`validateOrgan` or the snapshot parser.

## Value types

| Type | Shape | Invariant |
|------|-------|-----------|
| `OrganId` | branded `string` | non-empty UUID |
| `MidiNoteNumber` | branded `number` | integer 0–127 |
| `Millimetres` | branded `number` | finite, ≥ 0; whether 0 is allowed depends on the field (see rules) |

## Pipe

| Field | Type | Notes |
|-------|------|-------|
| `note` | `MidiNoteNumber` | identifies the Pipe within its Organ |

- **Row:** the Pipe's position (index) in `Organ.pipes` is its row on the Tape. The row is not
  stored separately, so there can never be gaps.
- **Display:** `noteName(note)` gives the note name, e.g. 60 → `C4` and 61 → `C#4` (research R7).

## TapeBed

| Field | Type | Rule |
|-------|------|------|
| `tapeWidth` | `Millimetres` | > 0 |
| `holeDiameter` | `Millimetres` | > 0 |
| `rowSpacing` | `Millimetres` | > 0, and ≥ `holeDiameter` (FR-009) |

`rowSpacing` is the centre-to-centre distance between neighbouring rows (spec Assumptions).
There is no `border` field: the Border is derived (amended 2026-10-15, #74).

## Organ (aggregate root)

| Field | Type | Rule |
|-------|------|------|
| `id` | `OrganId` | assigned when the Organ is first stored |
| `name` | `string` | trimmed, non-empty; not unique |
| `tapeBed` | `TapeBed` | see above |
| `minimumGap` | `Millimetres` | > 0 |
| `pipes` | `readonly Pipe[]` | non-empty; unique `note` values |

**Derived values:**
- `minimumHoleLength = tapeBed.holeDiameter` (FR-010, dictionary).
- `rowSpan = (pipes.length − 1) × rowSpacing + holeDiameter`.
- `border = (tapeWidth − rowSpan) / 2`, rows centred, row 1 nearest the top edge. It must be ≥ 0
  (FR-008); 0 is valid. `tapeBedFit(tapeBed, pipeCount)` returns `{ rowSpan, border }`
  (amended 2026-10-15, #74).

**Operations** (pure; each returns a new value):
- `addPipe(note)` appends a Pipe as the last row.
- `removePipe(row)` removes the Pipe in that row.
- `movePipe(fromRow, toRow)` moves a Pipe to another row.

These operate on `OrganDraft`, so an edit may produce an invalid intermediate state.

## OrganDraft (editor state, not stored)

This is the same shape as Organ, with relaxed types: every number can be `number | null`, the
name is a raw string, `id` is optional (absent for a new Organ), and Pipes are `{ note: number |
null }[]`.

## Validation

`validateOrgan(draft): Result<Organ, OrganViolation[]>` returns either a valid Organ or every
violation found. It never stops at the first one.

| Code | Field path | Parameters | Requirement |
|------|-----------|------------|-------------|
| `name-required` | `name` | – | FR-007 |
| `pipes-required` | `pipes` | – | FR-007 |
| `pipe-note-required` | `pipes[i].note` | – | FR-003 |
| `pipe-note-out-of-range` | `pipes[i].note` | `note` | FR-003 |
| `duplicate-pipe` | `pipes[i].note` (one violation per affected Pipe) | `noteName` | FR-007 |
| `value-required` | `tapeBed.*` / `minimumGap` | – | FR-007 |
| `must-be-positive` | `tapeBed.tapeWidth`, `tapeBed.holeDiameter`, `tapeBed.rowSpacing`, `minimumGap` | – | FR-007 |
| `row-spacing-below-hole-diameter` | `tapeBed.rowSpacing` | `holeDiameter` | FR-009 |
| `pipes-exceed-tape-width` | `tapeBed.tapeWidth` | `rowSpan`, `tapeWidth` | FR-008 |

The UI shows each code with the i18n key `ORGAN.VIOLATION.<CODE_IN_UPPER_SNAKE>`, in both en and
de (FR-011, FR-016).

## OrganLibrary (renderer state)

This holds the stored Organs, which are always valid, keyed by `OrganId`. It is the in-memory
source of truth (ADR 3). It is a snapshot adapter, not a domain aggregate.

## Lifecycle of an Organ in the editor

```text
(new draft) --valid--> stored (id assigned) --edit valid--> stored (updated)
     |                      |                                     |
   invalid              edit invalid --fix--> stored (updated)    delete --confirm--> removed
     |                      |
 leave + confirm        leave + confirm → last valid version stays stored
     → nothing stored
```
