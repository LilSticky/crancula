import {Component, inject} from '@angular/core';
import {ProfileFormComponent} from "../../../components/profile-form/profile-form.component";
import {ActivatedRoute, ParamMap} from "@angular/router";
import {map, switchMap} from "rxjs";
import {ProfilesStore} from "../../../store/profiles.store";


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
export class ProfilePage {
  private readonly store = inject(ProfilesStore);
  protected readonly selectedProfile = this.store.selectedProfile;

  private readonly route = inject(ActivatedRoute);
  private readonly profileId$ = this.route.paramMap.pipe(
    map((params: ParamMap): string => params.get("id") ?? ''));
  private readonly profile$ = this.profileId$.pipe(
    switchMap(id => this.store.readProfile(id))
  )

  constructor() {
    this.profile$.subscribe((profile) => {
      if (profile) {
        this.store.selectProfile(profile)
      }
    });
  }
}
