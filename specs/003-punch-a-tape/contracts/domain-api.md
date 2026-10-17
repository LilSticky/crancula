# Contract: Domain API of "Punch a tape"

New and changed public exports of `@api/index` (`api/index.ts`). Types are in the
[data model](../data-model.md). Everything is pure TypeScript without Angular, Electron or Node
imports (ADR 2) and is tested in Node Vitest (ADR 7).

## New

| Export | From | Purpose |
|--------|------|---------|
| `tapeGeometry(tape, organ): TapeGeometry` | `api/tape/tape-geometry.ts` | moved from `src/app/features/tape/tape-view/`; positions in mm from the Lead-in's tip, plus the Tape Outline and the end gap (research R1) |
| `type TapeGeometry`, `type Slot`, `type TapeOutline`, `type Point` | same | |
| `exportProblems(tape, organ): readonly ExportProblem[]` | `api/tape/export-problems.ts` | the export check (research R4) |
| `type ExportProblem`, `type ExportProblemCode` | same | `'no-pipe' \| 'too-short' \| 'too-close'` |
| `plotterSvg(geometry): string` | `api/tape/plotter-svg.ts` | the SVG file's text (research R3, R5) |
| `plotterFileName(tapeName): string` | `api/tape/plotter-file-name.ts` | the suggested file name (research R7) |
| `parseSvgSaveRequest(input): Result<SvgSaveRequest, string>` | `api/app/svg-save-request.ts` | IPC payload validation ([contract](plotter-ipc.md#validation)) |
| `type SvgSaveRequest`, `type SvgSaveResult` | `api/app/svg-save-request.ts`, re-exported by `api/app/crancula-api.ts` | |

## Changed

| Export | Change |
|--------|--------|
| `type CranculaApi` | gains `plotter.saveSvg(request): Promise<SvgSaveResult>` |
| `holeLimitsOf(organ, columnLength): HoleLimits` (internal, not in `index.ts`) | moved from `create-tape.ts` to `hole-fixes.ts`, shared by `createTape` and `exportProblems` |

## Unchanged on purpose

`Tape`, `Hole`, `Organ` and both snapshot formats. Exporting adds no field to a Tape (FR-014) and
nothing to `tapes.json` or `organs.json`.

## Usage (renderer)

```ts
const problems = exportProblems(tape, organ);
if (problems.length > 0) { /* show them; no dialog (FR-003) */ }
else {
  const result = await api.plotter.saveSvg({
    suggestedFileName: plotterFileName(tape.name),
    svg: plotterSvg(tapeGeometry(tape, organ)),
    dialogTitle, filterName,
  });
}
```
