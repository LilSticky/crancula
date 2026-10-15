import {Component} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {TestbedHarnessEnvironment} from '@angular/cdk/testing/testbed';
import {MatTooltipHarness} from '@angular/material/tooltip/testing';
import {provideRouter, Router} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import {vi} from 'vitest';
import {CRANCULA_API, createInMemoryCranculaApi} from '../../core/crancula-api.token';
import {provideTestTranslations} from '../../../testing/test-translations';
import {SchemePreference, type Scheme} from '../shared/scheme-preference';
import {RailComponent} from './rail.component';

const LANGUAGE_KEY = 'crancula.language';
const SCHEME_KEY = 'crancula.scheme';

@Component({template: ''})
class StubPage {}

async function startRail(options: {api?: ReturnType<typeof createInMemoryCranculaApi>; compact?: boolean} = {}) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        {path: 'organs', component: StubPage},
        {path: 'tapes', component: StubPage},
      ]),
      provideTestTranslations('en'),
      {provide: CRANCULA_API, useValue: options.api ?? createInMemoryCranculaApi()},
    ],
  });
  const translate = TestBed.inject(TranslateService);
  const fixture: ComponentFixture<RailComponent> = TestBed.createComponent(RailComponent);
  if (options.compact !== undefined) fixture.componentRef.setInput('compact', options.compact);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const element: HTMLElement = fixture.nativeElement;

  const press = async (selector: string) => {
    const option = element.querySelector<HTMLElement>(selector);
    if (!option) throw new Error(`nothing matches ${selector}`);
    (option.tagName === 'BUTTON' ? option : (option.querySelector<HTMLElement>('button') ?? option)).click();
    await fixture.whenStable();
  };
  const chooseLanguage = (language: 'en' | 'de') => press(`[data-testid="language-switch"] [data-language="${language}"]`);
  const chooseScheme = (scheme: Scheme) => press(`[data-testid="scheme-switch"] [data-scheme="${scheme}"]`);
  const navItem = (path: string) => element.querySelector<HTMLAnchorElement>(`[data-testid="rail-nav"] a[href="${path}"]`);
  const schemeButton = (scheme: Scheme) =>
    element.querySelector<HTMLElement>(`[data-testid="scheme-switch"] [data-scheme="${scheme}"] button`);
  return {fixture, translate, element, chooseLanguage, chooseScheme, navItem, schemeButton};
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

function resetEnvironment(): void {
  vi.unstubAllGlobals();
  document.documentElement.classList.remove('cr-light', 'cr-dark');
}

describe('RailComponent brand', () => {
  beforeEach(stubLocalStorage);
  afterEach(resetEnvironment);

  it('links the logo and the app name to the Organ list as one brand', async () => {
    const {element} = await startRail();

    const brand = element.querySelector<HTMLAnchorElement>('a[data-testid="brand"]');
    expect(brand?.getAttribute('href')).toBe('/organs');
    expect(brand?.querySelector('img')?.getAttribute('src')).toBe('assets/icons/logo.svg');
    expect(brand?.textContent?.trim()).toBe('Crancula');
  });

  it('puts the brand before the navigation', async () => {
    const {element} = await startRail();

    const first = element.querySelector<HTMLElement>('[data-testid="rail"] > *');
    expect(first?.getAttribute('data-testid')).toBe('brand');
  });

  it('keeps the logo decorative so the link is named by the app name alone', async () => {
    const {element} = await startRail();

    const brand = element.querySelector<HTMLAnchorElement>('[data-testid="brand"]');
    expect(brand?.querySelector('img')?.getAttribute('alt')).toBe('');
  });
});

describe('RailComponent navigation', () => {
  beforeEach(stubLocalStorage);
  afterEach(resetEnvironment);

  it('lists Organs and Tapes, each with an icon and a label', async () => {
    const {navItem} = await startRail();

    const organs = navItem('/organs');
    const tapes = navItem('/tapes');
    expect(organs?.querySelector('mat-icon')?.textContent?.trim()).toBe('piano');
    expect(organs?.textContent).toContain('Organs');
    expect(tapes?.querySelector('mat-icon')?.textContent?.trim()).toBe('receipt_long');
    expect(tapes?.textContent).toContain('Tapes');
  });

  it('marks only the item of the active route as the current page', async () => {
    const {fixture, navItem} = await startRail();

    await TestBed.inject(Router).navigateByUrl('/tapes');
    await fixture.whenStable();

    expect(navItem('/tapes')?.getAttribute('aria-current')).toBe('page');
    expect(navItem('/organs')?.hasAttribute('aria-current')).toBe(false);
  });

  it('shows the labels and no tooltips when not compact', async () => {
    const {fixture, navItem} = await startRail({compact: false});

    expect(navItem('/organs')?.textContent).toContain('Organs');
    const tooltips = await TestbedHarnessEnvironment.loader(fixture).getAllHarnesses(MatTooltipHarness);
    expect(tooltips).toHaveLength(0);
  });

  it('hides the labels when compact but keeps the items named for assistive technology', async () => {
    const {navItem} = await startRail({compact: true});

    const organs = navItem('/organs');
    expect(organs?.textContent).not.toContain('Organs');
    expect(organs?.querySelector('mat-icon')?.textContent?.trim()).toBe('piano');
    expect(organs?.getAttribute('aria-label')).toBe('Organs');
    expect(navItem('/tapes')?.textContent).not.toContain('Tapes');
    expect(navItem('/tapes')?.getAttribute('aria-label')).toBe('Tapes');
  });

  it('shows the label as a tooltip on the items when compact', async () => {
    const {fixture} = await startRail({compact: true});

    const loader = TestbedHarnessEnvironment.loader(fixture);
    const organs = await loader.getHarness(MatTooltipHarness.with({selector: '[href="/organs"]:not([data-testid="brand"])'}));
    await organs.show();

    expect(await organs.getTooltipText()).toBe('Organs');
  });
});

