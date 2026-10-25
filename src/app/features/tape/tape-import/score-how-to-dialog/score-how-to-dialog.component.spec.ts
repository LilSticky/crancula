// API: ScoreHowToDialogComponent (standalone, selector `cranc-score-how-to-dialog`, in ./score-how-to-dialog.component).
// It is a Material dialog without data; its Close button is a `mat-dialog-close` and closes the dialog it is in.
import {ApplicationRef} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {MatDialog} from '@angular/material/dialog';
import {firstValueFrom} from 'rxjs';
import {provideTestTranslations} from '../../../../../testing/test-translations';
import {ScoreHowToDialogComponent} from './score-how-to-dialog.component';

/** Renders the dialog component as a fixture, for its content. */
async function render() {
  TestBed.configureTestingModule({providers: [provideTestTranslations('en')]});
  const fixture = TestBed.createComponent(ScoreHowToDialogComponent);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const closeButton = () => {
    const button = [...element.querySelectorAll<HTMLButtonElement>('button')].find(
      (each) => each.textContent?.trim() === 'Close',
    );
    if (!button) throw new Error('no Close button');
    return button;
  };
  return {element, closeButton, fixture};
}

describe('ScoreHowToDialogComponent', () => {
  it('titles the dialog "How to get MusicXML from printed Scores"', async () => {
    const {element} = await render();

    const title = element.querySelector('[mat-dialog-title], h1, h2')?.textContent?.trim();
    expect(title).toBe('How to get MusicXML from printed Scores');
  });

  it('lists the five steps from a PDF to a MusicXML file as a numbered list', async () => {
    const {element} = await render();

    const list = element.querySelector('ol');
    expect(list).not.toBeNull();
    const steps = [...(list?.querySelectorAll('li') ?? [])].map((step) => step.textContent?.trim());
    expect(steps).toEqual([
      'Install Audiveris, a music recognition tool.',
      'Open the PDF or the scan of your Score in Audiveris and let it recognise the Notes.',
      'Check and correct the result in a notation program such as MuseScore.',
      'Export the Score as MusicXML (.musicxml, .xml or .mxl).',
      'Choose the MusicXML file here.',
    ]);
  });

  it('closes the dialog with its Close button', async () => {
    TestBed.configureTestingModule({providers: [provideTestTranslations('en')]});
    const dialog = TestBed.inject(MatDialog);
    const dialogRef = dialog.open(ScoreHowToDialogComponent);
    const closed = firstValueFrom(dialogRef.afterClosed());
    await TestBed.inject(ApplicationRef).whenStable();
    const button = document.querySelector<HTMLButtonElement>('[data-testid="score-how-to-close"]');
    if (!button) throw new Error('no Close button');

    button.click();

    await closed;
    expect(dialog.openDialogs).toEqual([]);
  });
});
