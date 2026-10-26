import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {MatButton} from '@angular/material/button';
import {MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle} from '@angular/material/dialog';
import {MatFormField, MatLabel} from '@angular/material/form-field';
import {MatInput} from '@angular/material/input';
import {MatOption, MatSelect, MatSelectChange} from '@angular/material/select';
import {MatRadioButton, MatRadioGroup} from '@angular/material/radio';
import {TranslatePipe} from '@ngx-translate/core';
import {
  closeGaps,
  midiNoteNumber,
  minimumGapColumns,
  noteName,
  prefilledScoresChoices,
  SCORES_BEAT_TYPES,
  scoresChoicesOf,
  scoresStaves,
  songMetre,
  staffRange,
  type Clef,
  type MidiNoteNumber,
  type Organ,
  type ScoresBeatType,
  type ScoresChoices,
  type Song,
  type Tape,
} from '@api/index';

export interface ScoresExportDialogData {
  readonly tape: Tape;
  readonly organ: Organ;
  readonly song: Song | undefined;
  readonly rememberedSplitNotes: readonly MidiNoteNumber[] | undefined;
}

/** Middle C, the split note that Add gives when there is none yet (FR-005). */
const MIDDLE_C = 60;
/** MIDI notes in an octave: Add gives a split note one octave below the lowest one. */
const OCTAVE = 12;
/** The lowest MIDI note that Add gives a split note. */
const LOWEST_ADDED_NOTE = 1;

/** The translation key of each clef. */
const CLEF_KEYS: Readonly<Record<Clef, string>> = {
  treble: 'TAPE.SCORES.CLEF.TREBLE',
  'treble-8va': 'TAPE.SCORES.CLEF.TREBLE_8VA',
  bass: 'TAPE.SCORES.CLEF.BASS',
  'bass-8vb': 'TAPE.SCORES.CLEF.BASS_8VB',
};

/** A MIDI note with its name, as the split note selects offer it. */
interface PitchOption {
  readonly pitch: MidiNoteNumber;
  readonly name: string;
}

/** Every MIDI note from 0 to 127, by name. */
const PITCH_OPTIONS: readonly PitchOption[] = Array.from({length: 128}, (_, value) => value).flatMap((value) => {
  const pitch = midiNoteNumber(value);
  return pitch === undefined ? [] : [{pitch, name: noteName(pitch)}];
});

/** The first Time signature of the Song as "3/4"; undefined without a Song or without a Time signature. */
function metreTextOf(song: Song | undefined): string | undefined {
  const timeSignature = song === undefined ? undefined : songMetre(song).timeSignature;
  return timeSignature === undefined ? undefined : `${timeSignature.beats}/${timeSignature.beatType}`;
}

/** The beat type of a value the dialog holds, or null when the Scores do not offer it. */
function beatTypeOf(value: unknown): ScoresBeatType | null {
  return SCORES_BEAT_TYPES.find((beatType) => beatType === value) ?? null;
}

/** The split notes in the order the dialog lists them: the highest on top. */
function highestFirst(values: readonly number[]): readonly number[] {
  return [...values].sort((a, b) => b - a);
}

/** The split notes that are MIDI notes, sorted ascending; the others are shown as a violation and left out. */
function pitchesOf(values: readonly number[]): readonly MidiNoteNumber[] {
  return values
    .flatMap((value) => {
      const pitch = midiNoteNumber(value);
      return pitch === undefined ? [] : [pitch];
    })
    .sort((a, b) => a - b);
}

/**
 * The split note that Add gives: one octave below the lowest split note, or C4 when there is none. Undefined when
 * that would be below MIDI 1, which disables Add.
 */
