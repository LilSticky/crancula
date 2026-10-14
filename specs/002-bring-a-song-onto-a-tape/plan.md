# Implementation Plan: Bring a song onto a tape

**Branch**: `002-bring-a-song-onto-a-tape` | **Date**: 2026-10-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-bring-a-song-onto-a-tape/spec.md`

## Summary

The user picks one of their Organs and a MIDI file. Crancula reads the Song, lets the user choose
the selected Parts and the Transposition (with a proposal and its Fit), and creates a Tape: Notes
quantised to 1/32 Columns, moved by octaves where needed, merged and fixed for the Minimum Hole
Length and Minimum Gap. The Import Summary is shown once; Tapes are listed, looked at read-only,
removed, and survive a restart. Organ deletion and Pipe removal carry over to the Tapes.

- **Domain:** pure TypeScript in `api/song/` (Song, Parts, Notes; own MIDI reader as an adapter
  in `api/song/midi/`) and `api/tape/` (Tape, Holes, the import pipeline, Fit, Import Summary,
  snapshot parser). Research R1–R6, R10.1.
- **Renderer:** a `TapeLibrary` signal store (Tapes and their Songs), an import page with a
  signal form, a Tape list and a read-only SVG Tape view. The Organ list and Organ editor gain the
  cascades of FR-020 and FR-021. Research R10.2–R10.3, R10.6–R10.10.
- **Persistence:** a new snapshot file `tapes.json` (version 1) next to `organs.json`, written by
  the main process over two new allow-listed channels; the file logic of 001 becomes generic.
  Research R7, R10.4–R10.5.

## Technical Context

**Language/Version**: TypeScript 6.0 (strict), Node 24, Electron 44, Angular 22 (after #13, ADR 14)

**Primary Dependencies**: Angular Material 22, `@angular/forms/signals`, `@ngrx/signals` 22
(named entity collections), `@ngx-translate` 18. **No new runtime dependency**: the Standard MIDI
File reader is written in the domain (research R1; ADR needed, see below).

**Storage**: JSON snapshot `<userData>/snapshots/tapes.json` (format version 1) holding Tapes and
the Songs they reference ([contract](contracts/tape-library-snapshot.md)). `organs.json` is
unchanged, so no migration is needed.

**Testing**:
- Vitest 5 in Node (`vitest.node.config.ts`) for `api/` and `app/`; SMF byte fixtures built by a
  test helper (research R8).
- `ng test` (Vitest, jsdom, ADR 9) for `src/`.
- Playwright Electron e2e with `setInputFiles` for the MIDI file (no native dialog).

**Target Platform**: Electron desktop on Windows, macOS and Linux

**Project Type**: desktop app (Electron main process + Angular renderer + shared domain)

**Performance Goals** (SC-006): reading and bringing a 5-minute Song with 16 Parts onto a Tape
under 5 s (estimated well under 100 ms: O(N) reading, about 33 000 steps per proposal,
O(H log H) Hole fixes); opening that Tape's view under 2 s (a few thousand SVG `rect`s). The
proposal and Fit are recomputed on every change of the selected Parts or Transposition, without a
Web Worker.

**Constraints**: offline; the main process never sees MIDI bytes or paths. A MIDI file is untrusted
input: the reader never throws and rejects files over 16 MiB. An unreadable `tapes.json` is never
overwritten and never makes the Organs unusable (FR-023). Cascades write Tapes before Organs.

**Scale/Scope**: one user, a handful of Organs, tens of Tapes; up to about 10 000 Notes per Song
and about 5 000 Columns × 100 rows per Tape. New screens: Tape list, import page, Tape view (with
the Import Summary), plus three confirmations (remove Tape, delete Organ with Tapes, remove Pipes
with Holes).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|-----------|-------|--------|
| I. Domain-driven slicing | Named after a user capability. MIDI reading, persistence, IPC and UI are adapters inside it. All terms are from DICTIONARY, including Tick, Fit and Import Summary (approved 2026-10-14). Code-only names are not new domain terms: `PartIndex` (a Part's position), `ColumnCount` (a length in Columns), `TapeLibrary` (store, like `OrganLibrary`), `columnLength` ("the physical length of one Column", Tape). The questions this plan raised are settled (below). | ✅ |
| II. TDD | Every task starts red: domain and reader (Node Vitest with byte fixtures), `app/` file and IPC (Node Vitest, temp dirs), store and components (ng test with the in-memory API), flows (Playwright). The refactor to a generic snapshot file happens under the green 001 tests. | ✅ |
| III. Framework-free domain | `api/song/` and `api/tape/` import only each other, `api/organ/` and `api/result.ts`, relatively. The MIDI reader uses only `Uint8Array` reads and the `TextDecoder` global. Invalid Songs and Tapes can't be built: branded types, only via `readMidiSong`, `createTape` and the snapshot parser. | ✅ |
| IV. Memory first, snapshots | `TapeLibrary` is the in-memory truth; `tapes.json` is a versioned snapshot written by main (ADR 8 pattern), loaded on startup, quarantined when unreadable. The domain never touches files; the renderer reads the user-picked MIDI file through the DOM `File` API, which is input, not state. | ✅ |
| V. Strict Electron boundary | Two new allow-listed channels `tapes:load`/`tapes:save`; the preload stays type-only towards `api/`; main validates every `tapes:save` payload with `parseTapeLibrarySnapshot`. No file path or Node access reaches the renderer; no new channel for MIDI. | ✅ |
| VI. Context never lost | STATUS and ROADMAP updated per task group. ADRs 16 (own MIDI reader) and 17 (Tape snapshot, cascade order) are recorded; R7 and R10 hold the remaining decisions. | ✅ |
| VII. Small vertical slices | Usable end to end in Electron (import → summary → view → list → restart). The 001 file code is reused by extraction, not patched. Stories are ordered so P1 alone is shippable. The slice is larger than 001; see Complexity Tracking. | ✅ |
| UI / i18n | Angular Material, minimal SCSS (the Tape view needs a little for the SVG and the fixed labels). Every `TAPE.*` key in en and de, checked by the parity test and `npm run i18n:check`. | ✅ |

**Post-design re-check** (after research R10 and the contracts): still passes. The design adds no
dependency, no new test framework and no new process; the shared `snapshot-file.ts` reduces code.
The Tape view's SVG is a renderer view, not the "Punch a tape" export, so it doesn't pull that
slice in. No violation needs justification.

## ADRs needed

Recorded on 2026-10-14 (status Accepted):

| # | Decision | Source |
|---|----------|--------|
| [17](../../documentation/adr/0017-own-midi-reader-in-the-domain.md) | Read MIDI Song Sources with an own pure-TypeScript SMF reader in the domain, running in the renderer on user-picked bytes, instead of `@tonejs/midi` (settles ADR 5's open "MIDI parser library" consequence). | research R1, R10.6 |
| [18](../../documentation/adr/0018-tape-snapshot-and-cascade-order.md) | Tapes and their Songs live in their own snapshot `tapes.json`, separate from `organs.json`, and cascades write Tapes before Organs; the snapshot-file code is shared (extends ADR 8). | research R7, R10.3, R10.4 |

No snapshot migration ADR is needed: `organs.json` keeps version 1 and `tapes.json` starts at
version 1.

## Open questions

None open. Both questions raised by this plan were **settled by the user on 2026-10-14**:

1. **Domain:** removing a Pipe from an Organ **while the stored Tapes can't be read**. The spec
   refused deleting an Organ in that state (FR-020) but said nothing about removing Pipes (FR-021).
   **Settled:** saving an Organ with removed Pipes is refused with a message, like FR-020; adding
   Pipes, reordering them and every other change stay allowed. Recorded as FR-021a, an edge case
   and a clarification in spec.md.
2. **Dictionary:** the Tape's "length of one Column in mm" (`columnLength` in code).
   **Settled:** "Column length" is a descriptive phrase that may be used in the spec and UI as is;
   no dictionary entry.

## Project Structure

### Documentation (this feature)

```text
specs/002-bring-a-song-onto-a-tape/
├── spec.md
├── plan.md                          # this file
├── research.md                      # R1–R9, plus R10 (stack-dependent decisions, this plan)
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── domain-api.md                # public @api exports of the slice
│   ├── tape-library-ipc.md          # tapes:load / tapes:save, preload API
│   └── tape-library-snapshot.md     # tapes.json, version 1
├── checklists/requirements.md
└── tasks.md                         # /speckit-tasks
```

### Source Code (repository root)

```text
api/
├── index.ts                         # + Song, Tape, pipeline, snapshot and IPC exports
├── result.ts                        # unchanged
├── app/
│   ├── language.ts                  # unchanged
│   └── crancula-api.ts              # moved from organ/; + tapes: load/save and their results
├── organ/                           # unchanged apart from the crancula-api move
├── song/                            # NEW, pure TS
│   ├── song.ts                      # SongId, Tick, TicksPerQuarter, PartIndex, Note, Part, Song
│   ├── midi/
│   │   ├── read-midi-song.ts        # SMF reader → Result<Song, SongRejection>
│   │   ├── smf-test-helper.ts       # builds SMF bytes for tests (R8); used by spec files and e2e
│   │   └── *.spec.ts
│   └── *.spec.ts
└── tape/                            # NEW, pure TS
    ├── tape.ts                      # TapeId, Column, ColumnCount, Transposition, Hole, Tape, removeHolesOfPipes
    ├── quantisation.ts              # Ticks → Columns (R3)
    ├── transposition.ts             # allowedTranspositions, proposeTransposition (R4)
    ├── octave-moves.ts              # 128-entry Pipe table (R5)
    ├── fit.ts                       # fitOf
    ├── hole-fixes.ts                # overlap merge, FR-012 rules (R6)
    ├── import-summary.ts            # ImportSummary, HoleChange
    ├── create-tape.ts               # createTape, prefilledColumnLength, TapeViolation
    ├── tape-library-snapshot.ts     # snapshot v1 types, parseTapeLibrarySnapshot, toTapeLibrarySnapshot
    └── *.spec.ts

