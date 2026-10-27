import {
  ChangeDetectionStrategy,
  NgZone,
  Component,
  computed,
  DestroyRef,
  afterEveryRender,
  afterRenderEffect,
  effect,
  untracked,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {BreakpointObserver} from '@angular/cdk/layout';
import {toSignal} from '@angular/core/rxjs-interop';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {map} from 'rxjs';
import {column, columnDuration, cuttingProblems, holesWithCuttingProblems, noteName, type HoleRef, type ImportSummary, type NoJoinProblem, type Organ, type SongMetre, songMetre, type Tape, tapeGeometry, tapePieces, type TapeGeometry, type TapePieces, type Transposed} from '@api/index';
import {canTranspose, holeRefsOf, selectionOfRefs} from './transpose-selection';
import {crankSpeedChangeTo} from './crank-speed-change';
import {holeAt, moveSpot, sameSpot, spotAt, type Spot, type TapeSelection} from './spot';
import {MatDialog} from '@angular/material/dialog';
import {TransposeDialogComponent, type TransposeDialogData} from './transpose-dialog/transpose-dialog.component';
import {MatButton} from '@angular/material/button';
import {MatButtonToggle, MatButtonToggleGroup} from '@angular/material/button-toggle';
import {MatIcon} from '@angular/material/icon';
import {MatMenu, MatMenuItem, MatMenuTrigger} from '@angular/material/menu';
import {MatProgressSpinner} from '@angular/material/progress-spinner';
import {MatSnackBar} from '@angular/material/snack-bar';
import {MatTooltip} from '@angular/material/tooltip';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import {formatNumber} from '../../shared/format-number';
import {LanguagePreference} from '../../shared/language-preference';
import {PageHeadComponent} from '../../shared/components/page-head/page-head.component';
import {OrganLibrary} from '../../organ/organ-library.store';
import {ImportSummaryComponent} from '../import-summary/import-summary.component';
import {TapeLibrary} from '../tape-library.store';
import {EditCommandRouter} from '../../shared/edit-command-router';
import {editIntent, historyIntent, type Platform} from './edit-keys';
import {PLATFORM} from './platform.token';
import {gridAt} from './grid-at';
import {isDrag, type HolePart} from './hole-drag';
import {nextTap, type TapMemory} from './double-tap';
import {HoleDragSession} from './hole-drag-session';
import {addEdit, keyEdit, type EditOutcome} from './hole-edit-commands';
import {
  allOf,
  extended,
  frameBetween,
  framed,
  nextHole,
  soleOf,
  toggled,
  united,
  type Direction,
  type GridCell,
  type HoleSelection,
  type SelectableHole,
  type SpanningHole,
} from './hole-selection';
import {inspectHole} from './inspect-hole';
import {AddHoleComponent} from './add-hole/add-hole.component';
import {CuttingProblemsComponent} from './cutting-problems/cutting-problems.component';
import {SelectedHoleComponent} from './selected-hole/selected-hole.component';
import {selectedHoleView} from './selected-hole/selected-hole-view';
import {stageMetrics} from './stage-metrics';
import {TapeEditor} from './tape-editor';
import {TapePreview} from '../preview/tape-preview';
import {TapeRecorder} from '../recording/tape-recorder';
import {PreviewSectionComponent} from '../preview/preview-section/preview-section.component';
import {columnMarks, drawingParams, drawingWidth, ghostRect, gripsOf, holeMarks, holeRects, joinMarks, outline, overviewOf, pieceLabelMarks, rowLabels, RULER_HEIGHT, sectionView, spotRect, stretchMarks} from './tape-drawing';
import {TapeSectionComponent} from './tape-section/tape-section.component';
import {TapeStatusLineComponent, type PointerText} from './tape-status-line/tape-status-line.component';
import {overviewFrame, scrollLeftFor} from './overview-frame';
import {PlotterExport} from './plotter-export';
import {ScoresExport} from './scores-export/scores-export';
import {PlotterSectionComponent} from './plotter-section/plotter-section.component';
import {PlotterPreference} from '../../plotter/plotter-preference';
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

function shortcutsOf(platform: Platform): {readonly undo: string; readonly redo: string} {
  if (platform === 'darwin') return {undo: '⌘Z', redo: '⇧⌘Z'};
  return {undo: 'Ctrl+Z', redo: platform === 'linux' ? 'Ctrl+Shift+Z' : 'Ctrl+Y'};
}

/** How long the snackbar that explains a refused edit stays, in ms. */
const REFUSAL_DURATION = 3000;

/** A dragged Hole this close to the stage's left or right edge scrolls the stage, in px. */
const EDGE_ZONE = 24;

/** How far the stage scrolls per frame while a Hole rests in the edge zone, in px. */
const EDGE_SCROLL_STEP = 12;

interface Point {
  readonly x: number;
  readonly y: number;
}

/** An empty spot pressed on the Tape: where (client px and drawing px), in which cell, whether it adds to the selection, and whether a touch pressed it. */
interface Framing {
  readonly press: Point;
  readonly origin: Point;
  readonly cell: GridCell;
  readonly additive: boolean;
  readonly touch: boolean;
}

/** The selection of no Holes, shared so that an unchanged selection keeps its identity. */
const NO_HOLES: HoleSelection = [];

/** How long after the owner last scrolled or wheeled the stage the playhead leaves the stage alone, in ms. */
const OWNER_SCROLL_PAUSE = 2000;

/** Where the playhead lands when the stage follows it: this share of the stage's width in from the left edge. */
const FOLLOW_LEAD = 0.2;

/** Where Space is left to the element it lands on: fields, controls, links, list options and editable text. */
const SPACE_IS_KEPT_BY = 'input, textarea, button, a, select, [role=combobox], [role=option], [contenteditable]';

/** The playhead grip's hit area in screen px: as wide as this, and as tall as the ruler band, so it does not cover the Tape. */
const PLAYHEAD_GRIP_WIDTH = 44;

/** The shell's query: below this width the side panel gives way to a toggle. */
const COMPACT_QUERY = '(max-width: 1179.98px)';

/** The query for the window width below which German labels crowd the page head actions into icons. */
const GERMAN_ACTIONS_QUERY = '(max-width: 1439.98px)';

/** One Tape. Right after an import, the navigation state carries the Import Summary. */
@Component({
  selector: 'cranc-tape-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [TapeEditor, TapePreview],
  imports: [ImportSummaryComponent, TranslatePipe, RouterLink, PageHeadComponent, MatButton, MatTooltip, MatButtonToggle, MatButtonToggleGroup, MatIcon, MatMenu, MatMenuItem, MatMenuTrigger, MatProgressSpinner, AddHoleComponent, CuttingProblemsComponent, SelectedHoleComponent, TapeSectionComponent, PlotterSectionComponent, PreviewSectionComponent, TapeStatusLineComponent],
  templateUrl: './tape-view.component.html',
  styleUrl: './tape-view.component.scss',
  host: {'(keydown)': 'onViewKeydown($event)'},
})
export class TapeViewComponent {
  private readonly library = inject(TapeLibrary);
  private readonly organs = inject(OrganLibrary);
  private readonly router = inject(Router);
  protected readonly editor = inject(TapeEditor);
  protected readonly preview = inject(TapePreview);
  protected readonly recorder = inject(TapeRecorder);
  private readonly platform = inject(PLATFORM);
  /** The shortcuts of Undo and Redo as the tooltips name them. */
  protected readonly shortcuts = shortcutsOf(this.platform);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);
  private readonly zone = inject(NgZone);
  private readonly editCommands = inject(EditCommandRouter);
  private readonly holeDrag = new HoleDragSession();
  /** Set after a drag so the click that may follow it does not select. */
  private dragJustEnded = false;
  private dragEndedTimer: ReturnType<typeof setTimeout> | undefined;
  /** The last tap on a Hole or a Spot, which the next tap may pair with as a double-tap. */
  private tapMemory: TapMemory | undefined;
  /** The last pointer position of a drag, so the Column follows when the stage scrolls under a resting pointer. */
  private lastPointer: {readonly clientX: number; readonly clientY: number; readonly pointerId: number; readonly svg: Element} | undefined;
  private edgeScrollFrame: number | undefined;
  /** The press that may frame a selection; a touch that travels pans the drawing instead of framing. */
  private framing: Framing | undefined;
  /** The touch pointers down on the drawing. */
  private readonly touches = new Set<number>();
  /** The touches whose capture was lost without a pointerup: forgotten at the next touch down, unless the capture came back first. */
  private readonly lostTouches = new Set<number>();
  /** Set once a second touch goes down: the touches change nothing until all of them are up. */
  private touchesIgnored = false;
  /** A drag of the playhead grip; `wasPlaying` tells whether the Preview played at the press and goes on from the release. */
  private playheadDrag: {readonly wasPlaying: boolean} | undefined;
  /** The selection frame as dragged, in px of the drawing; `undefined` until the press has travelled. */
  protected readonly frameRect = signal<{readonly x: number; readonly y: number; readonly width: number; readonly height: number} | undefined>(undefined);
  protected readonly dragging = this.holeDrag.dragging;
  protected readonly plotterExport = inject(PlotterExport);
  protected readonly scoresExport = inject(ScoresExport);
  private readonly plotterPreference = inject(PlotterPreference);
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
  private readonly translateLanguage = toSignal(this.translate.onLangChange.pipe(map((event) => event.lang)), {
    initialValue: this.translate.getCurrentLang() ?? 'en',
  });
  private readonly germanNarrow = toSignal(this.breakpoints.observe(GERMAN_ACTIONS_QUERY).pipe(map((state) => state.matches)), {
    initialValue: this.breakpoints.isMatched(GERMAN_ACTIONS_QUERY),
  });
  /** Whether the page head actions show their icons only: when the window is compact, or German labels would crowd them. */
  protected readonly compactActions = computed(() => this.compact() || (this.translateLanguage() === 'de' && this.germanNarrow()));
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

  /** When the owner last scrolled or wheeled the stage, in ms of `performance.now()`. */
  private ownerScrolledAt = Number.NEGATIVE_INFINITY;
  /** The scroll position the playhead last set, so the scroll event it causes is not taken for the owner's. */
  private followedScrollLeft: number | undefined;
  private readonly scrollElement = viewChild<ElementRef<HTMLElement>>('scroll');
  private readonly stage = stageMetrics(this.scrollElement);
  private readonly drawingSvg = viewChild<ElementRef<SVGSVGElement>>('tapeSvg');
  private readonly cuttingProblemsSection = viewChild(CuttingProblemsComponent);
  private readonly selection = signal<TapeSelection>({holes: []});
  /** The Holes selected, or none while a Spot is. */
  private readonly holeSelection = computed((): HoleSelection => {
    const selection = this.selection();
    return 'holes' in selection ? selection.holes : NO_HOLES;
  });
  /** The Spot selected, if any. */
  protected readonly spotSelected = computed((): Spot | undefined => {
    const selection = this.selection();
    return 'spot' in selection ? selection.spot : undefined;
  });
  private scrollToSelection = false;
  /** The first Column, counted from 1, of a chosen stretch whose mark is brought into view on the next render. */
  private stretchInView: number | undefined;

  protected readonly importSummary = signal(importSummaryOf(this.router.currentNavigation()?.extras.state));
  private readonly id = toSignal(inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('id'))), {
    initialValue: null,
  });
  protected readonly tape = computed(() => {
    const id = this.id();
    return id === null ? undefined : this.library.tapeEntities().find((tape) => tape.id === id);
  });

  /** The metre of the Tape's Song: its first Time signature, Key and upbeat; nothing while the Song is not found. */
  protected readonly metre = computed<SongMetre>(() => {
    const song = this.song();
    return song ? songMetre(song) : {};
  });

  /** The Song of the shown Tape; undefined while the Tape has none in the library. */
  private readonly song = computed(() => {
    const songId = this.tape()?.songId;
    return this.library.songEntities().find((candidate) => candidate.id === songId);
  });

  /** The Tape as drawn: the would-be Tape while a Hole is dragged. */
  private readonly shownTape = computed(() => {
    const preview = this.holeDrag.preview();
    return preview?.kind === 'applied' ? preview.tape : this.tape();
  });

  protected readonly shownSelection = computed((): HoleSelection => {
    const preview = this.holeDrag.preview();
    return preview?.kind === 'applied' ? preview.selection : this.holeSelection();
  });

  private readonly shownSoleHole = computed(() => soleOf(this.shownSelection()));

  /** The Holes the selection works on: row (from 1), start and length in Columns. */
  private readonly selectable = computed((): readonly SpanningHole[] => {
    const tape = this.shownTape();
    const organ = this.organ();
    if (tape === undefined || organ === undefined) return [];
    return tape.holes
      .flatMap(({pipe, start, length}): readonly SpanningHole[] => {
        const index = organ.pipes.findIndex((candidate) => candidate.note === pipe);
        return index === -1 ? [] : [{row: index + 1, start, length}];
      })
      .sort((a, b) => a.start - b.start || a.row - b.row);
  });

  protected readonly organ = computed(() => {
    const organId = this.tape()?.organId;
    return this.organs.entities().find((organ) => organ.id === organId);
  });

  private readonly geometry = computed(() => {
    const tape = this.shownTape();
    const organ = this.organ();
    return tape === undefined || organ === undefined ? undefined : tapeGeometry(tape, organ);
  });

  /** The Tape pieces of the shown Tape (the would-be Tape while dragging) for the picked Plotter, as the drawing and the Plotter section show them. */
  protected readonly shownCut = computed((): TapePieces | undefined => {
    const geometry = this.geometry();
    const plotter = this.plotterPreference.picked();
    return geometry === undefined || plotter === undefined ? undefined : tapePieces(geometry, plotter);
  });

  /** The stretches of the shown Tape that no Join of the picked Plotter cuts within its working length; none without a Plotter. */
  protected readonly stretchProblems = computed((): readonly NoJoinProblem[] => {
    const cut = this.shownCut();
    const plotter = this.plotterPreference.picked();
    if (cut?.kind !== 'no-join' || plotter === undefined || plotter.roll) return [];
    return cut.stretches.map(
      ({first, last}): NoJoinProblem => ({code: 'no-join', start: first, last, plotterName: plotter.name, workingLengthMm: plotter.workingLength}),
    );
  });

  protected readonly scale = computed(() => {
    const geometry = this.geometry();
    if (geometry === undefined) return pixelsPerMillimetre('1:1', 0, 0);
    return pixelsPerMillimetre(this.zoom(), this.stage.stageWidth(), geometry.totalLength);
  });

  /** The selected Hole as the form knows it: by Pipe and Column. */
  protected readonly selectedHoleRef = computed((): HoleRef | undefined => {
    const selected = this.shownSoleHole();
    const pipe = selected === undefined ? undefined : this.organ()?.pipes[selected.row - 1]?.note;
    const start = selected === undefined ? undefined : column(selected.start);
    return selected === undefined || pipe === undefined || start === undefined ? undefined : {pipe, start};
  });

  /** The selected Spot as drawn: the Hole a tap there would add, in px, with the label its live region reads. */
  protected readonly spotView = computed(() => {
    const spot = this.spotSelected();
    const tape = this.shownTape();
    const organ = this.organ();
    if (spot === undefined || tape === undefined || organ === undefined) return undefined;
    const rect = spotRect(tape, organ, spot, this.scale());
    const pipe = organ.pipes[spot.row - 1]?.note;
    if (rect === undefined || pipe === undefined) return undefined;
    return {...rect, label: {pipe: noteName(pipe), column: formatNumber(spot.start + 1, this.language())}};
  });

  /** The Holes of the shown Tape (the would-be Tape while dragging) that can't be cut. */
  protected readonly holesWithProblems = computed(() => {
    const tape = this.shownTape();
    const organ = this.organ();
    return tape === undefined || organ === undefined ? [] : holesWithCuttingProblems(cuttingProblems(tape, organ));
  });

  /** The Hole the Selected Hole section tells about. */
  protected readonly inspection = computed(() => {
    const selected = this.shownSoleHole();
    const tape = this.shownTape();
    const organ = this.organ();
    if (selected === undefined || tape === undefined || organ === undefined) return undefined;
    const pipe = organ.pipes[selected.row - 1]?.note;
    const hole = tape.holes.find((candidate) => candidate.pipe === pipe && candidate.start === selected.start);
    if (hole === undefined) return undefined;
    return selectedHoleView(inspectHole(tape, organ, hole), this.language());
  });

  protected readonly overview = computed(() => {
    const geometry = this.geometry();
    return geometry === undefined ? undefined : overviewOf(geometry, this.stage.stageWidth(), this.shownCut());
  });

  /** Why Export for the Plotter is refused: the Tape is wider than the picked Plotter, in the language's numbers; `undefined` otherwise. */
  protected readonly exportRefusal = computed(() => {
    const cut = this.shownCut();
    if (cut?.kind !== 'too-wide') return undefined;
    return {
      tapeWidth: formatNumber(cut.tapeWidth, this.language()),
      workingWidth: formatNumber(cut.workingWidth, this.language()),
    };
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
    const tape = this.shownTape();
    const organ = this.organ();
    const geometry = this.geometry();
    const range = this.visibleRange();
    const preview = this.holeDrag.preview();
    const attempted = preview?.kind === 'refused' ? preview.attempted : undefined;
    if (tape === undefined || organ === undefined || geometry === undefined || range === undefined) return undefined;
    const scale = this.scale();
    const language = this.language();
    const holes = holeRects(tape, geometry, scale, range, this.shownSelection());
    return {
      tape,
      organ,
      section: sectionView(tape, organ, geometry, language, this.partNames(tape)),
      ...rowLabels(organ, geometry, scale),
      holes,
      grips: gripsOf(holes),
      ghost: attempted === undefined ? undefined : ghostRect(tape, organ, attempted, scale),
      holeMarks: holeMarks(
        tape,
        organ,
        geometry,
        scale,
        range,
        new Set(this.holesWithProblems().map(({hole}) => `${hole.pipe}:${hole.start}`)),
        this.shownSelection(),
      ),
      ...columnMarks(tape, geometry, scale, range),
      joins: joinMarks(this.shownCut(), scale),
      stretches: stretchMarks(this.stretchProblems(), geometry, scale),
      pieceLabels: pieceLabelMarks(this.shownCut(), scale),
      ...outline(geometry, scale),
      // The Whole Tape fills the stage without a scroll, so only the other zooms leave room for the end grip.
      svgWidth: drawingWidth(geometry, scale, this.zoom() !== 'whole'),
      drawingParams: drawingParams(tape, organ, language),
    };
  });

  /** The translation key of why Record is unavailable, or `undefined` when the Tape can be recorded now. */
  protected readonly recordBlockedBy = computed((): string | undefined => {
    const tape = this.tape();
    const organ = this.organ();
    if (tape === undefined || organ === undefined || columnDuration(tape, organ) === undefined) return 'TAPE.RECORD.NO_TAPE_PER_TURN';
    if (this.preview.playing()) return 'TAPE.RECORD.WHILE_PREVIEW';
    return undefined;
  });

  /** The percent of a Recording that is rendering or encoding; `undefined` in the other steps. */
  protected readonly recordPercent = computed((): number | undefined => {
    const state = this.recorder.state();
    return state.status === 'rendering' || state.status === 'encoding' ? Math.round(state.progress * 100) : undefined;
  });

  /** Whether a Recording can be cancelled now: while it renders or encodes. */
  protected readonly recordCancellable = computed((): boolean => {
    const status = this.recorder.state().status;
    return status === 'rendering' || status === 'encoding';
  });

  protected record(): void {
    // The button stays focusable with its reason, so a click reaches here while it is blocked: it does nothing then.
    if (this.recordBlockedBy() !== undefined || this.recorder.recording()) return;
    const tape = this.tape();
    const organ = this.organ();
    if (tape !== undefined && organ !== undefined) void this.recorder.record(tape, organ);
  }

  protected exportTape(): void {
    const tape = this.tape();
    const organ = this.organ();
    if (tape !== undefined && organ !== undefined) void this.plotterExport.export(tape, organ, this.plotterPreference.picked());
  }

  protected exportScores(): void {
    const tape = this.tape();
    const organ = this.organ();
    if (tape !== undefined && organ !== undefined) void this.scoresExport.export(tape, organ, this.song());
  }

  protected readonly canTranspose = computed(() => {
    const tape = this.tape();
    const organ = this.organ();
    return tape !== undefined && organ !== undefined && canTranspose(tape, organ);
  });

  /** Asks in a dialog how to transpose, then saves the result as one edit and selects the moved Holes. */
  protected transpose(): void {
    const tape = this.tape();
    const organ = this.organ();
    if (tape === undefined || organ === undefined) return;
    const selected = holeRefsOf(this.holeSelection(), organ);
    const dialog = this.dialog.open<TransposeDialogComponent, TransposeDialogData, Transposed>(TransposeDialogComponent, {data: {tape, organ, selected}});
    dialog.beforeClosed().subscribe((result) => {
      if (result !== undefined) this.commit({kind: 'applied', tape: result.tape, selection: selectionOfRefs(result.outcome.resulting, organ)});
    });
  }

  /** Whether the event carries the key that adds to a selection: Ctrl, or Cmd on macOS. */
  private isAdditive(event: {readonly ctrlKey: boolean; readonly metaKey: boolean}): boolean {
    return this.platform === 'darwin' ? event.metaKey : event.ctrlKey;
  }

  protected select(hole: {readonly row: number; readonly start: number}, event: MouseEvent): void {
    if (this.dragJustEnded) return;
    const clicked = {row: hole.row + 1, start: hole.start};
    this.selection.set({holes: this.isAdditive(event) ? toggled(this.holeSelection(), clicked) : [clicked]});
    this.scrollToSelection = true;
  }

  /** Selects the Hole of a Cutting Problems entry and brings it into view. */
  protected chooseProblem(hole: HoleRef): void {
    const row = this.organ()?.pipes.findIndex((pipe) => pipe.note === hole.pipe);
    if (row === undefined || row < 0) return;
    this.selection.set({holes: [{row: row + 1, start: hole.start}]});
    this.scrollToSelection = true;
  }

  /** Selects nothing and brings the first Column of a stretch, where its mark is drawn, into view. */
  protected chooseStretch(stretch: NoJoinProblem): void {
    this.selection.set({holes: []});
    this.stretchInView = stretch.start + 1;
  }

  /** Shows the Cutting Problems section in the side panel and focuses it, for the Plotter section's link to them. */
  protected revealCuttingProblems(): void {
    this.cuttingProblemsSection()?.reveal();
  }

  /** Whether the Organ can play the Tape: it needs a Tape per Crank turn. */
  protected readonly previewAvailable = computed(() => {
    const tape = this.shownTape();
    const organ = this.organ();
    return tape !== undefined && organ !== undefined && columnDuration(tape, organ) !== undefined;
  });

  /** Where the playhead is drawn, in px of the drawing, and the Column it stands on, rounded for the DOM. */
  protected readonly playheadLine = computed(() => {
    const geometry = this.geometry();
    const tape = this.shownTape();
    if (geometry === undefined || tape === undefined) return undefined;
    const playhead = this.preview.playhead();
    return {x: (geometry.leadIn + playhead * tape.columnLength) * this.scale(), column: Math.round(playhead * 100) / 100};
  });

  /** The playhead grip: its hit area in px of the drawing, inside the ruler band, and its triangle; `undefined` without a playhead. */
  protected readonly playheadGrip = computed(() => {
    const line = this.playheadLine();
    if (line === undefined) return undefined;
    const centre = line.x + 1;
    return {x: centre - PLAYHEAD_GRIP_WIDTH / 2, width: PLAYHEAD_GRIP_WIDTH, height: RULER_HEIGHT, mark: `M${centre - 5} 0H${centre + 5}L${centre} 7Z`};
  });

  /** Whether editing is paused: the Preview plays, and the Tape must not change except by its Crank speed. */
  protected readonly editingPaused = computed(() => this.preview.playing());

  /** A click on the ruler moves the playhead to the Column under it, rounded down; nothing happens while the Preview plays. */
  protected onRulerClick(event: MouseEvent, svg: Element): void {
    if (this.editingPaused()) return;
    this.setPlayheadAt(event, svg);
  }

  /** Moves the playhead to the Column under the pointer, rounded down and clamped to the Tape. */
  private setPlayheadAt(event: {readonly clientX: number}, svg: Element): void {
    const tape = this.shownTape();
    const geometry = this.geometry();
    if (tape === undefined || geometry === undefined) return;
    const x = event.clientX - svg.getBoundingClientRect().left;
    const picked = column(Math.min(gridAt(x, 0, this.scale(), geometry).column, tape.length - 1));
    if (picked !== undefined) this.preview.setPlayhead(picked);
  }

  /**
   * Presses the playhead grip: a playing Preview stops at once, and the drag moves the playhead. The grip takes the pointer,
   * so the drag reaches it; the press is not a press on the drawing.
   */
  protected onPlayheadGripDown(event: PointerEvent): void {
    if (event.button !== 0 || this.playheadDrag !== undefined) return;
    event.stopPropagation();
    const grip = event.currentTarget;
    try {
      if (grip instanceof Element) grip.setPointerCapture(event.pointerId);
    } catch {
      // No active pointer to capture (a synthetic event): the drag still follows the moves over the grip.
    }
    const wasPlaying = this.preview.playing();
    if (wasPlaying) this.preview.stop();
    this.playheadDrag = {wasPlaying};
  }

  protected onPlayheadGripMove(event: PointerEvent, svg: Element): void {
    if (this.playheadDrag === undefined) return;
    event.stopPropagation();
    this.setPlayheadAt(event, svg);
  }

  protected onPlayheadGripUp(event: PointerEvent, svg: Element): void {
    if (this.playheadDrag === undefined) return;
    event.stopPropagation();
    this.setPlayheadAt(event, svg);
    this.endPlayheadDrag();
  }

  /**
   * A cancelled drag, or one whose pointer capture was lost, keeps the playhead where it was last moved, and goes on from
   * there if the Preview played at the press. After a release the drag is over already, so the lost capture changes nothing.
   */
  protected onPlayheadGripCancel(event: PointerEvent): void {
    event.stopPropagation();
    this.endPlayheadDrag();
  }

  private endPlayheadDrag(): void {
    const drag = this.playheadDrag;
    this.playheadDrag = undefined;
    if (drag?.wasPlaying) this.playFromPlayhead();
  }

  /** The start Column the Preview section typed (0-based): moves the playhead there. */
  protected onStartColumnChange(index: number): void {
    const picked = column(index);
    if (picked !== undefined) this.preview.setPlayhead(picked);
  }

  /** Starts a Preview from the playhead, or from the first Column when the playhead is at the end; stops a playing one. */
  protected togglePreview(): void {
    if (this.preview.playing()) {
      this.preview.stop();
      return;
    }
    // The button stays focusable with its reason, so a click reaches here while it is unavailable: it does nothing then.
    // A Recording renders the Tape on its own; the Preview waits for it.
    if (!this.previewAvailable() || this.recorder.recording()) return;
    this.playFromPlayhead();
  }

  /** Plays the Tape from the Column under the playhead, or from the first Column when the playhead is at the end. */
  private playFromPlayhead(): void {
    const tape = this.shownTape();
    const organ = this.organ();
    if (tape === undefined || organ === undefined) return;
    const playhead = this.preview.playhead();
    const from = column(playhead >= tape.length ? 0 : Math.floor(playhead));
    if (from !== undefined) this.preview.play(tape, organ, from);
  }

  protected undo(): void {
    if (this.editingPaused() || this.recorder.recording() || !this.editor.canUndo()) return;
    void this.editor.undo();
    this.restoreSelection(); // The editor moves its history before it saves.
  }

  protected redo(): void {
    if (this.editingPaused() || this.recorder.recording() || !this.editor.canRedo()) return;
    void this.editor.redo();
    this.restoreSelection(); // The editor moves its history before it saves.
  }

  private restoreSelection(): void {
    this.selection.set({holes: this.editor.selection()});
    this.scrollToSelection = true;
  }

  /** Undo and redo shortcuts work wherever the focus is in the Tape view; text fields keep their own history. */
  protected onViewKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented) return;
    const {key, altKey, shiftKey, ctrlKey, metaKey} = event;
    const target = event.target instanceof Element ? event.target : null;
    const intent = historyIntent({key, altKey, shiftKey, ctrlKey, metaKey, target}, this.platform);
    if (intent !== undefined) {
      event.preventDefault();
      if (intent.kind === 'undo') this.undo();
      else this.redo();
      return;
    }
    // Space plays and stops the Preview, except where it types, follows a link, or picks from a list.
    if (key === ' ' && !target?.matches(SPACE_IS_KEPT_BY)) {
      event.preventDefault();
      // A held Space repeats its keydown; only the first press toggles.
      if (!event.repeat) this.togglePreview();
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      if (this.holeDrag.dragging()) this.holeDrag.cancel();
      else if (this.framing !== undefined) this.cancelFrame();
      else this.selection.set({holes: []});
      return;
    }
    if (this.spotKey(event)) return;
    if (this.isAdditive(event) && !event.altKey) {
      const direction = ARROW_DIRECTIONS[event.key];
      if (direction !== undefined) {
        event.preventDefault();
        this.setSelection(extended(this.holeSelection(), this.selectable(), direction));
        return;
      }
      if (event.key.toLowerCase() === 'a') {
        event.preventDefault();
        this.setSelection(allOf(this.selectable()));
        return;
      }
    }
    const intent = editIntent(event);
    if (intent !== undefined) {
      if (this.editingPaused()) return;
      const tape = this.tape();
      const organ = this.organ();
      const selected = soleOf(this.holeSelection());
      if (tape === undefined || organ === undefined || selected === undefined) return;
      event.preventDefault();
      this.commit(keyEdit(tape, organ, selected, intent));
      return;
    }
    const slots = this.geometry()?.slots;
    if (slots === undefined) return;
    const current = soleOf(this.holeSelection());
    if (event.key === 'Enter' && current === undefined) {
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

  /** While a Spot is selected: an arrow moves it, Enter adds a Hole there. @returns whether the key was taken */
  private spotKey(event: KeyboardEvent): boolean {
    const spot = this.spotSelected();
    if (spot === undefined) return false;
    if (event.key === 'Enter') {
      event.preventDefault();
      this.addAtSpot(spot);
      return true;
    }
    const direction = ARROW_DIRECTIONS[event.key];
    const tape = this.shownTape();
    const organ = this.organ();
    if (direction === undefined || tape === undefined || organ === undefined) return false;
    event.preventDefault();
    this.selection.set({spot: moveSpot(spot, direction, organ.pipes.length, tape, organ)});
    return true;
  }

  private moveSelection(target: SelectableHole | undefined): void {
    if (target === undefined) return;
    this.selection.set({holes: [{row: target.row, start: target.start}]});
    this.scrollToSelection = true;
  }

  private setSelection(holes: HoleSelection): void {
    this.selection.set({holes: holes.map(({row, start}) => ({row, start}))});
    this.scrollToSelection = true;
  }

  /**
   * Tracks the touch pointers on the drawing. A second touch ends the gestures in progress, and the touches change nothing
   * until all are up. A touch whose capture moved without a pointerup is forgotten once a new touch goes down. Mouse and pen
   * pass. @returns whether the event is to be ignored
   */
  private trackTouch(event: PointerEvent): boolean {
    if (event.pointerType !== 'touch') return false;
    if (event.type === 'pointerdown') {
      this.forgetLostTouches();
      this.touches.add(event.pointerId);
      if (this.touches.size > 1) {
        this.touchesIgnored = true;
        this.cancelGesture();
      }
      return this.touchesIgnored;
    }
    const ignored = this.touchesIgnored;
    if (event.type === 'lostpointercapture') {
      if (this.touches.has(event.pointerId)) this.lostTouches.add(event.pointerId);
    } else if (event.type === 'gotpointercapture') {
      this.lostTouches.delete(event.pointerId);
    } else if (event.type === 'pointerup' || event.type === 'pointercancel') {
      this.lostTouches.delete(event.pointerId);
      this.touches.delete(event.pointerId);
      if (this.touches.size === 0) this.touchesIgnored = false;
    }
    return ignored;
  }

  /** Forgets the touches whose capture was lost and never came back: the browser ended them without a pointerup. */
  private forgetLostTouches(): void {
    for (const pointerId of this.lostTouches) this.touches.delete(pointerId);
    this.lostTouches.clear();
    if (this.touches.size === 0) this.touchesIgnored = false;
  }

  /** Starts a selection frame at an empty spot of the Tape; it only shows once the press travels. */
  protected onPointerDown(event: PointerEvent, svg: Element): void {
    if (this.trackTouch(event)) return;
    const target = event.target;
    if (event.button !== 0 || (target instanceof Element && target.closest('.hole-part') !== null)) return;
    const geometry = this.geometry();
    if (geometry === undefined) return;
    const box = svg.getBoundingClientRect();
    const x = event.clientX - box.left;
    const y = event.clientY - box.top - RULER_HEIGHT;
    if (y < 0) return;
    this.framing = {
      press: {x: event.clientX, y: event.clientY},
      origin: {x, y},
      cell: gridAt(x, y, this.scale(), geometry),
      additive: this.isAdditive(event),
      touch: event.pointerType === 'touch',
    };
  }

  private stretchFrame(event: PointerEvent, svg: Element): void {
    const framing = this.framing;
    if (framing === undefined) return;
    const travelled = isDrag(framing.press, {x: event.clientX, y: event.clientY});
    if (framing.touch && travelled) {
      // A touch that travels is a pan of the drawing: no frame, and the press is no tap.
      this.cancelFrame();
      return;
    }
    if (!travelled && this.frameRect() === undefined) return;
    if (this.frameRect() === undefined) {
      try {
        svg.setPointerCapture(event.pointerId);
      } catch {
        // No active pointer to capture (a synthetic event): the frame still follows the moves over the drawing.
      }
    }
    const box = svg.getBoundingClientRect();
    const x = event.clientX - box.left;
    const y = Math.max(0, event.clientY - box.top - RULER_HEIGHT);
    this.frameRect.set({
      x: Math.min(framing.origin.x, x),
      y: Math.min(framing.origin.y, y),
      width: Math.abs(x - framing.origin.x),
      height: Math.abs(y - framing.origin.y),
    });
  }

  /** Ends the frame: a frame selects the Holes it overlaps (adding to the selection when additive); a press without travel is a tap. */
  private finishFrame(event: PointerEvent, svg: Element): void {
    const framing = this.framing;
    const geometry = this.geometry();
    const tape = this.shownTape();
    const organ = this.organ();
    const travelled = this.frameRect() !== undefined;
    this.cancelFrame();
    if (framing === undefined || geometry === undefined || tape === undefined || organ === undefined) return;
    if (!travelled) {
      this.tap(framing, geometry, tape, organ);
      return;
    }
    const box = svg.getBoundingClientRect();
    const end = gridAt(event.clientX - box.left, Math.max(0, event.clientY - box.top - RULER_HEIGHT), this.scale(), geometry);
    const inside = framed(this.selectable(), frameBetween(framing.cell, end));
    this.setSelection(framing.additive ? united(this.holeSelection(), inside) : inside);
  }

  /**
   * A tap on empty Tape: selects the Spot under it; on the selected Spot it adds a Hole there. The Lead-in and a cell
   * covered by a Hole clear the selection. An additive tap changes nothing.
   */
  private tap(framing: Framing, geometry: TapeGeometry, tape: Tape, organ: Organ): void {
    if (framing.additive) return;
    const onLeadIn = framing.origin.x < geometry.leadIn * this.scale();
    const hole = onLeadIn ? undefined : holeAt(framing.cell, tape, organ);
    if (hole !== undefined) {
      this.tapHole(hole, false);
      return;
    }
    const spot = onLeadIn ? undefined : spotAt(framing.cell, tape, organ);
    if (spot === undefined) {
      this.tapMemory = undefined;
      this.selection.set({holes: []});
      return;
    }
    const selection = this.selection();
    if ('spot' in selection && sameSpot(selection.spot, spot)) {
      this.addAtSpot(spot);
      return;
    }
    this.tapMemory = undefined;
    this.selection.set({spot});
  }

  /** Adds a Hole of the Spot's Pipe at its Column, as one edit; the Spot's Hole becomes the selection. */
  private addAtSpot(spot: Spot): void {
    const tape = this.tape();
    const organ = this.organ();
    const pipe = organ?.pipes[spot.row - 1]?.note;
    if (tape === undefined || organ === undefined || pipe === undefined) return;
    const memory = nextTap(this.tapMemory, {hole: {row: spot.row, start: spot.start}, at: performance.now(), added: true, modifier: false}).memory;
    if (this.commit(addEdit(tape, organ, pipe, spot.start))) this.tapMemory = memory;
  }

  /**
   * A tap on a Hole: a plain tap selects it; a second tap on the same Hole within the double-tap time removes it, as the
   * Delete key does. A tap with a modifier key leaves the selection to the click that follows it.
   */
  private tapHole(hole: SelectableHole, modifier: boolean): void {
    const result = nextTap(this.tapMemory, {hole, at: performance.now(), added: false, modifier});
    this.tapMemory = result.memory;
    if (modifier) return;
    this.selection.set({holes: [hole]});
    if (!result.double) return;
    const tape = this.tape();
    const organ = this.organ();
    this.endGesture();
    if (tape === undefined || organ === undefined) return;
    this.commit(keyEdit(tape, organ, hole, {kind: 'remove'}));
  }

  private cancelFrame(): void {
    this.framing = undefined;
    this.frameRect.set(undefined);
  }

  protected onPointerMove(event: PointerEvent, svg: Element): void {
    if (this.trackTouch(event)) return;
    this.stretchFrame(event, svg);
    this.lastPointer = {clientX: event.clientX, clientY: event.clientY, pointerId: event.pointerId, svg};
    this.followPointer(this.lastPointer);
    if (this.holeDrag.dragging() && this.edgeScrollFrame === undefined) this.scheduleEdgeScroll();
  }

  private followPointer({clientX, clientY, pointerId, svg}: NonNullable<typeof this.lastPointer>): void {
    const geometry = this.geometry();
    if (geometry === undefined) return;
    const box = svg.getBoundingClientRect();
    const x = clientX - box.left;
    const y = clientY - box.top - RULER_HEIGHT;
    this.pointer.set(pointerAt(x, y, this.scale(), geometry));
    if (this.holeDrag.move({x: clientX, y: clientY}, gridAt(x, y, this.scale(), geometry))) {
      // Captured only once it is a drag, so that a plain click still reaches the Hole.
      try {
        svg.setPointerCapture(pointerId);
      } catch {
        // No active pointer to capture (a synthetic event): the drag still follows the moves over the drawing.
      }
    }
  }

  /** Outside the zone: a frame loop that waits for the pointer must not keep the app from being stable. */
  private scheduleEdgeScroll(): void {
    this.edgeScrollFrame = this.zone.runOutsideAngular(() => requestAnimationFrame(() => this.edgeScroll()));
  }

  /** Forgets the pointer and the pending frame once the drag is over. */
  private stopEdgeScroll(): void {
    this.lastPointer = undefined;
    if (this.edgeScrollFrame !== undefined) cancelAnimationFrame(this.edgeScrollFrame);
    this.edgeScrollFrame = undefined;
  }

  /** While a Hole is dragged and rests near an edge of the stage, scrolls it each frame; the Tape grows at its end. */
  private edgeScroll(): void {
    this.edgeScrollFrame = undefined;
    const pointer = this.lastPointer;
    const scroll = this.scrollElement()?.nativeElement;
    if (!this.holeDrag.dragging() || pointer === undefined || scroll === undefined) return;
    const box = scroll.getBoundingClientRect();
    const step = pointer.clientX > box.right - EDGE_ZONE ? EDGE_SCROLL_STEP : pointer.clientX < box.left + EDGE_ZONE ? -EDGE_SCROLL_STEP : 0;
    if (step !== 0) {
      scroll.scrollLeft += step;
      this.stage.onScroll(scroll);
      this.followPointer(pointer);
    }
    this.scheduleEdgeScroll();
  }

  /** Presses a Hole, or one of the grips of the selected Hole; a press that travels turns into a drag. */
  protected onHolePointerDown(event: PointerEvent, hole: {readonly row: number; readonly start: number}, svg: Element, part: HolePart = 'body'): void {
    if (this.trackTouch(event)) return;
    const tape = this.tape();
    const organ = this.organ();
    const geometry = this.geometry();
    const pipe = organ?.pipes[hole.row]?.note;
    const stored = tape?.holes.find((candidate) => candidate.pipe === pipe && candidate.start === hole.start);
    if (event.button !== 0 || this.editingPaused() || tape === undefined || organ === undefined || geometry === undefined || stored === undefined) return;
    const box = svg.getBoundingClientRect();
    this.holeDrag.start(
      {
        part,
        hole: {...stored, row: hole.row + 1},
        from: gridAt(event.clientX - box.left, event.clientY - box.top - RULER_HEIGHT, this.scale(), geometry),
      },
      {x: event.clientX, y: event.clientY},
      {tape, organ},
    );
  }

  protected onPointerUp(event: PointerEvent, svg: Element): void {
    if (this.trackTouch(event)) return;
    this.stopEdgeScroll();
    if (this.framing !== undefined) {
      this.finishFrame(event, svg);
      return;
    }
    const geometry = this.geometry();
    if (geometry === undefined) return;
    const pressed = this.holeDrag.grabbed;
    const pressedPart = this.holeDrag.grabbedPart;
    const box = svg.getBoundingClientRect();
    const outcome = this.holeDrag.finish(gridAt(event.clientX - box.left, event.clientY - box.top - RULER_HEIGHT, this.scale(), geometry));
    if (outcome === undefined) {
      if (pressed === undefined) return;
      if (pressedPart !== 'body') {
        this.tapMemory = undefined;
        return;
      }
      this.tapHole({row: pressed.row, start: pressed.start}, event.shiftKey || this.isAdditive(event));
      return;
    }
    this.tapMemory = undefined;
    this.endGesture();
    this.commit(outcome);
  }

  /** Ignores the click that follows a press which just changed the Tape, so the click does not select again. */
  private endGesture(): void {
    this.dragJustEnded = true;
    clearTimeout(this.dragEndedTimer);
    this.dragEndedTimer = setTimeout(() => (this.dragJustEnded = false));
  }

  protected onPointerCancel(event: PointerEvent): void {
    this.trackTouch(event);
    this.cancelGesture();
  }

  /** Marks a touch the browser ended without a pointerup (the pointerup of a normal release has already done so). */
  protected onPointerLostCapture(event: PointerEvent): void {
    this.trackTouch(event);
  }

  /** Unmarks a touch whose capture came back to the drawing, so it stays down. */
  protected onPointerGotCapture(event: PointerEvent): void {
    this.trackTouch(event);
  }

  /** Ends the gestures of the drawing in progress: a Hole drag, a frame or a pending tap, and the edge scroll. */
  private cancelGesture(): void {
    this.stopEdgeScroll();
    this.cancelFrame();
    this.holeDrag.cancel();
  }

  /** Saves an edit unless editing is paused, and selects the Hole it leaves; a refusal says why instead. Tells whether the edit was applied. */
  private commit(outcome: EditOutcome): boolean {
    if (this.editingPaused()) return false;
    return this.save(outcome);
  }

  /** Saves an outcome as one edit; the Crank speed may change while editing is paused, so it bypasses the pause. */
  private save(outcome: EditOutcome): boolean {
    if (outcome.kind === 'refused') {
      const text = this.translate.instant('TAPE.EDIT.REFUSED_OVERLAP', {
        note: noteName(outcome.other.pipe),
        column: formatNumber(outcome.other.start + 1, this.language()),
      });
      this.snackBar.open(String(text), undefined, {duration: REFUSAL_DURATION});
    } else if (outcome.kind === 'applied') {
      this.editor.remember(this.holeSelection());
      void this.editor.apply({tape: outcome.tape, selection: outcome.selection});
      this.selection.set({holes: outcome.selection});
      this.scrollToSelection = true;
    }
    return outcome.kind === 'applied';
  }

  /** Saves the Tape with a new Column length as one edit; the Holes and the selection stay. */
  protected onColumnLengthChange(tape: Tape): void {
    this.commit({kind: 'applied', tape, selection: this.holeSelection()});
  }

  /** Plays the Tape at a Crank speed the slider moves to, without saving it or adding an undo step. */
  protected onCrankSpeedTrial(speed: number): void {
    const tape = this.tape();
    const organ = this.organ();
    if (tape === undefined || organ === undefined) return;
    const change = crankSpeedChangeTo(tape, speed);
    if (change.state !== 'invalid') this.preview.changeTape(change.state === 'ready' ? change.tape : tape, organ);
  }

  /** Saves the Tape with a new Crank speed as one edit, and re-anchors a Preview that plays; the Holes and the selection stay. */
  protected onCrankSpeedChange(tape: Tape): void {
    this.save({kind: 'applied', tape, selection: this.holeSelection()});
    const organ = this.organ();
    if (organ !== undefined) this.preview.changeTape(tape, organ);
  }

  /** Adds the Hole the form asks for, then returns the focus to the drawing. */
  protected addFromForm(added: HoleRef): void {
    const tape = this.tape();
    const organ = this.organ();
    if (tape === undefined || organ === undefined) return;
    if (this.commit(addEdit(tape, organ, added.pipe, added.start))) this.drawingSvg()?.nativeElement.focus();
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
    if (element.scrollLeft !== this.followedScrollLeft) this.ownerScrolledAt = performance.now();
    this.stage.onScroll(element);
  }

  protected onWheel(): void {
    this.ownerScrolledAt = performance.now();
  }


  /**
   * Where the stage scrolls to keep the playhead in view while the Preview plays, or `undefined` to leave it:
   * not when the playhead is visible, or while the owner scrolled or wheeled the stage lately.
   */
  private followTarget(): number | undefined {
    const element = this.scrollElement()?.nativeElement;
    const line = this.playheadLine();
    if (element === undefined || !this.preview.playing() || line === undefined) return undefined;
    if (performance.now() - this.ownerScrolledAt < OWNER_SCROLL_PAUSE) return undefined;
    const visibleEnd = element.scrollLeft + element.clientWidth;
    if (line.x >= element.scrollLeft && line.x <= visibleEnd) return undefined;
    return line.x - element.clientWidth * FOLLOW_LEAD;
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
    const unregisterEditCommands = this.editCommands.register((command) => {
      if (command === 'undo') this.undo();
      else this.redo();
    });
    inject(DestroyRef).onDestroy(() => {
      unregisterEditCommands();
      this.holeDrag.cancel();
      clearTimeout(this.dragEndedTimer);
      this.stopEdgeScroll();
    });
    this.sidePanelOpen.set(this.compact() && this.importSummary() !== null);
    afterEveryRender(() => {
      const element = this.scrollElement()?.nativeElement;
      if (element === undefined) return;
      this.stage.readStage(element);
      if (this.stretchInView !== undefined) {
        const first = this.stretchInView;
        this.stretchInView = undefined;
        element.querySelector(`[data-testid="stretch-mark"][data-first="${first}"]`)?.scrollIntoView({block: 'nearest', inline: 'start'});
        return;
      }
      if (!this.scrollToSelection) return;
      const selected = element.querySelector('rect.selected');
      if (selected !== null) {
        this.scrollToSelection = false;
        selected.scrollIntoView({block: 'nearest', inline: 'nearest'});
        return;
      }
      const current = soleOf(this.holeSelection());
      const geometry = this.geometry();
      const slot = geometry?.slots.find((candidate) => candidate.row === current?.row && candidate.start === current?.start);
      if (geometry === undefined || slot === undefined) return;
      const rendered = this.drawing()?.holes.some((hole) => hole.row === slot.row - 1 && hole.start === slot.start);
      if (rendered) return; // Its rect is drawn on the next render.
      this.scrollToSelection = false;
      element.scrollLeft = slot.x * this.scale();
    });
    effect(() => {
      const tape = this.tape();
      if (tape !== undefined && untracked(this.editor.tape)?.id !== tape.id) this.editor.open(tape);
    });
    effect(() => {
      if (this.library.loaded() && this.drawing() === undefined) void this.router.navigateByUrl('/tapes');
    });
    // While the Preview plays, the stage follows the playhead: the layout is read first, then the scroll is written.
    afterRenderEffect({
      earlyRead: () => this.followTarget(),
      write: (target) => {
        const scrollLeft = target();
        const element = this.scrollElement()?.nativeElement;
        if (scrollLeft === undefined || element === undefined) return;
        element.scrollLeft = scrollLeft;
        this.followedScrollLeft = element.scrollLeft;
      },
    });
  }
}
