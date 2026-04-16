import {contextBridge, ipcRenderer} from 'electron';
import {apiRoutes, CranculaApi} from "@api/index";
import {Profile} from "@api/model/profile";

function invoke(route: keyof typeof apiRoutes, args?: any) {
  return ipcRenderer.invoke(apiRoutes[route], args);
}

const api: CranculaApi = {
  // profiles api
  createProfiles: (profiles) => invoke("profiles.create", profiles),
  readProfiles: () => invoke("profiles.read"),
  updateProfiles: (profiles) => invoke("profiles.update", profiles),
  deleteProfiles: (profileIds) => invoke("profiles.delete", profileIds),
  // profile api
  createProfile: (profile) => invoke("profile.create", profile),
  readProfile: (profileId) => invoke("profile.read", profileId),
  updateProfile: (profile) => invoke("profile.update", profile),
  deleteProfile: (profileId: Profile["id"]) => invoke("profile.delete", profileId),
};

contextBridge.exposeInMainWorld('api', api);
