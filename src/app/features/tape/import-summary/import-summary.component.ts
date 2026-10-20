import {ChangeDetectionStrategy, Component, input, output, signal} from '@angular/core';
import {MatIconButton} from '@angular/material/button';
import {MatIcon} from '@angular/material/icon';
import {TranslatePipe} from '@ngx-translate/core';
import {type ImportSummary, noteName} from '@api/index';

/** What bringing a Song onto a Tape changed (FR-015). Parts and Columns are shown counted from 1. */
@Component({
  selector: 'cranc-import-summary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, MatIcon, MatIconButton],
  templateUrl: './import-summary.component.html',
  styles: `
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    h2,
    dl,
    dd,
    ul {
      margin: 0;
    }
    dt {
      font-weight: 600;
      margin-top: 0.75rem;
    }
    ul {
      padding-left: 1.25rem;
    }
  `,
})
export class ImportSummaryComponent {
  readonly importSummary = input.required<ImportSummary>();
  /** The user closed the summary. */
  readonly dismissed = output<void>();

  protected readonly expanded = signal(true);
  protected readonly noteName = noteName;

  protected signed(value: number): string {
    return value > 0 ? `+${value}` : `${value}`;
  }
}
