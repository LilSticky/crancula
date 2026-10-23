# Data model: Crank a tape

## Organ (changed)

| Field | Type | Rule |
|-------|------|------|
| `tapePerCrankTurn` | `Millimetres \| undefined` | absent, or finite and above 0 (violation `tape-per-crank-turn-not-positive`) |

- `OrganDraft.tapePerCrankTurn: number | null`; `emptyOrganDraft` → `null`; `toDraft` copies it.
- Snapshot `organs.json` version 4: `tapePerCrankTurn` written when present. Versions 1–3 load
  without it (ADR 20); a version 4 entry with a value ≤ 0 is rejected like other bad lengths.

## Crank speed (new value)

- `CrankSpeed`: branded number, turns per minute, `1 ≤ v ≤ 300` and finite.
- `crankSpeed(v): CrankSpeed | undefined`; `DEFAULT_CRANK_SPEED = 60`.

## Tape (changed)

| Field | Type | Rule |
|-------|------|------|
| `crankSpeed` | `CrankSpeed` | required; `validTape` refuses others (`crank-speed-out-of-range`) |

- New Tapes (import, `createTape`) get `DEFAULT_CRANK_SPEED`.
- Snapshot `tapes.json` version 2: `crankSpeed` per Tape. Version 1 loads with 60.
- Command `changeCrankSpeed(tape, speed: number): Result<Tape, 'crank-speed-out-of-range'>`; returns
  the same Tape when the value is unchanged (no undo step).

## Performance (read model, never stored)

- `PreviewNote { pipe: MidiNoteNumber; startColumn: number; endColumn: number }` (end exclusive).
- `performance(tape, organ): readonly PreviewNote[]`: one note per Hole whose Pipe is on the Organ,
  touching Holes of one row joined, sorted by `startColumn` then `pipe`.
- `columnDuration(tape, organ): number | undefined`: seconds per Column, `undefined` without
  `tapePerCrankTurn`.
- `previewLength(tape, organ): number | undefined`: `tape.columns × columnDuration` seconds.

## Preview state (renderer, view state)

```text
stopped(playhead) ──play──▶ playing(anchorTime, anchorColumn) ──stop / end / leave──▶ stopped(playhead)
        ▲   │ set start Column                    │ Crank speed changed → re-anchor
        └───┘                                     └───────────────┘
```

- `playhead: number` (Column, fractional while playing), `startColumn` set by ruler or field.
- Unavailable when the Organ has no Tape per Crank turn (reason shown).
