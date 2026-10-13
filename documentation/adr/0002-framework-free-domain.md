# 2. Framework-free domain with adapters

Date: 2026-10-13

## Status

Accepted

## Context

The earlier prototype mixed domain logic into Angular components, stores and form models
(for example `FormOrgan`, `OrganPipes` mutated inside form components). That made the domain
hard to test and tied it to Angular's and NgRx's release cycle.

## Decision

Each slice's domain model is pure TypeScript with no Angular, Electron or Node imports.
Angular UI, Electron persistence/IPC, and import/export formats (MIDI, SVG, …) are adapters that
depend on the domain, never the reverse. Shared domain types are exposed through `@api`.

## Consequences

- Domain logic is unit-testable without TestBed or Electron.
- Adapters need explicit mapping code between domain objects and UI/IPC/file representations.
- Existing models in `api/model` are reworked to fit the dictionary and this boundary.
