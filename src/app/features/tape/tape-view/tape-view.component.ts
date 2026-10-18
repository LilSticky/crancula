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
import {noteName, type ImportSummary, type Tape, tapeGeometry} from '@api/index';
import {MatButton, MatIconButton} from '@angular/material/button';
import {MatButtonToggle, MatButtonToggleGroup} from '@angular/material/button-toggle';
import {MatIcon} from '@angular/material/icon';
import {MatTooltip} from '@angular/material/tooltip';
import {TranslatePipe} from '@ngx-translate/core';
import {formatNumber} from '../../shared/format-number';
import {LanguagePreference} from '../../shared/language-preference';
import {PageHeadComponent} from '../../shared/components/page-head/page-head.component';
import {OrganLibrary} from '../../organ/organ-library.store';
import {ImportSummaryComponent} from '../import-summary/import-summary.component';
import {TapeLibrary} from '../tape-library.store';
import {nextHole, type Direction, type SelectableHole} from './hole-selection';
import {inspectHole} from './inspect-hole';
import {SelectedHoleComponent} from './selected-hole/selected-hole.component';
import {selectedHoleView} from './selected-hole/selected-hole-view';
import {stageMetrics} from './stage-metrics';
import {columnMarks, drawingParams, holeRects, outline, overviewOf, rowLabels, RULER_HEIGHT, sectionView} from './tape-drawing';
import {TapeSectionComponent} from './tape-section/tape-section.component';
import {TapeStatusLineComponent, type PointerText} from './tape-status-line/tape-status-line.component';
import {overviewFrame, scrollLeftFor} from './overview-frame';
import {PlotterExport} from './plotter-export';
import {pointerAt} from './pointer-at';
import {pixelsPerMillimetre, type Zoom} from './pixels-per-millimetre';
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

/** One Tape. Right after an import, the navigation state carries the Import Summary. */
@Component({
  selector: 'cranc-tape-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ImportSummaryComponent, TranslatePipe, PageHeadComponent, MatButton, MatIconButton, MatTooltip, MatButtonToggle, MatButtonToggleGroup, MatIcon, SelectedHoleComponent, TapeSectionComponent, TapeStatusLineComponent],
  templateUrl: './tape-view.component.html',
  styleUrl: './tape-view.component.scss',
})
export class TapeViewComponent {
  private readonly library = inject(TapeLibrary);
  private readonly organs = inject(OrganLibrary);
  private readonly router = inject(Router);
  protected readonly plotterExport = inject(PlotterExport);
  private readonly language = inject(LanguagePreference).language;
  protected readonly rulerHeight = RULER_HEIGHT;
  protected readonly zooms: readonly {readonly zoom: Zoom; readonly label: string}[] = [
    {zoom: 'whole', label: 'TAPE.VIEW.ZOOM_WHOLE'},
    {zoom: '1:1', label: '1:1'},
    {zoom: '2:1', label: '2:1'},
  ];
  protected readonly zoom = signal<Zoom>('1:1');
  protected readonly rulerTicks = [0, 1, 2, 3, 4];

  private readonly breakpoints = inject(BreakpointObserver);
  protected readonly compact = toSignal(this.breakpoints.observe(COMPACT_QUERY).pipe(map((state) => state.matches)), {
    initialValue: this.breakpoints.isMatched(COMPACT_QUERY),
  });
  protected readonly sidePanelOpen = signal(false);
  protected readonly saveProblem = this.library.saveProblem;
  private readonly pointer = signal<{readonly column: number; readonly mm: number; readonly row: number | undefined} | undefined>(undefined);

  /** The pointer position as text for the status line; `undefined` while the pointer is not over the Tape. */
  protected readonly pointerText = computed((): PointerText | undefined => {
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
  private readonly stage = stageMetrics(this.scrollElement);
  private readonly selectedHole = signal<SelectableHole | undefined>(undefined);
  private scrollToSelection = false;

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
    return pixelsPerMillimetre(this.zoom(), this.stage.stageWidth(), geometry.totalLength);
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
    return selectedHoleView(inspectHole(tape, organ, hole), this.language());
  });

  protected readonly overview = computed(() => {
    const geometry = this.geometry();
    return geometry === undefined ? undefined : overviewOf(geometry, this.stage.stageWidth());
  });

