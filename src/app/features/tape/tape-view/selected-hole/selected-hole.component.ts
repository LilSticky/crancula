import {ChangeDetectionStrategy, Component, input} from '@angular/core';
import {MatIcon} from '@angular/material/icon';
import {TranslatePipe} from '@ngx-translate/core';
import type {HoleInspection, HoleWarning} from '../inspect-hole';

/** An inspected Hole with its numbers already formatted for the language of the user. */
export type SelectedHoleView = Omit<HoleInspection, 'warnings'> & {
  readonly rowText: string;
  readonly fromText: string;
  readonly toText: string;
  readonly lengthColumnsText: string;
  readonly lengthMmText: string;
  readonly gapColumnsText: string;
  readonly gapMmText: string;
  readonly warnings: readonly {
    readonly kind: HoleWarning['kind'];
    readonly mmText: string;
    readonly minimumText: string;
  }[];
};

/** The Selected Hole section of the side panel. */
@Component({
  selector: 'cranc-selected-hole',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIcon, TranslatePipe],
  template: `
    <section data-testid="selected-hole" aria-live="polite">
      <h2>{{ 'TAPE.HOLE.TITLE' | translate }}</h2>
      @if (inspection(); as hole) {
        <p>{{ 'TAPE.HOLE.ROW' | translate: {row: hole.rowText, note: hole.noteName} }}</p>
        <p>{{ 'TAPE.HOLE.COLUMNS_RANGE' | translate: {from: hole.fromText, to: hole.toText} }}</p>
        <p>{{ 'TAPE.HOLE.LENGTH' | translate: {columns: (hole.lengthColumns === 1 ? 'TAPE.VIEW.COLUMNS_ONE' : 'TAPE.VIEW.COLUMNS_OTHER') | translate: {count: hole.lengthColumnsText}, mm: hole.lengthMmText} }}</p>
        <p>{{ (hole.gap.to === 'nextHole' ? 'TAPE.HOLE.GAP_NEXT' : 'TAPE.HOLE.GAP_END') | translate: {columns: (hole.gap.columns === 1 ? 'TAPE.VIEW.COLUMNS_ONE' : 'TAPE.VIEW.COLUMNS_OTHER') | translate: {count: hole.gapColumnsText}, mm: hole.gapMmText} }}</p>
        @for (warning of hole.warnings; track warning.kind) {
          <p class="warning" data-testid="hole-warning">
            <mat-icon aria-hidden="true" fontIcon="warning" />
            {{ (warning.kind === 'tooShort' ? 'TAPE.HOLE.TOO_SHORT' : 'TAPE.HOLE.GAP_TOO_SMALL') | translate: {mm: warning.mmText, minimum: warning.minimumText} }}
          </p>
        }
      } @else if (selectionCount() >= 2) {
        <p data-testid="selection-count">{{ 'TAPE.SELECTION.COUNT' | translate: {count: selectionCount()} }}</p>
      } @else {
        <p>{{ 'TAPE.HOLE.EMPTY' | translate }}</p>
      }
    </section>
    @if (inspection()) {
      <p class="keys" id="hole-keys-help" data-testid="hole-keys">{{ 'TAPE.EDIT.KEYS' | translate }}</p>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    h2 {
      margin: 0 0 0.5rem;
    }
    .keys {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }
    .warning {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      color: var(--mat-sys-error);
    }
  `,
})
export class SelectedHoleComponent {
  readonly inspection = input.required<SelectedHoleView | undefined>();
  /** How many Holes are selected; from two on, the section says so. */
  readonly selectionCount = input(0);
}
