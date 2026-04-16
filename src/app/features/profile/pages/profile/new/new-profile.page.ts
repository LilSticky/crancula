import {Component, inject} from '@angular/core';
import {ProfileFormComponent} from "../../../components/profile-form/profile-form.component";
import {ProfilesStore} from "../../../store/profiles.store";
import {newProfile} from "@api/model/profile";


@Component({
  selector: 'cranc-profile-page',
  imports: [
    ProfileFormComponent
  ],
  template: `
    <cranc-profile-form
      [profileModel]="selectedProfile()"
    />
  `,
  styles: ``,
})
export class NewProfilePage {
  private readonly store = inject(ProfilesStore);
  protected readonly selectedProfile = this.store.selectedProfile;

  constructor() {
    this.store.selectProfile(newProfile());
  }
}
