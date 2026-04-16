// constructor
import {ipcMain} from "electron";
import {apiRoutes} from "../../api/index";
import {Profile} from "../../api/model/profile";
import {FileStorage} from "../storage";

export function setupApiHandlers(
  profilesStorage: FileStorage<Profile> = new FileStorage<Profile>('profiles')
) {
  // profile
  ipcMain.handle(apiRoutes["profile.create"], (_, profile: Profile) => profilesStorage.create(profile))
  ipcMain.handle(apiRoutes["profile.read"], (_, id: string) => profilesStorage.getById(id));
  ipcMain.handle(apiRoutes["profile.update"], (_, profile: Profile) => profilesStorage.update(profile.id, profile));
  ipcMain.handle(apiRoutes["profile.delete"], (_, id: string) => profilesStorage.delete(id));
  // profiles
  ipcMain.handle(apiRoutes["profiles.create"], (_, profiles: Profile[]) => profiles.forEach((profile) => profilesStorage.create(profile)));
  ipcMain.handle(apiRoutes["profiles.read"], (_) => profilesStorage.getAll());
  ipcMain.handle(apiRoutes["profiles.update"], (_, profiles: Profile[]) => profiles.forEach((profile) => profilesStorage.update(profile.id, profile)));
  ipcMain.handle(apiRoutes["profiles.delete"], (_, ids: string[]) => ids.forEach((id) => profilesStorage.delete(id)));
}
