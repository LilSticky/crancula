import {ChangeDetectionStrategy, Component, computed, inject, Injectable, signal} from '@angular/core';
import {type Field, type FieldTree, form, FormField, type ReadonlyFieldTree, type SchemaPath, validateTree, type ValidationError} from '@angular/forms/signals';
import {ErrorStateMatcher} from '@angular/material/core';
import {MatButton} from '@angular/material/button';
import {MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle} from '@angular/material/dialog';
import {MatError, MatFormField, MatLabel} from '@angular/material/form-field';
import {MatInput} from '@angular/material/input';
import {MatOption, MatSelect, MatSelectChange} from '@angular/material/select';
import {MatRadioButton, MatRadioChange, MatRadioGroup} from '@angular/material/radio';
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
  validateScoresChoices,
  type Clef,
  type MidiNoteNumber,
  type Organ,
  type ScoresBeatType,
  type ScoresChoices,
  type ScoresChoicesInput,
  type ScoresChoicesViolation,
  type Song,
  type Tape,
} from '@api/index';

export interface ScoresExportDialogData {
  readonly tape: Tape;
  readonly organ: Organ;
  readonly song: Song | undefined;
  readonly rememberedSplitNotes: readonly MidiNoteNumber[] | undefined;
}

/** What the dialog holds: numbers or null while a field holds none (FR-004), the split notes highest first. */
interface ScoresDialogModel {
  readonly timeChoice: 'song' | 'other';
  readonly beats: number | null;
  readonly beatType: number | null;
  readonly upbeatCount: number | null;
  readonly upbeatValue: number | null;
  readonly splitNotes: readonly number[];
}

/** A violation of the export choices, reported at the field of the dialog that it names. */
interface ScoresFieldError extends ValidationError.WithFieldTree {
  readonly kind: ScoresChoicesViolation['code'];
  readonly violation: ScoresChoicesViolation;
}

/** Middle C, the split note that Add gives when there is none yet (FR-005). */
const MIDDLE_C = 60;
/** MIDI notes in an octave: Add gives a split note one octave below the lowest one. */
const OCTAVE = 12;
/** The lowest MIDI note a split note is offered at: MIDI 0 would leave the staff below it empty (FR-005). */
const LOWEST_SPLIT_NOTE = 1;
/** The highest MIDI note a split note is offered at. */
const HIGHEST_SPLIT_NOTE = 127;
/** The Time signature the fields start with when the Tape does not take the Song's one: 4/4. */
const COMMON_BEATS = 4;
const COMMON_BEAT_TYPE: ScoresBeatType = 4;

/** The translation key of each clef. */
const CLEF_KEYS: Readonly<Record<Clef, string>> = {
  treble: 'TAPE.SCORES.CLEF.TREBLE',
  'treble-8va': 'TAPE.SCORES.CLEF.TREBLE_8VA',
  bass: 'TAPE.SCORES.CLEF.BASS',
  'bass-8vb': 'TAPE.SCORES.CLEF.BASS_8VB',
};

/** The translation key of each beat type's name, as the note value selects offer it. */
const NOTE_VALUE_KEYS: Readonly<Record<ScoresBeatType, string>> = {
  1: 'TAPE.SCORES.NOTE_VALUE.1',
  2: 'TAPE.SCORES.NOTE_VALUE.2',
  4: 'TAPE.SCORES.NOTE_VALUE.4',
  8: 'TAPE.SCORES.NOTE_VALUE.8',
  16: 'TAPE.SCORES.NOTE_VALUE.16',
  32: 'TAPE.SCORES.NOTE_VALUE.32',
};

/** A MIDI note with its name, as the split note selects offer it. */
interface PitchOption {
  readonly pitch: MidiNoteNumber;
  readonly name: string;
}

/** Every MIDI note a split note is offered at, from 1 to 127, by name. */
const PITCH_OPTIONS: readonly PitchOption[] = Array.from(
  {length: HIGHEST_SPLIT_NOTE - LOWEST_SPLIT_NOTE + 1},
  (_, index) => index + LOWEST_SPLIT_NOTE,
).flatMap((value) => {
  const pitch = midiNoteNumber(value);
  return pitch === undefined ? [] : [{pitch, name: noteName(pitch)}];
});

