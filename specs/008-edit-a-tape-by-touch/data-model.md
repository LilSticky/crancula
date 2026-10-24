# Data model: Edit a tape by touch

## Crank speed range (domain, `api/organ/crank-speed-range.ts`)

| Field | Type | Rule |
|-------|------|------|
| `slowest` | `CrankSpeed` | 1–300 turns per minute |
| `fastest` | `CrankSpeed` | 1–300, above `slowest` |

- `crankSpeedRange(slowest: number, fastest: number): CrankSpeedRange | undefined`
- `DEFAULT_CRANK_SPEED_RANGE`: 30–120
- `nearestInRange(speed: CrankSpeed, range): { value: CrankSpeed; outside: boolean }` (slider position and hint)

## Organ (changed, `api/organ/organ.ts`)

- gains `crankSpeedRange: CrankSpeedRange` (required).

## OrganDraft (changed, `api/organ/organ-draft.ts`)

- gains `slowestCrankSpeed: number | null`, `fastestCrankSpeed: number | null`.
- `emptyOrganDraft()` fills 30 and 120; `toDraft` copies the Organ's range.

## validateOrgan (changed)

| Path | Code | When |
|------|------|------|
| `slowestCrankSpeed` / `fastestCrankSpeed` | `value-required` | null |
| same | `crank-speed-out-of-range` (`{ min: 1, max: 300 }`) | outside 1–300 or not finite |
| `fastestCrankSpeed` | `slowest-not-below-fastest` | both valid, slowest ≥ fastest |

## Organ library snapshot (version 5)

- Entry gains `crankSpeedRange: { slowest: number, fastest: number }`.
- v1–v4 entries read with 30–120; every entry still goes through `validateOrgan` (ADR 20).

## Spot (view, `src/app/features/tape/tape-view/spot.ts`)

| Field | Type | Rule |
|-------|------|------|
| `row` | number | from 1, a Pipe's row |
| `start` | `Column` | from 0; may be after the Tape's last Column |

- `sameSpot(a, b)`; `spotAt(cell, tape)`: a Spot only if no Hole covers that cell, else `undefined`.
- `moveSpot(spot, direction, rows)`: one Column or row, clamped to Column 0 and the rows.
- Not stored, not in the undo history.

## TapeSelection (view)

`{ holes: HoleSelection } | { spot: Spot }`; the empty selection is `{ holes: [] }`.

## TapMemory (view, `double-tap.ts`)

`{ hole: SelectableHole; at: number; countable: boolean } | undefined`; `DOUBLE_TAP_MS = 400`.

## Tape (unchanged)

The Crank speed stays 1–300 and is never changed by the range.