app/
├── main.ts                          # + tape library file and handlers; flush both files before quit
├── preload.ts                       # + window.crancula.tapes (type-only imports)
├── snapshot-file.ts                 # NEW: generic load / coalesced atomic save / quarantine (from organ-library-file)
├── organ-library-file.ts            # now configures snapshot-file
├── tape-library-file.ts             # NEW: tapes.json
├── tape-library-ipc.ts              # NEW: TAPE_LIBRARY_CHANNELS, registerTapeLibraryHandlers
└── *.spec.ts

src/app/
├── core/crancula-api.token.ts       # in-memory stand-in gains tapes
├── features/organ/
│   ├── organ-list/                  # delete: names the number of Tapes; refused while Tapes are unreadable
│   └── organ-editor/                # save: asks about removed Pipes with Holes, Tapes first
├── features/tape/                   # NEW
│   ├── tape-library.store.ts        # signalStore: tape + song collections, load/create/remove, cascades API
│   ├── tape-list/                   # list with Organ, length in Columns and mm, open, remove
│   ├── tape-import/                 # tapes/new: file input, Organ, Parts, Transposition + Fit, name, Column length
│   ├── tape-view/                   # tapes/:id: Import Summary (once) + read-only SVG Tape
│   ├── import-summary/              # presentational component for the Import Summary
│   └── routes.ts                    # tapes, tapes/new, tapes/:id
src/app.routes.ts                    # + tapeRoutes

