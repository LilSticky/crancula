# Roadmap

Ordered slices, cut by domain and user capability (see the constitution). Each slice goes
through Spec Kit on its own branch and is squash-merged into the main branch through a pull
request that closes its issue, once its Definition of Done gate is green (ADR 10). Where work stands right now: [STATUS.md](STATUS.md).

States: `planned` · `in progress` · `done`

## v0.1: MIDI to a cuttable Tape

| Slice | Lets the user… | Domain | Adapters | State |
|-------|----------------|--------|----------|-------|
| Foundation | rely on a written process | constitution, dictionary, ADRs | – | done |
| Describe my organ | define an Organ: Pipes (MIDI note numbers), Tape Bed, Minimum Hole Length, Minimum Gap | Organ | Angular form, snapshot persistence over IPC | done |
| Bring a song onto a tape | import a MIDI Song Source onto a Tape for an Organ, with automatic Transposition to fit the Pipes | Tape, Song | MIDI import, snapshot persistence | done |
| Apply the design guide (not a slice) | use the existing screens in the workshop design: theme, shell, Organ editor, Tape view, lists | – | Angular Material theme, components | done (PR #86 merged 2026-10-17, [#59](https://github.com/LilSticky/crancula/issues/59)) |
| Punch a tape | export a Tape as an SVG in mm for a vinyl cutter | Tape | SVG export | done |

Released as v0.1.0 on 2026-10-18: cross-platform GitHub Releases built in CI.

## Next: Edit a tape ([#103](https://github.com/LilSticky/crancula/issues/103))

Split by the user on 2026-10-19 ([discovery](discovery/edit-a-tape.md)).

| Slice | Lets the user… | Domain | Adapters | State |
|-------|----------------|--------|----------|-------|
| Place holes by hand ([#105](https://github.com/LilSticky/crancula/issues/105)) | add, move, lengthen or shorten and remove Holes, see Cutting Problems as they happen, undo and redo | Tape | Tape view interaction, snapshot persistence | done |
| Transpose holes ([#106](https://github.com/LilSticky/crancula/issues/106)) | transpose the selected Holes or all of them by semitones | Tape | Tape view | done |
| Adjust a tape ([#107](https://github.com/LilSticky/crancula/issues/107)) | change a Tape's Column length | Tape | Tape view | planned (later) |

## Project infrastructure (not slices)

- **GitHub repository**: [LilSticky/crancula](https://github.com/LilSticky/crancula) (public, MIT).
  Tasks, bugs and open questions are Issues; CI runs lint, test and build on every push to `main`
  and every pull request. Progress is tracked on the [Project board](https://github.com/users/LilSticky/projects/1).
  A release workflow (`.github/workflows/release.yml`) packages unsigned builds for all three
  platforms on a `v*` tag and creates a draft GitHub Release; v0.1.0 was published from a tag on 2026-10-18
  ([#11](https://github.com/LilSticky/crancula/issues/11)).
- **Design guide**: done 2026-10-15 ([DESIGN-GUIDE.md](DESIGN-GUIDE.md), #12); applying it to the
  app ([#59](https://github.com/LilSticky/crancula/issues/59), sub-issues #62–#66 and #69) is done with PR #86, before "Punch a tape".

## Later (unordered)

- **Crank a tape**: preview playback at an adjustable crank speed.
- **Air Demand**: warn when too many Pipes play at once (domain discovery not finished).
- More Song Sources: MusicXML, PDF, printed Scores.
- More Plotter formats: DXF, HPGL; splitting the Tape into pieces for other devices.
- Export a Song as audio or Scores.
