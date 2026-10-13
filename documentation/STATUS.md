# Status

Where work stands right now. Updated in every change (constitution, principle VI).
Plan: [ROADMAP.md](ROADMAP.md) · Decisions: [adr/](adr/README.md) · Language: [DICTIONARY.md](DICTIONARY.md) ·
Issues: [GitHub](https://github.com/LilSticky/crancula/issues)

## Current slice

**Describe my organ**, on branch `001-describe-my-organ`. The spec is clarified:
[spec.md](../specs/001-describe-my-organ/spec.md).

The **MVP is done** (T001–T028, User Stories 1–3) and waits for the user's review in Electron
(`npm run electron:local`; walkthrough in [quickstart.md](../specs/001-describe-my-organ/quickstart.md)).
Organs can be defined, invalid ones are never stored and show their broken rules, and they survive a
restart. An unreadable snapshot is reported and kept.

Changes from the plan:
- **Editor:** plain signals instead of signal forms (research R6).
- **Angular specs:** run in jsdom (ADR 9).
- **Error states:** a small `crancErrorState` directive puts form fields into their error state.

**Next concrete step:** update the tech stack and add Dependabot, on its own branch from `main`
([#13](https://github.com/LilSticky/crancula/issues/13)). Then switch the editor back to signal forms where the newer Angular allows it
(research R6), and continue with User Story 4 (T029). Restart the session first, so the new agents
from `main` are loaded.

## Known broken / WIP

- No known broken items. These are fixed on this branch and close when the slice merges into
  `main`: #4 (build), #5 (no tests), #6 (`window.require`), #7 (localStorage), #8 (`api/model`).
- **Not done yet:**
  - User Story 4: reorder and remove Pipes, delete an Organ, confirm before leaving with
    invalid changes.
  - User Story 5: language switch.
  - Polish (T039–T042).
- **German texts to review:** the German UI terms are first guesses: "Drehorgel", "Pfeife",
  "Bandbett" (Tape Bed), "Reihenabstand", "Mindestabstand", "Mindestlochlänge".
- **`npm run i18n:check`:** lists the dynamic `ORGAN.VIOLATION.*` keys and the old prototype keys
  as unused. T039 cleans up the old keys.

## Open questions

- **Air Demand:** how "too many Pipes at once" depends on which Pipes play. Domain discovery is
  not finished; not in v0.1.
- Release builds: CI (`.github/workflows/ci.yml`) runs lint, test and build on Linux, Windows
  and macOS, and is red until the build and test items above are fixed. Packaging v0.1 as
  GitHub Releases is not set up yet ([#11](https://github.com/LilSticky/crancula/issues/11)).
