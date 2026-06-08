# Chapter 4: Tape Editor

**Goal**: Interactive visual editor for punched tape with zoom, scroll, and hole editing.

## Prerequisites
- [ ] CHAPTER-3 complete (Tape model + conversion exist)
- [ ] Organ has tape-physics properties for accurate rendering

## Editor Component Architecture (src/app/features/tape-editor/)
- [ ] Create `TapeEditorPage` component — full-page editor wrapper
- [ ] Create `TapeEditorComponent` — the main editor canvas/grid
- [ ] Create `TapeEditorToolbarComponent` — zoom controls, undo/redo, save, export buttons
- [ ] Create `TapeEditorStore` — manages editor state (zoom, scroll, selection, undo stack)
- [ ] Wire route: `/tape/:id/edit` → `TapeEditorPage`

## Grid Rendering (Canvas vs SVG)
- [ ] Choose rendering strategy:
  - [ ] Option A: HTML/CSS grid with divs (simplest, good for <1000 columns)
  - [ ] Option B: HTML Canvas 2D (performant for large tapes)
  - [ ] Option C: SVG (vector, integrates with Ch.5 export)
- [ ] Implement grid rendering with chosen strategy
- [ ] Render row labels (pipe name and/or pitch on left margin)
- [ ] Render column headers (time markers: beat numbers, measure lines)
- [ ] Render sprocket hole track (top/bottom margin)
- [ ] Implement virtual scrolling for large tapes (only render visible viewport)

## Hole Rendering
- [ ] Draw holes as filled rectangles at correct row/column position
- [ ] Hole color: use Organ color (or default dark fill)
- [ ] Hole dimensions: respect `holeDiameterMm` scale within grid cell
- [ ] Selected hole highlight (different color / border)
- [ ] Hover effect on holes (subtle highlight)

## Zoom & Scroll
- [ ] Horizontal zoom slider (columns per viewport width)
- [ ] Zoom levels: fit-width, 1:1, 2:1, 4:1, etc.
- [ ] Keyboard shortcuts: Ctrl+Scroll = zoom, Scroll = pan
- [ ] Mini-map / overview panel showing current viewport position in full tape
- [ ] Smooth scroll & zoom transitions

## Hole Editing
- [ ] Click empty cell → create hole at that position (single column)
- [ ] Click existing hole → select it (show properties)
- [ ] Drag on empty cells → create hole spanning dragged columns
- [ ] Drag on existing hole → extend/shrink hole length
- [ ] Click selected hole + Delete/Backspace → remove hole
- [ ] Right-click on hole → context menu: delete, copy, properties
- [ ] Multi-selection: Ctrl+Click or drag-select rectangle over multiple holes
- [ ] Batch delete selected holes

## Selection & Clipboard
- [ ] Single hole selection (click)
- [ ] Multi-select (Ctrl+Click, Shift+Click range)
- [ ] Rectangular selection (drag on empty area)
- [ ] Select all (Ctrl+A)
- [ ] Copy selected holes (Ctrl+C) — store as JSON in clipboard
- [ ] Paste holes (Ctrl+V) — paste at current cursor position
- [ ] Cut selected holes (Ctrl+X)
- [ ] Visual selection rectangle overlay

## Undo/Redo
- [ ] Implement command pattern for all editing operations
- [ ] Undo stack (Ctrl+Z) — unlimited or configurable depth
- [ ] Redo stack (Ctrl+Shift+Z)
- [ ] Each command: `{ type, before: TapeSnapshot, after: TapeSnapshot }`
- [ ] Display undo/redo state in toolbar (canUndo, canRedo indicators)

## Tape Properties Panel
- [ ] Create side panel or dialog showing selected hole properties:
  - [ ] Pipe index / pitch / name
  - [ ] Start column
  - [ ] Length (columns)
  - [ ] Physical position (mm from start, mm from edge)
- [ ] Allow editing hole properties directly (change column, length, pipe)
- [ ] Show overall tape stats: total holes, tape length (mm), tape width (mm), duration (seconds)

## Keyboard Shortcuts
- [ ] `Ctrl+Z` — Undo
- [ ] `Ctrl+Shift+Z` / `Ctrl+Y` — Redo
- [ ] `Ctrl+A` — Select all holes
- [ ] `Delete` / `Backspace` — Delete selected holes
- [ ] `Ctrl+C` — Copy
- [ ] `Ctrl+V` — Paste
- [ ] `Ctrl+X` — Cut
- [ ] `+` / `-` — Zoom in / Zoom out
- [ ] `Ctrl+0` — Reset zoom to fit
- [ ] Arrow keys — Nudge selected hole by 1 column (or 1 row if Shift+Arrow)
- [ ] `Space` — Toggle playhead / preview mode (future)
- [ ] Show keyboard shortcuts help overlay (`?` key or menu item)

## Snap & Guides
- [ ] Snap-to-grid for all hole creation/resizing (always on — holes are grid-aligned)
- [ ] Show vertical measure lines (every N columns based on time signature)
- [ ] Show beat subdivision lines (lighter than measure lines)
- [ ] Show horizontal row lines (pipe rows)
- [ ] Cursor position indicator (line at mouse position showing current row+column)

## Performance Optimization
- [ ] Implement viewport culling: only render visible rows/columns
- [ ] Batch hole updates (don't re-render on every pixel drag)
- [ ] Use `requestAnimationFrame` for smooth rendering
- [ ] Test with large tapes: 100+ pipes × 10,000+ columns
- [ ] Consider OffscreenCanvas or web worker for heavy computations

## Editor Persistence
- [ ] Auto-save: save tape state every N seconds (configurable, default 30s)
- [ ] Unsaved changes indicator (dot on tab title, prompt on navigation away)
- [ ] Save button in toolbar triggers immediate save
- [ ] Save triggers `TapeStore.updateEntity(tape)` → persistence

## Responsive Layout
- [ ] Editor panel takes full window height
- [ ] Toolbar at top (always visible)
- [ ] Properties panel: collapsible right sidebar
- [ ] Mini-map: collapsible bottom-left corner
- [ ] Handle window resize gracefully

## Testing
- [ ] Unit tests for `TapeEditorStore` (undo/redo stack, selection state)
- [ ] Component tests for editor grid rendering (holes appear at correct positions)
- [ ] Component tests for hole creation (click → hole added)
- [ ] Component tests for hole deletion (select + delete)
- [ ] Component tests for zoom controls
- [ ] Component tests for undo/redo
- [ ] Component tests for keyboard shortcuts
- [ ] Performance benchmark test: render X holes in Y ms
- [ ] E2E test: navigate to editor, create/edit/delete holes, save, verify persistence

## Code Quality
- [ ] Run `npm run lint` — no new errors
- [ ] Run `npm run test` — all tests pass
- [ ] Manual test: full edit workflow — open tape, add holes, delete holes, undo, save, reload, verify
