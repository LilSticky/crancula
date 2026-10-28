# Data Model: Off-centre rows on a Tape Bed

## Tape Bed (value, in Organ)

| Field | Type | Rule |
|-------|------|------|
| tapeWidth | Millimetres | > 0 (unchanged) |
| holeDiameter | Millimetres | > 0 (unchanged) |
| rowSpacing | Millimetres | ≥ holeDiameter (unchanged) |
| guideMargin | Millimetres, optional | new; absent = centred; holeDiameter / 2 ≤ guideMargin ≤ tapeWidth − (Row Span − holeDiameter / 2) |

## Borders (derived)

| Field | Centred | With Guide margin |
|-------|---------|-------------------|
| guide | (tapeWidth − Row Span) / 2 | guideMargin − holeDiameter / 2 |
| far | (tapeWidth − Row Span) / 2 | tapeWidth − Row Span − guide |

Row r's centre from the top edge: `guide + holeDiameter / 2 + (r − 1) × rowSpacing`.

## Worked examples

| Organ | Tape width | Hole | Spacing | Pipes | Guide margin | Guide side | Far side |
|-------|-----------|------|---------|-------|--------------|------------|----------|
| 20er Preset | 110 | 3 | 3.85 | 20 | 10 | 8.5 | 25.35 |
| 31er Preset | 140 | 2.5 | 3.86 | 31 | 11 | 9.75 | 11.95 |
| centred 20er | 110 | 3 | 3.85 | 20 | — | 16.925 | 16.925 |

## Violations (OrganViolationCode)

| Code | Path | Params |
|------|------|--------|
| must-be-positive | tapeBed.guideMargin | — |
| guide-margin-below-half-hole | tapeBed.guideMargin | min |
| guide-margin-too-large | tapeBed.guideMargin | max |

## Snapshot

See [contracts/organ-snapshot-v6.md](contracts/organ-snapshot-v6.md).
