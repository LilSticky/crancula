# 7. Node Vitest for the domain and the main process

Date: 2026-10-14

## Status

Accepted

## Context

`ng test` (`@angular/build:unit-test`) runs Vitest in Chromium and only picks up specs under
`src/`. The framework-free domain (`api/`, ADR 2) does not need a browser, and the main process's
file-system code (`app/`, ADR 3) cannot run in one.

## Decision

We add a second Vitest configuration, `vitest.node.config.ts`, with the Node environment for
`api/**/*.spec.ts` and `app/**/*.spec.ts`. `npm run test` runs it and then `ng test`, and it
fails if either fails. Angular specs stay under `ng test`.

## Consequences

- Domain and main-process logic are tested quickly, without TestBed or Electron.
- There are two test configurations to maintain; both use Vitest, so there is still only one
  test framework.
- Domain files must not use the `@api/*` alias internally, because `app/` is compiled by plain
  `tsc`.
