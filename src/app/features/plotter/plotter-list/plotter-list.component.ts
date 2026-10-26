import {ChangeDetectionStrategy, Component, computed, inject} from '@angular/core';
import {MatButton} from '@angular/material/button';
import {MatCard} from '@angular/material/card';
import {MatIcon} from '@angular/material/icon';
import {
  MatCell, MatCellDef, MatColumnDef, MatHeaderCell, MatHeaderCellDef, MatHeaderRow, MatHeaderRowDef, MatRow, MatRowDef, MatTable,
} from '@angular/material/table';
import {Router, RouterLink} from '@angular/router';
import {TranslatePipe} from '@ngx-translate/core';
import type {Plotter, PlotterId} from '@api/index';
import {PageHeadComponent} from '../../shared/components/page-head/page-head.component';
import {formatNumber} from '../../shared/format-number';
import {LanguagePreference} from '../../shared/language-preference';
import {byName} from '../../shared/ledger-order';
import type {TranslatableText} from '../../shared/leave-unsaved/leave-unsaved.guard';
import {PlotterLibrary} from '../plotter-library.store';

interface PlotterRow {
  readonly plotter: Plotter;
  readonly workingArea: TranslatableText;
  /** `null` for a roll Plotter, which has no Overlap. */
  readonly overlap: TranslatableText | null;
}

@Component({
  selector: 'cranc-plotter-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, RouterLink, MatButton, MatIcon, MatCard, MatTable, MatColumnDef, MatHeaderCell, MatHeaderCellDef,
    MatHeaderRow, MatHeaderRowDef, MatCell, MatCellDef, MatRow, MatRowDef, PageHeadComponent],
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
              }
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
  private readonly language = inject(LanguagePreference).language;

  protected readonly columns = ['name', 'workingArea', 'overlap'];

  protected readonly rows = computed<PlotterRow[]>(() => {
    const language = this.language();
    return byName(this.library.entities(), language).map((plotter): PlotterRow => {
      const width = formatNumber(plotter.workingWidth, language);
      if (plotter.roll) {
        return {plotter, workingArea: {key: 'PLOTTER.LIST.ROLL_WIDTH', params: {width}}, overlap: null};
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
}
