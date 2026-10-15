---
name: ux-review
description: Heuristic UX review of Crancula screens — the running app (`npm run ux:screens`) or a static design mockup (HTML) — scored against a fixed rubric so that design variants can be compared side by side. Use when reviewing the current UI, a design variant in documentation/design/variants/, or a UI change before merging, and when asked "how usable is this", "review the design", or "compare the variants".
---

# UX review

A short, repeatable review. The same rubric for every target, so scores of different variants are
comparable. Look at the pixels, not the code.

## 1. Get the screens

| Target | How |
|--------|-----|
| Running app | `npm run ux:screens` → `documentation/design/screens/current/*.png` (1280×800 window, full page). Set `UX_SCREENS_DIR` to write elsewhere. |
| HTML mockup | `npx playwright screenshot --viewport-size=1280,800 --full-page "file:///<absolute path>/mockup.html#<screen>" <out>.png`. Also take one at `1024,700` to check the smallest window. Run `npx playwright install chromium` once if Chromium is missing. |

Read every PNG with the Read tool before judging. A review without looking at the screens is invalid.

## 2. Know the user and the tasks

The user is a hobbyist who owns a barrel Organ and a Plotter (vinyl cutter), on a desktop
(Windows/macOS/Linux), in German or English. Not a designer, not a musician by trade; careful,
detail-oriented, works in millimetres. Core tasks (v0.1), with terms from
`documentation/DICTIONARY.md`:

1. **Describe my Organ**: name, Tape Bed (tape width, border, hole diameter, row spacing, minimum
   gap, minimum hole length, all in mm), and 20–80 Pipes in row order with their MIDI notes.
2. **Bring a Song onto a Tape**: pick a MIDI file, choose an Organ, see what changed on import
   (Transposition, dropped notes, Parts), get a Tape.
3. **Check a Tape**: read the Holes per Column/row, spot problems before cutting.
4. **Export the Tape** as SVG for the Plotter (next slices).

## 3. Score the rubric

Score each heuristic 1–5 (5 = no issues). Note the screen(s) behind every score.

| # | Heuristic | Ask |
|---|-----------|-----|
| H1 | Hierarchy and orientation | Do I know where I am, what this screen is for, and what the primary action is within 3 seconds? |
| H2 | Task flow | Are the core tasks short and in a sensible order? Is the next step always visible (empty states guide onward)? |
| H3 | Density and scanning | Do long lists (31+ Pipes, many Tapes) scan well without endless scrolling? Is whitespace purposeful? |
| H4 | Data entry | Units shown, decimal comma in German, sensible field widths, grouping, keyboard flow, defaults. |
| H5 | Feedback and errors | Validation is specific, placed near the cause, in plain words; saving, unsaved changes and destructive actions are clear. |
| H6 | The Tape as the hero | Is the Tape visualisation legible (rows, Columns, Holes, note labels), true to the physical tape, and the visual centre of the Tape screens? |
| H7 | Consistency and language | One visual language across screens; dictionary terms; Material patterns used the same way everywhere. |
| H8 | Accessibility | Text contrast ≥ 4.5:1 (3:1 for large text and UI parts), visible focus, targets ≥ 24 px, no meaning by colour alone, works with German text expansion (~30 % longer). |
| H9 | Character | Does it feel made for organ owners (craft, paper tape, mechanics) rather than a generic admin template, without hurting H1–H8? |
| H10 | Feasibility | Can it be built on Angular Material 22 (M3 theme tokens, `mat.theme`, component overrides) with minimal SCSS and fonts shipped with the app, no external requests (#24)? |

Total = sum (max 50). Severity of each finding, after Nielsen:
**4** blocks a task · **3** major, frequent · **2** minor · **1** cosmetic.

## 4. Report

Write `ux-review.md` next to the target (for the running app:
`documentation/design/screens/current/ux-review.md`):

```markdown
# UX review: <target> (<date>)

| H1 | H2 | H3 | H4 | H5 | H6 | H7 | H8 | H9 | H10 | Total |
|----|----|----|----|----|----|----|----|----|-----|-------|
| 3  | …  |    |    |    |    |    |    |    |     | 31/50 |

## Findings
1. **[sev 3] H3 · 04-organ-editor-filled** — 31 Pipe rows take five screens of scrolling. Fix: compact table rows (density -2), Tape Bed and Pipes side by side.
2. …

## Strengths
- …
```

Keep findings to the 10 most severe, each with the screen name and a concrete fix. In chat, report
the score line and the top 3 findings only.

## Comparing variants

When several variants exist, read each `ux-review.md` and write
`documentation/design/COMPARISON.md`: one score table (rows = variants), the 2–3 decisive
differences, and a recommendation. Ask the user to choose with AskUserQuestion; the choice is theirs.
