# Agentic Workflow TODO

Custom agents, skills and setup still to build for the spec-, test- and domain-driven workflow.

## Setup
- [ ] Write the Spec Kit constitution (`/speckit-constitution`) covering DDD, TDD, Angular 21 and Electron rules
- [ ] Create `DEFINITIONS.md` (referenced by `AGENTS.md`, but missing) and fix the `FEATURES.md` path (it lives in `documentation/`)

## Agents (`.claude/agents/`)
- [ ] `domain-modeler` - checks specs and `api/model` against `DEFINITIONS.md` (ubiquitous language, aggregates, no domain logic in components)
- [ ] `test-first` - writes only the failing Vitest/Playwright test for a task in `tasks.md` and confirms it fails (TDD red phase)
- [ ] `angular-reviewer` - signals, signal forms, standalone/OnPush/zoneless, strict typing, Material-only styling, en/de translation parity
- [ ] `electron-reviewer` - `app/main.js`, preload and IPC: context isolation, channel allow-list, payload validation against `@api` types, CSP
- [ ] `spec-auditor` - after `/speckit-implement`, compares code and tests against `spec.md` acceptance criteria and reports gaps

## Skills (`.claude/skills/`)
- [ ] `i18n-parity` - check and fix en/de translation keys
- [ ] `ddd-glossary` - add or rename a domain term in `DEFINITIONS.md` and propagate it through the code

## Hooks
- [ ] Run `npm run lint` and affected Vitest tests when a turn ends, so nothing is reported done while red (via `hookify` or `/update-config`)
