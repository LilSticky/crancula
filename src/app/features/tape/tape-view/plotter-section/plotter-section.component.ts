import {ChangeDetectionStrategy, Component, computed, inject, input} from '@angular/core';
import {MatButton} from '@angular/material/button';
import {MatFormField, MatLabel} from '@angular/material/form-field';
import {MatOption, MatSelect} from '@angular/material/select';
import {RouterLink} from '@angular/router';
import {TranslatePipe} from '@ngx-translate/core';
import {plotterId, type TapePieces} from '@api/index';
import {formatNumber} from '../../../shared/format-number';
import {LanguagePreference} from '../../../shared/language-preference';
import {PlotterLibrary} from '../../../plotter/plotter-library.store';
import {PlotterPreference} from '../../../plotter/plotter-preference';

/** The picker's value for No Plotter: no Plotter id is empty. */
const NO_PLOTTER = '';

/** The Plotter section of the side panel: picks the Plotter the Tape is cut for, and says in how many Tape pieces. */
@Component({
  selector: 'cranc-plotter-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButton, MatFormField, MatLabel, MatOption, MatSelect, RouterLink, TranslatePipe],
  templateUrl: './plotter-section.component.html',
  styleUrl: './plotter-section.component.scss',
})
export class PlotterSectionComponent {
  /** The Tape cut for the picked Plotter; nothing while no Plotter is picked or the Tape is not known. */
  readonly pieces = input<TapePieces | undefined>(undefined);
  private readonly library = inject(PlotterLibrary);
  private readonly preference = inject(PlotterPreference);
  private readonly language = inject(LanguagePreference).language;
  protected readonly noPlotter = NO_PLOTTER;
  protected readonly plotter = this.preference.picked;
  protected readonly plotters = computed(() => [...this.library.entities()].sort((a, b) => a.name.localeCompare(b.name)));
  /** The width of the Tape and the working width of the picked Plotter when the Tape is too wide; otherwise nothing. */
  protected readonly tooWide = computed(() => {
    const pieces = this.pieces();
    if (pieces?.kind !== 'too-wide') return undefined;
    return {tapeWidth: formatNumber(pieces.tapeWidth, this.language()), workingWidth: formatNumber(pieces.workingWidth, this.language())};
  });

  /** Writes the picked Plotter to the preference; the Tape stays as it is. */
  protected pick(value: string): void {
    this.preference.pick(value === NO_PLOTTER ? undefined : plotterId(value));
  }
}
