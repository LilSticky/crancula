import {Component, input} from '@angular/core';
import {RouterLink} from "@angular/router";
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
import {PROFILE_BASE_PATH} from "../../pages/profile-routes";
import {Profile} from "@api/model/profile";
import {MatFabButton} from "@angular/material/button";
import {TranslatePipe} from "@ngx-translate/core";
import {MatIcon} from "@angular/material/icon";

@Component({
  selector: 'cranc-profile-list',
  imports: [
    RouterLink,
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
    <table mat-table [dataSource]="profiles()" class="mat-elevation-z8 profile-table">
      <!-- Name Column -->
      <ng-container matColumnDef="name">
        <th mat-header-cell *matHeaderCellDef>{{ "PAGES.PROFILES.TABLE.NAME" | translate }}</th>
        <td mat-cell *matCellDef="let element">{{ element.name }}</td>
        <td mat-footer-cell *matFooterCellDef>
        </td>
      </ng-container>

      <!-- Notes Column -->
      <ng-container matColumnDef="notes">
        <th mat-header-cell *matHeaderCellDef>{{ "PAGES.PROFILES.TABLE.NOTES" | translate }}</th>
        <td mat-cell *matCellDef="let element">{{ element.notes.length }}</td>
        <td mat-footer-cell *matFooterCellDef>
        </td>
      </ng-container>

      <!-- Edit Column -->
      <ng-container matColumnDef="edit">
        <th mat-header-cell *matHeaderCellDef>{{ "PAGES.PROFILES.TABLE.EDIT" | translate }}</th>
        <td mat-cell *matCellDef="let element">
          <button matFab [routerLink]="['/', basePath, element.id]" aria-label="Button with a delete icon">
            <mat-icon>edit</mat-icon>
          </button>
        </td>
        <td mat-footer-cell *matFooterCellDef>
          <button matFab extended [routerLink]="['/', basePath, 'new']" style="margin-top: 10%; margin-bottom: 10%">
            <mat-icon>add</mat-icon>
            {{ "PAGES.PROFILES.TABLE.NEW" | translate }}
          </button>
        </td>
      </ng-container>

      <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
      <tr
        mat-row
        *matRowDef="let row; columns: displayedColumns;"
        [routerLink]="[basePath, row.id]"
      ></tr>
      <tr mat-footer-row *matFooterRowDef="displayedColumns">
      </tr>
    </table>
  `,
  styles: `
    .profile-table {
      width: 100%;
    }

    .mat-mdc-row .mat-mdc-cell {
      border-bottom: 1px solid transparent;
      border-top: 1px solid transparent;
      cursor: pointer;
    }

    .mat-mdc-row:hover .mat-mdc-cell {
      border-color: currentColor;
    }

    .mat-column-name {
      width: auto;
    }

    .mat-column-notes {
      width: 10%;
    }

    .mat-column-edit {
      width: 10%;
    }
  `,
})
export class ProfileListComponent {
  displayedColumns: string[] = ['name', 'notes', 'edit'];
  readonly profiles = input.required<Profile[]>()
  protected readonly basePath = PROFILE_BASE_PATH;
}