function isScoresFieldError(error: unknown): error is ScoresFieldError {
  return typeof error === 'object' && error !== null && 'violation' in error && 'fieldTree' in error;
}

/** Puts a Material field in its error state exactly while the dialog shows a message for it. */
@Injectable()
class ShownViolationMatcher extends ErrorStateMatcher {
  override isSignalErrorState(field: Field<unknown> | null): boolean {
    return field !== null && field().errors().some(isScoresFieldError);
  }
}

/** The first Time signature of the Song as "3/4"; undefined without a Song or without a Time signature. */
function metreTextOf(song: Song | undefined): string | undefined {
  const timeSignature = song === undefined ? undefined : songMetre(song).timeSignature;
  return timeSignature === undefined ? undefined : `${timeSignature.beats}/${timeSignature.beatType}`;
}

/**
 * The Time signature that "Another one" starts with: the Song's first one when the Tape keeps the Song's Time
 * signature, else 4/4.
 */
function otherTimeSignatureOf(song: Song | undefined, prefilled: ScoresChoicesInput): { beats: number; beatType: number } {
  const first = song !== undefined && prefilled.timeSignature === 'song' ? songMetre(song).timeSignature : undefined;
  return first === undefined ? { beats: COMMON_BEATS, beatType: COMMON_BEAT_TYPE } : { beats: first.beats, beatType: first.beatType };
}

/** The dialog's fields as the choices the domain validates. */
function inputOf(model: ScoresDialogModel): ScoresChoicesInput {
  return {
    timeSignature: model.timeChoice === 'song' ? 'song' : { beats: model.beats, beatType: model.beatType },
    upbeat: { count: model.upbeatCount, noteValue: model.upbeatValue },
    splitNotes: model.splitNotes,
  };
}

/** The field of the dialog that a violation of the choices is reported at. */
function fieldOf(violation: ScoresChoicesViolation, fields: ReadonlyFieldTree<ScoresDialogModel>): ReadonlyFieldTree<unknown> {
  switch (violation.field) {
    case 'beats':
      return fields.beats;
    case 'beatType':
      return fields.beatType;
    case 'timeSignature':
      return fields.timeChoice;
    case 'upbeat':
      return fields.upbeatCount;
    case 'splitNotes':
      return fields.splitNotes;
  }
}

/**
 * The schema of the dialog's form. It has one rule: `validateScoresChoices`, the only place where the rules of the
 * export choices live. Each violation becomes an error at the field it names.
 */
function scoresFormSchema(song: Song | undefined): (path: SchemaPath<ScoresDialogModel>) => void {
  return (path) => {
    validateTree(path, ({ value, fieldTree }) =>
      validateScoresChoices(inputOf(value()), song).map(
        (violation): ScoresFieldError => ({ kind: violation.code, violation, fieldTree: fieldOf(violation, fieldTree) }),
      ),
    );
  };
}

/** The translation key of the message that explains a violation. */
function violationMessageKey(violation: ScoresChoicesViolation): string {
  switch (violation.field) {
    case 'beats':
      return 'TAPE.SCORES.ERROR.BEATS';
    case 'beatType':
      return 'TAPE.SCORES.ERROR.BEAT_TYPE';
    case 'timeSignature':
      return 'TAPE.SCORES.SONG_METRE_NOT_ON_COLUMNS';
    case 'upbeat':
      return violation.code === 'not-shorter-than-bar' ? 'TAPE.SCORES.ERROR.UPBEAT_TOO_LONG' : 'TAPE.SCORES.ERROR.UPBEAT';
    case 'splitNotes':
      return 'TAPE.SCORES.ERROR.SPLIT_NOTES';
  }
}

/** The translation key of the first violation a field has, the one the dialog shows under it; undefined if none. */
function shownMessageKey(field: FieldTree<unknown>): string | undefined {
  const error = field().errors().find(isScoresFieldError);
  return error === undefined ? undefined : violationMessageKey(error.violation);
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
  return candidate >= LOWEST_SPLIT_NOTE ? midiNoteNumber(candidate) : undefined;
}

