# 9. Angular specs run in jsdom

Date: 2026-10-14

## Status

Accepted

## Context

`ng test` was configured to run Vitest in a Playwright-managed Chromium. On the development machine the
Chromium download repeatedly hung while extracting, which blocked every Angular test. CI would need the same
download on three operating systems.

## Decision

We run Angular specs (`src/**/*.spec.ts`) in jsdom, the default environment of the Angular unit-test builder,
by removing the `browsers` option from the `test` target. Behaviour that depends on a real browser engine is
covered by the Playwright Electron e2e tests, which use Electron's own Chromium.

## Consequences

- `ng test` needs no browser download, locally or in CI, and starts faster.
- jsdom has no layout or real rendering; tests must not rely on sizes, scrolling or CSS.
- The Node project (ADR 7) and `ng test` both run without a browser now.
