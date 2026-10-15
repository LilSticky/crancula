import {BreakpointObserver, type BreakpointState} from '@angular/cdk/layout';
import {TestbedHarnessEnvironment} from '@angular/cdk/testing/testbed';
import {TestBed} from '@angular/core/testing';
import {MatSidenavHarness} from '@angular/material/sidenav/testing';
import {MatSnackBar} from '@angular/material/snack-bar';
import {provideRouter} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import type {CranculaApi} from '@api/index';
import {firstValueFrom, of, type Observable} from 'rxjs';
import {vi} from 'vitest';
import {provideTestTranslations} from '../testing/test-translations';
import {testOrgan} from '../testing/organs';
import {AppComponent} from './app.component';
import {CRANCULA_API, createInMemoryCranculaApi} from './core/crancula-api.token';
import {OrganLibrary} from './features/organ/organ-library.store';
import {TapeLibrary} from './features/tape/tape-library.store';

async function render(api: CranculaApi) {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), provideTestTranslations(), {provide: CRANCULA_API, useValue: api}],
  });
  const library = TestBed.inject(OrganLibrary);
  const fixture = TestBed.createComponent(AppComponent);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  return {fixture, library};
}

describe('AppComponent', () => {
  beforeEach(() => {
    // jsdom's localStorage is unavailable here; the rail reads the stored language from it.
    vi.stubGlobal('localStorage', {getItem: () => null, setItem: () => undefined, removeItem: () => undefined});
  });
  afterEach(() => vi.unstubAllGlobals());

  it('tells the user when the Organs could not be loaded', async () => {
    const api = createInMemoryCranculaApi();
    api.organs.load = () => Promise.resolve({status: 'unreadable', backupPath: 'C:/data/organs.unreadable.json', reason: 'bad JSON'});
    const {fixture, library} = await render(api);

    await library.load();
    await fixture.whenStable();

    expect(document.body.textContent).toContain(
      "Your Organs couldn't be loaded. The file was kept at C:/data/organs.unreadable.json.",
    );
  });

  it('tells the user only once when the Organs could not be loaded', async () => {
    const api = createInMemoryCranculaApi();
    api.organs.load = () => Promise.resolve({status: 'unreadable', backupPath: 'C:/data/organs.unreadable.json', reason: 'bad JSON'});
    const {fixture, library} = await render(api);
    const open = vi.spyOn(TestBed.inject(MatSnackBar), 'open');

    await library.load();
    await fixture.whenStable();
    await firstValueFrom(TestBed.inject(TranslateService).use('de'));
    await fixture.whenStable();

    expect(open).toHaveBeenCalledTimes(1);
  });

  it('tells the user when changes could not be saved', async () => {
    const api = createInMemoryCranculaApi();
    api.organs.save = () => Promise.resolve({status: 'failed', reason: 'disk full'});
    const {fixture, library} = await render(api);

    await library.put(testOrgan('Street organ'));
    await fixture.whenStable();

    expect(document.body.textContent).toContain("Your changes couldn't be saved: disk full");
  });

  it('tells the user when the Tapes could not be loaded, and that the Organs still work', async () => {
    const api = createInMemoryCranculaApi(undefined, undefined, {tapes: {load: 'unreadable'}});
    const {fixture} = await render(api);

    await TestBed.inject(TapeLibrary).load();
    await fixture.whenStable();

    expect(document.body.textContent).toContain('tapes.json.bak');
    expect(document.body.textContent).toContain('Your Organs still work.');
  });

  it('tells the user when the Tapes could not be saved', async () => {
    const api = createInMemoryCranculaApi(undefined, undefined, {tapes: {save: 'failed'}});
    const {fixture} = await render(api);

    await TestBed.inject(TapeLibrary).removeTapesOf(testOrgan('Street organ').id);
    await fixture.whenStable();

    expect(document.body.textContent).toContain("Your Tapes couldn't be saved: the Tape library could not be written");
  });
});

/** Evaluates `min-width` and `max-width` queries against a fixed window width. */
function stubBreakpointObserver(width: number): Pick<BreakpointObserver, 'observe' | 'isMatched'> {
  const matches = (query: string): boolean => {
    const max = /max-width:\s*([\d.]+)px/.exec(query);
    const min = /min-width:\s*([\d.]+)px/.exec(query);
    return (!max || width <= Number(max[1])) && (!min || width >= Number(min[1]));
  };
  const queries = (value: string | readonly string[]): string[] => (typeof value === 'string' ? [value] : [...value]);
  return {
    observe: (value: string | readonly string[]): Observable<BreakpointState> =>
      of({matches: queries(value).some(matches), breakpoints: Object.fromEntries(queries(value).map((q) => [q, matches(q)]))}),
    isMatched: (value: string | readonly string[]): boolean => queries(value).some(matches),
  };
}

async function renderAtWidth(width: number) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideTestTranslations(),
      {provide: CRANCULA_API, useValue: createInMemoryCranculaApi()},
      {provide: BreakpointObserver, useValue: stubBreakpointObserver(width)},
    ],
  });
  const fixture = TestBed.createComponent(AppComponent);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const element: HTMLElement = fixture.nativeElement;
  const sidenav = await TestbedHarnessEnvironment.loader(fixture).getHarness(MatSidenavHarness);
  return {fixture, element, sidenav};
}

describe('AppComponent shell', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {getItem: () => null, setItem: () => undefined, removeItem: () => undefined});
  });
  afterEach(() => vi.unstubAllGlobals());

  it('puts the rail in an always open side sidenav and the page in its content', async () => {
    const {element, sidenav} = await renderAtWidth(1280);

    expect(element.querySelector('mat-sidenav-container')).not.toBeNull();
    expect(await sidenav.getMode()).toBe('side');
    expect(await sidenav.isOpen()).toBe(true);
    expect(element.querySelector('mat-sidenav-container > mat-sidenav cranc-rail')).not.toBeNull();
    expect(element.querySelector('mat-sidenav-container > mat-sidenav-content router-outlet')).not.toBeNull();
  });

  it('shows the full rail with labels from 1180 px wide', async () => {
    const {element} = await renderAtWidth(1180);

    const sidenav = element.querySelector<HTMLElement>('mat-sidenav');
    expect(sidenav?.classList.contains('cr-compact')).toBe(false);
    expect(element.querySelector('[data-testid="rail-nav"] a[href="/organs"]')?.textContent).toContain('Organs');
  });

  it('shrinks to an icon rail without labels below 1180 px', async () => {
    const {element} = await renderAtWidth(1179);

    const sidenav = element.querySelector<HTMLElement>('mat-sidenav');
    expect(sidenav?.classList.contains('cr-compact')).toBe(true);
    expect(element.querySelector('[data-testid="rail-nav"] a[href="/organs"]')?.textContent).not.toContain('Organs');
  });
});
