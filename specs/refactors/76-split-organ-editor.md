# Refactor 76: split the Organ editor (no behaviour change)

Existing `organ-editor.component.spec.ts` stays the safety net and must stay green untouched.
New components live in subfolders of `src/app/features/organ/organ-editor/`, are OnPush, render the same markup and
`data-testid`s as today (the host wraps the same `<mat-card>`), and move their styles out of the editor's inline `styles`.
Both take the editor's `organ: FieldTree<OrganDraft>` as input (the inputs bind with `[formField]`) and inject `SaveAttempt`
themselves to show the messages (`shownMessages(field, organ, saveAttempt)`); the editor keeps providing `SaveAttempt` and
`ShownViolationMatcher`, so the cards see them through the element injector.

## Components

- `cranc-tape-bed-sheet` (`tape-bed-sheet/tape-bed-sheet.component.ts`): `TapeBedSheetComponent`.
  Inputs `organ = input.required<FieldTree<OrganDraft>>()`, `border: string`, `minimumHoleLength: string`,
  `fit: TapeBedFitText | null`, `drawing: TapeBedDrawing | null` (exported types: the objects the `fit` and `drawing`
  computeds return today). Moves the `tape-bed-sheet` card: fields, error messages, fit check, drawing.
- `cranc-pipe-rack` (`pipe-rack/pipe-rack.component.ts`): `PipeRackComponent`.
  Inputs `organ = input.required<FieldTree<OrganDraft>>()`, `compact: boolean` (editor keeps the BreakpointObserver).
  Outputs `pipeAdded: void`, `pipeMoved: {from: number; to: number}`, `pipeRemoved: number` (row); the editor applies
  `addPipe`/`movePipe`/`removePipe` to the draft. Moves the `pipes-sheet` card: head, add button, rack columns, drag and drop
  (`dropPipe`), menu, Alt+Arrow keys. Owns the note inputs, the rack columns computed, `noteNameOf`, `isSharp`, `pipeCountKey`
  and the focus after a move or removal. Public methods for the editor: `focusNote(row)`, `focusAddPipe()`
  (used by `focusField` of the error summary).

TapeBedSheet's `border`, `minimumHoleLength`, `fit` and `drawing` stay computed in the editor (they read the draft).

## Order

1. Both components and their specs green. 2. Editor uses them; inline styles move with the markup.
After each step the existing editor spec stays green.
