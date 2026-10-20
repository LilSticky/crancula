import {ChangeDetectionStrategy, Component, computed, inject, input, output} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {MatButton} from '@angular/material/button';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import {type HoleCuttingProblems, type HoleRef} from '@api/index';
import {map} from 'rxjs';
import {cuttingProblemText, type ProblemText} from '../cutting-problem-text';

interface Entry {
  readonly hole: HoleRef;
  readonly texts: readonly ProblemText[];
  /** A Hole without a Pipe has nothing to select on the Tape. */
  readonly selectable: boolean;
}

/** The Cutting Problems section of the side panel: how many Holes can't be cut, and which. */
@Component({
  selector: 'cranc-cutting-problems',
  imports: [MatButton, TranslatePipe],
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
    .unselectable {
      padding: 0.5rem 0.75rem;
    }
    p {
      margin: 0;
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
              <button mat-button type="button" data-testid="cutting-problem" (click)="chosen.emit(entry.hole)">
                @for (text of entry.texts; track $index) {
                  <p>{{ text.key | translate: text.params }}</p>
                }
              </button>
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

  private readonly translate = inject(TranslateService);
  private readonly language = toSignal(this.translate.onLangChange.pipe(map((event) => event.lang)), {
    initialValue: this.translate.getCurrentLang() ?? 'en',
  });

  protected readonly entries = computed<readonly Entry[]>(() =>
    this.holes().map(({hole, problems}) => ({
      hole,
      texts: problems.map((problem) => cuttingProblemText(problem, this.language())),
      selectable: problems.some((problem) => problem.code !== 'no-pipe'),
    })),
  );
}
