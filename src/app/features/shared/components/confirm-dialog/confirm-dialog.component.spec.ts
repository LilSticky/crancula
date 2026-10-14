import {TestBed} from '@angular/core/testing';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {provideTestTranslations} from '../../../../../testing/test-translations';
import {ConfirmableAction, ConfirmDialogComponent} from './confirm-dialog.component';

async function render(lang: 'en' | 'de', action: ConfirmableAction) {
  TestBed.configureTestingModule({
    providers: [
      provideTestTranslations(lang),
      {provide: MatDialogRef, useValue: {close: () => undefined}},
      {provide: MAT_DIALOG_DATA, useValue: {action, entity: {name: 'Drehorgel'}}},
    ],
  });
  const fixture = TestBed.createComponent(ConfirmDialogComponent);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const buttons = [...element.querySelectorAll('button')].map((button) => button.textContent?.trim());
  return {element, buttons, title: element.querySelector('h2')?.textContent?.trim()};
}

describe('ConfirmDialogComponent', () => {
  it('shows German title and buttons for DISCARD', async () => {
    const {element, buttons, title} = await render('de', ConfirmableAction.DISCARD);

    expect(title).toBe('Aktion bestätigen');
    expect(buttons).toEqual(['Abbrechen', 'Bestätigen']);
    expect(element.textContent).toContain('Änderungen an Drehorgel verwerfen');
    expect(element.textContent).not.toMatch(/Confirm Action|Cancel|CONFIRMATION_DIALOG/);
  });

  it('shows German title and buttons for DELETE', async () => {
    const {element, buttons, title} = await render('de', ConfirmableAction.DELETE);

    expect(title).toBe('Aktion bestätigen');
    expect(buttons).toEqual(['Abbrechen', 'Bestätigen']);
    expect(element.textContent).toContain('Drehorgel für immer löschen');
    expect(element.textContent).not.toMatch(/Confirm Action|Cancel|CONFIRMATION_DIALOG/);
  });

  it('still shows English title and buttons in English', async () => {
    const {buttons, title} = await render('en', ConfirmableAction.DISCARD);

    expect(title).toBe('Confirm Action');
    expect(buttons).toEqual(['Cancel', 'Confirm']);
  });
});
