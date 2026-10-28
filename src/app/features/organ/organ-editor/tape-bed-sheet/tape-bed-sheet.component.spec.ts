import {TestBed} from '@angular/core/testing';
import {signal} from '@angular/core';
import {type FieldTree, form} from '@angular/forms/signals';
import {ErrorStateMatcher} from '@angular/material/core';
import {emptyOrganDraft, type OrganDraft, toDraft} from '@api/index';
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
  readonly lang?: 'en' | 'de';
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

async function render({
  draft = toDraft(testOrgan('Positive')),
  border = '',
  minimumHoleLength = '',
  fit = null,
  drawing = null,
  lang = 'en',
}: Inputs = {}) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideTestTranslations(lang), SaveAttempt, {provide: ErrorStateMatcher, useClass: ShownViolationMatcher}],
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

  describe('the Tape per Crank turn field', () => {
    it('is empty for an Organ without a Tape per Crank turn', async () => {
      const {field} = await render();

      expect(field('tape-per-crank-turn').value).toBe('');
    });

    it('shows the Tape per Crank turn of the Organ', async () => {
      const {field} = await render({draft: toDraft(testOrgan('Positive', 2, {tapePerCrankTurn: 100}))});

      expect(field('tape-per-crank-turn').value).toBe('100');
    });

    it('is a decimal text input with the suffix "mm"', async () => {
      const {field} = await render();

      expect(field('tape-per-crank-turn').type).toBe('text');
      expect(field('tape-per-crank-turn').getAttribute('inputmode')).toBe('decimal');
      expect(field('tape-per-crank-turn').closest('mat-form-field')?.querySelector('[matTextSuffix]')?.textContent?.trim()).toBe('mm');
    });

    it('is labelled "Tape per Crank turn" and has a hint that is a translated text', async () => {
      const {field} = await render();

      const formField = field('tape-per-crank-turn').closest('mat-form-field');
      expect(formField?.querySelector('mat-label')?.textContent?.trim()).toBe('Tape per Crank turn');
      const hint = formField?.querySelector('mat-hint')?.textContent?.trim() ?? '';
      expect(hint).not.toBe('');
      expect(hint).not.toMatch(/^ORGAN\./);
    });

    it('writes a typed decimal comma into the form as a number', async () => {
      const {field, organ, fixture} = await render();

      const input = field('tape-per-crank-turn');
      input.value = '2,5';
      input.dispatchEvent(new Event('input'));
      await fixture.whenStable();

      expect(organ.tapePerCrankTurn().value()).toBe(2.5);
    });

    it.each(['0', '-1'])('shows "Must be greater than 0." under its path for %s', async (value) => {
      const {field, fixture, element} = await render();

      const input = field('tape-per-crank-turn');
      input.value = value;
      input.dispatchEvent(new Event('input'));
      await fixture.whenStable();

      const messages = [...element.querySelectorAll('[data-testid="violation"][data-path="tapePerCrankTurn"]')].map((error) =>
        error.textContent?.trim(),
      );
      expect(messages).toEqual(['Must be greater than 0.']);
    });
  });

  describe('the Crank speed range fields', () => {
    const violationsAt = (element: HTMLElement, path: string) =>
      [...element.querySelectorAll(`[data-testid="violation"][data-path="${path}"]`)].map((error) => error.textContent?.trim());

    it('are the slowest and the fastest Crank speed, after the Tape per Crank turn', async () => {
      const {element} = await render();

      const ids = [...element.querySelectorAll('[data-testid]')].map((node) => node.getAttribute('data-testid'));
      expect(ids).toContain('slowest-crank-speed');
      expect(ids).toContain('fastest-crank-speed');
      expect(ids.indexOf('slowest-crank-speed')).toBeGreaterThan(ids.indexOf('tape-per-crank-turn'));
      expect(ids.indexOf('fastest-crank-speed')).toBeGreaterThan(ids.indexOf('slowest-crank-speed'));
    });

    it('shows 30 and 120 turns per minute for a new Organ', async () => {
      const {field} = await render({draft: emptyOrganDraft()});

      expect(field('slowest-crank-speed').value).toBe('30');
      expect(field('fastest-crank-speed').value).toBe('120');
    });

    it('writes a typed decimal comma into the form as a number', async () => {
      const {field, organ, fixture} = await render();

      const input = field('slowest-crank-speed');
      input.value = '2,5';
      input.dispatchEvent(new Event('input'));
      await fixture.whenStable();

      expect(organ.slowestCrankSpeed().value()).toBe(2.5);
    });

    it.each([
      {testId: 'slowest-crank-speed', path: 'slowestCrankSpeed', typed: '0'},
      {testId: 'fastest-crank-speed', path: 'fastestCrankSpeed', typed: '301'},
    ])('shows "Enter 1 to 300 turns per minute." under $path for $typed', async ({testId, path, typed}) => {
      const {field, fixture, element} = await render();

      const input = field(testId);
      input.value = typed;
      input.dispatchEvent(new Event('input'));
      await fixture.whenStable();

      expect(violationsAt(element, path)).toEqual(['Enter 1 to 300 turns per minute.']);
    });

    it('shows "The fastest Crank speed must be above the slowest." under the fastest field when the slowest is not below it', async () => {
      const {field, fixture, element} = await render();

      const input = field('slowest-crank-speed');
      input.value = '130';
      input.dispatchEvent(new Event('input'));
      await fixture.whenStable();

      expect(violationsAt(element, 'fastestCrankSpeed')).toEqual(['The fastest Crank speed must be above the slowest.']);
    });
  });

  describe('the Guide margin field', () => {
    /** A 20er-Drehorgel Tape Bed with 3 mm holes, so the smallest Guide margin is 1.5 mm. */
    const guided = (guideMargin: number | null) =>
      toDraft(testOrgan('Positive', 2, {tapeBed: {tapeWidth: 110, holeDiameter: 3, rowSpacing: 3.85, guideMargin}}));

    it('comes after the Spacing between rows and before the Minimum Gap', async () => {
      const {element} = await render();

      const ids = [...element.querySelectorAll('[data-testid]')].map((node) => node.getAttribute('data-testid'));
      expect(ids.indexOf('guide-margin')).toBeGreaterThan(ids.indexOf('row-spacing'));
      expect(ids.indexOf('guide-margin')).toBeLessThan(ids.indexOf('minimum-gap'));
    });

    it('is empty for a centred Organ', async () => {
      const {field} = await render();

      expect(field('guide-margin').value).toBe('');
    });

    it('shows the Guide margin of the Organ', async () => {
      const {field} = await render({draft: guided(10)});

      expect(field('guide-margin').value).toBe('10');
    });

    it('is a decimal text input with the suffix "mm"', async () => {
      const {field} = await render();

      expect(field('guide-margin').type).toBe('text');
      expect(field('guide-margin').getAttribute('inputmode')).toBe('decimal');
      expect(field('guide-margin').closest('mat-form-field')?.querySelector('[matTextSuffix]')?.textContent?.trim()).toBe('mm');
    });

    it('is labelled "Guide margin" and has a hint that is a translated text', async () => {
      const {field} = await render();

      const formField = field('guide-margin').closest('mat-form-field');
      expect(formField?.querySelector('mat-label')?.textContent?.trim()).toBe('Guide margin');
      const hint = formField?.querySelector('mat-hint')?.textContent?.trim() ?? '';
      expect(hint).toBe('Guide edge to the centre of row 1; empty: rows centred');
    });

    it('writes a typed decimal comma into the form as a number', async () => {
      const {field, organ, fixture} = await render({draft: guided(null)});

      const input = field('guide-margin');
      input.value = '2,5';
      input.dispatchEvent(new Event('input'));
      await fixture.whenStable();

      expect(organ.tapeBed.guideMargin().value()).toBe(2.5);
    });

    it('shows "At least 1.5 mm, half the hole diameter, or the holes run off the tape." under its path for a Guide margin of 1.4', async () => {
      const {field, fixture, element} = await render({draft: guided(null)});

      const input = field('guide-margin');
      input.value = '1.4';
      input.dispatchEvent(new Event('input'));
      await fixture.whenStable();

      const messages = [...element.querySelectorAll('[data-testid="violation"][data-path="tapeBed.guideMargin"]')].map((error) =>
        error.textContent?.trim(),
      );
      expect(messages).toEqual(['At least 1.5 mm, half the hole diameter, or the holes run off the tape.']);
    });
  });

  describe('the long fields of the Tape Bed card', () => {
    it.each(['tape-per-crank-turn', 'slowest-crank-speed', 'fastest-crank-speed'])(
      'spans the full row of the field grid, as the Name field does (%s)',
      async (testId) => {
        const {field} = await render();

        expect(field(testId).closest('mat-form-field')?.classList.contains('full-width')).toBe(true);
      },
    );

    it.each(['slowest-crank-speed', 'fastest-crank-speed'])('shows the German Crank speed unit "U/min" (%s)', async (testId) => {
      const {field} = await render({lang: 'de'});

      expect(field(testId).closest('mat-form-field')?.querySelector('[matTextSuffix]')?.textContent?.trim()).toBe('U/min');
    });
  });
});
