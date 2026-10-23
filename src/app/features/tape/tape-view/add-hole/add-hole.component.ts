import {ChangeDetectionStrategy, Component, computed, effect, input, output, signal, untracked} from '@angular/core';
import {disabled, form, FormField} from '@angular/forms/signals';
import {MatButton} from '@angular/material/button';
import {MatFormField, MatHint, MatLabel} from '@angular/material/form-field';
import {MatInput} from '@angular/material/input';
import {MatOption, MatSelect} from '@angular/material/select';
import {TranslatePipe} from '@ngx-translate/core';
import {
  addHole,
  column,
  firstFreeColumnAfter,
  noteName,
  type HoleRef,
  type MidiNoteNumber,
  type Organ,
  type Tape,
} from '@api/index';

/** The Column as typed, counted from 1. */
interface AddHoleDraft {
  column: string;
}

/** The "Add a Hole" section of the side panel: a Pipe and a Column (counted from 1). */
@Component({
  selector: 'cranc-add-hole',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormField, MatButton, MatFormField, MatHint, MatInput, MatLabel, MatOption, MatSelect, TranslatePipe],
  templateUrl: './add-hole.component.html',
  styleUrl: './add-hole.component.scss',
})
export class AddHoleComponent {
  readonly organ = input.required<Organ>();
  readonly tape = input.required<Tape>();
  readonly selected = input.required<HoleRef | undefined>();
  /** Whether editing is paused (the Preview plays): the Hole can't be added meanwhile. */
  readonly editingPaused = input(false);
  /** The Pipe and the 0-based Column of the Hole to add. */
  readonly added = output<HoleRef>();

  private readonly draft = signal<AddHoleDraft>({column: ''});
  protected readonly pipe = signal<MidiNoteNumber | undefined>(undefined);
  protected readonly fields = form(this.draft, (path) => {
    disabled(path.column, {when: () => this.editingPaused()});
  });
  protected readonly pipes = computed(() =>
    this.organ().pipes.map((pipe) => ({note: pipe.note, name: noteName(pipe.note)})),
  );
  protected readonly problem = signal<
    {readonly kind: 'invalid'} | {readonly kind: 'covered'; readonly note: string; readonly column: number} | undefined
  >(undefined);

  constructor() {
    effect(() => {
      const selected = this.selected();
      if (selected === undefined) return;
      untracked(() => {
        const tape = this.tape();
        if (!tape.holes.some((hole) => hole.pipe === selected.pipe && hole.start === selected.start)) return;
        this.pipe.set(selected.pipe);
        this.draft.set({column: String(firstFreeColumnAfter(tape, selected) + 1)});
      });
    });
    effect(() => {
      void this.fields.column().value();
      untracked(() => this.problem.set(undefined));
    });
  }

  /** Takes the Pipe picked in the select, if it is one of the Organ. */
  protected pickPipe(note: unknown): void {
    const pipe = this.organ().pipes.find((candidate) => candidate.note === note);
    if (pipe === undefined) return;
    this.pipe.set(pipe.note);
    this.problem.set(undefined);
  }

  protected submit(): void {
    const pipe = this.pipe();
    const typed = this.draft().column;
    const number = Number(typed);
    const start = typed.trim() === '' || !Number.isInteger(number) ? undefined : column(number - 1);
    if (pipe === undefined || start === undefined) {
      this.problem.set({kind: 'invalid'});
      return;
    }
    const result = addHole(this.tape(), this.organ(), pipe, start);
    if (!result.ok) {
      this.problem.set(
        result.error.code === 'overlaps' ? {kind: 'covered', note: noteName(pipe), column: number} : {kind: 'invalid'},
      );
      return;
    }
    this.problem.set(undefined);
    this.added.emit({pipe, start});
  }
}
