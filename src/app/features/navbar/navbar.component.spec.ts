import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import {vi} from 'vitest';
import {CRANCULA_API, createInMemoryCranculaApi} from '../../core/crancula-api.token';
import {provideTestTranslations} from '../../../testing/test-translations';
import {NavbarComponent} from './navbar.component';

const LANGUAGE_KEY = 'crancula.language';

async function startApp(api = createInMemoryCranculaApi()) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideRouter([]), provideTestTranslations('en'), {provide: CRANCULA_API, useValue: api}],
  });
  const translate = TestBed.inject(TranslateService);
  const fixture = TestBed.createComponent(NavbarComponent);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const element: HTMLElement = fixture.nativeElement;

  const choose = async (language: 'en' | 'de') => {
    const option = element.querySelector<HTMLElement>(`[data-testid="language-switch"] [data-language="${language}"]`);
    if (!option) throw new Error(`no language option ${language}`);
    (option.tagName === 'BUTTON' ? option : (option.querySelector<HTMLElement>('button') ?? option)).click();
    await fixture.whenStable();
  };
  return {translate, choose, element};
}

// jsdom's localStorage is unavailable here, so the app's UI preference store is an in-memory stand-in.
function stubLocalStorage(): void {
  const store = new Map<string, string>();
  const storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => void store.set(key, value),
    removeItem: (key) => void store.delete(key),
  };
  vi.stubGlobal('localStorage', storage);
}

describe('NavbarComponent brand', () => {
  beforeEach(stubLocalStorage);
  afterEach(() => vi.unstubAllGlobals());

  it('links the logo and the app name to the home route as one brand', async () => {
    const {element} = await startApp();

    const brand = element.querySelector<HTMLAnchorElement>('a[data-testid="brand"]');
    expect(brand?.getAttribute('href')).toBe('/home');
    expect(brand?.querySelector('img')?.getAttribute('src')).toBe('assets/icons/logo.svg');
    expect(brand?.textContent?.trim()).toBe('Crancula');
  });

  it('puts the brand before the navigation links', async () => {
    const {element} = await startApp();

    const first = element.querySelector<HTMLElement>('[data-testid="navbar"] > *');
    expect(first?.getAttribute('data-testid')).toBe('brand');
  });

  it('keeps the logo decorative so the link is named by the app name alone', async () => {
    const {element} = await startApp();

    const brand = element.querySelector<HTMLAnchorElement>('[data-testid="brand"]');
    expect(brand?.querySelector('img')?.getAttribute('alt')).toBe('');
    expect(brand?.textContent?.trim()).toBe('Crancula');
  });
});

describe('NavbarComponent language switch', () => {
  beforeEach(stubLocalStorage);
  afterEach(() => vi.unstubAllGlobals());

  it('starts in the default language when no choice was stored', async () => {
    const {translate} = await startApp();

    expect(translate.getCurrentLang()).toBe('en');
  });

  it('switches the app to German and back to English', async () => {
    const {translate, choose} = await startApp();

    await choose('de');
    expect(translate.getCurrentLang()).toBe('de');

    await choose('en');
    expect(translate.getCurrentLang()).toBe('en');
  });

  it('remembers the chosen language in localStorage', async () => {
    const {choose} = await startApp();

    await choose('de');

    expect(localStorage.getItem(LANGUAGE_KEY)).toBe('de');
  });

  it('restores the stored language on a fresh app start', async () => {
    const first = await startApp();
    await first.choose('de');

    const {translate} = await startApp();

    expect(translate.getCurrentLang()).toBe('de');
  });

  it('tells the main process the language on start', async () => {
    const api = createInMemoryCranculaApi();
    const setLanguage = vi.spyOn(api.app, 'setLanguage');

    await startApp(api);

    expect(setLanguage).toHaveBeenCalledWith('en');
  });

  it('tells the main process the stored language on start', async () => {
    const first = await startApp();
    await first.choose('de');
    const api = createInMemoryCranculaApi();
    const setLanguage = vi.spyOn(api.app, 'setLanguage');

    await startApp(api);

    expect(setLanguage).toHaveBeenCalledWith('de');
  });

  it('tells the main process on every switch', async () => {
    const api = createInMemoryCranculaApi();
    const setLanguage = vi.spyOn(api.app, 'setLanguage');
    const {choose} = await startApp(api);
    setLanguage.mockClear();

    await choose('de');
    expect(setLanguage).toHaveBeenLastCalledWith('de');

    await choose('en');
    expect(setLanguage).toHaveBeenLastCalledWith('en');
    expect(setLanguage).toHaveBeenCalledTimes(2);
  });
});
