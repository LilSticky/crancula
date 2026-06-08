# Crancula

Electron + Angular 21 desktop app for composing & converting punched tape music scores.

**Domain**: Barrel organs play punched tape; holes = notes; rows = pipes; columns = time units.

**Stack**: Angular 21, TypeScript, SCSS, Material, NgRx Signals, Electron 39, Vitest, Playwright.

**Structure**: `api/model/` (shared data classes), `app/main.ts` (Electron main), `src/` (Angular app). Existing: Organ & Pipe models, routes, home/page scaffolds.

**MVP**: MIDI in → Tape → Editor → SVG out.
