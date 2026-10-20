import {TestBed} from '@angular/core/testing';
import {provideTestTranslations} from '../../../../../testing/test-translations';
import {SelectedHoleComponent, type SelectedHoleView} from './selected-hole.component';

const VIEW: SelectedHoleView = {
  row: 25,
  noteName: 'F5',
  fromColumn: 65,
  toColumn: 79,
  lengthColumns: 15,
  lengthMm: 37.5,
  gap: {to: 'nextHole', columns: 4, mm: 10},
  warnings: [],
  rowText: '25',
  fromText: '65',
  toText: '79',
  lengthColumnsText: '15',
  lengthMmText: '37.5',
  gapColumnsText: '4',
  gapMmText: '10',
};

async function render(inspection: SelectedHoleView | undefined) {
  TestBed.configureTestingModule({providers: [provideTestTranslations()]});
  const fixture = TestBed.createComponent(SelectedHoleComponent);
  fixture.componentRef.setInput('inspection', inspection);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const section = element.querySelector('[data-testid="selected-hole"]');
  const text = section?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  return {element, section, text};
}

describe('SelectedHoleComponent', () => {
  it('shows the empty sentence without an inspection', async () => {
    const {text, element} = await render(undefined);

    expect(text).toContain('Select a Hole to see where it is and how long it is.');
    expect(element.querySelectorAll('[data-testid="hole-warning"]')).toHaveLength(0);
  });

  it('shows row, note, Columns, length and the gap to the next Hole', async () => {
    const {text} = await render(VIEW);

    expect(text).toContain('Row 25, F5');
    expect(text).toContain('Columns 65–79');
    expect(text).toContain('15 Columns, 37.5 mm');
    expect(text).toContain('Gap to the next Hole: 4 Columns, 10 mm');
  });

  it('shows the space to the end of the Tape for the last Hole of a row', async () => {
    const {text} = await render({...VIEW, gap: {to: 'tapeEnd', columns: 14, mm: 35}, gapColumnsText: '14', gapMmText: '35'});

    expect(text).toContain('To the end of the Tape: 14 Columns, 35 mm');
    expect(text).not.toContain('Gap to the next Hole');
  });

  it('says "1 Column" in the singular', async () => {
    const {text} = await render({...VIEW, lengthColumns: 1, lengthColumnsText: '1', lengthMm: 2.5, lengthMmText: '2.5'});

    expect(text).toContain('1 Column, 2.5 mm');
  });

  it('lists a warning per problem of the Hole', async () => {
    const {element} = await render({
      ...VIEW,
      warnings: [{kind: 'tooShort', mmText: '2', minimumText: '3'}],
    });

    const warnings = [...element.querySelectorAll('[data-testid="hole-warning"]')].map((warning) => warning.textContent ?? '');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('Cutting Problems');
    expect(warnings[0]).not.toContain('Minimum Hole Length');
    expect(warnings[0]).not.toContain('2 mm of 3 mm');
  });

  it('points a gap warning to the Cutting Problems list instead of repeating the numbers', async () => {
    const {element} = await render({
      ...VIEW,
      warnings: [{kind: 'gapTooSmall', mmText: '1', minimumText: '1.5'}],
    });

    const warning = element.querySelector('[data-testid="hole-warning"]')?.textContent ?? '';
    expect(warning).toContain('Cutting Problems');
    expect(warning).not.toContain('Minimum Gap');
  });

  it('shows the key help line for the selected Hole', async () => {
    const {element} = await render(VIEW);

    const keys = element.querySelector('[data-testid="hole-keys"]');
    expect(keys?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Alt+arrows move it, Shift+arrows move its end, Alt+Shift+arrows its start, Delete removes it.',
    );
  });

  it('keeps the key help line outside the live region', async () => {
    const {element} = await render(VIEW);

    const keys = element.querySelector('[data-testid="hole-keys"]');
    expect(keys).not.toBeNull();
    expect(keys?.closest('[aria-live]')).toBeNull();
  });

  it('gives the key help line the stable id hole-keys-help', async () => {
    const {element} = await render(VIEW);

    expect(element.querySelector('[data-testid="hole-keys"]')?.id).toBe('hole-keys-help');
  });

  it('shows no key help line without an inspection', async () => {
    const {element} = await render(undefined);

    expect(element.querySelector('[data-testid="hole-keys"]')).toBeNull();
  });

  it('announces changes politely', async () => {
    const {section} = await render(VIEW);

    expect(section?.getAttribute('aria-live')).toBe('polite');
  });
});
