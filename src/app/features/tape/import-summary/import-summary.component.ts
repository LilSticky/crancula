import {ChangeDetectionStrategy, Component, input} from '@angular/core';
import {TranslatePipe} from '@ngx-translate/core';
import {type ImportSummary, noteName} from '@api/index';

/** What bringing a Song onto a Tape changed (FR-015). Parts and Columns are shown counted from 1. */
@Component({
  selector: 'cranc-import-summary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './import-summary.component.html',
  styles: `
    ul {
      margin: 0 0 1rem;
    }
  `,
})
export class ImportSummaryComponent {
  readonly importSummary = input.required<ImportSummary>();

  protected readonly noteName = noteName;

  protected signed(value: number): string {
    return value > 0 ? `+${value}` : `${value}`;
  }
}
