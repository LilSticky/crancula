# Status

Where work stands right now. Updated in every change (constitution, principle VI).
Plan: [ROADMAP.md](ROADMAP.md) · Decisions: [adr/](adr/README.md) · Language: [DICTIONARY.md](DICTIONARY.md) ·
Issues: [GitHub](https://github.com/LilSticky/crancula/issues)

## Current slice

**Done:** [Bring a song onto a tape](../specs/002-bring-a-song-onto-a-tape/spec.md)
([#2](https://github.com/LilSticky/crancula/issues/2), PR #51, 2026-10-14): all 78 tasks. MIDI Song
import, Tape domain (Quantisation, Transposition, Fit, Hole fixes), Tape library snapshot, IPC and
UI in German and English. Gate: lint, i18n (136 keys), 456 node and 251 Angular tests, build and
31 e2e green locally. The slice's ADRs are 17 and 18.

**Done:** [Describe my organ](../specs/001-describe-my-organ/spec.md) (PR #15, 2026-10-14). Change from
the plan: Angular specs in jsdom ([ADR 9](adr/0009-angular-specs-in-jsdom.md)).

**Tech stack updated** (2026-10-14, [#13](https://github.com/LilSticky/crancula/issues/13),
[ADR 14](adr/0014-current-major-versions-with-dependabot.md)): Angular 22, Material 22, NgRx Signals 22,
ngx-translate 18, Electron 44, TypeScript 6, Vitest 5, Playwright 1.64, ESLint 10 flat config, Node 24;
Dependabot opens weekly grouped updates. Migration fixes: ngx-translate 18 standalone `TranslatePipe`,
`withXhr()` for the HTTP loader, TS 6 `paths` without `baseUrl`, `node16` modules for the main process,
and a storage problem is reported once again (an effect re-ran on language changes). Local gate:
lint, i18n, 130 node + 108 Angular tests and 16 e2e green.

Other changes on 2026-10-14: README for organ owners and MIT license; punched-tape logo, favicon and
app icon; splash for the portable Windows build; fonts ship with the app (#24).

**Organ editor on signal forms** (2026-10-14, [#13](https://github.com/LilSticky/crancula/issues/13),
research R6 revised): `form()` over `OrganDraft`, `[formField]` inputs, one `validateTree` rule fed by
`validateOrgan`, a `ShownViolationMatcher` instead of the `crancErrorState` directive. Lint, i18n,
120 Angular tests and 18 e2e green. Unreadable number text shows "Enter a number.".

**Next concrete step:** `/speckit-specify` for "Punch a tape" ([#3](https://github.com/LilSticky/crancula/issues/3))
after this pull request merges. Draft PR #26 (release workflow) waits for that.

## Known broken / WIP

- `e2e/fonts.spec.ts` "requests no font from an external origin" failed intermittently twice locally
  (`ERR_FILE_NOT_FOUND` on reload). Not reproducible yet.
- Claude triage Action failed with `429 usage_limit_reached` on [#37](https://github.com/LilSticky/crancula/issues/37).
- Fixed on 2026-10-14: fonts no longer load from Google; Roboto and Material
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

- 2026-10-14: commits are authored as LilSticky with the GitHub noreply address, set per repository.
  `main` was rewritten once (force-push with the ruleset paused) to remove `Co-authored-by` lines
  with a work email; the trees are unchanged, all commit SHAs changed. Open branches were rewritten too.
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
- 2026-10-14: automatic issue triage ([#34](https://github.com/LilSticky/crancula/issues/34), ADR 15):
  issue forms add `triage`, the Claude triage Action labels and comments, `/triage` does the same
  locally; `@claude` works in issues and pull requests. Triage verified on [#37](https://github.com/LilSticky/crancula/issues/37) (labelled, commented, `triage` removed). The first runs failed with HTTP 429 because the Claude subscription had hit its session limit; triage shares the user's subscription quota. Still open for the user: confirm the Claude GitHub App for `@claude`, and the board's auto-add workflow.
- 2026-10-14: Dependabot pull requests skip the issue reference check, and patch and minor updates
  squash-merge automatically once CI is green; major updates stay manual (ADR 16, amends ADR 10 and 14).
  Needs the repository setting "Allow auto-merge" to be on.
- 2026-10-14: Dependabot major updates evaluated ([#49](https://github.com/LilSticky/crancula/issues/49)):
  `actions/checkout`, `setup-node` and `upload-artifact` moved to v7. Majors of `@types/node` (until the
  Electron Node runtime moves beyond 24) and `electron-reloader` are held in `dependabot.yml`;
  `electron-reloader` waits for the ESM main process ([#47](https://github.com/LilSticky/crancula/issues/47)).
  A flaky macOS e2e test is tracked in [#48](https://github.com/LilSticky/crancula/issues/48).
