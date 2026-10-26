import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {MatButton} from '@angular/material/button';
import {MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle} from '@angular/material/dialog';
import {MatFormField, MatLabel} from '@angular/material/form-field';
import {MatInput} from '@angular/material/input';
import {MatOption, MatSelect, MatSelectChange} from '@angular/material/select';
import {MatRadioButton, MatRadioGroup} from '@angular/material/radio';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import {
  closeGaps,
  midiNoteNumber,
  minimumGapColumns,
  noteName,
  prefilledScoresChoices,
  scoresChoicesOf,
  scoresStaves,
  songMetre,
  type Clef,
  type MidiNoteNumber,
  type Organ,
  type ScoresChoices,
  type Song,
  type Staff,
  type Tape,
} from '@api/index';

export interface ScoresExportDialogData {
  readonly tape: Tape;
  readonly organ: Organ;
  readonly song: Song | undefined;
  readonly rememberedSplitNotes: readonly MidiNoteNumber[] | undefined;
}

/** The lowest and highest notes of the keyboard, the open ends of the top and bottom staff. */
const LOWEST_NOTE = 0 as MidiNoteNumber;
const HIGHEST_NOTE = 127 as MidiNoteNumber;

/** The translation key of each clef. */
const CLEF_KEYS: Readonly<Record<Clef, string>> = {
  treble: 'TAPE.SCORES.CLEF.TREBLE',
  'treble-8va': 'TAPE.SCORES.CLEF.TREBLE_8VA',
  bass: 'TAPE.SCORES.CLEF.BASS',
  'bass-8vb': 'TAPE.SCORES.CLEF.BASS_8VB',
};

/** The first Time signature of the Song as "3/4"; undefined without a Song or without a Time signature. */
function metreTextOf(song: Song | undefined): string | undefined {
  const timeSignature = song === undefined ? undefined : songMetre(song).timeSignature;
  return timeSignature === undefined ? undefined : `${timeSignature.beats}/${timeSignature.beatType}`;
}

