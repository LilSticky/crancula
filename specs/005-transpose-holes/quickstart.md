# Quickstart: validate Transpose holes

## Automated

```powershell
npx vitest run api/tape/transpose-holes.spec.ts   # domain (contracts/domain-api.md 1–9)
npm run test                                       # all unit and component tests
npm run lint; npm run i18n:check
npm run e2e -- e2e/tape-transpose.spec.ts          # transpose → restart; undo in one step
```

## Manual (`npm run electron:local`)

1. Open a Tape with Holes. Choose **Transpose…**, "All Holes", +2: the outcome shows the counts;
   change to +3 and back: it follows. Cancel: nothing changed.
2. Apply +2: every Hole sits two Pipes' notes higher, the resulting Holes are selected. Restart:
   still there.
3. Undo once: the Tape and the selection are as before. Redo: transposed again.
4. Ctrl-click three Holes, drag a frame over two more: five selected, the side panel says "5 Holes
   selected". Transpose "Selected Holes" by −12: only those moved.
5. On an Organ with gaps, pick semitones that remove and merge Holes; the outcome lists the removed
   Holes; after applying, the counts match the Tape (SC-003).
6. Keyboard only: Ctrl+Arrow to extend, Tab to Transpose…, enter semitones, Enter to apply. Switch to
   German and repeat step 1.
