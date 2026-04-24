// noinspection ES6PreferShortImport
// noinspection ES6ConvertRequireIntoImport

// can only import types because they are removed at runtime
import type {DataStore} from "../api/index"
import type {Organ} from "@api/model/organ";
// everything else must use require (does not support @-alias)
const {contextBridge, ipcRenderer} = require('electron');
const {Channel} = require("../api/channel");

const db: DataStore<Organ> = {
  set: async (profiles: Organ[]): Promise<void> => ipcRenderer.invoke(Channel.SET_PROFILES, profiles),
  get: async (): Promise<Organ[]> => ipcRenderer.invoke(Channel.GET_PROFILES)
};

contextBridge.exposeInMainWorld('db', db);
