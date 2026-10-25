// API: ScoreHowToDialogComponent (standalone, selector `cranc-score-how-to-dialog`, in ./score-how-to-dialog.component).
// It is a Material dialog without data; it closes its MatDialogRef with its Close button.
import {TestBed} from '@angular/core/testing';
import {MatDialogRef} from '@angular/material/dialog';
import {vi} from 'vitest';
import {provideTestTranslations} from '../../../../../testing/test-translations';
import {ScoreHowToDialogComponent} from './score-how-to-dialog.component';

async function render() {
  const close = vi.fn<(result?: unknown) => void>();
  TestBed.configureTestingModule({
    providers: [provideTestTranslations('en'), {provide: MatDialogRef, useValue: {close}}],
  });
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
  return {element, close, closeButton, fixture};
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
    const {close, closeButton} = await render();

    closeButton().click();

    expect(close).toHaveBeenCalled();
  });
});
