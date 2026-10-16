import {
  ChangeDetectionStrategy,
  Component,
  computed,
  afterEveryRender,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {BreakpointObserver} from '@angular/cdk/layout';
import {toSignal} from '@angular/core/rxjs-interop';
import {ActivatedRoute, Router} from '@angular/router';
import {map} from 'rxjs';
import {noteName, type ImportSummary, type Tape} from '@api/index';
import {MatButton} from '@angular/material/button';
import {MatButtonToggle, MatButtonToggleGroup} from '@angular/material/button-toggle';
import {MatIcon} from '@angular/material/icon';
import {RouterLink} from '@angular/router';
import {TranslatePipe} from '@ngx-translate/core';
import {formatNumber} from '../../shared/format-number';
import {LanguagePreference} from '../../shared/language-preference';
import {PageHeadComponent} from '../../shared/components/page-head/page-head.component';
import {OrganLibrary} from '../../organ/organ-library.store';
import {ImportSummaryComponent} from '../import-summary/import-summary.component';
import {TapeLibrary} from '../tape-library.store';
import {nextHole, type Direction, type SelectableHole} from './hole-selection';
import {inspectHole} from './inspect-hole';
import {overviewFrame, scrollLeftFor} from './overview-frame';
import {pointerAt} from './pointer-at';
import {pixelsPerMillimetre, type Zoom} from './pixels-per-millimetre';
import {tapeGeometry} from './tape-geometry';
import {columnLines, columnNumbers, rulerNumbers} from './tape-marks';
import {visibleColumns} from './visible-columns';

function isImportSummary(value: unknown): value is ImportSummary {
  if (typeof value !== 'object' || value === null) return false;
  const summary: Partial<Record<keyof ImportSummary, unknown>> = value;
  return (
    typeof summary.transposition === 'number' &&
    typeof summary.notesOnTape === 'number' &&
    Array.isArray(summary.movedByOctaves) &&
    Array.isArray(summary.unplayableNotes) &&
    Array.isArray(summary.holesFixed)
  );
}

const ARROW_DIRECTIONS: Readonly<Record<string, Direction>> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
};

function importSummaryOf(state: unknown): ImportSummary | null {
  if (typeof state !== 'object' || state === null || !('importSummary' in state)) return null;
  return isImportSummary(state.importSummary) ? state.importSummary : null;
}

/** The shell's query: below this width the side panel gives way to a toggle. */
const COMPACT_QUERY = '(max-width: 1179.98px)';

/** Space above the Tape for the ruler, in px. */
const RULER_HEIGHT = 24;
/** Space below the Tape for the Column numbers, in px. */
const NUMBERS_HEIGHT = 20;
/** The angled start of the Lead-in slants over at most this many mm. */
const LEAD_IN_SLANT_MM = 10;

/** The width to render Columns for: the scroll area, but never narrower than the screen (it is 0 before layout). */
function windowWidth(element: HTMLElement): number {
  return Math.max(element.clientWidth, window.innerWidth);
}