describe('RailComponent language switch', () => {
  beforeEach(stubLocalStorage);
  afterEach(resetEnvironment);

  it('starts in the default language when no choice was stored', async () => {
    const {translate} = await startRail();

    expect(translate.getCurrentLang()).toBe('en');
  });

  it('switches the app to German and back to English', async () => {
    const {translate, chooseLanguage} = await startRail();

    await chooseLanguage('de');
    expect(translate.getCurrentLang()).toBe('de');

    await chooseLanguage('en');
    expect(translate.getCurrentLang()).toBe('en');
  });

  it('remembers the chosen language in localStorage', async () => {
    const {chooseLanguage} = await startRail();

    await chooseLanguage('de');

    expect(localStorage.getItem(LANGUAGE_KEY)).toBe('de');
  });

  it('restores the stored language on a fresh app start', async () => {
    const first = await startRail();
    await first.chooseLanguage('de');

    const {translate} = await startRail();

    expect(translate.getCurrentLang()).toBe('de');
  });

  it('tells the main process the language on start', async () => {
    const api = createInMemoryCranculaApi();
    const setLanguage = vi.spyOn(api.app, 'setLanguage');

    await startRail({api});

    expect(setLanguage).toHaveBeenCalledWith('en');
  });

  it('tells the main process the stored language on start', async () => {
    const first = await startRail();
    await first.chooseLanguage('de');
    const api = createInMemoryCranculaApi();
    const setLanguage = vi.spyOn(api.app, 'setLanguage');

    await startRail({api});

    expect(setLanguage).toHaveBeenCalledWith('de');
  });

  it('tells the main process on every switch', async () => {
    const api = createInMemoryCranculaApi();
    const setLanguage = vi.spyOn(api.app, 'setLanguage');
    const {chooseLanguage} = await startRail({api});
    setLanguage.mockClear();

    await chooseLanguage('de');
    expect(setLanguage).toHaveBeenLastCalledWith('de');

    await chooseLanguage('en');
    expect(setLanguage).toHaveBeenLastCalledWith('en');
    expect(setLanguage).toHaveBeenCalledTimes(2);
  });
});

describe('RailComponent scheme switch', () => {
  beforeEach(stubLocalStorage);
  afterEach(resetEnvironment);

  it('offers System, Light and Dark, each named for assistive technology', async () => {
    const {translate, element, schemeButton} = await startRail();

    const group = element.querySelector<HTMLElement>('[data-testid="scheme-switch"]');
    expect(group?.getAttribute('aria-label')).toBe(translate.instant('RAIL.SCHEME'));
    expect(translate.instant('RAIL.SCHEME')).not.toBe('RAIL.SCHEME');
    for (const [scheme, key] of [
      ['system', 'RAIL.SCHEME_SYSTEM'],
      ['light', 'RAIL.SCHEME_LIGHT'],
      ['dark', 'RAIL.SCHEME_DARK'],
    ] as const) {
      const label = translate.instant(key);
      expect(label).not.toBe(key);
      expect(schemeButton(scheme)?.getAttribute('aria-label')).toBe(label);
    }
  });

  it('shows the remembered System choice as selected on start', async () => {
    const {schemeButton} = await startRail();

    expect(schemeButton('system')?.getAttribute('aria-checked')).toBe('true');
    expect(schemeButton('dark')?.getAttribute('aria-checked')).toBe('false');
  });

  it('shows the stored choice as selected on start', async () => {
    localStorage.setItem(SCHEME_KEY, 'dark');

    const {schemeButton} = await startRail();

    expect(schemeButton('dark')?.getAttribute('aria-checked')).toBe('true');
    expect(schemeButton('system')?.getAttribute('aria-checked')).toBe('false');
  });

  it('hands the chosen scheme to the scheme preference', async () => {
    const {chooseScheme} = await startRail();
    const choose = vi.spyOn(TestBed.inject(SchemePreference), 'choose');

    await chooseScheme('dark');
    expect(choose).toHaveBeenLastCalledWith('dark');

    await chooseScheme('light');
    expect(choose).toHaveBeenLastCalledWith('light');
  });

  it('reflects a scheme chosen elsewhere', async () => {
    const {fixture, schemeButton} = await startRail();

    TestBed.inject(SchemePreference).choose('light');
    await fixture.whenStable();

    expect(schemeButton('light')?.getAttribute('aria-checked')).toBe('true');
    expect(schemeButton('system')?.getAttribute('aria-checked')).toBe('false');
  });
});

describe('RailComponent footer', () => {
  beforeEach(stubLocalStorage);
  afterEach(resetEnvironment);

  it('says the data is saved on this computer', async () => {
    const {translate, element} = await startRail();

    const text = translate.instant('RAIL.SAVED_HERE');
    expect(text).not.toBe('RAIL.SAVED_HERE');
    expect(element.textContent).toContain(text);
  });

  it('names the language switch for assistive technology', async () => {
    const {translate, element} = await startRail();

    expect(translate.instant('RAIL.LANGUAGE')).not.toBe('RAIL.LANGUAGE');
    const group = element.querySelector<HTMLElement>('[data-testid="language-switch"]');
    expect(group?.getAttribute('aria-label')).toBe(translate.instant('RAIL.LANGUAGE'));
  });
});
