import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {provideTestTranslations} from '../../../../testing/test-translations';
import {testOrgan} from '../../../../testing/organs';
import {OrganLibrary} from '../organ-library.store';
import {OrganListComponent} from './organ-list.component';

async function render() {
  TestBed.configureTestingModule({providers: [provideRouter([]), provideTestTranslations()]});
  const library = TestBed.inject(OrganLibrary);
  const fixture = TestBed.createComponent(OrganListComponent);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  return {fixture, library, element: fixture.nativeElement as HTMLElement};
}

describe('OrganListComponent', () => {
  it('says that there are no Organs yet', async () => {
    const {element} = await render();
    expect(element.textContent).toContain('No Organs yet.');
  });

  it('lists the Organs by name with their Pipe count', async () => {
    const {fixture, library, element} = await render();
    await library.put(testOrgan('Street organ', 31));
    await library.put(testOrgan('Small organ', 1));
    await fixture.whenStable();

    const rows = [...element.querySelectorAll('[data-testid="organ"]')].map((row) =>
      [...row.querySelectorAll('[matListItemTitle], [matListItemLine]')].map((part) => part.textContent?.trim()).join(' '),
    );
    expect(rows).toEqual(['Street organ 31 Pipes', 'Small organ 1 Pipes']);
    expect(element.textContent).not.toContain('No Organs yet.');
  });

  it('links each Organ to its editor', async () => {
    const {fixture, library, element} = await render();
    const organ = testOrgan('Street organ');
    await library.put(organ);
    await fixture.whenStable();

    expect(element.querySelector('[data-testid="organ"]')?.getAttribute('href')).toBe(`/organs/${organ.id}`);
  });

  it('offers to create a new Organ', async () => {
    const {element} = await render();
    const link = element.querySelector('[data-testid="new-organ"]');
    expect(link?.textContent?.trim()).toContain('New Organ');
    expect(link?.getAttribute('href')).toBe('/organs/new');
  });
});
