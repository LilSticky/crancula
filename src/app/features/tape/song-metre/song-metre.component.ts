import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';
import {TranslatePipe} from '@ngx-translate/core';
import type {SongMetre} from '@api/index';
import {metreParts} from './metre-parts';

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
