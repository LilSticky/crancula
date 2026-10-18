import {ChangeDetectionStrategy, Component, input} from '@angular/core';
import {TranslatePipe} from '@ngx-translate/core';
import type {Zoom} from '../pixels-per-millimetre';

/** The pointer position as text; `row` is `undefined` while the pointer is between rows. */
export interface PointerText {
  readonly column: string;
  readonly mm: string;
  readonly row: string | undefined;
  readonly note: string;
}

/** Pointer position, zoom and save state below the Tape. */
@Component({
  selector: 'cranc-tape-status-line',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  template: `
    <div class="status-line" [class.compact]="compact()" data-testid="status-line">
      @if (pointer(); as pointer) {
        <span data-testid="pointer-column">{{ 'TAPE.VIEW.STATUS_COLUMN' | translate: {column: pointer.column, mm: pointer.mm} }}</span>
        @if (pointer.row !== undefined) {
          <span data-testid="pointer-row">{{ 'TAPE.VIEW.STATUS_ROW' | translate: {row: pointer.row, note: pointer.note} }}</span>
        }
      }
      <span data-testid="zoom-state">{{ zoom() === 'whole' ? ('TAPE.VIEW.ZOOM_WHOLE' | translate) : zoom() }}</span>
      <span class="save-state" aria-live="polite" data-testid="save-state">
        @if (saveProblem(); as problem) {
          {{ 'TAPE.STORAGE.SAVE_PROBLEM' | translate: {reason: problem.reason} }}
        } @else {
          {{ 'TAPE.VIEW.SAVED' | translate }}
        }
      </span>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .status-line {
      display: flex;
      height: 26px;
      align-items: center;
      gap: 1.5rem;
      overflow: hidden;
      white-space: nowrap;
      font-size: 0.875rem;
    }
    .status-line.compact {
      height: 24px;
    }
    .save-state {
      margin-left: auto;
    }
  `,
})
export class TapeStatusLineComponent {
  readonly pointer = input.required<PointerText | undefined>();
  readonly zoom = input.required<Zoom>();
  readonly saveProblem = input.required<{readonly reason: string} | null>();
  /** Less height in the compact layout. */
  readonly compact = input(false);
}
