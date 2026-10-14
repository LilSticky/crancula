import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import {vi} from 'vitest';
import {provideTestTranslations} from '../../../testing/test-translations';
import {NavbarComponent} from './navbar.component';

const LANGUAGE_KEY = 'crancula.language';

async function startApp() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({providers: [provideRouter([]), provideTestTranslations('en')]});
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
  return {translate, choose};
}

describe('NavbarComponent language switch', () => {
  beforeEach(() => {
    // jsdom's localStorage is unavailable here, so the app's UI preference store is an in-memory stand-in.
    const store = new Map<string, string>();
    const storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => void store.set(key, value),
      removeItem: (key) => void store.delete(key),
    };
    vi.stubGlobal('localStorage', storage);
  });
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
});
