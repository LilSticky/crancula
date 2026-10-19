import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';
import {type Organ, type Tape, tapeGeometry} from '@api/index';
import {TranslatePipe} from '@ngx-translate/core';
import {outline} from '../../tape-view/tape-drawing';

/** The strip is this tall in px, whatever the Tape width. */
const STRIP_HEIGHT_PX = 160;

/** The first Columns of the Tape about to be created, scaled to a fixed-height strip and cut off at its width. */
@Component({
  selector: 'cranc-tape-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './tape-preview.component.html',
  styleUrl: './tape-preview.component.scss',
})
export class TapePreviewComponent {
  readonly tape = input.required<Tape>();
  readonly organ = input.required<Organ>();
  /** The width of the strip in px. */
  readonly widthPx = input.required<number>();

  protected readonly drawing = computed(() => {
    const geometry = tapeGeometry(this.tape(), this.organ());
    const scale = STRIP_HEIGHT_PX / geometry.width;
    const shape = outline(geometry, scale);
    const holes = geometry.slots
      .filter((slot) => slot.x * scale < this.widthPx())
      .map((slot) => ({
        key: `${slot.row}:${slot.start}`,
        x: slot.x * scale,
        y: slot.y * scale,
        width: slot.width * scale,
        height: slot.height * scale,
        radius: slot.radius * scale,
      }));
    return {shape, holes};
  });
}
