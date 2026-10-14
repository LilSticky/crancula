import {TestBed} from '@angular/core/testing';
import {MatSnackBar} from '@angular/material/snack-bar';
import {provideRouter} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import type {CranculaApi} from '@api/index';
import {firstValueFrom} from 'rxjs';
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
    // jsdom's localStorage is unavailable here; the navbar reads the stored language from it.
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
