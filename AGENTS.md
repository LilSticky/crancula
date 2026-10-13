# Crancula Agent Instructions

Crancula is a hobby desktop app (Electron + Angular 21) that turns music into a punched Tape for the
user's own barrel Organ, cut by a Plotter. v0.1: describe an Organ, bring a MIDI Song onto a Tape,
export the Tape as SVG for a vinyl cutter.

The project has stalled several times from lost context. Everything you need to resume lives in the
repository. Keep it that way.

## Start here

Read these in order before doing anything:

1. [`documentation/STATUS.md`](documentation/STATUS.md): the current slice, the **one next step**,
   known broken/WIP items, and open questions.
2. [`documentation/ROADMAP.md`](documentation/ROADMAP.md): the ordered slices and their state.
3. [`.specify/memory/constitution.md`](.specify/memory/constitution.md): binding principles and
   the Definition of Done. It overrides this file if the two ever disagree.
4. [`documentation/DICTIONARY.md`](documentation/DICTIONARY.md): the ubiquitous language.
5. The ADRs below, and `specs/<slice>/` for the slice you are working on.

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

## Architecture Decision Records

Index of [`documentation/adr/`](documentation/adr/README.md). Keep this table in sync with the ADR
index; the `adr` skill does both.

| # | Title | Status |
|---|-------|--------|
| 1 | [Record architecture decisions](documentation/adr/0001-record-architecture-decisions.md) | Accepted |
| 2 | [Framework-free domain with adapters](documentation/adr/0002-framework-free-domain.md) | Accepted |
| 3 | [In-memory state as source of truth, snapshots on disk](documentation/adr/0003-memory-first-snapshots.md) | Accepted |
| 4 | [Strict Electron process boundary](documentation/adr/0004-strict-electron-boundary.md) | Accepted |
| 5 | [MIDI in and SVG out first](documentation/adr/0005-midi-in-svg-out-first.md) | Accepted |
| 6 | [Autonomous slices on branches, squash-merged](documentation/adr/0006-autonomous-slices-squash-merge.md) | Accepted |
| 7 | [Node Vitest for the domain and the main process](documentation/adr/0007-node-vitest-for-domain-and-main.md) | Accepted |
| 8 | [Snapshot write strategy](documentation/adr/0008-snapshot-write-strategy.md) | Accepted |
| 9 | [Angular specs run in jsdom](documentation/adr/0009-angular-specs-in-jsdom.md) | Accepted |

## Workflow

- **Slices by domain, not technology.** Name a slice after what it lets the user do ("Describe my
  organ"), never after a layer or format ("SVG export", "persistence"). Formats, persistence, IPC and
  UI are adapters inside a slice.
- **Spec Kit per slice**, on branch `NNN-slice-name` from `main`: `/speckit-specify` →
  `/speckit-clarify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`.
- **TDD for all code**: domain, Angular UI, Electron main/preload/IPC, and bug fixes. Follow the
  `tdd` skill; use the `test-first` agent for the red phase. The TDD guard hook blocks edits to
  `src/`, `app/` and `api/` until a `*.spec.ts` or `e2e/` file has changed.
- **Domain discovery** and dictionary reviews go to the `domain-modeler` agent. It proposes; the user
  approves before `DICTIONARY.md` changes.
- **Commits**: small, one concern each, conventional-commit style (`feat:`, `fix:`, `docs:`,
  `chore:`, …, with an optional scope). Never bundle unrelated changes; split even within one
  file if needed.
- **Merging**: when the Definition of Done gate is green, squash-merge the branch into `main`
  yourself. The gate: runs in Electron; tests and lint green; STATUS/ROADMAP/DICTIONARY/ADRs
  updated; committed. If you merge with something red, say so explicitly and record it in STATUS.
- **Talking to the user**: work autonomously. Ask only about domain questions, dictionary changes
  and scope changes. Always ask through interactive prompts, never only in prose, and keep chat
  output short. Detail belongs in files.
- The existing prototype code is a **quarry**: reuse what fits, replace what doesn't. Don't patch
  around it.

## Code conventions

- **Language**: use dictionary terms in code, tests, UI texts and commits (Organ, Pipe, Tape, Hole,
  Column, Tape Bed, …). If a term is missing, don't invent one in code; ask.
- **Domain** (ADR 2): pure TypeScript per slice, with no Angular, Electron or Node imports. Shared
  domain types are exposed via `@api/*` (`api/`). Make invalid states unrepresentable.
- **Typing**: as strict as possible. No `any`, no non-null assertions to silence the compiler.
- **Angular**: standalone components, signals and signal forms, OnPush; follow the Angular MCP
  `get_best_practices`. Angular Material with minimal SCSS.
- **i18n**: @ngx-translate. Every key must exist in both `src/assets/i18n/en.json` and `de.json`.
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
- `documentation/`, `specs/`, `.specify/`: docs and Spec Kit
- `.claude/agents/`, `.claude/skills/`, `.claude/hooks/`: agent tooling

## Commands

- `npm start`: Angular dev server plus Electron with live reload
- `npm run electron:local`: build the web assets and run Electron locally
- `npm run electron:build`: package the app for distribution
- `npm run build`: build the web app (also compiles `app/`)
- `npm run test` / `npm run test:watch`: Vitest unit and component tests
- `npm run e2e`: Playwright end-to-end tests (production build first)
- `npm run lint`: ESLint

Development happens on Windows. The Bash tool is Git Bash and the primary shell is PowerShell.
