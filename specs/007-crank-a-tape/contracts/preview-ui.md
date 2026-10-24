# Contract: Preview UI (test ids for specs and e2e)

## Tape view

| Element | Test id | Behaviour |
|---------|---------|-----------|
| Play/Stop button (toolbar) | `preview-toggle` | `aria-pressed` while playing; label "Preview" / "Stop preview"; disabled with a tooltip when unavailable |
| Playhead line | `playhead` | `data-column` = current Column (rounded to 0.01); visible when stopped too |
| Paused notice | `editing-paused` | shown while playing |
| Unavailable notice | `preview-unavailable` | when the Organ has no Tape per Crank turn; link `preview-open-organ` to the Organ editor |
| Ruler | `ruler` | click sets the start Column |
| Keyboard | — | Space toggles when focus is in the Tape view, not in a text field or button |

## Side panel, Preview section (`cranc-preview-section`)

| Element | Test id | Behaviour |
|---------|---------|-----------|
| Crank speed input | `crank-speed-input` | decimal (comma or point), 1–300; Enter or Apply commits one undo step; enabled while playing |
| Apply | `crank-speed-apply` | disabled when unchanged or invalid |
| Error | `crank-speed-error` | out of range or not a number |
| Start Column | `preview-start-column` | 1..columns, 1-based |
| Duration | `preview-length` | "plays for m:ss" at the current Crank speed |

## Organ editor, Tape Bed sheet

| Element | Test id | Behaviour |
|---------|---------|-----------|
| Tape per Crank turn | `tape-per-crank-turn` | decimal mm, optional; error `data-path="tapePerCrankTurn"` when ≤ 0 |
