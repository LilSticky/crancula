import {afterNextRender, ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, Injector, input, linkedSignal, signal, untracked, viewChild} from '@angular/core';
import {BreakpointObserver} from '@angular/cdk/layout';
import {toSignal} from '@angular/core/rxjs-interop';
import {type FieldTree, form} from '@angular/forms/signals';
import {ErrorStateMatcher} from '@angular/material/core';
import {MatButton} from '@angular/material/button';
import {MatDialog} from '@angular/material/dialog';
import {MatIcon} from '@angular/material/icon';
import {MatSnackBar} from '@angular/material/snack-bar';
import {Router} from '@angular/router';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import {
  addPipe,
  type Borders,
  emptyOrganDraft,
  movePipe,
  newOrganId,
  ORGAN_PRESETS,
  type OrganPreset,
  type Organ,
  type OrganDraft,
  removePipe,
  tapeBedFit,
  toDraft,
  validateOrgan,
} from '@api/index';
import {firstValueFrom, map} from 'rxjs';
import {formatNumber} from '../../shared/format-number';
import {LanguagePreference} from '../../shared/language-preference';
import {ConfirmableAction, ConfirmDialogComponent} from '../../shared/components/confirm-dialog/confirm-dialog.component';
import type {LeaveProblem, TranslatableText, UnsavedChanges, UnsavedChangesCheck} from '../../shared/leave-unsaved/leave-unsaved.guard';
import {ActionBarComponent} from '../../shared/components/action-bar/action-bar.component';
import {PageHeadComponent} from '../../shared/components/page-head/page-head.component';
import {TapeLibrary} from '../../tape/tape-library.store';
import {OrganDeletion} from '../organ-deletion';
import {OrganLibrary} from '../organ-library.store';
import {pipeRange} from '../pipe-range';
import {changedFields, FIELD_LABEL_KEYS, type FieldProblem, organFormSchema, organProblems, problemFields, SaveAttempt, ShownViolationMatcher} from './organ-form';
import {PipeRackComponent} from './pipe-rack/pipe-rack.component';
import {TapeBedSheetComponent} from './tape-bed-sheet/tape-bed-sheet.component';

/** Below this width the Pipe rack has 2 columns of compact rows (the same threshold as the shell). */
const COMPACT_QUERY = '(max-width: 1179.98px)';

/** The test id of the element that takes the focus for each field outside the Pipe rows. */
const FIELD_TEST_IDS: Readonly<Record<string, string>> = {
  name: 'name',
  'tapeBed.tapeWidth': 'tape-width',
  'tapeBed.holeDiameter': 'hole-diameter',
  'tapeBed.rowSpacing': 'row-spacing',
  'tapeBed.guideMargin': 'guide-margin',
  minimumGap: 'minimum-gap',
  leadIn: 'lead-in',
  tapePerCrankTurn: 'tape-per-crank-turn',
  slowestCrankSpeed: 'slowest-crank-speed',
  fastestCrankSpeed: 'fastest-crank-speed',
};

@Component({
  selector: 'cranc-organ-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, MatButton, MatIcon, PageHeadComponent, ActionBarComponent, TapeBedSheetComponent, PipeRackComponent],
  templateUrl: './organ-editor.component.html',
  providers: [SaveAttempt, {provide: ErrorStateMatcher, useClass: ShownViolationMatcher}],
  styles: `
    .delete-organ {
      --mat-button-text-label-text-color: var(--mat-sys-error);
    }

    .presets-head {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .presets-label {
      color: var(--mat-sys-on-surface-variant);
      font-size: 0.875rem;
    }

    .presets {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .unsaved-dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      margin-right: 8px;
      border-radius: 50%;
      background: var(--mat-sys-error);
    }

    :host {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      min-height: 0;
    }

    .organ-editor {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      min-height: 0;
      width: 100%;
      max-width: 72rem;
    }

    .sheets {
      display: grid;
      grid-template-columns: 392px minmax(0, 1fr);
      gap: 20px;
      flex: 1 1 auto;
      grid-template-rows: minmax(0, 1fr);
      min-height: 0;
      margin-bottom: 20px;
    }

    @media (max-width: 1180px) {
      .sheets {
        grid-template-columns: 340px minmax(0, 1fr);
      }
    }

    .error-summary {
      display: flex;
      gap: 12px;
      margin-bottom: 20px;
      padding: 16px 20px;
      border: 1px solid var(--mat-sys-error);
      border-radius: 4px;
      color: var(--mat-sys-error);

      h2 {
        margin: 0 0 8px;
        font-size: 1rem;
      }

      ul {
        margin: 0;
        padding: 0;
        list-style: none;
      }

      button {
        color: inherit;
        text-decoration: underline;
      }
    }
  `,
})
export class OrganEditorComponent implements UnsavedChangesCheck {
  /** Route parameter; absent for a new Organ. */
  readonly id = input<string>();

