import {Component, inject} from '@angular/core';
import {ProfileFormComponent} from "../../../components/profile-form/profile-form.component";
import {ActivatedRoute, Params} from "@angular/router";
import {map} from "rxjs";
import {ProfilesStore} from "../../../store/profiles.store";
import {TranslatePipe} from "@ngx-translate/core";

const getId = (params: Params): string => (params["id"] || '') as string;

@Component({
  selector: 'cranc-profile-page',
  imports: [
    ProfileFormComponent,
    TranslatePipe
  ],
  template: `
    @let selected = store.selectedProfile();
    @if (selected) {
      <cranc-profile-form
        [profileModel]="selected"
      />
    } @else if (store.isLoading()) {
      {{ 'PAGES.PROFILE.FORM.LOADING' | translate }}
    } @else {
      {{ 'PAGES.PROFILE.FORM.ERROR.NO_PROFILE_SELECTED' | translate }}
    }
  `,
  styles: ``,
})
export class ProfilePage {
  protected readonly store = inject(ProfilesStore);

  private readonly route = inject(ActivatedRoute);

  constructor() {
    // keep updating the selected profile id of the store with the profile id of the route
    this.route.params.pipe(map(getId)).subscribe(this.store.selectProfile);
  }
}
