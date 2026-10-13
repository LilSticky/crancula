import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { TranslatePipe, TranslateDirective } from '@ngx-translate/core';

import { FormsModule } from '@angular/forms';
import {ConfirmDialogComponent} from "@shared/components/confirm-dialog/confirm-dialog.component";

@NgModule({
  declarations: [],
  imports: [CommonModule, TranslatePipe, TranslateDirective, FormsModule, ConfirmDialogComponent],
  exports: [TranslatePipe, TranslateDirective, FormsModule, ConfirmDialogComponent]
})
export class SharedModule {}
