# Quickstart: validate "Bring a song onto a tape"

How to prove the slice works end to end. It refers to the [spec](spec.md),
[data model](data-model.md), [research](research.md) and the contracts:
[IPC](contracts/tape-library-ipc.md), [snapshot](contracts/tape-library-snapshot.md),
[domain API](contracts/domain-api.md).

## Prerequisites

- Node 24 (`.node-version`), then `npm ci`.
- No MIDI files are committed (research R8). Tests build them with the SMF test helper. For a
  manual try, use a MIDI file you made yourself, or the fixtures the helper writes to
  `e2e/fixtures/` (committed together with the script that made them).

## Automated checks (the Definition of Done gate)

| Command | Expected |
|---------|----------|
| `npm run lint` | no errors |
| `npm run i18n:check` | every new `TAPE.*` key in `en.json` and `de.json` |
| `npm run test` | Node tests (`api/song`, `api/tape`, `app/`) and Angular tests (`src/`) green, including the 001 tests unchanged |
| `npm run build` | build succeeds |
| `npm run e2e` | Electron flows green: import → Import Summary → Tape view, restart, remove Tape, delete Organ with Tapes, remove a Pipe with Holes, unreadable `tapes.json`, German |

The e2e suite in CI on Linux, Windows and macOS is the proof that the slice runs in Electron
(ADR 13).

## Scenarios the tests cover

Each row names the spec scenario and where it is proven. "Node" is the Node Vitest project,
"Angular" is `ng test`, "e2e" is Playwright in Electron.

| # | Scenario | Expected | Proven in |
|---|----------|----------|-----------|
| 1 | Organ with Pipes C4–C6, melody C3–C5 (Story 1.1) | Transposition +12, every Note a Hole in its transposed Pipe's row | Node, e2e |
| 2 | Song whose Notes all match (1.2) | Transposition 0 | Node |
| 3 | Two quarter Notes on beats 1 and 2 (1.3) | second Hole at Column 8, 8 Columns long before fixes | Node |
| 4 | Note between Column boundaries (1.4), triplets, grace Note | rounded as in research R3, at least one Column | Node |
| 5 | B6 with Pipes C4–C6 (1.5) | Hole in row B5; Import Summary: moved down one octave | Node, Angular |
| 6 | F#4, no F# Pipe (1.6) | not on the Tape; listed as Unplayable Note with note name, Part, Column (from 1) | Node, Angular |
| 7 | 1/32 Note, Minimum Hole Length > one Column (1.7) | lengthened; listed | Node |
| 8 | Repeated Note without pause (1.8), three 1/32 Notes in a row | shortened, or merged with the repetition lost; listed | Node |
| 9 | No Organ stored (1.9) | hint with a link to describe an Organ | Angular, e2e |
| 10 | Not a MIDI file, format 2, time-code, no Notes, > 16 MiB (1.10) | message naming the reason; no Tape | Node, Angular |
| 11 | Restart (2.1, SC-005) | Tape listed; Holes, Column length, Transposition and Organ unchanged | e2e |
| 12 | Remove a Tape, cancel and confirm (2.2) | cancel: unchanged; confirm: gone, also after restart | Angular, e2e |
| 13 | Unreadable `tapes.json` (2.3, SC-007) | message; Organs usable; `tapes.unreadable-*.json` has the original bytes | Node (`app/`), e2e |
| 14 | Delete an Organ with Tapes (2.4) | confirmation names the number of Tapes; both gone after confirming | Angular, e2e |
| 15 | Delete an Organ while Tapes are unreadable (FR-020) | refused with a message | Angular |
| 16 | Remove a Pipe with 5 Holes on 2 Tapes (2.5) | asked before saving (2 Tapes, 5 Holes); confirm: Holes gone after restart, Tapes keep name, other Holes and length; cancel: nothing changes | Angular, e2e |
| 17 | Three Parts, one percussion (3.1–3.3) | names and Note counts; percussion not selected; deselecting updates proposal and Fit; none selected: Create disabled | Angular, e2e |
| 18 | Tape view (4.1–4.4) | one row per Pipe in row order with note names; each Hole at its Column with its length; scrolls along the whole Tape; nothing editable; selected Parts shown | Angular, e2e |
| 19 | Other Transposition (5.1–5.3) | Fit for +7; Tape uses +7; "proposal" restores it; +1 above G9 not allowed | Angular |
| 20 | German (6.1, SC-008) | every label and message German; no raw keys | Angular (i18n parity), e2e |
| 21 | Writing Tapes fails (FR-024) | message; Tape stays in the list | Angular (fake API returns `failed`) |
| 22 | Organs unreadable, Tapes readable (FR-023) | Tapes listed, can't be opened, nothing deleted | Angular, e2e |
| 23 | 5-minute Song, 16 Parts (SC-006) | import under 5 s; Tape view opens under 2 s | Node (pipeline), e2e (view) |

## Manual walkthrough (optional, `npm run electron:local`)

The e2e suite replaces the manual walkthrough as the gate (ADR 13). To look at the slice yourself:

1. In PowerShell, set `$env:CRANCULA_USER_DATA` to an empty folder and start the app.
2. Open **Tapes**: you are told to describe an Organ first. Follow the link and save "Street
   organ" with 31 Pipes from note 53 (as in the 001 quickstart).
3. Open **Tapes**, choose **Bring a song onto a tape**, pick the Organ and a MIDI file. Check the
   Parts, the proposed Transposition and its Fit; try another Transposition and go back to the
   proposal. The name is prefilled with the Song's name, the Column length with 2.5 mm.
4. Create the Tape. The Import Summary is shown above the Tape; Columns in it count from 1.
   Scroll along the Tape; nothing can be changed.
5. Go back to the list: name, Organ, length in Columns and mm. Open the Tape again: no Import
   Summary this time.
6. Quit and restart: the Tape is unchanged.
7. In the Organ editor, remove a Pipe that has Holes and save: you are told how many Tapes and
   Holes are affected. Confirm, then check the Tape: those Holes are gone, the length is the same.
8. Quit, write `{oops` into `<userData>/snapshots/tapes.json`, start again: a message says your
   Tapes couldn't be read, the Organs work, deleting an Organ is refused, and
   `tapes.unreadable-*.json` contains `{oops`.
9. Switch to German and repeat steps 3–5: no untranslated texts.
