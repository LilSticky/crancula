import {TestBed} from '@angular/core/testing';
import {vi} from 'vitest';
import {SchemePreference} from './scheme-preference';

const SCHEME_KEY = 'crancula.scheme';

// jsdom's localStorage is unavailable here, so the app's UI preference store is an in-memory stand-in.
function stubLocalStorage(initial?: string): void {
  const store = new Map<string, string>();
  if (initial !== undefined) store.set(SCHEME_KEY, initial);
  const storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => void store.set(key, value),
    removeItem: (key) => void store.delete(key),
  };
  vi.stubGlobal('localStorage', storage);
}

function createPreference(): SchemePreference {
  TestBed.resetTestingModule();
  return TestBed.inject(SchemePreference);
}

describe('SchemePreference', () => {
  const root = document.documentElement;

  beforeEach(() => root.classList.remove('cr-light', 'cr-dark'));
  afterEach(() => {
    vi.unstubAllGlobals();
    root.classList.remove('cr-light', 'cr-dark');
  });

  it('starts as System when no scheme was stored', () => {
    stubLocalStorage();

    expect(createPreference().scheme()).toBe('system');
  });

  it('starts as System when the stored scheme is invalid', () => {
    stubLocalStorage('sepia');

    expect(createPreference().scheme()).toBe('system');
  });

  it('starts from the stored scheme', () => {
    stubLocalStorage('dark');

    expect(createPreference().scheme()).toBe('dark');
  });

  it('applies the stored scheme to the document on creation', () => {
    stubLocalStorage('dark');

    createPreference();

    expect(root.classList.contains('cr-dark')).toBe(true);
    expect(root.classList.contains('cr-light')).toBe(false);
  });

  it('sets no scheme class for System', () => {
    stubLocalStorage();

    createPreference();

    expect(root.classList.contains('cr-light')).toBe(false);
    expect(root.classList.contains('cr-dark')).toBe(false);
  });

  it('remembers the chosen scheme in localStorage', () => {
    stubLocalStorage();
    const preference = createPreference();

    preference.choose('light');

    expect(preference.scheme()).toBe('light');
    expect(localStorage.getItem(SCHEME_KEY)).toBe('light');
  });

  it('switches the document class when the scheme changes', () => {
    stubLocalStorage();
    const preference = createPreference();

    preference.choose('light');
    expect(root.classList.contains('cr-light')).toBe(true);
    expect(root.classList.contains('cr-dark')).toBe(false);

    preference.choose('dark');
    expect(root.classList.contains('cr-dark')).toBe(true);
    expect(root.classList.contains('cr-light')).toBe(false);

    preference.choose('system');
    expect(root.classList.contains('cr-dark')).toBe(false);
    expect(root.classList.contains('cr-light')).toBe(false);
  });
});
