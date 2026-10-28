# Contract: Organ editor, Tape Bed sheet

| Element | test id | Behaviour |
|---------|---------|-----------|
| Guide margin field | `guide-margin` | Optional decimal, mm suffix, after Spacing between rows; empty = centred |
| Border (read-only) | `border` | Centred Organs only: "16.925" with mm suffix and hint "On each side, the rows are centred" |
| Border, guide side (read-only) | `border-guide-side` | Guided Organs only: "8.5" with mm suffix, label "Border, guide side" (de "Rand, Führungsseite"), hint "The guide side is row 1's edge" |
| Border, far side (read-only) | `border-far-side` | Guided Organs only: "25.35" with mm suffix, label "Border, far side" (de "Rand, Gegenseite") |
| Fit line | (existing) | `FIT*` when centred; `FIT_OFF_CENTRE*` naming both Borders otherwise; `FIT_TOO_WIDE*` unchanged |
| Drawing strips | `tape-bed-border` ×2 | Top strip height = guide side, bottom strip height = far side |
| Errors | at `guide-margin` | `GUIDE_MARGIN_BELOW_HALF_HOLE` ({{min}}), `GUIDE_MARGIN_TOO_LARGE` ({{max}}), `MUST_BE_POSITIVE` |

German: Führungsrand, Rand, Führungsseite, Gegenseite. Every key in `en.json` and `de.json`.
