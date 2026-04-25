// noinspection ES6PreferShortImport
// noinspection ES6ConvertRequireIntoImport

// can only import types because they are removed at runtime
import type {Organ} from "../api/model/organ";
import {DataStore} from "../api/index";
import {Bridge} from "./bridge";
// everything else must use require (does not support @-alias)
const {contextBridge, ipcRenderer} = require('electron');
const {Channel} = require("../api/channel");

const organs: DataStore<Organ> = {
  set: async (organs: Organ[]): Promise<void> => ipcRenderer.invoke(Channel.SET_ORGANS, organs),
  get: async (): Promise<Organ[]> => ipcRenderer.invoke(Channel.GET_ORGANS)
};

const bridge: Bridge = {organs};
contextBridge.exposeInMainWorld('bridge', bridge);