  private readonly breakpoints = inject(BreakpointObserver);
  private readonly library = inject(OrganLibrary);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly tapes = inject(TapeLibrary);
  private readonly deletion = inject(OrganDeletion);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);
  private readonly injector = inject(Injector);
  private readonly pipeRack = viewChild(PipeRackComponent);
  private deleted = false;

  /** The Organ as it was when opened: the stored one, or a new one with its id already assigned. */
  private readonly opened = computed<OrganDraft>(() => {
    const id = this.id();
    const stored = id ? untracked(() => this.library.entityMap()[id]) : undefined;
    return stored ? toDraft(stored) : {...emptyOrganDraft(), id: newOrganId()};
  });

  /** The Organ as entered; may be invalid. */
  private readonly draft = linkedSignal<OrganDraft>(() => this.opened());

  /** The inputs bind to this form; its one rule is `validateOrgan`, reported at the fields. */
  protected readonly organ: FieldTree<OrganDraft> = form(this.draft, organFormSchema);

  /** The last saved version of the draft: what "unchanged" is measured against. */
  private readonly saved = linkedSignal<OrganDraft>(() => this.opened());

  private readonly changed = computed(() => JSON.stringify(this.draft()) !== JSON.stringify(this.saved()));
  private readonly saving = signal(false);
  protected readonly isStored = computed(() => {
    const {id} = this.draft();
    return id !== undefined && this.library.entityMap()[id] !== undefined;
  });

  /** "Not saved yet" for a new Organ, else the number of Pipes and the lowest and highest note of the saved Organ. */
  protected readonly subtitle = computed(() => {
    this.language(); // Re-read the texts when the language changes.
    const id = this.draft().id;
    const stored = id ? this.library.entityMap()[id] : undefined;
    if (!stored) return String(this.translate.instant('ORGAN.EDITOR.NOT_SAVED_YET'));
    const range = pipeRange(stored);
    return String(this.translate.instant(range.count === 1 ? 'ORGAN.EDITOR.PIPES_RANGE_ONE' : 'ORGAN.EDITOR.PIPES_RANGE', {...range}));
  });

  /** Save is only unavailable for a stored Organ without changes, or while a save is running. */
  protected readonly saveDisabled = computed(() => this.saving() || (this.isStored() && !this.changed()));
  protected readonly changedLabels = computed(() => {
    this.language(); // Re-read the labels when the language changes.
    const names = changedFields(this.saved(), this.draft()).map((field): string => String(this.translate.instant(FIELD_LABEL_KEYS[field] ?? field)));
    return names.join(', ');
  });
  protected readonly isSaving = this.saving.asReadonly();
  protected readonly hasChanges = this.changed;

  private readonly language = inject(LanguagePreference).language;
  private readonly saveAttempt = inject(SaveAttempt).attempted;
  private readonly summary = viewChild<ElementRef<HTMLElement>>('summary');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** The fields that prevent saving, once Save was pressed; empty after that when all are fixed. */
  protected readonly summaryFields = computed(() => (this.saveAttempt() ? problemFields(organProblems(this.organ)) : []));
  protected readonly problemsKey = computed(() => (this.summaryFields().length === 1 ? 'ORGAN.EDITOR.PROBLEM_ONE' : 'ORGAN.EDITOR.PROBLEMS'));

  /** Whether a Guide margin is set; then the rows sit off-centre and the Border names both of its sides. */
  protected readonly guided = computed(() => this.draft().tapeBed.guideMargin !== null);

  /** How the rows fit the Tape Bed; `null` while a value is missing or there are no Pipes. */
  private readonly tapeBedFit = computed(() => {
    const {tapeWidth, holeDiameter, rowSpacing, guideMargin} = this.draft().tapeBed;
    const pipeCount = this.draft().pipes.length;
    if (tapeWidth === null || holeDiameter === null || rowSpacing === null || pipeCount === 0) return null;
    const tapeBed = {tapeWidth, holeDiameter, rowSpacing, ...(guideMargin === null ? {} : {guideMargin})};
    return {pipeCount, tapeWidth, holeDiameter, rowSpacing, ...tapeBedFit(tapeBed, pipeCount)};
  });

  /** The Border in the current language: one value when centred, both sides when a Guide margin is set; empty while it is unknown or not fitting. */
  protected readonly border = computed(() => {
    const fit = this.fit();
    if (fit === null || fit.tooWide) return '';
    if (!this.guided()) return fit.border;
    return String(this.translate.instant('ORGAN.EDITOR.BORDER_SIDES', {guide: fit.border, far: fit.far}));
  });

  /** The numbers of the fit check in the current language; `null` while it can't be computed. */
  protected readonly fit = computed(() => {
    const fit = this.tapeBedFit();
    if (fit === null) return null;
    const language = this.language();
    const one = fit.pipeCount === 1 ? '_ONE' : '';
    const offCentre = this.guided() ? '_OFF_CENTRE' : '';
    const tooWide = !fits(fit.borders);
    return {
      count: fit.pipeCount,
      rowSpan: formatNumber(fit.rowSpan, language),
      tapeWidth: formatNumber(fit.tapeWidth, language),
      border: formatNumber(fit.borders.guide, language),
      far: formatNumber(fit.borders.far, language),
      tooWide,
      fitKey: tooWide ? `ORGAN.EDITOR.FIT_TOO_WIDE${one}` : `ORGAN.EDITOR.FIT${offCentre}${one}`,
      drawingKey: `ORGAN.EDITOR.TAPE_BED_DRAWING${offCentre}${one}`,
    };
  });

  /** The Tape Bed in mm, for the drawing; `null` while a value is missing or a Border would be negative. */
  protected readonly drawing = computed(() => {
    const fit = this.tapeBedFit();
    if (fit === null || !fits(fit.borders)) return null;
    const {guide, far} = fit.borders;
    const rows = Array.from({length: fit.pipeCount}, (_, row) => guide + fit.holeDiameter / 2 + row * fit.rowSpacing);
    return {
      tapeWidth: fit.tapeWidth,
      length: 2 * fit.tapeWidth,
      border: guide,
      bottomBorderTop: fit.tapeWidth - far,
      bottomBorder: roundedMm(far),
      rows,
    };
  });

  protected readonly minimumHoleLength = computed(() => {
    const diameter = this.organ.tapeBed.holeDiameter().value();
    return typeof diameter === 'number' ? formatNumber(diameter, this.language()) : '';
  });

  constructor() {
    effect(() => {
      const id = this.id();
      if (id && !untracked(() => this.library.entityMap()[id])) {
        void this.router.navigate(['/organs'], {replaceUrl: true});
      }
    });
  }

  /** What leaving would lose (spec FR-012a), or `null` when there is no unsaved change. */
  unsavedChanges(): UnsavedChanges | null {
    if (this.deleted || !this.changed()) return null;
    return {problems: organProblems(this.organ).map(toProblem)};
  }

  protected readonly presets = ORGAN_PRESETS;

  /** Fills a new Organ from a preset, keeping its id; asks first when the draft has unsaved changes. */
  protected async usePreset(preset: OrganPreset): Promise<void> {
    if (this.changed()) {
      const {id, name} = this.draft();
      const confirmed = await firstValueFrom(
        this.dialog.open(ConfirmDialogComponent, {data: {action: ConfirmableAction.DISCARD, entity: {id, name}}}).afterClosed(),
      );
      if (confirmed !== true) return;
    }
    this.draft.update((draft) => ({...structuredClone(preset.draft), id: draft.id}));
  }

  /** Resets the draft to the last saved version (empty for a new Organ), without writing. */
  protected discard(): void {
    this.draft.set(this.saved());
  }

  /** Stores the valid, changed Organ (spec FR-012). */
  protected async save(): Promise<void> {
    const result = validateOrgan(this.draft());
    if (!result.ok) {
      this.saveAttempt.set(true);
      const summary = this.summary();
      if (summary) summary.nativeElement.focus();
      else afterNextRender(() => this.summary()?.nativeElement.focus(), {injector: this.injector});
      return;
    }
    if (!this.changed() || this.saving()) return;
    const sent = this.draft();
    this.saving.set(true);
    try {
      if (!(await this.removeHolesOfRemovedPipes(result.value))) return;
      if (!(await this.library.put(result.value))) return; // Still unsaved: the library reports the storage problem.
      this.saved.set(sent);
      this.snackBar.open(String(this.translate.instant('ORGAN.EDITOR.SAVED')), undefined, {duration: 3000});
    } finally {
      this.saving.set(false);
    }
    if (!this.id()) await this.router.navigate(['/organs', result.value.id], {replaceUrl: true});
  }

  /**
   * Asks, then removes the Holes on the Pipes this save removes from the Organ's Tapes. Tapes are written first and the
   * Organ only if that worked (ADR 18). Resolves `false` when the save must not go on.
   */
  private async removeHolesOfRemovedPipes(organ: Organ): Promise<boolean> {
    const stored = this.library.entityMap()[organ.id];
    if (!stored) return true;
    const kept = new Set(organ.pipes.map((pipe) => pipe.note));
    const removed = new Set(stored.pipes.map((pipe) => pipe.note).filter((note) => !kept.has(note)));
    if (removed.size === 0) return true;
    if (this.tapes.loadProblem() !== null) {
      this.snackBar.open(String(this.translate.instant('ORGAN.EDITOR.SAVE_BLOCKED')), String(this.translate.instant('ORGAN.STORAGE.DISMISS')));
      return false;
    }
    const affected = this.tapes.affectedByRemovingPipes(organ.id, removed);
    if (affected.holes === 0) return true;
    const confirmed = await firstValueFrom(
      this.dialog
        .open(ConfirmDialogComponent, {
          data: {
            action: ConfirmableAction.DISCARD,
            entity: {id: organ.id, name: organ.name},
            consequence: {key: 'ORGAN.EDITOR.REMOVE_PIPES_HOLES', params: affected},
          },
        })
        .afterClosed(),
    );
    return confirmed === true && (await this.tapes.removeHolesOfPipes(organ.id, removed));
  }

  /** Moves the focus to the field of an error summary entry. */
  protected focusField(path: string): void {
    const row = /^pipes\.(\d+)\./.exec(path)?.[1];
    if (row !== undefined) {
      this.pipeRack()?.focusNote(Number(row));
      return;
    }
    if (path === 'pipes') {
      this.pipeRack()?.focusAddPipe();
      return;
    }
    const testId = FIELD_TEST_IDS[path];
    if (testId) this.host.nativeElement.querySelector<HTMLElement>(`[data-testid="${testId}"]`)?.focus();
  }

  /** Whether the window is narrow: the Pipe rack then has 2 compact columns instead of 3. */
  protected readonly compact = toSignal(this.breakpoints.observe(COMPACT_QUERY).pipe(map((state) => state.matches)), {
    initialValue: this.breakpoints.isMatched(COMPACT_QUERY),
  });

  protected addPipe(): void {
    this.draft.update(addPipe);
  }

  protected movePipe(fromRow: number, toRow: number): void {
    this.draft.update((draft) => movePipe(draft, fromRow, toRow));
  }

  protected removePipe(row: number): void {
    this.draft.update((draft) => removePipe(draft, row));
  }

  protected async deleteOrgan(): Promise<void> {
    const {id, name} = this.draft();
    if (!id || !(await this.deletion.confirmAndDelete({id, name}))) return;
    this.deleted = true;
    await this.router.navigate(['/organs']);
  }
}

/** Whether both Borders are free of the rows: a Border below zero means the rows run off the Tape. */
function fits(borders: Borders): boolean {
  return borders.guide >= 0 && borders.far >= 0;
}

/** A length in mm without the float noise of the subtraction that gave it (25.349999999999994 is 25.35). */
function roundedMm(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

function toProblem({path, message}: FieldProblem): LeaveProblem {
  const pipeRow = /^pipes\.(\d+)\./.exec(path);
  const field: TranslatableText = pipeRow
    ? {key: 'ORGAN.LEAVE.PIPE_FIELD', params: {row: Number(pipeRow[1]) + 1}}
    : {key: FIELD_LABEL_KEYS[path] ?? path, params: {}};
  return {field, message};
}
