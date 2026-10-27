import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {MatButton, MatIconButton} from '@angular/material/button';
import {MatCard} from '@angular/material/card';
import {MatIcon} from '@angular/material/icon';
import {MatFormField, MatLabel} from '@angular/material/form-field';
import {MatMenu, MatMenuItem, MatMenuTrigger} from '@angular/material/menu';
import {MatOption, MatSelect} from '@angular/material/select';
import {ActivatedRoute} from '@angular/router';
import {TranslatePipe} from '@ngx-translate/core';
import {
  cuttingProblems,
  laneRoom,
  sideBySideCut,
  sideBySideRefusals,
  tapeGeometry,
  type LaneRoom,
  type LaneTape,
  type Organ,
  type PlotterId,
  type RollPlotter,
  type SideBySideCut,
  type Tape,
  type TapeGeometry,
  type TapeId,
} from '@api/index';
import {PageHeadComponent} from '../../shared/components/page-head/page-head.component';
import {formatNumber} from '../../shared/format-number';
import {LanguagePreference} from '../../shared/language-preference';
import {byName, tapesByOrgan} from '../../shared/ledger-order';
import {OrganLibrary} from '../../organ/organ-library.store';
import {PlotterLibrary} from '../../plotter/plotter-library.store';
import {TapeLibrary} from '../tape-library.store';
import {rollDrawing, type RollDrawing} from './side-by-side-drawing';
import {laneTapeIds} from './lane-query';
import {SideBySideExport} from './side-by-side-export';

/** A Lane on the page: the Tape it holds, `key` identifies it across moves. */
interface LaneEntry {
  readonly key: number;
  readonly tapeId: TapeId;
}

/** A Lane as listed: its number from 1, its Tape, the Tape's Organ and the Tape's geometry, `undefined` without an Organ. */
interface LaneRow {
  readonly key: number;
  readonly number: number;
  readonly tape: Tape;
  readonly organ: Organ | undefined;
  readonly geometry: TapeGeometry | undefined;
}

/** Why a Tape can not be added now, as a translation key with its parameters. */
interface AddBlock {
  readonly key: string;
  readonly params: Readonly<Record<string, string>>;
}

/** A Tape offered in the add menu; `blocked` says why it can not be added after the last Lane, `undefined` when it can. */
interface AddOption {
  readonly tape: Tape;
  readonly name: string;
  readonly organ: Organ | undefined;
  readonly blocked: AddBlock | undefined;
}

/** The add menu's Tapes under one Organ heading. */
interface AddGroup {
  readonly key: string;
  readonly organName: string | undefined;
  readonly options: readonly AddOption[];
}

/** The list with the items at `from` and `to` swapped; the list itself when either index is out of range. */
function swapped<T>(list: readonly T[], from: number, to: number): readonly T[] {
  const moving = from < 0 ? undefined : list.at(from);
  const other = to < 0 ? undefined : list.at(to);
  if (moving === undefined || other === undefined) return list;
  return list.map((item, index) => (index === from ? other : index === to ? moving : item));
}

/** Why a Tape can not be added after the last Lane: it has no Organ, or its Lane would pass the working width. */
function blockedBy(organ: Organ | undefined, room: LaneRoom | undefined, number: (value: number) => string): AddBlock | undefined {
  if (organ === undefined) return {key: 'TAPE.SIDE_BY_SIDE.NO_ORGAN', params: {}};
  if (room === undefined || room.fits) return undefined;
  return {
    key: 'TAPE.SIDE_BY_SIDE.DOES_NOT_FIT',
    params: {needed: number(room.needed), free: number(Math.max(0, room.free))},
  };
}

