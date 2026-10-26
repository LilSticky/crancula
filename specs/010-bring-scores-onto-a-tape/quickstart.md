# Quickstart: Bring Scores onto a tape

How to prove the slice works. Types and rules: [data-model.md](data-model.md); UI: [contracts/](contracts/).

## Automated

| What | Command | Shows |
|------|---------|-------|
| XML reader, `.mxl` unzip, content recognition, play-out, Tick layout, ties, grace notes, ornaments, Time signatures, Keys, upbeat, MIDI meta events, snapshot v3 | `npm run test:node` | Stories 1–4 in the domain; SC-001 (same Holes from MIDI and MusicXML), SC-002 (played-out order), SC-003, SC-006 |
| Import screen, how-to dialog, rejection texts, Import Summary rows, Song metre in the Tape details, en/de | `npm run test` (Angular specs in jsdom), `npm run i18n:check` | Stories 1, 4, 5, 6 in the UI |
| Choose a `.musicxml` and an `.mxl` file, create the Tape, restart, choose a PDF | `npm run e2e` (spec `e2e/score-import.spec.ts`) | Stories 1, 4 (restart), 5 in real Electron |
| Lint | `npm run lint` | |

Test fixtures are built in code: MusicXML strings by a helper in `api/song/musicxml/score-test-helper.ts`,
`.mxl` by zipping them with `fflate` in the test, as the MIDI tests build SMF bytes (ADR 17). The e2e test
writes its files to a temporary folder and hands them to the file input with `setInputFiles`.

Performance (SC-005): a node test reads a generated Score of 16 staves and 5 minutes after play-out and
checks it is read in well under 5 s.

## By hand (SC-004, once before merging)

1. Export a short piece with repeats and a da capo from MuseScore as `.musicxml` and as `.mxl`.
2. Run a PDF of a barrel organ tune through Audiveris and export `.mxl`.
3. `npm run electron:local`, bring each onto a Tape for a 20er-Drehorgel Preset Organ: no rejection, the Parts
   are named after the staves, the Import Summary shows grace notes and ornaments left out, the Song metre
   reads as in the Score; Preview the Tape and listen that the repeats are played out.
4. Choose the PDF itself: it is rejected with the way to the how-to; open the how-to in English and German.
