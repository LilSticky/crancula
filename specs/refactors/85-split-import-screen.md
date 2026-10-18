# Refactor 85: split the Tape import screen (no behaviour change)

Existing `tape-import.component.spec.ts` stays the safety net and must stay green untouched.

## Component

`cranc-tape-fit-card` (`tape-import/tape-fit-card/tape-fit-card.component.ts`): `TapeFitCardComponent`, OnPush.
Moves the contents of the `fit-sheet` card (the `fit` div, rows, Fit Notes lists, warning, empty sentence) with the
same markup and `data-testid`s; the `mat-card` with `data-testid="fit-sheet"` stays in `TapeImportComponent`
(or the host is the card, keeping the testid on an element that wraps the same content).
Inputs:

- `fit = input.required<Fit | null>()`
- `fitNotes = input.required<FitNotes>()` (`{movedByOctaves, unplayableNotes}`, already ordered by Column, then Part;
  the type is exported from `@api/index`)
- `partLabels = input.required<readonly string[]>()` (the label of each Part, by index; the card reads it as
  `partLabels()[part]`)
- `notesShown = input.required<boolean>()` (the Fit Note lists show only for a Transposition the form accepts)
- `disclosureKey = input<object>()`: a new value (another Song or choice of Parts) closes both lists.

The card owns the disclosure state (`movedOpen`, `unplayableOpen`, `toggleMoved`, `toggleUnplayable`).
Styles move out of the inline `styles` into `.scss` files (card styles to `tape-fit-card.component.scss`,
the rest of the screen to `tape-import.component.scss`).

## Placement once

`api/tape/fit.ts` gets `fitAndNotesOf(song, selectedParts, organ, transposition)` returning
`{fit: Fit, movedByOctaves, unplayableNotes}` from one `placedNotesOf` call; same results as `fitOf` and `fitNotesOf`.
`fitOf` and `fitNotesOf` stay (tests and `createTape` use them). Export `fitAndNotesOf` and `FitNotes` from `api/index.ts`.
`TapeImportComponent` replaces its `fit` and `fitNotes` computeds with one computed on `fitAndNotesOf`.

## Order

1. `fitAndNotesOf` (domain spec green).
2. `TapeFitCardComponent` (its spec green), wire it into the import screen.
3. Styles to `.scss`. After each step the existing import spec stays green.
