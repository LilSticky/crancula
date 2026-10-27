import {ChangeDetectionStrategy, Component, computed, inject} from '@angular/core';
import {MatButton, MatIconButton} from '@angular/material/button';
import {MatCard} from '@angular/material/card';
import {MatDialog} from '@angular/material/dialog';
import {MatIcon} from '@angular/material/icon';
import {MatMenu, MatMenuItem, MatMenuTrigger} from '@angular/material/menu';
import {
  MatCell, MatCellDef, MatColumnDef, MatHeaderCell, MatHeaderCellDef, MatHeaderRow, MatHeaderRowDef, MatRow, MatRowDef, MatTable,
} from '@angular/material/table';
import {MatTooltip} from '@angular/material/tooltip';
import {Router, RouterLink} from '@angular/router';
import {TranslatePipe} from '@ngx-translate/core';
import type {Plotter, PlotterId} from '@api/index';
import {ConfirmableAction, ConfirmDialogComponent} from '../../shared/components/confirm-dialog/confirm-dialog.component';
import {PageHeadComponent} from '../../shared/components/page-head/page-head.component';
import {formatNumber} from '../../shared/format-number';
import {LanguagePreference} from '../../shared/language-preference';
import {byName} from '../../shared/ledger-order';
import type {TranslatableText} from '../../shared/leave-unsaved/leave-unsaved.guard';
import {PlotterLibrary} from '../plotter-library.store';

interface PlotterRow {
  readonly plotter: Plotter;
  readonly workingArea: TranslatableText;
  /** `null` for a roll plotter, which has no Overlap. */
  readonly overlap: TranslatableText | null;
}

@Component({
  selector: 'cranc-plotter-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, RouterLink, MatButton, MatIconButton, MatIcon, MatCard, MatMenu, MatMenuItem, MatMenuTrigger, MatTooltip,
    MatTable, MatColumnDef, MatHeaderCell, MatHeaderCellDef, MatHeaderRow, MatHeaderRowDef, MatCell, MatCellDef, MatRow, MatRowDef, PageHeadComponent],
  template: `
    <cranc-page-head [title]="'PLOTTER.LIST.TITLE' | translate" [subtitle]="'PLOTTER.LIST.SUBTITLE' | translate">
      <ng-container ngProjectAs="[pageHeadActions]">
        @if (rows().length > 0) {
          <a matButton="filled" routerLink="/plotters/new" data-testid="new-plotter">
            <mat-icon>add</mat-icon>
            {{ 'PLOTTER.LIST.NEW' | translate }}
          </a>
        }
      </ng-container>
    </cranc-page-head>
    @if (rows().length === 0) {
      <mat-card appearance="outlined" class="empty" data-testid="plotter-list-empty">
        <mat-icon aria-hidden="true">content_cut</mat-icon>
        <p>{{ 'PLOTTER.LIST.EMPTY' | translate }}</p>
        <a matButton="filled" routerLink="/plotters/new" data-testid="new-plotter">
          <mat-icon>add</mat-icon>
          {{ 'PLOTTER.LIST.NEW' | translate }}
        </a>
      </mat-card>
    } @else {
      <mat-card appearance="outlined">
        <table mat-table class="cr-ledger" [dataSource]="rows()" [trackBy]="trackRow">
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>{{ 'PLOTTER.LIST.NAME' | translate }}</th>
            <td mat-cell *matCellDef="let row">
              <a class="name" [routerLink]="['/plotters', row.plotter.id]" data-testid="plotter" (click)="$event.stopPropagation()">{{ row.plotter.name }}</a>
            </td>
          </ng-container>
          <ng-container matColumnDef="workingArea">
            <th mat-header-cell *matHeaderCellDef>{{ 'PLOTTER.LIST.WORKING_AREA' | translate }}</th>
            <td mat-cell *matCellDef="let row">{{ row.workingArea.key | translate: row.workingArea.params }}</td>
          </ng-container>
          <ng-container matColumnDef="overlap">
            <th mat-header-cell *matHeaderCellDef>{{ 'PLOTTER.LIST.OVERLAP' | translate }}</th>
            <td mat-cell *matCellDef="let row">
              @if (row.overlap; as overlap) {
                {{ overlap.key | translate: overlap.params }}
              } @else {
                —
              }
            </td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let row">
              <button matIconButton type="button" [matMenuTriggerFor]="rowMenu" (click)="$event.stopPropagation()"
                      [attr.aria-label]="'PLOTTER.LIST.MORE_ACTIONS' | translate: {name: row.plotter.name}"
                      [matTooltip]="'PLOTTER.LIST.MORE_ACTIONS' | translate: {name: row.plotter.name}">
                <mat-icon>more_vert</mat-icon>
              </button>
              <mat-menu #rowMenu="matMenu">
                <button mat-menu-item type="button" class="destructive" data-testid="remove-plotter" (click)="remove(row.plotter)">
                  <mat-icon>delete</mat-icon>
                  <span>{{ 'PLOTTER.REMOVE.ACTION' | translate }}</span>
                </button>
              </mat-menu>
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns" data-testid="plotter-row" (click)="open(row.plotter.id)"></tr>
        </table>
      </mat-card>
    }
  `,
  styles: `
    tr[mat-row] {
      cursor: pointer;
    }

    .destructive {
      --mat-menu-item-label-text-color: var(--mat-sys-error);
      --mat-menu-item-icon-color: var(--mat-sys-error);
    }

    .name {
      font-family: var(--mat-sys-headline-small-font);
      font-size: 1.125rem;
      font-weight: 600;
    }

    .empty {
      align-items: center;
      gap: 12px;
      padding: 32px;
      text-align: center;
    }
  `,
})
export class PlotterListComponent {
  private readonly library = inject(PlotterLibrary);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly language = inject(LanguagePreference).language;

  protected readonly columns = ['name', 'workingArea', 'overlap', 'actions'];

  protected readonly rows = computed<PlotterRow[]>(() => {
    const language = this.language();
    return byName(this.library.entities(), language).map((plotter): PlotterRow => {
      const width = formatNumber(plotter.workingWidth, language);
      if (plotter.roll) {
        const spacing = formatNumber(plotter.tapeSpacing, language);
        return {plotter, workingArea: {key: 'PLOTTER.LIST.ROLL_TAPE_SPACING', params: {width, spacing}}, overlap: null};
      }
      return {
        plotter,
        workingArea: {key: 'PLOTTER.LIST.WORKING_AREA_VALUE', params: {length: formatNumber(plotter.workingLength, language), width}},
        overlap: {key: 'PLOTTER.LIST.OVERLAP_VALUE', params: {overlap: formatNumber(plotter.overlap, language)}},
      };
    });
  });

  protected trackRow(_index: number, row: PlotterRow): PlotterId {
    return row.plotter.id;
  }

  protected open(id: PlotterId): void {
    void this.router.navigate(['/plotters', id]);
  }

  /** Removes the Plotter once the user confirms; no Tape or Organ is written. */
  protected remove(plotter: Plotter): void {
    this.dialog
      .open(ConfirmDialogComponent, {data: {action: ConfirmableAction.DELETE, entity: {id: plotter.id, name: plotter.name}}})
      .afterClosed()
      .subscribe((confirmed: boolean | undefined) => {
        if (confirmed === true) void this.library.remove(plotter.id);
      });
  }
}
