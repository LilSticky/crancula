import {ChangeDetectionStrategy, Component, computed, inject} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {MatButton, MatIconButton} from '@angular/material/button';
import {MatCard} from '@angular/material/card';
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
import {type Organ, type Tape, tapeLengthInMillimetres} from '@api/index';
import {ConfirmableAction, ConfirmDialogComponent} from '../../shared/components/confirm-dialog/confirm-dialog.component';
import {PageHeadComponent} from '../../shared/components/page-head/page-head.component';
import {formatNumber} from '../../shared/format-number';
import {LanguagePreference} from '../../shared/language-preference';
import {tapesByOrgan} from '../../shared/ledger-order';
import {OrganLibrary} from '../../organ/organ-library.store';
import {TapeLibrary} from '../tape-library.store';
import {RenameTapeDialogComponent} from './rename-tape-dialog/rename-tape-dialog.component';

interface TapeRow {
  readonly tape: Tape;
  /** The Tape's name, the sort key within an Organ. */
  readonly name: string;
  /** `undefined` when the Organ is not available. */
  readonly organ: Organ | undefined;
  readonly columns: string;
  readonly lengthInMillimetres: string;
}

@Component({
  selector: 'cranc-tape-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslatePipe, RouterLink, MatButton, MatIconButton, MatIcon, MatCard, MatMenu, MatMenuItem, MatMenuTrigger, MatTooltip,
    MatTable, MatColumnDef, MatHeaderCell, MatHeaderCellDef, MatHeaderRow, MatHeaderRowDef, MatCell, MatCellDef, MatRow, MatRowDef,
    PageHeadComponent,
  ],
  template: `
    <cranc-page-head [title]="'TAPE.LIST.TITLE' | translate" [subtitle]="'TAPE.LIST.SUBTITLE' | translate">
      <ng-container ngProjectAs="[pageHeadActions]">
        @if (rows().length > 0) {
          <a matButton="filled" routerLink="/tapes/new" data-testid="new-tape">
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

  protected readonly columnIds = ['name', 'organ', 'columns', 'length', 'actions'];

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
        columns: formatNumber(tape.length, language),
        lengthInMillimetres: formatNumber(tapeLengthInMillimetres(tape), language),
      }));
    return tapesByOrgan(rows, language);
  });

  protected trackRow(_index: number, row: TapeRow): string {
    return row.tape.id;
  }

  protected open(row: TapeRow): void {
    if (row.organ !== undefined) void this.router.navigate(['/tapes', row.tape.id]);
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
