// Sandboxed preload (ADR 4): it may only require 'electron'; imports from ../api are type-only.
import {contextBridge, ipcRenderer} from 'electron';
import type {
  CranculaApi,
  Language,
  OrganLibraryLoadResult,
  OrganLibrarySaveResult,
  OrganLibrarySnapshot,
  SetLanguageResult,
  TapeLibraryLoadResult,
  TapeLibrarySaveResult,
  TapeLibrarySnapshot,
} from '../api';
import type {APP_CHANNELS} from './app-ipc';
import type {ORGAN_LIBRARY_CHANNELS} from './organ-library-ipc';
import type {TAPE_LIBRARY_CHANNELS} from './tape-library-ipc';

const channels: typeof ORGAN_LIBRARY_CHANNELS = {load: 'organs:load', save: 'organs:save'};
const tapeChannels: typeof TAPE_LIBRARY_CHANNELS = {load: 'tapes:load', save: 'tapes:save'};
const appChannels: typeof APP_CHANNELS = {setLanguage: 'app:set-language'};

const crancula: CranculaApi = {
  organs: {
    load: () => ipcRenderer.invoke(channels.load) as Promise<OrganLibraryLoadResult>,
    save: (snapshot: OrganLibrarySnapshot) => ipcRenderer.invoke(channels.save, snapshot) as Promise<OrganLibrarySaveResult>,
  },
  tapes: {
    load: () => ipcRenderer.invoke(tapeChannels.load) as Promise<TapeLibraryLoadResult>,
    save: (snapshot: TapeLibrarySnapshot) => ipcRenderer.invoke(tapeChannels.save, snapshot) as Promise<TapeLibrarySaveResult>,
  },
  app: {
    setLanguage: (language: Language) => ipcRenderer.invoke(appChannels.setLanguage, language) as Promise<SetLanguageResult>,
  },
};

contextBridge.exposeInMainWorld('crancula', crancula);
