# Status

Where work stands right now. Updated in every change (constitution, principle VI).
Plan: [ROADMAP.md](ROADMAP.md) · Decisions: [adr/](adr/README.md) · Language: [DICTIONARY.md](DICTIONARY.md)

## Current slice

**Describe my organ**, on branch `001-describe-my-organ`. The spec is clarified:
[spec.md](../specs/001-describe-my-organ/spec.md).

**Next concrete step:** run `/speckit-plan` for this slice. It decides the snapshot location and
when snapshots are written (ADR 3).

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

- When snapshots are written (debounced on change, on quit). Decide in `/speckit-plan` for
  "Describe my organ". Location is decided: Electron's `userData` folder (choosing a folder may
  come later).
- **Air Demand:** how "too many Pipes at once" depends on which Pipes play. Domain discovery is
  not finished; not in v0.1.
- CI for cross-platform GitHub Releases: there is no remote/workflow yet. Needed before
  releasing v0.1.
