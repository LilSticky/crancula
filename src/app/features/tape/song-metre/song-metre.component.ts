import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';
import {TranslatePipe} from '@ngx-translate/core';
import type {SongMetre} from '@api/index';

type KeyOfMetre = NonNullable<SongMetre['key']>;

/** Whether a metre keeps any of its parts: a Time signature, a Key or an upbeat. */
export function keepsMetre(metre: SongMetre): boolean {
  return metre.timeSignature !== undefined || metre.key !== undefined || metre.upbeat !== undefined;
}

/**
 * The Time signature, the Key and the upbeat a Song keeps, read-only, as "3/4, G major, upbeat 1/4". Shows nothing
 * for a Song that keeps none of them.
 */
@Component({
  selector: 'cranc-song-metre',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  template: `
    @if (shown()) {
      <span data-testid="song-metre">@if (metre().timeSignature; as time) {<span>{{ 'TAPE.METRE.TIME_SIGNATURE' | translate: {beats: time.beats, beatType: time.beatType} }}</span>}@if (metre().key; as key) {@if (metre().timeSignature) {<span>, </span>}@let tonic = tonicKey(key) | translate;<span>{{ (key.mode === 'major' ? 'TAPE.METRE.MAJOR' : 'TAPE.METRE.MINOR') | translate: {key: tonic} }}</span>}@if (metre().upbeat; as upbeat) {@if (metre().timeSignature || metre().key) {<span>, </span>}<span>{{ 'TAPE.METRE.UPBEAT' | translate: {fraction: upbeat.numerator + '/' + upbeat.denominator} }}</span>}</span>
    }
  `,
})
export class SongMetreComponent {
  readonly metre = input.required<SongMetre>();

  protected readonly shown = computed(() => keepsMetre(this.metre()));

  /** The translation key of the tonic of a Key: the major or minor name for its fifths, flats counted as `M` and their number. */
  protected tonicKey(key: KeyOfMetre): string {
    const mode = key.mode === 'major' ? 'MAJOR' : 'MINOR';
    const fifths = key.fifths < 0 ? `M${-key.fifths}` : `${key.fifths}`;
    return `TAPE.METRE.TONIC.${mode}.${fifths}`;
  }
}
