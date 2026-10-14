import {TestBed} from '@angular/core/testing';
import {MatDialog} from '@angular/material/dialog';
import {provideRouter} from '@angular/router';
import {type Observable, of} from 'rxjs';
import {ConfirmableAction, ConfirmDialogComponent} from '../../shared/components/confirm-dialog/confirm-dialog.component';
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

  describe('delete', () => {
    async function renderWithDialog(confirmed: boolean) {
      const open = vi.fn<(component: unknown, config: unknown) => {afterClosed: () => Observable<boolean>}>(() => ({afterClosed: () => of(confirmed)}));
      TestBed.configureTestingModule({
        providers: [provideRouter([]), provideTestTranslations(), {provide: MatDialog, useValue: {open}}],
      });
      const library = TestBed.inject(OrganLibrary);
      const organ = testOrgan('Street organ');
      await library.put(organ);
      const fixture = TestBed.createComponent(OrganListComponent);
      fixture.autoDetectChanges();
      await fixture.whenStable();
      const element = fixture.nativeElement as HTMLElement;
      const button = element.querySelector<HTMLButtonElement>('[data-testid="delete-organ"]');
      if (!button) throw new Error('no delete-organ button');
      button.click();
      await fixture.whenStable();
      return {library, organ, open};
    }

    it('opens the confirm dialog for deleting the Organ', async () => {
      const {open, organ} = await renderWithDialog(false);

      expect(open).toHaveBeenCalledTimes(1);
      expect(open.mock.calls[0]?.[0]).toBe(ConfirmDialogComponent);
      expect(open.mock.calls[0]?.[1]).toMatchObject({
        data: {action: ConfirmableAction.DELETE, entity: {id: organ.id, name: 'Street organ'}},
      });
    });

    it('changes nothing when the dialog is cancelled', async () => {
      const {library, organ} = await renderWithDialog(false);

      expect(library.entities().map(({id}) => id)).toEqual([organ.id]);
    });

    it('removes the Organ from the library when the dialog is confirmed', async () => {
      const {library} = await renderWithDialog(true);

      expect(library.entities()).toEqual([]);
    });
  });

  it('offers to create a new Organ', async () => {
    const {element} = await render();
    const link = element.querySelector('[data-testid="new-organ"]');
    expect(link?.textContent?.trim()).toContain('New Organ');
    expect(link?.getAttribute('href')).toBe('/organs/new');
  });
});
