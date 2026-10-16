import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {ActivatedRoute, Router} from '@angular/router';
import {map} from 'rxjs';
import {noteName, type ImportSummary, type Tape} from '@api/index';
import {TranslatePipe} from '@ngx-translate/core';
import {PageHeadComponent} from '../../shared/components/page-head/page-head.component';
import {OrganLibrary} from '../../organ/organ-library.store';
import {ImportSummaryComponent} from '../import-summary/import-summary.component';
import {TapeLibrary} from '../tape-library.store';
import {pixelsPerMillimetre} from './pixels-per-millimetre';
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
    Array.isArray(summary.holeChanges)
  );
}

function importSummaryOf(state: unknown): ImportSummary | null {
  if (typeof state !== 'object' || state === null || !('importSummary' in state)) return null;
  return isImportSummary(state.importSummary) ? state.importSummary : null;
}

/** Space above the Tape for the ruler, in px. */
const RULER_HEIGHT = 24;
/** Space below the Tape for the Column numbers, in px. */
const NUMBERS_HEIGHT = 20;
/** The angled start of the Lead-in slants over at most this many mm. */
const LEAD_IN_SLANT_MM = 10;
/** The scale of the drawing: 1:1, true size on screen. */
const SCALE = pixelsPerMillimetre('1:1', 0, 0);

/** The width to render Columns for: the scroll area, but never narrower than the screen (it is 0 before layout). */
function windowWidth(element: HTMLElement): number {
  return Math.max(element.clientWidth, window.innerWidth);
}

/** One Tape. Right after an import, the navigation state carries the Import Summary. */
@Component({
  selector: 'cranc-tape-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ImportSummaryComponent, TranslatePipe, PageHeadComponent],
  templateUrl: './tape-view.component.html',
  styles: `
    .drawing {
      display: flex;
    }
    .labels {
      flex: none;
      position: relative;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .labels li {
      position: absolute;
      right: 0;
      padding-right: 0.5rem;
      transform: translateY(-50%);
      white-space: nowrap;
    }
    .scroll {
      flex: 1;
      overflow-x: auto;
    }
    .scroll svg {
      display: block;
    }
    .tape,
    .lead-in {
      fill: var(--cr-tape);
      stroke: var(--cr-tape-edge);
    }
    .hole {
      fill: var(--cr-hole);
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
  protected readonly rulerHeight = RULER_HEIGHT;
  protected readonly scale = SCALE;
  protected readonly rulerTicks = [0, 1, 2, 3, 4];

  private readonly scrollElement = viewChild<ElementRef<HTMLElement>>('scroll');
  private readonly scrollLeft = signal(0);
  private readonly clientWidth = signal(0);

  protected readonly importSummary = importSummaryOf(this.router.currentNavigation()?.extras.state);
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

  /** What the template draws, in px; `undefined` while the Tape or its Organ is not available. */
  protected readonly drawing = computed(() => {
    const tape = this.tape();
    const organ = this.organ();
    if (tape === undefined || organ === undefined) return undefined;
    const geometry = tapeGeometry(tape, organ);
    const columnPx = tape.columnLength * SCALE;
    const range = visibleColumns(this.scrollLeft(), this.clientWidth(), SCALE, geometry);
    const inRange = (column: number): boolean => column >= range.first && column <= range.last;
    const leadIn = geometry.leadIn * SCALE;
    const height = geometry.width * SCALE;
    const slant = Math.min(geometry.leadIn, LEAD_IN_SLANT_MM) * SCALE;
    const firstMm = range.first * tape.columnLength;
    const lastMm = (range.last + 1) * tape.columnLength;
    const names = organ.pipes.map(({note}) => noteName(note));
    return {
      tape,
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
    };
  });

  protected onScroll(element: HTMLElement): void {
    this.scrollLeft.set(element.scrollLeft);
    this.clientWidth.set(windowWidth(element));
  }

  private partNames(tape: Tape): readonly {readonly index: number; readonly name: string | undefined}[] {
    const song = this.library.songEntities().find((candidate) => candidate.id === tape.songId);
    return (tape.selectedParts ?? []).map((index) => ({index, name: song?.parts[index]?.name}));
  }

  constructor() {
    effect(() => {
      const element = this.scrollElement()?.nativeElement;
      if (element !== undefined) this.clientWidth.set(windowWidth(element));
    });
    effect(() => {
      if (this.library.loaded() && this.drawing() === undefined) void this.router.navigateByUrl('/tapes');
    });
  }
}