src/assets/i18n/{en,de}.json         # TAPE.* keys, ORGAN.* additions for the cascades
e2e/
├── tape-import.spec.ts              # Story 1, 3, 5 in Electron
├── tape-restart.spec.ts             # Story 2: restart, remove, unreadable tapes.json
├── tape-organ-changes.spec.ts       # delete Organ with Tapes, remove Pipe with Holes
├── tape-german.spec.ts              # Story 6
└── support/midi-file.ts             # feeds setInputFiles with bytes from the SMF test helper
```

**Structure Decision**: the same three layers as slice 001 (ADR 2 to 4): the shared domain in
`api/`, the Electron adapter in `app/`, the Angular adapter in `src/`. Two new domain folders,
one new feature folder; `CranculaApi` moves to `api/app/` because it now spans several
aggregates. Nothing is removed. Whether the SMF test helper lives under `api/song/midi/` (shared
with e2e through `@api`) or under `e2e/support/` with a copy for unit tests is left to the
`test-first` agent; one helper is preferred.

## Order of work (for /speckit-tasks)

Each P1 story is shippable on its own; the order keeps the app working after every task group.

1. Domain: Song model and SMF reader (R1, R2) → Quantisation, Transposition, octave moves, Fit
   (R3–R5) → Hole fixes and `createTape` with the Import Summary (R6) → Tape snapshot (R7).
2. Main process: extract `snapshot-file.ts` under green 001 tests → `tape-library-file.ts` →
   `tapes:*` IPC and preload → flush on quit.
3. Renderer: `TapeLibrary` store → Tape list and remove (Story 2) → import page with defaults
   (Story 1, P1) → Import Summary and Tape view (Story 4) → Parts (Story 3) → other
   Transposition (Story 5).
4. Cascades in the Organ list and Organ editor (FR-020, FR-021, Story 2.4–2.5).
5. German texts throughout (Story 6), e2e flows, STATUS/ROADMAP.

## Complexity Tracking

No constitution violation needs justification. One note for principle VII:

| Concern | Why accepted | Simpler alternative rejected because |
|---------|--------------|-------------------------------------|
| The slice is larger than 001 (reader, pipeline, store, three screens, cascades) | The spec keeps it as one capability; P1 (Stories 1 and 2) alone is usable end to end, P2/P3 stories are independent additions | Splitting the cascades (FR-020/021) into a later slice would let Tapes reference deleted Organs or removed Pipes in between |
