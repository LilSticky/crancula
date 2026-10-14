# Design variants: comparison (2026-10-15)

Four `ux-designer` runs in parallel, one brief each, reviewed with the `ux-review` skill.
Scores are each designer's **self-review**; they cluster at 40–42, so treat the numbers as "all
fixed the baseline's severity-3 findings", not as a ranking. Decide on look and feel.

| Variant | H1 | H2 | H3 | H4 | H5 | H6 | H7 | H8 | H9 | H10 | Total |
|---------|----|----|----|----|----|----|----|----|----|-----|-------|
| Current UI ([review](screens/current/ux-review.md)) | 3 | 3 | 2 | 3 | 3 | 2 | 3 | 3 | 2 | 5 | 29 |
| [A workshop](variants/a-workshop/guide.md) | 4 | 4 | 4 | 4 | 4 | 5 | 4 | 4 | 5 | 4 | 42 |
| [B drafting table](variants/b-drafting-table/guide.md) | 4 | 4 | 4 | 4 | 4 | 5 | 4 | 4 | 3 | 4 | 40 |
| [C calm Material](variants/c-calm-material/guide.md) | 4 | 4 | 4 | 4 | 4 | 4 | 5 | 4 | 3 | 5 | 41 |
| [D fairground](variants/d-fairground/guide.md) | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 5 | 4 | 41 |

Open each `variants/<id>/mockup.html` in a browser, or look at `variants/<id>/screens/`.

## What all four agree on (adopt regardless of the choice)

- Organ editor on one screen: Tape Bed form left, Pipes right, with a live fit check
  ("31 rows take 107,5 mm of the 110 mm between the borders"), and a sticky save bar with
  "Unsaved changes", Discard and Save. No Delete on a new Organ; Save never silently disabled.
- The Tape as the hero: true millimetres on a paper-coloured strip, mm ruler, Column numbers,
  note names per row, Fit / 1:1 zoom, an overview strip, "What changed on import" in a side panel.
- Units inside the fields (`mm` suffix), decimal comma in German, tabular figures.
- Drop the empty Overview page; navigation is Organs and Tapes.

## Decisive differences

| | A workshop | B drafting table | C calm Material | D fairground |
|-|------------|------------------|-----------------|--------------|
| Feel | warm bench: paper, walnut rail, brass for measuring, oxblood for danger | CAD/plotter tool: grid sheet, cobalt signal colour, inspector panel, status bar | stock Material 3, side rail, organ-blue seed, light + dark | navy night scheme, carousel red, gold, poster headings |
| Pipes | 3 columns of 11, no scrolling | 2 tables of 16, shared row toolbar | 1 table that scrolls (11 rows visible) | 3 columns of 11, no scrolling |
| Extra | Tape Bed drawing with dimensions | Selected-Hole inspector, keyboard row moves | dark scheme, error summary linking to fields | ornaments: trim, gold corners, medallion logo |
| Fonts to bundle | Libertinus Serif + Noto Sans | Barlow + JetBrains Mono | none (Roboto) | Abril Fatface + Rubik |
| Risk | 1024 px: Pipe list partly below the fold | reads as generic CAD (H9 3) | least distinctive (H9 3) | dark default in a bright workshop; tight note labels |

## Recommendation

**A workshop**, with two borrowings: B's Selected-Hole inspector and status line in the Tape view,
and C's light/dark scheme and error summary. A is the only variant whose character (H9 5) comes
from the domain itself (paper tape, measuring, the bench) without D's dark default, and its
3×11 Pipe grid solves the long list. Building cost: two OFL fonts and a generated palette.

## Mockup errors to fix in the chosen guide

- D's fit check says 108,5 mm; correct is 30 × 3,5 + 2,5 = 107,5 mm between the borders.
- A and D show an export button as if it worked; export is a later slice (C greys it out, which is right).
- Tape direction and which edge row 1 sits on differ between mockups; settle it once with the user (domain question) and state it in the guide.
- B and D have no Tape list screen.