function nextSplitNoteOf(splitNotes: readonly number[]): MidiNoteNumber | undefined {
  if (splitNotes.length === 0) return midiNoteNumber(MIDDLE_C);
  const candidate = Math.min(...splitNotes) - OCTAVE;
  return candidate >= LOWEST_ADDED_NOTE ? midiNoteNumber(candidate) : undefined;
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
      @for (value of splitNotes(); track $index; let index = $index) {
        <div class="split-note">
          <mat-form-field>
            <mat-label>{{ 'TAPE.SCORES.SPLIT_NOTE' | translate }}</mat-label>
            <mat-select data-testid="scores-split-note" [value]="value" (selectionChange)="splitChosen(index, $event)">
              @for (option of pitchOptions; track option.pitch) {
                <mat-option [value]="option.pitch">{{ option.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <button mat-button type="button" data-testid="scores-split-remove" (click)="removeSplitNote(index)">
            {{ 'TAPE.SCORES.SPLIT_REMOVE' | translate }}
          </button>
        </div>
      }
      <button
        mat-button
        type="button"
        data-testid="scores-split-add"
        [disabled]="nextSplitNote() === undefined"
        (click)="addSplitNote()"
      >
        {{ 'TAPE.SCORES.SPLIT_ADD' | translate }}
      </button>
      <ul>
        @for (line of staffLines(); track line.number) {
          <li data-testid="scores-staff">
            {{
              'TAPE.SCORES.STAFF'
                | translate: {
                    number: line.number,
                    range: ('TAPE.SCORES.RANGE' | translate: {from: line.from, to: line.to}),
                    clef: (line.clef | translate),
                  }
            }}
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
    .split-note {
      display: flex;
      align-items: center;
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
  protected readonly noteValues = SCORES_BEAT_TYPES;
  protected readonly pitchOptions = PITCH_OPTIONS;

  private readonly prefilled = prefilledScoresChoices(this.data.organ, this.data.song, this.data.rememberedSplitNotes);
  private readonly notes = closeGaps(this.data.tape.holes, minimumGapColumns(this.data.organ, this.data.tape.columnLength));

  /** The metre of the "As in the Song" choice; undefined when the dialog does not offer that choice. */
  protected readonly songMetreText = this.prefilled.timeSignature === 'song' ? metreTextOf(this.data.song) : undefined;

  protected readonly upbeatCount = signal<number | null>(this.prefilled.upbeat.count);
  protected readonly upbeatValue = signal<ScoresBeatType | null>(beatTypeOf(this.prefilled.upbeat.noteValue));

  /** The split notes as the dialog holds them, the highest on top; they may not be distinct while being edited. */
  protected readonly splitNotes = signal<readonly number[]>(highestFirst(this.prefilled.splitNotes));

  /** The split note that Add gives next; undefined when Add is disabled. */
  protected readonly nextSplitNote = computed(() => nextSplitNoteOf(this.splitNotes()));

  /** The choices as the dialog holds them; undefined while a value is not yet a choice, which keeps Export disabled. */
  protected readonly choices = computed(() =>
    scoresChoicesOf({
      timeSignature: this.prefilled.timeSignature,
      upbeat: {count: this.upbeatCount(), noteValue: this.upbeatValue()},
      splitNotes: this.splitNotes(),
    }),
  );

  /** One line per staff from the top: its number, the notes it holds (from, to) and its clef. */
  protected readonly staffLines = computed(() =>
    scoresStaves(pitchesOf(this.splitNotes()), this.data.organ, this.notes).map((staff) => {
      const range = staffRange(staff);
      return {
        number: staff.number,
        from: noteName(range.lowest),
        to: noteName(range.highest),
        clef: CLEF_KEYS[staff.clef],
      };
    }),
  );

  protected countTyped(event: Event): void {
    const value = event.target instanceof HTMLInputElement ? event.target.valueAsNumber : Number.NaN;
    this.upbeatCount.set(Number.isInteger(value) ? value : null);
  }

  protected valueChosen(change: MatSelectChange): void {
    this.upbeatValue.set(beatTypeOf(change.value));
  }

  /** Changes the split note of a row; the rows stay highest first. */
  protected splitChosen(index: number, change: MatSelectChange): void {
    const value: unknown = change.value;
    if (typeof value !== 'number') return;
    this.splitNotes.update((values) => highestFirst(values.map((current, position) => (position === index ? value : current))));
  }

  protected removeSplitNote(index: number): void {
    this.splitNotes.update((values) => values.filter((_, position) => position !== index));
  }

  protected addSplitNote(): void {
    const next = this.nextSplitNote();
    if (next !== undefined) this.splitNotes.update((values) => [...values, next]);
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
