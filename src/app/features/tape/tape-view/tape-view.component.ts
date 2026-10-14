import {ChangeDetectionStrategy, Component, computed, effect, inject} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {ActivatedRoute, Router} from '@angular/router';
import {map} from 'rxjs';
import {noteName, type ImportSummary, type Tape} from '@api/index';
import {TranslatePipe} from '@ngx-translate/core';
import {OrganLibrary} from '../../organ/organ-library.store';
import {ImportSummaryComponent} from '../import-summary/import-summary.component';
import {TapeLibrary} from '../tape-library.store';

function isImportSummary(value: unknown): value is ImportSummary {
  if (typeof value !== 'object' || value === null) return false;
  const summary: Partial<Record<keyof ImportSummary, unknown>> = value;
  return (
    typeof summary.transposition === 'number' &&
    typeof summary.notesOnTape === 'number' &&
    Array.isArray(summary.movedByOctaves) &&
    Array.isArray(summary.unplayableNotes) &&
    Array.isArray(summary.holeChanges)
  );
}

function importSummaryOf(state: unknown): ImportSummary | null {
  if (typeof state !== 'object' || state === null || !('importSummary' in state)) return null;
  return isImportSummary(state.importSummary) ? state.importSummary : null;
}

/** Pixels per Column in the drawing of a Tape. */
export const TAPE_COLUMN_WIDTH = 8;
/** Pixels per row (Pipe) in the drawing of a Tape. */
export const TAPE_ROW_HEIGHT = 16;
/** A light mark every 8th Column (a quarter note). */
const COLUMNS_PER_MARK = 8;

/** One Tape. Right after an import, the navigation state carries the Import Summary. */
@Component({
  selector: 'cranc-tape-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ImportSummaryComponent, TranslatePipe],
  templateUrl: './tape-view.component.html',
  styles: `
    .drawing {
      display: flex;
    }
    .labels {
      flex: none;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .labels li {
      height: var(--row-height);
      line-height: var(--row-height);
      padding-right: 0.5rem;
      text-align: right;
    }
    .scroll {
      flex: 1;
      overflow-x: auto;
    }
    .scroll svg {
      display: block;
    }
    .hole {
      fill: currentColor;
    }
    .mark {
      stroke: currentColor;
      stroke-opacity: 0.2;
    }
  `,
})
export class TapeViewComponent {
  private readonly library = inject(TapeLibrary);
  private readonly organs = inject(OrganLibrary);
  private readonly router = inject(Router);
  protected readonly columnWidth = TAPE_COLUMN_WIDTH;
  protected readonly rowHeight = TAPE_ROW_HEIGHT;

  protected readonly importSummary = importSummaryOf(this.router.currentNavigation()?.extras.state);
  private readonly id = toSignal(inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('id'))), {
    initialValue: null,
  });
  protected readonly tape = computed(() => {
    const id = this.id();
    return id === null ? undefined : this.library.tapeEntities().find((tape) => tape.id === id);
  });

  private readonly organ = computed(() => {
    const organId = this.tape()?.organId;
    return this.organs.entities().find((organ) => organ.id === organId);
  });
  /** What the template draws; `undefined` while the Tape or its Organ is not available. */
  protected readonly drawing = computed(() => {
    const tape = this.tape();
    const organ = this.organ();
    if (tape === undefined || organ === undefined) return undefined;
    const rowOf = new Map(organ.pipes.map(({note}, row) => [note, row]));
    return {
      tape,
      labels: organ.pipes.map(({note}) => ({note, name: noteName(note)})),
      holes: tape.holes.flatMap((hole) => {
        const row = rowOf.get(hole.pipe);
        return row === undefined ? [] : [{row, start: hole.start, length: hole.length}];
      }),
      marks: Array.from({length: Math.ceil(tape.length / COLUMNS_PER_MARK)}, (_, index) => index * COLUMNS_PER_MARK),
      width: tape.length * TAPE_COLUMN_WIDTH,
      height: organ.pipes.length * TAPE_ROW_HEIGHT,
      partNames: this.partNames(tape),
    };
  });

  private partNames(tape: Tape): readonly {readonly index: number; readonly name: string | undefined}[] {
    const song = this.library.songEntities().find((candidate) => candidate.id === tape.songId);
    return (tape.selectedParts ?? []).map((index) => ({index, name: song?.parts[index]?.name}));
  }

  constructor() {
    effect(() => {
      if (this.library.loaded() && this.drawing() === undefined) void this.router.navigateByUrl('/tapes');
    });
  }
}
