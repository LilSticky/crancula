import {ChangeDetectionStrategy, Component, computed, inject, input, output} from '@angular/core';
import {MatButton} from '@angular/material/button';
import {MatFormField, MatLabel} from '@angular/material/form-field';
import {MatIcon} from '@angular/material/icon';
import {MatOption, MatSelect, type MatSelectChange} from '@angular/material/select';
import {RouterLink} from '@angular/router';
import {TranslatePipe} from '@ngx-translate/core';
import {plotterId, type TapePieces} from '@api/index';
import {formatNumber} from '../../../shared/format-number';
import {byName} from '../../../shared/ledger-order';
import {LanguagePreference} from '../../../shared/language-preference';
import {PlotterLibrary} from '../../../plotter/plotter-library.store';
import {PlotterPreference} from '../../../plotter/plotter-preference';

/** The picker's value for No Plotter: no Plotter id is empty. */
const NO_PLOTTER = '';

/** The Plotter section of the side panel: picks the Plotter the Tape is cut for, and says in how many Tape pieces. */
@Component({
  selector: 'cranc-plotter-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButton, MatFormField, MatIcon, MatLabel, MatOption, MatSelect, RouterLink, TranslatePipe],
  templateUrl: './plotter-section.component.html',
  styleUrl: './plotter-section.component.scss',
})
export class PlotterSectionComponent {
  /** The Tape cut for the picked Plotter; nothing while no Plotter is picked or the Tape is not known. */
  readonly pieces = input<TapePieces | undefined>(undefined);
  /** Asks the Tape view to show the Cutting Problems, which the Tape can not be cut without. */
  readonly cuttingProblemsRequested = output();
  private readonly library = inject(PlotterLibrary);
  private readonly preference = inject(PlotterPreference);
  private readonly language = inject(LanguagePreference).language;
  protected readonly noPlotter = NO_PLOTTER;
  protected readonly plotter = this.preference.picked;
  protected readonly plotters = computed(() => byName(this.library.entities(), this.language()));
  /** The width of the Tape, the working width and the id of the picked Plotter when the Tape is too wide; otherwise nothing. */
  protected readonly tooWide = computed(() => {
    const pieces = this.pieces();
    const plotter = this.plotter();
    if (pieces?.kind !== 'too-wide' || plotter === undefined) return undefined;
    return {
      tapeWidth: formatNumber(pieces.tapeWidth, this.language()),
      workingWidth: formatNumber(pieces.workingWidth, this.language()),
      plotterId: plotter.id,
    };
  });

  /** Writes the picked Plotter to the preference; the Tape stays as it is. */
  protected pick(change: MatSelectChange): void {
    const value: unknown = change.value;
    if (typeof value !== 'string') return;
    this.preference.pick(value === NO_PLOTTER ? undefined : plotterId(value));
  }
}
