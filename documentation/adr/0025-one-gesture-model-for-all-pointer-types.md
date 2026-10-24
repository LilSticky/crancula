# 25. One gesture model for all pointer types

Date: 2026-10-24

## Status

Accepted

## Context

Edit a tape by touch (#152) makes the Tape view usable by finger. Spec 004 built editing for a mouse:
a double-click on empty Tape added a Hole, handles were strips at most 8 px wide inside the selected
Hole, a drag on empty Tape drew a selection frame, and removing a Hole needed the Delete key. The owner
wants the same gestures to work for finger and mouse. Browsers send `pointer*` events for every
pointer type, but `dblclick` and `click` behave differently by touch, and a finger drag on empty space
is expected to scroll.

## Decision

We will handle the Tape drawing with one gesture model over Pointer Events, for mouse, pen and touch:

- A **tap** is a press and release with less than 4 px travel (`isDrag`). A tap on empty Tape selects a
  Spot; a tap on the selected Spot adds a Hole. Two taps on the same Hole within 400 ms remove it
  (pure `nextTap`). There is no `dblclick` handler: a mouse double-click is two taps.
- A **drag** on a Hole moves it; a drag on a grip outside the selected Hole changes its length. Grips
  and the playhead grip have hit areas of at least 44 × 44 px (24 px tall in the ruler).
- A drag on **empty Tape** depends on the pointer type: touch pans the Tape (`touch-action: pan-x
  pan-y` on the drawing, `none` on Holes and grips; the browser's `pointercancel` ends our gesture),
  mouse and pen draw the selection frame.
- Every gesture keeps its keyboard equivalent.

## Consequences

- One code path per outcome; spec 004 tests that sent a bare `dblclick` now send the two presses a real
  double-click sends.
- A mouse double-click on a Hole now removes it (it did nothing before).
- The double-tap time is fixed at 400 ms; the system setting can't be read in the renderer.
- Pinch zoom and long-press menus are not part of the model; adding them later extends it.
- Playwright can't emulate touch in Electron (`hasTouch` is refused); e2e tests send touch through CDP
  `Input.dispatchTouchEvent`.
