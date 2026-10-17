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

**Done:** #63 shell and navigation (2026-10-15, PR #71). Walnut rail in a `mat-sidenav`
shell (icon rail with tooltips below 1180 px; only the content scrolls). Organs is the start page,
Overview removed. Language and scheme toggles sit in the rail; scheme is System, Light or Dark and is
remembered in localStorage like the language (`SchemePreference`, `LanguagePreference`). Shared
`cranc-page-head` on every page, `cranc-action-bar` ready for #64. Toggle outlines on walnut lightened
to 3:1. ux-review 33/50 (was 30/50), see [design/screens/current/ux-review.md](design/screens/current/ux-review.md).
Gate: lint, i18n, unit tests and 32 e2e green locally.

**Done:** #74 derived Border (2026-10-15, PR #75, merged 2026-10-15). The Border is derived, not entered:
(tape width - Row Span) / 2, rows centred, row 1 nearest the top; 0 is valid, negative means the rows
don't fit. Domain (`border`, `tapeBedFit`, no `border` in `TapeBed`/draft/validation), Organ snapshot
version 2 without `border` (version 1 still reads, [ADR 20](adr/0020-snapshots-migrated-on-read.md)),
dictionary (Tape Bed, Border, Row Span), Organ editor shows the Border read-only, spec 001 amended.
Gate: lint, i18n, 485 node and 315 Angular tests and 34 e2e.

