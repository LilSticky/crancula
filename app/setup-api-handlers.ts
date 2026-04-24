// noinspection ES6PreferShortImport

import {ipcMain} from "electron";
import {Organ} from "@api/model/organ";

import {Channel} from "@api/channel";
import {FileStorage} from "./storage";

const profilesStorage: FileStorage<Organ> = new FileStorage<Organ>('profiles')

export function setupApiHandlers() {
  ipcMain.handle(Channel.GET_PROFILES, profilesStorage.handleGet)
  ipcMain.handle(Channel.SET_PROFILES, profilesStorage.handleSet)
}
