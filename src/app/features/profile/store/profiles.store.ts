import {patchState, signalStore, withHooks, withLinkedState, withMethods, withState} from "@ngrx/signals";
import {inject} from "@angular/core";
import {setAllEntities, withEntities} from "@ngrx/signals/entities";
import {tap} from "rxjs";
import {ProfilesService} from "../service/profiles.service";
import {Profile} from "@api/model/profile"

type ProfilesState = {
  isLoading: boolean;
}

const initialState: ProfilesState = {
  isLoading: false
}

export const ProfilesStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withEntities<Profile>(),
  withLinkedState((store) => ({
    selectedProfile: (): Profile => store.entityMap()[0] ?? null,
  })),
  withMethods((store, profilesService = inject(ProfilesService)) => {
      return {
        // profile api
        createProfile: (profile: Profile) => profilesService.createProfile(profile),
        readProfile: (id: string) => profilesService.readProfile(id),
        updateProfile: (profile: Profile) => profilesService.updateProfile(profile),
        deleteProfile: (id: string) => profilesService.deleteProfile(id),
        // profiles api
        createProfiles: (profiles: Profile[]) => profilesService.createProfiles(profiles),
        readProfiles: () => profilesService.readProfiles(),
        updateProfiles: (profiles: Profile[]) => profilesService.updateProfiles(profiles),
        deleteProfiles: (ids: string[]) => profilesService.deleteProfiles(ids),
        // custom store methods
        hasProfile: (profile: Profile) => store.ids().includes(profile.id),
        selectProfile: (profile: Profile) => {
          patchState(store, {selectedProfile: profile})
        },
        setLoading: (isLoading: boolean) => {
          patchState(store, {isLoading})
        }
      };
    }
  ),
  withHooks({
    onInit(store, profilesService = inject(ProfilesService)) {
      store.setLoading(true)
      // load all entities from storage and initialize store with them
      profilesService.readProfiles().pipe(
        tap({
          next: (profiles) => patchState(store, setAllEntities(profiles)),
          error: console.error,
          finalize: () => store.setLoading(false)
        })
      );
    }
  }),
)
