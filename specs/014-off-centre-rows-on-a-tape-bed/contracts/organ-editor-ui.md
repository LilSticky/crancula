# Contract: Organ editor, Tape Bed sheet

| Element | test id | Behaviour |
|---------|---------|-----------|
| Guide margin field | `guide-margin` | Optional decimal, mm suffix, after Spacing between rows; empty = centred |
| Border (read-only) | `border` | Centred: "16.93" with hint "On each side, the rows are centred"; off-centre: "8.5 mm guide side · 25.35 mm far side" with hint "The guide side is row 1's edge" |
| Fit line | (existing) | `FIT*` when centred; `FIT_OFF_CENTRE*` naming both Borders otherwise; `FIT_TOO_WIDE*` unchanged |
| Drawing strips | `tape-bed-border` ×2 | Top strip height = guide side, bottom strip height = far side |
| Errors | at `guide-margin` | `GUIDE_MARGIN_BELOW_HALF_HOLE` ({{min}}), `GUIDE_MARGIN_TOO_LARGE` ({{max}}), `MUST_BE_POSITIVE` |

German: Führungsrand, Rand, Führungsseite, Gegenseite. Every key in `en.json` and `de.json`.
