# Implementation Plan: Bring Scores onto a tape

**Branch**: `010-bring-scores-onto-a-tape` | **Date**: 2026-10-25 | **Spec**: [spec.md](spec.md) | **Issue**: [#167](https://github.com/LilSticky/crancula/issues/167)

**Input**: Feature specification from `specs/010-bring-scores-onto-a-tape/spec.md`

## Summary

MusicXML becomes a second Song Source of "Bring a song onto a tape". On the existing import screen the owner
chooses a MIDI, MusicXML (`.musicxml`, `.xml`) or compressed MusicXML (`.mxl`) file; one entry point in the
domain recognises it by its first bytes. The MusicXML reader (our own non-validating XML reader, `fflate` for
`.mxl`) reads the written measures, plays repeats, endings, da capo and dal segno out into one straight order,
lays the measures onto Ticks, joins ties in played-out order, leaves grace notes and ornaments out and counts
them, and makes one Part per staff. From there the Song is the same kind of Song as from MIDI. Songs, from
Scores and MIDI alike, now keep their Time signatures, upbeat and Keys; the Tape snapshot goes to version 3.
A one-line hint opens an in-app how-to for PDF and printed Scores. Details in [research.md](research.md);
decision in [ADR 27](../../documentation/adr/0027-own-musicxml-reader-in-the-domain.md).

## Technical Context

**Language/Version**: TypeScript (strict), Angular 22, Electron (current major, ADR 14)

**Primary Dependencies**: `fflate` 0.8.3 (MIT) for `.mxl` (R3); everything else is our code

**Storage**: Tape snapshot version 3 (`SongSnapshot` + `timeSignatures`, `upbeat`, `keys`), migrated on read
(ADR 20, R11)

**Testing**: Vitest in node (XML reader, unzip, recognition, play-out, Tick layout, ties, counts, metre,
MIDI meta events, snapshot v3, `createTape` with `leftOut`), Vitest in jsdom (import screen, how-to dialog,
Import Summary rows, metre in the Tape details), Playwright e2e `e2e/score-import.spec.ts` (real Electron:
`.musicxml` and `.mxl` to a Tape, restart, PDF rejection and how-to)

**Target Platform**: Electron desktop on Windows, macOS, Linux

**Project Type**: desktop app (Angular renderer, Electron main, shared `api/`)

**Performance Goals**: 5-minute Score (played out), 16 staves, read in under 5 s (SC-005)

**Constraints**: 16 MiB per file and per Score inside an `.mxl`; no DTD or external entity resolution; no
new IPC channel; Tick < 2^31, Ticks per quarter ≤ 32767 (R6)

**Scale/Scope**: Scores of a few thousand Notes per staff after play-out; up to ~20 staves

## Constitution Check

| Principle | Check | Result |
|-----------|-------|--------|
| I. Domain-Driven Slicing | A Song Source adapter inside "Bring a song onto a tape"; terms Time signature, Bar, Key, Scores approved (#171, Key plural 2026-10-25); staff, voice, grace note, ornament, tie, ending, measure stay inside the MusicXML reader | Pass |
| II. TDD | Every task starts with a failing test; fixtures are MusicXML strings and zipped strings built in tests | Pass |
| III. Framework-Free Domain | Reader, play-out, metre and snapshot in `api/`; `fflate` is pure JS with no Node or browser import; UI only formats and shows | Pass |
| IV. Memory First | Snapshot version 3, versions 1–2 migrated on read, nothing lost (FR-019) | Pass |
| V. Strict Electron Boundary | No new channel; the grown Song payload is validated by `parseTapeLibrarySnapshot` on both sides | Pass |
| VI. Context Never Gets Lost | ADR 27, STATUS, ROADMAP; DICTIONARY done in #171 and on this branch | Pass |
| VII. Small Vertical Slices | US1 end to end first (no repeats), then repeats, ties/counts, metre, how-to; each usable | Pass |

Post-design re-check: unchanged, pass. One new dependency, justified in R3 and ADR 27.

## Project Structure

### Documentation (this feature)

```text
specs/010-bring-scores-onto-a-tape/
├── spec.md, open-questions.md, plan.md, research.md, data-model.md, quickstart.md
├── contracts/tape-library-snapshot.md, contracts/score-import-ui.md
└── tasks.md
```

### Source Code (repository root)

```text
api/song/
├── song.ts                     # + TimeSignature, Key, upbeat on Song; rules in song()
├── song-metre.ts               # first Time signature, Key, upbeat as a fraction (FR-020)
├── read-song-source.ts         # bytes → MIDI | mxl | MusicXML | pdf | rejection; SongReading, LeftOut, SongRejection
├── midi/read-midi-song.ts      # + meta events 0x58, 0x59 (Time signature, Key)
└── musicxml/
    ├── xml.ts                  # own XML reader → XmlElement tree (R2)
    ├── mxl.ts                  # fflate: container.xml → rootfile, size check (R3)
    ├── score-measures.ts       # tree → written measures per part with what is in force (R8)
    ├── play-out.ts             # MeasureMarks[] → played measure order (R7)
    ├── lay-out.ts              # played measures → Notes per staff, ties, counts, Time signatures, Keys, upbeat
    ├── read-score-song.ts      # bytes/text → SongReading | rejection; Part names, percussion, title
    └── score-test-helper.ts    # builds MusicXML strings for tests
api/tape/create-tape.ts         # + optional leftOut → ImportSummary.leftOut
api/tape/import-summary.ts      # + LeftOut
api/tape/tape-library-snapshot.ts # version 3
api/index.ts                    # exports readSongSource, songMetre, new types
src/app/features/tape/tape-import/
├── tape-import.component.*     # readSongSource, accept list, hint, metre, title prefill, leftOut to createTape
└── score-how-to-dialog/        # the how-to dialog (FR-021)
src/app/features/tape/import-summary/ # grace notes and ornaments rows
src/app/features/tape/song-metre/     # small presentational component, used on both screens
src/app/features/tape/tape-view/      # metre in the Tape details
src/assets/i18n/{en,de}.json    # TAPE.IMPORT.*, TAPE.SONG_REJECTION.*, TAPE.SCORE_HOW_TO.*, TAPE.METRE.*, TAPE.SUMMARY.*
e2e/score-import.spec.ts
package.json                    # + fflate 0.8.3
```

**Structure Decision**: the reader sits next to the MIDI reader under `api/song/`; the import screen swaps
`readMidiSong` for `readSongSource` and otherwise keeps its flow, so FR-011 holds by construction.

## Decisions left open by the spec

- **Counting in played-out order**: grace notes and ornaments in a repeated Bar count once per pass, like the
  Notes on the Tape (R8).
- **Ticks per quarter**: the LCM of all divisions, fallback 960 with rounding (R6).
- **`score-timewise`** files are read too (R5); `opus` files are rejected as `not-a-score`.
- **Modes**: `minor`/`aeolian` keep minor; other modes (dorian, …) keep their sharps and flats as major (R9).
- **Jump words** for files without `<sound>` jump attributes: D.C., Da Capo, D.S., Dal Segno, Fine, To Coda,
  case-insensitive (R7). Other spellings play straight through, without a report (spec edge case).
- **Rejection codes**: `too-large` replaces the size check in the component; `pdf`, `not-a-song-source`,
  `not-a-score`, `damaged-archive`, `no-score-in-archive` are new (data-model).

## Open questions

None blocking. For the user to confirm while reviewing the slice (no domain term involved): the how-to's wording
and its five steps (contracts/score-import-ui.md).

Decided (user, 2026-10-25): the import button label, today "Choose a MIDI file", becomes "Choose a Song Source"
(German "Notenquelle wählen"); German for Song Source is Notenquelle.

## Complexity Tracking

| Item | Why needed | Simpler alternative rejected because |
|------|------------|--------------------------------------|
| Own XML reader | Domain tests run in node; untrusted files declare an external DTD | `DOMParser` isn't in node; libraries add options and advisories for a small subset (ADR 27) |
| `fflate` dependency | `.mxl` is a deflated zip (SC-004, Audiveris) | Own inflate is out of proportion; `DecompressionStream` makes the reader async |
