import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import type {MenuItemConstructorOptions} from 'electron';
import type {BaseWindow, MenuItem} from 'electron';
import {describe, expect, it, vi} from 'vitest';
import type {Language} from '../api/app/language';
import {loadMenuLabels, menuTemplate} from './application-menu';

interface Translations {
  readonly MENU: Record<string, string>;
}

function translations(language: Language): Translations {
  return JSON.parse(readFileSync(join(__dirname, `../src/assets/i18n/${language}.json`), 'utf8'));
}

function submenu(item: MenuItemConstructorOptions | undefined): MenuItemConstructorOptions[] {
  return Array.isArray(item?.submenu) ? item.submenu : [];
}

function everyItem(items: MenuItemConstructorOptions[]): MenuItemConstructorOptions[] {
  return items.flatMap((item) => [item, ...everyItem(submenu(item))]);
}

function roles(item: MenuItemConstructorOptions | undefined): (string | undefined)[] {
  return submenu(item).map((entry) => entry.role);
}

function withId(items: MenuItemConstructorOptions[], id: string): MenuItemConstructorOptions | undefined {
  return everyItem(items).find((item) => item.id === id);
}

describe('menuTemplate', () => {
  it('labels the English menu in English', () => {
    const template = menuTemplate('en', 'win32');

    expect(template.map((item) => item.label)).toEqual(['File', 'Edit', 'View', 'Window']);
    const edit = submenu(template[1]);
    expect(withId(edit, 'undo')?.label).toBe('Undo');
    expect(edit.find((item) => item.role === 'paste')?.label).toBe('Paste');
  });

  it('labels the German menu in German', () => {
    const template = menuTemplate('de', 'win32');

    expect(template.map((item) => item.label)).toEqual(['Datei', 'Bearbeiten', 'Ansicht', 'Fenster']);
    const edit = submenu(template[1]);
    expect(withId(edit, 'undo')?.label).toBe('Rückgängig');
    expect(edit.find((item) => item.role === 'paste')?.label).toBe('Einfügen');
  });

  it.each<Language>(['en', 'de'])('gives every %s item an explicit translated label', (language) => {
    const labelled = everyItem(menuTemplate(language, 'win32')).filter((item) => item.type !== 'separator');
    const allowed = Object.values(translations(language).MENU);

    expect(labelled.length).toBeGreaterThan(0);
    for (const item of labelled) {
      expect(item.label, `role ${item.role}`).toBeTruthy();
      expect(allowed).toContain(item.label);
      expect(item.label).not.toMatch(/^MENU\./);
    }
  });

  it('offers the standard roles in each menu', () => {
    const [file, edit, view, window] = menuTemplate('en', 'win32');

    expect(roles(file)).toContain('quit');
    expect(roles(edit)).toEqual(expect.arrayContaining(['cut', 'copy', 'paste', 'selectAll']));
    expect(roles(view)).toEqual(
      expect.arrayContaining(['reload', 'toggleDevTools', 'resetZoom', 'zoomIn', 'zoomOut', 'togglefullscreen']),
    );
    expect(roles(window)).toEqual(expect.arrayContaining(['minimize', 'close']));
  });

  it('adds the application menu first on macOS only', () => {
    const windows = menuTemplate('de', 'win32');
    const mac = menuTemplate('de', 'darwin');

    expect(mac).toHaveLength(windows.length + 1);
    expect(mac[0]?.label).toBeTruthy();
    expect(roles(mac[0])).toContain('quit');
    expect(mac.slice(1).map((item) => item.label)).toEqual(windows.map((item) => item.label));
  });
});

describe('Undo and Redo on the Tape', () => {
  it('gives Undo and Redo no role, so the menu command reaches the Tape', () => {
    const template = menuTemplate('en', 'win32');
    const undo = withId(template, 'undo');
    const redo = withId(template, 'redo');

    expect(undo).toBeDefined();
    expect(redo).toBeDefined();
    expect(undo?.role).toBeUndefined();
    expect(redo?.role).toBeUndefined();
  });

  it.each<NodeJS.Platform>(['darwin', 'win32', 'linux'])('accelerates Undo with CmdOrCtrl+Z on %s', (platform) => {
    expect(withId(menuTemplate('en', platform), 'undo')?.accelerator).toBe('CmdOrCtrl+Z');
  });

  it.each<[NodeJS.Platform, string]>([
    ['darwin', 'Shift+CmdOrCtrl+Z'],
    ['win32', 'Ctrl+Y'],
    ['linux', 'Ctrl+Y'],
  ])('accelerates Redo on %s with %s', (platform, accelerator) => {
    expect(withId(menuTemplate('en', platform), 'redo')?.accelerator).toBe(accelerator);
  });

  it.each<NodeJS.Platform>(['win32', 'linux'])(
    'leaves the keys to the renderer on %s (registerAccelerator false)',
    (platform) => {
      const template = menuTemplate('en', platform);

      expect(withId(template, 'undo')?.registerAccelerator).toBe(false);
      expect(withId(template, 'redo')?.registerAccelerator).toBe(false);
    },
  );

  it('registers the accelerators on macOS', () => {
    const template = menuTemplate('en', 'darwin');
    const undo = withId(template, 'undo');
    const redo = withId(template, 'redo');

    expect(undo).toBeDefined();
    expect(redo).toBeDefined();
    expect(undo?.registerAccelerator).not.toBe(false);
    expect(redo?.registerAccelerator).not.toBe(false);
  });

  it.each(['undo', 'redo'] as const)('sends the %s Edit Command on edit:command to the window', (command) => {
    const send = vi.fn();
    const window = {webContents: {send}} as unknown as BaseWindow;

    withId(menuTemplate('en', 'win32'), command)?.click?.({} as MenuItem, window, {} as KeyboardEvent);

    expect(send).toHaveBeenCalledExactlyOnceWith('edit:command', command);
  });
});

describe('loadMenuLabels', () => {
  it('warns once and falls back to English when the translation file cannot be read', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const labels = loadMenuLabels('de', join(__dirname, 'no-such-folder'));

    expect(labels.FILE).toBe('File');
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('does not warn when the translation file is read', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    loadMenuLabels('de', join(__dirname, '../src/assets/i18n'));

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