  /** The framed part of the overview strip; changes with every scroll, unlike the overview itself. */
  protected readonly overviewMark = computed(() =>
    overviewFrame(this.stage.scrollLeft(), this.stage.stageClientWidth(), this.stage.stageScrollWidth(), this.stage.stageWidth()),
  );

  private readonly visibleRange = computed(() => {
    const geometry = this.geometry();
    return geometry === undefined ? undefined : visibleColumns(this.stage.scrollLeft(), this.stage.clientWidth(), this.scale(), geometry);
  });

  /** What the template draws, in px; `undefined` while the Tape or its Organ is not available. */
  protected readonly drawing = computed(() => {
    const tape = this.tape();
    const organ = this.organ();
    const geometry = this.geometry();
    const range = this.visibleRange();
    if (tape === undefined || organ === undefined || geometry === undefined || range === undefined) return undefined;
    const scale = this.scale();
    const language = this.language();
    return {
      tape,
      section: sectionView(tape, organ, geometry, language, this.partNames(tape)),
      ...rowLabels(organ, geometry, scale),
      holes: holeRects(tape, geometry, scale, range, this.selectedHole()),
      ...columnMarks(tape, geometry, scale, range),
      ...outline(geometry, scale),
      drawingParams: drawingParams(tape, organ, language),
    };
  });

  protected exportTape(): void {
    const tape = this.tape();
    const organ = this.organ();
    if (tape !== undefined && organ !== undefined) void this.plotterExport.export(tape, organ);
  }

  protected select(hole: {readonly row: number; readonly start: number}): void {
    this.selectedHole.set({row: hole.row + 1, start: hole.start});
    this.scrollToSelection = true;
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.selectedHole.set(undefined);
      return;
    }
    const slots = this.geometry()?.slots;
    if (slots === undefined) return;
    const current = this.selectedHole();
    if ((event.key === 'Enter' || event.key === ' ') && current === undefined) {
      event.preventDefault();
      this.moveSelection(nextHole(slots, undefined, 'right'));
      return;
    }
    const direction = ARROW_DIRECTIONS[event.key];
    if (direction === undefined) return;
    event.preventDefault();
    const selected = current === undefined ? undefined : slots.find((slot) => slot.row === current.row && slot.start === current.start);
    const target = nextHole(slots, selected, direction);
    this.moveSelection(target);
  }

  private moveSelection(target: SelectableHole | undefined): void {
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
    this.stage.onScroll(element);
  }

  protected onOverviewClick(event: MouseEvent, overview: Element): void {
    const element = this.scrollElement()?.nativeElement;
    if (element === undefined) return;
    const clickX = event.clientX - overview.getBoundingClientRect().left;
    element.scrollLeft = scrollLeftFor(clickX, this.stage.stageWidth(), element.scrollWidth, element.clientWidth);
  }

  private partNames(tape: Tape): readonly {readonly index: number; readonly name: string | undefined}[] {
    const song = this.library.songEntities().find((candidate) => candidate.id === tape.songId);
    return (tape.selectedParts ?? []).map((index) => ({index, name: song?.parts[index]?.name}));
  }

  constructor() {
    this.sidePanelOpen.set(this.compact() && this.importSummary() !== null);
    afterEveryRender(() => {
      const element = this.scrollElement()?.nativeElement;
      if (element === undefined) return;
      this.stage.readStage(element);
      if (!this.scrollToSelection) return;
      const selected = element.querySelector('rect.selected');
      if (selected !== null) {
        this.scrollToSelection = false;
        selected.scrollIntoView({block: 'nearest', inline: 'nearest'});
        return;
      }
      const current = this.selectedHole();
      const geometry = this.geometry();
      const slot = geometry?.slots.find((candidate) => candidate.row === current?.row && candidate.start === current?.start);
      if (geometry === undefined || slot === undefined) return;
      const rendered = this.drawing()?.holes.some((hole) => hole.row === slot.row - 1 && hole.start === slot.start);
      if (rendered) return; // Its rect is drawn on the next render.
      this.scrollToSelection = false;
      element.scrollLeft = slot.x * this.scale();
    });
    effect(() => {
      if (this.library.loaded() && this.drawing() === undefined) void this.router.navigateByUrl('/tapes');
    });
  }
}