/** Asks how the Scores are written; the choices start from the Song and the Organ (FR-004, FR-005). */
@Component({
  selector: 'cranc-scores-export-dialog',
  imports: [
    MatButton,
    MatDialogActions,
    MatDialogContent,
    MatDialogTitle,
    MatFormField,
    MatInput,
    MatLabel,
    MatOption,
    MatRadioButton,
    MatRadioGroup,
    MatSelect,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ 'TAPE.SCORES.TITLE' | translate }}</h2>
    <mat-dialog-content data-testid="scores-export-dialog">
      @if (songMetreText; as metre) {
        <h3>{{ 'TAPE.SCORES.TIME_SIGNATURE' | translate }}</h3>
        <mat-radio-group [attr.aria-label]="'TAPE.SCORES.TIME_SIGNATURE' | translate">
          <mat-radio-button value="song" data-testid="scores-time-song" [checked]="true">
            {{ 'TAPE.SCORES.TIME_SONG' | translate: {metre} }}
          </mat-radio-button>
        </mat-radio-group>
      }

      <h3>{{ 'TAPE.SCORES.UPBEAT' | translate }}</h3>
      <mat-form-field>
        <mat-label>{{ 'TAPE.SCORES.UPBEAT_COUNT' | translate }}</mat-label>
        <input
          matInput
          type="number"
          min="0"
          step="1"
          data-testid="scores-upbeat-count"
          [value]="upbeatCount() ?? ''"
          (input)="countTyped($event)"
        />
      </mat-form-field>
      <mat-form-field>
        <mat-label>{{ 'TAPE.SCORES.UPBEAT_VALUE' | translate }}</mat-label>
        <mat-select data-testid="scores-upbeat-value" [value]="upbeatValue()" (selectionChange)="valueChosen($event)">
          @for (value of noteValues; track value) {
            <mat-option [value]="value">{{ ('TAPE.SCORES.NOTE_VALUE.' + value) | translate }}</mat-option>
          }
        </mat-select>
      </mat-form-field>

      <h3>{{ 'TAPE.SCORES.STAVES' | translate }}</h3>
      <ul>
        @for (staff of staves; track staff.number) {
          <li data-testid="scores-staff">
            {{ 'TAPE.SCORES.STAFF' | translate: {number: staff.number, range: rangeOf(staff), clef: (clefKey(staff.clef) | translate)} }}
          </li>
        }
      </ul>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" data-testid="scores-cancel" (click)="cancel()">{{ 'TAPE.SCORES.CANCEL' | translate }}</button>
      <button mat-flat-button type="button" data-testid="scores-confirm" [disabled]="choices() === undefined" (click)="confirm()">{{ 'TAPE.SCORES.CONFIRM' | translate }}</button>
    </mat-dialog-actions>
  `,
  styles: `
    h3 {
      margin: 0.75rem 0 0.25rem;
    }
    mat-form-field {
      margin-right: 0.5rem;
    }
    ul {
      margin: 0;
      padding-left: 1.25rem;
    }
  `,
})
export class ScoresExportDialogComponent {
  protected readonly dialogRef = inject<MatDialogRef<ScoresExportDialogComponent, ScoresChoices | undefined>>(MatDialogRef);
  protected readonly data = inject<ScoresExportDialogData>(MAT_DIALOG_DATA);
  private readonly translate = inject(TranslateService);
  protected readonly noteValues = [1, 2, 4, 8, 16, 32] as const;

  private readonly prefilled = prefilledScoresChoices(this.data.organ, this.data.song, this.data.rememberedSplitNotes);

  /** The metre of the "As in the Song" choice; undefined when the dialog does not offer that choice. */
  protected readonly songMetreText = this.prefilled.timeSignature === 'song' ? metreTextOf(this.data.song) : undefined;

  protected readonly upbeatCount = signal<number | null>(this.prefilled.upbeat.count);
  protected readonly upbeatValue = signal<number | null>(this.prefilled.upbeat.noteValue);

  /** The choices as the dialog holds them; undefined while a value is not yet a choice, which keeps Export disabled. */
  protected readonly choices = computed(() =>
    scoresChoicesOf({
      timeSignature: this.prefilled.timeSignature,
      upbeat: {count: this.upbeatCount(), noteValue: this.upbeatValue()},
      splitNotes: this.prefilled.splitNotes,
    }),
  );

  protected readonly staves: readonly Staff[] = scoresStaves(
    this.prefilled.splitNotes,
    this.data.organ,
    closeGaps(this.data.tape.holes, minimumGapColumns(this.data.organ, this.data.tape.columnLength)),
  );

  protected countTyped(event: Event): void {
    const value = event.target instanceof HTMLInputElement ? event.target.valueAsNumber : Number.NaN;
    this.upbeatCount.set(Number.isInteger(value) ? value : null);
  }

  protected valueChosen(change: MatSelectChange): void {
    const value: unknown = change.value;
    this.upbeatValue.set(typeof value === 'number' ? value : null);
  }

  protected clefKey(clef: Clef): string {
    return CLEF_KEYS[clef];
  }

  /** The notes a staff holds, from its lowest to its highest; the keyboard's ends where the staff is open. */
  protected rangeOf(staff: Staff): string {
    const lowest = staff.from ?? LOWEST_NOTE;
    const highest = staff.below === undefined ? HIGHEST_NOTE : (midiNoteNumber(staff.below - 1) ?? LOWEST_NOTE);
    return String(this.translate.instant('TAPE.SCORES.RANGE', {from: noteName(lowest), to: noteName(highest)}));
  }

  /** Closes with no choices, which tells the export that nothing is to be written. */
  protected cancel(): void {
    this.dialogRef.close(undefined);
  }

  protected confirm(): void {
    const choices = this.choices();
    if (choices !== undefined) this.dialogRef.close(choices);
  }
}
