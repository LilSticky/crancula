# Crancula Constitution

Crancula is a hobby desktop application that turns music into a punched Tape for a barrel Organ,
ready to be cut by a Plotter. The first release (v0.1) lets the user describe an Organ, bring a
MIDI Song onto a Tape and export that Tape as SVG for a vinyl cutter.

## Core Principles

### I. Domain-Driven Slicing

- The ubiquitous language in `documentation/DICTIONARY.md` is binding. Code, specs, tests, UI
  texts and commits MUST use its terms. A missing or unclear term MUST be added or clarified in
  the dictionary (with the user's approval) before it is used in code.
- New domain concepts MUST come from domain discovery with the user, not from assumptions.
- Work MUST be sliced by domain and user capability ("Describe my organ", "Punch a tape"),
  never by technology. Import/export formats, persistence, IPC and UI are adapters inside a
  slice and MUST NOT be slices of their own.

Rationale: the domain is the hard part of this project; a shared language keeps humans and
agents aligned across long pauses.

### II. Test-Driven Development (NON-NEGOTIABLE)

- ALL implementation MUST follow red → green → refactor: domain logic, Angular UI, Electron
  main/preload/IPC and bug fixes alike. No production code without a failing test first.
- Unit and component tests use Vitest; end-to-end flows use Playwright.
- The TDD guard hook (`.claude/hooks/tdd-guard.mjs`), the `/tdd` skill and the `test-first`
  agent enforce this. They MUST NOT be bypassed.

Rationale: tests are the executable spec that lets autonomous agents change code safely.

### III. Framework-Free Domain

- Each slice's domain model MUST be pure TypeScript with no Angular, Electron or Node imports.
- Angular UI, Electron persistence/IPC, and import/export formats (MIDI, SVG, …) are adapters
  around the domain and depend on it, never the other way round.
- Types MUST be as strict as possible: no `any` and no invalid states that the type can
  represent (for example a Hole without a position).

Rationale: the domain stays testable in isolation and survives framework churn.

### IV. Memory First, Snapshots on Disk

- The in-memory application state is the single source of truth while the app runs.
- Files on disk are snapshots: they are written during the app lifecycle and loaded into
  memory on startup. The domain MUST NOT read or write files directly.
- Snapshot formats MUST be versioned so older snapshots can be loaded or migrated.

Rationale: simple, fast state handling with durable, portable files.

### V. Strict Electron Boundary

- `contextIsolation` MUST be on and `nodeIntegration` MUST be off.
- The renderer MAY talk to the main process ONLY through a typed preload API with an
  allow-list of channels; `window.require` and direct Node access in the renderer are forbidden.
- Every IPC payload MUST be validated against the shared `@api` types on the receiving side.

Rationale: a secure, explicit boundary that also keeps the domain independent of Electron.

### VI. Context Never Gets Lost

- `documentation/STATUS.md` MUST state the current slice with exactly one next concrete step,
  known broken/WIP items, and open questions. It MUST be updated in every change.
- `documentation/ROADMAP.md` MUST list the ordered slices and their state.
- Significant architecture decisions MUST be recorded as Nygard-style ADRs (title, status,
  context, decision, consequences) in `documentation/adr/`, listed in its index. Superseded
  ADRs are marked as such, never deleted.

Rationale: the project has stalled repeatedly from lost context; anyone (human or agent) must
be able to resume from the repository alone.

### VII. Small Vertical Slices

- Each slice MUST be usable end to end in the Electron app, even if minimal.
- A slice MUST be small enough to finish within a few sessions; larger capabilities are split
  into several slices.
- Existing code is a quarry, not a foundation: reuse what fits, rewrite what doesn't.

Rationale: frequent, visible progress keeps momentum.

## Product & Technical Constraints

- Platform: Electron desktop app with Angular 21, built with the Angular application builder.
- UI: Angular Material with minimal SCSS customizations; signals and signal forms preferred.
- i18n: every translation key MUST exist in both `en.json` and `de.json`.
- Releases: cross-platform (Windows, macOS, Linux) builds published as GitHub Releases and built
  in CI. No code signing or auto-update for now.
- v0.1 scope: Describe my organ, Bring a song onto a tape (MIDI), Punch a tape (SVG for a vinyl
  cutter). Tape editing, crank preview, further import formats (MusicXML, PDF), DXF/HPGL export
  and Air Demand warnings come later.

## Development Workflow & Definition of Done

- Every slice goes through Spec Kit: `/speckit-specify` → `/speckit-clarify` → `/speckit-plan`
  → `/speckit-tasks` → `/speckit-implement`, on its own slice branch.
- Agents work mostly autonomously. They MUST ask the user only for domain questions,
  dictionary changes and decisions that change scope.
- A slice is Done only when ALL of these hold (the gate):
  1. It runs end to end in the Electron app.
  2. Unit, component and e2e tests and lint are green.
  3. STATUS, ROADMAP, DICTIONARY and any affected ADRs are updated.
  4. It is committed on the slice branch and merged into `main`.
- When the gate is green, the agent merges the slice into `main` itself. The user follows along
  via `documentation/STATUS.md`.

## Governance

- This constitution supersedes other practices; `AGENTS.md` holds runtime guidance and MUST NOT
  contradict it.
- Amendments require an ADR explaining the change and a version bump of this document:
  MAJOR for removed or redefined principles, MINOR for new principles or sections, PATCH for
  clarifications.
- Every spec, plan and implementation MUST be checked against these principles (the Constitution
  Check in `/speckit-plan`); any deviation MUST be justified in the plan or rejected.

**Version**: 1.0.0 | **Ratified**: 2026-10-13 | **Last Amended**: 2026-10-13
