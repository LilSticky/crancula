import {inject, InjectionToken} from "@angular/core";
import {ElectronService} from "../electron/electron.service";
import {PersistenceBridge} from "../persistence-bridge";
import {ElectronStorageService} from "./electron-storage/electron-storage.service";
import {LocalStorageService} from "./local-storage/local-storage.service";

export const StorageService = new InjectionToken('persistence-bridge', {
  providedIn: "root",
  factory: (
    electron: ElectronService = inject(ElectronService),
    es: ElectronStorageService = inject(ElectronStorageService),
    ls: LocalStorageService = inject(LocalStorageService),
    isElectron: boolean = electron.isElectron
  ): PersistenceBridge => isElectron ? es : ls
})
