import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { TranslateModule } from '@ngx-translate/core';

import { FormsModule } from '@angular/forms';
import {ConfirmDialogComponent} from "@shared/components/confirm-dialog/confirm-dialog.component";

@NgModule({
  declarations: [],
  imports: [CommonModule, TranslateModule, FormsModule, ConfirmDialogComponent],
  exports: [TranslateModule, FormsModule, ConfirmDialogComponent]
})
export class SharedModule {}
