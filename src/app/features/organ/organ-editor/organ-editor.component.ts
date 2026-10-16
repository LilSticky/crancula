import {afterNextRender, ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, Injector, input, linkedSignal, signal, untracked, viewChild, viewChildren} from '@angular/core';
import {BreakpointObserver} from '@angular/cdk/layout';
import {toSignal} from '@angular/core/rxjs-interop';
import {CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, CdkDropListGroup} from '@angular/cdk/drag-drop';
import {type FieldTree, form, FormField} from '@angular/forms/signals';
import {ErrorStateMatcher} from '@angular/material/core';
import {MatButton, MatIconButton} from '@angular/material/button';
import {MatError, MatFormField, MatHint, MatInput, MatLabel, MatSuffix} from '@angular/material/input';
import {MatCard} from '@angular/material/card';
import {MatDialog} from '@angular/material/dialog';
import {MatIcon} from '@angular/material/icon';
import {MatMenu, MatMenuItem, MatMenuTrigger} from '@angular/material/menu';
import {MatTooltip} from '@angular/material/tooltip';
import {MatSnackBar} from '@angular/material/snack-bar';
import {Router} from '@angular/router';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import {
  addPipe,
  emptyOrganDraft,
  midiNoteNumber,
  movePipe,
  newOrganId,
  noteName,
  type Organ,
  type OrganDraft,
  removePipe,
  tapeBedFit,
  toDraft,
  validateOrgan,
} from '@api/index';
import {firstValueFrom, map} from 'rxjs';
import {DecimalInputDirective} from '../../shared/decimal-input.directive';
import {formatNumber} from '../../shared/format-number';
import {LanguagePreference} from '../../shared/language-preference';
import {ConfirmableAction, ConfirmDialogComponent} from '../../shared/components/confirm-dialog/confirm-dialog.component';
import type {LeaveProblem, TranslatableText, UnsavedChanges, UnsavedChangesCheck} from '../leave-unsaved.guard';
import {ActionBarComponent} from '../../shared/components/action-bar/action-bar.component';
import {PageHeadComponent} from '../../shared/components/page-head/page-head.component';
import {TapeLibrary} from '../../tape/tape-library.store';
import {OrganDeletion} from '../organ-deletion';
import {OrganLibrary} from '../organ-library.store';
import {pipeRange} from '../pipe-range';
import {rackColumns} from './pipe-rack';
import {changedFields, FIELD_LABEL_KEYS, type FieldProblem, organFormSchema, organProblems, problemFields, SaveAttempt, shownMessages, ShownViolationMatcher} from './organ-form';

/** Below this width the Pipe rack has 2 columns of compact rows (the same threshold as the shell). */
const COMPACT_QUERY = '(max-width: 1179.98px)';

/** The test id of the element that takes the focus for each field outside the Pipe rows. */
const FIELD_TEST_IDS: Readonly<Record<string, string>> = {
  name: 'name',
  'tapeBed.tapeWidth': 'tape-width',
  'tapeBed.holeDiameter': 'hole-diameter',
  'tapeBed.rowSpacing': 'row-spacing',
  minimumGap: 'minimum-gap',
  leadIn: 'lead-in',
  pipes: 'add-pipe',
};

