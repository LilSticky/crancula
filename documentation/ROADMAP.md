# Roadmap

Ordered slices, cut by domain and user capability (see the constitution). Each slice goes
through Spec Kit on its own branch and is squash-merged into the main branch through a pull
request that closes its issue, once its Definition of Done gate is green (ADR 10). Where work stands right now: [STATUS.md](STATUS.md).

States: `planned` · `in progress` · `done`

## v0.1: MIDI to a cuttable Tape

| Slice | Lets the user… | Domain | Adapters | State |
|-------|----------------|--------|----------|-------|
| Foundation | rely on a written process | constitution, dictionary, ADRs | – | done |
| Describe my organ | define an Organ: Pipes (MIDI note numbers), Tape Bed, Minimum Hole Length, Minimum Gap | Organ | Angular form, snapshot persistence over IPC | planned |
| Bring a song onto a tape | import a MIDI Song Source onto a Tape for an Organ, with automatic Transposition to fit the Pipes | Tape, Song | MIDI import, snapshot persistence | planned |
| Punch a tape | export a Tape as an SVG in mm for a vinyl cutter | Tape | SVG export | planned |

Release v0.1 as cross-platform GitHub Releases built in CI, once all of the above are done.

## Project infrastructure (not slices)

- **GitHub repository**: [LilSticky/crancula](https://github.com/LilSticky/crancula) (private).
  Tasks, bugs and open questions are Issues; CI runs lint, test and build on every push to `main`
  and every pull request. Progress is tracked on the [Project board](https://github.com/users/LilSticky/projects/1).
  Still to do: the release workflow
  ([#11](https://github.com/LilSticky/crancula/issues/11)).
- **Later: design guide.** Create a design guide and unified styling with the frontend-design
  skill, on top of Angular Material.

## Later (unordered)

- **Edit a tape**: add, extend, move and remove Holes; Transposition of all or single notes;
  checks for Minimum Hole Length and Minimum Gap.
- **Crank a tape**: preview playback at an adjustable crank speed.
- **Air Demand**: warn when too many Pipes play at once (domain discovery not finished).
- More Song Sources: MusicXML, PDF, printed Scores.
- More Plotter formats: DXF, HPGL; splitting the Tape into pieces for other devices.
- Export a Song as audio or Scores.