/** Cuts the Tapes of the URL side by side on one roll Plotter, one Lane per Tape, in the order of the URL. */
@Component({
  selector: 'cranc-side-by-side',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButton,
    MatCard,
    MatFormField,
    MatIcon,
    MatIconButton,
    MatLabel,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    MatOption,
    MatSelect,
    PageHeadComponent,
    TranslatePipe,
  ],
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

  private lastKey = -1;

  /** The Lanes in order; read once from the URL on entry, then changed by add, move and remove. */
  private readonly entries = signal<readonly LaneEntry[]>(
    laneTapeIds(this.route.snapshot.queryParamMap).map((tapeId) => ({key: this.newKey(), tapeId})),
  );

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

  /** The Lanes as listed; a Tape that is not in the library is dropped. */
  protected readonly rows = computed<readonly LaneRow[]>(() => {
    const tapes = this.tapes.tapeEntities();
    const organs = this.organs.entities();
    return this.entries()
      .flatMap(({key, tapeId}): Omit<LaneRow, 'number'>[] => {
        const tape = tapes.find((candidate) => candidate.id === tapeId);
        if (tape === undefined) return [];
        const organ = organs.find((candidate) => candidate.id === tape.organId);
        const geometry = organ === undefined ? undefined : tapeGeometry(tape, organ);
        return [{key, tape, organ, geometry}];
      })
      .map((row, index) => ({...row, number: index + 1}));
  });

  /** The cut of the Lanes on the picked roll Plotter; undefined without a plotter or while a Lane has no Organ. */
  protected readonly cut = computed<SideBySideCut | undefined>(() => {
    const plotter = this.plotter();
    const rows = this.rows();
    if (plotter === undefined) return undefined;
    const ready = rows.flatMap(({tape, organ}): LaneTape[] => (organ === undefined ? [] : [{tape, organ}]));
    return ready.length === rows.length ? sideBySideCut(ready, plotter) : undefined;
  });

  /** Every reason the Lanes can not be saved, in the order they are listed; empty when Save would write the file. */
  protected readonly refusals = computed(() => sideBySideRefusals(this.rows(), this.plotter()));

  /** The numbers of the Lanes past the working width, marked in the list. */
  protected readonly lanesPastWidth = computed<ReadonlySet<number>>(
    () =>
      new Set(
        this.refusals().flatMap((refusal) => (refusal.code === 'lane-does-not-fit' ? [refusal.lane] : [])),
      ),
  );

  /** The Cutting Problems of each Tape in the Lanes, counted once per Tape however many Lanes it is in. */
  protected readonly problemCounts = computed<ReadonlyMap<TapeId, number>>(() => {
    const counts = new Map<TapeId, number>();
    for (const {tape, organ} of this.rows()) {
      if (organ !== undefined && !counts.has(tape.id)) counts.set(tape.id, cuttingProblems(tape, organ).length);
    }
    return counts;
  });

  /** What Save cuts: the cut, once there is at least one Lane. */
  protected readonly savable = computed<SideBySideCut | undefined>(() => {
    const cut = this.cut();
    return cut !== undefined && cut.lanes.length > 0 ? cut : undefined;
  });

  /** The drawing to scale; undefined without a cut or Lanes. */
  protected readonly drawing = computed<RollDrawing | undefined>(() => {
    const cut = this.savable();
    return cut === undefined ? undefined : rollDrawing(cut);
  });

  /** The numbers of the drawing's accessible name; the free width is never negative there. */
  protected readonly drawingParams = computed(() => {
    const cut = this.savable();
    return {
      lanes: this.number(cut?.lanes.length ?? 0),
      used: this.number(cut?.usedWidth ?? 0),
      free: this.number(Math.max(0, cut?.freeWidth ?? 0)),
    };
  });

  /** The Tapes of the library in the add menu, under their Organ; a Tape without an Organ or that does not fit is disabled. */
  protected readonly addGroups = computed<readonly AddGroup[]>(() => {
    const cut = this.cut();
    const organs = this.organs.entities();
    const candidates = tapesByOrgan(
      this.tapes.tapeEntities().map((tape) => ({
        tape,
        name: tape.name,
        organ: organs.find((organ) => organ.id === tape.organId),
      })),
      this.language(),
    );
    const options = candidates.map(({tape, name, organ}): AddOption => {
      const room = cut !== undefined && organ !== undefined ? laneRoom(cut, organ.tapeBed.tapeWidth) : undefined;
      return {tape, name, organ, blocked: blockedBy(organ, room, (value) => this.number(value))};
    });
    return options.reduce<AddGroup[]>((groups, option) => {
      const key = option.organ?.id ?? '';
      const last = groups.at(-1);
      if (last !== undefined && last.key === key) {
        return [...groups.slice(0, -1), {...last, options: [...last.options, option]}];
      }
      return [...groups, {key, organName: option.organ?.name, options: [option]}];
    }, []);
  });

  protected pick(id: PlotterId | undefined): void {
    this.pickedId.set(id);
  }

  protected save(): void {
    void this.exporter.export(this.rows(), this.plotter());
  }

  protected add(tape: Tape): void {
    this.entries.update((list) => [...list, {key: this.newKey(), tapeId: tape.id}]);
  }

  protected move(key: number, step: 1 | -1): void {
    this.entries.update((list) => {
      const from = list.findIndex((entry) => entry.key === key);
      return swapped(list, from, from + step);
    });
  }

  protected remove(key: number): void {
    this.entries.update((list) => list.filter((entry) => entry.key !== key));
  }

  /** A number as text in the language of the app. */
  protected number(value: number): string {
    return formatNumber(value, this.language());
  }

  private newKey(): number {
    this.lastKey += 1;
    return this.lastKey;
  }
}
