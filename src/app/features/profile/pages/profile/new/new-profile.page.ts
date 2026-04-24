import {Component, inject} from '@angular/core';
import {ProfileFormComponent} from "../../../components/profile-form/profile-form.component";
import {ProfilesStore} from "../../../store/profiles.store";
import {Organ} from "@api/model/organ";


@Component({
  selector: 'cranc-profile-page',
  imports: [
    ProfileFormComponent
  ],
  template: `
    <cranc-profile-form
      [profileModel]="selectedProfile"
    />
  `,
  styles: ``,
})
export class NewProfilePage {
  private readonly store = inject(ProfilesStore);
  protected readonly selectedProfile: Organ;

  constructor() {
    const profile: Organ = this.store.newProfile();
    this.selectedProfile = profile;
    this.store.selectProfile(profile.id)
  }
}
