import {ChangeDetectionStrategy, Component, inject, input} from '@angular/core';
import {type FieldTree, FormField} from '@angular/forms/signals';
import {MatError, MatFormField, MatHint, MatInput, MatLabel, MatSuffix} from '@angular/material/input';
import {MatCard} from '@angular/material/card';
import {MatIcon} from '@angular/material/icon';
import {TranslatePipe} from '@ngx-translate/core';
import type {OrganDraft} from '@api/index';
import {DecimalInputDirective} from '../../../shared/decimal-input.directive';
import type {TranslatableText} from '../../../shared/leave-unsaved/leave-unsaved.guard';
import {SaveAttempt, shownMessages} from '../organ-form';

/** The numbers of the fit check in the current language. */
export interface TapeBedFitText {
  readonly count: number;
  readonly rowSpan: string;
  readonly tapeWidth: string;
  /** The Border: the centred one, or the guide side when the rows are off-centre. */
  readonly border: string;
  /** The far side, only when the rows are off-centre. */
  readonly far?: string;
  readonly tooWide: boolean;
  readonly fitKey: string;
  readonly drawingKey: string;
}

/** The Tape Bed in mm, for the drawing. */
export interface TapeBedDrawing {
  readonly tapeWidth: number;
  readonly length: number;
  /** The strip at the top edge: the guide side, or the Border when centred. */
  readonly border: number;
  readonly bottomBorderTop: number;
  /** The strip at the bottom edge, the far side; as high as `border` when the rows are centred. */
  readonly bottomBorder?: number;
  readonly rows: readonly number[];
}

/** The Tape Bed sheet of the Organ editor: name and Tape Bed fields, the fit check and the drawing. */
@Component({
  selector: 'cranc-tape-bed-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, MatFormField, MatLabel, MatInput, MatHint, MatError, MatSuffix, MatIcon, MatCard, FormField, DecimalInputDirective],
  templateUrl: './tape-bed-sheet.component.html',
  styleUrl: './tape-bed-sheet.component.scss',
})
export class TapeBedSheetComponent {
  readonly organ = input.required<FieldTree<OrganDraft>>();
  readonly border = input<string>('');
  /** Whether a Guide margin is set: the Border then names the guide side and the far side. */
  readonly guided = input<boolean>(false);
  readonly minimumHoleLength = input<string>('');
  readonly fit = input<TapeBedFitText | null>(null);
  readonly drawing = input<TapeBedDrawing | null>(null);

  private readonly saveAttempt = inject(SaveAttempt).attempted;

  /** The messages to show at a field now. */
  protected messagesAt(field: FieldTree<unknown>): readonly TranslatableText[] {
    return shownMessages(field, this.organ(), this.saveAttempt());
  }
}
