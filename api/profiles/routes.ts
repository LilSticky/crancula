import {Profile} from "../../api/model/profile";


export const profilesRoutes = {
  'profiles.read': '(STORAGE):[PROFILES]:READ',
  'profiles.create': '(STORAGE):[PROFILES]:CREATE',
  'profiles.update': '(STORAGE):[PROFILES]:UPDATE',
  'profiles.delete': '(STORAGE):[PROFILES]:DELETE',
}

export interface ProfilesApi {
  readProfiles(): Promise<Profile[]>;

  createProfiles(profiles: Profile[]): Promise<number>;

  updateProfiles(profiles: Profile[]): Promise<number>;

  deleteProfiles(profileIds: Profile["id"][]): Promise<number>;
}
