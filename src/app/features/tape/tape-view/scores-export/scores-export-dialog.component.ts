import {ChangeDetectionStrategy, Component, computed, effect, inject, signal, viewChild} from '@angular/core';
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

/** Puts a Material field in its error state exactly while the dialog shows a message for it. */
class ShownMessageMatcher extends ErrorStateMatcher {
  readonly isShown: () => boolean;

  constructor(isShown: () => boolean) {
    super();
    this.isShown = isShown;
  }

  override isErrorState(): boolean {
    return this.isShown();
  }
}

/** The first Time signature of the Song as "3/4"; undefined without a Song or without a Time signature. */
function metreTextOf(song: Song | undefined): string | undefined {
  const timeSignature = song === undefined ? undefined : songMetre(song).timeSignature;
  return timeSignature === undefined ? undefined : `${timeSignature.beats}/${timeSignature.beatType}`;
}

/** The beat type of a value the dialog holds, or null when the Scores do not offer it. */
function beatTypeOf(value: unknown): ScoresBeatType | null {
  return SCORES_BEAT_TYPES.find((beatType) => beatType === value) ?? null;
}

/** The number an input holds, or null while it holds none. */
function numberTypedIn(event: Event): number | null {
  const value = event.target instanceof HTMLInputElement ? event.target.valueAsNumber : Number.NaN;
  return Number.isNaN(value) ? null : value;
}

