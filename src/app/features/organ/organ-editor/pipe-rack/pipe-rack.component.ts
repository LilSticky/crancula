import {afterNextRender, ChangeDetectionStrategy, Component, computed, ElementRef, inject, Injector, input, output, viewChildren} from '@angular/core';
import {CdkDrag, type CdkDragDrop, CdkDragHandle, CdkDropList, CdkDropListGroup} from '@angular/cdk/drag-drop';
import {type FieldTree, FormField} from '@angular/forms/signals';
import {MatButton, MatIconButton} from '@angular/material/button';
import {MatCard} from '@angular/material/card';
import {MatError, MatFormField, MatInput} from '@angular/material/input';
import {MatIcon} from '@angular/material/icon';
import {MatMenu, MatMenuItem, MatMenuTrigger} from '@angular/material/menu';
import {MatTooltip} from '@angular/material/tooltip';
import {TranslatePipe} from '@ngx-translate/core';
import {midiNoteNumber, noteName, type OrganDraft} from '@api/index';
import type {TranslatableText} from '../../leave-unsaved.guard';
import {SaveAttempt, shownMessages} from '../organ-form';
import {rackColumns} from '../pipe-rack';

/** The Pipes sheet of the Organ editor: the Pipe rack with its columns, drag and drop, menu and keyboard moves. */
@Component({
  selector: 'cranc-pipe-rack',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, MatFormField, MatInput, MatError, MatButton, MatIconButton, MatIcon, MatMenu, MatMenuItem, MatMenuTrigger, MatTooltip, MatCard, FormField, CdkDropList, CdkDropListGroup, CdkDrag, CdkDragHandle],
  templateUrl: './pipe-rack.component.html',
  styleUrl: './pipe-rack.component.scss',
})
export class PipeRackComponent {
  readonly organ = input.required<FieldTree<OrganDraft>>();
  /** Whether the window is narrow: the rack then has 2 compact columns instead of 3. */
  readonly compact = input<boolean>(false);

  readonly pipeAdded = output<void>();
  readonly pipeMoved = output<{readonly from: number; readonly to: number}>();
  /** The row of the removed Pipe. */
  readonly pipeRemoved = output<number>();

  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly saveAttempt = inject(SaveAttempt).attempted;
  private readonly noteInputs = viewChildren<ElementRef<HTMLInputElement>>('noteInput');

  /** The sheet head's count text key: separate texts for one and many. */
  protected readonly pipeCountKey = computed(() => (this.organ().pipes.length === 1 ? 'ORGAN.EDITOR.PIPE_COUNT_ONE' : 'ORGAN.EDITOR.PIPE_COUNT'));

  /** The columns (2 when compact, else 3): where each starts in the Pipe order and its Pipe fields. */
  protected readonly rack = computed(() => {
    const pipes = [...this.organ().pipes];
    let start = 0;
    return rackColumns(pipes.length, this.compact() ? 2 : 3).map((rows) => {
      const column = {start, pipes: pipes.slice(start, start + rows)};
      start += rows;
      return column;
    });
  });

  /** Moves the focus to the note input of a row. */
  focusNote(row: number): void {
    this.noteInputs()[row]?.nativeElement.focus();
  }

  /** Moves the focus to the Add Pipe button. */
  focusAddPipe(): void {
    this.host.nativeElement.querySelector<HTMLElement>('[data-testid="add-pipe"]')?.focus();
  }

  /** The messages to show at a field now. */
  protected messagesAt(field: FieldTree<unknown>): readonly TranslatableText[] {
    return shownMessages(field, this.organ(), this.saveAttempt());
  }

  /** The name of the note a Pipe plays, or nothing while its note is missing or out of range. */
  protected noteNameOf(note: number | null): string {
    const valid = note === null ? undefined : midiNoteNumber(note);
    return valid === undefined ? '' : noteName(valid);
  }

  /** Whether a Pipe's note is a sharp, for the regular weight of its name. */
  protected isSharp(note: number | null): boolean {
    return this.noteNameOf(note).includes('#');
  }

  protected movePipe(from: number, to: number): void {
    this.pipeMoved.emit({from, to});
  }

  /** Alt+ArrowUp/Down: moves the Pipe one row and keeps the focus on its note input. */
  protected moveByKeyboard(event: Event, row: number, step: -1 | 1): void {
    event.preventDefault();
    const target = row + step;
    if (target < 0 || target >= this.organ().pipes.length) return;
    this.movePipe(row, target);
    afterNextRender(() => this.focusNote(target), {injector: this.injector});
  }

  /** Removes a Pipe; the focus moves to the note input now at its row (the last row if it was last), else to Add Pipe. */
  protected removePipe(row: number, menu: MatMenuTrigger): void {
    menu.restoreFocus = false; // The menu's trigger is gone or not wanted: the focus goes to the row now at this position.
    this.pipeRemoved.emit(row);
    const remaining = this.organ().pipes.length;
    afterNextRender(() => (remaining === 0 ? this.focusAddPipe() : this.focusNote(Math.min(row, remaining - 1))), {injector: this.injector});
  }

  /** A drop in the column starting at `columnStart`; the indices are within the column, and a drop from another column shifts the rows after the removed Pipe. */
  protected dropPipe(event: CdkDragDrop<number>, columnStart: number): void {
    const sameColumn = event.previousContainer === event.container;
    const fromStart = sameColumn ? columnStart : event.previousContainer.data;
    const shift = fromStart < columnStart ? 1 : 0;
    this.movePipe(fromStart + event.previousIndex, columnStart + event.currentIndex - shift);
  }
}
