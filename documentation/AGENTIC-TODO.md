# Agentic Workflow TODO

Custom agents, skills and setup still to build for the spec-, test- and domain-driven workflow.

## Setup
- [x] Write the Spec Kit constitution (`/speckit-constitution`) covering DDD, TDD, Angular 21 and Electron rules
- [x] Describe the project's purpose and target (in the constitution; replaces the outdated `documentation/FEATURES.md`)

## Agents (`.claude/agents/`)
- [x] `domain-modeler` - checks specs and `api/model` against `documentation/DICTIONARY.md` (ubiquitous language, aggregates, no domain logic in components)
- [x] `test-first` - writes only the failing Vitest/Playwright test for a task in `tasks.md` and confirms it fails (TDD red phase)
- [x] `angular-reviewer` - signals, signal forms, standalone/OnPush/zoneless, strict typing, Material-only styling, en/de translation parity
- [x] `electron-reviewer` - `app/main.js`, preload and IPC: context isolation, channel allow-list, payload validation against `@api` types, CSP
- [x] `spec-auditor` - after `/speckit-implement`, compares code and tests against `spec.md` acceptance criteria and reports gaps
- [x] `implementer` - TDD green and refactor phase for one task (sonnet)
- [x] `housekeeper` - STATUS/ROADMAP upkeep, GitHub Issues and board, i18n parity (haiku)

## Skills (`.claude/skills/`)
- [ ] `i18n-parity` - check and fix en/de translation keys
- [ ] `dictionary` - add or rename a domain term in `documentation/DICTIONARY.md` and propagate it through the code
- [x] `adr` - create, supersede and look up Nygard ADRs in `documentation/adr/` and keep the index in sync
- [x] `tdd` - red/green/refactor loop; documents the guard hooks

## Hooks
- [x] Run `npm run lint` and Vitest tests when a turn ends, so nothing is reported done while red (via `hookify` or `/update-config`)
- [x] TDD pre-edit guard: blocks production edits while no test is changed (`.claude/hooks/tdd-guard.mjs`)
