// Sandboxed preload (ADR 4): it may only require 'electron'; imports from ../api are type-only.
import {contextBridge, ipcRenderer, type IpcRendererEvent} from 'electron';
import type {
  CranculaApi,
  EditCommand,
  Language,
  OrganLibraryLoadResult,
  OrganLibrarySaveResult,
  OrganLibrarySnapshot,
  SetLanguageResult,
  SvgSaveRequest,
  SvgSaveResult,
  TapeLibraryLoadResult,
  TapeLibrarySaveResult,
  TapeLibrarySnapshot,
} from '../api';
import type {APP_CHANNELS} from './app-ipc';
import type {EDIT_CHANNELS} from './edit-ipc';
import type {ORGAN_LIBRARY_CHANNELS} from './organ-library-ipc';
import type {PLOTTER_CHANNELS} from './plotter-ipc';
import type {TAPE_LIBRARY_CHANNELS} from './tape-library-ipc';

const channels: typeof ORGAN_LIBRARY_CHANNELS = {load: 'organs:load', save: 'organs:save'};
const tapeChannels: typeof TAPE_LIBRARY_CHANNELS = {load: 'tapes:load', save: 'tapes:save'};
const appChannels: typeof APP_CHANNELS = {setLanguage: 'app:set-language'};
const editChannels: typeof EDIT_CHANNELS = {command: 'edit:command'};
const plotterChannels: typeof PLOTTER_CHANNELS = {saveSvg: 'plotter:save-svg'};

// Mirrors isEditCommand in api/app/edit-command.ts; the sandboxed preload cannot import it at runtime.
function isEditCommandPayload(value: unknown): value is EditCommand {
  return value === 'undo' || value === 'redo';
}

const crancula: CranculaApi = {
  organs: {
    load: () => ipcRenderer.invoke(channels.load) as Promise<OrganLibraryLoadResult>,
    save: (snapshot: OrganLibrarySnapshot) => ipcRenderer.invoke(channels.save, snapshot) as Promise<OrganLibrarySaveResult>,
  },
  tapes: {
    load: () => ipcRenderer.invoke(tapeChannels.load) as Promise<TapeLibraryLoadResult>,
    save: (snapshot: TapeLibrarySnapshot) => ipcRenderer.invoke(tapeChannels.save, snapshot) as Promise<TapeLibrarySaveResult>,
  },
  plotter: {
    saveSvg: (request: SvgSaveRequest) => ipcRenderer.invoke(plotterChannels.saveSvg, request) as Promise<SvgSaveResult>,
  },
  app: {
    setLanguage: (language: Language) => ipcRenderer.invoke(appChannels.setLanguage, language) as Promise<SetLanguageResult>,
  },
  edit: {
    onCommand: (listener: (command: EditCommand) => void) => {
      const forward = (_event: IpcRendererEvent, payload: unknown) => {
        if (isEditCommandPayload(payload)) listener(payload);
      };
      ipcRenderer.on(editChannels.command, forward);
      return () => ipcRenderer.removeListener(editChannels.command, forward);
    },
  },
};

contextBridge.exposeInMainWorld('crancula', crancula);
