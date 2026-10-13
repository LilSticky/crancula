# Status

Where work stands right now. Updated in every change (constitution, principle VI).
Plan: [ROADMAP.md](ROADMAP.md) · Decisions: [adr/](adr/README.md) · Language: [DICTIONARY.md](DICTIONARY.md) ·
Issues: [GitHub](https://github.com/LilSticky/crancula/issues)

## Current slice

**Describe my organ**, on branch `001-describe-my-organ`. The spec is clarified:
[spec.md](../specs/001-describe-my-organ/spec.md).

Phases 1–2 of [tasks.md](../specs/001-describe-my-organ/tasks.md) are done (T001–T015): the Organ
domain in `api/organ/`, the snapshot file and IPC in `app/`, the sandboxed preload, and the
`OrganLibrary` store. There is no Organ UI yet. Angular specs run in jsdom (ADR 9).

**Next concrete step:** T016, the failing component test for the Organ list (User Story 1).
The MVP goes up to T028; then stop so the user can review in Electron.

## Known broken / WIP

- No known broken items. These are fixed on this branch and close when the slice merges into
  `main`: #4 (build), #5 (no tests), #6 (`window.require`), #7 (localStorage), #8 (`api/model`).
- The Organ feature has no UI until User Story 1 is done; the navbar shows only Home.

## Open questions

- **Air Demand:** how "too many Pipes at once" depends on which Pipes play. Domain discovery is
  not finished; not in v0.1.
- Release builds: CI (`.github/workflows/ci.yml`) runs lint, test and build on Linux, Windows
  and macOS, and is red until the build and test items above are fixed. Packaging v0.1 as
  GitHub Releases is not set up yet ([#11](https://github.com/LilSticky/crancula/issues/11)).