/** Asks how the Scores are written; the choices start from the Song and the Organ (FR-004, FR-005). */
@Component({
  selector: 'cranc-scores-export-dialog',
  imports: [
    FormField,
    MatButton,
    MatDialogActions,
    MatDialogContent,
    MatDialogTitle,
    MatError,
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
  providers: [{ provide: ErrorStateMatcher, useClass: ShownViolationMatcher }],
  template: `
    <h2 mat-dialog-title>{{ 'TAPE.SCORES.TITLE' | translate }}</h2>
    <mat-dialog-content data-testid="scores-export-dialog">
      <h3>{{ 'TAPE.SCORES.TIME_SIGNATURE' | translate }}</h3>
      @if (songMetreText; as metre) {
        <mat-radio-group
          [attr.aria-label]="'TAPE.SCORES.TIME_SIGNATURE' | translate"
          [value]="fields.timeChoice().value()"
          (change)="timeChoiceChosen($event)"
        >
          <mat-radio-button value="song" data-testid="scores-time-song">
            {{ 'TAPE.SCORES.TIME_SONG' | translate: {metre} }}
          </mat-radio-button>
          <mat-radio-button value="other" data-testid="scores-time-other">{{ 'TAPE.SCORES.TIME_OTHER' | translate }}</mat-radio-button>
        </mat-radio-group>
      }
      @if (songMetreNotOnColumns) {
        <p class="hint" data-testid="scores-song-metre-hint">{{ 'TAPE.SCORES.SONG_METRE_NOT_ON_COLUMNS' | translate }}</p>
      }
      @if (fields.timeChoice().value() === 'other') {
        <div class="time-fields">
          <mat-form-field>
            <mat-label>{{ 'TAPE.SCORES.BEATS' | translate }}</mat-label>
            <input matInput type="number" step="1" data-testid="scores-beats" [formField]="fields.beats" />
            <ng-container ngProjectAs="mat-error">
              @if (shownMessageKey(fields.beats); as key) {
                <mat-error>{{ key | translate }}</mat-error>
              }
            </ng-container>
          </mat-form-field>
          <mat-form-field>
            <mat-label>{{ 'TAPE.SCORES.BEAT_TYPE' | translate }}</mat-label>
            <mat-select data-testid="scores-beat-type" [value]="fields.beatType().value()" (selectionChange)="beatTypeChosen($event)">
              @for (value of noteValues; track value) {
                <mat-option [value]="value">{{ noteValueKeys[value] | translate }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>
      }

      <h3>{{ 'TAPE.SCORES.UPBEAT' | translate }}</h3>
      <mat-form-field>
        <mat-label>{{ 'TAPE.SCORES.UPBEAT_COUNT' | translate }}</mat-label>
        <input matInput type="number" step="1" data-testid="scores-upbeat-count" [formField]="fields.upbeatCount" />
        <ng-container ngProjectAs="mat-error">
          @if (shownMessageKey(fields.upbeatCount); as key) {
            <mat-error>{{ key | translate }}</mat-error>
          }
        </ng-container>
      </mat-form-field>
      <mat-form-field>
        <mat-label>{{ 'TAPE.SCORES.UPBEAT_VALUE' | translate }}</mat-label>
        <mat-select data-testid="scores-upbeat-value" [value]="fields.upbeatValue().value()" (selectionChange)="valueChosen($event)">
          @for (value of noteValues; track value) {
            <mat-option [value]="value">{{ noteValueKeys[value] | translate }}</mat-option>
          }
        </mat-select>
      </mat-form-field>

      <h3>{{ 'TAPE.SCORES.STAVES' | translate }}</h3>
      @for (value of fields.splitNotes().value(); track $index; let index = $index) {
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
      @if (shownMessageKey(fields.splitNotes); as key) {
        <mat-error>{{ key | translate }}</mat-error>
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
    .time-fields {
      display: flex;
      flex-wrap: wrap;
    }
    .hint {
      margin: 0.25rem 0;
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
  protected readonly noteValueKeys = NOTE_VALUE_KEYS;
  protected readonly pitchOptions = PITCH_OPTIONS;
  protected readonly shownMessageKey = shownMessageKey;

  private readonly prefilled = prefilledScoresChoices(this.data.organ, this.data.song, this.data.rememberedSplitNotes);
  private readonly notes = closeGaps(this.data.tape.holes, minimumGapColumns(this.data.organ, this.data.tape.columnLength));

  /** The metre of the "As in the Song" choice; undefined when the dialog does not offer that choice. */
  protected readonly songMetreText = this.prefilled.timeSignature === 'song' ? metreTextOf(this.data.song) : undefined;
  /** The Song has a Time signature that its Bars cannot keep on whole Columns: the dialog says so and offers none. */
  protected readonly songMetreNotOnColumns = this.prefilled.timeSignature !== 'song' && metreTextOf(this.data.song) !== undefined;

  /** The dialog's fields as the user holds them; they may be invalid. */
  private readonly model = signal<ScoresDialogModel>(this.initialModel());

  /** The fields the template binds to; their one rule is the domain's `validateScoresChoices`. */
  protected readonly fields: FieldTree<ScoresDialogModel> = form(this.model, scoresFormSchema(this.data.song));

  /** The split note that Add gives next; undefined when Add is disabled. */
  protected readonly nextSplitNote = computed(() => nextSplitNoteOf(this.model().splitNotes));

  /** The choices the Scores are written with; undefined while a value is not yet a choice, which keeps Export disabled. */
  protected readonly choices = computed(() => scoresChoicesOf(inputOf(this.model()), this.data.song));

  /** One line per staff from the top: its number, the notes it holds (from, to) and its clef. */
  protected readonly staffLines = computed(() =>
    scoresStaves(pitchesOf(this.model().splitNotes), this.data.organ, this.notes).map((staff) => {
      const range = staffRange(staff);
      return {
        number: staff.number,
        from: noteName(range.lowest),
        to: noteName(range.highest),
        clef: CLEF_KEYS[staff.clef],
      };
    }),
  );

  protected timeChoiceChosen(change: MatRadioChange): void {
    const choice: unknown = change.value;
    this.fields.timeChoice().value.set(choice === 'song' ? 'song' : 'other');
  }

  protected beatTypeChosen(change: MatSelectChange): void {
    this.fields.beatType().value.set(beatTypeOf(change.value));
  }

  protected valueChosen(change: MatSelectChange): void {
    this.fields.upbeatValue().value.set(beatTypeOf(change.value));
  }

  /** Changes the split note of a row; the rows stay highest first. */
  protected splitChosen(index: number, change: MatSelectChange): void {
    const value: unknown = change.value;
    if (typeof value !== 'number') return;
    this.fields.splitNotes().value.update((values) =>
      highestFirst(values.map((current, position) => (position === index ? value : current))),
    );
  }

  protected removeSplitNote(index: number): void {
    this.fields.splitNotes().value.update((values) => values.filter((_, position) => position !== index));
  }

  protected addSplitNote(): void {
    const next = this.nextSplitNote();
    if (next !== undefined) this.fields.splitNotes().value.update((values) => [...values, next]);
  }

  /** Closes with no choices, which tells the export that nothing is to be written. */
  protected cancel(): void {
    this.dialogRef.close(undefined);
  }

  protected confirm(): void {
    const choices = this.choices();
    if (choices !== undefined) this.dialogRef.close(choices);
  }

  /** The fields the dialog starts with: the prefilled choices, and "Another one" from the Song's Time signature. */
  private initialModel(): ScoresDialogModel {
    const other = otherTimeSignatureOf(this.data.song, this.prefilled);
    return {
      timeChoice: this.prefilled.timeSignature === 'song' ? 'song' : 'other',
      beats: other.beats,
      beatType: other.beatType,
      upbeatCount: this.prefilled.upbeat.count,
      upbeatValue: beatTypeOf(this.prefilled.upbeat.noteValue),
      splitNotes: highestFirst(this.prefilled.splitNotes),
    };
  }
}
