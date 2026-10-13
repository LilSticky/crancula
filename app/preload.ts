// Sandboxed preload (ADR 4): it may only require 'electron'; imports from ../api are type-only.
import {contextBridge, ipcRenderer} from 'electron';
import type {CranculaApi, OrganLibraryLoadResult, OrganLibrarySaveResult, OrganLibrarySnapshot} from '../api';
import type {ORGAN_LIBRARY_CHANNELS} from './organ-library-ipc';

const channels: typeof ORGAN_LIBRARY_CHANNELS = {load: 'organs:load', save: 'organs:save'};

const crancula: CranculaApi = {
  organs: {
    load: () => ipcRenderer.invoke(channels.load) as Promise<OrganLibraryLoadResult>,
    save: (snapshot: OrganLibrarySnapshot) => ipcRenderer.invoke(channels.save, snapshot) as Promise<OrganLibrarySaveResult>,
  },
};

contextBridge.exposeInMainWorld('crancula', crancula);
