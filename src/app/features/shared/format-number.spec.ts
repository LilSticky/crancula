import {formatNumber} from './format-number';

describe('formatNumber', () => {
  it('uses the decimal comma in German', () => {
    expect(formatNumber(6.25, 'de')).toBe('6,25');
  });

  it('uses the decimal point in English', () => {
    expect(formatNumber(6.25, 'en')).toBe('6.25');
  });

  it('shows at most 3 fraction digits', () => {
    expect(formatNumber(1.23456, 'en')).toBe('1.235');
  });

  it('does not group digits', () => {
    expect(formatNumber(1234.5, 'de')).toBe('1234,5');
  });
});
