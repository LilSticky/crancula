// noinspection ES6PreferShortImport

import {Profile} from "../../api/model/profile";

export const profileRoutes = {
  'profile.read': '(STORAGE):[PROFILE]:READ',
  'profile.create': '(STORAGE):[PROFILE]:CREATE',
  'profile.update': '(STORAGE):[PROFILE]:UPDATE',
  'profile.delete': '(STORAGE):[PROFILE]:DELETE',
}

export interface ProfileApi {
  readProfile(profileId: Profile["id"]): Promise<Profile>;

  createProfile(profile: Profile): Promise<boolean>;

  updateProfile(profile: Profile): Promise<boolean>;

  deleteProfile(profileId: Profile["id"]): Promise<boolean>;
}
