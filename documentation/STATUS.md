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

**Next concrete step:** T031, the delete test in the Organ list spec (User Story 4).

- Leaving the editor with an invalid changed draft asks for confirmation (T030, T034 done).

- Pipes can be reordered and removed in the editor (T029, T033 done).
- The tech-stack update for [#13](https://github.com/LilSticky/crancula/issues/13) is done on branch
  `chore/update-tech-stack` (Angular 22, Electron 44, TypeScript 6.0 because Angular 22 needs <6.1,
  Vitest 5, ESLint 10 flat config, Dependabot). It is not pushed. It lands only after slice 001 is
  merged into `main`. Then rebase it, apply the Angular 22 signal-forms renames (`Field` →
  `FormField`, `[field]` → `[formField]`) and revisit research R6.

## Known broken / WIP

- No known broken items. These are fixed on this branch and close when the slice merges into
  `main`: #4 (build), #5 (no tests), #6 (`window.require`), #7 (localStorage), #8 (`api/model`).
- **Not done yet:**
  - User Story 4: delete an Organ (T031, T032, T035 e2e). Reordering and removing Pipes and the
    leave-invalid confirmation are done.
  - User Story 5: language switch.
  - Polish (T039–T042).
- **ConfirmDialogComponent** (`src/app/features/shared/components/confirm-dialog/`) has hard-coded
  English texts ("Confirm Action", "Cancel", "Confirm") and no i18n keys. Fix with User Story 5 or T039.
- **`npm run i18n:check`:** lists the dynamic `ORGAN.VIOLATION.*` keys and the old prototype keys
  as unused. T039 cleans up the old keys.

## Open questions

- **Air Demand:** how "too many Pipes at once" depends on which Pipes play. Domain discovery is
  not finished; not in v0.1.
- Release builds: CI (`.github/workflows/ci.yml`) runs lint, test and build on Linux, Windows
  and macOS, and is red until the build and test items above are fixed. Packaging v0.1 as
  GitHub Releases is not set up yet ([#11](https://github.com/LilSticky/crancula/issues/11)).

## Process changes

- 2026-10-14: branches reach `main` only through pull requests that reference their issues
  (`Closes #N` / `Refs #N`), then get squash-merged by the agent (ADR 10, constitution 1.1.0).
