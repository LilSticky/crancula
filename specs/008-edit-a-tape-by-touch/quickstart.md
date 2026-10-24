# Quickstart: Edit a tape by touch

## Automated

```powershell
npm run test; npm run lint; npm run i18n:check; npm run e2e
```

e2e touch scenarios use a context with `hasTouch` and `page.touchscreen.tap` (Electron via
Playwright); drags use CDP `Input.dispatchTouchEvent` where `touchscreen` has no move.

## By hand (Windows touch screen)

1. `npm run electron:local`; open an Organ: Slowest 30, Fastest 120 are filled in; set 40–90, save,
   restart, still 40–90. Slowest 90 / Fastest 40 is refused with a message.
2. Open one of its Tapes; with the finger only:
   - tap an empty place: an outlined Hole (the Spot); Add a Hole shows its Pipe and Column;
   - tap it again: a Hole of Minimum Hole Length, selected;
   - drag the right grip two Columns right, the left grip one Column left;
   - drag the Hole one row down;
   - double-tap it: gone; Ctrl+Z three times brings it back step by step;
   - drag over empty Tape: it scrolls, no frame.
3. With the mouse: drag over empty Tape draws a frame; double-click on empty Tape adds a Hole.
4. Start the Preview; drag the playhead to another Column: silence during the drag, sound from the drop.
5. Move the Crank speed slider while playing: the tempo follows; release; Ctrl+Z restores the old speed.
6. Enter 200 in the Crank speed field: kept and played; the slider sits at 90 with the outside-range hint.
