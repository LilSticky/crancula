import {ChangeDetectionStrategy, Component, computed, effect, inject} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {ActivatedRoute, Router} from '@angular/router';
import {map} from 'rxjs';
import type {ImportSummary} from '@api/index';
import {ImportSummaryComponent} from '../import-summary/import-summary.component';
import {TapeLibrary} from '../tape-library.store';

function importSummaryOf(state: unknown): ImportSummary | null {
  return typeof state === 'object' && state !== null && 'importSummary' in state
    ? (state.importSummary as ImportSummary)
    : null;
}

/** One Tape. Right after an import, the navigation state carries the Import Summary. */
@Component({
  selector: 'cranc-tape-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ImportSummaryComponent],
  templateUrl: './tape-view.component.html',
})
export class TapeViewComponent {
  private readonly library = inject(TapeLibrary);
  private readonly router = inject(Router);

  protected readonly importSummary = importSummaryOf(this.router.currentNavigation()?.extras.state);
  private readonly id = toSignal(inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('id'))), {
    initialValue: null,
  });
  protected readonly tape = computed(() => {
    const id = this.id();
    return id === null ? undefined : this.library.tapeEntities().find((tape) => tape.id === id);
  });

  constructor() {
    effect(() => {
      if (this.tape() === undefined) void this.router.navigateByUrl('/tapes');
    });
  }
}