@Component({
  selector: 'cranc-organ-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, MatFormField, MatLabel, MatInput, MatHint, MatError, MatSuffix, MatButton, MatIconButton, MatIcon, MatMenu, MatMenuItem, MatMenuTrigger, MatTooltip, MatCard, FormField, DecimalInputDirective, CdkDropList, CdkDropListGroup, CdkDrag, CdkDragHandle, PageHeadComponent, ActionBarComponent],
  templateUrl: './organ-editor.component.html',
  providers: [SaveAttempt, {provide: ErrorStateMatcher, useClass: ShownViolationMatcher}],
  styles: `
    .delete-organ {
      --mat-button-text-label-text-color: var(--mat-sys-error);
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

    mat-card {
      display: flex;
      flex-direction: column;
      min-height: 0;
      padding: 20px;
    }

    .rack-scroller {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
    }

    .sheet-title {
      margin: 0;
      font-size: 1.25rem;
    }

    .fields {
      display: grid;
      grid-template-columns: 1fr 1fr;
      column-gap: 16px;
      row-gap: 20px;
      margin-top: 16px;
    }

    @media (max-width: 1180px) {
      .fields {
        grid-template-columns: minmax(0, 1fr);
        row-gap: 12px;
      }
    }

    .full-width {
      grid-column: 1 / -1;
    }

    .fit-check {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 16px 0 0;
    }

    .fit-check.error {
      color: var(--mat-sys-error);
    }

    .tape-bed-drawing {
      display: block;
      width: 100%;
      max-height: 160px;
      margin-top: 16px;
    }

    .sheet-head {
      display: flex;
      align-items: baseline;
      gap: 12px;
      margin-bottom: 12px;

      button {
        margin-left: auto;
      }
    }

    .violation {
      color: var(--mat-sys-error);
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

    .rack {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0 18px;
    }

    .rack.compact {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .rack-column {
      min-width: 0;
    }

    .note-field {
      flex: 1 1 0;
      min-width: 0;
      width: 100%;
    }

    .rack.compact .pipe {
      min-height: 30px;
    }

    .rack-head {
      position: sticky;
      top: 0;
      z-index: 1;
      display: flex;
      gap: 4px;
      padding-bottom: 4px;
      font-size: 0.75rem;
      color: var(--mat-sys-on-surface-variant);
      background: var(--mat-card-outlined-container-color, var(--mat-sys-surface));
      border-bottom: 1px solid var(--cr-paper-edge);

      span:first-child {
        margin-left: 24px;
      }
    }

    .pipe {
      display: flex;
      align-items: center;
      gap: 4px;
      min-height: 34px;
      border-bottom: 1px solid var(--cr-paper-edge);
    }

    .row-cell {
      flex: none;
      width: 34px;
      text-align: right;
      color: var(--mat-sys-on-surface-variant);
      font-size: 0.75rem;
    }

    .note-name {
      font-weight: 600;
    }

    .note-name.sharp {
      font-weight: 400;
    }

    .drag-handle {
      cursor: grab;
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
  private readonly noteInputs = viewChildren<ElementRef<HTMLInputElement>>('noteInput');
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

  /** How the rows fit the Tape Bed; `null` while a value is missing or there are no Pipes. */
  private readonly tapeBedFit = computed(() => {
    const {tapeWidth, holeDiameter, rowSpacing} = this.draft().tapeBed;
    const pipeCount = this.draft().pipes.length;
    if (tapeWidth === null || holeDiameter === null || rowSpacing === null || pipeCount === 0) return null;
    return {pipeCount, tapeWidth, holeDiameter, rowSpacing, ...tapeBedFit({tapeWidth, holeDiameter, rowSpacing}, pipeCount)};
  });

  /** The Border the rows leave on each side, in the current language; empty while it is unknown or negative. */
  protected readonly border = computed(() => {
    const fit = this.tapeBedFit();
    return fit === null || fit.border < 0 ? '' : formatNumber(fit.border, this.language());
  });

  /** The numbers of the fit check in the current language; `null` while it can't be computed. */
  protected readonly fit = computed(() => {
    const fit = this.tapeBedFit();
    if (fit === null) return null;
    const language = this.language();
    const one = fit.pipeCount === 1 ? '_ONE' : '';
    return {
      count: fit.pipeCount,
      rowSpan: formatNumber(fit.rowSpan, language),
      tapeWidth: formatNumber(fit.tapeWidth, language),
      border: formatNumber(fit.border, language),
      tooWide: fit.border < 0,
      fitKey: `ORGAN.EDITOR.${fit.border < 0 ? 'FIT_TOO_WIDE' : 'FIT'}${one}`,
      drawingKey: `ORGAN.EDITOR.TAPE_BED_DRAWING${one}`,
    };
  });

  /** The Tape Bed in mm, for the drawing; `null` while a value is missing or the Border would be negative. */
  protected readonly drawing = computed(() => {
    const fit = this.tapeBedFit();
    if (fit === null || fit.border < 0) return null;
    const rows = Array.from({length: fit.pipeCount}, (_, row) => fit.border + fit.holeDiameter / 2 + row * fit.rowSpacing);
    return {tapeWidth: fit.tapeWidth, length: 2 * fit.tapeWidth, border: fit.border, bottomBorderTop: fit.tapeWidth - fit.border, rows};
  });

  /** The Pipes sheet head's count text key: separate texts for one and many. */
  protected readonly pipeCountKey = computed(() => (this.draft().pipes.length === 1 ? 'ORGAN.EDITOR.PIPE_COUNT_ONE' : 'ORGAN.EDITOR.PIPE_COUNT'));

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

  /** The messages to show at a field now. */
  protected messagesAt(field: FieldTree<unknown>): readonly TranslatableText[] {
    return shownMessages(field, this.organ, this.saveAttempt());
  }

  /** Moves the focus to the field of an error summary entry. */
  protected focusField(path: string): void {
    const row = /^pipes\.(\d+)\./.exec(path)?.[1];
    if (row !== undefined) {
      this.noteInputs()[Number(row)]?.nativeElement.focus();
      return;
    }
    const testId = FIELD_TEST_IDS[path];
    if (testId) this.host.nativeElement.querySelector<HTMLElement>(`[data-testid="${testId}"]`)?.focus();
  }

  /** The name of the note a Pipe plays, or nothing while its note is missing or out of range. */
  protected noteNameOf(note: number | null): string {
    const valid = note === null ? undefined : midiNoteNumber(note);
    return valid === undefined ? '' : noteName(valid);
  }

  /** Whether the window is narrow: the Pipe rack then has 2 compact columns instead of 3. */
  protected readonly compact = toSignal(this.breakpoints.observe(COMPACT_QUERY).pipe(map((state) => state.matches)), {
    initialValue: this.breakpoints.isMatched(COMPACT_QUERY),
  });

  /** The Pipe rack's columns (2 when compact, else 3): where each starts in the Pipe order and its Pipe fields. */
  protected readonly rack = computed(() => {
    const pipes = [...this.organ.pipes];
    let start = 0;
    return rackColumns(pipes.length, this.compact() ? 2 : 3).map((rows) => {
      const column = {start, pipes: pipes.slice(start, start + rows)};
      start += rows;
      return column;
    });
  });

  /** Whether a Pipe's note is a sharp, for the regular weight of its name. */
  protected isSharp(note: number | null): boolean {
    return this.noteNameOf(note).includes('#');
  }

  protected addPipe(): void {
    this.draft.update(addPipe);
  }

  protected movePipe(fromRow: number, toRow: number): void {
    this.draft.update((draft) => movePipe(draft, fromRow, toRow));
  }

  /** Alt+ArrowUp/Down: moves the Pipe one row and keeps the focus on its note input. */
  protected moveByKeyboard(event: Event, row: number, step: -1 | 1): void {
    event.preventDefault();
    const target = row + step;
    if (target < 0 || target >= this.draft().pipes.length) return;
    this.movePipe(row, target);
    afterNextRender(() => this.noteInputs()[target]?.nativeElement.focus(), {injector: this.injector});
  }

  /** Removes a Pipe; the focus moves to the note input now at its row (the last row if it was last), else to Add Pipe. */
  protected removePipe(row: number, menu: MatMenuTrigger): void {
    menu.restoreFocus = false; // The menu's trigger is gone or not wanted: the focus goes to the row now at this position.
    this.draft.update((draft) => removePipe(draft, row));
    const remaining = this.draft().pipes.length;
    const focus = () => {
      if (remaining === 0) this.host.nativeElement.querySelector<HTMLElement>('[data-testid="add-pipe"]')?.focus();
      else this.noteInputs()[Math.min(row, remaining - 1)]?.nativeElement.focus();
    };
    afterNextRender(focus, {injector: this.injector});
  }

  /** A drop in the column starting at `columnStart`; the indices are within the column, and a drop from another column shifts the rows after the removed Pipe. */
  protected dropPipe(event: CdkDragDrop<number>, columnStart: number): void {
    const sameColumn = event.previousContainer === event.container;
    const fromStart = sameColumn ? columnStart : event.previousContainer.data;
    const shift = fromStart < columnStart ? 1 : 0;
    this.movePipe(fromStart + event.previousIndex, columnStart + event.currentIndex - shift);
  }

  protected async deleteOrgan(): Promise<void> {
    const {id, name} = this.draft();
    if (!id || !(await this.deletion.confirmAndDelete({id, name}))) return;
    this.deleted = true;
    await this.router.navigate(['/organs']);
  }
}

function toProblem({path, message}: FieldProblem): LeaveProblem {
  const pipeRow = /^pipes\.(\d+)\./.exec(path);
  const field: TranslatableText = pipeRow
    ? {key: 'ORGAN.LEAVE.PIPE_FIELD', params: {row: Number(pipeRow[1]) + 1}}
    : {key: FIELD_LABEL_KEYS[path] ?? path, params: {}};
  return {field, message};
}
