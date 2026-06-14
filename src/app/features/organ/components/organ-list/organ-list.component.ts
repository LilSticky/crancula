import {Component, inject, input, output} from '@angular/core';
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
import {EntityId} from "@ngrx/signals/entities";
import {MatDialog, MatDialogConfig} from "@angular/material/dialog";
import {ConfirmDialogComponent} from "@shared/components/confirm-dialog/confirm-dialog.component";

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
    MatIcon,
  ],
  templateUrl: './organ-list.component.html',
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
  `,
})
export class OrganListComponent {
  displayedColumns: string[] = ['name', 'pipes', 'tapeWidth', 'holeDiameter', 'edit', 'delete'];
  readonly organs = input.required<Organ[]>()
  addNewOrgan = output();
  editOrgan = output<EntityId>()
  deleteOrgan = output<EntityId>()
  dialog = inject(MatDialog);

  onDelete(organ: Organ): void {
    const config = new MatDialogConfig()
    config.disableClose = false
    config.data = {
      action: 'DELETE',
      entity: organ
    }
    const dialogRef = this.dialog.open(ConfirmDialogComponent, config);
    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.deleteOrgan.emit(organ.id);
      }
    });
  }
}
