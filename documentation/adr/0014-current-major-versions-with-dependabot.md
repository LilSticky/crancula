# 14. Stay on current major versions with Dependabot

Date: 2026-10-14

## Status

Accepted

## Context

Crancula started on Angular 21, Electron 42, TypeScript 5.9, Vitest 4 and ESLint 9 with
`.eslintrc.json`. Slice 001 avoided Angular's signal forms because the experimental API in
Angular 21 could not bind `number | null` fields (research R6). The constitution named
"Angular 21" as the platform, so every major update would have meant amending it.

The user updated the stack in one step ([#13](https://github.com/LilSticky/crancula/issues/13)):
Angular 22, Angular Material 22, NgRx Signals 22, ngx-translate 18, Electron 44, TypeScript 6,
Vitest 5, Playwright 1.64, ESLint 10 with a flat config (`eslint.config.js`), and Node 24.

## Decision

We will stay on the current major versions of the stack.

- Dependabot (`.github/dependabot.yml`) opens weekly pull requests for npm (root and `app/`) and
  GitHub Actions. Related packages are grouped (Angular, angular-eslint, typescript-eslint,
  Vitest, Playwright), so one framework update is one pull request.
- A Dependabot pull request is merged like any other: CI green on Linux, Windows and macOS,
  including e2e (ADR 13). Major updates follow the framework's migration guide and get their
  fixes in the same pull request.
- CI and development use the Node version in `.node-version` (24).
- The constitution names the platform without a major version.

## Consequences

- Fewer large, risky jumps; each update is small and checked by the full CI run.
- Major updates can change behaviour without failing the build. The ngx-translate 18 update, for
  example, made an effect re-run on language changes and report a storage problem twice; only the
  e2e suite caught it. Behaviour belongs in tests, not in reviewers' memory.
- Packages that drop CommonJS can't be updated until the Electron main process can load ESM
  (`electron-reloader` stays on 1.x).
- Signal forms in Angular 22 support `number | null` fields, so research R6 of slice 001 is
  revisited.
- Constitution version 1.1.2.
