import {TestBed} from '@angular/core/testing';
import {TranslateService} from '@ngx-translate/core';
import {vi} from 'vitest';
import {CRANCULA_API, createInMemoryCranculaApi} from '../../core/crancula-api.token';
import {provideTestTranslations} from '../../../testing/test-translations';
import {LanguagePreference} from './language-preference';

const LANGUAGE_KEY = 'crancula.language';

// jsdom's localStorage is unavailable here, so the app's UI preference store is an in-memory stand-in.
function stubLocalStorage(initial?: string): void {
  const store = new Map<string, string>();
  if (initial !== undefined) store.set(LANGUAGE_KEY, initial);
  const storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => void store.set(key, value),
    removeItem: (key) => void store.delete(key),
  };
  vi.stubGlobal('localStorage', storage);
}

function createPreference(options: {current?: 'en' | 'de'; api?: ReturnType<typeof createInMemoryCranculaApi>} = {}) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideTestTranslations(options.current ?? 'en'),
      {provide: CRANCULA_API, useValue: options.api ?? createInMemoryCranculaApi()},
    ],
  });
  const translate = TestBed.inject(TranslateService);
  const preference = TestBed.inject(LanguagePreference);
  return {preference, translate};
}

describe('LanguagePreference', () => {
  beforeEach(() => stubLocalStorage());
  afterEach(() => vi.unstubAllGlobals());

  it('starts in the default language when no choice was stored', () => {
    const {preference, translate} = createPreference();

    expect(preference.language()).toBe('en');
    expect(translate.getCurrentLang()).toBe('en');
  });

  it('starts in the translate service language when nothing was stored', async () => {
    const {preference, translate} = createPreference({current: 'de'});

    expect(preference.language()).toBe('de');
    await vi.waitFor(() => expect(translate.getCurrentLang()).toBe('de'));
  });

  it('starts in the translate service language when the stored language is invalid', () => {
    stubLocalStorage('fr');

    const {preference} = createPreference({current: 'de'});

    expect(preference.language()).toBe('de');
  });

  it('starts from the stored language, ahead of the translate service language', async () => {
    stubLocalStorage('de');

    const {preference, translate} = createPreference({current: 'en'});

    expect(preference.language()).toBe('de');
    await vi.waitFor(() => expect(translate.getCurrentLang()).toBe('de'));
  });

  it('switches the app to German and back to English', async () => {
    const {preference, translate} = createPreference();

    preference.choose('de');
    expect(preference.language()).toBe('de');
    await vi.waitFor(() => expect(translate.getCurrentLang()).toBe('de'));

    preference.choose('en');
    expect(preference.language()).toBe('en');
    await vi.waitFor(() => expect(translate.getCurrentLang()).toBe('en'));
  });

  it('remembers the chosen language in localStorage', () => {
    const {preference} = createPreference();

    preference.choose('de');

    expect(localStorage.getItem(LANGUAGE_KEY)).toBe('de');
  });

  it('restores the remembered language on a fresh app start', async () => {
    createPreference().preference.choose('de');

    const {preference, translate} = createPreference();

    expect(preference.language()).toBe('de');
    await vi.waitFor(() => expect(translate.getCurrentLang()).toBe('de'));
  });

  it('tells the main process the language on creation', () => {
    const api = createInMemoryCranculaApi();
    const setLanguage = vi.spyOn(api.app, 'setLanguage');

    createPreference({api});

    expect(setLanguage).toHaveBeenCalledWith('en');
  });

  it('tells the main process the stored language on creation', () => {
    stubLocalStorage('de');
    const api = createInMemoryCranculaApi();
    const setLanguage = vi.spyOn(api.app, 'setLanguage');

    createPreference({api});

    expect(setLanguage).toHaveBeenCalledWith('de');
  });

  it('tells the main process on every switch', () => {
    const api = createInMemoryCranculaApi();
    const setLanguage = vi.spyOn(api.app, 'setLanguage');
    const {preference} = createPreference({api});
    setLanguage.mockClear();

    preference.choose('de');
    expect(setLanguage).toHaveBeenLastCalledWith('de');

    preference.choose('en');
    expect(setLanguage).toHaveBeenLastCalledWith('en');
    expect(setLanguage).toHaveBeenCalledTimes(2);
  });
});
