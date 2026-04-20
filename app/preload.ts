// can only import types because they are removed at runtime
import type {CranculaApi} from "@api/index";
import type {Profile} from "@api/model/profile";
// everything else must use require (does not support @-alias)
// noinspection ES6ConvertRequireIntoImport
const {contextBridge, ipcRenderer} = require('electron');
const {apiRoutes} = require("../api/index");

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
