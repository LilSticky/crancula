import {ChangeDetectionStrategy, Component, computed, effect, inject, input, linkedSignal, signal, untracked} from '@angular/core';
import {CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList} from '@angular/cdk/drag-drop';
import {type FieldTree, form, FormField} from '@angular/forms/signals';
import {ErrorStateMatcher} from '@angular/material/core';
import {MatButton, MatIconButton} from '@angular/material/button';
import {MatError, MatFormField, MatHint, MatInput, MatLabel} from '@angular/material/input';
import {MatDialog} from '@angular/material/dialog';
import {MatIcon} from '@angular/material/icon';
import {MatSnackBar} from '@angular/material/snack-bar';
import {Router} from '@angular/router';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import {firstValueFrom} from 'rxjs';
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
  toDraft,
  validateOrgan,
} from '@api/index';
import {ConfirmableAction, ConfirmDialogComponent} from '../../shared/components/confirm-dialog/confirm-dialog.component';
import type {LeaveProblem, TranslatableText, UnsavedChanges, UnsavedChangesCheck} from '../leave-unsaved.guard';
import {PageHeadComponent} from '../../shared/components/page-head/page-head.component';
import {TapeLibrary} from '../../tape/tape-library.store';
import {OrganDeletion} from '../organ-deletion';
import {OrganLibrary} from '../organ-library.store';
import {type FieldProblem, organFormSchema, organProblems, shownMessages, ShownViolationMatcher} from './organ-form';

/** The label key of each field that has one fixed label; Pipe notes are labelled by their row. */
const FIELD_LABEL_KEYS: Readonly<Record<string, string>> = {
  name: 'ORGAN.EDITOR.NAME',
  'tapeBed.tapeWidth': 'ORGAN.EDITOR.TAPE_WIDTH',
  'tapeBed.border': 'ORGAN.EDITOR.BORDER',
  'tapeBed.holeDiameter': 'ORGAN.EDITOR.HOLE_DIAMETER',
  'tapeBed.rowSpacing': 'ORGAN.EDITOR.ROW_SPACING',
  minimumGap: 'ORGAN.EDITOR.MINIMUM_GAP',
  pipes: 'ORGAN.EDITOR.PIPES',
};

@Component({
  selector: 'cranc-organ-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, MatFormField, MatLabel, MatInput, MatHint, MatError, MatButton, MatIconButton, MatIcon, FormField, CdkDropList, CdkDrag, CdkDragHandle, PageHeadComponent],
  templateUrl: './organ-editor.component.html',
  providers: [{provide: ErrorStateMatcher, useClass: ShownViolationMatcher}],
  styles: `
    .organ-editor {
      display: flex;
      flex-direction: column;
      max-width: 40rem;
    }

    .violation {
      color: var(--mat-sys-error);
    }

    .pipe {
      display: flex;
      align-items: baseline;
      gap: 1rem;
    }

    .drag-handle {
      cursor: grab;
    }
  `,
})
export class OrganEditorComponent implements UnsavedChangesCheck {
  /** Route parameter; absent for a new Organ. */
  readonly id = input<string>();

  private readonly library = inject(OrganLibrary);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly tapes = inject(TapeLibrary);
  private readonly deletion = inject(OrganDeletion);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);
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
  protected readonly canSave = computed(() => this.changed() && this.organ().valid() && !this.saving());

  protected readonly minimumHoleLength = computed(() => this.organ.tapeBed.holeDiameter().value() ?? '');

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

  /** Stores the valid, changed Organ (spec FR-012). */
  protected async save(): Promise<void> {
    const result = validateOrgan(this.draft());
    if (!result.ok || !this.canSave()) return;
    const sent = this.draft();
    this.saving.set(true);
    try {
      if (!(await this.removeHolesOfRemovedPipes(result.value))) return;
      if (!(await this.library.put(result.value))) return; // Still unsaved: the library reports the storage problem.
      this.saved.set(sent);
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
    return shownMessages(field, this.organ);
  }

  /** The name of the note a Pipe plays, or nothing while its note is missing or out of range. */
  protected noteNameOf(note: number | null): string {
    const valid = note === null ? undefined : midiNoteNumber(note);
    return valid === undefined ? '' : noteName(valid);
  }

  protected addPipe(): void {
    this.draft.update(addPipe);
  }

  protected movePipe(fromRow: number, toRow: number): void {
    this.draft.update((draft) => movePipe(draft, fromRow, toRow));
  }

  protected removePipe(row: number): void {
    this.draft.update((draft) => removePipe(draft, row));
  }

  protected dropPipe(event: CdkDragDrop<unknown>): void {
    this.movePipe(event.previousIndex, event.currentIndex);
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
