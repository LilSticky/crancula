# Status

Where work stands right now. Updated in every change (constitution, principle VI).
Plan: [ROADMAP.md](ROADMAP.md) · Decisions: [adr/](adr/README.md) · Language: [DICTIONARY.md](DICTIONARY.md) ·
Issues: [GitHub](https://github.com/LilSticky/crancula/issues)

## Current slice

**Bring a song onto a tape** ([#2](https://github.com/LilSticky/crancula/issues/2)) on branch
`002-bring-a-song-onto-a-tape`: spec clarified, research and data model written (docs only, no code yet).

**Done:** [Describe my organ](../specs/001-describe-my-organ/spec.md) (PR #15, 2026-10-14). Changes from
the plan: plain signals instead of signal forms in the editor (research R6), Angular specs in jsdom
([ADR 9](adr/0009-angular-specs-in-jsdom.md)), a small `crancErrorState` directive for error states.

**Tech stack updated** (2026-10-14, [#13](https://github.com/LilSticky/crancula/issues/13),
[ADR 14](adr/0014-current-major-versions-with-dependabot.md)): Angular 22, Material 22, NgRx Signals 22,
ngx-translate 18, Electron 44, TypeScript 6, Vitest 5, Playwright 1.64, ESLint 10 flat config, Node 24;
Dependabot opens weekly grouped updates. Migration fixes: ngx-translate 18 standalone `TranslatePipe`,
`withXhr()` for the HTTP loader, TS 6 `paths` without `baseUrl`, `node16` modules for the main process,
and a storage problem is reported once again (an effect re-ran on language changes). Local gate:
lint, i18n, 130 node + 108 Angular tests and 16 e2e green.

Other changes on 2026-10-14: README for organ owners and MIT license; punched-tape logo, favicon and
app icon; splash for the portable Windows build; fonts ship with the app (#24).

**Next concrete step** (handover, session ended 2026-10-14 ~16:00): get PR #31 green on Linux.
- Since Electron 44, the same 6 e2e tests time out on CI ubuntu-latest (xvfb, hidden window); Windows,
  macOS and local runs are green. Tried and reverted: one worker, `--ozone-platform=x11`, no vsync.
  Latest try `6fa0d40` "keep the hidden e2e window opaque on Linux" (CI run 38593732077, result open).
  Check it with `gh pr checks 31`; earlier runs: `gh run view <id> --log-failed`, traces in the
  `e2e-traces-ubuntu-latest` artifact.
- Also open: `npx tsc -p e2e/tsconfig.e2e.json --noEmit` reports a type error in
  `e2e/support/launch-app.ts` (env object vs. Playwright 1.64 types), and the IDE shows argument-count
  errors in `app/window-options.spec.ts`; check both once #31 is green.
- Then merge #31, rebase `refactor/organ-editor-signal-forms` (pushed, reviewed, all suites green
  locally; R6 moves the Organ editor to signal forms) onto `main`, open its PR (`Refs #13`), merge.
- Then rebase `002-bring-a-song-onto-a-tape` and run `/speckit-plan` for slice 002. Draft PR #26
  (release workflow) waits for that.

## Known broken / WIP

- No known broken items. Fixed on 2026-10-14: fonts no longer load from Google; Roboto and Material
  Icons ship with the app from `src/fonts/`, licenses in `src/assets/fonts/`
  ([#24](https://github.com/LilSticky/crancula/issues/24)).

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
- 2026-10-14: GitHub issue tooling: issue forms per label, a pull request template, a CI check
  that the pull request body references an issue, and the Spec Kit `github` extension
  (`/speckit-github-taskstoissues`). Board automation and the Claude GitHub Action are still open
  ([AGENTIC-TODO](AGENTIC-TODO.md#github)).
