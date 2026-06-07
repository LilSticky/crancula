import {Component, model} from '@angular/core';
import {TextFormFieldComponent} from "@shared/components/text-form-field/text-form-field.component";
import {NumberFormFieldComponent} from "@shared/components/number-form-field/number-form-field.component";
import {FormValueControl} from "@angular/forms/signals";
import {MatFabButton} from "@angular/material/button";
import {MatIcon} from "@angular/material/icon";
import {TranslatePipe} from "@ngx-translate/core";
import {Pipe} from "@api/model/pipe";

@Component({
  selector: 'cranc-pipes-form',
  imports: [
    TextFormFieldComponent,
    NumberFormFieldComponent,
    MatFabButton,
    MatIcon,
    TranslatePipe,
  ],
  template: `
    <div class="pipe-form-list">
      @for (pipe of value(); track $index) {
        <div class="pipes-form-row">
          <cranc-text-form-field
            [(value)]="pipe.name"
            label="PAGES.ORGAN.FORM.PIPE_NAME"
          />
          <cranc-number-form-field
            [(value)]="pipe.pitch"
            label="PAGES.ORGAN.FORM.PIPE_PITCH"
            class="padding-lt"
          />
        </div>
      }
      <div class="pipes-form-row">
        <button type="button" matFab extended (click)="addPipe()" style="margin: 10px">
          <mat-icon>add</mat-icon>
          {{ 'PAGES.ORGAN.FORM.NEW_PIPE' | translate }}
        </button>
      </div>
    </div>
  `,
  styles: `
    .padding-lt {
      padding-top: 20px;
      padding-left: 20px;
    }
  `,
})
export class PipesFormComponent implements FormValueControl<Pipe[]> {
  value = model<Pipe[]>([]);

  addPipe() {
    this.value.update(arr => [...arr, new Pipe()])
  }
}
