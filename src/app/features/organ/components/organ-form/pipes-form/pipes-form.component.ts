import {Component, model} from '@angular/core';
import {TextFormFieldComponent} from "@shared/components/text-form-field/text-form-field.component";
import {NumberFormFieldComponent} from "@shared/components/number-form-field/number-form-field.component";
import {Field, FormValueControl} from "@angular/forms/signals";
import {MatDivider, MatList, MatListItem} from "@angular/material/list";
import {MatFabButton} from "@angular/material/button";
import {MatIcon} from "@angular/material/icon";
import {TranslatePipe} from "@ngx-translate/core";
import {Pipe} from "@api/model/pipe";

@Component({
  selector: 'cranc-pipes-form',
  imports: [
    TextFormFieldComponent,
    Field,
    NumberFormFieldComponent,
    MatList,
    MatDivider,
    MatListItem,
    MatFabButton,
    MatIcon,
    TranslatePipe,
  ],
  template: `
    <mat-list>
      @for (pipe of value(); track $index) {
        <mat-list-item class="pipes-form-row">
          <cranc-text-form-field
            [field]="pipe.name"
            label="PAGES.ORGAN.FORM.PIPE_NAME"
          />
          <cranc-number-form-field
            [field]="pipe.pitch"
            label="PAGES.ORGAN.FORM.PIPE_PITCH"
          />
        </mat-list-item>
        <mat-divider></mat-divider>
      }
      <mat-list-item class="pipes-form-row">
        <button matFab extended (click)="addPipe()" style="margin: 10px">
          <mat-icon>add</mat-icon>
          {{ 'PAGES.ORGAN.FORM.NEW_PIPE' | translate }}
        </button>
      </mat-list-item>
    </mat-list>
  `,
  styles: `
    .pipes-form-row {
      display: flex;
      flex-direction: row;
    }
  `,
})
export class PipesFormComponent implements FormValueControl<Pipe[]> {
  value = model<Pipe[]>([]);

  addPipe() {
    this.value.update(arr => [...arr, new Pipe()])
  }
}
