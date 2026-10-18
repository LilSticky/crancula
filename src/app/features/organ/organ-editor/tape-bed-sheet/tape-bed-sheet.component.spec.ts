import {TestBed} from '@angular/core/testing';
import {signal} from '@angular/core';
import {type FieldTree, form} from '@angular/forms/signals';
import {ErrorStateMatcher} from '@angular/material/core';
import {type OrganDraft, toDraft} from '@api/index';
import {provideTestTranslations} from '../../../../../testing/test-translations';
import {testOrgan} from '../../../../../testing/organs';
import {organFormSchema, SaveAttempt, ShownViolationMatcher} from '../organ-form';
import {type TapeBedDrawing, type TapeBedFitText, TapeBedSheetComponent} from './tape-bed-sheet.component';

interface Inputs {
  readonly draft?: OrganDraft;
  readonly border?: string;
  readonly minimumHoleLength?: string;
  readonly fit?: TapeBedFitText | null;
  readonly drawing?: TapeBedDrawing | null;
}

const FIT: TapeBedFitText = {
  count: 2,
  rowSpan: '3.5',
  tapeWidth: '120',
  border: '58.25',
  tooWide: false,
  fitKey: 'ORGAN.EDITOR.FIT',
  drawingKey: 'ORGAN.EDITOR.TAPE_BED_DRAWING',
};

const DRAWING: TapeBedDrawing = {tapeWidth: 120, length: 240, border: 58.25, bottomBorderTop: 61.75, rows: [59.5, 63]};

async function render({draft = toDraft(testOrgan('Positive')), border = '', minimumHoleLength = '', fit = null, drawing = null}: Inputs = {}) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideTestTranslations(), SaveAttempt, {provide: ErrorStateMatcher, useClass: ShownViolationMatcher}],
  });
  const organ: FieldTree<OrganDraft> = TestBed.runInInjectionContext(() => form(signal(draft), organFormSchema));
  const fixture = TestBed.createComponent(TapeBedSheetComponent);
  fixture.componentRef.setInput('organ', organ);
  fixture.componentRef.setInput('border', border);
  fixture.componentRef.setInput('minimumHoleLength', minimumHoleLength);
  fixture.componentRef.setInput('fit', fit);
  fixture.componentRef.setInput('drawing', drawing);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const field = (testId: string) => {
    const input = element.querySelector<HTMLInputElement>(`[data-testid="${testId}"]`);
    if (!input) throw new Error(`no field ${testId}`);
    return input;
  };
  return {element, field, organ, fixture};
}

describe('TapeBedSheetComponent', () => {
  it('shows the Organ name and the Tape Bed values in their fields', async () => {
    const {field} = await render();

    expect(field('name').value).toBe('Positive');
    expect(field('tape-width').value).toBe('120');
    expect(field('hole-diameter').value).toBe('2.5');
    expect(field('row-spacing').value).toBe('3.5');
  });

  it('shows the Border and the minimum Hole length it is given', async () => {
    const {field} = await render({border: '58.25', minimumHoleLength: '2.5'});

    expect(field('border').value).toBe('58.25');
    expect(field('minimum-hole-length').value).toBe('2.5');
  });

  it('writes what is typed into the form', async () => {
    const {field, organ, fixture} = await render();

    const name = field('name');
    name.value = 'Regal';
    name.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(organ.name().value()).toBe('Regal');
  });

  it('shows the fit check and the Tape Bed drawing with one row line per Pipe', async () => {
    const {element} = await render({fit: FIT, drawing: DRAWING});

    expect(element.querySelector('[data-testid="fit-check"]')?.textContent).toContain('2 rows take 3.5 mm of the 120 mm tape width');
    expect(element.querySelectorAll('[data-testid="tape-bed-row"]')).toHaveLength(2);
    expect(element.querySelectorAll('[data-testid="tape-bed-border"]')).toHaveLength(2);
  });

  it('shows no fit check and no drawing while the fit is unknown', async () => {
    const {element} = await render();

    expect(element.querySelector('[data-testid="fit-check"]')).toBeNull();
    expect(element.querySelector('[data-testid="tape-bed-drawing"]')).toBeNull();
  });
});
