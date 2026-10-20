import {ChangeDetectionStrategy, Component, computed, inject, input, output} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {MatButton} from '@angular/material/button';
import {MatIcon} from '@angular/material/icon';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import {noteName, type HoleCuttingProblems, type HoleRef} from '@api/index';
import {map} from 'rxjs';
import {cuttingProblemText, type ProblemText} from '../cutting-problem-text';

interface Entry {
  readonly hole: HoleRef;
  /** The Pipe and 1-based Column, for the accessible name. */
  readonly label: {readonly note: string; readonly column: string};
  readonly texts: readonly ProblemText[];
  /** A Hole without a Pipe has nothing to select on the Tape. */
  readonly selectable: boolean;
}

/** The Cutting Problems section of the side panel: how many Holes can't be cut, and which. */
@Component({
  selector: 'cranc-cutting-problems',
  imports: [MatButton, MatIcon, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    :host {
      display: block;
    }
    h2 {
      margin: 0 0 0.5rem;
    }
    button {
      display: block;
      width: 100%;
      height: auto;
      padding: 0.5rem 0.75rem;
      text-align: left;
      white-space: normal;
    }
    button .row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    button mat-icon {
      flex: none;
    }
    .unselectable {
      padding: 0.5rem 0.75rem;
    }
    p {
      margin: 0;
    }
    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  `,
  template: `
    <section data-testid="cutting-problems">
      <h2>{{ 'TAPE.CUTTING_PROBLEMS.TITLE' | translate }}</h2>
      <p data-testid="cutting-problems-count">
        @if (entries().length === 0) {
          {{ 'TAPE.CUTTING_PROBLEMS.NONE' | translate }}
        } @else {
          {{ (entries().length === 1 ? 'TAPE.CUTTING_PROBLEMS.COUNT_ONE' : 'TAPE.CUTTING_PROBLEMS.COUNT') | translate: {count: entries().length} }}
        }
      </p>
      <ul>
        @for (entry of entries(); track $index) {
          <li>
            @if (entry.selectable) {
              <button mat-button type="button" data-testid="cutting-problem" [attr.aria-describedby]="showId + $index" (click)="chosen.emit(entry.hole)">
                <span class="row">
                  <mat-icon aria-hidden="true" fontIcon="my_location" />
                  <span>
                    @for (text of entry.texts; track $index) {
                      <p>{{ text.key | translate: text.params }}</p>
                    }
                  </span>
                </span>
              </button>
              <span class="visually-hidden" [id]="showId + $index">{{ 'TAPE.CUTTING_PROBLEMS.SHOW_HOLE' | translate: entry.label }}</span>
            } @else {
              <div class="unselectable" data-testid="cutting-problem">
                @for (text of entry.texts; track $index) {
                  <p>{{ text.key | translate: text.params }}</p>
                }
              </div>
            }
          </li>
        }
      </ul>
    </section>
  `,
})
export class CuttingProblemsComponent {
  readonly holes = input.required<readonly HoleCuttingProblems[]>();
  readonly chosen = output<HoleRef>();

  private static nextId = 0;
  /** Prefix of the ids of the descriptions, unique per instance. */
  protected readonly showId = `cutting-problem-show-${CuttingProblemsComponent.nextId++}-`;

  private readonly translate = inject(TranslateService);
  private readonly language = toSignal(this.translate.onLangChange.pipe(map((event) => event.lang)), {
    initialValue: this.translate.getCurrentLang() ?? 'en',
  });

  protected readonly entries = computed<readonly Entry[]>(() =>
    this.holes().map(({hole, problems}) => ({
      hole,
      label: {note: noteName(hole.pipe), column: String(hole.start + 1)},
      texts: problems.map((problem) => cuttingProblemText(problem, this.language())),
      selectable: problems.some((problem) => problem.code !== 'no-pipe'),
    })),
  );
}
