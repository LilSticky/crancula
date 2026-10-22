# Quickstart: Adjust a tape

## Automated

```powershell
npm run test            # api/tape/change-column-length.spec.ts, tape-section and column-length-change specs
npm run lint; npm run i18n:check
npm run e2e -- e2e/tape-column-length.spec.ts
```

## By hand (`npm run electron:local`)

1. Describe an Organ (Minimum Hole Length ≈ 4 mm) and bring a MIDI Song onto a Tape at 5 mm per Column.
2. Open the Tape. In the Tape section type `2,5` in Column length: the hint says how many Cutting
   Problems the Tape has now and would have.
3. Press Enter: the Tape is half as long in mm; Holes on the same Pipes and Columns; too-short Holes marked.
4. Undo: 5 mm and the old marks are back. Redo: 2.5 mm again.
5. Type `0`: error, Apply disabled. Type `2,5` again: Apply disabled, no hint.
6. Restart the app: the Tape opens at 2.5 mm.
