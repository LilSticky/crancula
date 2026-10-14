# Crancula Agent Instructions

Crancula is a hobby desktop app (Electron + Angular 22) that turns music into a punched Tape for the
user's own barrel Organ, cut by a Plotter. v0.1: describe an Organ, bring a MIDI Song onto a Tape,
export the Tape as SVG for a vinyl cutter.

The project has stalled several times from lost context. Everything you need to resume lives in the
repository. Keep it that way.

## Start here

Read [`documentation/STATUS.md`](documentation/STATUS.md) first: the current slice, the **one next
step**, known broken/WIP items, and open questions. Then read only what that step needs:

| When you… | Read |
|-----------|------|
| work on a slice | `specs/<slice>/` (spec, plan, tasks) |
| name anything in code, tests, UI or docs | [`documentation/DICTIONARY.md`](documentation/DICTIONARY.md) |
| make or question an architecture decision | the [ADR index](documentation/adr/README.md), then the ADRs it points to |
| plan, check the Definition of Done, or merge | [`.specify/memory/constitution.md`](.specify/memory/constitution.md); it overrides this file if the two disagree |
| change slice order or scope | [`documentation/ROADMAP.md`](documentation/ROADMAP.md) |

## Documentation sources

| Source | Purpose | Update when |
|--------|---------|-------------|
| `documentation/STATUS.md` | Where work stands right now | Every change |
| `documentation/ROADMAP.md` | Slices, ordered by domain capability | A slice changes state or scope |
| `documentation/DICTIONARY.md` | Domain terms | A term is added or clarified (only with user approval) |
| `documentation/adr/` | Architecture decisions (Nygard) | A significant decision is made (`adr` skill) |
| `.specify/memory/constitution.md` | Principles, Definition of Done, governance | Only through an ADR plus a version bump |
| `specs/NNN-slice/` | Spec Kit artifacts per slice (spec, plan, tasks) | During the slice |
| `documentation/AGENTIC-TODO.md` | Agent tooling still to build | Tooling is added |
| [GitHub Issues](https://github.com/LilSticky/crancula/issues) | Bugs, slices, open questions (`gh issue`) | A bug or question is found or resolved |

## Workflow

- **Slices by domain, not technology.** Name a slice after what it lets the user do ("Describe my
  organ"), never after a layer or format ("SVG export", "persistence"). Formats, persistence, IPC and
  UI are adapters inside a slice.
- **Spec Kit per slice**, on branch `NNN-slice-name` from `main`: `/speckit-specify` →
  `/speckit-clarify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`.
- **TDD for all code**: domain, Angular UI, Electron main/preload/IPC, and bug fixes. Follow the
  `tdd` skill; use the `test-first` agent for the red phase and `implementer` for green. The TDD guard hook blocks edits to
  `src/`, `app/` and `api/` until a `*.spec.ts` or `e2e/` file has changed.
- **Domain discovery** and dictionary reviews go to the `domain-modeler` agent. It proposes; the user
  approves before `DICTIONARY.md` changes.
- **Commits**: small, one concern each, conventional-commit style (`feat:`, `fix:`, `docs:`,
  `chore:`, …, with an optional scope). Never bundle unrelated changes; split even within one
  file if needed. Commits are authored as `LilSticky <58908604+LilSticky@users.noreply.github.com>`,
  set per repository (`git config user.name` / `user.email`) on every machine, so that a work
  identity in the global Git config never reaches the public history.
- **Tickets** (ADR 15): GitHub Issues are the ticket system. Issue forms add `triage`; the Claude
  triage Action labels the issue, flags `duplicate` and `needs-info`, and comments. Run `/triage`
  locally to triage what the Action missed. Take work from triaged issues without `needs-info`;
  `@claude` in an issue or pull request runs the harness in GitHub Actions.
- **Pull requests** (ADR 10): every branch reaches `main` through a pull request, never a local
  merge or a direct push. Open it with `gh pr create`; the body lists every issue it touches,
  `Closes #N` for resolved ones and `Refs #N` for the rest. A slice has its own issue.
- **Merging**: when the Definition of Done gate is green and CI passes, squash-merge the pull
  request yourself (`gh pr merge --squash --delete-branch`). The gate: runs in Electron (the e2e
  suite is green in CI, ADR 13); tests and lint green; STATUS/ROADMAP/DICTIONARY/ADRs updated;
  committed. If you merge with something red, say so explicitly in the pull request and record it
  in STATUS. A ruleset on `main` (#18) enforces this: pull request, green CI checks, squash only.
- **Talking to the user**: work autonomously. Ask only about domain questions, dictionary changes
  and scope changes. Always ask through interactive prompts, never only in prose, and keep chat
  output short. Detail belongs in files.
- The existing prototype code is a **quarry**: reuse what fits, replace what doesn't. Don't patch
  around it.

## Delegation

This is a standing instruction to use subagents. The main session orchestrates: it reads
`tasks.md`, hands each step to the cheapest agent that can do it, checks the diff and test result,
and commits. It does not write code itself, which keeps its context small across a whole slice.

| Work | Agent | Model |
|------|-------|-------|
| Domain discovery, slicing, dictionary review | `domain-modeler` | opus |
| Failing test for one task (red) | `test-first` | sonnet |
| Make it green, refactor (green) | `implementer` | sonnet |
| Review `src/` changes | `angular-reviewer` | sonnet |
| Review `app/` and IPC changes | `electron-reviewer` | sonnet |
| Slice vs. `spec.md` before merging | `spec-auditor` | sonnet |
| STATUS/ROADMAP, GitHub Issues and board, i18n parity | `housekeeper` | haiku |
| Broad read-only code search | `Explore` | haiku |

- **Loop per task**: `test-first` → `implementer` → the matching reviewer(s), run in parallel →
  the main session fixes findings via `implementer`, then commits.
- **Hand-off through files**: prompts name a task ID in `tasks.md` and the files involved; agents
  read the repository rather than the chat, and report in 5 lines or fewer. Details go into
  spec, tasks or STATUS, not into the chat.
- **One working tree per session.** Several sessions run at once; never switch branches or commit
  in another session's tree. Start extra work in its own worktree
  (`git worktree add ../crancula-<topic> -b <branch> origin/main`) and tell running sessions
  which files you will touch. Subagents of one session share that session's tree and run
  sequentially when they edit; read-only reviewers may run in parallel.
- Escalate to a stronger model only when an agent fails twice on the same task.

## Code conventions

- **Language**: use dictionary terms in code, tests, UI texts and commits (Organ, Pipe, Tape, Hole,
  Column, Tape Bed, …). If a term is missing, don't invent one in code; ask.
- **Domain** (ADR 2): pure TypeScript per slice, with no Angular, Electron or Node imports. Shared
  domain types are exposed via `@api/*` (`api/`). Make invalid states unrepresentable.
- **Typing**: as strict as possible. No `any`, no non-null assertions to silence the compiler.
- **Angular**: standalone components, signals and signal forms, OnPush; follow the Angular MCP
  `get_best_practices`. Angular Material with minimal SCSS.
- **i18n**: @ngx-translate. Every key must exist in both `src/assets/i18n/en.json` and `de.json`
  (`npm run i18n:check`).
- **Electron** (ADR 4): `contextIsolation` on, `nodeIntegration` off; the renderer talks to the main
  process only via a typed preload API with an allow-list of channels. Payloads are validated
  against `@api` types. No `window.require`.
- **State** (ADR 3): in-memory state is the truth. Snapshots are versioned files in Electron's
  `userData` folder, written by the main process and loaded on startup.

## Layout

- `api/`: shared domain types and models (`@api/*`)
- `src/`: Angular app; routes in `src/app.routes.ts`, features in `src/app/features/`
  (`@shared/*` → `src/app/features/shared/*`)
- `app/`: Electron main process (`app/main.ts`) and preload
- `e2e/`: Playwright tests
- `scripts/`: repository checks run by npm scripts and CI
- `documentation/`, `specs/`, `.specify/`: docs and Spec Kit
- `.claude/agents/`, `.claude/skills/`, `.claude/hooks/`: agent tooling

## Commands

- `npm start`: Angular dev server plus Electron with live reload
- `npm run electron:local`: build the web assets and run Electron locally
- `npm run electron:build`: package the app for distribution
- `npm run build`: build the web app (also compiles `app/`)
- `npm run test` / `npm run test:watch`: Vitest unit and component tests
- `npm run e2e`: Playwright end-to-end tests (production build first); the window is hidden. To watch a run, slowed down and traced: `$env:HEADED='1'; npm run e2e`
- `npm run lint`: ESLint
- `npm run i18n:check`: en/de translation key parity (`i18n-parity` skill)

Development happens on Windows. The Bash tool is Git Bash and the primary shell is PowerShell.