/** One Tape. Right after an import, the navigation state carries the Import Summary. */
@Component({
  selector: 'cranc-tape-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ImportSummaryComponent, TranslatePipe, PageHeadComponent, MatButton, MatButtonToggle, MatButtonToggleGroup, MatIcon, RouterLink],
  templateUrl: './tape-view.component.html',
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 300px;
      gap: 20px;
      flex: 1;
      min-height: 0;
    }
    .layout.compact {
      grid-template-columns: minmax(0, 1fr);
    }
    .stage {
      min-width: 0;
    }
    .status-line {
      display: flex;
      align-items: center;
      gap: 1.5rem;
      overflow: hidden;
      white-space: nowrap;
      font-size: 0.875rem;
    }
    .status-line .save-state {
      margin-left: auto;
    }
    .side-panel {
      display: flex;
      flex-direction: column;
      gap: 16px;
      overflow-y: auto;
    }
    .side-panel h2,
    .side-panel h3 {
      margin: 0 0 0.5rem;
    }
    .side-panel dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 4px 12px;
      margin: 0;
    }
    .side-panel dd {
      margin: 0;
      text-align: right;
    }
    .parts {
      margin: 0;
      padding-left: 1.25rem;
    }
    .export-later {
      line-height: 40px;
      white-space: nowrap;
      color: var(--mat-sys-on-surface-variant);
    }
    .drawing {
      display: flex;
    }
    .labels {
      flex: none;
      position: relative;
      width: 3rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .labels li {
      position: absolute;
      right: 0;
      padding-right: 0.5rem;
      text-align: right;
      transform: translateY(-50%);
      white-space: nowrap;
    }
    .scroll {
      flex: 1;
      overflow-x: auto;
    }
    .scroll svg,
    .overview {
      display: block;
    }
    .zoom,
    [data-testid='export'],
    [data-testid='side-panel-toggle'] {
      --mat-button-toggle-height: 40px;
      --mat-button-outlined-container-height: 40px;
      height: 40px;
      box-sizing: border-box;
    }
    .overview {
      cursor: pointer;
      flex: none;
      width: 100%;
      height: 44px;
    }
    .overview-frame {
      vector-effect: non-scaling-stroke;
      fill: none;
      stroke: var(--cr-brass);
      stroke-width: 2;
    }
    .tape,
    .lead-in {
      fill: var(--cr-tape);
      stroke: var(--cr-tape-edge);
    }
    .hole {
      fill: var(--cr-hole);
    }
    .hole.selected {
      stroke: var(--cr-select);
      stroke-width: 2;
    }
    .warning {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      color: var(--mat-sys-error);
    }
    .guide,
    .mark {
      stroke: var(--cr-tape-guide);
    }
    .guide.natural,
    .mark.strong,
    .border-line {
      stroke: var(--cr-tape-guide-strong);
    }
    .ruler {
      stroke: var(--cr-brass);
    }
    .ruler-number {
      fill: var(--cr-brass);
      font-size: 11px;
    }
    .column-number {
      fill: currentColor;
      font-size: 11px;
    }
  `,
})
export class TapeViewComponent {
  private readonly library = inject(TapeLibrary);
  private readonly organs = inject(OrganLibrary);
  private readonly router = inject(Router);
  private readonly language = inject(LanguagePreference).language;
  protected readonly rulerHeight = RULER_HEIGHT;
  protected readonly zooms: readonly {readonly zoom: Zoom; readonly label: string}[] = [
    {zoom: 'whole', label: 'TAPE.VIEW.ZOOM_WHOLE'},
    {zoom: '1:1', label: '1:1'},
    {zoom: '2:1', label: '2:1'},
  ];
  protected readonly zoom = signal<Zoom>('1:1');
  private readonly stageWidth = signal(0);
  private readonly stageClientWidth = signal(0);
  private readonly stageScrollWidth = signal(0);
  protected readonly rulerTicks = [0, 1, 2, 3, 4];

  private readonly breakpoints = inject(BreakpointObserver);
  protected readonly compact = toSignal(this.breakpoints.observe(COMPACT_QUERY).pipe(map((state) => state.matches)), {
    initialValue: this.breakpoints.isMatched(COMPACT_QUERY),
  });
  protected readonly sidePanelOpen = signal(false);
  protected readonly saveProblem = this.library.saveProblem;
  private readonly pointer = signal<{readonly column: number; readonly mm: number; readonly row: number | undefined} | undefined>(undefined);

  /** The pointer position as text for the status line; `undefined` while the pointer is not over the Tape. */
  protected readonly pointerText = computed(() => {
    const pointer = this.pointer();
    const organ = this.organ();
    if (pointer === undefined || organ === undefined) return undefined;
    const language = this.language();
    const pipe = pointer.row === undefined ? undefined : organ.pipes[pointer.row - 1];
    return {
      column: formatNumber(pointer.column, language),
      mm: formatNumber(pointer.mm, language),
      row: pointer.row === undefined ? undefined : formatNumber(pointer.row, language),
      note: pipe === undefined ? '' : noteName(pipe.note),
    };
  });

  private readonly scrollElement = viewChild<ElementRef<HTMLElement>>('scroll');
  private readonly scrollLeft = signal(0);
  private readonly selectedHole = signal<SelectableHole | undefined>(undefined);
  private scrollToSelection = false;
  private readonly clientWidth = signal(0);

  protected readonly importSummary = signal(importSummaryOf(this.router.currentNavigation()?.extras.state));
  private readonly id = toSignal(inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('id'))), {
    initialValue: null,
  });
  protected readonly tape = computed(() => {
    const id = this.id();
    return id === null ? undefined : this.library.tapeEntities().find((tape) => tape.id === id);
  });

  private readonly organ = computed(() => {
    const organId = this.tape()?.organId;
    return this.organs.entities().find((organ) => organ.id === organId);
  });

  private readonly geometry = computed(() => {
    const tape = this.tape();
    const organ = this.organ();
    return tape === undefined || organ === undefined ? undefined : tapeGeometry(tape, organ);
  });

  protected readonly scale = computed(() => {
    const geometry = this.geometry();
    if (geometry === undefined) return pixelsPerMillimetre('1:1', 0, 0);
    return pixelsPerMillimetre(this.zoom(), this.stageWidth(), geometry.leadIn + geometry.length);
  });

  /** The Hole the Selected Hole section tells about. */
  protected readonly inspection = computed(() => {
    const selected = this.selectedHole();
    const tape = this.tape();
    const organ = this.organ();
    if (selected === undefined || tape === undefined || organ === undefined) return undefined;
    const pipe = organ.pipes[selected.row - 1]?.note;
    const hole = tape.holes.find((candidate) => candidate.pipe === pipe && candidate.start === selected.start);
    if (hole === undefined) return undefined;
    const inspection = inspectHole(tape, organ, hole);
    const language = this.language();
    const number = (value: number): string => formatNumber(value, language);
    return {
      ...inspection,
      rowText: number(inspection.row),
      fromText: number(inspection.fromColumn),
      toText: number(inspection.toColumn),
      lengthColumnsText: number(inspection.lengthColumns),
      lengthMmText: number(inspection.lengthMm),
      gapColumnsText: number(inspection.gap.columns),
      gapMmText: number(inspection.gap.mm),
      warnings: inspection.warnings.map((warning) => ({
        kind: warning.kind,
        mmText: number(warning.mm),
        minimumText: number(warning.minimumMm),
      })),
    };
  });

  /** The whole Tape at stage width, for the overview strip. */
  protected readonly overview = computed(() => {
    const geometry = this.geometry();
    if (geometry === undefined) return undefined;
    const scale = pixelsPerMillimetre('whole', this.stageWidth(), geometry.leadIn + geometry.length);
    const leadIn = geometry.leadIn * scale;
    const height = geometry.width * scale;
    const slant = Math.min(geometry.leadIn, LEAD_IN_SLANT_MM) * scale;
    return {
      width: this.stageWidth(),
      height,
      leadIn,
      leadInPath: `M${slant},0 H${leadIn} V${height} H0 Z`,
      bodyWidth: geometry.length * scale,
      frame: overviewFrame(this.scrollLeft(), this.stageClientWidth(), this.stageScrollWidth(), this.stageWidth()),
      holes: geometry.slots.map((slot) => ({
        x: leadIn + slot.x * scale,
        y: slot.y * scale,
        width: slot.width * scale,
        height: slot.height * scale,
        radius: slot.radius * scale,
      })),
    };
  });

  /** What the template draws, in px; `undefined` while the Tape or its Organ is not available. */
  protected readonly drawing = computed(() => {
    const tape = this.tape();
    const organ = this.organ();
    const geometry = this.geometry();
    if (tape === undefined || organ === undefined || geometry === undefined) return undefined;
    const SCALE = this.scale();
    const columnPx = tape.columnLength * SCALE;
    const range = visibleColumns(this.scrollLeft(), this.clientWidth(), SCALE, geometry);
    const inRange = (column: number): boolean => column >= range.first && column <= range.last;
    const leadIn = geometry.leadIn * SCALE;
    const height = geometry.width * SCALE;
    const slant = Math.min(geometry.leadIn, LEAD_IN_SLANT_MM) * SCALE;
    const firstMm = range.first * tape.columnLength;
    const lastMm = (range.last + 1) * tape.columnLength;
    const language = this.language();
    const number = (value: number): string => formatNumber(value, language);
    const names = organ.pipes.map(({note}) => noteName(note));
    return {
      tape,
      organName: organ.name,
      lengthText: number(tape.length),
      columnLengthText: number(tape.columnLength),
      lengthMmText: number(tape.length * tape.columnLength),
      leadInMm: geometry.leadIn,
      leadInText: number(geometry.leadIn),
      holesText: number(tape.holes.length),
      labels: names.map((name, index) => ({
        name,
        sharp: name.includes('#'),
        y: (geometry.rowCentres[index] ?? 0) * SCALE + RULER_HEIGHT,
      })),
      rows: names.map((name, index) => ({
        y: (geometry.rowCentres[index] ?? 0) * SCALE,
        natural: !name.includes('#'),
      })),
      holes: geometry.slots
        .filter((slot) => inRange(slot.start) || (slot.start < range.first && slot.start + slot.width / tape.columnLength > range.first))
        .map((slot) => ({
          row: slot.row - 1,
          selected: slot.row === this.selectedHole()?.row && slot.start === this.selectedHole()?.start,
          start: slot.start,
          x: leadIn + slot.x * SCALE,
          y: slot.y * SCALE,
          width: slot.width * SCALE,
          height: slot.height * SCALE,
          radius: slot.radius * SCALE,
        })),
      marks: columnLines(tape.length)
        .filter((line) => inRange(line.column))
        .map((line) => ({...line, x: leadIn + line.column * columnPx})),
      numbers: columnNumbers(tape.length, columnPx)
        .filter((entry) => inRange(entry.column))
        .map((entry) => ({...entry, x: leadIn + entry.column * columnPx})),
      rulerNumbers: rulerNumbers(geometry.length)
        .filter((mm) => mm >= firstMm && mm <= lastMm)
        .map((mm) => ({mm, x: leadIn + mm * SCALE})),
      leadIn,
      leadInPath: `M${slant},0 H${leadIn} V${height} H0 Z`,
      bodyWidth: geometry.length * SCALE,
      borders: [geometry.border * SCALE, (geometry.width - geometry.border) * SCALE],
      width: leadIn + geometry.length * SCALE,
      height,
      totalHeight: RULER_HEIGHT + height + NUMBERS_HEIGHT,
      numbersY: height + NUMBERS_HEIGHT - 6,
      partNames: this.partNames(tape),
      drawingParams: {
        name: tape.name,
        rows: number(organ.pipes.length),
        columns: number(tape.length),
        holes: number(tape.holes.length),
      },
    };
  });

  protected select(hole: {readonly row: number; readonly start: number}): void {
    this.selectedHole.set({row: hole.row + 1, start: hole.start});
    this.scrollToSelection = true;
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.selectedHole.set(undefined);
      return;
    }
    const direction = ARROW_DIRECTIONS[event.key];
    const slots = this.geometry()?.slots;
    if (direction === undefined || slots === undefined) return;
    event.preventDefault();
    const current = this.selectedHole();
    const selected = current === undefined ? undefined : slots.find((slot) => slot.row === current.row && slot.start === current.start);
    const target = nextHole(slots, selected, direction);
    if (target === undefined) return;
    this.selectedHole.set({row: target.row, start: target.start});
    this.scrollToSelection = true;
  }

  protected onPointerMove(event: PointerEvent, svg: Element): void {
    const geometry = this.geometry();
    if (geometry === undefined) return;
    const box = svg.getBoundingClientRect();
    this.pointer.set(pointerAt(event.clientX - box.left, event.clientY - box.top - RULER_HEIGHT, this.scale(), geometry));
  }

  protected onPointerLeave(): void {
    this.pointer.set(undefined);
  }

  protected toggleSidePanel(): void {
    this.sidePanelOpen.update((open) => !open);
  }

  protected onSidePanelKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.compact()) this.sidePanelOpen.set(false);
  }

  protected onScroll(element: HTMLElement): void {
    this.scrollLeft.set(element.scrollLeft);
    this.clientWidth.set(windowWidth(element));
    this.readStage(element);
  }

  protected onOverviewClick(event: MouseEvent, overview: Element): void {
    const element = this.scrollElement()?.nativeElement;
    if (element === undefined) return;
    const clickX = event.clientX - overview.getBoundingClientRect().left;
    element.scrollLeft = scrollLeftFor(clickX, this.stageWidth(), element.scrollWidth, element.clientWidth);
  }

  private readStage(element: HTMLElement): void {
    this.stageClientWidth.set(element.clientWidth);
    this.stageScrollWidth.set(element.scrollWidth);
  }

  private partNames(tape: Tape): readonly {readonly index: number; readonly name: string | undefined}[] {
    const song = this.library.songEntities().find((candidate) => candidate.id === tape.songId);
    return (tape.selectedParts ?? []).map((index) => ({index, name: song?.parts[index]?.name}));
  }

  constructor() {
    effect((onCleanup) => {
      const element = this.scrollElement()?.nativeElement;
      if (element === undefined) return;
      this.clientWidth.set(windowWidth(element));
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver((entries) => {
        const width = entries[0]?.contentRect.width;
        if (width !== undefined) this.stageWidth.set(width);
      });
      observer.observe(element);
      onCleanup(() => observer.disconnect());
    });
    afterEveryRender(() => {
      const element = this.scrollElement()?.nativeElement;
      if (element === undefined) return;
      this.readStage(element);
      if (!this.scrollToSelection) return;
      const selected = element.querySelector('rect.selected');
      if (selected === null) return;
      this.scrollToSelection = false;
      selected.scrollIntoView({block: 'nearest', inline: 'nearest'});
    });
    effect(() => {
      if (this.library.loaded() && this.drawing() === undefined) void this.router.navigateByUrl('/tapes');
    });
  }
}
