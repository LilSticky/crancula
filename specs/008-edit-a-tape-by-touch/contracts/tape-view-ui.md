# Contract: Tape view editing by touch (UI)

Supersedes the **Pointer** section of
[spec 004's contract](../../004-place-holes-by-hand/contracts/tape-view-ui.md); its keyboard,
controls, messages and persistence sections still hold, with the additions below. Decisions:
[research.md](../research.md). "Tap" = press and release with less than 4 px travel, any pointer type
(ADR 25).

## Pointer and touch (Tape drawing)

| Gesture | Target | Outcome | Undo steps |
|---------|--------|---------|-----------|
| tap | empty place in a row | selects that Spot (`data-testid="spot"`, outlined Hole of Minimum Hole Length); Hole selection cleared | 0 |
| tap | the selected Spot | `addHole` there; new Hole selected; Spot gone | 1 |
| tap | Lead-in, outside the rows | selection cleared | 0 |
| tap | Hole (`hole`) | selects it (Ctrl/Cmd/Shift as today) | 0 |
| tap, tap within 400 ms | same Hole | `removeHole`; selection as after Delete. Not if the first tap added that Hole or had a modifier | 1 |
| drag | Hole body | `moveHole` (unchanged) | 1 |
| drag | grip (`hole-handle`, `data-end="start"\|"end"`) | `changeHoleLength` at that end (unchanged rules) | 1 |
| drag (touch) | empty Tape | the Tape scrolls; no frame, no Spot | 0 |
| drag (mouse, pen) | empty Tape | selection frame (unchanged) | 0 |
| drag | playhead grip (`playhead-grip`) | playhead follows by Columns; if playing, sound stops at the press and goes on from the release | 0 |
| system takes over a touch (pan) | — | `pointercancel`: drag cancelled, nothing changes | 0 |

- Grips: only on the selected Hole, outside it beside each end; visible 6 px bar in the accent
  colour; hit area ≥ 44 × 44 screen px; cursor `ew-resize`. The Hole body is all "move".
- `touch-action`: `pan-x pan-y` on the drawing; `none` on Holes, grips and the playhead grip.
- There is no `dblclick` handler: a mouse double-click on empty Tape is two taps (select, add), on a
  Hole it removes it.

## Keyboard additions (drawing focused)

| Keys | With | Outcome |
|------|------|---------|
| ← → ↑ ↓ | a Spot | Spot one Column / row; clamped |
| Enter | a Spot | `addHole` at the Spot |
| Escape | a Spot | Spot cleared |

## Controls

| Control | Test id | Behaviour |
|---------|---------|-----------|
| Add a Hole | `add-hole` | prefilled from the Spot (Pipe of its row, Column = Spot + 1) |
| Crank speed slider (preview section) | `crank-speed-slider` | `mat-slider` from Slowest to Fastest, step 1; tempo follows while dragging; release = one Crank speed change |
| Outside-range hint | `crank-speed-outside-range` | shown when the Tape's Crank speed is outside the Organ's range; slider at the nearest end |
| Organ editor fields (Tape Bed sheet, after Tape per Crank turn) | `slowest-crank-speed`, `fastest-crank-speed` | decimal input in turns per minute; errors under the fields |

## Messages (en / de, new keys)

| Key | en | de |
|-----|----|----|
| `ORGAN.EDITOR.SLOWEST_CRANK_SPEED` | Slowest Crank speed | Langsamste Kurbelgeschwindigkeit |
| `ORGAN.EDITOR.FASTEST_CRANK_SPEED` | Fastest Crank speed | Schnellste Kurbelgeschwindigkeit |
| `ORGAN.EDITOR.CRANK_SPEED_UNIT` | turns/min | U/min |
| `ORGAN.VIOLATION.CRANK_SPEED_OUT_OF_RANGE` | Enter {{min}} to {{max}} turns per minute. | Gib {{min}} bis {{max}} Umdrehungen pro Minute ein. |
| `ORGAN.VIOLATION.SLOWEST_NOT_BELOW_FASTEST` | The fastest Crank speed must be above the slowest. | Die schnellste Kurbelgeschwindigkeit muss über der langsamsten liegen. |
| `TAPE.PREVIEW.CRANK_SPEED_SLIDER` | Crank speed | Kurbelgeschwindigkeit |
| `TAPE.PREVIEW.OUTSIDE_RANGE` | Outside this Organ's Crank speed range ({{slowest}}–{{fastest}} turns/min). | Außerhalb des Kurbelbereichs dieser Drehorgel ({{slowest}}–{{fastest}} U/min). |
| `TAPE.EDIT.SPOT_LABEL` | Spot: {{pipe}}, Column {{column}}. Tap again or press Enter to add a Hole. | Stelle: {{pipe}}, Spalte {{column}}. Nochmals tippen oder Enter drücken, um ein Loch hinzuzufügen. |

Key names follow the existing namespaces; the implementer aligns them with `en.json` if a namespace
differs.

## Persistence

- Organ snapshot version 5 (`crankSpeedRange`); Tape snapshot unchanged (v2).
- Spot and tap memory are never stored.
