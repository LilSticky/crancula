# Roadmap

Ordered slices, cut by domain and user capability (see the constitution). Each slice goes through Spec Kit on its own
branch and is squash-merged into the main branch through a pull request that closes its issue, once its Definition of
Done gate is green (ADR 10). Where work stands right now: [STATUS.md](STATUS.md). What each release brought:
[CHANGELOG.md](../CHANGELOG.md).

States: `planned` · `in progress` · `in review`

## Next

| Slice | Lets the user… | Domain | Adapters | State |
|-------|----------------|--------|----------|-------|
| – | No slice is planned; open issues come first. | | | |

## Later (unordered)

- More Plotter formats (DXF, HPGL): only when a concrete device needs one.

## Done

Order and versions of the slices after v0.1 were decided by the user on 2026-10-23 ([discovery](discovery/later.md)).
Specs are in `specs/NNN-slice/`.

| Slice | Issue | Released in |
|-------|-------|-------------|
| Foundation (constitution, dictionary, ADRs) | – | v0.0.1 |
| Describe my organ | – | v0.0.1 |
| Bring a song onto a tape | [#2](https://github.com/LilSticky/crancula/issues/2) | v0.0.1 |
| Apply the design guide (not a slice) | [#59](https://github.com/LilSticky/crancula/issues/59) | v0.1.0 |
| Punch a tape | [#3](https://github.com/LilSticky/crancula/issues/3) | v0.1.0 |
| Edit a tape: Place holes by hand, Transpose holes, Adjust a tape | [#103](https://github.com/LilSticky/crancula/issues/103) | v0.1.1 |
| Crank a tape | [#149](https://github.com/LilSticky/crancula/issues/149) | v0.2.0 |
| Edit a tape by touch | [#152](https://github.com/LilSticky/crancula/issues/152) | unreleased |
| Ready-made Organs (Presets) | [#162](https://github.com/LilSticky/crancula/issues/162) | unreleased |
| Record a tape | [#165](https://github.com/LilSticky/crancula/issues/165) | unreleased |
| Bring Scores onto a tape | [#167](https://github.com/LilSticky/crancula/issues/167) | unreleased |
| Cut a tape in pieces | [#168](https://github.com/LilSticky/crancula/issues/168) | unreleased |
| Read a tape as Scores | [#169](https://github.com/LilSticky/crancula/issues/169) | unreleased |
| Cut several tapes side by side | [#170](https://github.com/LilSticky/crancula/issues/170) | unreleased |
| Off-centre rows on a Tape Bed | [#163](https://github.com/LilSticky/crancula/issues/163) | unreleased |

## Project infrastructure (not slices)

- **GitHub repository**: [LilSticky/crancula](https://github.com/LilSticky/crancula) (public, MIT). Tasks, bugs and
  open questions are Issues; progress is tracked on the [Project board](https://github.com/users/LilSticky/projects/1).
  CI runs lint, test, build and e2e on Linux, Windows and macOS for every pull request. The release workflow
  (`.github/workflows/release.yml`) packages unsigned builds for all three platforms on a `v*` tag and creates a draft
  GitHub Release; release with `/release` (ADR 19).
- **Design guide**: [DESIGN-GUIDE.md](DESIGN-GUIDE.md) and [design/theme.scss](design/theme.scss), "the organ builder's
  workshop" (#12).
