import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import type {MenuItemConstructorOptions} from 'electron';
import {describe, expect, it} from 'vitest';
import type {Language} from '../api/app/language';
import {menuTemplate} from './application-menu';

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

describe('menuTemplate', () => {
  it('labels the English menu in English', () => {
    const template = menuTemplate('en', 'win32');

    expect(template.map((item) => item.label)).toEqual(['File', 'Edit', 'View', 'Window']);
    const edit = submenu(template[1]);
    expect(edit.find((item) => item.role === 'undo')?.label).toBe('Undo');
    expect(edit.find((item) => item.role === 'paste')?.label).toBe('Paste');
  });

  it('labels the German menu in German', () => {
    const template = menuTemplate('de', 'win32');

    expect(template.map((item) => item.label)).toEqual(['Datei', 'Bearbeiten', 'Ansicht', 'Fenster']);
    const edit = submenu(template[1]);
    expect(edit.find((item) => item.role === 'undo')?.label).toBe('Rückgängig');
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
    expect(roles(edit)).toEqual(expect.arrayContaining(['undo', 'redo', 'cut', 'copy', 'paste', 'selectAll']));
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
