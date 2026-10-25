import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';
import {TranslatePipe} from '@ngx-translate/core';
import type {SongMetre} from '@api/index';

/** One part of the metre a Song keeps, with the values its text needs; a Key names its tonic by translation key. */
export type MetrePart =
  | {readonly kind: 'time-signature'; readonly beats: number; readonly beatType: number}
  | {readonly kind: 'key'; readonly mode: 'major' | 'minor'; readonly tonicKey: string}
  | {readonly kind: 'upbeat'; readonly fraction: string};

/** The translation key of the tonic of a Key: the major or minor name for its fifths, flats counted as `M` and their number. */
function tonicKeyOf(key: NonNullable<SongMetre['key']>): string {
  const mode = key.mode === 'major' ? 'MAJOR' : 'MINOR';
  const fifths = key.fifths < 0 ? `M${-key.fifths}` : `${key.fifths}`;
  return `TAPE.METRE.TONIC.${mode}.${fifths}`;
}

/** The parts a metre keeps, in reading order: Time signature, Key, upbeat. Empty for a metre that keeps none. */
export function metreParts(metre: SongMetre): readonly MetrePart[] {
  const parts: MetrePart[] = [];
  if (metre.timeSignature !== undefined) {
    parts.push({kind: 'time-signature', beats: metre.timeSignature.beats, beatType: metre.timeSignature.beatType});
  }
  if (metre.key !== undefined) parts.push({kind: 'key', mode: metre.key.mode, tonicKey: tonicKeyOf(metre.key)});
  if (metre.upbeat !== undefined) {
    parts.push({kind: 'upbeat', fraction: `${metre.upbeat.numerator}/${metre.upbeat.denominator}`});
  }
  return parts;
}

/** Whether a metre keeps any of its parts: a Time signature, a Key or an upbeat. */
export function keepsMetre(metre: SongMetre): boolean {
  return metreParts(metre).length > 0;
}

/**
 * The Time signature, the Key and the upbeat a Song keeps, read-only, as "3/4, G major, upbeat 1/4". Shows nothing
 * for a Song that keeps none of them. The component gives its own spacing when it shows.
 */
@Component({
  selector: 'cranc-song-metre',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  // One line: the app keeps whitespace, and a space between the spans would show before each separator.
  template: `
    @if (parts().length > 0) {
      <span data-testid="song-metre">@for (part of parts(); track $index) {@if (!$first) {<span>{{ 'TAPE.METRE.SEPARATOR' | translate }}</span>}@switch (part.kind) {@case ('time-signature') {<span>{{ 'TAPE.METRE.TIME_SIGNATURE' | translate: {beats: part.beats, beatType: part.beatType} }}</span>}@case ('key') {<span>{{ (part.mode === 'major' ? 'TAPE.METRE.MAJOR' : 'TAPE.METRE.MINOR') | translate: {key: (part.tonicKey | translate)} }}</span>}@case ('upbeat') {<span>{{ 'TAPE.METRE.UPBEAT' | translate: {fraction: part.fraction} }}</span>}}}</span>
    }
  `,
  styles: `
    :host:not(:empty) {
      margin-inline-start: 8px;
    }
  `,
})
export class SongMetreComponent {
  readonly metre = input.required<SongMetre>();

  protected readonly parts = computed(() => metreParts(this.metre()));
}