**Done:** #64 Organ editor (2026-10-16, PR #77 merged 2026-10-16). Two sheets: the Tape Bed with a fit
check and a drawing, plus read-only Border and Minimum Hole Length; the Pipes in a 3-column rack
(2 columns below 1180 px) with a row menu and Alt+arrow moves. Decimal fields take a comma or a point,
in the language's notation. Action bar with save state and Discard changes; an error summary on Save;
Delete and the subtitle sit in the page head; "Organ saved" snackbar; calmer leave dialog. The editor
fits one screen at 1280×800 and 1024×700. ux-review 36/50 (was 31/50; values in
[design/screens/current/ux-review.md](design/screens/current/ux-review.md)). #72 fixed on this branch.
Gate: lint, i18n (162 keys), 486 node and 447 Angular tests, e2e green locally. Follow-up:
[#76](https://github.com/LilSticky/crancula/issues/76) splits the editor component.

**Done:** #78 Lead-in (2026-10-16, PR #79 merged 2026-10-16). Every Organ has a Lead-in, the blank Tape
before Column 1 with an angled start (Vorlauf): mm, 0 is valid, negative is not, new Organs start
empty and required. Organ snapshot version 3 with `leadIn`; versions 1 and 2 load with 0
([ADR 20](adr/0020-snapshots-migrated-on-read.md)). The Organ editor shows it after Minimum Gap;
dictionary (Lead-in) and spec 001 (FR-017) amended. Gate: lint, i18n, 495 node and 457 Angular tests,
44 e2e green locally.

**Done:** #65 Tape view (2026-10-16, PR #81 merged 2026-10-16). Tape at true millimetres with the Lead-in
(angled start), rows centred with row 1 on top, Holes drawn as cut (slots with half-circle ends). mm
ruler and Column numbers; zoom Whole Tape / 1:1 / 2:1; overview strip. Side panel with a Tape section,
Import Summary (Transposition, Notes moved by octaves, Unplayable Notes, Holes fixed; dismissable) and
Selected Hole inspector (gap to the next Hole or the Tape's end, warnings below Minimum Hole Length /
Minimum Gap). Keyboard selection; status line with pointer position and save state; Tape details toggle
below 1180 px; only visible Columns render. User decisions 2026-10-16 recorded in
[DICTIONARY](DICTIONARY.md) (Hole shape, Import Summary / Importübersicht / Angepasste Löcher, Lead-in /
Vorlauf). ux-review 38/50 (see [design/screens/current/ux-review.md](design/screens/current/ux-review.md)).
Gate: lint, i18n (197 keys), 495 node and 585 Angular tests, 56 e2e green locally. On macOS CI the
21 layout e2e tests skip because the runner's screen is too small; they run on Windows and Linux.
Follow-up: [#80](https://github.com/LilSticky/crancula/issues/80) splits the Tape view.

**Done:** #66 Organ and Tape lists (2026-10-16, PR #83 merged 2026-10-17). Ledgers (mat-table with column
headers) sorted by name per language. Organ rows show the Pipe range, Tape Bed facts, a Tape Bed
miniature and a Tapes link that filters the Tape list; row menus with Delete. The Tape list is grouped
by Organ with an Organ filter chip. Empty states lead to the next step (describe an Organ first; bring a
Song onto a Tape); next-step strip. User decisions 2026-10-16: no created date, order by name, Pipe range
lowest–highest only, Rename a Tape split to [#82](https://github.com/LilSticky/crancula/issues/82).
ux-review 38/50. Gate: lint, i18n (213 keys), 495 node and 640 Angular tests, 60 e2e green locally.

**Done (pull request pending):** #69 Tape import (2026-10-17). Import screen in two sheets: Song with a
file chip; Organ with the Pipe range, Parts list, Transposition stepper with the proposal explained; Fit
as a result card. Each Fit count expands to its Notes before Create, via a new domain function
`fitNotesOf` that `createTape` shares. Warning when Unplayable Notes are above 0 (Create stays possible).
Column length in mm in the language's notation. The action bar says why Create is disabled. Empty state
without an Organ. Fits one screen at 1024×700; long Parts and Note lists scroll inside. Import Summary
shows "None" for empty items. User decisions 2026-10-17: live Tape preview split to
[#84](https://github.com/LilSticky/crancula/issues/84); Note lists expandable; German percussion is
Schlagwerk (dictionary). ux-review 39/50. Gate: lint, i18n (242 keys), 512 node and 696 Angular tests,
76 e2e green locally. With #69, all sub-issues of [#59](https://github.com/LilSticky/crancula/issues/59)
(apply the design guide) are done; #59 closes with this pull request.

**Done:** Punch a tape ([#3](https://github.com/LilSticky/crancula/issues/3), PR #87 merged 2026-10-17).
Export for the Plotter saves the Tape as one 1:1 SVG: Holes as Slots in cut order by start from the
Lead-in, row 1 first, then the Tape Outline with the Lead-in's diagonal and the end cut one Minimum Gap
after the last Column. A Tape that can't be cut opens a dialog naming every problem Hole (no Pipe, too
short, too close); nothing is written. Selected Hole warnings follow the same Column rules. Below 1180 px
Export is an icon button. German texts. ux-review 40/50 (see [design/screens/current/ux-review.md](design/screens/current/ux-review.md)).
Gate: lint, i18n (251 keys), 640 node and 746 Angular tests, 84 e2e green locally. Tasks in
[tasks](../specs/003-punch-a-tape/tasks.md). **Next step:** take the next triaged `priority: high` issue from the
[ROADMAP](ROADMAP.md); none is open yet, so triage first or pick the next slice ("Edit a tape" is next under Later).

Follow-ups:
[#76](https://github.com/LilSticky/crancula/issues/76), [#80](https://github.com/LilSticky/crancula/issues/80) and
[#85](https://github.com/LilSticky/crancula/issues/85) (component splits),
[#82](https://github.com/LilSticky/crancula/issues/82) (Rename a Tape),
[#84](https://github.com/LilSticky/crancula/issues/84) (live Tape preview),
Lead-in label in the Tape drawing (ux-review finding 11, not filed).
Open issues carry `priority:` and `size:` labels; triage sets them.

## Known broken / WIP

- `e2e/fonts.spec.ts` "requests no font from an external origin" failed intermittently twice locally
  (`ERR_FILE_NOT_FOUND` on reload). Not reproducible yet.

## Open questions

- **Air Demand:** how "too many Pipes at once" depends on which Pipes play. Domain discovery is
  not finished; not in v0.1.
- Release workflow ([#11](https://github.com/LilSticky/crancula/issues/11)): `.github/workflows/release.yml`
  packages on Linux, Windows and macOS. A pushed tag `v*` also creates a draft GitHub Release; a
  manual run, or a pull request that changes the workflow or `electron-builder.json`, only builds
  artifacts. Builds are unsigned. v0.0.1 (2026-10-14) is the first release from a tag; v0.1 follows
  when all v0.1 slices are done. Release with `/release` (ADR 19); notes come from `CHANGELOG.md`.

## Process changes

- 2026-10-17: sessions wrap up before the plan limit cuts them off. The project status line
  (`.claude/hooks/usage-guard.mjs`) records the 5-hour and 7-day usage; at 95% used
  (`CRANCULA_USAGE_WRAP_UP` changes it) a PostToolUse hook tells the session once to commit the work in progress,
  update STATUS with the next step, push and stop. Only Pro/Max sessions get the usage data.
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
