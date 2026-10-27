import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {MatButton} from '@angular/material/button';
import {MatCard} from '@angular/material/card';
import {MatFormField, MatLabel} from '@angular/material/form-field';
import {MatOption, MatSelect} from '@angular/material/select';
import {ActivatedRoute} from '@angular/router';
import {TranslatePipe} from '@ngx-translate/core';
import {type LaneTape, type Organ, type PlotterId, type RollPlotter, type Tape} from '@api/index';
import {PageHeadComponent} from '../../shared/components/page-head/page-head.component';
import {LanguagePreference} from '../../shared/language-preference';
import {byName} from '../../shared/ledger-order';
import {OrganLibrary} from '../../organ/organ-library.store';
import {PlotterLibrary} from '../../plotter/plotter-library.store';
import {TapeLibrary} from '../tape-library.store';
import {laneTapeIds} from './lane-query';
import {SideBySideExport} from './side-by-side-export';

/** A Lane on the page: its number from 1, its Tape and the Tape's Organ, `undefined` when the Organ is not available. */
interface LaneRow {
  readonly number: number;
  readonly tape: Tape;
  readonly organ: Organ | undefined;
}

/** What Save cuts: the picked roll Plotter and the Lanes, each with its Organ. */
interface SavableCut {
  readonly plotter: RollPlotter;
  readonly lanes: readonly LaneTape[];
}

/** Cuts the Tapes of the URL side by side on one roll Plotter, one Lane per Tape, in the order of the URL. */
@Component({
  selector: 'cranc-side-by-side',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButton, MatCard, MatFormField, MatLabel, MatOption, MatSelect, PageHeadComponent, TranslatePipe],
  templateUrl: './side-by-side.component.html',
  styleUrl: './side-by-side.component.scss',
})
export class SideBySideComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly tapes = inject(TapeLibrary);
  private readonly organs = inject(OrganLibrary);
  private readonly library = inject(PlotterLibrary);
  protected readonly exporter = inject(SideBySideExport);
  private readonly language = inject(LanguagePreference).language;
  private readonly parameters = toSignal(this.route.queryParamMap, {requireSync: true});

  /** The roll Plotter the user picked; undefined until a pick, which starts with the only roll Plotter. */
  private readonly pickedId = signal<PlotterId | undefined>(undefined);

  protected readonly rollPlotters = computed<readonly RollPlotter[]>(() =>
    byName(
      this.library.entities().flatMap((plotter): RollPlotter[] => (plotter.roll ? [plotter] : [])),
      this.language(),
    ),
  );

  protected readonly plotter = computed<RollPlotter | undefined>(() => {
    const picked = this.pickedId();
    const plotters = this.rollPlotters();
    if (picked !== undefined) return plotters.find((plotter) => plotter.id === picked);
    return plotters.length === 1 ? plotters.at(0) : undefined;
  });

  /** The Lanes in the order of the Tape ids in the URL; a Tape that is not in the library is dropped. */
  protected readonly lanes = computed<readonly LaneRow[]>(() => {
    const tapes = this.tapes.tapeEntities();
    const organs = this.organs.entities();
    return this.tapeIds()
      .flatMap((id): Tape[] => {
        const tape = tapes.find((candidate) => candidate.id === id);
        return tape === undefined ? [] : [tape];
      })
      .map((tape, index) => ({number: index + 1, tape, organ: organs.find((organ) => organ.id === tape.organId)}));
  });

  /** What Save cuts; undefined without a roll Plotter, without Lanes, or while a Lane has no Organ. */
  protected readonly savable = computed<SavableCut | undefined>(() => {
    const plotter = this.plotter();
    const lanes = this.lanes();
    if (plotter === undefined || lanes.length === 0) return undefined;
    const ready = lanes.flatMap(({tape, organ}): LaneTape[] => (organ === undefined ? [] : [{tape, organ}]));
    return ready.length === lanes.length ? {plotter, lanes: ready} : undefined;
  });

  private readonly tapeIds = computed(() => laneTapeIds(this.parameters()));

  protected pick(id: PlotterId | undefined): void {
    this.pickedId.set(id);
  }

  protected save(): void {
    const cut = this.savable();
    if (cut !== undefined) void this.exporter.export(cut.lanes, cut.plotter);
  }
}
