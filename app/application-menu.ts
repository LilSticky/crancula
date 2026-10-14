import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import type {MenuItemConstructorOptions} from 'electron';
import type {Language} from '../api';

const ENGLISH_LABELS = {
  APP: 'Crancula',
  HIDE: 'Hide Crancula',
  HIDE_OTHERS: 'Hide Others',
  SHOW_ALL: 'Show All',
  FILE: 'File',
  EDIT: 'Edit',
  VIEW: 'View',
  WINDOW: 'Window',
  UNDO: 'Undo',
  REDO: 'Redo',
  CUT: 'Cut',
  COPY: 'Copy',
  PASTE: 'Paste',
  SELECT_ALL: 'Select All',
  RELOAD: 'Reload',
  TOGGLE_DEV_TOOLS: 'Toggle Developer Tools',
  ACTUAL_SIZE: 'Actual Size',
  ZOOM_IN: 'Zoom In',
  ZOOM_OUT: 'Zoom Out',
  TOGGLE_FULLSCREEN: 'Toggle Full Screen',
  MINIMIZE: 'Minimize',
  CLOSE: 'Close',
  QUIT: 'Quit',
} as const;

type MenuKey = keyof typeof ENGLISH_LABELS;
/** The `MENU` section of the translation files; the keys are the same in every language. */
export type MenuLabels = Readonly<Record<MenuKey, string>>;

/** Where the translation files live when running from the sources (tests, `--serve`). */
export const SOURCE_I18N_DIRECTORY = join(__dirname, '../src/assets/i18n');

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readMenuSection(language: Language, i18nDirectory: string): Readonly<Record<string, unknown>> {
  try {
    const parsed: unknown = JSON.parse(readFileSync(join(i18nDirectory, `${language}.json`), 'utf8'));
    return isRecord(parsed) && isRecord(parsed['MENU']) ? parsed['MENU'] : {};
  } catch {
    return {};
  }
}

/** Reads `MENU` from `<i18nDirectory>/<language>.json`; English labels fill in a missing file or key. */
export function loadMenuLabels(language: Language, i18nDirectory: string): MenuLabels {
  const menu = readMenuSection(language, i18nDirectory);
  const label = (key: MenuKey): string => {
    const value = menu[key];
    return typeof value === 'string' && value.trim() !== '' ? value : ENGLISH_LABELS[key];
  };
  return {
    APP: label('APP'),
    HIDE: label('HIDE'),
    HIDE_OTHERS: label('HIDE_OTHERS'),
    SHOW_ALL: label('SHOW_ALL'),
    FILE: label('FILE'),
    EDIT: label('EDIT'),
    VIEW: label('VIEW'),
    WINDOW: label('WINDOW'),
    UNDO: label('UNDO'),
    REDO: label('REDO'),
    CUT: label('CUT'),
    COPY: label('COPY'),
    PASTE: label('PASTE'),
    SELECT_ALL: label('SELECT_ALL'),
    RELOAD: label('RELOAD'),
    TOGGLE_DEV_TOOLS: label('TOGGLE_DEV_TOOLS'),
    ACTUAL_SIZE: label('ACTUAL_SIZE'),
    ZOOM_IN: label('ZOOM_IN'),
    ZOOM_OUT: label('ZOOM_OUT'),
    TOGGLE_FULLSCREEN: label('TOGGLE_FULLSCREEN'),
    MINIMIZE: label('MINIMIZE'),
    CLOSE: label('CLOSE'),
    QUIT: label('QUIT'),
  };
}

/** The application menu with explicit labels, so roles do not fall back to the operating system language. */
export function menuTemplate(
  language: Language,
  platform: NodeJS.Platform,
  i18nDirectory: string = SOURCE_I18N_DIRECTORY,
): MenuItemConstructorOptions[] {
  const t = loadMenuLabels(language, i18nDirectory);
  const mac = platform === 'darwin';
  const separator: MenuItemConstructorOptions = {type: 'separator'};

  const application: MenuItemConstructorOptions[] = mac
    ? [
        {
          label: t.APP,
          submenu: [
            {role: 'hide', label: t.HIDE},
            {role: 'hideOthers', label: t.HIDE_OTHERS},
            {role: 'unhide', label: t.SHOW_ALL},
            separator,
            {role: 'quit', label: t.QUIT},
          ],
        },
      ]
    : [];

  return [
    ...application,
    {label: t.FILE, submenu: [mac ? {role: 'close', label: t.CLOSE} : {role: 'quit', label: t.QUIT}]},
    {
      label: t.EDIT,
      submenu: [
        {role: 'undo', label: t.UNDO},
        {role: 'redo', label: t.REDO},
        separator,
        {role: 'cut', label: t.CUT},
        {role: 'copy', label: t.COPY},
        {role: 'paste', label: t.PASTE},
        {role: 'selectAll', label: t.SELECT_ALL},
      ],
    },
    {
      label: t.VIEW,
      submenu: [
        {role: 'reload', label: t.RELOAD},
        {role: 'toggleDevTools', label: t.TOGGLE_DEV_TOOLS},
        separator,
        {role: 'resetZoom', label: t.ACTUAL_SIZE},
        {role: 'zoomIn', label: t.ZOOM_IN},
        {role: 'zoomOut', label: t.ZOOM_OUT},
        separator,
        {role: 'togglefullscreen', label: t.TOGGLE_FULLSCREEN},
      ],
    },
    {
      label: t.WINDOW,
      submenu: [
        {role: 'minimize', label: t.MINIMIZE},
        {role: 'close', label: t.CLOSE},
      ],
    },
  ];
}
