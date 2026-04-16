import {Component, input} from '@angular/core';
import {RouterLink} from "@angular/router";
import {
  MatCell,
  MatCellDef,
  MatColumnDef,
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
    MatRowDef
  ],
  template: `
    <table mat-table [dataSource]="profiles()" class="mat-elevation-z8 profile-table">
      <!-- Name Column -->
      <ng-container matColumnDef="name">
        <th mat-header-cell *matHeaderCellDef>Name</th>
        <td mat-cell *matCellDef="let element">{{ element.name }}</td>
      </ng-container>

      <!-- Notes Column -->
      <ng-container matColumnDef="notes">
        <th mat-header-cell *matHeaderCellDef>Notes</th>
        <td mat-cell *matCellDef="let element">{{ element.notes.length }}</td>
      </ng-container>

      <!-- Edit Column -->
      <ng-container matColumnDef="edit">
        <th mat-header-cell *matHeaderCellDef>Edit</th>
        <td mat-cell *matCellDef="let element">🔍</td>
      </ng-container>

      <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
      <tr
        mat-row
        *matRowDef="let row; columns: displayedColumns;"
        [routerLink]="[basePath, row.id]"
      ></tr>
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
  `,
})
export class ProfileListComponent {
  displayedColumns: string[] = ['name', 'notes', 'edit'];
  readonly profiles = input.required<Profile[]>()
  protected readonly basePath = '/' + PROFILE_BASE_PATH;
}
