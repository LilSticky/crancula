# Status

Where work stands right now. Updated in every change (constitution, principle VI).
Plan: [ROADMAP.md](ROADMAP.md) · Decisions: [adr/](adr/README.md) · Language: [DICTIONARY.md](DICTIONARY.md) ·
Issues: [GitHub](https://github.com/LilSticky/crancula/issues)

## Current slice

**Describe my organ**, on branch `001-describe-my-organ`. The spec is clarified:
[spec.md](../specs/001-describe-my-organ/spec.md).

The plan is done: [plan.md](../specs/001-describe-my-organ/plan.md). Snapshot writing is decided in
ADR 8, and the Node test setup in ADR 7.

**Next concrete step:** start `/speckit-implement` with Phase 1 of [tasks.md](../specs/001-describe-my-organ/tasks.md) (T001: remove the prototype organ feature).

## Known broken / WIP

- **The app does not build** (`npm run build`), a leftover from the prototype:
  - `pipes-form.component.html` calls a non-existent `pipes()`;
  - a required `model` is unbound (NG8118);
  - `FormTouchedModel` typing errors (TS7053).

  The prototype organ feature is a quarry (constitution, principle VII); the "Describe my organ"
  slice replaces it rather than patching it.
- **`npm run test` exits with an error** because there are no unit tests yet ("No tests found").
  The first TDD cycle fixes this.
- **`ElectronService` uses `window.require`**, which ADR 4 forbids; it is to be replaced by a
  typed preload API.
- **Organs persist to localStorage** via `withStorageSync`, which ADR 3 replaces with file
  snapshots.
- **`api/model` contradicts the dictionary:**
  - `Hole` has no position and has an `opened` flag;
  - `Tape` has no mm per Column;
  - `Tape`/`Grid` are unexported sketches.

## Open questions

- **Air Demand:** how "too many Pipes at once" depends on which Pipes play. Domain discovery is
  not finished; not in v0.1.
- Release builds: CI (`.github/workflows/ci.yml`) runs lint, test and build on Linux, Windows
  and macOS, and is red until the build and test items above are fixed. Packaging v0.1 as
  GitHub Releases is not set up yet ([#11](https://github.com/LilSticky/crancula/issues/11)).
