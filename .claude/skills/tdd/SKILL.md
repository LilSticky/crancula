---
name: tdd
description: Strict test-driven development loop (red → green → refactor) for any implementation in Crancula — domain logic, Angular UI, Electron main/preload/IPC. Use whenever implementing or changing behaviour, including `/speckit-implement` tasks and bug fixes. Explains the TDD guard hooks.
---

# TDD workflow

All production code is written test-first. Work in small cycles, one behaviour per cycle.

## Cycle

1. **Red** — delegate to the `test-first` agent (or follow its rules yourself for a tiny change): write the smallest failing test for one behaviour, run it, confirm it fails for the expected reason. Bug fix → first a test that reproduces the bug.
2. **Green** — delegate to the `implementer` agent, which also does step 3 (or follow its rules yourself for a tiny change): write the minimum production code to make that test pass. No extra behaviour, no speculative abstractions. Run the test, then the whole suite (`npm run test`).
3. **Refactor** — with everything green, clean up production and test code (naming per `documentation/DICTIONARY.md`, strict typing, duplication). Rerun tests after each step. Never change behaviour here.
4. Repeat for the next behaviour. Tick the task in `tasks.md` only once its tests are green.

## Test pyramid: fail fast and cheap

Every cycle runs the cheapest test that can show the behaviour. Never wait minutes on an e2e run
when a seconds-long unit test could have advanced the loop.

| Level | Where | Cost | Use for |
|-------|-------|------|---------|
| Domain unit | `api/**/*.spec.ts`, `npm run test:node` (or `npx vitest run -c vitest.node.config.ts <file>`) | ~1 s | all domain rules, calculations, validation, MIDI/SVG logic |
| Main-process unit | `app/**/*.spec.ts`, same runner | ~1 s | IPC handlers, payload validation, snapshot files |
| Component | `src/**/*.spec.ts`, `npx ng test --watch=false --include <file>` | ~5 s | rendering, bindings, signal forms, user events in one component |
| e2e | `e2e/*.spec.ts`, Playwright on the built app | minutes | only what needs real Electron: the preload boundary, persistence across restarts, one happy path per user flow |

- Most tests sit at the bottom. Push logic down into pure functions (domain or a component's
  plain helpers) until a unit test can cover it.
- In the cycle, run **only the test you touched** (single file); then the level's suite; the full
  `npm run test` at green. `npm run e2e` runs once per task that changed a user flow or the
  boundary, and before the pull request; CI runs it anyway.
- Add an e2e test only for what no lower level can prove, and say why in the test name or a comment.
- Visual/styling work: component tests for structure and states, `npm run ux:screens` plus the
  `ux-review` skill for the look; no e2e for colours or spacing.

## Guards (hooks in `.claude/settings.json`, script `.claude/hooks/tdd-guard.mjs`)

- **Pre-edit guard**: edits to production files in `src/`, `app/`, `api/` are blocked while no test file (`*.spec.ts`, `e2e/**`) is changed in the git working tree. If blocked, write the failing test first — do not work around the guard. Exemptions (declarations, environments, assets, tsconfig, app package files) live in the script's `EXEMPT` list; change them only with the user's consent.
- **Stop guard**: when code or tests changed, `npm run lint` and `npm run test` run at the end of a turn; on failure the turn continues with the output. In a deliberate red phase, say explicitly that the suite is red on purpose and which test is expected to fail.

Commit at green (ask the user first), so the working tree — and with it the pre-edit guard — resets per cycle.

## Reporting
State per cycle: test added, red output (trimmed), what made it green, refactorings. Never claim done while anything is red.
