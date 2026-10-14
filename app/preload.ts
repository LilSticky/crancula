// Sandboxed preload (ADR 4): it may only require 'electron'; imports from ../api are type-only.
import {contextBridge, ipcRenderer} from 'electron';
import type {CranculaApi, Language, OrganLibraryLoadResult, OrganLibrarySaveResult, OrganLibrarySnapshot, SetLanguageResult} from '../api';
import type {APP_CHANNELS} from './app-ipc';
import type {ORGAN_LIBRARY_CHANNELS} from './organ-library-ipc';

const channels: typeof ORGAN_LIBRARY_CHANNELS = {load: 'organs:load', save: 'organs:save'};
const appChannels: typeof APP_CHANNELS = {setLanguage: 'app:set-language'};

const crancula: CranculaApi = {
  organs: {
    load: () => ipcRenderer.invoke(channels.load) as Promise<OrganLibraryLoadResult>,
    save: (snapshot: OrganLibrarySnapshot) => ipcRenderer.invoke(channels.save, snapshot) as Promise<OrganLibrarySaveResult>,
  },
  app: {
    setLanguage: (language: Language) => ipcRenderer.invoke(appChannels.setLanguage, language) as Promise<SetLanguageResult>,
  },
};

contextBridge.exposeInMainWorld('crancula', crancula);
