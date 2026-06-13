import {Component, model, output} from '@angular/core';
import {TextFormFieldComponent} from "@shared/components/text-form-field/text-form-field.component";
import {NumberFormFieldComponent} from "@shared/components/number-form-field/number-form-field.component";
import {FormValueControl} from "@angular/forms/signals";
import {Pipe} from "@api/model/pipe";
import {TranslatePipe} from "@ngx-translate/core";
import {MatIconButton} from "@angular/material/button";
import {MatIcon} from "@angular/material/icon";

@Component({
  selector: 'cranc-pipes-form',
  imports: [
    TextFormFieldComponent,
    NumberFormFieldComponent,
    TranslatePipe,
    MatIcon,
    MatIconButton,

  ],
  template: `
    <div class="pipe-form-list cranc-form-section">
      <h3>{{ 'PAGES.ORGAN.FORM.PIPE_SETTINGS' | translate }}</h3>
      @for (pipe of value(); track $index) {
        <div class="pipes-form-row">
          <cranc-text-form-field
            [(value)]="pipe.name"
            label="PAGES.ORGAN.FORM.PIPE_NAME"
            class="column"
          />
          <cranc-number-form-field
            [(value)]="pipe.pitch"
            label="PAGES.ORGAN.FORM.PIPE_PITCH"
            class="column"
          />
          <button matIconButton (click)="onDelete(pipe)">
            <mat-icon>delete</mat-icon>
          </button>
        </div>
      }
    </div>
  `,
})
export class PipesFormComponent implements FormValueControl<Pipe[]> {
  value = model<Pipe[]>([]);

  deletePipe = output<Pipe>();

  protected onDelete(pipe: Pipe) {
    this.deletePipe.emit(pipe)
  }
}
