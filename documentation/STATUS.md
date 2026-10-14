# Status

Where work stands right now. Updated in every change (constitution, principle VI).
Plan: [ROADMAP.md](ROADMAP.md) · Decisions: [adr/](adr/README.md) · Language: [DICTIONARY.md](DICTIONARY.md) ·
Issues: [GitHub](https://github.com/LilSticky/crancula/issues)

## Current slice

**Describe my organ** is done on branch `001-describe-my-organ` and in review through a pull request
(ADR 10). The spec is clarified: [spec.md](../specs/001-describe-my-organ/spec.md).

All user stories 1–5 are done:
- Define an Organ; invalid Organs are never stored and show their broken rules.
- Survives a restart; an unreadable snapshot is reported and kept.
- Change and remove an Organ, including delete with confirmation.
- Reorder and remove Pipes in the editor; leaving an invalid changed draft asks for confirmation.
- Switch between German and English, remembered between starts ([ADR 11](adr/0011-ui-preferences-in-local-storage.md)).

Changes from the plan:
- **Editor:** plain signals instead of signal forms (research R6).
- **Angular specs:** run in jsdom (ADR 9).
- **Error states:** a small `crancErrorState` directive puts form fields into their error state.

Gate run on 2026-10-14: lint green, test 70 passed, build green, i18n:check 48 keys 0 errors 0 unused,
e2e 11 passed.

**Next concrete step:** the user's walkthrough (T041, [quickstart.md](../specs/001-describe-my-organ/quickstart.md))
on the pull request, then squash-merge once CI is green. After that:
- Rebase the tech-stack branch `chore/update-tech-stack` for [#13](https://github.com/LilSticky/crancula/issues/13)
  (on another computer; the user pushes it today). Apply the Angular 22 signal-forms renames (`Field` →
  `FormField`, `[field]` → `[formField]`) and revisit research R6.
- Then slice 002 "Bring a song onto a tape" ([#2](https://github.com/LilSticky/crancula/issues/2)).

## Known broken / WIP

- No known broken items. #4–#8 are fixed on this branch and close with the merge.

## Open questions

- **Air Demand:** how "too many Pipes at once" depends on which Pipes play. Domain discovery is
  not finished; not in v0.1.
- Release builds: CI (`.github/workflows/ci.yml`) runs lint, test and build on Linux, Windows
  and macOS and should go green with this branch. Packaging v0.1 as GitHub Releases is not set up
  yet ([#11](https://github.com/LilSticky/crancula/issues/11)).

## Process changes

- 2026-10-14: branches reach `main` only through pull requests that reference their issues
  (`Closes #N` / `Refs #N`), then get squash-merged by the agent (ADR 10, constitution 1.1.0).
