import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {MatButton, MatIconButton} from '@angular/material/button';
import {MatCard} from '@angular/material/card';
import {MatCheckbox} from '@angular/material/checkbox';
import {MatDialog} from '@angular/material/dialog';
import {MatIcon} from '@angular/material/icon';
import {MatMenu, MatMenuItem, MatMenuTrigger} from '@angular/material/menu';
import {
  MatCell, MatCellDef, MatColumnDef, MatHeaderCell, MatHeaderCellDef, MatHeaderRow, MatHeaderRowDef, MatRow, MatRowDef, MatTable,
} from '@angular/material/table';
import {MatTooltip} from '@angular/material/tooltip';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {TranslatePipe} from '@ngx-translate/core';
import {map} from 'rxjs';
import {cuttingProblems, type Organ, type Tape, type TapeId, tapeLengthInMillimetres} from '@api/index';
import {ConfirmableAction, ConfirmDialogComponent} from '../../shared/components/confirm-dialog/confirm-dialog.component';
import {PageHeadComponent} from '../../shared/components/page-head/page-head.component';
import {formatNumber} from '../../shared/format-number';
import {LanguagePreference} from '../../shared/language-preference';
import {tapesByOrgan} from '../../shared/ledger-order';
import {OrganLibrary} from '../../organ/organ-library.store';
import {laneQueryParams} from '../side-by-side/lane-query';
import {TapeLibrary} from '../tape-library.store';
import {RenameTapeDialogComponent} from './rename-tape-dialog/rename-tape-dialog.component';

interface TapeRow {
  readonly tape: Tape;
  /** The Tape's name, the sort key within an Organ. */
  readonly name: string;
  /** `undefined` when the Organ is not available. */
  readonly organ: Organ | undefined;
  /** The Cutting Problems of the Tape on its Organ; 0 while the Organ is not available. */
  readonly problems: number;
  readonly columns: string;
  readonly lengthInMillimetres: string;
}

/** The Cutting Problems of `tape` on its Organ, or 0 while the Organ is not available. */
function problemsOf(tape: Tape, organ: Organ | undefined): number {
  return organ === undefined ? 0 : cuttingProblems(tape, organ).length;
}

