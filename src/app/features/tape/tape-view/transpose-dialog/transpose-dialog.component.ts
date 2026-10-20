import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {MatButton} from '@angular/material/button';
import {MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle} from '@angular/material/dialog';
import {MatFormField, MatLabel} from '@angular/material/form-field';
import {MatInput} from '@angular/material/input';
import {MatRadioButton, MatRadioChange, MatRadioGroup} from '@angular/material/radio';
import {TranslatePipe} from '@ngx-translate/core';
import {
  noteName,
  transposeHoles,
  transposeRange,
  transposition,
  type HoleRef,
  type Organ,
  type Tape,
  type Transposed,
} from '@api/index';

export interface TransposeDialogData {
  readonly tape: Tape;
  readonly organ: Organ;
  readonly selected: readonly HoleRef[];
}

type Scope = 'selected' | 'all';

/** Asks which Holes to move by how many semitones and shows what would become of them. */
@Component({
  selector: 'cranc-transpose-dialog',
  imports: [MatButton, MatDialogActions, MatDialogContent, MatDialogTitle, MatFormField, MatInput, MatLabel, MatRadioButton, MatRadioGroup, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ 'TAPE.TRANSPOSE.TITLE' | translate }}</h2>
    <mat-dialog-content data-testid="transpose-dialog">
      <mat-radio-group [value]="scope()" (change)="chooseScope($event)" [attr.aria-label]="'TAPE.TRANSPOSE.TITLE' | translate">
        <mat-radio-button value="selected" data-testid="transpose-scope-selected" [disabled]="data.selected.length === 0">
          {{ 'TAPE.TRANSPOSE.SCOPE_SELECTED' | translate: {count: data.selected.length} }}
        </mat-radio-button>
        <mat-radio-button value="all" data-testid="transpose-scope-all">
          {{ 'TAPE.TRANSPOSE.SCOPE_ALL' | translate }}
        </mat-radio-button>
      </mat-radio-group>

      <mat-form-field>
        <mat-label>{{ 'TAPE.TRANSPOSE.SEMITONES' | translate }}</mat-label>
        <input
          matInput
          type="number"
          step="1"
          data-testid="transpose-semitones"
          [min]="range.lowest"
          [max]="range.highest"
          [value]="semitones() ?? ''"
          (input)="typed($event)"
          (blur)="clamp()"
          (keydown.enter)="apply()"
        />
      </mat-form-field>

      @if (transposed(); as result) {
        <div data-testid="transpose-outcome" aria-live="polite">
          <p data-testid="outcome-moved">{{ 'TAPE.TRANSPOSE.MOVED' | translate }}: {{ moved() }}</p>
          <p data-testid="outcome-moved-by-octaves">{{ 'TAPE.TRANSPOSE.MOVED_BY_OCTAVES' | translate }}: {{ movedByOctaves() }}</p>
          <p data-testid="outcome-merged">{{ 'TAPE.TRANSPOSE.MERGED' | translate }}: {{ result.outcome.merges.length }}</p>
          <p data-testid="outcome-removed">{{ 'TAPE.TRANSPOSE.REMOVED' | translate }}: {{ removed().length }}</p>
          @if (removed().length > 0) {
            <ul data-testid="outcome-removed-holes">
              @for (hole of removed(); track $index) {
                <li>{{ 'TAPE.TRANSPOSE.REMOVED_HOLE' | translate: {note: hole.note, column: hole.column} }}</li>
              }
            </ul>
          }
          @if (result.outcome.leftOut > 0) {
            <p data-testid="outcome-left-out">{{ 'TAPE.TRANSPOSE.LEFT_OUT' | translate }}: {{ result.outcome.leftOut }}</p>
          }
          @if (nothingLeft()) {
            <p data-testid="outcome-nothing-left">{{ 'TAPE.TRANSPOSE.NOTHING_LEFT' | translate }}</p>
          }
        </div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" data-testid="transpose-cancel" (click)="dialogRef.close()">{{ 'TAPE.TRANSPOSE.CANCEL' | translate }}</button>
      <button mat-flat-button type="button" data-testid="transpose-apply" [disabled]="!transposed()" (click)="apply()">{{ 'TAPE.TRANSPOSE.APPLY' | translate }}</button>
    </mat-dialog-actions>
  `,
  styles: `
    mat-radio-group {
      display: flex;
      flex-direction: column;
    }
    mat-form-field {
      margin-top: 0.5rem;
    }
    p {
      margin: 0.25rem 0;
    }
  `,
})
export class TransposeDialogComponent {
  protected readonly dialogRef = inject<MatDialogRef<TransposeDialogComponent, Transposed>>(MatDialogRef);
  protected readonly data = inject<TransposeDialogData>(MAT_DIALOG_DATA);
  protected readonly range = transposeRange(this.data.organ);

  protected readonly scope = signal<Scope>(this.data.selected.length > 0 ? 'selected' : 'all');
  /** The number in the field; undefined while it holds no whole number. */
  protected readonly semitones = signal<number | undefined>(0);

  /** What transposing would do; undefined when the field holds no usable, non-zero amount. */
  protected readonly transposed = computed<Transposed | undefined>(() => {
    const amount = this.semitones();
    if (amount === undefined || amount === 0 || amount < this.range.lowest || amount > this.range.highest) return undefined;
    const semitones = transposition(amount);
    if (semitones === undefined) return undefined;
    const which = this.scope() === 'selected' ? ({kind: 'these', holes: this.data.selected} as const) : ({kind: 'all'} as const);
    return transposeHoles(this.data.tape, this.data.organ, which, semitones);
  });

  private readonly fates = computed(() => this.transposed()?.outcome.fates ?? []);
  protected readonly moved = computed(() => this.fates().filter((fate) => fate.kind === 'moved').length);
  protected readonly movedByOctaves = computed(() => this.fates().filter((fate) => fate.kind === 'moved-by-octaves').length);
  protected readonly removed = computed(() =>
    this.fates().flatMap((fate) => (fate.kind === 'removed' ? [{note: noteName(fate.from.pipe), column: fate.from.start + 1}] : [])),
  );
  protected readonly nothingLeft = computed(() => this.fates().length > 0 && this.removed().length === this.fates().length);

  protected chooseScope(change: MatRadioChange): void {
    this.scope.set(change.value === 'selected' ? 'selected' : 'all');
  }

  protected typed(event: Event): void {
    const value = event.target instanceof HTMLInputElement ? event.target.valueAsNumber : Number.NaN;
    this.semitones.set(Number.isInteger(value) ? value : undefined);
  }

  /** Pulls the amount into the range of the Organ; an empty field becomes 0. */
  protected clamp(): void {
    const amount = this.semitones() ?? 0;
    this.semitones.set(Math.min(this.range.highest, Math.max(this.range.lowest, amount)));
  }

  protected apply(): void {
    const result = this.transposed();
    if (result) this.dialogRef.close(result);
  }
}
