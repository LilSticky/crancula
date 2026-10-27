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

## Edit a tape ([#103](https://github.com/LilSticky/crancula/issues/103)): done

Split by the user on 2026-10-19 ([discovery](discovery/edit-a-tape.md)).

| Slice | Lets the user… | Domain | Adapters | State |
|-------|----------------|--------|----------|-------|
| Place holes by hand ([#105](https://github.com/LilSticky/crancula/issues/105)) | add, move, lengthen or shorten and remove Holes, see Cutting Problems as they happen, undo and redo | Tape | Tape view interaction, snapshot persistence | done |
| Transpose holes ([#106](https://github.com/LilSticky/crancula/issues/106)) | transpose the selected Holes or all of them by semitones | Tape | Tape view | done |
| Adjust a tape ([#107](https://github.com/LilSticky/crancula/issues/107)) | change a Tape's Column length | Tape | Tape view | done |

## Project infrastructure (not slices)

- **GitHub repository**: [LilSticky/crancula](https://github.com/LilSticky/crancula) (public, MIT).
  Tasks, bugs and open questions are Issues; CI runs lint, test and build on every push to `main`
  and every pull request. Progress is tracked on the [Project board](https://github.com/users/LilSticky/projects/1).
  A release workflow (`.github/workflows/release.yml`) packages unsigned builds for all three
  platforms on a `v*` tag and creates a draft GitHub Release; v0.1.0 was published from a tag on 2026-10-18
  ([#11](https://github.com/LilSticky/crancula/issues/11)).
- **Design guide**: done 2026-10-15 ([DESIGN-GUIDE.md](DESIGN-GUIDE.md), #12); applying it to the
  app ([#59](https://github.com/LilSticky/crancula/issues/59), sub-issues #62–#66 and #69) is done with PR #86, before "Punch a tape".

## Next, by version

Decided by the user on 2026-10-23 ([discovery](discovery/later.md)): one capability per minor version.

| Version | Slice | Lets the user… | Domain | Adapters | State |
|---------|-------|----------------|--------|----------|-------|
| v0.2 | Crank a tape | hear a Tape at an adjustable Crank speed (turns per minute), with a playhead, before cutting it | Tape, Organ (Tape per Crank turn) | Web Audio, Tape view, Organ editor | done ([#149](https://github.com/LilSticky/crancula/issues/149)) |
| v0.2 | Edit a tape by touch | add, move, resize and remove Holes by finger, scroll by finger, drag the playhead, set the Crank speed with a slider within the Organ's Crank speed range | Organ (Crank speed range), Tape view (Spot) | Tape view gestures, Organ editor, snapshot v5 | done ([#152](https://github.com/LilSticky/crancula/issues/152)) |
| v0.2 | Ready-made Organs ([#162](https://github.com/LilSticky/crancula/issues/162)) | start a new Organ from a Preset: the 20er- or the 31er-Drehorgel | Organ (Preset) | Organ editor | done |
| v0.2 | Record a tape | save what Crank a tape plays as an audio file | Tape | audio file writer, save dialog | done ([#165](https://github.com/LilSticky/crancula/issues/165)) |
| v0.3 | Bring Scores onto a tape ([#167](https://github.com/LilSticky/crancula/issues/167)) | import MusicXML (one Part per staff, repeats played out); PDF and printed Scores through an outside recognition tool | Song | MusicXML reader | done ([#167](https://github.com/LilSticky/crancula/issues/167)) |
| v0.4 | Cut a tape in pieces ([#168](https://github.com/LilSticky/crancula/issues/168)) | describe a Plotter (name, format, Working area, or a roll plotter that never splits a Tape) and cut a Tape longer than the working length in Tape pieces with a glue Overlap | Plotter, Tape | Plotter editor, snapshot, SVG | done ([#168](https://github.com/LilSticky/crancula/issues/168)) |
| later | Cut several tapes side by side ([#170](https://github.com/LilSticky/crancula/issues/170)) | lay several Tapes side by side across a roll plotter's working width in one cut | Plotter, Tape | SVG | planned |
| later | Read a tape as Scores ([#169](https://github.com/LilSticky/crancula/issues/169)) | export the Tape as MusicXML, Bars from the Song's Time signature | Tape, Song | MusicXML writer | done ([#169](https://github.com/LilSticky/crancula/issues/169), PR [#182](https://github.com/LilSticky/crancula/pull/182), pending merge) |

## Later (unordered)

- More Plotter formats (DXF, HPGL): only when a concrete device needs one.