/** The translation key of the message that explains a violation. */
function messageKeyOf(violation: ScoresChoicesViolation): string {
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

/** The message key of the first violation of each field, the one the dialog shows under that field. */
function messageKeysOf(
  violations: readonly ScoresChoicesViolation[],
): ReadonlyMap<ScoresChoicesViolation['field'], string> {
  const keys = new Map<ScoresChoicesViolation['field'], string>();
  for (const violation of violations) {
    if (!keys.has(violation.field)) keys.set(violation.field, messageKeyOf(violation));
  }
  return keys;
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
  template: `
    <h2 mat-dialog-title>{{ 'TAPE.SCORES.TITLE' | translate }}</h2>
    <mat-dialog-content data-testid="scores-export-dialog">
      <h3>{{ 'TAPE.SCORES.TIME_SIGNATURE' | translate }}</h3>
      @if (songMetreText; as metre) {
        <mat-radio-group
          [attr.aria-label]="'TAPE.SCORES.TIME_SIGNATURE' | translate"
          [value]="timeChoice()"
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
      @if (timeChoice() === 'other') {
        <div class="time-fields">
          <mat-form-field>
            <mat-label>{{ 'TAPE.SCORES.BEATS' | translate }}</mat-label>
            <input
              matInput
              type="number"
              step="1"
              #beatsField
              data-testid="scores-beats"
              [value]="beats() ?? ''"
              [errorStateMatcher]="beatsMatcher"
              (input)="beatsTyped($event)"
            />
            <ng-container ngProjectAs="mat-error">
              @if (messageOf('beats'); as key) {
                <mat-error>{{ key | translate }}</mat-error>
              }
            </ng-container>
          </mat-form-field>
          <mat-form-field>
            <mat-label>{{ 'TAPE.SCORES.BEAT_TYPE' | translate }}</mat-label>
            <mat-select
              #beatTypeField
              data-testid="scores-beat-type"
              [value]="beatType()"
              [errorStateMatcher]="beatTypeMatcher"
              (selectionChange)="beatTypeChosen($event)"
            >
              @for (value of noteValues; track value) {
                <mat-option [value]="value">{{ noteValueKeys[value] | translate }}</mat-option>
              }
            </mat-select>
            <ng-container ngProjectAs="mat-error">
              @if (messageOf('beatType'); as key) {
                <mat-error>{{ key | translate }}</mat-error>
              }
            </ng-container>
          </mat-form-field>
        </div>
      }

      <h3>{{ 'TAPE.SCORES.UPBEAT' | translate }}</h3>
      <mat-form-field>
        <mat-label>{{ 'TAPE.SCORES.UPBEAT_COUNT' | translate }}</mat-label>
        <input
          matInput
          type="number"
          min="0"
          step="1"
          #upbeatField
          data-testid="scores-upbeat-count"
          [value]="upbeatCount() ?? ''"
          [errorStateMatcher]="upbeatMatcher"
          (input)="countTyped($event)"
        />
        <ng-container ngProjectAs="mat-error">
          @if (messageOf('upbeat'); as key) {
            <mat-error>{{ key | translate }}</mat-error>
          }
        </ng-container>
      </mat-form-field>
      <mat-form-field>
        <mat-label>{{ 'TAPE.SCORES.UPBEAT_VALUE' | translate }}</mat-label>
        <mat-select data-testid="scores-upbeat-value" [value]="upbeatValue()" (selectionChange)="valueChosen($event)">
          @for (value of noteValues; track value) {
            <mat-option [value]="value">{{ noteValueKeys[value] | translate }}</mat-option>
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
      @if (messageOf('splitNotes'); as key) {
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

  private readonly prefilled = prefilledScoresChoices(this.data.organ, this.data.song, this.data.rememberedSplitNotes);
  private readonly notes = closeGaps(this.data.tape.holes, minimumGapColumns(this.data.organ, this.data.tape.columnLength));

  /** The metre of the "As in the Song" choice; undefined when the dialog does not offer that choice. */
  protected readonly songMetreText = this.prefilled.timeSignature === 'song' ? metreTextOf(this.data.song) : undefined;
  /** The Song has a Time signature that its Bars cannot keep on whole Columns: the dialog says so and offers none. */
  protected readonly songMetreNotOnColumns = this.prefilled.timeSignature !== 'song' && metreTextOf(this.data.song) !== undefined;

  /** 'song' while the Tape keeps the Song's Time signature, else 'other': the beats and beat type the dialog holds. */
  protected readonly timeChoice = signal<'song' | 'other'>(this.prefilled.timeSignature === 'song' ? 'song' : 'other');
  protected readonly beats = signal<number | null>(COMMON_BEATS);
  protected readonly beatType = signal<ScoresBeatType | null>(COMMON_BEAT_TYPE);

  protected readonly upbeatCount = signal<number | null>(this.prefilled.upbeat.count);
  protected readonly upbeatValue = signal<ScoresBeatType | null>(beatTypeOf(this.prefilled.upbeat.noteValue));

  /** The split notes as the dialog holds them, the highest on top; they may not be distinct while being edited. */
  protected readonly splitNotes = signal<readonly number[]>(highestFirst(this.prefilled.splitNotes));

  /** The split note that Add gives next; undefined when Add is disabled. */
  protected readonly nextSplitNote = computed(() => nextSplitNoteOf(this.splitNotes()));

  /** The choices as the dialog holds them. */
  private readonly input = computed<ScoresChoicesInput>(() => ({
    timeSignature: this.timeChoice() === 'song' ? 'song' : {beats: this.beats(), beatType: this.beatType()},
    upbeat: {count: this.upbeatCount(), noteValue: this.upbeatValue()},
    splitNotes: this.splitNotes(),
  }));

  /** The message keys of the violations of the choices, by field; they keep Export disabled. */
  private readonly messageKeys = computed(() => messageKeysOf(validateScoresChoices(this.input(), this.data.song)));

  protected readonly beatsMatcher = new ShownMessageMatcher(() => this.messageKeys().has('beats'));
  protected readonly beatTypeMatcher = new ShownMessageMatcher(() => this.messageKeys().has('beatType'));
  protected readonly upbeatMatcher = new ShownMessageMatcher(() => this.messageKeys().has('upbeat'));

  private readonly beatsInput = viewChild('beatsField', {read: MatInput});
  private readonly beatTypeSelect = viewChild('beatTypeField', {read: MatSelect});
  private readonly upbeatInput = viewChild('upbeatField', {read: MatInput});

  /**
   * Material only refreshes the error state of a field that has a form control; these fields have none, so each
   * one is asked again whenever the messages change.
   */
  private readonly refreshErrorStates = effect(() => {
    this.messageKeys();
    this.beatsInput()?.updateErrorState();
    this.beatTypeSelect()?.updateErrorState();
    this.upbeatInput()?.updateErrorState();
  });

  /** The choices the Scores are written with; undefined while a value is not yet a choice, which keeps Export disabled. */
  protected readonly choices = computed(() => scoresChoicesOf(this.input(), this.data.song));

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

  /** The translation key of the message under a field, or undefined when the field has no violation. */
  protected messageOf(field: ScoresChoicesViolation['field']): string | undefined {
    return this.messageKeys().get(field);
  }

  protected timeChoiceChosen(change: MatRadioChange): void {
    const choice: unknown = change.value;
    this.timeChoice.set(choice === 'song' ? 'song' : 'other');
  }

  protected beatsTyped(event: Event): void {
    this.beats.set(numberTypedIn(event));
  }

  protected beatTypeChosen(change: MatSelectChange): void {
    this.beatType.set(beatTypeOf(change.value));
  }

  protected countTyped(event: Event): void {
    this.upbeatCount.set(numberTypedIn(event));
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
