# Chapter 5: SVG Export

**Goal**: Export the edited tape as a printable/vector SVG file.

## Prerequisites
- [ ] CHAPTER-3 complete (Tape model + TapeGeometryService exist)
- [ ] CHAPTER-4 complete (tape editor exists to create/edit holes)

## SVG Generation Service (src/app/core/services/svg/)
- [ ] Create `TapeSvgExportService`
- [ ] Implement `generateSvg(tape: Tape, organ: Organ, options?: SvgExportOptions): string` method
- [ ] Return SVG as string (XML markup)

## SVG Document Structure
- [ ] Root `<svg>` element with correct `viewBox`, `xmlns`, `width`, `height`
- [ ] Set SVG dimensions based on physical tape size (mm → SVG units, configurable scale)
- [ ] `<defs>` section for reusable elements (hole template, sprocket hole template)
- [ ] `<style>` for consistent styling (colors, stroke widths, fonts)

## Physical Dimension Mapping
- [ ] Use `TapeGeometryService` (from Ch.3) to compute:
  - [ ] Tape width → SVG height
  - [ ] Tape length → SVG width
  - [ ] Hole positions in mm → SVG coordinate space
- [ ] Apply `scale` option: 1mm = X SVG units (e.g. 10 = 1:10 scale for readability)
- [ ] Apply `unit` option: mm, inches, or pixels

## Elements to Render
- [ ] **Tape background** — rectangle representing the paper/tape material
- [ ] **Holes** — `<circle>` or `<rect>` elements at correct positions
  - [ ] Shape: circle (most barrel organs use round holes) or rectangle (scaled to `holeDiameterMm`)
  - [ ] Fill: solid dark color (default), respect Organ color if set
- [ ] **Sprocket holes** — registration holes along tape edge(s)
  - [ ] Position: along top/bottom edge at regular intervals
  - [ ] Based on `sprocketHoleSpacingMm` from Organ settings
- [ ] **Row guides** — faint lines separating pipe rows (optional, configurable)
- [ ] **Column guides** — faint vertical lines at regular time intervals (optional)
- [ ] **Measure markers** — dashed lines at beat/measure boundaries (optional)
- [ ] **Labels** — pipe names/pitches along left edge
- [ ] **Annotation layer** — time markers, measure numbers, section labels (optional)

## SVG Export Options
- [ ] `scale` — SVG units per mm (default: 10)
- [ ] `includeSprocketHoles` — boolean (default: true)
- [ ] `includeRowGuides` — boolean (default: false)
- [ ] `includeColumnGuides` — boolean (default: false)
- [ ] `includeLabels` — boolean (default: true)
- [ ] `includeAnnotations` — boolean (default: true)
- [ ] `holeColor` — string (default: '#000000')
- [ ] `tapeColor` — string (default: '#FAF0E6' — cream paper)
- [ ] `sprocketHoleDiameterMm` — override from Organ setting
- [ ] `marginMm` — extra margin around tape edges (default: 5mm)

## SVG Preview Component
- [ ] Create `TapeSvgPreviewComponent` — renders SVG inline via `[innerHTML]` sanitized
- [ ] Create preview dialog/page accessible from tape detail and editor
- [ ] Add zoom controls for preview: fit-to-width, actual size, custom zoom
- [ ] Add option panel for export settings (scale, which elements to include)
- [ ] Real-time preview update when export options change
- [ ] Show dimension annotations (tape width label, total length label)

## Export UI
- [ ] Add "Export SVG" button on tape detail page and editor toolbar
- [ ] On click: show export dialog with:
  - [ ] Preview pane (TapeSvgPreviewComponent)
  - [ ] Options panel (scale, elements, colors)
  - [ ] File name input (default: tape name + ".svg")
- [ ] "Export" button triggers IPC save dialog

## Electron Save Dialog (IPC)
- [ ] Create preload API: `saveSvgFile(svgContent: string, defaultName: string)` → saves via IPC
- [ ] Register `ipcMain.handle('dialog:saveSvg')` in `app/main.ts`:
  - [ ] Use `dialog.showSaveDialog` with filter `[{ name: 'SVG', extensions: ['svg'] }]`
  - [ ] Write file using `fs.writeFileSync`
  - [ ] Return success/failure to renderer
- [ ] Handle overwrite confirmation (built into showSaveDialog)
- [ ] Handle write errors (disk full, permissions)

## Batch Export (Future-Proofing)
- [ ] Support exporting multiple tapes at once (from tape list page)
- [ ] Support exporting all holes as coordinate data (CSV/JSON sidecar) — stretch goal

## Large Tape Handling
- [ ] Generate SVG incrementally for very large tapes (streaming approach)
- [ ] Optimize SVG output size:
  - [ ] Use `<use>` elements for repeated hole shapes
  - [ ] Group elements by row for smaller markup
  - [ ] Avoid unnecessary precision (round coordinates to 2 decimal places)
- [ ] Estimate SVG file size before generation (warn user if >10MB expected)

## PDF Export Bridge
- [ ] Create `TapePdfExportService` that wraps SVG export:
  - [ ] Generate SVG as above
  - [ ] Use a library (e.g. `jsPDF` or Chromium's print-to-PDF via Electron) to convert SVG → PDF
- [ ] Add "Export PDF" button (separate from SVG, or combined dialog)
- [ ] Note: PDF export is labeled low-priority per MVP scope

## Testing
- [ ] Unit tests for SVG string generation (valid XML, correct elements)
- [ ] Unit tests for coordinate computation (mm → SVG units)
- [ ] Unit tests for each export option (sprockets on/off, labels on/off)
- [ ] Unit tests for edge cases: 0 holes, 1 pipe, 1 column
- [ ] Unit tests for SVG optimization (use of `<use>` elements, precision rounding)
- [ ] Component tests for preview component (SVG renders correctly in DOM)
- [ ] E2E test: open tape → export SVG → verify file written to disk
- [ ] Visual regression test: compare exported SVG snapshot for known tape

## Code Quality
- [ ] Run `npm run lint` — no new errors
- [ ] Run `npm run test` — all tests pass
- [ ] Manual test: export SVG, open in browser/Illustrator/Inkscape, verify dimensions and appearance
- [ ] Manual test: print exported SVG at 1:1 scale, verify hole positions match expected physical layout
