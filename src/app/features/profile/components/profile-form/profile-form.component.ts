import {Component, model, output} from '@angular/core';
import {Field, form} from "@angular/forms/signals";
import {TranslatePipe} from "@ngx-translate/core";
import {Organ} from "@api/model/organ";
import {MatButton} from "@angular/material/button";
import {TextFormFieldComponent} from "@shared/components/text-form-field/text-form-field.component";
import {NotesFormComponent} from "./notes-form/notes-form.component";

@Component({
  selector: 'cranc-profile-form',
  imports: [
    Field,
    TranslatePipe,
    MatButton,
    TextFormFieldComponent,
    TextFormFieldComponent,
    NotesFormComponent
  ],
  template: `
    <form (submit)="submit($event)" class="profile-form">
      <h2>{{ 'PAGES.PROFILE.FORM.TITLE' | translate }}</h2>
      <cranc-text-form-field
        [field]="profileForm"
        label="PAGES.PROFILE.FORM.NAME"
      />
      <cranc-notes-form [field]="profileForm.notes"/>
      <button matButton="filled" type="submit">{{ 'PAGES.PROFILE.FORM.SAVE' | translate }}</button>
    </form>
  `,
  styles: `
    .profile-form {
      display: flex;
      flex-direction: column;
    }
  `,
})
export class ProfileFormComponent {
  profileModel = model.required<Organ>();
  profileForm = form(this.profileModel);
  save = output<Organ>();

  submit($event: SubmitEvent) {
    $event.preventDefault();
    const value = this.profileModel();
    if (value) {
      this.save.emit(value)
    } else {
      console.warn('failed to save empty profile')
    }
  }
}
