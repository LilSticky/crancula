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

**Design guide** (2026-10-15, [#12](https://github.com/LilSticky/crancula/issues/12)):
[DESIGN-GUIDE.md](DESIGN-GUIDE.md) and [design/theme.scss](design/theme.scss), direction "the organ
builder's workshop" with borrowings, chosen by the user from four parallel variants
([COMPARISON.md](design/COMPARISON.md)); the current UI scores 29/50 in the `ux-review` rubric, the
variants 40–42 (self-reviews). New tooling: `ux-review` skill, `ux-designer` agent, `npm run ux:screens`.
The Tape is drawn horizontally, row 1 on top (user decision). German for Tape is now Lochband
(dictionary, UI texts). Applying the guide to the app: [#59](https://github.com/LilSticky/crancula/issues/59).

**Done:** [#62](https://github.com/LilSticky/crancula/issues/62) theme and fonts
(2026-10-15, PR #70). Noto Sans and Libertinus Serif bundled, Roboto removed.
Workshop theme with light-dark tokens; the scheme follows the system until #63. `provideFormFieldDefaults()`
makes fields outlined app-wide, because the theme's density -2 hides fill-field labels (found by the
ux-review). The Libertinus licence now carries the upstream notice. `ux:screens` waits for dialogs and
animations. ux-review 30/50 (was 29/50), see [design/screens/current/ux-review.md](design/screens/current/ux-review.md).
Gate: lint, 253 Angular tests and node tests, 31 e2e green locally.

**Done (pull request pending):** #63 shell and navigation (2026-10-15). Walnut rail in a `mat-sidenav`
shell (icon rail with tooltips below 1180 px; only the content scrolls). Organs is the start page,
Overview removed. Language and scheme toggles sit in the rail; scheme is System, Light or Dark and is
remembered in localStorage like the language (`SchemePreference`, `LanguagePreference`). Shared
`cranc-page-head` on every page, `cranc-action-bar` ready for #64. Toggle outlines on walnut lightened
to 3:1. ux-review 33/50 (was 30/50), see [design/screens/current/ux-review.md](design/screens/current/ux-review.md).
Gate: lint, i18n, unit tests and 32 e2e green locally.

**Next concrete step:** #64 Organ editor, then #65 Tape view, #66 lists and #69 Tape import
screen (all sub-issues of [#59](https://github.com/LilSticky/crancula/issues/59)). Then
`/speckit-specify` for "Punch a tape" ([#3](https://github.com/LilSticky/crancula/issues/3)).
Open issues carry `priority:` and `size:` labels; triage sets them.

## Known broken / WIP

- `e2e/fonts.spec.ts` "requests no font from an external origin" failed intermittently twice locally
  (`ERR_FILE_NOT_FOUND` on reload). Not reproducible yet.
- Fixed on 2026-10-14: fonts no longer load from Google; Roboto and Material
  Icons ship with the app from `src/fonts/`, licenses in `src/assets/fonts/`
  ([#24](https://github.com/LilSticky/crancula/issues/24)).

## Open questions

- **Air Demand:** how "too many Pipes at once" depends on which Pipes play. Domain discovery is
  not finished; not in v0.1.
- Release workflow ([#11](https://github.com/LilSticky/crancula/issues/11)): `.github/workflows/release.yml`
  packages on Linux, Windows and macOS. A pushed tag `v*` also creates a draft GitHub Release; a
  manual run, or a pull request that changes the workflow or `electron-builder.json`, only builds
  artifacts. Builds are unsigned. v0.0.1 (2026-10-14) is the first release from a tag; v0.1 follows
  when all v0.1 slices are done. Release with `/release` (ADR 19); notes come from `CHANGELOG.md`.

## Process changes

- 2026-10-15: a machine that last pulled before the 2026-10-14 rewrite has a local `main` with no merge
  base; reset it to `origin/main` after checking that every local commit subject exists there.
- 2026-10-15: after every merge the `housekeeper` cleans up the local Git state (pruned remote
  branches, merged local branches and worktrees, stale build output); part of the workflow in AGENTS.md.
- 2026-10-14: commits are authored as LilSticky with the GitHub noreply address, set per repository.
  `main` was rewritten once (force-push with the ruleset paused) to remove `Co-authored-by` lines
  with a work email; the trees are unchanged, all commit SHAs changed. Open branches were rewritten too.
- 2026-10-14: branches reach `main` only through pull requests that reference their issues
  (`Closes #N` / `Refs #N`), then get squash-merged by the agent (ADR 10, constitution 1.1.0).
- 2026-10-14: the e2e suite runs in CI on Linux, Windows and macOS and replaces the manual
  walkthrough as proof that a slice runs in Electron (ADR 13, constitution 1.1.1).
- 2026-10-14: the repository is public, and the ruleset "No direct push to main" enforces ADR 10
  ([#18](https://github.com/LilSticky/crancula/issues/18)): no direct or force pushes, no deletion,
  pull request required (no approvals), the three CI checks "Lint, test and build" and
  "References an issue (ADR 10)" must pass,
  squash merge only; merged branches are deleted. Merging with red CI is no longer possible.
- 2026-10-14: e2e runs keep the Electron window out of sight (`CRANCULA_HEADLESS`, set by the e2e
  launcher); `HEADED=1` shows it, slowed down and traced.
- 2026-10-14: GitHub issue tooling: issue forms per label, a pull request template, a CI check
  that the pull request body references an issue, and the Spec Kit `github` extension
  (`/speckit-github-taskstoissues`). Board automation and the Claude GitHub Action are still open
  ([AGENTIC-TODO](AGENTIC-TODO.md#github)).
- 2026-10-14: automatic issue triage ([#34](https://github.com/LilSticky/crancula/issues/34), ADR 15):
  issue forms add `triage`, the Claude triage Action labels and comments, `/triage` does the same
  locally; `@claude` works in issues and pull requests. Triage verified on [#37](https://github.com/LilSticky/crancula/issues/37) (labelled, commented, `triage` removed). The first runs failed with HTTP 429 because the Claude subscription had hit its session limit; triage shares the user's subscription quota. The Claude GitHub App is installed (`@claude` works) and the board adds new issues itself.
- 2026-10-14: Dependabot pull requests skip the issue reference check, and patch and minor updates
  squash-merge automatically once CI is green; major updates stay manual (ADR 16, amends ADR 10 and 14).
  The repository setting "Allow auto-merge" is on (checked 2026-10-15); no patch or minor update has
  merged itself yet.
- 2026-10-14: Dependabot major updates evaluated ([#49](https://github.com/LilSticky/crancula/issues/49)):
  `actions/checkout`, `setup-node` and `upload-artifact` moved to v7. Majors of `@types/node` (until the
  Electron Node runtime moves beyond 24) and `electron-reloader` are held in `dependabot.yml`;
  `electron-reloader` waits for the ESM main process ([#47](https://github.com/LilSticky/crancula/issues/47)).
  A flaky macOS e2e test is tracked in [#48](https://github.com/LilSticky/crancula/issues/48).
