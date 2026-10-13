import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import type {CranculaApi} from '@api/index';
import {provideTestTranslations} from '../testing/test-translations';
import {testOrgan} from '../testing/organs';
import {AppComponent} from './app.component';
import {CRANCULA_API, createInMemoryCranculaApi} from './core/crancula-api.token';
import {OrganLibrary} from './features/organ/organ-library.store';

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

  it('tells the user when changes could not be saved', async () => {
    const api = createInMemoryCranculaApi();
    api.organs.save = () => Promise.resolve({status: 'failed', reason: 'disk full'});
    const {fixture, library} = await render(api);

    await library.put(testOrgan('Street organ'));
    await fixture.whenStable();

    expect(document.body.textContent).toContain("Your changes couldn't be saved: disk full");
  });
});
