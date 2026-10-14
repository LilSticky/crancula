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

MVP review (Phase 9, T043–T051, 2026-10-14):
- Explicit **Save** replaces autosave (FR-012); leaving with unsaved changes warns and lists broken
  rules with their fields (FR-012a); a change counts as saved only after the write succeeded.
- The application menu is translated and follows the language switch, also after restart (FR-016).
- Main and preload are bundled with esbuild so the packaged app starts ([ADR 12](adr/0012-bundle-electron-main-and-preload.md)).
  Before this, the packaged app crashed: it couldn't find `../api`.

Changes from the plan:
- **Editor:** plain signals instead of signal forms (research R6).
- **Angular specs:** run in jsdom (ADR 9).
- **Error states:** a small `crancErrorState` directive puts form fields into their error state.

Local gate run on 2026-10-14: lint green, test 124 node + 104 Angular passed, i18n:check green,
e2e 13 passed. The manual walkthrough (T041) is replaced by the e2e suite in CI on Linux, Windows
and macOS (ADR 13, constitution 1.1.1).

README rewritten for organ owners (2026-10-14): punched-tape banner (`documentation/images/banner.svg`),
roadmap checklist, glossary and build-from-source steps. The repository is now MIT-licensed (`LICENSE`).

**Next concrete step:** squash-merge [PR #15](https://github.com/LilSticky/crancula/pull/15) once CI,
now including e2e, is green (T042). After that:
- Rebase the tech-stack branch `chore/update-tech-stack` for [#13](https://github.com/LilSticky/crancula/issues/13)
  (on another computer; the user pushes it today). Apply the Angular 22 signal-forms renames (`Field` →
  `FormField`, `[field]` → `[formField]`) and revisit research R6. The rebase also has to account for
  `scripts/bundle-electron.mjs` / `electron:bundle`, which replace `electron:serve-tsc`.
- Then slice 002 "Bring a song onto a tape" ([#2](https://github.com/LilSticky/crancula/issues/2)).

## Known broken / WIP

- No known broken items. #4–#8 are fixed on this branch and close with the merge.

## Open questions

- **Air Demand:** how "too many Pipes at once" depends on which Pipes play. Domain discovery is
  not finished; not in v0.1.
- Release builds: CI (`.github/workflows/ci.yml`) runs lint, test and build on Linux, Windows
  and macOS and should go green with this branch. Packaging now starts locally on Windows (smoke
  launch of the packaged app). CI packaging and GitHub Releases are not set up yet
  ([#11](https://github.com/LilSticky/crancula/issues/11)).

## Process changes

- 2026-10-14: branches reach `main` only through pull requests that reference their issues
  (`Closes #N` / `Refs #N`), then get squash-merged by the agent (ADR 10, constitution 1.1.0).
- 2026-10-14: the e2e suite runs in CI on Linux, Windows and macOS and replaces the manual
  walkthrough as proof that a slice runs in Electron (ADR 13, constitution 1.1.1).
- 2026-10-14: the repository is public, and the ruleset "No direct push to main" enforces ADR 10
  ([#18](https://github.com/LilSticky/crancula/issues/18)): no direct or force pushes, no deletion,
  pull request required (no approvals), the three CI checks "Lint, test and build" must pass,
  squash merge only; merged branches are deleted. Merging with red CI is no longer possible.
- 2026-10-14: e2e runs keep the Electron window out of sight (`CRANCULA_HEADLESS`, set by the e2e
  launcher); `HEADED=1` shows it, slowed down and traced.
