import {Component, model, output} from '@angular/core';
import {Field, form} from "@angular/forms/signals";
import {TranslatePipe} from "@ngx-translate/core";
import {Organ} from "@api/model/organ";
import {MatButton} from "@angular/material/button";
import {PipesFormComponent} from "./pipes-form/pipes-form.component";
import {TextFormFieldComponent} from "@shared/components/text-form-field/text-form-field.component";

@Component({
  selector: 'cranc-organ-form',
  imports: [
    TranslatePipe,
    MatButton,
    PipesFormComponent,
    TextFormFieldComponent,
    Field,
  ],
  template: `
    <form (submit)="submit($event)" class="organ-form">
      <h2>{{ 'PAGES.ORGAN.FORM.TITLE' | translate }}</h2>
      <cranc-text-form-field
        [field]="organForm.name"
        label="PAGES.ORGAN.FORM.NAME"
        class="name-input"
      />
      <cranc-pipes-form [field]="organForm.pipes"/>
      <button matButton="filled" type="submit">{{ 'PAGES.ORGAN.FORM.SAVE' | translate }}</button>
    </form>
  `,
  styles: `
    .organ-form {
      display: flex;
      flex-direction: column;
    }
  `,
})
export class OrganFormComponent {
  organModel = model.required<Organ>();
  organForm = form(this.organModel);
  save = output<Organ>();

  submit($event: SubmitEvent) {
    $event.preventDefault();
    const value = this.organModel();
    console.debug("save organ", value)
    if (value) {
      this.save.emit(value)
    } else {
      console.warn('failed to save empty organ')
    }
  }
}
