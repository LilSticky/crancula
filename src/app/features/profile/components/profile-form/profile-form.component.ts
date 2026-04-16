import {Component, model, output} from '@angular/core';
import {Field, form} from "@angular/forms/signals";
import {TranslatePipe} from "@ngx-translate/core";
import {Profile} from "@api/model/profile";

@Component({
  selector: 'cranc-profile-form',
  imports: [
    Field,
    TranslatePipe
  ],
  template: `
    <form (submit)="submit()">
      <h2>{{ 'PROFILE.FORM.TITLE' | translate }}</h2>
      <div>
        <label for="profile-form-name-input">{{ 'PROFILE.FORM.NAME_LABEL' | translate }}</label>
        <input id="profile-form-name-input" [field]="profileForm()">
      </div>
      <button type="submit"><div>{{ 'PROFILE.FORM.SAVE' | translate }}</div></button>
    </form>
  `,
  styles: '',
})
export class ProfileFormComponent {
  profileModel = model<Profile>();
  profileForm = form(this.profileModel);
  save = output<Profile>();

  submit() {
    const value = this.profileModel();
    if (value) {
      this.save.emit(value)
    } else {
      console.warn('failed to save empty profile')
    }
  }
}
