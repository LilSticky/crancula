import type {HoleInspection} from '../inspect-hole';
import {selectedHoleView} from './selected-hole-view';

const INSPECTION: HoleInspection = {
  row: 25,
  noteName: 'F5',
  fromColumn: 65,
  toColumn: 79,
  lengthColumns: 15,
  lengthMm: 37.5,
  gap: {to: 'nextHole', columns: 4, mm: 10},
  warnings: [{kind: 'tooShort', mm: 2, minimumMm: 2.5}],
};

describe('selectedHoleView', () => {
  it('formats every number in the decimal notation of the language', () => {
    const view = selectedHoleView(INSPECTION, 'de');

    expect(view.rowText).toBe('25');
    expect(view.fromText).toBe('65');
    expect(view.toText).toBe('79');
    expect(view.lengthColumnsText).toBe('15');
    expect(view.lengthMmText).toBe('37,5');
    expect(view.gapColumnsText).toBe('4');
    expect(view.gapMmText).toBe('10');
    expect(view.warnings).toEqual([{kind: 'tooShort', mmText: '2', minimumText: '2,5'}]);
  });

  it('keeps the inspection', () => {
    expect(selectedHoleView(INSPECTION, 'en')).toMatchObject({noteName: 'F5', gap: INSPECTION.gap});
  });
});