@Component({
  selector: 'cranc-tape-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslatePipe, RouterLink, MatButton, MatIconButton, MatIcon, MatCard, MatCheckbox, MatMenu, MatMenuItem, MatMenuTrigger,
    MatTooltip, MatTable, MatColumnDef, MatHeaderCell, MatHeaderCellDef, MatHeaderRow, MatHeaderRowDef, MatCell, MatCellDef, MatRow,
    MatRowDef, PageHeadComponent,
  ],
  template: `
    <cranc-page-head [title]="'TAPE.LIST.TITLE' | translate" [subtitle]="'TAPE.LIST.SUBTITLE' | translate">
      <ng-container ngProjectAs="[pageHeadActions]">
        @if (shownTicked().length > 0) {
          <button matButton="filled" type="button" data-testid="cut-side-by-side" (click)="cutSideBySide()">
            {{ 'TAPE.LIST.CUT_SIDE_BY_SIDE' | translate: {count: shownTicked().length} }}
          </button>
        }
        @if (rows().length > 0) {
          <a [matButton]="shownTicked().length > 0 ? 'outlined' : 'filled'" routerLink="/tapes/new" data-testid="new-tape">
            <mat-icon>add</mat-icon>
            {{ 'TAPE.LIST.NEW' | translate }}
          </a>
        }
      </ng-container>
    </cranc-page-head>
    @if (filterOrgan(); as organ) {
      <div class="filter" data-testid="organ-filter">
        <span>{{ organ.name }}</span>
        <button matIconButton type="button" [attr.aria-label]="'TAPE.LIST.SHOW_ALL' | translate" (click)="showAll()">
          <mat-icon>close</mat-icon>
        </button>
      </div>
    }
    @if (rows().length === 0) {
      <mat-card appearance="outlined" class="empty" data-testid="empty-state">
        <mat-icon aria-hidden="true">music_note</mat-icon>
        @if (filterOrgan(); as organ) {
          <p>{{ 'TAPE.LIST.EMPTY_FOR_ORGAN' | translate: {organ: organ.name} }}</p>
        } @else if (organs.entities().length === 0) {
          <p>{{ 'TAPE.LIST.EMPTY_NO_ORGAN' | translate }}</p>
          <a matButton="filled" routerLink="/organs/new" data-testid="empty-new-organ">
            {{ 'TAPE.LIST.DESCRIBE_ORGAN' | translate }}
          </a>
        } @else {
          <p>{{ 'TAPE.LIST.EMPTY' | translate }}</p>
        }
        @if (organs.entities().length > 0 || filterOrgan()) {
          <a matButton="filled" routerLink="/tapes/new" data-testid="new-tape">
            <mat-icon>add</mat-icon>
            {{ 'TAPE.LIST.NEW' | translate }}
          </a>
        }
      </mat-card>
    } @else {
      <mat-card appearance="outlined">
        <table mat-table class="cr-ledger" [dataSource]="rows()" [trackBy]="trackRow">
          <ng-container matColumnDef="tick">
            <th mat-header-cell *matHeaderCellDef>
              <span class="cdk-visually-hidden">{{ 'TAPE.SIDE_BY_SIDE.TITLE' | translate }}</span>
              <mat-checkbox data-testid="tick-all" [checked]="allTicked()" [indeterminate]="someTicked()" (change)="toggleAll()"
                            [aria-label]="'TAPE.LIST.TICK_ALL' | translate"/>
            </th>
            <td mat-cell *matCellDef="let row">
              <mat-checkbox data-testid="tick-tape" [checked]="isTicked(row.tape.id)" [disabled]="row.organ === undefined"
                            (change)="toggleTick(row.tape.id)"
                            (click)="$event.stopPropagation()" [aria-label]="'TAPE.LIST.TICK' | translate: {name: row.tape.name}"/>
            </td>
          </ng-container>
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>{{ 'TAPE.LIST.NAME' | translate }}</th>
            <td mat-cell *matCellDef="let row">
              @if (row.organ === undefined) {
                <span class="name unavailable-name" data-testid="tape-name">{{ row.tape.name }}</span>
              } @else {
                <a class="name" data-testid="open-tape" (click)="$event.stopPropagation()" [routerLink]="['/tapes', row.tape.id]">
                  <span data-testid="tape-name">{{ row.tape.name }}</span>
                </a>
              }
              @if (row.problems > 0) {
                <span class="problems" data-testid="tape-problems">{{ (row.problems === 1 ? 'TAPE.CUTTING_PROBLEMS.COUNT_ONE' : 'TAPE.CUTTING_PROBLEMS.COUNT') | translate: {count: number(row.problems)} }}</span>
              }
            </td>
          </ng-container>
          <ng-container matColumnDef="organ">
            <th mat-header-cell *matHeaderCellDef>{{ 'TAPE.LIST.ORGAN' | translate }}</th>
            <td mat-cell *matCellDef="let row">
              @if (row.organ; as organ) {
                <a [routerLink]="['/organs', organ.id]" data-testid="tape-organ" (click)="$event.stopPropagation()">{{ organ.name }}</a>
              } @else {
                <span data-testid="tape-organ">{{ 'TAPE.LIST.ORGAN_NOT_AVAILABLE' | translate }}</span>
              }
            </td>
          </ng-container>
          <ng-container matColumnDef="columns">
            <th mat-header-cell *matHeaderCellDef>{{ 'TAPE.LIST.COLUMNS' | translate }}</th>
            <td mat-cell *matCellDef="let row"><span data-testid="tape-length-columns">{{ row.columns }}</span></td>
          </ng-container>
          <ng-container matColumnDef="length">
            <th mat-header-cell *matHeaderCellDef>{{ 'TAPE.LIST.LENGTH' | translate }}</th>
            <td mat-cell *matCellDef="let row"><span data-testid="tape-length-mm">{{ 'TAPE.LIST.LENGTH_MM' | translate: {length: row.lengthInMillimetres} }}</span></td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef><span class="cdk-visually-hidden">{{ 'TAPE.LIST.ACTIONS_HEADER' | translate }}</span></th>
            <td mat-cell *matCellDef="let row">
              <button matIconButton type="button" [matMenuTriggerFor]="rowMenu" (click)="$event.stopPropagation()"
                      [attr.aria-label]="'TAPE.LIST.MORE_ACTIONS' | translate: {name: row.tape.name}"
                      [matTooltip]="'TAPE.LIST.MORE_ACTIONS' | translate: {name: row.tape.name}">
                <mat-icon>more_vert</mat-icon>
              </button>
              <mat-menu #rowMenu="matMenu">
                <button mat-menu-item type="button" data-testid="rename-tape" (click)="rename(row.tape)">
                  <mat-icon>edit</mat-icon>
                  <span>{{ 'TAPE.LIST.RENAME' | translate }}</span>
                </button>
                <button mat-menu-item type="button" class="destructive" data-testid="delete-tape" (click)="remove(row.tape)">
                  <mat-icon>delete</mat-icon>
                  <span>{{ 'TAPE.LIST.DELETE' | translate }}</span>
                </button>
              </mat-menu>
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="columnIds"></tr>
          <tr mat-row *matRowDef="let row; columns: columnIds" data-testid="tape"
              [class.unavailable]="row.organ === undefined" (click)="open(row)"></tr>
        </table>
      </mat-card>
    }
  `,
  styles: `
    tr[mat-row] {
      cursor: pointer;
    }

    tr.unavailable {
      cursor: default;
    }

    .name {
      font-family: var(--mat-sys-headline-small-font);
      font-size: 1.125rem;
      font-weight: 600;
    }

    .unavailable-name {
      color: var(--mat-sys-on-surface-variant);
    }

    .problems {
      display: block;
      color: var(--mat-sys-error);
    }

    .filter {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 12px;
      padding: 0 4px 0 12px;
      border: 1px solid var(--cr-paper-edge);
      border-radius: 8px;
    }

    .destructive {
      --mat-menu-item-label-text-color: var(--mat-sys-error);
      --mat-menu-item-icon-color: var(--mat-sys-error);
    }

    .empty {
      align-items: center;
      gap: 12px;
      padding: 32px;
      text-align: center;
    }
  `,
})
export class TapeListComponent {
  private readonly tapes = inject(TapeLibrary);
  protected readonly organs = inject(OrganLibrary);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly language = inject(LanguagePreference).language;
  private readonly organParameter = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(map((parameters) => parameters.get('organ'))),
    {initialValue: null},
  );

  protected readonly columnIds = ['tick', 'name', 'organ', 'columns', 'length', 'actions'];

  /** The Tapes ticked for a side-by-side cut, in the order they were ticked. */
  protected readonly ticked = signal<readonly TapeId[]>([]);

  /** The ticked Tapes the list still shows: a ticked Tape that the Organ filter hides or that is gone is not cut. */
  protected readonly shownTicked = computed<readonly TapeId[]>(() => {
    const shown = new Set(this.rows().map((row) => row.tape.id));
    return this.ticked().filter((id) => shown.has(id));
  });

  /** The Tapes of the list that can be ticked: those whose Organ is available. */
  private readonly tickable = computed<readonly TapeId[]>(() =>
    this.rows().flatMap((row) => (row.organ === undefined ? [] : [row.tape.id])),
  );

  /** Whether every Tape that can be ticked is ticked; false while there is none. */
  protected readonly allTicked = computed(() => {
    const ticked = this.ticked();
    const tickable = this.tickable();
    return tickable.length > 0 && tickable.every((id) => ticked.includes(id));
  });

  /** Whether some, but not all, of the Tapes that can be ticked are ticked: the header tick box then shows indeterminate. */
  protected readonly someTicked = computed(() => {
    const ticked = this.ticked();
    return !this.allTicked() && this.tickable().some((id) => ticked.includes(id));
  });

  /** The Organ named by the `organ` query parameter; `undefined` without it or for an unknown id. */
  protected readonly filterOrgan = computed(() => {
    const id = this.organParameter();
    return this.organs.entities().find((organ) => organ.id === id);
  });

  protected readonly rows = computed<TapeRow[]>(() => {
    const language = this.language();
    const organsById = new Map(this.organs.entities().map((organ) => [organ.id, organ]));
    const filter = this.filterOrgan();
    const rows = this.tapes
      .tapeEntities()
      .filter((tape) => filter === undefined || tape.organId === filter.id)
      .map((tape) => ({
        tape,
        name: tape.name,
        organ: organsById.get(tape.organId),
        problems: problemsOf(tape, organsById.get(tape.organId)),
        columns: formatNumber(tape.length, language),
        lengthInMillimetres: formatNumber(tapeLengthInMillimetres(tape), language),
      }));
    return tapesByOrgan(rows, language);
  });

  protected trackRow(_index: number, row: TapeRow): string {
    return row.tape.id;
  }

  /** A number as text in the language of the app. */
  protected number(value: number): string {
    return formatNumber(value, this.language());
  }

  protected open(row: TapeRow): void {
    if (row.organ !== undefined) void this.router.navigate(['/tapes', row.tape.id]);
  }

  protected isTicked(id: TapeId): boolean {
    return this.ticked().includes(id);
  }

  protected toggleTick(id: TapeId): void {
    this.ticked.update((ids) => (ids.includes(id) ? ids.filter((ticked) => ticked !== id) : [...ids, id]));
  }

  /** Ticks every Tape of the list that can be ticked, or unticks them all when they are all ticked. */
  protected toggleAll(): void {
    const tickable = this.tickable();
    if (this.allTicked()) {
      this.ticked.update((ids) => ids.filter((id) => !tickable.includes(id)));
    } else {
      this.ticked.update((ids) => [...ids, ...tickable.filter((id) => !ids.includes(id))]);
    }
  }

  protected cutSideBySide(): void {
    void this.router.navigate(['/tapes/side-by-side'], {queryParams: laneQueryParams(this.shownTicked())});
  }

  protected showAll(): void {
    void this.router.navigate(['/tapes']);
  }

  protected rename(tape: Tape): void {
    this.dialog
      .open(RenameTapeDialogComponent, {data: {name: tape.name}})
      .afterClosed()
      .subscribe((name: unknown) => {
        if (typeof name === 'string') void this.tapes.rename(tape.id, name);
      });
  }

  protected remove(tape: Tape): void {
    this.dialog
      .open(ConfirmDialogComponent, {data: {action: ConfirmableAction.DELETE, entity: {id: tape.id, name: tape.name}}})
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed === true) void this.tapes.remove(tape.id);
      });
  }
}
