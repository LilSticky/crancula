import {Component, input, output} from '@angular/core';
import {
  MatCell,
  MatCellDef,
  MatColumnDef,
  MatFooterCell,
  MatFooterCellDef,
  MatFooterRow,
  MatFooterRowDef,
  MatHeaderCell,
  MatHeaderCellDef,
  MatHeaderRow,
  MatHeaderRowDef,
  MatRow,
  MatRowDef,
  MatTable
} from "@angular/material/table";
import {Organ} from "@api/model/organ";
import {MatFabButton} from "@angular/material/button";
import {TranslatePipe} from "@ngx-translate/core";
import {MatIcon} from "@angular/material/icon";
import {ORGAN_BASE_PATH} from "../../pages/routes";
import {EntityId} from "@ngrx/signals/entities";

@Component({
  selector: 'cranc-organ-list',
  imports: [
    MatTable,
    MatColumnDef,
    MatHeaderCell,
    MatCell,
    MatHeaderCellDef,
    MatCellDef,
    MatHeaderRow,
    MatRow,
    MatHeaderRowDef,
    MatRowDef,
    TranslatePipe,
    MatFooterRow,
    MatFooterCell,
    MatFooterRowDef,
    MatFooterCellDef,
    MatFabButton,
    MatIcon
  ],
  template: `
    <table mat-table [dataSource]="organs()" class="mat-elevation-z8 organ-table">
      <!-- Name Column -->
      <ng-container matColumnDef="name">
        <th mat-header-cell *matHeaderCellDef>{{ "PAGES.ORGANS.TABLE.NAME" | translate }}</th>
        <td mat-cell *matCellDef="let element">{{ element.name }}</td>
        <td mat-footer-cell *matFooterCellDef>
        </td>
      </ng-container>

      <!-- Pipes Column -->
      <ng-container matColumnDef="pipes">
        <th mat-header-cell *matHeaderCellDef>{{ "PAGES.ORGANS.TABLE.PIPES" | translate }}</th>
        <td mat-cell *matCellDef="let element">{{ element.pipes.length }}</td>
        <td mat-footer-cell *matFooterCellDef>
        </td>
      </ng-container>

      <!-- Edit Column -->
      <ng-container matColumnDef="edit">
        <th mat-header-cell *matHeaderCellDef>{{ "PAGES.ORGANS.TABLE.EDIT" | translate }}</th>
        <td mat-cell *matCellDef="let element">
          <button matFab aria-label="Button with an edit icon">
            <mat-icon>edit</mat-icon>
          </button>
        </td>
        <td mat-footer-cell *matFooterCellDef>
          <button matFab extended (click)="addNewOrgan.emit()" style="margin-top: 10%; margin-bottom: 10%"
                  aria-label="Button with an add icon">
            <mat-icon>add</mat-icon>
            {{ "PAGES.ORGANS.TABLE.NEW" | translate }}
          </button>
        </td>
      </ng-container>

      <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
      <tr
        mat-row
        *matRowDef="let row; columns: displayedColumns;"
        (click)="selectOrgan.emit(row.id)"
      ></tr>
      <tr mat-footer-row *matFooterRowDef="displayedColumns">
      </tr>
    </table>
  `,
  styles: `
    .organ-table {
      width: 100%;
    }

    .mat-mdc-row .mat-mdc-cell {
      border-bottom: 1px solid transparent;
      border-top: 1px solid transparent;
      cursor: pointer;
      padding-top: 20px;
      padding-bottom: 20px;
    }

    .mat-mdc-row:hover .mat-mdc-cell {
      border-color: currentColor;
    }

    .mat-column-name {
      width: auto;
    }

    .mat-column-pipes {
      width: 10%;
    }

    .mat-column-edit {
      width: 10%;
    }
  `,
})
export class OrganListComponent {
  displayedColumns: string[] = ['name', 'pipes', 'edit'];
  readonly organs = input.required<Organ[]>()
  protected readonly basePath = ORGAN_BASE_PATH;
  addNewOrgan = output();
  selectOrgan = output<EntityId>()
}
